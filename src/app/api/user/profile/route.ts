import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { ProfileRepository } from "@/repositories/profile.repository";

/**
 * GET /api/user/profile
 *
 * Returns the authenticated user's profile from MongoDB.
 * Used by the Home Screen to load persisted onboarding data
 * instead of reading from localStorage.
 *
 * Response:
 * {
 *   success: true,
 *   profile: {
 *     firebaseUid: string;
 *     profession: string;
 *     longTermGoal: string;
 *     currentFocus: string;
 *     motivation: string;
 *     dailyAvailability: string;
 *     workStyle: string;
 *     biggestChallenge: string;
 *     timezone?: string;
 *     createdAt: string;
 *     updatedAt: string;
 *   }
 * }
 */
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

    const profile = await ProfileRepository.findByFirebaseUid(user.firebaseUid);

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, profile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("GET /api/user/profile error:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

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
    const profile = await ProfileRepository.upsert({
      ...body,
      firebaseUid: user.firebaseUid,
    });

    return NextResponse.json({ success: true, profile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("POST /api/user/profile error:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
