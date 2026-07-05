import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { PendingActionService } from "@/services/pending-action.service";
import { SchedulePatchService } from "@/services/schedule-patch.service";
import { CalendarSyncService } from "@/services/calendar-sync.service";
import { MessageRepository } from "@/repositories/message.repository";
import { ExecutionAgent } from "@/agents/execution-agent";
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
        
        // 1. If decision is "replace", delete overlapping blocks first
        if (decision === "replace") {
          const conflictCheck = await SchedulePatchService.checkConflicts(
            uid,
            op.date,
            op.startTime || op.newStartTime!,
            op.endTime || op.newEndTime!
          );
          
          let actualConflicts = conflictCheck.conflicts;
          if (op.type === "move_block" || op.type === "resize_block") {
            actualConflicts = actualConflicts.filter(b => b.title !== op.blockTitle);
          }

          for (const conflict of actualConflicts) {
            console.log(`[Command] Deleting conflicting block: ${conflict.title} on ${op.date}`);
            await SchedulePatchService.removeWorkBlock({
              firebaseUid: uid,
              date: op.date,
              title: conflict.title
            });
          }
        }

        // 2. Run normal conflict check for "yes" (fail if conflict exists)
        if (decision === "yes") {
          const conflictCheck = await SchedulePatchService.checkConflicts(
            uid,
            op.date,
            op.startTime || op.newStartTime!,
            op.endTime || op.newEndTime!
          );
          
          let actualConflicts = conflictCheck.conflicts;
          if (op.type === "move_block" || op.type === "resize_block") {
            actualConflicts = actualConflicts.filter(b => b.title !== op.blockTitle);
          }

          if (actualConflicts.length > 0 && op.type !== "delete_block") {
            return NextResponse.json({
              success: false,
              error: "Cannot apply changes: time slot overlaps with another scheduled block."
            }, { status: 409 });
          }
        }

        // 3. Apply the patch
        let patchResult = null;
        if (op.type === "add_block") {
          patchResult = await SchedulePatchService.addWorkBlock({
            firebaseUid: uid,
            date: op.date,
            title: op.title!,
            startTime: op.startTime!,
            endTime: op.endTime!
          });
          feedbackMessage = `Added work block **"${op.title}"** to **${op.date}** from **${op.startTime}** to **${op.endTime}**.`;
        } else if (op.type === "move_block") {
          patchResult = await SchedulePatchService.moveWorkBlock({
            firebaseUid: uid,
            date: op.date,
            title: op.blockTitle!,
            newStartTime: op.startTime || op.newStartTime!,
            newEndTime: op.endTime || op.newEndTime!
          });
          feedbackMessage = `Moved block **"${op.blockTitle}"** on **${op.date}** to **${op.startTime || op.newStartTime} - ${op.endTime || op.newEndTime}**.`;
        } else if (op.type === "resize_block") {
          patchResult = await SchedulePatchService.resizeWorkBlock({
            firebaseUid: uid,
            date: op.date,
            title: op.blockTitle!,
            newStartTime: op.startTime || op.newStartTime!,
            newEndTime: op.endTime || op.newEndTime!
          });
          feedbackMessage = `Resized block **"${op.blockTitle}"** on **${op.date}** to **${op.startTime || op.newStartTime} - ${op.endTime || op.newEndTime}**.`;
        } else if (op.type === "delete_block") {
          patchResult = await SchedulePatchService.removeWorkBlock({
            firebaseUid: uid,
            date: op.date,
            title: op.blockTitle
          });
          feedbackMessage = `Removed block **"${op.blockTitle}"** from **${op.date}**.`;
        }

        // 4. If decision is "reorganize", trigger Gemini rebalance in the background
        if (decision === "reorganize" && patchResult) {
          console.log(`[Command] Reorganizing schedule using Gemini weekly replanning`);
          ExecutionAgent.rebalanceAgenda(uid, op.date).catch(err =>
            console.error("[Command] Failed to trigger background rebalance:", err)
          );
          feedbackMessage += ` Zen is rebalancing the rest of your day in the background.`;
        }

        if (patchResult) {
          executed = true;
          await PendingActionService.clear(conversationId);
          console.log(`[Command] Pending action confirmed & executed successfully.`);
          
          // Trigger calendar synchronization in the background
          CalendarSyncService.queueSync(uid).catch(err => console.error("[Command] Sync failed:", err));

          // Log transaction messages
          await MessageRepository.addMessage(conversationId, "user", decision === "replace" ? "Replace Block" : decision === "reorganize" ? "Move Everything Else" : "Yes");
          await MessageRepository.addMessage(conversationId, "assistant", feedbackMessage);
        }
      }

      if (!executed) {
        return NextResponse.json({ success: false, error: "Failed to apply suggested changes" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: feedbackMessage,
        actionCleared: true
      });
    }

    return NextResponse.json({ success: false, error: "Invalid decision value" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/actions/confirm Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
