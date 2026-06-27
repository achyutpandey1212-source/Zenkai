/**
 * Context Node
 *
 * The second node in every workflow (runs after router).
 * Loads all shared context in a single parallel blast so no other node
 * ever has to hit the database for base context.
 *
 * Responsibilities:
 * - Retrieve memories, identity traits, reflections, profile and plans in parallel
 * - Format each block into a ready-to-inject prompt fragment
 * - Emit memory status events to the live stream
 * - Return a state patch containing every context field
 *
 * Error strategy: one inner failure never kills the workflow.
 * Each parallel call has its own catch; the top-level catch is a last resort.
 */

import type { NodeResult } from "../graph/types";
import type { GraphState } from "../graph/state";
import { MemoryAgent } from "@/agents/memory-agent";
import { IdentityAgent } from "@/agents/identity-agent";
import { ReflectionAgent } from "@/agents/reflection-agent";
import { IdentityRepository } from "@/repositories/identity.repository";
import { ReflectionRepository } from "@/repositories/reflection.repository";
import { ProfileRepository } from "@/repositories/profile.repository";
import { PlanRepository } from "@/repositories/plan.repository";
import type { RetrievalContextPacket } from "@/memory/retrieval-pipeline";
import type { IIdentityTrait } from "@/models/IdentityTrait";
import type { IReflection } from "@/models/Reflection";

// ─────────────────────────────────────────────────────────────────────────────
// Streaming helper
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
      // Stream may already be closed — swallow silently
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile formatter — mirrors the format used in the existing route.ts
// ─────────────────────────────────────────────────────────────────────────────

function formatProfileForPrompt(
  profile: GraphState["profile"]
): string {
  if (!profile) return "";

  return [
    "## User Foundational Profile (from Onboarding)",
    profile.profession ? `- **Profession**: ${profile.profession}` : null,
    profile.longTermGoal ? `- **Long-term Goal**: ${profile.longTermGoal}` : null,
    profile.currentFocus ? `- **Current Focus**: ${profile.currentFocus}` : null,
    profile.motivation ? `- **Motivation**: ${profile.motivation}` : null,
    profile.dailyAvailability ? `- **Daily Availability**: ${profile.dailyAvailability}` : null,
    profile.workStyle ? `- **Working Style**: ${profile.workStyle}` : null,
    profile.biggestChallenge ? `- **Biggest Challenge**: ${profile.biggestChallenge}` : null,
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Node Function
// ─────────────────────────────────────────────────────────────────────────────

export async function contextNode(
  state: Readonly<GraphState>
): Promise<NodeResult<GraphState>> {
  const startedAt = Date.now();

  try {
    const { uid, userMessage, streamController, encoder } = state;

    // ── 1. Signal memory retrieval start ─────────────────────────────────────
    enqueueEvent(
      streamController,
      encoder,
      makeStatusEvent("memory", "running", "Remembering important details...")
    );

    // ── 2. Load all context in a single parallel blast ────────────────────────
    // Each call is individually wrapped so one failure doesn't poison the rest.
    const [
      memoryContextResult,
      activeTraitsResult,
      activeReflectionsResult,
      profileResult,
      activePlansResult,
    ] = await Promise.allSettled([
      MemoryAgent.retrieveForContext(uid, userMessage),
      IdentityRepository.findActiveByUser(uid),
      ReflectionRepository.findActiveByUser(uid),
      ProfileRepository.findByFirebaseUid(uid),
      PlanRepository.findFullTree(uid),
    ]);

    // ── 3. Unwrap results (fall back to safe defaults on failure) ─────────────
    const memoryContext: RetrievalContextPacket =
      memoryContextResult.status === "fulfilled"
        ? memoryContextResult.value
        : { intent: "chat", memories: [], extractedKeywords: [] };

    const activeTraits: IIdentityTrait[] =
      activeTraitsResult.status === "fulfilled" ? activeTraitsResult.value : [];

    const activeReflections: IReflection[] =
      activeReflectionsResult.status === "fulfilled" ? activeReflectionsResult.value : [];

    const profile: GraphState["profile"] =
      profileResult.status === "fulfilled" ? (profileResult.value as GraphState["profile"]) : null;

    const activePlans: unknown[] =
      activePlansResult.status === "fulfilled" ? activePlansResult.value : [];

    // Log any failures for observability
    if (memoryContextResult.status === "rejected") {
      console.error("[ContextNode] Memory retrieval failed:", memoryContextResult.reason);
    }
    if (activeTraitsResult.status === "rejected") {
      console.error("[ContextNode] Identity retrieval failed:", activeTraitsResult.reason);
    }
    if (activeReflectionsResult.status === "rejected") {
      console.error("[ContextNode] Reflection retrieval failed:", activeReflectionsResult.reason);
    }
    if (profileResult.status === "rejected") {
      console.error("[ContextNode] Profile retrieval failed:", profileResult.reason);
    }
    if (activePlansResult.status === "rejected") {
      console.error("[ContextNode] Plan retrieval failed:", activePlansResult.reason);
    }

    // ── 4. Format prompt fragments ────────────────────────────────────────────
    const memoryPromptText = MemoryAgent.formatMemoriesForPrompt(memoryContext.memories);
    const identityPromptText = IdentityAgent.formatIdentityForPrompt(activeTraits);
    const reflectionPromptText = ReflectionAgent.formatReflectionsForPrompt(activeReflections);
    const profilePromptText = formatProfileForPrompt(profile);

    // ── 5. Signal memory retrieval complete ───────────────────────────────────
    enqueueEvent(
      streamController,
      encoder,
      makeStatusEvent("memory", "completed", "Remembered key details from conversation history.")
    );

    console.log(
      `[ContextNode] Context loaded — memories: ${memoryContext.memories.length}, traits: ${activeTraits.length}, reflections: ${activeReflections.length}, plans: ${activePlans.length}, profile: ${!!profile}`
    );

    return {
      patch: {
        memoryContext,
        activeTraits,
        activeReflections,
        profile,
        activePlans,
        memoryPromptText,
        identityPromptText,
        reflectionPromptText,
        profilePromptText,
      },
      metadata: {
        success: true,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `Context loaded — ${memoryContext.memories.length} memories, ${activeTraits.length} traits, ${activeReflections.length} reflections`,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[ContextNode] Fatal error:", err);

    return {
      patch: {
        memoryContext: { intent: "chat", memories: [], extractedKeywords: [] },
        activeTraits: [],
        activeReflections: [],
        profile: null,
        activePlans: [],
        memoryPromptText: "",
        identityPromptText: "",
        reflectionPromptText: "",
        profilePromptText: "",
      },
      metadata: {
        success: false,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `ContextNode error: ${errorMessage}`,
      },
    };
  }
}
