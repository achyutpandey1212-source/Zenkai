import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { PendingActionService } from "@/services/pending-action.service";
import { SchedulePatchService } from "@/services/schedule-patch.service";
import { CalendarSyncService } from "@/services/calendar-sync.service";
import { MessageRepository } from "@/repositories/message.repository";
import { ExecutionAgent } from "@/agents/execution-agent";
import { Task } from "@/models/Task";
import { WeeklyExecutionSchedule } from "@/models/WeeklyExecutionSchedule";
import { PlanningAgent } from "@/agents/planning-agent";
import { dbConnect } from "@/lib/mongodb";

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
    const { actionId, decision, conversationId } = body;

    if (!decision || !conversationId) {
      return NextResponse.json({ success: false, error: "decision and conversationId are required" }, { status: 400 });
    }

    await dbConnect();

    // Fetch active action
    const pendingAction = await PendingActionService.getActive(conversationId);
    if (!pendingAction) {
      return NextResponse.json({ success: false, error: "No active pending action found for this conversation" }, { status: 404 });
    }

    const uid = user.firebaseUid;

    if (decision === "no") {
      console.log(`[Command] Decline pending action. Clearing.`);
      await PendingActionService.clear(conversationId);
      
      // Add decline feedback message to the chat history
      await MessageRepository.addMessage(conversationId, "user", "No");
      await MessageRepository.addMessage(conversationId, "assistant", "Okay, nothing was changed.");
      
      return NextResponse.json({
        success: true,
        message: "Okay, nothing was changed.",
        actionCleared: true
      });
    }

    if (decision === "later") {
      console.log(`[Command] Postpone pending action decision.`);
      // Add postpone message to history without clearing
      await MessageRepository.addMessage(conversationId, "user", "Maybe Later");
      await MessageRepository.addMessage(conversationId, "assistant", "Okay, I'll keep this suggestion ready. You can decide whenever you are ready.");
      
      return NextResponse.json({
        success: true,
        message: "Okay, I'll keep this suggestion ready. You can decide whenever you are ready.",
        actionCleared: false
      });
    }

    if (decision === "yes" || decision === "replace" || decision === "reorganize") {
      console.log(`[Command] Confirming pending action: ${pendingAction.type} with decision: ${decision}`);
      const scheduleOp = pendingAction.payload.scheduleOperation;
      let executed = false;
      let feedbackMessage = "";

      if (scheduleOp) {
        const op = scheduleOp as any;
        console.log(`[Command] scheduleOperation op.type=${op.type} date=${op.date}`);

        try {
          // 1. If decision is "replace", delete overlapping blocks first
          if (decision === "replace") {
            const conflictCheck = await SchedulePatchService.checkConflicts(
              uid, op.date,
              op.startTime || op.newStartTime,
              op.endTime || op.newEndTime
            );

            let actualConflicts = conflictCheck.conflicts;
            if (op.type === "move_block" || op.type === "resize_block") {
              actualConflicts = actualConflicts.filter(b => b.title !== op.blockTitle);
            }

            for (const conflict of actualConflicts) {
              console.log(`[Command] Deleting conflicting block: ${conflict.title} on ${op.date}`);
              await SchedulePatchService.removeWorkBlock({ firebaseUid: uid, date: op.date, title: conflict.title });
            }
          }

          // 2. For plain "yes" — reject if a conflict still exists
          if (decision === "yes") {
            const conflictCheck = await SchedulePatchService.checkConflicts(
              uid, op.date,
              op.startTime || op.newStartTime,
              op.endTime || op.newEndTime
            );
            let actualConflicts = conflictCheck.conflicts;
            if (op.type === "move_block" || op.type === "resize_block") {
              actualConflicts = actualConflicts.filter(b => b.title !== op.blockTitle);
            }
            if (actualConflicts.length > 0 && op.type !== "delete_block") {
              return NextResponse.json({ success: false, error: "Cannot apply: slot still overlaps another block." }, { status: 409 });
            }
          }

          // 3. Apply the operation
          let patchResult: any = null;

          if (op.type === "add_block") {
            patchResult = await SchedulePatchService.addWorkBlock({
              firebaseUid: uid, date: op.date, title: op.title, startTime: op.startTime, endTime: op.endTime
            });
            feedbackMessage = `Added block **"${op.title}"** on **${op.date}** from **${op.startTime}** to **${op.endTime}**.`;

          } else if (op.type === "move_block") {
            patchResult = await SchedulePatchService.moveWorkBlock({
              firebaseUid: uid, date: op.date, title: op.blockTitle,
              newStartTime: op.startTime || op.newStartTime,
              newEndTime: op.endTime || op.newEndTime
            });
            feedbackMessage = `Moved block **"${op.blockTitle}"** to **${op.startTime || op.newStartTime} – ${op.endTime || op.newEndTime}**.`;

          } else if (op.type === "resize_block") {
            patchResult = await SchedulePatchService.resizeWorkBlock({
              firebaseUid: uid, date: op.date, title: op.blockTitle,
              newStartTime: op.startTime || op.newStartTime,
              newEndTime: op.endTime || op.newEndTime
            });
            feedbackMessage = `Resized block **"${op.blockTitle}"** to **${op.startTime || op.newStartTime} – ${op.endTime || op.newEndTime}**.`;

          } else if (op.type === "delete_block") {
            patchResult = await SchedulePatchService.removeWorkBlock({ firebaseUid: uid, date: op.date, title: op.blockTitle });
            feedbackMessage = `Removed block **"${op.blockTitle}"** from **${op.date}**.`;

          } else if (op.type === "create_task") {
            // Save task to DB — this is the success criterion
            const task = await Task.create({
              firebaseUid: uid,
              title: op.title,
              description: op.description || "",
              source: "USER",
              status: "todo",
              priority: op.priority ? Number(op.priority) : 3,
              estimatedMinutes: op.estimatedMinutes ? Number(op.estimatedMinutes) : undefined,
              suggestedDate: op.date,
              timeBlock: op.startTime && op.endTime ? `${op.startTime} - ${op.endTime}` : "",
            });

            // Best-effort: add a schedule block (may be null if date outside current week)
            const schedBlock = await SchedulePatchService.addWorkBlock({
              firebaseUid: uid, date: op.date, title: op.title,
              startTime: op.startTime, endTime: op.endTime,
              priority: op.priority ? Number(op.priority) : 3,
              tasks: [task._id]
            });

            patchResult = task; // task creation itself is success
            feedbackMessage = schedBlock
              ? `Created task **"${op.title}"** and scheduled it on **${op.date}** from **${op.startTime}** to **${op.endTime}**.`
              : `Created task **"${op.title}"** for **${op.date}**. It will appear in the schedule when that week begins.`;

          } else if (op.type === "edit_task") {
            let task = await Task.findOne({ title: op.blockTitle, firebaseUid: uid })
              ?? await Task.findOne({ title: op.title, firebaseUid: uid });

            if (!task) {
              return NextResponse.json({ success: false, error: `Task "${op.blockTitle || op.title}" not found.` }, { status: 404 });
            }

            const updates: Record<string, any> = {};
            if (op.title) updates.title = op.title;
            if (op.description) updates.description = op.description;
            if (op.priority) updates.priority = Number(op.priority);
            if (op.estimatedMinutes) updates.estimatedMinutes = Number(op.estimatedMinutes);
            if (op.date) updates.suggestedDate = op.date;
            if (op.startTime && op.endTime) updates.timeBlock = `${op.startTime} - ${op.endTime}`;

            await Task.findByIdAndUpdate(task._id, { $set: updates });

            // Remove stale schedule blocks for this task
            const schedule = await WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" });
            if (schedule) {
              let modified = false;
              for (const day of schedule.days) {
                const idx = day.workBlocks.findIndex(b => b.tasks.some(tid => tid.toString() === task!._id.toString()));
                if (idx !== -1) { day.workBlocks.splice(idx, 1); modified = true; }
              }
              if (modified) await schedule.save();
            }

            // Re-add block at new time
            await SchedulePatchService.addWorkBlock({
              firebaseUid: uid, date: op.date,
              title: op.title || task.title,
              startTime: op.startTime, endTime: op.endTime,
              priority: op.priority ? Number(op.priority) : task.priority,
              tasks: [task._id]
            });

            patchResult = task;
            feedbackMessage = `Updated task **"${op.title || task.title}"** and rescheduled to **${op.date}** from **${op.startTime}** to **${op.endTime}**.`;
          }

          // 4. "reorganize" → trigger background Gemini rebalance for the day
          if (decision === "reorganize" && patchResult) {
            console.log(`[Command] Triggering background rebalance for ${op.date}`);
            ExecutionAgent.rebalanceAgenda(uid, op.date).catch(err =>
              console.error("[Command] Rebalance failed:", err)
            );
            feedbackMessage += ` Zen is rebalancing your schedule in the background.`;
          }

          if (patchResult) {
            executed = true;
            await PendingActionService.clear(conversationId);
            CalendarSyncService.queueSync(uid).catch(err => console.error("[Command] Sync failed:", err));
            const userLabel = decision === "replace" ? "Replace Block" : decision === "reorganize" ? "Move Everything Else" : "Yes";
            await MessageRepository.addMessage(conversationId, "user", userLabel);
            await MessageRepository.addMessage(conversationId, "assistant", feedbackMessage);
          }

        } catch (opErr: any) {
          console.error("[Command] Execution error:", opErr);
          return NextResponse.json({ success: false, error: opErr?.message || "Execution failed" }, { status: 500 });
        }
      }

      if (!executed) {
        console.error("[Command] Nothing executed. Payload:", JSON.stringify(pendingAction.payload));
        return NextResponse.json({ success: false, error: "No matching operation handler found." }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: feedbackMessage, actionCleared: true });
    }

    return NextResponse.json({ success: false, error: "Invalid decision value" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/actions/confirm Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
