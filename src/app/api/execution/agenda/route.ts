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

    // STEP 0: Raw check - does schedule have tasks?
    console.log("[RAW] User firebaseUid:", user.firebaseUid);
    const checkRaw = await WeeklyExecutionSchedule.findOne({
      firebaseUid: user.firebaseUid,
      status: "ACTIVE"
    }).select("days.workBlocks.tasks").lean();
    
    console.log("[RAW] Raw document found:", !!checkRaw);
    console.log("[RAW] days exists:", !!checkRaw?.days);
    console.log("[RAW] days[0].workBlocks exists:", !!checkRaw?.days?.[0]?.workBlocks);
    if (checkRaw?.days?.[0]?.workBlocks?.[0]) {
      console.log("[RAW] days[0].workBlocks[0].tasks:", checkRaw.days[0].workBlocks[0].tasks);
    }

    // Fetch active WeeklyExecutionSchedule
    const schedule = await WeeklyExecutionSchedule.findOne({
      firebaseUid: user.firebaseUid,
      status: "ACTIVE"
    }).populate("days.workBlocks.tasks");

    // EXPERIMENT: Check if populate works without lean()
    console.log("[EXPERIMENT] After populate (without lean):");
    if (schedule?.days?.[0]?.workBlocks?.[0]) {
      const wb = schedule.days[0].workBlocks[0];
      console.log("[EXPERIMENT] workBlocks[0].tasks type:", typeof wb.tasks);
      console.log("[EXPERIMENT] workBlocks[0].tasks is array:", Array.isArray(wb.tasks));
      console.log("[EXPERIMENT] workBlocks[0].tasks:", JSON.stringify(wb.tasks, null, 2));
    }

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

    if (!schedule || !schedule._id) {
      return NextResponse.json({ success: false, error: "Weekly schedule generation failed. Check server logs." }, { status: 500 });
    }

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
