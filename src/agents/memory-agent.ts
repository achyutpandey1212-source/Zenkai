import { IMemory } from "@/models/Memory";
import { MemoryRepository } from "@/repositories/memory.repository";
import { AdmissionPolicy } from "@/memory/admission-policy";
import { RetrievalPipeline, RetrievalContextPacket } from "@/memory/retrieval-pipeline";

export class MemoryAgent {
  /**
   * Evaluates the latest conversation exchange and creates/updates user memory if appropriate.
   * Runs asynchronously post-chat (non-blocking).
   */
  static async evaluateAndStore(
    uid: string,
    userMessage: string,
    assistantResponse: string,
    conversationId?: string
  ): Promise<IMemory | null> {
    try {
      // 1. Evaluate user statement and response via AdmissionPolicy
      const decision = await AdmissionPolicy.evaluateExchange(userMessage, assistantResponse);

      if (!decision.shouldStore || !decision.content || !decision.memoryType) {
        console.log(`[MemoryAgent] Admission rejected: ${decision.reason}`);
        return null;
      }

      console.log(`[MemoryAgent] Admission approved: ${decision.reason}. Type: ${decision.memoryType}`);

      // 2. Prepare memory creation input
      const sourceSnippet = userMessage.trim().substring(0, 100);
      const memoryData = {
        firebaseUid: uid,
        memoryType: decision.memoryType,
        content: decision.content,
        summary: decision.summary || decision.content,
        confidence: decision.confidence ?? 0.8,
        importance: decision.importance ?? 0.5,
        status: "approved" as const, // approved by default or candidate? The spec says "approved" to make it active, or candidate for human review if spec requires. "starts as approved" makes it immediately usable in chat.
        sourceConversationId: conversationId,
        sourceMessageSnippet: sourceSnippet,
        admissionReason: decision.reason,
        keywords: decision.keywords || [],
      };

      // 3. Persist memory candidate to DB
      const newMemory = await MemoryRepository.create(memoryData);
      return newMemory;
    } catch (error) {
      console.error("[MemoryAgent] Error in evaluateAndStore:", error);
      return null;
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
      return `- ${mem.summary} (Details: ${mem.content})`;
    });

    return `
## User Context (From Zenkai Memory)
Below is important long-term context Zenkai has synthesized and remembered about the user from previous conversations. Use this information to tailor your response, address their goals, reference their constraints, and personalize their growth journey. Do NOT quote this info roboticly or mention "your memory". Integrate it naturally.

${memoryBlocks.join("\n")}
`;
  }
}
