import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { PlanRepository } from "@/repositories/plan.repository";
import { PlanningAgent } from "@/agents/planning-agent";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const planTree = await PlanRepository.findFullTree(user.firebaseUid);

    return NextResponse.json({
      success: true,
      plans: planTree,
    });
  } catch (error) {
    console.error("GET /api/plans error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { goalTitle, planType } = body;

    if (!goalTitle) {
      return NextResponse.json({ success: false, error: "goalTitle is required" }, { status: 400 });
    }

    const intent = {
      type: "create_or_modify" as const,
      planType: planType || "personal",
      goalTitle,
    };

    const success = await PlanningAgent.generateOrEvolvePlan(user.firebaseUid, intent, `Generate a plan for: ${goalTitle}`);

    if (success) {
      const planTree = await PlanRepository.findFullTree(user.firebaseUid);
      return NextResponse.json({ success: true, plans: planTree });
    } else {
      return NextResponse.json({ success: false, error: "Failed to generate plan structure" }, { status: 500 });
    }
  } catch (error) {
    console.error("POST /api/plans error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
