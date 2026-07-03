/**
 * Execution Node
 *
 * Calls SchedulePatchService for direct schedule edits, or SchedulingService for full regeneration.
 * Only runs when the routing decision includes "execution" in the foreground list.
 *
 * Responsibilities:
 * - Force-regenerate schedule if planning just ran (fresh plan = fresh schedule)
 * - Use SchedulePatchService for schedule_operation direct edits (no LLM, no full regeneration)
 * - Rebalance schedule when intent is task_update
 * - Lazy-load schedule for execution_inquiry intent (only if not already present)
 * - Emit AgendaUpdated / AgendaCreated internal events
 * - Push real-time status events to the streaming controller
 */

import type { NodeResult } from "../graph/types";
import type { GraphState } from "../graph/state";
import { SchedulingService } from "@/services/scheduling.service";
import { SchedulePatchService } from "@/services/schedule-patch.service";
import { WeeklyExecutionSchedule } from "@/models/WeeklyExecutionSchedule";
import { ZenkaiEvent } from "../events/event-types";
import type { InternalEvent } from "../events/event-types";
import { PlanRepository } from "@/repositories/plan.repository";
import { PendingActionService } from "@/services/pending-action.service";

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
    let agendaAction: "created" | "regenerated" | "modified" = "created";
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
        const schedulingResult = result as { success: boolean; scheduleDoc: unknown };
        schedule = schedulingResult.success ? schedulingResult.scheduleDoc : null;
        agendaBuilt = schedulingResult.success ?? false;
        agendaAction = "regenerated";
        callsMade = agendaBuilt ? 1 : 0;
      }
    }

    // ── Branch 2: Schedule modification via SchedulePatchService (direct edits, no regeneration)
    else if (intentType === "schedule_modification") {
      const scheduleOp = state.pendingAction?.payload?.scheduleOperation ?? state.intent?.scheduleOperation;

      if (scheduleOp) {
        console.log(`[ExecutionNode] PATCH PATH - scheduleOperation present`);
        console.log(`[ExecutionNode] Full scheduleOperation: ${JSON.stringify(scheduleOp)}`);
        console.log(`[ExecutionNode] Schedule modification detected — applying patch.`);

        emitStatusToStream(
          state,
          "execution",
          "running",
          "Updating your schedule…"
        );

        // Dispatch to SchedulePatchService based on operation type
        let patchResult = null;
        if (scheduleOp.type === "add_block") {
          const conflictCheck = await SchedulePatchService.checkConflicts(uid, scheduleOp.date, scheduleOp.startTime!, scheduleOp.endTime!);
          if (conflictCheck.hasConflict) {
            console.warn(`[ExecutionNode] Schedule modification rejected due to conflicts.`);
            emitStatusToStream(
              state,
              "execution",
              "skipped",
              "Cannot add block - time slot overlaps with existing work."
            );
            return {
              patch: {},
              metadata: {
                success: true,
                duration: Date.now() - startedAt,
                skipped: false,
                reason: `Schedule edit rejected - conflicts detected`,
              },
            };
          }
          patchResult = await SchedulePatchService.addWorkBlock({
            firebaseUid: uid,
            date: scheduleOp.date,
            title: scheduleOp.title!,
            startTime: scheduleOp.startTime!,
            endTime: scheduleOp.endTime!,
          });
        } else if (scheduleOp.type === "move_block") {
          const conflictCheck = await SchedulePatchService.checkConflicts(uid, scheduleOp.date, scheduleOp.startTime!, scheduleOp.endTime!);
          if (conflictCheck.hasConflict) {
            console.warn(`[ExecutionNode] Schedule modification rejected due to conflicts.`);
            emitStatusToStream(
              state,
              "execution",
              "skipped",
              "Cannot move block - time slot overlaps with existing work."
            );
            return {
              patch: {},
              metadata: {
                success: true,
                duration: Date.now() - startedAt,
                skipped: false,
                reason: `Schedule edit rejected - conflicts detected`,
              },
            };
          }
          patchResult = await SchedulePatchService.moveWorkBlock({
            firebaseUid: uid,
            date: scheduleOp.date,
            title: scheduleOp.blockTitle!,
            newStartTime: scheduleOp.startTime!,
            newEndTime: scheduleOp.endTime!,
          });
        } else if (scheduleOp.type === "resize_block") {
          const conflictCheck = await SchedulePatchService.checkConflicts(uid, scheduleOp.date, scheduleOp.startTime!, scheduleOp.endTime!);
          if (conflictCheck.hasConflict) {
            console.warn(`[ExecutionNode] Schedule modification rejected due to conflicts.`);
            emitStatusToStream(
              state,
              "execution",
              "skipped",
              "Cannot resize block - time slot overlaps with existing work."
            );
            return {
              patch: {},
              metadata: {
                success: true,
                duration: Date.now() - startedAt,
                skipped: false,
                reason: `Schedule edit rejected - conflicts detected`,
              },
            };
          }
          patchResult = await SchedulePatchService.resizeWorkBlock({
            firebaseUid: uid,
            date: scheduleOp.date,
            title: scheduleOp.blockTitle!,
            newStartTime: scheduleOp.startTime!,
            newEndTime: scheduleOp.endTime!,
          });
        } else if (scheduleOp.type === "delete_block") {
          patchResult = await SchedulePatchService.removeWorkBlock({
            firebaseUid: uid,
            date: scheduleOp.date,
            title: scheduleOp.blockTitle,
          });
        }

        if (patchResult) {
          schedule = patchResult;
          agendaBuilt = true;
          agendaAction = "modified";
          callsMade = 0;
        } else {
          console.warn(`[ExecutionNode] Schedule patch failed - operation did not complete.`);
        }

        // Clear pending action after successful execution
        if (state.pendingAction && state.conversationId) {
          await PendingActionService.clear(state.conversationId);
          console.log(`[ExecutionNode] Cleared pending action after execution.`);
        }
      }
    }

    // ── Branch 3: Task update intent — deterministically reload schedule from DB
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

    // ── Branch 4: Execution inquiry + no schedule yet — lazy-load schedule
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
          const schedulingResult = result as { success: boolean; scheduleDoc: unknown };
          schedule = schedulingResult.success ? schedulingResult.scheduleDoc : null;
        }
      } else {
        schedule = exists;
      }
      
      agendaBuilt = schedule !== null;
      agendaAction = "created";
      callsMade = exists ? 0 : (agendaBuilt ? 1 : 0);
    }

    // ── Branch 5: Schedule already in state — nothing to do
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
