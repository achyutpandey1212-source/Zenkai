import { GoogleGenAI } from "@google/genai";
import { MemoryRepository } from "@/repositories/memory.repository";
import { IdentityRepository } from "@/repositories/identity.repository";
import { IdentityProposalRepository } from "@/repositories/identity-proposal.repository";
import { IIdentityTrait, IdentityTraitCategory } from "@/models/IdentityTrait";
import type { GraphState } from "@/orchestration/graph/state";

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
   * Run the Identity Engine evolution process.
   * Compares user's long-term memories with their current traits and generates updates and proposals.
   */
  static async evaluateAndEvolve(uid: string, state?: GraphState): Promise<boolean> {
    try {
      console.log(`[IdentityAgent] Starting identity evolution for user: ${uid}`);

      // 1. Fetch memories, current traits, and proposals
      const approvedMemories = await MemoryRepository.findApprovedByUser(uid);
      const activeTraits = (state?.activeTraits && state.activeTraits.length > 0)
        ? state.activeTraits
        : await IdentityRepository.findActiveByUser(uid);
      const candidateTraits = await IdentityRepository.findCandidatesByUser(uid);
      const pendingProposals = await IdentityProposalRepository.findPendingByUser(uid);

      if (approvedMemories.length === 0) {
        console.log(`[IdentityAgent] No approved memories found. Skipping evolution.`);
        return false;
      }

      // Combine traits for the LLM
      const currentTraitsFormatted = [...activeTraits, ...candidateTraits].map((t) => ({
        id: t._id.toString(),
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

      const memoriesFormatted = approvedMemories.map((m) => ({
        category: m.category,
        content: m.content,
        summary: m.summary,
        createdAt: m.createdAt,
      }));

      const pendingProposalsFormatted = pendingProposals.map((p) => ({
        trait: p.trait,
        category: p.category,
        confidence: p.confidence,
      }));

      // 2. Query Gemini to determine updates and new proposals
      const ai = this.getClient();
      const prompt = `
User Memories (Admitted Facts):
${JSON.stringify(memoriesFormatted, null, 2)}

Current User Identity Traits:
${JSON.stringify(currentTraitsFormatted, null, 2)}

Current Pending Proposals:
${JSON.stringify(pendingProposalsFormatted, null, 2)}

Analyze the user's memories and existing identity traits. Determine if you should:
1. Update existing active or candidate traits (refining descriptions, adjusting confidence/stability, updating evidence).
2. Create new identity traits (assigning category, description, initial confidence, and evidence).
3. Deprecate traits that are no longer true or have low confidence.

Remember:
- Confidence changes gradually!
- Stability depends on the time span of the memories.
- New traits should be given an initial confidence based on the depth of the memories.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: IDENTITY_AGENT_SYSTEM_PROMPT.trim(),
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
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
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        console.warn(`[IdentityAgent] Received empty response from Gemini.`);
        return false;
      }

      const result = JSON.parse(responseText) as {
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
      };

      console.log(`[IdentityAgent] Gemini response parsed. Updates: ${result.traitsToUpdate.length}, New Traits: ${result.newTraits.length}`);

      // 3. Process Updates
      for (const update of result.traitsToUpdate) {
        const existing = [...activeTraits, ...candidateTraits].find(
          (t) => t._id.toString() === update.traitId
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
            console.log(`[IdentityAgent] Updating trait "${existing.trait}" to version ${nextVersion} (Status: ${update.status})`);
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
                console.log(`[IdentityAgent] Candidate trait "${update.trait}" crossed 70% threshold. Creating proposal.`);
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

      // 4. Process New Traits
      for (const newTrait of result.newTraits) {
        // Check duplicates
        const existingActive = await IdentityRepository.findByNameAndCategory(
          uid,
          newTrait.trait,
          newTrait.category
        );

        if (existingActive) {
          console.log(`[IdentityAgent] Trait "${newTrait.trait}" already exists in profile. Skipping creation.`);
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
            console.log(`[IdentityAgent] Creating proposal for new trait: "${newTrait.trait}" (Confidence: ${newTrait.confidence})`);
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
            console.log(`[IdentityAgent] Creating candidate trait: "${newTrait.trait}" (Confidence: ${newTrait.confidence})`);
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

      console.log(`[IdentityAgent] Identity evolution completed successfully.`);
      return true;
    } catch (error) {
      console.error(`[IdentityAgent] Error during identity evolution:`, error);
      return false;
    }
  }

  /**
   * Formats the list of active identity traits into a system prompt injection block.
   */
  static formatIdentityForPrompt(traits: IIdentityTrait[]): string {
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
