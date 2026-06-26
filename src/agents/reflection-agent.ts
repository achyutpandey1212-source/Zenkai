import { GoogleGenAI } from "@google/genai";
import { MemoryRepository } from "@/repositories/memory.repository";
import { IdentityRepository } from "@/repositories/identity.repository";
import { ReflectionRepository } from "@/repositories/reflection.repository";
import { MessageRepository } from "@/repositories/message.repository";
import { IReflection, ReflectionType, ReflectionStatus } from "@/models/Reflection";

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
   * Run the Reflection Engine pattern detection and evolution pipeline.
   */
  static async evaluateAndEvolve(uid: string): Promise<boolean> {
    try {
      console.log(`[ReflectionAgent] Starting reflection evolution for user: ${uid}`);

      // 1. Fetch memories, identity traits, recent conversations, and existing reflections
      const approvedMemories = await MemoryRepository.findApprovedByUser(uid);
      const activeTraits = await IdentityRepository.findActiveByUser(uid);
      const candidateTraits = await IdentityRepository.findCandidatesByUser(uid);
      
      // Load recent conversations (last 30 messages) to identify behavior patterns
      const conversations = await MessageRepository.findConversationsByUser(uid);
      let recentMessagesFormatted: any[] = [];
      if (conversations.length > 0) {
        const latestConvId = conversations[0]._id.toString();
        const messages = await MessageRepository.findRecentMessages(latestConvId, 30);
        recentMessagesFormatted = messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.createdAt
        }));
      }

      const activeReflections = await ReflectionRepository.findActiveByUser(uid);

      if (approvedMemories.length === 0 && activeReflections.length === 0) {
        console.log(`[ReflectionAgent] No memories or existing reflections found. Skipping.`);
        return false;
      }

      // Format data for prompt
      const memoriesFormatted = approvedMemories.map(m => ({
        id: m._id.toString(),
        category: m.category,
        content: m.content,
        summary: m.summary,
        createdAt: m.createdAt
      }));

      const traitsFormatted = [...activeTraits, ...candidateTraits].map(t => ({
        id: t._id.toString(),
        trait: t.trait,
        category: t.category,
        description: t.description,
        confidence: t.confidence,
        status: t.status
      }));

      const reflectionsFormatted = activeReflections.map(r => ({
        id: r._id.toString(),
        title: r.title,
        category: r.category,
        content: r.content,
        summary: r.summary,
        confidence: r.confidence,
        stability: r.stability,
        importance: r.importance,
        version: r.version,
        evidenceCount: r.evidenceCount,
        supportingMemoryIds: r.supportingMemoryIds,
        supportingIdentityTraitIds: r.supportingIdentityTraitIds
      }));

      // 2. Query Gemini to determine updates, deprecations, and new reflections
      const ai = this.getClient();
      const prompt = `
User Memories (Approved Facts):
${JSON.stringify(memoriesFormatted, null, 2)}

User Identity Blueprint:
${JSON.stringify(traitsFormatted, null, 2)}

Recent Conversation Exchange:
${JSON.stringify(recentMessagesFormatted, null, 2)}

Existing Active Reflections:
${JSON.stringify(reflectionsFormatted, null, 2)}

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

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: REFLECTION_AGENT_SYSTEM_PROMPT.trim(),
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
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
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        console.warn(`[ReflectionAgent] Received empty response from Gemini.`);
        return false;
      }

      const result = JSON.parse(responseText) as {
        reflectionsToUpdate: {
          reflectionId: string;
          title: string;
          category: string;
          content: string;
          summary: string;
          confidence: number;
          stability: number;
          importance: number;
          supportingMemoryIds: string[];
          supportingIdentityTraitIds: string[];
          status: "active" | "deprecated";
          evolutionReason: string;
          llmReasoning: string;
        }[];
        newReflections: {
          title: string;
          category: string;
          content: string;
          summary: string;
          confidence: number;
          stability: number;
          importance: number;
          supportingMemoryIds: string[];
          supportingIdentityTraitIds: string[];
          llmReasoning: string;
        }[];
      };

      console.log(`[ReflectionAgent] Gemini parsed. Updates: ${result.reflectionsToUpdate.length}, New: ${result.newReflections.length}`);

      // 3. Process Updates & Versioning
      for (const update of result.reflectionsToUpdate) {
        const existing = activeReflections.find(
          r => r._id.toString() === update.reflectionId
        );

        if (existing) {
          const hasChanged =
            existing.confidence !== update.confidence ||
            existing.stability !== update.stability ||
            existing.status !== update.status ||
            existing.content !== update.content ||
            existing.title !== update.title ||
            existing.summary !== update.summary;

          if (hasChanged) {
            const nextVersion = (existing.version || 1) + 1;
            console.log(`[ReflectionAgent] Evolving reflection "${existing.title}" to version ${nextVersion} (Status: ${update.status})`);

            // Push current state to versions history array
            const versionSnapshot = {
              version: existing.version || 1,
              title: existing.title,
              content: existing.content,
              summary: existing.summary,
              confidence: existing.confidence,
              stability: existing.stability,
              evidenceCount: existing.evidenceCount || 1,
              supportingMemoryIds: existing.supportingMemoryIds || [],
              supportingIdentityTraitIds: existing.supportingIdentityTraitIds || [],
              evolutionReason: existing.evolutionReason || "Initial version",
              llmReasoning: existing.llmReasoning || "",
              updatedAt: existing.updatedAt || new Date()
            };

            // Build confidence history
            const nextConfidenceHistory = [
              ...(existing.confidenceHistory || []),
              {
                confidence: update.confidence,
                timestamp: new Date(),
                reason: update.evolutionReason
              }
            ];

            await ReflectionRepository.update(update.reflectionId, {
              title: update.title,
              category: update.category,
              content: update.content,
              summary: update.summary,
              confidence: update.confidence,
              stability: update.stability,
              importance: update.importance,
              supportingMemoryIds: update.supportingMemoryIds,
              supportingIdentityTraitIds: update.supportingIdentityTraitIds,
              status: update.status,
              version: nextVersion,
              evidenceCount: update.supportingMemoryIds.length,
              llmReasoning: update.llmReasoning,
              evolutionReason: update.evolutionReason,
              lastValidatedAt: new Date(),
              confidenceHistory: nextConfidenceHistory,
              versions: [...(existing.versions || []), versionSnapshot]
            });
          }
        }
      }

      // 4. Process New Reflections
      for (const newRef of result.newReflections) {
        // Double check duplicate title/category just in case
        const duplicate = await ReflectionRepository.findByNameAndCategory(
          uid,
          newRef.title,
          newRef.category
        );

        if (duplicate) {
          console.log(`[ReflectionAgent] Reflection "${newRef.title}" in category "${newRef.category}" already exists. Skipping.`);
          continue;
        }

        console.log(`[ReflectionAgent] Creating new reflection: "${newRef.title}" (Confidence: ${newRef.confidence})`);
        
        await ReflectionRepository.create({
          firebaseUid: uid,
          reflectionType: "weekly", // Default to weekly/monthly level pattern
          title: newRef.title,
          category: newRef.category,
          content: newRef.content,
          summary: newRef.summary,
          confidence: newRef.confidence,
          stability: newRef.stability || 0.1,
          importance: newRef.importance || 5.0,
          supportingMemoryIds: newRef.supportingMemoryIds,
          supportingIdentityTraitIds: newRef.supportingIdentityTraitIds,
          status: "active",
          version: 1,
          evidenceCount: newRef.supportingMemoryIds.length,
          llmReasoning: newRef.llmReasoning,
          evolutionReason: "Initial pattern detected.",
          confidenceHistory: [
            {
              confidence: newRef.confidence,
              timestamp: new Date(),
              reason: "Initial pattern detection"
            }
          ],
          versions: []
        });
      }

      return true;
    } catch (error) {
      console.error(`[ReflectionAgent] Error during reflection evolution:`, error);
      return false;
    }
  }

  /**
   * Formats active reflections for companion system prompt context.
   */
  static formatReflectionsForPrompt(reflections: IReflection[]): string {
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
