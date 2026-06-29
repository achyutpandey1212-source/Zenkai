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
import { ContextOrchestrator } from "@/services/context-orchestrator.service";
import type { RetrievalContextPacket } from "@/memory/retrieval-pipeline";

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
// Context Node Function
// ─────────────────────────────────────────────────────────────────────────────

export async function contextNode(
  state: Readonly<GraphState>
): Promise<NodeResult<GraphState>> {
  const startedAt = Date.now();

  try {
    const { uid, userMessage, streamController, encoder, workflowId } = state;

    // ── 1. Signal memory retrieval start ─────────────────────────────────────
    enqueueEvent(
      streamController,
      encoder,
      makeStatusEvent("memory", "running", "Remembering important details...")
    );

    // ── 2. Load all context using the centralized ContextOrchestrator ─────────
    const normalizedContext = await ContextOrchestrator.loadContext(
      uid,
      workflowId,
      "Initial graph load",
      userMessage
    );

    // Extract values for backwards compatibility
    const memoryContext: RetrievalContextPacket = {
      intent: "chat",
      memories: normalizedContext.memories as any[],
      extractedKeywords: [],
    };

    const activeTraits = normalizedContext.identity.activeTraits as any[];
    const activeReflections = normalizedContext.reflections as any[];
    const profile = normalizedContext.profile;
    const activePlans = normalizedContext.activePlan ? [normalizedContext.activePlan] : [];

    // ── 3. Format prompt fragments via Orchestrator ──────────────────────────
    const memoryPromptText = ContextOrchestrator.formatMemoryPrompt(workflowId);
    const identityPromptText = ContextOrchestrator.formatIdentityPrompt(workflowId);
    const reflectionPromptText = ContextOrchestrator.formatReflectionPrompt(workflowId);
    const profilePromptText = ContextOrchestrator.formatProfilePrompt(workflowId);

    // ── 4. Signal memory retrieval complete ───────────────────────────────────
    enqueueEvent(
      streamController,
      encoder,
      makeStatusEvent("memory", "completed", "Remembered key details from conversation history.")
    );

    // ── 5. Stream diagnostics event to developer ──────────────────────────────
    const diagnosticsEvent = `\0${JSON.stringify({
      __type: "diagnostics",
      diagnostics: normalizedContext.metadata.diagnostics,
    })}\0`;
    enqueueEvent(streamController, encoder, diagnosticsEvent);

    console.log(
      `[ContextNode] Context loaded (v${normalizedContext.metadata.version}) — memories: ${normalizedContext.memories.length}, traits: ${activeTraits.length}, reflections: ${activeReflections.length}, plans: ${activePlans.length}, profile: ${!!profile}`
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
        contextVersion: normalizedContext.metadata.version,
      },
      metadata: {
        success: true,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `Context loaded — v${normalizedContext.metadata.version} | ${normalizedContext.memories.length} memories, ${activeTraits.length} traits, ${activeReflections.length} reflections`,
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
        contextVersion: 0,
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
