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

    // Fetch all traits (active, candidate, deprecated) for the timeline
    const allTraits = await IdentityRepository.findAllByUser(user.firebaseUid);

    // Format timeline items
    const timeline = allTraits.map((t) => ({
      id: t._id.toString(),
      trait: t.trait,
      category: t.category,
      description: t.description,
      confidence: t.confidence,
      stability: t.stability,
      version: t.version,
      status: t.status,
      updatedAt: t.updatedAt,
      createdAt: t.createdAt,
      evidence: t.evidence,
    }));

    return NextResponse.json({ success: true, timeline });
  } catch (error) {
    console.error("GET /api/identity/timeline error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
