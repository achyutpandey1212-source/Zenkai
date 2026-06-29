import { GoogleGenAI } from "@google/genai";
import { ContextOrchestrator } from "@/services/context-orchestrator.service";
import { ReflectionSyncService } from "@/services/reflection-sync.service";
import type { GraphState } from "@/orchestration/graph/state";
import type { NormalizedUserContext } from "@/types/context.types";
import { AIValidationService } from "@/services/ai-validation.service";
import { telemetryStorage } from "@/lib/telemetry-context";

const REFLECTION_AGENT_SYSTEM_PROMPT = `
You are the Reflection Engine Agent for Zenkai.
Your mission is to turn raw user memory context, identity traits, and recent conversations into long-term, pattern-based wisdom.

Reflection is NOT summarization. Reflection is NOT memory. Reflection is NOT a chat response. It is distilled wisdom.
- Bad Reflection: "User studied today."
- Good Reflection: "The user consistently performs better when work is broken into small milestones."
- Another Bad Reflection: "User likes Next.js."
- Another Good Reflection: "The user learns fastest by building real projects instead of consuming theory."

Categories of reflections:
"Learning Style", "Productivity", "Motivation", "Habits", "Decision Making", "Communication", "Stress", "Time Management", "Planning", "Creativity", "Career", "Health", "Relationships", "Emotional Regulation", "Goal Execution".

Lifecycle, Versioning, and Diagnostics Rules:
1. Never hallucinate. Every reflection must be grounded in the provided memories, identity traits, or conversation history.
2. Confidence (0.0 to 1.0): Represents evidence strength.
   - Hypothesis (< 0.60): A new pattern backed by 1-2 pieces of evidence.
   - Emerging Pattern (0.60 - 0.79): Backed by several pieces of evidence across multiple conversations.
   - Strong Pattern (0.80 - 0.94): Highly repeated and confirmed pattern.
   - Highly Stable (>= 0.95): Unchanging over weeks or months.
   - Confidence must evolve GRADUALLY (e.g. increase or decrease by 0.05 to 0.15 depending on confirmations/contradictions).
3. Stability (0.0 to 1.0): Represents how long this pattern has stayed true.
   - Low stability (0.1 - 0.3): Evidence covers a short time span (< 3 days).
   - Medium stability (0.4 - 0.7): Evidence covers weeks (4 - 14 days).
   - High stability (0.8 - 1.0): Evidence covers months (> 14 days).
4. Duplication: Never create duplicate active reflections. If a pattern already exists in "Active Reflections", you must update it (refining its text, incrementing version, adjusting stats) instead of creating a new one.
5. Deprecation: If the user's behavior changes and contradicts a reflection, or if confidence drops below 0.35, mark status as "deprecated" and provide an evolution reason.
6. Developer Diagnostics: Provide clear, detailed "llmReasoning" explaining your analysis of the data, and "evolutionReason" explaining why the pattern was created, updated, or deprecated.

You must return a JSON response matching the requested schema.
`;

