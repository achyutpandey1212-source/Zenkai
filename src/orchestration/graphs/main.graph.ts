/**
 * Main Graph — Zenkai's Cognitive Backbone
 *
 * This is the root graph that every user interaction flows through.
 * It uses the StateGraph engine and routes to sub-behaviors via conditional edges.
 *
 * Graph topology:
 *
 *   START → router → context → companion
 *                           ↓ (conditional on routing decision)
 *                      planning (if needed)
 *                           ↓
 *                      execution (if needed)
 *                           ↓
 *                      background (parallel: memory + identity + reflection)
 *                           ↓
 *                      assembler → END
 *
 * Plugin nodes registered in PluginRegistry are automatically added
 * before compilation — no existing code changes required.
 */

import { StateGraph, START, END } from "../graph/engine";
import type { GraphState } from "../graph/state";
import { routerNode, shouldRunPlanning, shouldRunExecution } from "../nodes/router.node";
import { contextNode } from "../nodes/context.node";
import { companionNode } from "../nodes/companion.node";
import { planningNode } from "../nodes/planning.node";
import { executionNode } from "../nodes/execution.node";
import { backgroundNode } from "../nodes/background.node";
import { assemblerNode } from "../nodes/assembler.node";
import { PluginRegistry } from "../plugins/plugin-registry";
import { GraphLogger } from "../utils/graph-logger";

// ─────────────────────────────────────────────────────────────────────────────
// Conditional edge functions
// ─────────────────────────────────────────────────────────────────────────────

function afterPlanning(state: Readonly<GraphState>): string {
  return shouldRunExecution(state);
}

function afterExecution(_state: Readonly<GraphState>): string {
  return "background";
}

function afterBackground(_state: Readonly<GraphState>): string {
  return "assembler";
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph factory — builds and compiles the main graph
// ─────────────────────────────────────────────────────────────────────────────

function buildMainGraph() {
  const graph = new StateGraph<GraphState>();

  // ── Core nodes ──────────────────────────────────────────────────────────────
  graph
    .addNode("router", routerNode)
    .addNode("context", contextNode)
    .addNode("companion", companionNode)
    .addNode("planning", planningNode)
    .addNode("execution", executionNode)
    .addNode("background", backgroundNode)
    .addNode("assembler", assemblerNode);

  // ── Plugin nodes (auto-discovered from PluginRegistry) ─────────────────────
  const plugins = PluginRegistry.getRegisteredPlugins();
  for (const plugin of plugins) {
    if (!graph["nodes"].has(plugin.name)) {
      graph.addNode(plugin.name, plugin.nodeFn);
      console.log(`[MainGraph] Auto-wired plugin node: ${plugin.name}`);
    }
  }

  // ── Graph edges (execution flow) ────────────────────────────────────────────
  graph
    .addEdge(START, "router")
    .addEdge("router", "context")
    .addEdge("context", "companion");

  // After companion: run planning if needed, else jump straight to execution check
  graph.addConditionalEdges("companion", shouldRunPlanning, {
    planning: "planning",
    skip_planning: "execution",
  });

  // After planning: run execution if needed
  graph.addConditionalEdges("planning", afterPlanning, {
    execution: "execution",
    skip_execution: "background",
  });

  // After execution check: always run background
  graph.addConditionalEdges("execution", afterExecution, {
    background: "background",
  });

  // After background: always assemble
  graph.addConditionalEdges("background", afterBackground, {
    assembler: "assembler",
  });

  graph.addEdge("assembler", END);

  // ── Checkpoint nodes ────────────────────────────────────────────────────────
  graph.setCheckpointNodes(["router", "planning", "execution", "assembler"]);

  // ── Entry point ──────────────────────────────────────────────────────────────
  graph.setEntryPoint(START);

  return graph.compile();
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton compiled graph — compiled once at module load
// ─────────────────────────────────────────────────────────────────────────────

let _compiledGraph: ReturnType<typeof buildMainGraph> | null = null;

export function getMainGraph() {
  if (!_compiledGraph) {
    _compiledGraph = buildMainGraph();
    console.log("[MainGraph] Graph compiled. Nodes: router, context, companion, planning, execution, background, assembler" +
      (PluginRegistry.listNames().length > 0 ? `, plugins: [${PluginRegistry.listNames().join(", ")}]` : ""));
  }
  return _compiledGraph;
}

/**
 * Invalidate the compiled graph singleton.
 * Call this after registering new plugins so the graph is recompiled
 * with the new nodes on the next request.
 */
export function invalidateMainGraph(): void {
  _compiledGraph = null;
  console.log("[MainGraph] Graph cache invalidated. Will recompile on next request.");
}

/**
 * Main graph invocation entry point.
 * Logs workflow start/complete around graph execution.
 */
export async function invokeMainGraph(initialState: GraphState): Promise<GraphState> {
  GraphLogger.workflowStarted(initialState as unknown as Record<string, unknown>);

  const graph = getMainGraph();
  
  const finalState = await graph.invoke(initialState);

  return finalState;
}
