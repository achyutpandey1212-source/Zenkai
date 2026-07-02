/**
 * Execution Node
 *
 * Calls SchedulingService to build or rebalance the user's weekly schedule.
 * Only runs when the routing decision includes "execution" in the foreground list.
 *
 * Responsibilities:
 * - Force-regenerate schedule if planning just ran (fresh plan = fresh schedule)
 * - Rebalance schedule when intent is task_update
 * - Lazy-load schedule for execution_inquiry intent (only if not already present)
 * - Emit AgendaUpdated / AgendaCreated internal events
 * - Push real-time status events to the streaming controller
 */

import type { NodeResult } from "../graph/types";
import type { GraphState } from "../graph/state";
import { SchedulingService } from "@/services/scheduling.service";
import { WeeklyExecutionSchedule } from "@/models/WeeklyExecutionSchedule";
import { ZenkaiEvent } from "../events/event-types";
import type { InternalEvent } from "../events/event-types";
import { PlanRepository } from "@/repositories/plan.repository";

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
// Execution Node Function
// ─────────────────────────────────────────────────────────────────────────────

export async function executionNode(
  state: Readonly<GraphState>
): Promise<NodeResult<GraphState>> {
  const startedAt = Date.now();

  // ── Guard: only run if routing decision explicitly includes "execution" in foreground
  const foreground = state.routingDecision?.foreground ?? [];
  if (!foreground.includes("execution")) {
    return skipped("Not in foreground routing decision.", startedAt);
  }

  // ── Emit running status to stream
  emitStatusToStream(
    state,
    "execution",
    "running",
    "Building your weekly schedule…"
  );

  console.log(
    `[ExecutionNode] wf:${state.workflowId.slice(0, 8)} | uid=${state.uid} | intent=${state.intent?.type ?? "unknown"}`
  );

  try {
    const { uid, todayStr } = state;
    const intentType = state.intent?.type ?? "none";

    let schedule: unknown | null = null;
    let agendaBuilt = false;
    let agendaAction: "created" | "regenerated" = "created";
    let callsMade = 0;

    // Helper to get active plan ID for schedule generation
    const getActivePlanId = async () => {
      const activePlans = await PlanRepository.findFullTree(uid);
      return activePlans.length > 0 ? activePlans[0]._id.toString() : null;
    };

    // ── Branch 1: Planning just succeeded — force-regenerate so schedule reflects new plan
    if (state.planResult?.success === true) {
      console.log(`[ExecutionNode] Plan was created/updated — force-regenerating schedule.`);
      emitStatusToStream(
        state,
        "execution",
        "running",
        "New plan detected — rebuilding your schedule from scratch…"
      );
      
      const planId = await getActivePlanId();
      if (planId) {
        const result = await SchedulingService.applyScheduleChange(
          { type: "create_workspace", userId: uid, planId },
          state
        );
        schedule = result?.success ? result.scheduleDoc : null;
        agendaBuilt = result?.success ?? false;
        agendaAction = "regenerated";
        callsMade = agendaBuilt ? 1 : 0;
      }
    }

    // ── Branch 2: Task update intent — deterministically reload schedule from DB
    else if (intentType === "task_update") {
      console.log(`[ExecutionNode] Task update detected — reloading schedule.`);
      emitStatusToStream(
        state,
        "execution",
        "running",
        "Task updated — updating schedule…"
      );
      schedule = await WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" }).lean();
      agendaBuilt = false; // 0 AI calls
      agendaAction = "created";
      callsMade = 0;
    }

    // ── Branch 3: Execution inquiry + no schedule yet — lazy-load schedule
    else if (intentType === "execution_inquiry" && state.todaySchedule === null) {
      console.log(`[ExecutionNode] Execution inquiry — loading schedule.`);
      const exists = await WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" }).lean();
      
      if (!exists) {
        const planId = await getActivePlanId();
        if (planId) {
          const result = await SchedulingService.applyScheduleChange(
            { type: "create_workspace", userId: uid, planId },
            state
          );
          schedule = result?.success ? result.scheduleDoc : null;
        }
      } else {
        schedule = exists;
      }
      
      agendaBuilt = schedule !== null;
      agendaAction = "created";
      callsMade = exists ? 0 : (agendaBuilt ? 1 : 0);
    }

    // ── Branch 4: Schedule already in state — nothing to do
    else if (state.todaySchedule !== null) {
      console.log(`[ExecutionNode] Schedule already loaded — no action needed.`);
    }

    // ── Resolve final schedule value
    const todaySchedule = schedule ?? state.todaySchedule;

    // ── Build internal events
    const newEvents: InternalEvent[] = [];

    if (agendaBuilt && schedule !== null) {
      const eventName =
        agendaAction === "regenerated" ? ZenkaiEvent.AgendaUpdated : ZenkaiEvent.AgendaCreated;

      newEvents.push({
        name: eventName,
        payload: {
          uid: state.uid,
          workflowId: state.workflowId,
          date: todayStr,
          action: agendaAction,
        },
        emittedAt: new Date().toISOString(),
      });

      emitStatusToStream(
        state,
        "execution",
        "completed",
        agendaAction === "regenerated"
          ? "Schedule rebalanced for today."
          : "Today's schedule is ready."
      );
    } else {
      emitStatusToStream(
        state,
        "execution",
        "skipped",
        "No schedule changes required."
      );
    }

    return {
      patch: {
        agendaBuilt,
        todaySchedule,
        emittedEvents: [...state.emittedEvents, ...newEvents],
        aiCallsCount: state.aiCallsCount + callsMade,
      },
      metadata: {
        success: true,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: agendaBuilt
          ? `Schedule ${agendaAction} for ${todayStr} | Calls: ${callsMade}`
          : `No schedule action taken | intent=${intentType} | Calls: ${callsMade}`,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    emitStatusToStream(
      state,
      "execution",
      "skipped",
      "Schedule could not be built — your session continues normally."
    );

    console.error(`[ExecutionNode] Error: ${errorMessage}`);

    return {
      patch: {
        aiCallsCount: state.aiCallsCount,
      },
      metadata: {
        success: false,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `ExecutionNode threw: ${errorMessage}`,
      },
    };
  }
}
