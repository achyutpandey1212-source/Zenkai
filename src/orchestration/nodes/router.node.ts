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
import { PendingActionService } from "@/services/pending-action.service";

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

    case "schedule_modification":
      return {
        foreground: ["companion", "execution"],
        background: ["memory"],
        subGraph: "schedule",
        reasoning: "User wants to modify their schedule directly. Running execution only.",
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
// Helper: detect affirmative user messages
// ─────────────────────────────────────────────────────────────────────────────

const AFFIRMATIVE_PATTERNS = [
  /^yes$/i,
  /^yeah$/i,
  /^yep$/i,
  /^sure$/i,
  /^y$/i,
  /^go ahead$/i,
  /^please do$/i,
  /^sounds good$/i,
  /^do it$/i,
  /^confirm$/i,
];

function isAffirmative(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return AFFIRMATIVE_PATTERNS.some((p) => p.test(normalized));
}

// ─────────────────────────────────────────────────────────────────────────────
// Router Node Function
// ─────────────────────────────────────────────────────────────────────────────

export async function routerNode(
  state: Readonly<GraphState>
): Promise<NodeResult<GraphState>> {
  const startedAt = Date.now();

  try {
    let intent: PlanningIntent = { type: "none" };
    let lifeEvents: LifeEventExtraction = {
      hasActionableContent: false,
      suggestsPlanning: false,
      extractionReason: "",
      detectedEvents: [],
    };
    let maxAiCallsAllowed = 3; // Default General chat budget
    let callsMade = 0;

    // ── 1. Check for pending action confirmation BEFORE Gemini ───────────────────
    const pendingAction = state.pendingAction && !PendingActionService.isExpired(state.pendingAction)
      ? state.pendingAction
      : await PendingActionService.getActive(state.conversationId);

    if (pendingAction && isAffirmative(state.userMessage)) {
      console.log(`[Router] Pending action confirmation detected. Type: ${pendingAction.type}`);
      intent = { type: "schedule_modification", scheduleOperation: pendingAction.payload.scheduleOperation };
      lifeEvents = {
        hasActionableContent: false,
        suggestsPlanning: false,
        extractionReason: "Confirmed pending action",
        detectedEvents: [],
      };
      maxAiCallsAllowed = 0;

      console.log(
        `[Router] Decision reasoning: Confirmed pending action -> schedule_modification | Foreground: [companion, execution] | BG: [memory]`
      );

      const routingDecision = buildRoutingDecision("schedule_modification", false);

      return {
        patch: {
          intent,
          lifeEvents,
          routingDecision,
          emittedEvents: [{
            name: ZenkaiEvent.PendingActionConfirmed,
            payload: {
              uid: state.uid,
              workflowId: state.workflowId,
              actionType: pendingAction.type,
            },
            emittedAt: new Date().toISOString(),
          }],
          maxAiCallsAllowed,
          aiCallsCount: state.aiCallsCount,
        },
        metadata: {
          success: true,
          duration: Date.now() - startedAt,
          skipped: false,
          reason: `Pending action confirmed | Type: ${pendingAction.type}`,
        },
      };
    }

    // ── 2. Handle negative responses to pending actions ──────────────────────────
    if (pendingAction && /^(no|nah|nope|not now|cancel|stop)$/i.test(state.userMessage.trim())) {
      console.log(`[Router] User declined pending action. Clearing.`);
      await PendingActionService.clear(state.conversationId);
      // Continue with default 'none' intent - no schedule modifications
    }

    // 1. Try deterministic local shortcuts first
    console.log(`[Conversation] AI request: "${state.userMessage}"`);
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

    if (intent.type === "create_or_modify") {
      console.log(`[Planner] Weekly planning/roadmap evolution initiated.`);
    }

    const routingDecision = buildRoutingDecision(
      intent.type,
      lifeEvents.suggestsPlanning
    );

    console.log(
      `[Router] Decision reasoning: ${routingDecision.reasoning} | Foreground: [${routingDecision.foreground.join(",")}] | BG: [${routingDecision.background.join(",")}]`
    );

    // [ScheduleDebug] Router Output - detailed logging for schedule modifications
    if (intent.type === "schedule_modification") {
      console.log(`[ScheduleDebug] [1] Router Output`);
      console.log(`[ScheduleDebug] Detected intent: ${intent.type}`);
      console.log(`[ScheduleDebug] Full intent: ${JSON.stringify(intent)}`);
      console.log(`[ScheduleDebug] scheduleOperation present: ${!!intent.scheduleOperation}`);
      console.log(`[ScheduleDebug] scheduleOperation: ${JSON.stringify(intent.scheduleOperation)}`);
      console.log(`[ScheduleDebug] Operation: ${intent.operation}`);
      console.log(`[ScheduleDebug] scheduleDetails: ${intent.scheduleDetails}`);
      console.log(`[ScheduleDebug] Routing decision - foreground: [${routingDecision.foreground.join(",")}] | background: [${routingDecision.background.join(",")}] | subGraph: ${routingDecision.subGraph}`);
    }

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