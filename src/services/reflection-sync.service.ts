import { dbConnect } from "@/lib/mongodb";
import { ReflectionRepository } from "@/repositories/reflection.repository";

export class ReflectionSyncService {
  /**
   * Persists evolved reflection updates and proposals to MongoDB.
   */
  public static async persistReflectionEvolution(
    uid: string,
    activeReflections: any[],
    result: {
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
    }
  ): Promise<boolean> {
    await dbConnect();

    // 1. Process Updates
    for (const update of result.reflectionsToUpdate) {
      const existing = activeReflections.find(
        (r) => (r._id || r.id).toString() === update.reflectionId
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
          console.log(`[ReflectionSyncService] Evolving reflection "${existing.title}" to version ${nextVersion} (Status: ${update.status})`);

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
            updatedAt: existing.updatedAt || new Date(),
          };

          // Build confidence history
          const nextConfidenceHistory = [
            ...(existing.confidenceHistory || []),
            {
              confidence: update.confidence,
              timestamp: new Date(),
              reason: update.evolutionReason,
            },
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
            versions: [...(existing.versions || []), versionSnapshot],
          });
        }
      }
    }

    // 2. Process New Reflections
    for (const newRef of result.newReflections) {
      // Check duplicate
      const duplicate = await ReflectionRepository.findByNameAndCategory(
        uid,
        newRef.title,
        newRef.category
      );

      if (duplicate) {
        console.log(`[ReflectionSyncService] Reflection "${newRef.title}" already exists. Skipping.`);
        continue;
      }

      console.log(`[ReflectionSyncService] Creating new reflection: "${newRef.title}" (Confidence: ${newRef.confidence})`);

      await ReflectionRepository.create({
        firebaseUid: uid,
        reflectionType: "weekly",
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
            reason: "Initial pattern detection",
          },
        ],
        versions: [],
      });
    }

    return true;
  }
}
