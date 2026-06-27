/**
 * Background Node
 *
 * The final node in every workflow — runs after the companion response is
 * fully streamed so it never delays the user.
 *
 * Responsibilities:
 * - Evaluate and store new memory from the conversation exchange
 * - Evolve identity traits based on recent memories
 * - Evolve behavioral reflections from patterns across conversations
 * - Stream real-time status events for each completed background agent
 * - Emit typed InternalEvents for the EventBus and any plugin subscribers
 *
 * Error strategy:
 * - Promise.allSettled — one failure never blocks the others
 * - Top-level try/catch — never throws out of the node
 * - Always returns valid NodeResult, success flag reflects overall outcome
 */

import type { NodeResult } from "../graph/types";
import type { GraphState } from "../graph/state";
import { MemoryAgent } from "@/agents/memory-agent";
import { IdentityAgent } from "@/agents/identity-agent";
import { ReflectionAgent } from "@/agents/reflection-agent";
import { ZenkaiEvent } from "../events/event-types";
import type { InternalEvent } from "../events/event-types";
import type { IMemory } from "@/models/Memory";

// ─────────────────────────────────────────────────────────────────────────────
// Streaming protocol helper — null-byte delimited control events
// ─────────────────────────────────────────────────────────────────────────────

function makeStatusEvent(
  agent: string,
  status: "idle" | "running" | "completed" | "skipped",
  message: string
): string {
  return `\0${JSON.stringify({ __type: "status", agent, status, message })}\0`;
}

function enqueueEvent(
  streamController: ReadableStreamDefaultController | null,
  encoder: TextEncoder | null,
  event: string
): void {
  if (streamController && encoder) {
    try {
      streamController.enqueue(encoder.encode(event));
    } catch {
      // Stream may already be closed after assembler — swallow silently
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Background Node Function
// ─────────────────────────────────────────────────────────────────────────────

export async function backgroundNode(
  state: Readonly<GraphState>
): Promise<NodeResult<GraphState>> {
  const startedAt = Date.now();

  try {
    const {
      uid,
      userMessage,
      companionResponseDraft,
      conversationId,
      routingDecision,
      streamController,
      encoder,
      emittedEvents,
      workflowId,
    } = state;

    const background = routingDecision?.background ?? [];

    // ── 1. Guard: nothing to do ───────────────────────────────────────────────
    if (background.length === 0) {
      console.log("[BackgroundNode] No background agents scheduled. Skipping.");
      return {
        patch: {},
        metadata: {
          success: true,
          duration: Date.now() - startedAt,
          skipped: true,
          reason: "No background agents in routing decision.",
        },
      };
    }

    // ── 2. Build task list from routing decision ───────────────────────────────
    type AgentTask =
      | { agent: "memory"; promise: Promise<IMemory | null> }
      | { agent: "identity"; promise: Promise<boolean> }
      | { agent: "reflection"; promise: Promise<boolean> };

    const agentTasks: AgentTask[] = [];

    if (background.includes("memory")) {
      console.log("[BackgroundNode] Queueing memory evaluation.");
      agentTasks.push({
        agent: "memory",
        promise: MemoryAgent.evaluateAndStore(
          uid,
          userMessage,
          companionResponseDraft,
          conversationId
        ),
      });
    }

    if (background.includes("identity")) {
      console.log("[BackgroundNode] Queueing identity evolution.");
      agentTasks.push({
        agent: "identity",
        promise: IdentityAgent.evaluateAndEvolve(uid),
      });
    }

    if (background.includes("reflection")) {
      console.log("[BackgroundNode] Queueing reflection evolution.");
      agentTasks.push({
        agent: "reflection",
        promise: ReflectionAgent.evaluateAndEvolve(uid),
      });
    }

    // ── 3. Run all in parallel — allSettled so one failure can't block others ──
    const settled = await Promise.allSettled(agentTasks.map((t) => t.promise));

    // ── 4. Collect outputs and emit events ────────────────────────────────────
    let newMemory: IMemory | null = null;
    let evolvedTraits = false;
    let evolvedReflections = false;
    const newEvents: InternalEvent[] = [];

    for (let i = 0; i < agentTasks.length; i++) {
      const task = agentTasks[i];
      const result = settled[i];

      if (result.status === "rejected") {
        console.error(
          `[BackgroundNode] Agent "${task.agent}" failed:`,
          result.reason
        );
        enqueueEvent(
          streamController,
          encoder,
          makeStatusEvent(task.agent, "skipped", `${task.agent} evaluation failed.`)
        );
        continue;
      }

      const value = result.value;

      if (task.agent === "memory") {
        const memResult = value as IMemory | null;
        newMemory = memResult;

        if (memResult) {
          enqueueEvent(
            streamController,
            encoder,
            makeStatusEvent("memory", "completed", "Stored a new memory from this conversation.")
          );

          newEvents.push({
            name: ZenkaiEvent.MemoryAdmitted,
            payload: {
              uid,
              workflowId,
              memoryId: memResult._id.toString(),
              category: (memResult as IMemory & { category?: string }).category ?? "general",
              content: (memResult as IMemory & { content?: string }).content ?? "",
            } as import("../events/event-types").MemoryAdmittedPayload,
            emittedAt: new Date().toISOString(),
          });
        } else {
          enqueueEvent(
            streamController,
            encoder,
            makeStatusEvent("memory", "skipped", "No new memory required for this conversation.")
          );
        }
      }

      if (task.agent === "identity") {
        const identityResult = value as boolean;
        evolvedTraits = identityResult;

        enqueueEvent(
          streamController,
          encoder,
          makeStatusEvent(
            "identity",
            identityResult ? "completed" : "skipped",
            identityResult
              ? "Profile updated with new traits."
              : "Profile checked. No new traits detected."
          )
        );

        if (identityResult) {
          newEvents.push({
            name: ZenkaiEvent.IdentityTraitEvolved,
            payload: {
              uid,
              workflowId,
            },
            emittedAt: new Date().toISOString(),
          });
        }
      }

      if (task.agent === "reflection") {
        const reflectionResult = value as boolean;
        evolvedReflections = reflectionResult;

        enqueueEvent(
          streamController,
          encoder,
          makeStatusEvent(
            "reflection",
            reflectionResult ? "completed" : "skipped",
            reflectionResult
              ? "Recorded growth patterns."
              : "No new growth patterns recorded."
          )
        );

        if (reflectionResult) {
          newEvents.push({
            name: ZenkaiEvent.ReflectionUpdated,
            payload: {
              uid,
              workflowId,
              action: "updated",
            },
            emittedAt: new Date().toISOString(),
          });
        }
      }
    }

    console.log(
      `[BackgroundNode] Complete — memory: ${!!newMemory}, identity: ${evolvedTraits}, reflection: ${evolvedReflections} | duration: ${Date.now() - startedAt}ms`
    );

    return {
      patch: {
        newMemory,
        evolvedTraits,
        evolvedReflections,
        emittedEvents: [...emittedEvents, ...newEvents],
      },
      metadata: {
        success: true,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `Background complete — memory: ${!!newMemory}, identity: ${evolvedTraits}, reflection: ${evolvedReflections}`,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[BackgroundNode] Fatal error:", err);

    return {
      patch: {
        newMemory: null,
        evolvedTraits: false,
        evolvedReflections: false,
      },
      metadata: {
        success: false,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `BackgroundNode error: ${errorMessage}`,
      },
    };
  }
}
