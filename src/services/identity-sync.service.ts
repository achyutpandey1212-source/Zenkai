import { dbConnect } from "@/lib/mongodb";
import { IdentityRepository } from "@/repositories/identity.repository";
import { IdentityProposalRepository } from "@/repositories/identity-proposal.repository";
import { IdentityTraitCategory } from "@/models/IdentityTrait";

export class IdentitySyncService {
  /**
   * Persists identity trait updates and proposal creations to MongoDB.
   */
  public static async persistIdentityEvolution(
    uid: string,
    activeTraits: any[],
    candidateTraits: any[],
    result: {
      traitsToUpdate: {
        traitId: string;
        trait: string;
        category: IdentityTraitCategory;
        description: string;
        confidence: number;
        stability: number;
        evidence: string;
        status: "active" | "candidate" | "deprecated";
      }[];
      newTraits: {
        trait: string;
        category: IdentityTraitCategory;
        description: string;
        confidence: number;
        evidence: string;
      }[];
    }
  ): Promise<boolean> {
    await dbConnect();

    // 1. Process Updates
    for (const update of result.traitsToUpdate) {
      const existing = [...activeTraits, ...candidateTraits].find(
        (t) => (t._id || t.id).toString() === update.traitId
      );

      if (existing) {
        const hasChanged =
          existing.confidence !== update.confidence ||
          existing.stability !== update.stability ||
          existing.description !== update.description ||
          existing.status !== update.status ||
          existing.evidence !== update.evidence;

        if (hasChanged) {
          const nextVersion = (existing.version || 1) + 1;
          console.log(`[IdentitySyncService] Updating trait "${existing.trait}" to version ${nextVersion} (Status: ${update.status})`);
          await IdentityRepository.update(update.traitId, {
            confidence: update.confidence,
            stability: update.stability,
            description: update.description,
            status: update.status,
            evidence: update.evidence,
            version: nextVersion,
          });

          // If an existing candidate trait's confidence rises to >= 0.70, trigger a proposal
          if (
            existing.status === "candidate" &&
            update.status === "candidate" &&
            update.confidence >= 0.70
          ) {
            const duplicateProposal = await IdentityProposalRepository.findByNameCategoryAndStatus(
              uid,
              update.trait,
              update.category,
              "pending"
            );

            if (!duplicateProposal) {
              console.log(`[IdentitySyncService] Candidate trait "${update.trait}" crossed 70% threshold. Creating proposal.`);
              await IdentityProposalRepository.create({
                firebaseUid: uid,
                trait: update.trait,
                category: update.category,
                confidence: update.confidence,
                reason: update.evidence || update.description,
              });
            }
          }
        }
      }
    }

    // 2. Process New Traits
    for (const newTrait of result.newTraits) {
      // Check duplicates
      const existingActive = await IdentityRepository.findByNameAndCategory(
        uid,
        newTrait.trait,
        newTrait.category
      );

      if (existingActive) {
        console.log(`[IdentitySyncService] Trait "${newTrait.trait}" already exists in profile. Skipping creation.`);
        continue;
      }

      // If confidence is >= 0.70, create a pending Proposal AND save trait as candidate
      if (newTrait.confidence >= 0.70) {
        // Check for pending proposals to avoid duplicates
        const pending = await IdentityProposalRepository.findByNameCategoryAndStatus(
          uid,
          newTrait.trait,
          newTrait.category,
          "pending"
        );

        if (!pending) {
          console.log(`[IdentitySyncService] Creating proposal for new trait: "${newTrait.trait}" (Confidence: ${newTrait.confidence})`);
          await IdentityProposalRepository.create({
            firebaseUid: uid,
            trait: newTrait.trait,
            category: newTrait.category,
            confidence: newTrait.confidence,
            reason: newTrait.evidence || newTrait.description,
          });
        }

        // Create the candidate trait if not already created
        const duplicateCandidate = await IdentityRepository.findByNameAndCategory(
          uid,
          newTrait.trait,
          newTrait.category
        );
        if (!duplicateCandidate) {
          await IdentityRepository.create({
            firebaseUid: uid,
            trait: newTrait.trait,
            category: newTrait.category,
            description: newTrait.description,
            confidence: newTrait.confidence,
            stability: 0.1, // starting stability
            version: 1,
            status: "candidate",
            evidence: newTrait.evidence,
          });
        }
      } else {
        // If confidence is < 0.70, save directly as a candidate (Hypothesis / Emerging state)
        const duplicateCandidate = await IdentityRepository.findByNameAndCategory(
          uid,
          newTrait.trait,
          newTrait.category
        );

        if (!duplicateCandidate) {
          console.log(`[IdentitySyncService] Creating candidate trait: "${newTrait.trait}" (Confidence: ${newTrait.confidence})`);
          await IdentityRepository.create({
            firebaseUid: uid,
            trait: newTrait.trait,
            category: newTrait.category,
            description: newTrait.description,
            confidence: newTrait.confidence,
            stability: 0.1,
            version: 1,
            status: "candidate",
            evidence: newTrait.evidence,
          });
        }
      }
    }

    return true;
  }
}
