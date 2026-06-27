/**
 * Memory Node
 *
 * Background node responsible for evaluating the latest conversation exchange
 * and storing admitted memories. Runs after the companion response is drafted.
 *
 * Responsibilities:
 * - Guard against non-memory background routing (skips gracefully)
 * - Call MemoryAgent.evaluateAndStore() on the latest exchange
 * - Emit MemoryAdmitted internal events when a memory is persisted
 * - Push real-time status events to the streaming controller
 */

import type { NodeResult } from "../graph/types";
import type { GraphState } from "../graph/state";
import { MemoryAgent } from "@/agents/memory-agent";
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
// Memory Node Function
// ─────────────────────────────────────────────────────────────────────────────

export async function memoryNode(
  state: Readonly<GraphState>
): Promise<NodeResult<GraphState>> {
  const startedAt = Date.now();

  // ── Guard: only run if routing decision explicitly includes "memory" in background
  const background = state.routingDecision?.background ?? [];
  if (!background.includes("memory")) {
    return skipped("Not in background routing decision.", startedAt);
  }

  // ── Guard: companion response must be available to evaluate
  if (!state.companionResponseDraft) {
    emitStatusToStream(
      state,
      "memory",
      "skipped",
      "No companion response to evaluate for memory."
    );
    return skipped("companionResponseDraft is empty — nothing to store.", startedAt);
  }

  console.log(
    `[MemoryNode] wf:${state.workflowId.slice(0, 8)} | uid=${state.uid} | evaluating exchange for admission`
  );

  try {
    // ── Call MemoryAgent to evaluate and optionally store the exchange
    const newMemory = await MemoryAgent.evaluateAndStore(
      state.uid,
      state.userMessage,
      state.companionResponseDraft,
      state.conversationId
    );

    // ── Build internal events
    const newEvents: InternalEvent[] = [];

    if (newMemory !== null) {
      const memoryId = (newMemory as { _id?: unknown })._id?.toString() ?? "unknown";
      const category = (newMemory as { category?: string }).category ?? "general";
      const content = (newMemory as { content?: string }).content ?? "";

      newEvents.push({
        name: ZenkaiEvent.MemoryAdmitted,
        payload: {
          uid: state.uid,
          workflowId: state.workflowId,
          memoryId,
          category,
          content,
        },
        emittedAt: new Date().toISOString(),
      });

      emitStatusToStream(
        state,
        "memory",
        "completed",
        `Memory admitted \u2014 category: ${category}.`
      );

      console.log(`[MemoryNode] Memory admitted | id=${memoryId} | category=${category}`);
    } else {
      emitStatusToStream(
        state,
        "memory",
        "skipped",
        "Exchange evaluated \u2014 no memory warranted."
      );

      console.log(`[MemoryNode] Admission policy rejected exchange — no memory stored.`);
    }

    return {
      patch: {
        newMemory,
        emittedEvents: [...state.emittedEvents, ...newEvents],
      },
      metadata: {
        success: true,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: newMemory !== null
          ? `Memory admitted | category=${(newMemory as { category?: string }).category ?? "unknown"}`
          : "Admission policy rejected — no memory stored",
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    emitStatusToStream(
      state,
      "memory",
      "skipped",
      "Memory evaluation encountered an error \u2014 continuing normally."
    );

    console.error(`[MemoryNode] Error: ${errorMessage}`);

    return {
      patch: {
        newMemory: null,
      },
      metadata: {
        success: false,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `MemoryAgent threw: ${errorMessage}`,
      },
    };
  }
}