export class ReflectionAgent {
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
   * PURE AI Reasoning function for reflection patterns detection.
   */
  static async evaluateAndEvolveLogic(
    memories: any[],
    traits: any[],
    recentMessages: any[],
    reflections: any[]
  ): Promise<{
    reflectionsToUpdate: any[];
    newReflections: any[];
  } | null> {
    try {
      const ai = this.getClient();
      const prompt = `
User Memories (Approved Facts):
${JSON.stringify(memories, null, 2)}

User Identity Blueprint:
${JSON.stringify(traits, null, 2)}

Recent Conversation Exchange:
${JSON.stringify(recentMessages, null, 2)}

Existing Active Reflections:
${JSON.stringify(reflections, null, 2)}

Perform a deep pattern analysis on the user's data. Identify behavioral, planning, or learning habits.
Decide if you should:
1. Update existing reflections: refine content, adjust confidence/stability slowly, update supporting memory/identity IDs, or mark as "deprecated".
2. Propose new reflections: if a pattern emerges from memories and conversations that is not covered by existing reflections.

Ensure that:
- Reflections capture general patterns, NOT specific events.
- Supporting Memory IDs and Identity Trait IDs exist in the input lists.
- Confidence changes gradually (+0.05 to +0.15 for confirmations, -0.15 to -0.30 for contradictions).
- Evolution reasons are detailed and explain the logic.
`;

      const reflectionSchema: any = {
        type: "OBJECT",
        properties: {
          reflectionsToUpdate: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                reflectionId: { type: "STRING" },
                title: { type: "STRING" },
                category: { type: "STRING" },
                content: { type: "STRING" },
                summary: { type: "STRING" },
                confidence: { type: "NUMBER" },
                stability: { type: "NUMBER" },
                importance: { type: "NUMBER" },
                supportingMemoryIds: { type: "ARRAY", items: { type: "STRING" } },
                supportingIdentityTraitIds: { type: "ARRAY", items: { type: "STRING" } },
                status: { type: "STRING", enum: ["active", "deprecated"] },
                evolutionReason: { type: "STRING" },
                llmReasoning: { type: "STRING" }
              },
              required: [
                "reflectionId", "title", "category", "content", "summary", 
                "confidence", "stability", "importance", "supportingMemoryIds", 
                "supportingIdentityTraitIds", "status", "evolutionReason", "llmReasoning"
              ]
            }
          },
          newReflections: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                category: { type: "STRING" },
                content: { type: "STRING" },
                summary: { type: "STRING" },
                confidence: { type: "NUMBER" },
                stability: { type: "NUMBER" },
                importance: { type: "NUMBER" },
                supportingMemoryIds: { type: "ARRAY", items: { type: "STRING" } },
                supportingIdentityTraitIds: { type: "ARRAY", items: { type: "STRING" } },
                llmReasoning: { type: "STRING" }
              },
              required: [
                "title", "category", "content", "summary", 
                "confidence", "stability", "importance", "supportingMemoryIds", 
                "supportingIdentityTraitIds", "llmReasoning"
              ]
            }
          }
        },
        required: ["reflectionsToUpdate", "newReflections"]
      };

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: REFLECTION_AGENT_SYSTEM_PROMPT.trim(),
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: reflectionSchema,
        }
      });

      let responseText = response.text;
      if (!responseText) {
        console.warn(`[ReflectionAgent] Received empty response from Gemini.`);
        return null;
      }

      let result: any;
      try {
        result = JSON.parse(responseText);
        result = AIValidationService.validateAndRepairReflections(result);
      } catch (validationErr: any) {
        console.warn(`[AI Validation] Initial reflections validation failed: ${validationErr.message}. Retrying once...`);
        const store = telemetryStorage.getStore();
        const state = store?.stateRef as any;
        if (state) {
          if (!state.retries) state.retries = [];
          state.retries.push({ action: "reflectionValidationRetry", attempt: 1, error: validationErr.message });
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
            systemInstruction: REFLECTION_AGENT_SYSTEM_PROMPT.trim(),
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: reflectionSchema,
          },
        });

        const retryResponseText = retryResponse.text;
        if (!retryResponseText) throw new Error("Retry reflections response was empty");
        responseText = retryResponseText;
        result = JSON.parse(responseText);

        result = AIValidationService.validateAndRepairReflections(result);
      }

      return result;
    } catch (err) {
      console.error("[ReflectionAgent] evaluateAndEvolveLogic failed:", err);
      return null;
    }
  }

  /**
   * Shell wrapper for reflection evolution.
   * Resolves context using ContextOrchestrator and delegates persistence to ReflectionSyncService.
   */
  static async evaluateAndEvolve(uid: string, state?: GraphState): Promise<boolean> {
    try {
      console.log(`[ReflectionAgent] Starting reflection evolution workflow shell for user: ${uid}`);
      const workflowId = state?.workflowId || `fallback-reflection-${uid}-${Date.now()}`;

      // 1. Fetch context
      let normalizedContext: NormalizedUserContext;
      if (state && state.contextVersion) {
        normalizedContext = ContextOrchestrator.getContext(workflowId);
      } else {
        normalizedContext = await ContextOrchestrator.loadContext(
          uid,
          workflowId,
          "Fallback reflection evolution execution"
        );
      }

      const memoriesFormatted = normalizedContext.memories.map((m) => ({
        id: m.id,
        category: m.category,
        content: m.content,
        summary: m.summary,
        createdAt: m.createdAt,
      }));

      const traitsFormatted = [
        ...normalizedContext.identity.activeTraits,
        ...normalizedContext.identity.candidateTraits,
      ].map((t) => ({
        id: t.id,
        trait: t.trait,
        category: t.category,
        description: t.description,
        confidence: t.confidence,
        status: t.status,
      }));

      const activeReflections = normalizedContext.reflections;
      const reflectionsFormatted = activeReflections.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        content: r.content,
        summary: r.summary,
        confidence: r.confidence,
        stability: r.stability,
        importance: r.importance,
        evidenceCount: r.evidenceCount,
      }));

      // Format recent messages from state history, or load fallback
      let recentMessagesFormatted: any[] = [];
      if (state?.history && state.history.length > 0) {
        recentMessagesFormatted = state.history.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));
      } else {
        const { MessageRepository } = await import("@/repositories/message.repository");
        const conversations = await MessageRepository.findConversationsByUser(uid);
        if (conversations.length > 0) {
          const latestConvId = conversations[0]._id.toString();
          const messages = await MessageRepository.findRecentMessages(latestConvId, 30);
          recentMessagesFormatted = messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.createdAt,
          }));
        }
      }

      if (memoriesFormatted.length === 0 && reflectionsFormatted.length === 0) {
        console.log(`[ReflectionAgent] No memories or existing reflections found. Skipping.`);
        return false;
      }

      // 2. Execute Pure AI Logic
      const aiResult = await this.evaluateAndEvolveLogic(
        memoriesFormatted,
        traitsFormatted,
        recentMessagesFormatted,
        reflectionsFormatted
      );

      if (!aiResult) {
        return false;
      }

      // 3. Persist modifications using ReflectionSyncService
      const success = await ReflectionSyncService.persistReflectionEvolution(
        uid,
        activeReflections,
        aiResult
      );

      // Clean up fallback cache
      if (!state || !state.contextVersion) {
        ContextOrchestrator.invalidateCache(workflowId);
      }

      return success;
    } catch (error) {
      console.error(`[ReflectionAgent] Error during reflection evolution shell:`, error);
      return false;
    }
  }

  /**
   * Backwards-compatible prompt formatting helper
   */
  static formatReflectionsForPrompt(reflections: any[]): string {
    if (!reflections || reflections.length === 0) {
      return "";
    }

    const reflectionLines = reflections.map(r => {
      const confidencePercent = Math.round(r.confidence * 100);
      const stabilityPercent = Math.round(r.stability * 100);
      return `- **${r.title}** (${r.category}): ${r.content} (Confidence: ${confidencePercent}%, Stability: ${stabilityPercent}%)`;
    });

    return `
## User Behavioral Reflections (Distilled Wisdom Context)
Zenkai has observed the following recurring behavioral, learning, and productivity patterns about the user over time:
${reflectionLines.join("\n")}

Directives for tone and recommendation adaptation:
1. Subtly guide the user using these reflections. For example, if a reflection notes they overcommit or learn best by building, naturally nudge them to break tasks down or suggest small hands-on projects.
2. Do NOT disclose this reflection list to the user. Never say "My reflections show...", "According to my pattern analysis...", or "I observed a pattern that...". Frame your advice as a direct, intuitive recommendation.
`.trim();
  }
}
