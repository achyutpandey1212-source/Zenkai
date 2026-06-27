/**
 * Zenkai Graph Engine — Core Types
 *
 * API surface intentionally mirrors LangGraph (StateGraph, addNode, addEdge,
 * addConditionalEdges, compile, invoke) so future migration to @langchain/langgraph
 * remains straightforward.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Node Metadata — returned by every node alongside state patch
// ─────────────────────────────────────────────────────────────────────────────

export interface NodeMetadata {
  /** Whether the node completed without throwing */
  success: boolean;
  /** Wall-clock duration in milliseconds */
  duration: number;
  /** Whether this node was skipped (routing decision) */
  skipped: boolean;
  /** Human-readable reason for skip or failure */
  reason: string | null;
  /** Name of the node (set automatically by engine) */
  nodeName?: string;
  /** Timestamp when node started (ISO string) */
  startedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Result — what every node function must return
// ─────────────────────────────────────────────────────────────────────────────

export interface NodeResult<S extends object> {
  /** Partial state patch to merge into the graph state */
  patch: Partial<S>;
  /** Structured metadata for logging and observability */
  metadata: Omit<NodeMetadata, "nodeName" | "startedAt">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Function — the signature every node must implement
// ─────────────────────────────────────────────────────────────────────────────

export type NodeFn<S extends object> = (state: Readonly<S>) => Promise<NodeResult<S>>;

// ─────────────────────────────────────────────────────────────────────────────
// Edge Condition — decides which next node to route to
// ─────────────────────────────────────────────────────────────────────────────

export type EdgeCondition<S extends object> = (state: Readonly<S>) => string;

// ─────────────────────────────────────────────────────────────────────────────
// Parallel Group — list of node names to run concurrently
// ─────────────────────────────────────────────────────────────────────────────

export interface ParallelGroup {
  type: "parallel";
  nodes: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph edge definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface ConditionalEdge<S extends object> {
  from: string;
  condition: EdgeCondition<S>;
  /** Maps condition return value → next node name */
  edgeMap: Record<string, string>;
}

export interface DirectEdge {
  from: string;
  to: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compiled Graph — produced by StateGraph.compile()
// ─────────────────────────────────────────────────────────────────────────────

export interface CompiledGraph<S extends object> {
  /** Execute the graph to completion and return final state */
  invoke: (initialState: S) => Promise<S>;
  /**
   * Execute the graph, yielding state after each node completes.
   * Mirrors LangGraph's `.stream()` concept.
   */
  stream: (initialState: S) => AsyncGenerator<{ node: string; state: S; metadata: NodeMetadata }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph Checkpoint
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphCheckpoint<S extends object> {
  workflowId: string;
  workflowVersion: string;
  graphVersion: string;
  checkpointedAt: string;
  afterNode: string;
  state: S;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin interface — for pluggable future agents (Calendar, Gmail, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentPlugin<S extends object> {
  /** Unique plugin name */
  name: string;
  /** Version string for changelog tracking */
  version: string;
  /** Short description of what this plugin does */
  description: string;
  /** Node function implementing the plugin's work */
  nodeFn: NodeFn<S>;
  /**
   * Optional list of ZenkaiEvent names this plugin subscribes to.
   * The event bus will automatically call this plugin's handler when these fire.
   */
  subscribesToEvents?: string[];
  /** Optional event handler for subscribed events */
  onEvent?: (eventName: string, payload: unknown) => Promise<void>;
}
