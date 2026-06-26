import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { ReflectionRepository } from "@/repositories/reflection.repository";
import { ReflectionAgent } from "@/agents/reflection-agent";

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

    // Fetch active reflections
    const activeReflections = await ReflectionRepository.findActiveByUser(user.firebaseUid);
    
    // Fetch all reflections (active and deprecated) to construct a timeline/history
    const allReflections = await ReflectionRepository.findAllByUser(user.firebaseUid);

    return NextResponse.json({
      success: true,
      activeReflections,
      allReflections,
    });
  } catch (error) {
    console.error("GET /api/reflections error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST() {
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

    // Force run evaluation
    console.log(`[API] Manual trigger of reflection evaluation for: ${user.firebaseUid}`);
    const success = await ReflectionAgent.evaluateAndEvolve(user.firebaseUid);

    // Fetch newly updated reflections
    const activeReflections = await ReflectionRepository.findActiveByUser(user.firebaseUid);
    const allReflections = await ReflectionRepository.findAllByUser(user.firebaseUid);

    return NextResponse.json({
      success: true,
      evaluated: success,
      activeReflections,
      allReflections,
    });
  } catch (error) {
    console.error("POST /api/reflections error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
