/**
 * Planning Node
 *
 * Foreground node responsible for generating or evolving the user's long-term plan.
 * Only runs when the routing decision includes "planning" in the foreground list.
 *
 * Responsibilities:
 * - Guard against non-planning intents (skips gracefully)
 * - Call PlanningAgent.generateOrEvolvePlan() and capture its result
 * - Emit PlanCreated / PlanUpdated internal events to the EventBus
 * - Push real-time status events to the streaming controller
 */

import type { NodeResult } from "../graph/types";
import type { GraphState } from "../graph/state";
import { PlanningAgent } from "@/agents/planning-agent";
import { ZenkaiEvent } from "../events/event-types";
import type { InternalEvent } from "../events/event-types";

// ─────────────────────────────────────────────────────────────────────────────
// Stream helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeStatusEvent(agent: string, status: string, message: string): string {
  return `\0${JSON.stringify({ __type: "status", agent, status, message })}\0`;
}

function emitStatusToStream(
  state: Readonly<GraphState>,
  agent: string,
  status: string,
  message: string
): void {
  if (state.streamController && state.encoder) {
    state.streamController.enqueue(
      state.encoder.encode(makeStatusEvent(agent, status, message))
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Skipped result factory
// ─────────────────────────────────────────────────────────────────────────────

function skipped(reason: string, startedAt: number): NodeResult<GraphState> {
  return {
    patch: {},
    metadata: {
      success: true,
      duration: Date.now() - startedAt,
      skipped: true,
      reason,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Planning Node Function
// ─────────────────────────────────────────────────────────────────────────────

export async function planningNode(
  state: Readonly<GraphState>
): Promise<NodeResult<GraphState>> {
  const startedAt = Date.now();

  // ── Guard: only run if routing decision explicitly includes "planning" in foreground
  const foreground = state.routingDecision?.foreground ?? [];
  if (!foreground.includes("planning")) {
    return skipped("Not in foreground routing decision.", startedAt);
  }

  // ── Guard: intent and lifeEvents must both be present
  if (!state.intent) {
    emitStatusToStream(state, "planning", "skipped", "No intent classified — skipping planning.");
    return skipped("Intent is null — cannot determine planning action.", startedAt);
  }

  if (!state.lifeEvents) {
    emitStatusToStream(state, "planning", "skipped", "No life events extracted — skipping planning.");
    return skipped("Life events extraction is null — skipping planning.", startedAt);
  }

  // ── Guard: only act on create_or_modify intent
  if (state.intent.type !== "create_or_modify") {
    emitStatusToStream(
      state,
      "planning",
      "skipped",
      `Intent is "${state.intent.type}" — planning node only acts on create_or_modify.`
    );
    return skipped(
      `Intent type "${state.intent.type}" does not trigger planning.`,
      startedAt
    );
  }

  // ── Emit running status to stream
  emitStatusToStream(
    state,
    "planning",
    "running",
    "Generating or evolving your plan\u2026"
  );

  console.log(
    `[PlanningNode] wf:${state.workflowId.slice(0, 8)} | uid=${state.uid} | intent=${state.intent.type}`
  );

  try {
    // ── Core planning call (pass state to reuse loaded DB context)
    const rawResult = await PlanningAgent.generateOrEvolvePlan(
      state.uid,
      state.intent,
      state.userMessage,
      state.lifeEvents,
      state
    );
    const callsMade = rawResult ? 1 : 0;

    // ── Guard: agent returned null (e.g. DB error inside PlanningAgent)
    if (rawResult === null) {
      emitStatusToStream(
        state,
        "planning",
        "skipped",
        "Plan generation returned no result."
      );
      return {
        patch: {
          planResult: { success: false, milestonesCreated: 0, tasksCreated: 0 },
          aiCallsCount: state.aiCallsCount + callsMade,
        },
        metadata: {
          success: false,
          duration: Date.now() - startedAt,
          skipped: false,
          reason: "PlanningAgent returned null",
        },
      };
    }

    // Narrow to non-null — all property accesses below are safe
    const planResult = rawResult;

    // ── Build internal events
    const newEvents: InternalEvent[] = [];

    if (planResult.success) {
      // Determine whether this was a fresh creation or an evolution
      const isCreation = planResult.milestonesCreated > 0 || planResult.tasksCreated > 0;
      const eventName = isCreation ? ZenkaiEvent.PlanCreated : ZenkaiEvent.PlanUpdated;

      newEvents.push({
        name: eventName,
        payload: {
          uid: state.uid,
          workflowId: state.workflowId,
          milestonesCreated: planResult.milestonesCreated,
          tasksCreated: planResult.tasksCreated,
          intentType: state.intent.type,
          planType: state.intent.planType ?? null,
          goalTitle: state.intent.goalTitle ?? null,
        },
        emittedAt: new Date().toISOString(),
      });

      // GoalChanged event for downstream plugins (Calendar, Notifications, etc.)
      newEvents.push({
        name: ZenkaiEvent.GoalChanged,
        payload: {
          uid: state.uid,
          workflowId: state.workflowId,
          planType: state.intent.planType ?? undefined,
          action: isCreation ? "created" : "updated",
        },
        emittedAt: new Date().toISOString(),
      });

      emitStatusToStream(
        state,
        "planning",
        "completed",
        isCreation
          ? `Plan created \u2014 ${planResult.milestonesCreated} milestones, ${planResult.tasksCreated} tasks.`
          : `Plan evolved \u2014 ${planResult.milestonesCreated} milestones, ${planResult.tasksCreated} tasks updated.`
      );
    } else {
      // Planning ran but returned success=false — treat as skipped
      emitStatusToStream(
        state,
        "planning",
        "skipped",
        "Plan generation returned no changes."
      );
    }

    return {
      patch: {
        planResult,
        emittedEvents: [...state.emittedEvents, ...newEvents],
        aiCallsCount: state.aiCallsCount + callsMade,
      },
      metadata: {
        success: true,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: planResult.success
          ? `Plan ${planResult.milestonesCreated > 0 ? "created" : "updated"} | milestones=${planResult.milestonesCreated} tasks=${planResult.tasksCreated}`
          : "PlanningAgent returned success=false",
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    emitStatusToStream(
      state,
      "planning",
      "skipped",
      "Planning encountered an error \u2014 your session continues normally."
    );

    console.error(`[PlanningNode] Error: ${errorMessage}`);

    return {
      patch: {
        planResult: { success: false, milestonesCreated: 0, tasksCreated: 0 },
      },
      metadata: {
        success: false,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `PlanningAgent threw: ${errorMessage}`,
      },
    };
  }
}
