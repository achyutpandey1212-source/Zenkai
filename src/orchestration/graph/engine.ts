/**
 * Zenkai Graph Engine — StateGraph
 *
 * A LangGraph-compatible typed graph engine implemented natively in TypeScript.
 *
 * API surface intentionally mirrors @langchain/langgraph:
 *   new StateGraph(schema)
 *   .addNode(name, fn)
 *   .addEdge(from, to)
 *   .addConditionalEdges(from, condition, edgeMap)
 *   .compile()
 *   .invoke(state)
 *
 * Additional APIs beyond LangGraph standard:
 *   .addParallelGroup(name, nodes)  — runs a named set of nodes concurrently
 *   .setCheckpointNodes(nodes)      — marks nodes that trigger state persistence
 */

import type {
  NodeFn,
  NodeResult,
  NodeMetadata,
  EdgeCondition,
  ConditionalEdge,
  DirectEdge,
  CompiledGraph,
  ParallelGroup,
} from "./types";
import { GraphLogger } from "../utils/graph-logger";
import { CheckpointManager } from "../utils/checkpoint";
import { EventBus } from "../events/event-bus";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const START = "__start__";
export const END = "__end__";

// ─────────────────────────────────────────────────────────────────────────────
// StateGraph
// ─────────────────────────────────────────────────────────────────────────────

export class StateGraph<S extends object> {
  private nodes: Map<string, NodeFn<S>> = new Map();
  private directEdges: DirectEdge[] = [];
  private conditionalEdges: ConditionalEdge<S>[] = [];
  private parallelGroups: Map<string, ParallelGroup> = new Map();
  private checkpointNodes: Set<string> = new Set();
  private entryPoint: string = START;

  // ── Registration API (mirrors LangGraph) ───────────────────────────────────

  addNode(name: string, fn: NodeFn<S>): this {
    if (this.nodes.has(name)) {
      throw new Error(`[StateGraph] Node "${name}" is already registered.`);
    }
    this.nodes.set(name, fn);
    return this;
  }

  addEdge(from: string, to: string): this {
    this.directEdges.push({ from, to });
    return this;
  }

  addConditionalEdges(
    from: string,
    condition: EdgeCondition<S>,
    edgeMap: Record<string, string>
  ): this {
    this.conditionalEdges.push({ from, condition, edgeMap });
    return this;
  }

  /**
   * Register a parallel group — a named group of nodes that will be
   * run concurrently via Promise.allSettled() when this group is a target
   * in an edge. Internally the group is treated as a single virtual node.
   *
   * Example:
   *   graph.addParallelGroup("background", ["memory", "identity", "reflection"])
   *   graph.addEdge("assembler", "background")
   */
  addParallelGroup(name: string, nodeNames: string[]): this {
    this.parallelGroups.set(name, { type: "parallel", nodes: nodeNames });
    // Register a virtual node that runs all nodes in parallel
    const self = this;
    const parallelFn: NodeFn<S> = async (state: Readonly<S>) => {
      const mergedPatch = await self.runParallel(nodeNames, state);
      return mergedPatch;
    };
    this.nodes.set(name, parallelFn);
    return this;
  }

  /** Mark nodes that should have state checkpointed after completion */
  setCheckpointNodes(nodeNames: string[]): this {
    for (const n of nodeNames) this.checkpointNodes.add(n);
    return this;
  }

  setEntryPoint(nodeName: string): this {
    this.entryPoint = nodeName;
    return this;
  }

  // ── Compilation ────────────────────────────────────────────────────────────

  compile(): CompiledGraph<S> {
    const self = this;
    return {
      invoke: async (initialState: S): Promise<S> => {
        let state = { ...initialState };
        const visited = new Set<string>();

        await self.executeFrom(self.entryPoint === START ? self.getFirstNode() : self.entryPoint, state, visited, (s) => {
          state = s;
        });

        return state;
      },

      stream: async function* (initialState: S) {
        let state = { ...initialState };
        const visited = new Set<string>();

        const queue: string[] = [self.entryPoint === START ? self.getFirstNode() : self.entryPoint];

        while (queue.length > 0) {
          const nodeName = queue.shift()!;
          if (!nodeName || nodeName === END || visited.has(nodeName)) continue;
          visited.add(nodeName);

          const nodeFn = self.nodes.get(nodeName);
          if (!nodeFn) continue;

          const { newState, metadata } = await self.runNodeSafe(nodeName, nodeFn, state);
          state = newState;

          yield { node: nodeName, state, metadata };

          const next = self.resolveNext(nodeName, state);
          for (const n of next) {
            if (!visited.has(n) && n !== END) queue.push(n);
          }
        }
      },
    };
  }

  // ── Internal execution helpers ─────────────────────────────────────────────

  private getFirstNode(): string {
    // Find the node with an edge from START, or just use the first node registered
    const startEdge = this.directEdges.find((e) => e.from === START);
    if (startEdge) return startEdge.to;
    return this.nodes.keys().next().value ?? END;
  }

