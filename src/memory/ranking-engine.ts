import { IMemory } from "@/models/Memory";

export interface RankedMemory extends IMemory {
  score: number;
}

export class RankingEngine {
  /**
   * Ranks candidate memories for a given user message and intent context.
   */
  static rankMemories(
    memories: IMemory[],
    userMessage: string,
    intent: "chat" | "planning" | "reflection"
  ): IMemory[] {
    const userMessageLower = userMessage.toLowerCase();
    const userWords = this.getWords(userMessageLower);

    // 1. Score each memory
    const scoredMemories: RankedMemory[] = memories.map((memory) => {
      // Relevance: keyword overlap & string matching
      let relevance = 0.1; // baseline relevance
      if (memory.keywords && memory.keywords.length > 0) {
        const matchingKeywords = memory.keywords.filter((kw) =>
          userMessageLower.includes(kw.toLowerCase())
        );
        relevance += (matchingKeywords.length / memory.keywords.length) * 0.9;
      }

      // If there's direct word overlap, boost relevance
      const memoryWords = this.getWords(memory.content);
      const overlapWords = [...memoryWords].filter((w) => userWords.has(w));
      if (memoryWords.size > 0 && overlapWords.length > 0) {
        const wordOverlapScore = overlapWords.length / Math.min(memoryWords.size, userWords.size);
        relevance = Math.max(relevance, 0.1 + wordOverlapScore * 0.9);
      }

      // Check if memory content has substring match with user message
      const contentLower = memory.content.toLowerCase();
      if (userMessageLower.includes(contentLower) || contentLower.includes(userMessageLower)) {
        relevance = Math.max(relevance, 0.95);
      }

      // Importance (normalized from 0-10 scale to 0-1)
      const rawImportance = memory.importance ?? 5.0;
      const normalizedImportance = Math.max(rawImportance, 0.1) / 10.0;

      // Confidence (0-1 scale)
      const confidence = Math.max(memory.confidence ?? 0.5, 0.1);

      // Recency / Freshness (Decay based on lastRetrievedAt or createdAt)
      const lastTime = memory.lastRetrievedAt
        ? new Date(memory.lastRetrievedAt).getTime()
        : new Date(memory.createdAt).getTime();
      const diffMs = Date.now() - lastTime;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      // Half-life of 30 days
      const freshness = 0.2 + 0.8 * Math.exp(-diffDays / 30);

      // Retrieval Frequency bonus (log-based scaling to avoid runaway positive feedback loops)
      const frequencyBonus = 1.0 + 0.1 * Math.log1p(memory.retrievalCount || 0);

      // GoalAlignment: Goal category gets a boost
      const goalAlignment = memory.category === "Goal" ? 1.5 : 1.0;

      // Final score formula combining all elements
      const score = relevance * normalizedImportance * confidence * freshness * frequencyBonus * goalAlignment;

      const memoryObj = (typeof memory.toObject === "function") ? memory.toObject() : memory;
      return {
        ...memoryObj,
        score,
      } as RankedMemory;
    });

    // 2. Sort by final score descending
    scoredMemories.sort((a, b) => b.score - a.score);

    // 3. Deduplicate / Diversity filtering (Jaccard similarity threshold of 0.7)
    const selectedMemories: RankedMemory[] = [];
    for (const candidate of scoredMemories) {
      let isDuplicate = false;
      const candidateWords = this.getWords(candidate.content);

      for (const selected of selectedMemories) {
        const selectedWords = this.getWords(selected.content);
        const sim = this.getJaccardSimilarity(candidateWords, selectedWords);
        if (sim > 0.7) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        selectedMemories.push(candidate);
      }
    }

    // 4. Budget limit based on intent
    let budget = 5; // default simple chat
    if (intent === "planning") {
      budget = 10;
    } else if (intent === "reflection") {
      budget = 8;
    }

    return selectedMemories.slice(0, budget) as IMemory[];
  }

  /**
   * Helper to tokenize text into a set of significant words.
   */
  private static getWords(text: string): Set<string> {
    const stopwords = new Set([
      "the", "and", "a", "of", "to", "in", "is", "that", "it", "he", "was",
      "for", "on", "are", "as", "with", "his", "they", "i", "you", "my", "your",
      "we", "our", "me", "him", "her", "them", "about", "this", "there", "what",
      "how", "why", "where", "when", "who", "which", "will", "would", "should", "could"
    ]);

    const cleaned = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w));

    return new Set(cleaned);
  }

  /**
   * Helper to compute Jaccard similarity between two word sets.
   */
  private static getJaccardSimilarity(s1: Set<string>, s2: Set<string>): number {
    if (s1.size === 0 || s2.size === 0) return 0;
    const intersection = new Set([...s1].filter((x) => s2.has(x)));
    const union = new Set([...s1, ...s2]);
    return intersection.size / union.size;
  }
}
