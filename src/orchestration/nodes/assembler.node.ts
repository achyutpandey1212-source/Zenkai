/**
 * Assembler Node
 *
 * Final foreground node. Responsibilities:
 * - Persist assistant message to the database
 * - Build and emit the execution summary card
 * - Close the stream controller
 *
 * This is the node that makes Zenkai feel like ONE intelligent system replied.
 */

import type { NodeResult } from "../graph/types";
import type { GraphState } from "../graph/state";
import { MessageRepository } from "@/repositories/message.repository";
import { Milestone } from "@/models/Milestone";
import { ZenkaiEvent } from "../events/event-types";
import type { InternalEvent } from "../events/event-types";
import { GraphLogger } from "../utils/graph-logger";

function makeStatusEvent(
  agent: string,
  status: "idle" | "running" | "completed" | "skipped",
  message: string
): string {
  return `\0${JSON.stringify({ __type: "status", agent, status, message })}\0`;
}

export async function assemblerNode(
  state: Readonly<GraphState>
): Promise<NodeResult<GraphState>> {
  const startedAt = Date.now();

  try {
    const { streamController, encoder, uid, conversationId, companionResponseDraft } = state;

    // ── 1. Persist assistant message ─────────────────────────────────────────
    let assistantMsgId: string | null = null;

    if (companionResponseDraft.trim() && conversationId) {
      const assistantMsg = await MessageRepository.addMessage(
        conversationId,
        "assistant",
        companionResponseDraft
      );
      assistantMsgId = assistantMsg._id.toString();

      // Link new memory to assistant message if one was just stored
      if (state.newMemory && assistantMsgId) {
        await state.newMemory.updateOne({ assistantMessageId: assistantMsgId }).catch((err) => {
          console.error("[Assembler] Failed to link memory to message:", err);
        });
      }
    }

    // ── 2. Build execution summary card ──────────────────────────────────────
    const agenda = state.todayAgenda as Record<string, unknown> | null;
    const workloadStr = agenda
      ? `${(((agenda.estimatedFocusTime as number) ?? 0) / 60).toFixed(1)} hrs/day`
      : "0.0 hrs/day";
    const priorityStr =
      (agenda?.focus as string) || (agenda?.currentPriority as string) || "General focus";

    // Next upcoming milestone
    const upcomingMilestones = await Milestone.find({
      firebaseUid: uid,
      status: { $in: ["todo", "in_progress"] },
    })
      .sort({ startDate: 1 })
      .limit(1)
      .lean();

    const nextMilestoneStr =
      upcomingMilestones.length > 0
        ? `${upcomingMilestones[0].title} • ${new Date(
            upcomingMilestones[0].startDate || ""
          ).toLocaleDateString([], { month: "short", day: "numeric" })}`
        : "None scheduled";

    const summaryCardData = {
      __type: "execution_summary",
      stats: {
        milestonesCreated: state.planResult?.milestonesCreated ?? 0,
        tasksCreated: state.planResult?.tasksCreated ?? 0,
        agendaBuilt: state.agendaBuilt || state.taskUpdateExecuted,
        identityUpdated: state.evolvedTraits,
        reflectionRecorded: state.evolvedReflections,
        memoryUpdated: !!state.newMemory,
      },
      workload: workloadStr,
      priority: priorityStr,
      nextMilestone: nextMilestoneStr,
      // Attach workflow metadata for observability
      _meta: {
        workflowId: state.workflowId,
        workflowVersion: state.workflowVersion,
        totalDurationMs: Date.now() - state.startedAt,
        nodeCount: state.nodeLog.length,
        errorCount: state.errors.length,
      },
    };

    const summaryMessageContent = `\0${JSON.stringify(summaryCardData)}\0`;

    // ── 3. Persist summary card as assistant message ──────────────────────────
    if (conversationId) {
      await MessageRepository.addMessage(conversationId, "assistant", summaryMessageContent);
    }

    // ── 4. Stream summary card and close stream ────────────────────────────────
    if (streamController && encoder) {
      streamController.enqueue(encoder.encode(summaryMessageContent));
      streamController.close();
    }

    // ── 5. Emit WorkflowCompleted event ───────────────────────────────────────
    const completionEvent: InternalEvent = {
      name: ZenkaiEvent.WorkflowCompleted,
      payload: {
        uid,
        workflowId: state.workflowId,
        workflowVersion: state.workflowVersion,
        graphVersion: state.graphVersion,
        durationMs: Date.now() - state.startedAt,
        errorCount: state.errors.length,
      },
      emittedAt: new Date().toISOString(),
    };

    // Log workflow completion
    GraphLogger.workflowComplete(state as unknown as Record<string, unknown>);

    return {
      patch: {
        emittedEvents: [...state.emittedEvents, completionEvent],
      },
      metadata: {
        success: true,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `Summary card assembled. Memory: ${!!state.newMemory}, Identity: ${state.evolvedTraits}, Reflection: ${state.evolvedReflections}`,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[Assembler] Error:", err);

    // Try to close stream even on error
    try {
      if (state.streamController) state.streamController.close();
    } catch {
      // ignore close errors
    }

    return {
      patch: {},
      metadata: {
        success: false,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `Assembler error: ${errorMessage}`,
      },
    };
  }
}
