import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { ReflectionRepository } from "@/repositories/reflection.repository";
import { dbConnect } from "@/lib/mongodb";
import { CurrentStateService } from "@/services/current-state.service";
import { Goal } from "@/models/Goal";
import { Task } from "@/models/Task";

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

    // Fetch the single source of truth workspace state
    const state = await CurrentStateService.getCurrentState(user.firebaseUid);

    // Get recent active reflection
    const activeReflections = await ReflectionRepository.findActiveByUser(user.firebaseUid);
    const recentReflection = activeReflections.length > 0 ? activeReflections[0] : null;

    // Gather priorities (today's agenda tasks or fallback to milestone tasks)
    let priorities: any[] = [];
    if (state.todayAgenda) {
      const agendaTasks: any[] = [];
      state.todayAgenda.workBlocks.forEach((wb: any) => wb.tasks.forEach((t: any) => {
        if (t) agendaTasks.push(t);
      }));
      state.todayAgenda.optionalTasks.forEach((t: any) => {
        if (t) agendaTasks.push(t);
      });
      state.todayAgenda.stretchGoals.forEach((t: any) => {
        if (t) agendaTasks.push(t);
      });
      priorities = agendaTasks;
    } else if (state.activePlan) {
      const goalIds = state.activeGoals.map(g => g._id);
      if (state.activeMilestone) {
        const milestoneGoals = await Goal.find({ milestoneId: state.activeMilestone._id });
        const milestoneGoalIds = milestoneGoals.map(g => g._id);
        priorities = await Task.find({
          goalId: { $in: milestoneGoalIds },
          status: { $in: ["todo", "in_progress"] }
        }).sort({ priority: 1 }).limit(3).lean();
      } else {
        priorities = await Task.find({
          goalId: { $in: goalIds },
          status: { $in: ["todo", "in_progress"] }
        }).sort({ priority: 1 }).limit(3).lean();
      }
    }

    return NextResponse.json({
      success: true,
      proactiveData: {
        currentGoal: state.activePlan ? state.activePlan.title : null,
        activeMilestone: state.activeMilestone ? {
          _id: state.activeMilestone._id.toString(),
          title: state.activeMilestone.title,
          progress: state.activeMilestone.progress || 0,
          category: state.activeMilestone.category || "Personal",
          startDate: state.activeMilestone.startDate,
          endDate: state.activeMilestone.endDate,
          estimatedDuration: state.activeMilestone.estimatedDuration
        } : null,
        upcomingHardConstraint: state.upcomingDeadline ? { title: state.upcomingDeadline } : null,
        planProgress: state.activePlan ? state.activePlan.progress : 0,
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
