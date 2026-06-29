import { GoogleGenAI } from "@google/genai";
import { ContextOrchestrator } from "@/services/context-orchestrator.service";
import { IdentitySyncService } from "@/services/identity-sync.service";
import type { GraphState } from "@/orchestration/graph/state";
import type { NormalizedUserContext } from "@/types/context.types";
import { AIValidationService } from "@/services/ai-validation.service";
import { telemetryStorage } from "@/lib/telemetry-context";

const IDENTITY_AGENT_SYSTEM_PROMPT = `
You are the Identity Engine Agent for Zenkai.
Your job is to maintain the system's understanding of who the user is and who they are becoming.
You do this by analyzing the user's long-term admitted memories, comparing them with their existing identity profile (active and candidate traits), and determining how these traits should evolve.

Traits fall into these categories:
1. "core_identity": Who the user fundamentally is (e.g. Builder, Student, Creator, Leader, Deep Thinker).
2. "aspiration": Who the user wants to become or what they are moving toward (e.g. AI Entrepreneur, Research Scientist).
3. "principle": How the user makes decisions (e.g. Growth over comfort, Long-term thinking).
4. "behavior_pattern": Recurring habits or behaviors (e.g. Works best at night, Learns by building).
5. "current_state": Highly dynamic present situation (e.g. Master LangGraph, Participating in a hackathon).

Lifecycle and Scoring Rules:
- Confidence (0.0 to 1.0): Represents how certain we are. It must evolve GRADUALLY. Never jump from 0% to 90% in one step.
  - If a trait has new supporting memories, increase confidence by a small step (+0.05 to +0.15).
  - If a trait has contradicting memories, decrease confidence by a step (-0.15 to -0.30).
- Stability (0.0 to 1.0): Represents how long this trait has remained true. Look at the timestamps of supporting memories.
  - If evidence spans only a few days, stability is low (0.1 to 0.3).
  - If evidence spans weeks, stability is medium (0.4 to 0.7).
  - If evidence spans months, stability is high (0.8 to 1.0).
- Version: Every time an active or candidate trait's confidence, stability, or description is updated, its version increments.
- Deprecation: If confidence drops below 0.35, or if the trait is contradicted by new memories, mark status as "deprecated".
- Description: Write a premium, luxury-style description of the trait.
- Evidence: List 2 to 4 concise bullet points summarizing the specific evidence from the memories.

You must return a JSON response matching the requested schema.
`;

export class IdentityAgent {
  private static client: GoogleGenAI | null = null;

