/**
 * Identity Node
 *
 * Background node responsible for evolving the user's identity trait profile.
 * Runs after the companion response is delivered — purely async, never blocks UX.
 *
 * Responsibilities:
 * - Guard against non-identity background routing (skips gracefully)
 * - Call IdentityAgent.evaluateAndEvolve() to analyse admitted memories
 * - Emit IdentityTraitEvolved or IdentityProposalCreated internal events
 * - Push real-time status events to the streaming controller
 */

import type { NodeResult } from "../graph/types";
import type { GraphState } from "../graph/state";
import { IdentityAgent } from "@/agents/identity-agent";
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
// Identity Node Function
// ─────────────────────────────────────────────────────────────────────────────

export async function identityNode(
  state: Readonly<GraphState>
): Promise<NodeResult<GraphState>> {
  const startedAt = Date.now();

  // ── Guard: only run if routing decision explicitly includes "identity" in background
  const background = state.routingDecision?.background ?? [];
  if (!background.includes("identity")) {
    return skipped("Not in background routing decision.", startedAt);
  }

  // ── Emit running status to stream
  emitStatusToStream(
    state,
    "identity",
    "running",
    "Reflecting on your identity\u2026"
  );

  console.log(
    `[IdentityNode] wf:${state.workflowId.slice(0, 8)} | uid=${state.uid} | evaluating trait evolution`
  );

  try {
    // ── Core identity evolution call
    // Returns true if any traits were evolved or proposals were created
    const result = await IdentityAgent.evaluateAndEvolve(state.uid);

    // ── Build internal events
    const newEvents: InternalEvent[] = [];

    if (result) {
      // IdentityAgent evolved existing traits — emit the primary evolution event
      newEvents.push({
        name: ZenkaiEvent.IdentityTraitEvolved,
        payload: {
          uid: state.uid,
          workflowId: state.workflowId,
          // Trait details are owned by the IdentityAgent; we emit the signal only.
          // Downstream subscribers (e.g. notifications) can fetch traits via repository.
          evolvedAt: new Date().toISOString(),
        },
        emittedAt: new Date().toISOString(),
      });

      // IdentityProposalCreated is emitted when new candidate traits are surfaced.
      // The agent handles both — fire both events so all subscribers are notified.
      newEvents.push({
        name: ZenkaiEvent.IdentityProposalCreated,
        payload: {
          uid: state.uid,
          workflowId: state.workflowId,
          proposedAt: new Date().toISOString(),
        },
        emittedAt: new Date().toISOString(),
      });

      emitStatusToStream(
        state,
        "identity",
        "completed",
        "Identity profile updated."
      );

      console.log(`[IdentityNode] Identity evolution completed — traits updated.`);
    } else {
      // No evolution occurred — not enough evidence yet
      emitStatusToStream(
        state,
        "identity",
        "skipped",
        "No identity changes at this time."
      );

      console.log(`[IdentityNode] Identity evaluation ran — no trait changes warranted.`);
    }

    return {
      patch: {
        evolvedTraits: result,
        emittedEvents: [...state.emittedEvents, ...newEvents],
      },
      metadata: {
        success: true,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: result
          ? "Identity traits evolved — IdentityTraitEvolved + IdentityProposalCreated emitted"
          : "Identity evaluation ran — no changes (insufficient evidence)",
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    emitStatusToStream(
      state,
      "identity",
      "skipped",
      "Identity evolution encountered an error \u2014 continuing normally."
    );

    console.error(`[IdentityNode] Error: ${errorMessage}`);

    return {
      patch: {
        evolvedTraits: false,
      },
      metadata: {
        success: false,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `IdentityAgent threw: ${errorMessage}`,
      },
    };
  }
}
