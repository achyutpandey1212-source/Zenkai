import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { IdentityProposalRepository } from "@/repositories/identity-proposal.repository";
import { IdentityRepository } from "@/repositories/identity.repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { proposalId, action } = body; // action: "accept" | "dismiss" | "later"

    if (!proposalId || !action) {
      return NextResponse.json(
        { success: false, error: "proposalId and action are required" },
        { status: 400 }
      );
    }

    const proposal = await IdentityProposalRepository.findById(proposalId);
    if (!proposal || proposal.firebaseUid !== user.firebaseUid) {
      return NextResponse.json(
        { success: false, error: "Proposal not found" },
        { status: 404 }
      );
    }

    if (proposal.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Proposal is already processed" },
        { status: 400 }
      );
    }

    if (action === "accept") {
      // 1. Approve proposal
      await IdentityProposalRepository.updateStatus(proposalId, "approved");

      // 2. Check if the trait already exists in identityTraits
      const existingTrait = await IdentityRepository.findByNameAndCategory(
        user.firebaseUid,
        proposal.trait,
        proposal.category
      );

      if (existingTrait) {
        // Activate it and update confidence/version
        const nextVersion = (existingTrait.version || 1) + 1;
        const newEvidence = existingTrait.evidence 
          ? `${existingTrait.evidence}\n- Accepted proposal: ${proposal.reason}`
          : `- Accepted proposal: ${proposal.reason}`;

        await IdentityRepository.update(existingTrait._id.toString(), {
          status: "active",
          confidence: proposal.confidence,
          evidence: newEvidence,
          version: nextVersion,
        });
      } else {
        // Create new active trait
        await IdentityRepository.create({
          firebaseUid: user.firebaseUid,
          trait: proposal.trait,
          category: proposal.category,
          description: `You are recognized as a ${proposal.trait}.`,
          confidence: proposal.confidence,
          stability: 0.15, // starting stability
          version: 1,
          status: "active",
          evidence: `- Accepted proposal: ${proposal.reason}`,
        });
      }
    } else if (action === "dismiss") {
      // Reject proposal
      await IdentityProposalRepository.updateStatus(proposalId, "rejected");

      // Find candidate trait and decrease its confidence
      const existingTrait = await IdentityRepository.findByNameAndCategory(
        user.firebaseUid,
        proposal.trait,
        proposal.category
      );

      if (existingTrait) {
        const nextVersion = (existingTrait.version || 1) + 1;
        const newConfidence = Math.max(0.1, existingTrait.confidence - 0.2); // decrease confidence by 20%
        await IdentityRepository.update(existingTrait._id.toString(), {
          confidence: newConfidence,
          status: newConfidence < 0.3 ? "deprecated" : "candidate",
          version: nextVersion,
        });
      }
    } else if (action === "later") {
      // Keep it pending, no changes
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/identity/proposals/respond error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
