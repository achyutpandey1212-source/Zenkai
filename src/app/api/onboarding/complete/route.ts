import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { ProfileRepository } from "@/repositories/profile.repository";
import { UserRepository } from "@/repositories/user.repository";

/**
 * POST /api/onboarding/complete
 *
 * Persists onboarding data to MongoDB and marks the user's
 * onboardingCompleted flag as true. Called when the onboarding
 * wizard finishes.
 *
 * Body:
 * {
 *   name: string;
 *   profession: string;
 *   longTermGoal: string;
 *   currentFocus: string;
 *   motivation: string;
 *   dailyAvailability: string;
 *   workStyle: string;
 *   biggestChallenge: string;
 * }
 */
export async function POST(request: Request) {
  try {
    // Verify the user's session
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

    // Parse the onboarding payload
    const body = await request.json();
    const {
      name,
      profession,
      longTermGoal,
      currentFocus,
      motivation,
      dailyAvailability,
      workStyle,
      biggestChallenge,
      roles,
      focusAreas,
      productivityChallenges,
    } = body;

    // Validate required fields
    if (!profession || !longTermGoal || !currentFocus) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: profession, longTermGoal, currentFocus",
        },
        { status: 400 }
      );
    }

    const uid = user.firebaseUid;

    // Run upsert + user update in parallel
    await Promise.all([
      // 1. Create or update profile document
      ProfileRepository.upsert({
        firebaseUid: uid,
        profession,
        longTermGoal,
        currentFocus,
        motivation: motivation ?? "",
        dailyAvailability: dailyAvailability ?? "",
        workStyle: workStyle ?? "",
        biggestChallenge: biggestChallenge ?? "",
        roles: roles || [],
        focusAreas: focusAreas || [],
        productivityChallenges: productivityChallenges || [],
      }),
      // 2. Update user name if provided, and mark onboarding complete
      name ? UserRepository.updateName(uid, name) : Promise.resolve(),
      UserRepository.markOnboardingComplete(uid),
    ]);

    return NextResponse.json({
      success: true,
      message: "Onboarding data saved successfully",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("POST /api/onboarding/complete error:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