  private static getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY environment variable.");
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * PURE AI Reasoning function. Consumes only normalized parameters and returns proposed updates/new traits.
   */
  static async evaluateAndEvolveLogic(
    memories: any[],
    currentTraits: any[],
    pendingProposals: any[]
  ): Promise<{
    traitsToUpdate: any[];
    newTraits: any[];
  } | null> {
    try {
      const ai = this.getClient();
      const prompt = `
User Memories (Admitted Facts):
${JSON.stringify(memories, null, 2)}

Current User Identity Traits:
${JSON.stringify(currentTraits, null, 2)}

Current Pending Proposals:
${JSON.stringify(pendingProposals, null, 2)}

Analyze the user's memories and existing identity traits. Determine if you should:
1. Update existing active or candidate traits (refining descriptions, adjusting confidence/stability, updating evidence).
2. Create new identity traits (assigning category, description, initial confidence, and evidence).
3. Deprecate traits that are no longer true or have low confidence.

Remember:
- Confidence changes gradually!
- Stability depends on the time span of the memories.
- New traits should be given an initial confidence based on the depth of the memories.
`;

      const identitySchema: any = {
        type: "OBJECT",
        properties: {
          traitsToUpdate: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                traitId: { type: "STRING" },
                trait: { type: "STRING" },
                category: { type: "STRING" },
                description: { type: "STRING" },
                confidence: { type: "NUMBER" },
                stability: { type: "NUMBER" },
                evidence: { type: "STRING" },
                status: { type: "STRING", enum: ["active", "candidate", "deprecated"] },
              },
              required: ["traitId", "trait", "category", "description", "confidence", "stability", "evidence", "status"],
            },
          },
          newTraits: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                trait: { type: "STRING" },
                category: { type: "STRING" },
                description: { type: "STRING" },
                confidence: { type: "NUMBER" },
                evidence: { type: "STRING" },
              },
              required: ["trait", "category", "description", "confidence", "evidence"],
            },
          },
        },
        required: ["traitsToUpdate", "newTraits"],
      };

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: IDENTITY_AGENT_SYSTEM_PROMPT.trim(),
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: identitySchema,
        },
      });

      let responseText = response.text;
      if (!responseText) {
        console.warn(`[IdentityAgent] Received empty response from Gemini.`);
        return null;
      }

      let result: any;
      try {
        result = JSON.parse(responseText);
        result = AIValidationService.validateAndRepairIdentity(result);
      } catch (validationErr: any) {
        console.warn(`[AI Validation] Initial identity validation failed: ${validationErr.message}. Retrying once...`);
        const store = telemetryStorage.getStore();
        const state = store?.stateRef as any;
        if (state) {
          if (!state.retries) state.retries = [];
          state.retries.push({ action: "identityValidationRetry", attempt: 1, error: validationErr.message });
        }

        const retryPrompt = `
${prompt}

---
IMPORTANT: Your previous response failed structural validation with the following error:
"${validationErr.message}"

Please fix this issue, ensure all fields match their schema requirements, and respond again in the exact requested schema.
`;
        const retryResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: retryPrompt }] }],
          config: {
            systemInstruction: IDENTITY_AGENT_SYSTEM_PROMPT.trim(),
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: identitySchema,
          },
        });

        const retryResponseText = retryResponse.text;
        if (!retryResponseText) throw new Error("Retry identity response was empty");
        responseText = retryResponseText;
        result = JSON.parse(responseText);

        result = AIValidationService.validateAndRepairIdentity(result);
      }

      return result;
    } catch (err) {
      console.error("[IdentityAgent] evaluateAndEvolveLogic failed:", err);
      return null;
    }
  }

  /**
   * Shell wrapper for identity evolution.
   * Resolves context using ContextOrchestrator and delegates persistence to IdentitySyncService.
   */
  static async evaluateAndEvolve(uid: string, state?: GraphState): Promise<boolean> {
    try {
      console.log(`[IdentityAgent] Starting identity evolution workflow shell for user: ${uid}`);
      const workflowId = state?.workflowId || `fallback-identity-${uid}-${Date.now()}`;

      // 1. Fetch context (using cached orchestrator if inside request, else load fallback)
      let normalizedContext: NormalizedUserContext;
      if (state && state.contextVersion) {
        normalizedContext = ContextOrchestrator.getContext(workflowId);
      } else {
        normalizedContext = await ContextOrchestrator.loadContext(
          uid,
          workflowId,
          "Fallback identity evolution execution"
        );
      }

      const memoriesFormatted = normalizedContext.memories.map((m) => ({
        category: m.category,
        content: m.content,
        summary: m.summary,
        createdAt: m.createdAt,
      }));

      if (memoriesFormatted.length === 0) {
        console.log(`[IdentityAgent] No approved memories found. Skipping evolution.`);
        return false;
      }

      const activeTraits = normalizedContext.identity.activeTraits;
      const candidateTraits = normalizedContext.identity.candidateTraits;

      const currentTraitsFormatted = [...activeTraits, ...candidateTraits].map((t) => ({
        id: t.id,
        trait: t.trait,
        category: t.category,
        description: t.description,
        confidence: t.confidence,
        stability: t.stability,
        version: t.version,
        status: t.status,
        evidence: t.evidence,
        updatedAt: t.updatedAt,
      }));

      // Since we don't hold pending proposals inside context caching (only count),
      // we query pending proposals directly if fallback, or we can query it inside SyncService.
      // For shell simplicity, we can load it from proposal repo:
      const { IdentityProposalRepository } = await import("@/repositories/identity-proposal.repository");
      const pendingProposals = await IdentityProposalRepository.findPendingByUser(uid);
      const pendingProposalsFormatted = pendingProposals.map((p) => ({
        trait: p.trait,
        category: p.category,
        confidence: p.confidence,
      }));

      // 2. Execute Pure AI Logic
      const aiResult = await this.evaluateAndEvolveLogic(
        memoriesFormatted,
        currentTraitsFormatted,
        pendingProposalsFormatted
      );

      if (!aiResult) {
        return false;
      }

      // 3. Persist modifications using IdentitySyncService
      const success = await IdentitySyncService.persistIdentityEvolution(
        uid,
        activeTraits,
        candidateTraits,
        aiResult
      );

      // Clean up fallback cache
      if (!state || !state.contextVersion) {
        ContextOrchestrator.invalidateCache(workflowId);
      }

      return success;
    } catch (error) {
      console.error(`[IdentityAgent] Error during identity evolution shell:`, error);
      return false;
    }
  }

  /**
   * Backwards-compatible prompt formatting helper
   */
  static formatIdentityForPrompt(traits: any[]): string {
    if (!traits || traits.length === 0) {
      return "";
    }

    const traitLines = traits.map((t) => {
      const confidencePercent = Math.round(t.confidence * 100);
      const stabilityPercent = Math.round(t.stability * 100);
      return `- **${t.trait}** (${t.category}): ${t.description} (Confidence: ${confidencePercent}%, Stability: ${stabilityPercent}%)`;
    });

    return `
## User Identity Profile (Self-Awareness Context)
Zenkai has synthesized the following active identity blueprint about the user based on confirmed long-term memory patterns.
Use these traits to subtly adapt your conversational tone, recommendations, and guiding style.

Traits Profile:
${traitLines.join("\n")}

Directives for tone adaptation based on categories:
- **core_identity**: Shape your overall lens. A "Builder" values prototypes and actions; a "Student" values learning and clarity; a "Deep Thinker" values reflection and depth.
- **aspiration**: Direct user attention toward these outcomes. Help them realize their goals.
- **principle**: Align your support style with these values (e.g. Growth over comfort means encouraging hard tasks gently).
- **behavior_pattern**: Tailor your responses to account for these (e.g., if they procrastination under overwhelm, help break things down).
- **current_state**: Reference their current focus areas naturally.

CRITICAL TONE RULES:
1. Do NOT explicitly tell the user that you are adapting to their identity (e.g. never say "Because you are a Builder...", "As an AI Entrepreneur...", or "I am framing this for a Deep Thinker").
2. Do NOT mention the names of these identity traits directly in conversation unless requested. The adaptation must remain completely invisible to the user.
`;
  }
}
