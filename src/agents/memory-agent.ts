import { GoogleGenAI } from "@google/genai";
import { IMemory } from "@/models/Memory";
import { MemoryRepository } from "@/repositories/memory.repository";
import { AdmissionPolicy } from "@/memory/admission-policy";
import { RetrievalPipeline, RetrievalContextPacket } from "@/memory/retrieval-pipeline";

const CONSOLIDATION_SYSTEM_PROMPT = `
You are the Memory Consolidation Engine for Zenkai.
Your job is to compare a new user memory candidate against a list of existing user memories of the same category, and determine if the new candidate conflicts with, updates, refines, or is completely independent of the existing memories.

Relationship Types:
- "contradicts_or_updates": The new memory directly replaces, contradicts, or represents a change of mind/state from an old memory (e.g. "User no longer wants to be an entrepreneur" conflicts with "User wants to be an entrepreneur").
- "supports_or_refines": The new memory adds more detail, refines, or elaborates on an old memory without contradicting it.
- "none": The new memory is about a different topic and should be stored as a separate, new memory.

You must return a JSON response matching the requested schema.
`;

export class MemoryAgent {
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
   * Evaluates the latest conversation exchange, checks for duplicates/conflicts with existing memories,
   * and creates or updates user memory appropriately. Runs asynchronously post-chat.
   */
  static async evaluateAndStore(
    uid: string,
    userMessage: string,
    assistantResponse: string,
    conversationId?: string,
    messageId?: string
  ): Promise<IMemory | null> {
    try {
      // 1. Evaluate user statement and response via AdmissionPolicy
      const decision = await AdmissionPolicy.evaluateExchange(userMessage, assistantResponse);

      if (!decision.shouldStore || !decision.content || !decision.category) {
        console.log(`[MemoryAgent] Admission rejected: ${decision.reason}`);
        return null;
      }

      console.log(`[MemoryAgent] Admission approved: ${decision.reason}. Category: ${decision.category}`);

      // 2. Fetch existing memories of the same category to check for contradictions or updates
      const existingMemories = await MemoryRepository.findByCategory(uid, decision.category);
      
      if (existingMemories.length > 0) {
        const consolidation = await this.checkConsolidation(
          decision.content,
          existingMemories
        );

        if (
          (consolidation.relationship === "contradicts_or_updates" || 
           consolidation.relationship === "supports_or_refines") &&
          consolidation.targetMemoryId
        ) {
          const targetMemory = existingMemories.find(
            (m) => m._id.toString() === consolidation.targetMemoryId
          );

          if (targetMemory) {
            console.log(`[MemoryAgent] Consolidating memory ${targetMemory._id} (${consolidation.relationship})`);

            const updatedMemory = await MemoryRepository.update(targetMemory._id.toString(), {
              content: consolidation.consolidatedContent || decision.content,
              summary: consolidation.consolidatedSummary || decision.summary || decision.content,
              confidence: decision.confidence ?? 0.8,
              importance: decision.importance ?? 5.0,
              importanceReason: decision.importanceReason || targetMemory.importanceReason,
              reason: `Evolved memory: ${decision.reason} (Previous: ${targetMemory.content})`,
              version: (targetMemory.version || 1) + 1,
              keywords: Array.from(new Set([...(targetMemory.keywords || []), ...(decision.keywords || [])])),
              conversationId,
              messageId,
            });

            return updatedMemory;
          }
        }
      }

      // 3. Prepare memory creation input
      const memoryData = {
        firebaseUid: uid,
        category: decision.category,
        content: decision.content,
        summary: decision.summary || decision.content,
        confidence: decision.confidence ?? 0.8,
        importance: decision.importance ?? 5.0,
        importanceReason: decision.importanceReason || "Synthesized from conversation",
        reason: decision.reason,
        status: "approved" as const,
        conversationId,
        messageId,
        version: 1,
        keywords: decision.keywords || [],
      };

      // 4. Persist new memory to DB
      const newMemory = await MemoryRepository.create(memoryData);
      return newMemory;
    } catch (error) {
      console.error("[MemoryAgent] Error in evaluateAndStore:", error);
      return null;
    }
  }

  /**
   * Helper to ask Gemini if the new memory candidate conflicts with or updates any existing memories.
   */
  private static async checkConsolidation(
    newContent: string,
    existingList: IMemory[]
  ): Promise<{
    relationship: "contradicts_or_updates" | "supports_or_refines" | "none";
    targetMemoryId: string | null;
    consolidatedContent: string | null;
    consolidatedSummary: string | null;
  }> {
    const ai = this.getClient();

    const existingFormatted = existingList
      .map((m) => `ID: ${m._id} | Content: "${m.content}"`)
      .join("\n");

    const prompt = `
New Memory Candidate: "${newContent}"

Existing Memories:
${existingFormatted}

Compare the new memory candidate against the existing memories.
If there is a conflict/update/refinement, provide the target memory ID and suggest the new consolidated content.
`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: CONSOLIDATION_SYSTEM_PROMPT.trim(),
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              relationship: {
                type: "STRING",
                enum: ["contradicts_or_updates", "supports_or_refines", "none"],
              },
              targetMemoryId: { type: "STRING" },
              consolidatedContent: { type: "STRING" },
              consolidatedSummary: { type: "STRING" },
            },
            required: ["relationship"],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        return { relationship: "none", targetMemoryId: null, consolidatedContent: null, consolidatedSummary: null };
      }

      return JSON.parse(responseText);
    } catch (error) {
      console.error("[MemoryAgent] Error in checkConsolidation:", error);
      return { relationship: "none", targetMemoryId: null, consolidatedContent: null, consolidatedSummary: null };
    }
  }

  /**
   * Retrieves and ranks relevant memories for injecting into the companion's prompt.
   * Also asynchronously registers retrieval statistics.
   */
  static async retrieveForContext(
    uid: string,
    userMessage: string
  ): Promise<RetrievalContextPacket> {
    try {
      const contextPacket = await RetrievalPipeline.retrieveForContext(uid, userMessage);

      // Asynchronously update retrieval statistics in the background (fire-and-forget)
      if (contextPacket.memories.length > 0) {
        contextPacket.memories.forEach((mem) => {
          MemoryRepository.incrementRetrievalCount(mem._id.toString()).catch((err) => {
            console.error(`[MemoryAgent] Failed to increment retrieval count for memory ${mem._id}:`, err);
          });
        });
      }

      return contextPacket;
    } catch (error) {
      console.error("[MemoryAgent] Error in retrieveForContext:", error);
      return {
        intent: "chat",
        memories: [],
        extractedKeywords: [],
      };
    }
  }

  /**
   * Formats the list of memories into a structured natural context block for system prompt injection.
   */
  static formatMemoriesForPrompt(memories: IMemory[]): string {
    if (!memories || memories.length === 0) {
      return "";
    }

    const memoryBlocks = memories.map((mem) => {
      return `- ${mem.summary} (Category: ${mem.category}, Detail: ${mem.content})`;
    });

    return `
## User Context (From Zenkai Memory)
Below is important long-term context Zenkai has synthesized and remembered about the user from previous conversations. Use this information to tailor your response, address their goals, reference their constraints, and personalize their growth journey. Do NOT quote this info roboticly or mention "your memory". Integrate it naturally.

${memoryBlocks.join("\n")}
`;
  }
}
