/**
 * Execution Node
 *
 * Foreground node responsible for building or rebalancing the user's daily agenda.
 * Only runs when the routing decision includes "execution" in the foreground list.
 *
 * Responsibilities:
 * - Force-regenerate agenda if planning just ran (fresh plan = fresh agenda)
 * - Rebalance agenda when intent is task_update
 * - Lazy-load agenda for execution_inquiry intent (only if not already present)
 * - Emit AgendaUpdated / AgendaCreated internal events
 * - Push real-time status events to the streaming controller
 */

import type { NodeResult } from "../graph/types";
import type { GraphState } from "../graph/state";
import { ExecutionAgent } from "@/agents/execution-agent";
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
    "Building your daily agenda\u2026"
  );

  console.log(
    `[ExecutionNode] wf:${state.workflowId.slice(0, 8)} | uid=${state.uid} | intent=${state.intent?.type ?? "unknown"}`
  );

  try {
    const { uid, todayStr } = state;
    const intentType = state.intent?.type ?? "none";

    let agenda: unknown | null = null;
    let agendaBuilt = false;
    let agendaAction: "created" | "regenerated" = "created";

    // ── Branch 1: Planning just succeeded — force-regenerate so agenda reflects new plan
    if (state.planResult?.success === true) {
      console.log(`[ExecutionNode] Plan was created/updated — force-regenerating agenda.`);
      emitStatusToStream(
        state,
        "execution",
        "running",
        "New plan detected \u2014 rebuilding your agenda from scratch\u2026"
      );
      agenda = await ExecutionAgent.getOrCreateDailyAgenda(uid, todayStr, true);
      agendaBuilt = agenda !== null;
      agendaAction = "regenerated";
    }

    // ── Branch 2: Task update intent — rebalance existing agenda
    else if (intentType === "task_update") {
      console.log(`[ExecutionNode] Task update detected — rebalancing agenda.`);
      emitStatusToStream(
        state,
        "execution",
        "running",
        "Task updated \u2014 rebalancing today\u2019s agenda\u2026"
      );
      agenda = await ExecutionAgent.rebalanceAgenda(uid, todayStr);
      agendaBuilt = agenda !== null;
      agendaAction = "regenerated";
    }

    // ── Branch 3: Execution inquiry + no agenda yet — lazy-load agenda
    else if (intentType === "execution_inquiry" && state.todayAgenda === null) {
      console.log(`[ExecutionNode] Execution inquiry — loading agenda for today.`);
      agenda = await ExecutionAgent.getOrCreateDailyAgenda(uid, todayStr);
      agendaBuilt = agenda !== null;
      agendaAction = "created";
    }

    // ── Branch 4: Agenda already in state — nothing to do
    else if (state.todayAgenda !== null) {
      console.log(`[ExecutionNode] Agenda already loaded — no action needed.`);
    }

    // ── Resolve final agenda value (prefer freshly-built, fall back to existing)
    const todayAgenda = agenda ?? state.todayAgenda;

    // ── Build internal events
    const newEvents: InternalEvent[] = [];

    if (agendaBuilt && agenda !== null) {
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
          ? "Agenda rebalanced for today."
          : "Today\u2019s agenda is ready."
      );
    } else {
      emitStatusToStream(
        state,
        "execution",
        "skipped",
        "No agenda changes required."
      );
    }

    return {
      patch: {
        agendaBuilt,
        todayAgenda,
        emittedEvents: [...state.emittedEvents, ...newEvents],
      },
      metadata: {
        success: true,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: agendaBuilt
          ? `Agenda ${agendaAction} for ${todayStr}`
          : `No agenda action taken | intent=${intentType}`,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    emitStatusToStream(
      state,
      "execution",
      "skipped",
      "Agenda could not be built \u2014 your session continues normally."
    );

    console.error(`[ExecutionNode] Error: ${errorMessage}`);

    return {
      patch: {},
      metadata: {
        success: false,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `ExecutionAgent threw: ${errorMessage}`,
      },
    };
  }
}
