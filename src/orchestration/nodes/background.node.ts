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

    let newMemory: IMemory | null = null;
    let evolvedTraits = false;
    let evolvedReflections = false;
    const newEvents: InternalEvent[] = [];
    let backgroundCallsCount = 0;

    // Background nodes are terminal and do not loop, so we allocate a dedicated background budget of 4 calls.
    const remainingBudget = 4;
    console.log(`[BackgroundNode] Dedicated background AI budget: ${remainingBudget} (foreground count: ${state.aiCallsCount})`);

    // ── 2. Sequential Memory Evaluation (Gatekeeper) ─────────────────────────
    if (background.includes("memory")) {
      if (remainingBudget > 0) {
        console.log("[BackgroundNode] Executing memory agent evaluation.");
        try {
          newMemory = await MemoryAgent.evaluateAndStore(
            uid,
            userMessage,
            companionResponseDraft,
            conversationId
          );

          // Admission check consumes 1 call. Consolidation consumes an extra 1 call if admitted.
          const memoryCallsMade = newMemory ? 2 : 1;
          backgroundCallsCount += memoryCallsMade;

          if (newMemory) {
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
                memoryId: newMemory._id.toString(),
                category: (newMemory as any).category ?? "general",
                content: (newMemory as any).content ?? "",
              },
              emittedAt: new Date().toISOString(),
            });
          } else {
            enqueueEvent(
              streamController,
              encoder,
              makeStatusEvent("memory", "skipped", "No new memory required for this conversation.")
            );
          }
        } catch (memErr) {
          console.error("[BackgroundNode] Memory agent failed:", memErr);
          enqueueEvent(
            streamController,
            encoder,
            makeStatusEvent("memory", "skipped", "Memory agent evaluation failed.")
          );
        }
      } else {
        console.log("[BackgroundNode] AI budget exhausted. Deferring memory evaluation.");
        newEvents.push({
          name: "BackgroundWorkDeferred",
          payload: {
            uid,
            workflowId,
            agent: "memory",
            reason: "AI budget exhausted",
          },
          emittedAt: new Date().toISOString(),
        });
        enqueueEvent(
          streamController,
          encoder,
          makeStatusEvent("memory", "skipped", "Memory check deferred (AI budget limit).")
        );
      }
    }

    // ── 3. Gated Parallel Execution of Identity and Reflection Evolution ──────
    const shouldEvolveIdentity = background.includes("identity");
    const shouldEvolveReflection = background.includes("reflection");

    if (shouldEvolveIdentity || shouldEvolveReflection) {
      const isMemoryAdmitted = newMemory !== null;
      const isHighConfidence = newMemory && (newMemory.confidence >= 0.70);

      // Catch-up rule: If the user has approved memories but has no active identity traits or reflections,
      // force evolution to populate the profile.
      const hasNoTraits = !state.activeTraits || state.activeTraits.length === 0;
      const hasNoReflections = !state.activeReflections || state.activeReflections.length === 0;
      const approvedMemories = state.memoryContext?.memories ?? [];
      const hasMemoriesToProcess = approvedMemories.length > 0;
      const shouldForceCatchUp = hasMemoriesToProcess && (hasNoTraits || hasNoReflections);

      if ((!isMemoryAdmitted || !isHighConfidence) && !shouldForceCatchUp) {
        console.log(`[BackgroundNode] Skipping evolution. Admitted: ${isMemoryAdmitted}, High confidence: ${isHighConfidence}, Catch-up: ${shouldForceCatchUp}`);
        if (shouldEvolveIdentity) {
          enqueueEvent(
            streamController,
            encoder,
            makeStatusEvent("identity", "skipped", "Gated: No new high-confidence memories.")
          );
        }
        if (shouldEvolveReflection) {
          enqueueEvent(
            streamController,
            encoder,
            makeStatusEvent("reflection", "skipped", "Gated: No new high-confidence memories.")
          );
        }
      } else {
        // Gated memory check passed! Now check budget.
        const currentRemainingBudget = 4 - backgroundCallsCount;
        
        if (currentRemainingBudget > 0) {
          const evolutionTasks: { agent: "identity" | "reflection"; promise: Promise<boolean> }[] = [];
          
          if (shouldEvolveIdentity) {
            evolutionTasks.push({
              agent: "identity",
              promise: IdentityAgent.evaluateAndEvolve(uid, state),
            });
          }
          if (shouldEvolveReflection) {
            evolutionTasks.push({
              agent: "reflection",
              promise: ReflectionAgent.evaluateAndEvolve(uid, state),
            });
          }

          console.log(`[BackgroundNode] Budget allows (${currentRemainingBudget} left). Running evolution in parallel: ${evolutionTasks.map(t => t.agent).join(", ")}`);
          
          const settledEv = await Promise.allSettled(evolutionTasks.map(t => t.promise));
          backgroundCallsCount += evolutionTasks.length; // Each task consumes 1 Gemini call

          for (let i = 0; i < evolutionTasks.length; i++) {
            const task = evolutionTasks[i];
            const result = settledEv[i];

            if (result.status === "rejected") {
              console.error(`[BackgroundNode] Agent "${task.agent}" failed:`, result.reason);
              enqueueEvent(
                streamController,
                encoder,
                makeStatusEvent(task.agent, "skipped", `${task.agent} evolution failed.`)
              );
              continue;
            }

            const evolved = result.value;
            if (task.agent === "identity") {
              evolvedTraits = evolved;
              enqueueEvent(
                streamController,
                encoder,
                makeStatusEvent(
                  "identity",
                  evolved ? "completed" : "skipped",
                  evolved ? "Profile updated with new traits." : "Profile checked. No new traits detected."
                )
              );

              if (evolved) {
                newEvents.push({
                  name: ZenkaiEvent.IdentityTraitEvolved,
                  payload: { uid, workflowId },
                  emittedAt: new Date().toISOString(),
                });
              }
            }

            if (task.agent === "reflection") {
              evolvedReflections = evolved;
              enqueueEvent(
                streamController,
                encoder,
                makeStatusEvent(
                  "reflection",
                  evolved ? "completed" : "skipped",
                  evolved ? "Recorded growth patterns." : "No new growth patterns recorded."
                )
              );

              if (evolved) {
                newEvents.push({
                  name: ZenkaiEvent.ReflectionUpdated,
                  payload: { uid, workflowId, action: "updated" },
                  emittedAt: new Date().toISOString(),
                });
              }
            }
          }
        } else {
          // Defer background evolution tasks since budget is exhausted
          console.log("[BackgroundNode] AI budget exhausted for identity/reflection. Deferring background tasks.");
          if (shouldEvolveIdentity) {
            newEvents.push({
              name: "BackgroundWorkDeferred",
              payload: {
                uid,
                workflowId,
                agent: "identity",
                reason: "AI budget exhausted",
              },
              emittedAt: new Date().toISOString(),
            });
            enqueueEvent(
              streamController,
              encoder,
              makeStatusEvent("identity", "skipped", "Identity evolution deferred (AI budget limit).")
            );
          }
          if (shouldEvolveReflection) {
            newEvents.push({
              name: "BackgroundWorkDeferred",
              payload: {
                uid,
                workflowId,
                agent: "reflection",
                reason: "AI budget exhausted",
              },
              emittedAt: new Date().toISOString(),
            });
            enqueueEvent(
              streamController,
              encoder,
              makeStatusEvent("reflection", "skipped", "Reflection evolution deferred (AI budget limit).")
            );
          }
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
        aiCallsCount: state.aiCallsCount + backgroundCallsCount,
      },
      metadata: {
        success: true,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `Background complete — memory: ${!!newMemory}, identity: ${evolvedTraits}, reflection: ${evolvedReflections} | Calls: ${backgroundCallsCount}`,
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
        aiCallsCount: state.aiCallsCount,
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
