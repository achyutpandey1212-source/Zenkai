import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { Task } from "@/models/Task";
import { ExecutionAgent } from "@/agents/execution-agent";
import { PlanningAgent } from "@/agents/planning-agent";
import { dbConnect } from "@/lib/mongodb";
import { Types } from "mongoose";
import { BehaviorEngine } from "@/services/behavior-engine.service";

export const dynamic = "force-dynamic";

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
    const { taskId, action, date, newDate } = body;

    if (!taskId || !Types.ObjectId.isValid(taskId)) {
      return NextResponse.json({ success: false, error: "Invalid or missing taskId" }, { status: 400 });
    }

    const targetDate = date || new Date().toISOString().split("T")[0];

    await dbConnect();

    const task = await Task.findOne({ _id: new Types.ObjectId(taskId), firebaseUid: user.firebaseUid });
    if (!task) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
    }

    if (action === "complete") {
      task.status = "completed";
      task.completedAt = new Date();
      task.lastExecutedAt = new Date();
      await task.save();
      // Recalculate progress for the planning structure recursively
      await PlanningAgent.recalculateProgress(user.firebaseUid, taskId);

      // Notify BehaviorEngine
      await BehaviorEngine.updateFromTaskCompletion(user.firebaseUid, taskId).catch(err =>
        console.error("[TaskActionRoute] Failed to update behavior profile from completion:", err)
      );
    } else if (action === "defer") {
      // Defer: increment deferredCount, move to tomorrow
      const tomorrow = new Date(targetDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      task.status = "deferred";
      task.suggestedDate = tomorrowStr;
      task.deferredCount = (task.deferredCount || 0) + 1;
      task.lastExecutedAt = new Date();
      await task.save();
    } else if (action === "skip") {
      task.status = "skipped";
      task.lastExecutedAt = new Date();
      await task.save();

      // Notify BehaviorEngine
      await BehaviorEngine.updateFromTaskSkip(user.firebaseUid, taskId).catch(err =>
        console.error("[TaskActionRoute] Failed to update behavior profile from skip:", err)
      );
    } else if (action === "reschedule") {
      if (!newDate) {
        return NextResponse.json({ success: false, error: "newDate is required for rescheduling" }, { status: 400 });
      }
      task.status = "todo";
      task.suggestedDate = newDate;
      task.deferredCount = 0; // Reset deferred count on manual reschedule
      task.lastExecutedAt = new Date();
      await task.save();
    } else if (action === "remove") {
      // Remove task (delete it from plan)
      await Task.findByIdAndDelete(taskId);
      // Recalculate progress
      if (task.goalId) {
        await PlanningAgent.recalculateProgress(user.firebaseUid, taskId);
      }
    } else {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    // Trigger daily agenda rebalancing for today
    const updatedAgenda = await ExecutionAgent.rebalanceAgenda(user.firebaseUid, targetDate);

    return NextResponse.json({
      success: true,
      agenda: updatedAgenda
    });
  } catch (error) {
    console.error("POST /api/execution/task-action error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
