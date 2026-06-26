import { IMemory } from "@/models/Memory";
import { MemoryRepository } from "@/repositories/memory.repository";
import { RankingEngine } from "@/memory/ranking-engine";

export type MemoryIntent = "chat" | "planning" | "reflection";

export interface RetrievalContextPacket {
  intent: MemoryIntent;
  memories: IMemory[];
  extractedKeywords: string[];
}

export class RetrievalPipeline {
  private static stopwords = new Set([
    "the", "and", "a", "of", "to", "in", "is", "that", "it", "he", "was",
    "for", "on", "are", "as", "with", "his", "they", "i", "you", "my", "your",
    "we", "our", "me", "him", "her", "them", "about", "this", "there", "what",
    "how", "why", "where", "when", "who", "which", "will", "would", "should", "could",
    "want", "need", "like", "love", "hate", "good", "bad", "okay", "yes", "no"
  ]);

  /**
   * Detects the user's intent based on message content.
   */
  static detectIntent(message: string): MemoryIntent {
    const text = message.toLowerCase();
    
    const planningKeywords = [
      "plan", "schedule", "organize", "goal", "todo", "task", "project", "milestone",
      "strategy", "target", "deadline", "roadmap", "action", "step", "career", "entrepreneur"
    ];
    
    const reflectionKeywords = [
      "feel", "stuck", "overwhelmed", "confused", "sad", "stressed", "reflect", "thought",
      "journal", "realize", "wonder", "why", "happy", "depressed", "anxious", "worry",
      "motivation", "energy", "burnout", "tired", "frustrated", "fear", "doubt"
    ];

    const hasPlanning = planningKeywords.some(kw => text.includes(kw));
    const hasReflection = reflectionKeywords.some(kw => text.includes(kw));

    if (hasPlanning) return "planning";
    if (hasReflection) return "reflection";
    return "chat";
  }

  /**
   * Helper to extract keywords from user message for keyword-based retrieval.
   */
  static extractKeywords(message: string): string[] {
    return message
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !this.stopwords.has(w));
  }

  /**
   * Main retrieval method that returns the ranked, budgeted memory context.
   */
  static async retrieveForContext(
    uid: string,
    userMessage: string
  ): Promise<RetrievalContextPacket> {
    const intent = this.detectIntent(userMessage);
    const keywords = this.extractKeywords(userMessage);

    // 1. Broadly fetch candidate memories
    // Fetch via keyword overlap
    const keywordCandidates = keywords.length > 0
      ? await MemoryRepository.findRelevantByKeywords(uid, keywords, 30)
      : [];

    // Fetch by type priority to ensure coverage
    const [identityList, aspirationList, goalList, behaviorList, constraintList, principleList, reflectionList] = await Promise.all([
      MemoryRepository.findByTypeWithLimit(uid, "identity", 5),
      MemoryRepository.findByTypeWithLimit(uid, "aspiration", 5),
      MemoryRepository.findByTypeWithLimit(uid, "goal", 5),
      MemoryRepository.findByTypeWithLimit(uid, "behavior", 5),
      MemoryRepository.findByTypeWithLimit(uid, "constraint", 5),
      MemoryRepository.findByTypeWithLimit(uid, "principle", 5),
      MemoryRepository.findByTypeWithLimit(uid, "reflection", 5),
    ]);

    // Merge all lists
    const allCandidates = [
      ...keywordCandidates,
      ...identityList,
      ...aspirationList,
      ...goalList,
      ...behaviorList,
      ...constraintList,
      ...principleList,
      ...reflectionList
    ];

    // Deduplicate candidates by their stringified ID
    const uniqueMap = new Map<string, IMemory>();
    for (const mem of allCandidates) {
      const idStr = mem._id.toString();
      if (!uniqueMap.has(idStr)) {
        uniqueMap.set(idStr, mem);
      }
    }
    const candidates = Array.from(uniqueMap.values());

    // 2. Rank candidate memories and apply context budget limits
    const rankedMemories = RankingEngine.rankMemories(candidates, userMessage, intent);

    return {
      intent,
      memories: rankedMemories,
      extractedKeywords: keywords
    };
  }
}