  private async executeFrom(
    nodeName: string,
    state: S,
    visited: Set<string>,
    onStateUpdate: (s: S) => void
  ): Promise<void> {
    if (!nodeName || nodeName === END || visited.has(nodeName)) return;
    visited.add(nodeName);

    const nodeFn = this.nodes.get(nodeName);
    if (!nodeFn) {
      GraphLogger.warn(state, `Node "${nodeName}" referenced but not registered. Skipping.`);
      return;
    }

    const { newState, metadata } = await this.runNodeSafe(nodeName, nodeFn, state);
    state = newState;
    onStateUpdate(state);

    const next = this.resolveNext(nodeName, state);
    for (const nextNode of next) {
      await this.executeFrom(nextNode, state, visited, onStateUpdate);
    }
  }

  /**
   * Run a single node safely with full error isolation.
   * One node failure NEVER kills the workflow.
   */
  private async runNodeSafe(
    nodeName: string,
    nodeFn: NodeFn<S>,
    state: S
  ): Promise<{ newState: S; metadata: NodeMetadata }> {
    const startedAt = Date.now();
    const startedAtISO = new Date().toISOString();
    let metadata: NodeMetadata;

    try {
      GraphLogger.nodeStart(state, nodeName);
      const result: NodeResult<S> = await nodeFn(state);
      const duration = Date.now() - startedAt;

      metadata = {
        ...result.metadata,
        nodeName,
        startedAt: startedAtISO,
        duration,
      };

      // Merge patch into state
      const newState = { ...state, ...result.patch };

      // Append to nodeLog
      const workflowId = (state as Record<string, unknown>).workflowId as string ?? "unknown";
      (newState as Record<string, unknown>).nodeLog = [
        ...((state as Record<string, unknown>).nodeLog as unknown[] ?? []),
        { ...metadata, workflowId } as unknown,
      ];

      GraphLogger.nodeComplete(newState, nodeName, metadata);

      // Checkpoint after major nodes
      if (this.checkpointNodes.has(nodeName)) {
        await CheckpointManager.save(nodeName, newState as Record<string, unknown>);
      }

      // Emit events collected in this node
      const emittedEvents = (result.patch as Record<string, unknown>).emittedEvents as unknown[];
      if (emittedEvents?.length) {
        for (const ev of emittedEvents as Array<{ name: string; payload: unknown }>) {
          EventBus.emit(ev.name, ev.payload);
        }
      }

      return { newState, metadata };
    } catch (err) {
      const duration = Date.now() - startedAt;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;

      metadata = {
        success: false,
        duration,
        skipped: false,
        reason: `Node threw: ${errorMessage}`,
        nodeName,
        startedAt: startedAtISO,
      };

      GraphLogger.nodeError(state, nodeName, errorMessage, duration);

      // Append error to state — workflow continues
      const errors = [
        ...((state as Record<string, unknown>).errors as unknown[] ?? []),
        {
          nodeName,
          error: errorMessage,
          stack,
          timestamp: startedAtISO,
        },
      ];

      const nodeLog = [
        ...((state as Record<string, unknown>).nodeLog as unknown[] ?? []),
        {
          ...metadata,
          workflowId: (state as Record<string, unknown>).workflowId ?? "unknown",
        },
      ];

      const newState = { ...state, errors, nodeLog } as S;
      return { newState, metadata };
    }
  }

  /**
   * Run a list of nodes concurrently via Promise.allSettled().
   * State patches are merged in registration order after all settle.
   */
  private async runParallel(nodeNames: string[], state: S): Promise<NodeResult<S>> {
    const startedAt = Date.now();

    const tasks = nodeNames.map(async (name) => {
      const fn = this.nodes.get(name);
      if (!fn) return { name, result: null as { newState: S; metadata: NodeMetadata } | null };
      const result = await this.runNodeSafe(name, fn, state);
      return { name, result };
    });

    const settled = await Promise.allSettled(tasks);

    let mergedPatch: Partial<S> = {};
    const nodeLog: unknown[] = [];

    type ParallelTaskResult = { name: string; result: { newState: S; metadata: NodeMetadata } | null };

    for (const s of settled) {
      if (s.status === "fulfilled" && s.value.result) {
        mergedPatch = { ...mergedPatch, ...s.value.result.newState };
        // Collect log entries from each parallel sub-run
        const subLog = (s.value.result.newState as Record<string, unknown>).nodeLog;
        if (Array.isArray(subLog)) nodeLog.push(...subLog);
      }
    }

    // Merge node logs
    const existingLog = (state as Record<string, unknown>).nodeLog as unknown[] ?? [];
    mergedPatch = { ...mergedPatch, nodeLog: [...existingLog, ...nodeLog] as unknown } as Partial<S>;

    return {
      patch: mergedPatch,
      metadata: {
        success: true,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `Parallel group ran ${nodeNames.length} nodes`,
      },
    };
  }

  /** Resolve next node(s) from the current node based on edges */
  private resolveNext(nodeName: string, state: S): string[] {
    const next: string[] = [];

    // Direct edges
    for (const edge of this.directEdges) {
      if (edge.from === nodeName) next.push(edge.to);
    }

    // Conditional edges
    for (const condEdge of this.conditionalEdges) {
      if (condEdge.from === nodeName) {
        const key = condEdge.condition(state);
        const target = condEdge.edgeMap[key];
        if (target) next.push(target);
      }
    }

    return next;
  }
}
