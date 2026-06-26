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
    let activeMilestone = null;
    let upcomingHardConstraint = null;
    let priorities: any[] = [];
    let planProgress = activePlan ? activePlan.progress : 0;

    if (activePlan) {
      // 2. Get current active milestone
      const milestone = await Milestone.findOne({
        planId: activePlan._id,
        status: "in_progress"
      }) || await Milestone.findOne({
        planId: activePlan._id,
        status: "todo"
      }).sort({ priority: 1 });

      if (milestone) {
        activeMilestone = {
          _id: milestone._id.toString(),
          title: milestone.title,
          progress: milestone.progress || 0,
          category: milestone.category || "Personal",
          startDate: milestone.startDate,
          endDate: milestone.endDate,
          estimatedDuration: milestone.estimatedDuration
        };
      }

      // 3. Find today's planned tasks
      const planGoals = await Goal.find({ planId: activePlan._id });
      const goalIds = planGoals.map(g => g._id);
      
      const todayStr = new Date().toISOString().split("T")[0];
      let todayTasks = await Task.find({
        goalId: { $in: goalIds },
        suggestedDate: todayStr
      }).sort({ priority: 1 }).lean();

      if (todayTasks.length === 0) {
        // Fallback: top 3 unfinished tasks of active milestone or plan
        if (milestone) {
          const milestoneGoals = await Goal.find({ milestoneId: milestone._id });
          const milestoneGoalIds = milestoneGoals.map(g => g._id);
          todayTasks = await Task.find({
            goalId: { $in: milestoneGoalIds },
            status: { $in: ["todo", "in_progress"] }
          }).sort({ priority: 1 }).limit(3).lean();
        } else {
          todayTasks = await Task.find({
            goalId: { $in: goalIds },
            status: { $in: ["todo", "in_progress"] }
          }).sort({ priority: 1 }).limit(3).lean();
        }
      }

      priorities = todayTasks;

      // 4. Get next upcoming hard constraint (Exam or Interview)
      const hardConstraint = await Milestone.findOne({
        planId: activePlan._id,
        category: { $in: ["Exam", "Interview"] },
        status: { $in: ["todo", "in_progress"] }
      }).sort({ startDate: 1, priority: 1 });

      if (hardConstraint) {
        upcomingHardConstraint = {
          _id: hardConstraint._id.toString(),
          title: hardConstraint.title,
          category: hardConstraint.category,
          startDate: hardConstraint.startDate,
          endDate: hardConstraint.endDate
        };
      }
    }

    // 5. Get recent active reflection
    const activeReflections = await ReflectionRepository.findActiveByUser(user.firebaseUid);
    const recentReflection = activeReflections.length > 0 ? activeReflections[0] : null;

    return NextResponse.json({
      success: true,
      proactiveData: {
        currentGoal,
        activeMilestone,
        upcomingHardConstraint,
        planProgress,
        priorities: priorities.map(p => ({
          id: p._id.toString(),
          title: p.title,
          status: p.status,
          priority: p.priority,
          suggestedDate: p.suggestedDate,
          timeBlock: p.timeBlock,
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
