import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { WeeklyExecutionSchedule } from "@/models/WeeklyExecutionSchedule";
import { dbConnect } from "@/lib/mongodb";
import { PlanningAgent } from "@/agents/planning-agent";
import { PlanRepository } from "@/repositories/plan.repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

    await dbConnect();

    // Fetch active WeeklyExecutionSchedule
    const schedule = await WeeklyExecutionSchedule.findOne({
      firebaseUid: user.firebaseUid,
      status: "ACTIVE"
    }).populate("days.workBlocks.tasks").lean();

    return NextResponse.json({
      success: true,
      weeklySchedule: schedule
    });
  } catch (error) {
    console.error("GET /api/execution/agenda error:", error);
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

    await dbConnect();

    // Find the active plan
    const activePlans = await PlanRepository.findFullTree(user.firebaseUid);
    if (!activePlans || activePlans.length === 0) {
      return NextResponse.json({ success: false, error: "No active plan" }, { status: 400 });
    }
    const activePlan = activePlans[0];

    // Force regeneration of weekly schedule
    const schedule = await PlanningAgent.generateWeeklySchedule(user.firebaseUid, activePlan._id.toString());
    
    // We need to fetch it again with tasks populated
    const populatedSchedule = await WeeklyExecutionSchedule.findById(schedule._id)
      .populate("days.workBlocks.tasks").lean();

    return NextResponse.json({
      success: true,
      weeklySchedule: populatedSchedule
    });
  } catch (error) {
    console.error("POST /api/execution/agenda error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
