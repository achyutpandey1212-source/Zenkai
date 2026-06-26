import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { Plan } from "@/models/Plan";
import { Milestone } from "@/models/Milestone";
import { Goal } from "@/models/Goal";
import { Task } from "@/models/Task";
import { ReflectionRepository } from "@/repositories/reflection.repository";
import { dbConnect } from "@/lib/mongodb";

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

    await dbConnect();

    // 1. Get active plan
    const activePlan = await Plan.findOne({ firebaseUid: user.firebaseUid, status: "active" })
      .sort({ updatedAt: -1 });

    let currentGoal = activePlan ? activePlan.title : null;
    let nextMilestone = null;
    let priorities: any[] = [];

    if (activePlan) {
      // 2. Get next unfinished milestone
      const milestone = await Milestone.findOne({
        planId: activePlan._id,
        status: { $in: ["todo", "in_progress"] }
      }).sort({ priority: 1 });

      if (milestone) {
        nextMilestone = milestone.title;

        // 3. Get top priorities under this milestone
        const milestoneGoals = await Goal.find({ milestoneId: milestone._id });
        const goalIds = milestoneGoals.map(g => g._id);

        priorities = await Task.find({
          goalId: { $in: goalIds },
          status: { $in: ["todo", "in_progress"] }
        })
          .sort({ priority: 1, createdAt: 1 })
          .limit(3)
          .lean();
      } else {
        // Fallback: search tasks under any goal of this plan
        const planGoals = await Goal.find({ planId: activePlan._id });
        const goalIds = planGoals.map(g => g._id);
        priorities = await Task.find({
          goalId: { $in: goalIds },
          status: { $in: ["todo", "in_progress"] }
        })
          .sort({ priority: 1, createdAt: 1 })
          .limit(3)
          .lean();
      }
    }

    // 4. Get recent active reflection
    const activeReflections = await ReflectionRepository.findActiveByUser(user.firebaseUid);
    const recentReflection = activeReflections.length > 0 ? activeReflections[0] : null;

    return NextResponse.json({
      success: true,
      proactiveData: {
        currentGoal,
        nextMilestone,
        priorities: priorities.map(p => ({
          id: p._id.toString(),
          title: p.title,
          status: p.status,
          priority: p.priority,
          estimatedDuration: p.estimatedDuration || (p.estimatedMinutes ? `${p.estimatedMinutes}m` : "") || "30m"
        })),
        recentReflection: recentReflection ? {
          title: recentReflection.title,
          summary: recentReflection.summary,
          category: recentReflection.category
        } : null
      }
    });
  } catch (error) {
    console.error("GET /api/plans/proactive error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
