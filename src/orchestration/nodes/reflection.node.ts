/**
 * Reflection Node
 *
 * Background node responsible for evolving the user's long-term reflections.
 * Runs after the companion response is delivered — purely async, never blocks UX.
 *
 * Responsibilities:
 * - Guard against non-reflection background routing (skips gracefully)
 * - Call ReflectionAgent.evaluateAndEvolve() to distil patterns from memory
 * - Emit ReflectionUpdated or ReflectionCreated internal events
 * - Push real-time status events to the streaming controller
 */

import type { NodeResult } from "../graph/types";
import type { GraphState } from "../graph/state";
import { ReflectionAgent } from "@/agents/reflection-agent";
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
// Reflection Node Function
// ─────────────────────────────────────────────────────────────────────────────

export async function reflectionNode(
  state: Readonly<GraphState>
): Promise<NodeResult<GraphState>> {
  const startedAt = Date.now();

  // ── Guard: only run if routing decision explicitly includes "reflection" in background
  const background = state.routingDecision?.background ?? [];
  if (!background.includes("reflection")) {
    return skipped("Not in background routing decision.", startedAt);
  }

  // ── Emit running status to stream
  emitStatusToStream(
    state,
    "reflection",
    "running",
    "Distilling your patterns\u2026"
  );

  console.log(
    `[ReflectionNode] wf:${state.workflowId.slice(0, 8)} | uid=${state.uid} | evaluating reflection evolution`
  );

  try {
    // ── Core reflection evolution call
    // Returns true if reflections were created or updated, false if no changes
    const result = await ReflectionAgent.evaluateAndEvolve(state.uid);

    // ── Build internal events
    const newEvents: InternalEvent[] = [];

    if (result) {
      // Reflections were updated — existing patterns evolved
      newEvents.push({
        name: ZenkaiEvent.ReflectionUpdated,
        payload: {
          uid: state.uid,
          workflowId: state.workflowId,
          // Reflection details are owned by the ReflectionAgent.
          // Downstream subscribers can fetch via ReflectionRepository.
          evolvedAt: new Date().toISOString(),
          action: "updated",
        },
        emittedAt: new Date().toISOString(),
      });

      // ReflectionCreated signals that at least one new reflection was born
      // (the agent handles both create + update in a single pass)
      newEvents.push({
        name: ZenkaiEvent.ReflectionCreated,
        payload: {
          uid: state.uid,
          workflowId: state.workflowId,
          createdAt: new Date().toISOString(),
          action: "created",
        },
        emittedAt: new Date().toISOString(),
      });

      emitStatusToStream(
        state,
        "reflection",
        "completed",
        "Reflection patterns updated."
      );

      console.log(`[ReflectionNode] Reflection evolution completed — patterns updated.`);
    } else {
      // No evolution occurred — not enough new evidence to update or create
      emitStatusToStream(
        state,
        "reflection",
        "skipped",
        "No reflection changes at this time."
      );

      console.log(`[ReflectionNode] Reflection evaluation ran — no pattern changes warranted.`);
    }

    return {
      patch: {
        evolvedReflections: result,
        emittedEvents: [...state.emittedEvents, ...newEvents],
      },
      metadata: {
        success: true,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: result
          ? "Reflections evolved — ReflectionUpdated + ReflectionCreated emitted"
          : "Reflection evaluation ran — no changes (insufficient evidence)",
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    emitStatusToStream(
      state,
      "reflection",
      "skipped",
      "Reflection evolution encountered an error \u2014 continuing normally."
    );

    console.error(`[ReflectionNode] Error: ${errorMessage}`);

    return {
      patch: {
        evolvedReflections: false,
      },
      metadata: {
        success: false,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `ReflectionAgent threw: ${errorMessage}`,
      },
    };
  }
}
