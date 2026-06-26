import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { IdentityRepository } from "@/repositories/identity.repository";

export const dynamic = "force-dynamic";

export async function GET() {
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

    // Fetch active and candidate traits
    const activeTraits = await IdentityRepository.findActiveByUser(user.firebaseUid);
    const candidateTraits = await IdentityRepository.findCandidatesByUser(user.firebaseUid);

    // Group active traits by category
    const coreIdentity = activeTraits.filter((t) => t.category === "core_identity");
    const aspirations = activeTraits.filter((t) => t.category === "aspiration");
    const principles = activeTraits.filter((t) => t.category === "principle");
    const patterns = activeTraits.filter((t) => t.category === "behavior_pattern");
    const currentState = activeTraits.filter((t) => t.category === "current_state");

    return NextResponse.json({
      success: true,
      profile: {
        coreIdentity,
        aspirations,
        principles,
        patterns,
        currentState,
        emergingTraits: candidateTraits,
      },
    });
  } catch (error) {
    console.error("GET /api/identity error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
