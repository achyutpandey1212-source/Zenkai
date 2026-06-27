/**
 * Router Node
 *
 * The first node in every workflow.
 * Classifies intent and builds the RoutingDecision that drives conditional edges.
 *
 * Responsibilities:
 * - Run PlanningAgent.extractLifeEvents() and PlanningAgent.detectIntent() in parallel
 * - Decide which nodes to activate (foreground vs background)
 * - Never touch the database or external systems beyond intent classification
 */

import type { NodeResult } from "../graph/types";
import type { GraphState, RoutingDecision } from "../graph/state";
import { PlanningAgent } from "@/agents/planning-agent";
import type { PlanningIntent, LifeEventExtraction } from "@/agents/planning-agent";
import { ZenkaiEvent } from "../events/event-types";
import type { InternalEvent } from "../events/event-types";

// ─────────────────────────────────────────────────────────────────────────────
// Routing Decision Matrix
// ─────────────────────────────────────────────────────────────────────────────

function buildRoutingDecision(
  intentType: string,
  lifeEventsSuggestPlanning: boolean
): RoutingDecision {
  switch (intentType) {
    case "create_or_modify":
      return {
        foreground: ["companion", "planning", "execution"],
        background: ["memory", "identity", "reflection"],
        subGraph: "planning",
        reasoning: "User wants to create or modify a plan. Running planning + execution in foreground.",
      };

    case "task_update":
      return {
        foreground: ["companion", "execution"],
        background: ["memory", "identity", "reflection"],
        subGraph: "planning",
        reasoning: "User updated a task. Rebalancing agenda in foreground, evolution in background.",
      };

    case "execution_inquiry":
      return {
        foreground: ["companion", "execution"],
        background: ["memory"],
        subGraph: "planning",
        reasoning: "User asked what to do today. Loading agenda in foreground.",
      };

    case "none":
    default:
      if (lifeEventsSuggestPlanning) {
        // Mixed intent — casual message but life signals detected
        return {
          foreground: ["companion", "planning", "execution"],
          background: ["memory", "identity", "reflection"],
          subGraph: "mixed",
          reasoning: "Casual message with embedded life signals. Running planning in foreground.",
        };
      }
      return {
        foreground: ["companion"],
        background: ["memory", "identity", "reflection"],
        subGraph: "conversation",
        reasoning: "General conversation. Companion foreground, evolution in background.",
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Router Node Function
// ─────────────────────────────────────────────────────────────────────────────

export async function routerNode(
  state: Readonly<GraphState>
): Promise<NodeResult<GraphState>> {
  const startedAt = Date.now();

  try {
    let intent: PlanningIntent;
    let lifeEvents: LifeEventExtraction;
    let maxAiCallsAllowed = 3; // Default General chat budget
    let callsMade = 0;

    // 1. Try deterministic local shortcuts first
    const shortcut = PlanningAgent.detectLocalIntentShortcut(state.userMessage, state.history);

    if (shortcut) {
      intent = shortcut.intent;
      lifeEvents = shortcut.lifeEvents;
      maxAiCallsAllowed = shortcut.budget;
      console.log(`[Router] Local shortcut matched. Intent: ${intent.type} | Budget: ${maxAiCallsAllowed}`);
    } else {
      // 2. Fall back to unified Gemini call (Router + Life Event Extraction in 1 call)
      const merged = await PlanningAgent.detectIntentAndExtractLifeEvents(state.userMessage, state.history);
      intent = merged.intent;
      lifeEvents = merged.lifeEvents;
      maxAiCallsAllowed = merged.budget;
      callsMade = 1;
      console.log(`[Router] Gemini unified routing complete. Intent: ${intent.type} | Life signals: ${lifeEvents.suggestsPlanning} | Budget: ${maxAiCallsAllowed}`);
    }

    const routingDecision = buildRoutingDecision(
      intent.type,
      lifeEvents.suggestsPlanning
    );

    console.log(
      `[Router] Decision reasoning: ${routingDecision.reasoning} | Foreground: [${routingDecision.foreground.join(",")}] | BG: [${routingDecision.background.join(",")}]`
    );

    const emittedEvents: InternalEvent[] = [
      {
        name: ZenkaiEvent.WorkflowStarted,
        payload: {
          uid: state.uid,
          workflowId: state.workflowId,
          workflowVersion: state.workflowVersion,
          graphVersion: state.graphVersion,
        },
        emittedAt: new Date().toISOString(),
      },
    ];

    return {
      patch: {
        intent: intent,
        lifeEvents,
        routingDecision,
        emittedEvents,
        maxAiCallsAllowed,
        aiCallsCount: state.aiCallsCount + callsMade,
      },
      metadata: {
        success: true,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `Intent: ${intent.type} | Sub-graph: ${routingDecision.subGraph} | Calls: ${callsMade} | Budget: ${maxAiCallsAllowed}`,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // On router failure — default to safe conversation-only routing
    const fallbackRouting: RoutingDecision = {
      foreground: ["companion"],
      background: [],
      subGraph: "conversation",
      reasoning: "Router failed — defaulting to companion-only routing.",
    };

    return {
      patch: { routingDecision: fallbackRouting },
      metadata: {
        success: false,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `Router error: ${errorMessage} — using fallback routing`,
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Routing helpers used by conditional edges in main graph
// ─────────────────────────────────────────────────────────────────────────────

export function resolveSubGraph(state: Readonly<GraphState>): string {
  return state.routingDecision?.subGraph ?? "conversation";
}

export function shouldRunPlanning(state: Readonly<GraphState>): string {
  const fg = state.routingDecision?.foreground ?? [];
  return fg.includes("planning") ? "planning" : "skip_planning";
}

export function shouldRunExecution(state: Readonly<GraphState>): string {
  const fg = state.routingDecision?.foreground ?? [];
  return fg.includes("execution") ? "execution" : "skip_execution";
}
