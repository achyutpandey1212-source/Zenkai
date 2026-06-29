/**
 * Zenkai Graph Engine — Shared Graph State
 *
 * This is the single source of truth that flows through every node.
 * No node directly depends on another node's implementation —
 * everything is communicated through this state object.
 *
 * Mirrors LangGraph's typed state annotation pattern.
 */

import type { IIdentityTrait } from "@/models/IdentityTrait";
import type { IReflection } from "@/models/Reflection";
import type { RetrievalContextPacket } from "@/memory/retrieval-pipeline";
import type { LifeEventExtraction, PlanningIntent } from "@/agents/planning-agent";
import type { IMemory } from "@/models/Memory";
import type { NodeMetadata } from "./types";
import type { InternalEvent } from "../events/event-types";
import type { AICall } from "@/lib/telemetry-context";

// ─────────────────────────────────────────────────────────────────────────────
// Routing Decision
// ─────────────────────────────────────────────────────────────────────────────

export type NodeName =
  | "router"
  | "context"
  | "companion"
  | "planning"
  | "execution"
  | "memory"
  | "identity"
  | "reflection"
  | "assembler"
  | "background"
  // Plugin extension point — future agents register here
  | string;

export interface RoutingDecision {
  /** Foreground nodes run before the user sees a response */
  foreground: NodeName[];
  /** Background nodes run after the response is streamed */
  background: NodeName[];
  /** Which sub-graph to invoke */
  subGraph: "conversation" | "planning" | "mixed";
  /** Human-readable explanation logged for observability */
  reasoning: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Event (streaming protocol — \0{...}\0 events)
// ─────────────────────────────────────────────────────────────────────────────

export interface StatusEvent {
  agent: "memory" | "planning" | "execution" | "identity" | "reflection" | string;
  status: "idle" | "running" | "completed" | "skipped";
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Execution Log Entry (observability)
// ─────────────────────────────────────────────────────────────────────────────

export interface NodeLogEntry extends NodeMetadata {
  nodeName: string;
  workflowId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Error
// ─────────────────────────────────────────────────────────────────────────────

export interface NodeError {
  nodeName: string;
  error: string;
  stack?: string;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan Result (from PlanningAgent)
// ─────────────────────────────────────────────────────────────────────────────

export interface PlanResult {
  success: boolean;
  milestonesCreated: number;
  tasksCreated: number;
  /** New version number of the plan after write (used for plan_version stream event) */
  planVersion?: number;
  /** True when confidence was below threshold — plan was intentionally not modified */
  ignored?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// GraphState — the backbone of Phase 10
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphState {
  // ── Workflow Identity ────────────────────────────────────────────────────
  /** Unique ID for this workflow execution run — present in every log line */
  workflowId: string;
  /** Semantic version of the workflow definition */
  workflowVersion: string;
  /** Semantic version of the graph topology */
  graphVersion: string;

  // ── User Identity ────────────────────────────────────────────────────────
  uid: string;
  conversationId: string;

  // ── Input ────────────────────────────────────────────────────────────────
  userMessage: string;
  history: { role: "user" | "model"; content: string }[];
  todayStr: string;

  // ── Classification (set by router.node) ──────────────────────────────────
  intent: PlanningIntent | null;
  lifeEvents: LifeEventExtraction | null;
  routingDecision: RoutingDecision | null;

  // ── Retrieved Context (set by context.node) ───────────────────────────────
  memoryContext: RetrievalContextPacket | null;
  activeTraits: IIdentityTrait[];
  activeReflections: IReflection[];
  profile: {
    profession?: string;
    longTermGoal?: string;
    currentFocus?: string;
    motivation?: string;
    dailyAvailability?: string;
    workStyle?: string;
    biggestChallenge?: string;
  } | null;
  activePlans: unknown[];
  todaySchedule: unknown | null;

  // ── Formatted Prompt Fragments (set by context.node) ─────────────────────
  memoryPromptText: string;
  identityPromptText: string;
  reflectionPromptText: string;
  profilePromptText: string;
  planPromptText: string;

  // ── Foreground Node Outputs ───────────────────────────────────────────────
  companionResponseDraft: string;
  planResult: PlanResult | null;
  agendaBuilt: boolean;
  taskUpdateExecuted: boolean;

  // ── Background Node Outputs ───────────────────────────────────────────────
  newMemory: IMemory | null;
  evolvedTraits: boolean;
  evolvedReflections: boolean;

  // ── Streaming Control ─────────────────────────────────────────────────────
  /** Injected by the chat route before graph starts */
  streamController: ReadableStreamDefaultController | null;
  encoder: TextEncoder | null;
  statusEvents: StatusEvent[];

  // ── Internal Events ───────────────────────────────────────────────────────
  emittedEvents: InternalEvent[];

  // ── Observability ─────────────────────────────────────────────────────────
  /** One entry appended after every node completes */
  nodeLog: NodeLogEntry[];
  /** Wall-clock timestamp when the workflow started */
  startedAt: number;
  /** Chronological AI calls recorded during this workflow run */
  aiCalls?: AICall[];

  // ── Error Tracking (isolated — one failure never kills the workflow) ───────
  errors: NodeError[];

  // ── Checkpointing ─────────────────────────────────────────────────────────
  /** Checkpoint IDs saved after major nodes (router, planning, execution, assembler) */
  checkpointIds: string[];

  // ── Plugin Extensions ─────────────────────────────────────────────────────
  /**
   * Arbitrary key-value bag for plugin nodes (Calendar, Gmail, Search, etc.).
   * Plugins write their outputs here without modifying GraphState's core schema.
   */
  pluginData: Record<string, unknown>;

  // ── AI Budgeting ──────────────────────────────────────────────────────────
  /** Tracks the number of Gemini API calls made in this workflow run */
  aiCallsCount: number;
  /** Maximum number of Gemini API calls allowed for this workflow run */
  maxAiCallsAllowed: number;

  // ── Context Versioning ─────────────────────────────────────────────────────
  /** Context Version (Phase 16A) */
  contextVersion?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory — creates a fresh GraphState skeleton
// ─────────────────────────────────────────────────────────────────────────────

export function createInitialState(overrides: Partial<GraphState> & {
  workflowId: string;
  uid: string;
  conversationId: string;
  userMessage: string;
  history: GraphState["history"];
}): GraphState {
  return {
    workflowVersion: "1.0.0",
    graphVersion: "1.0.0",
    todayStr: new Date().toISOString().split("T")[0],
    aiCallsCount: 0,
    maxAiCallsAllowed: 3, // Default budget for general chat
    intent: null,
    lifeEvents: null,
    routingDecision: null,
    memoryContext: null,
    activeTraits: [],
    activeReflections: [],
    profile: null,
    activePlans: [],
    todaySchedule: null,
    memoryPromptText: "",
    identityPromptText: "",
    reflectionPromptText: "",
    profilePromptText: "",
    planPromptText: "",
    companionResponseDraft: "",
    planResult: null,
    agendaBuilt: false,
    taskUpdateExecuted: false,
    newMemory: null,
    evolvedTraits: false,
    evolvedReflections: false,
    streamController: null,
    encoder: null,
    statusEvents: [],
    emittedEvents: [],
    nodeLog: [],
    startedAt: Date.now(),
    errors: [],
    checkpointIds: [],
    pluginData: {},
    aiCalls: [],
    ...overrides,
  };
}
