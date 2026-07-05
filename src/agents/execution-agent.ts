import { WeeklyExecutionSchedule, IDaySchedule, IWorkBlock, WorkBlockOrigin } from "@/models/WeeklyExecutionSchedule";
import { provider } from "@/services/llm/provider";
import { ContextOrchestrator } from "@/services/context-orchestrator.service";
import { CalendarSyncService } from "@/services/calendar-sync.service";
import { timeToMinutes } from "@/services/ai-validation.service";
import mongoose from "mongoose";

export class ExecutionAgent {
  /**
   * Fetches today's exact schedule block from the WeeklyExecutionSchedule.
   * Does NOT generate anything. Fully deterministic.
   */
  static async getDailySchedule(uid: string, dateStr: string): Promise<IDaySchedule | null> {
    const schedule = await WeeklyExecutionSchedule.findOne({
      firebaseUid: uid,
      status: "ACTIVE"
    }).lean();

    if (!schedule) return null;

    const todayBlock = schedule.days.find(d => d.date === dateStr);
    return todayBlock || null;
  }

  /**
   * Called when tasks are manually added or deferred.
   * Updates the weekly schedule ONLY for the day being changed using Gemini.
   */
  static async rebalanceAgenda(uid: string, dateStr: string) {
    console.log(`[ExecutionAgent] Rebalancing schedule only for date ${dateStr} for user ${uid}`);
    
    try {
      const schedule = await WeeklyExecutionSchedule.findOne({
        firebaseUid: uid,
        status: "ACTIVE"
      });

      if (!schedule) {
        console.warn(`[ExecutionAgent] No active weekly schedule found to rebalance.`);
        return null;
      }

      const dayIdx = schedule.days.findIndex(d => d.date === dateStr);
      if (dayIdx === -1) {
        console.warn(`[ExecutionAgent] Day ${dateStr} not found in user's active schedule.`);
        return null;
      }

      const day = schedule.days[dayIdx];
      const existingBlocks = day.workBlocks;

      // 1. Load user context for preferences & commitments
      const workflowId = `rebalance-day-${uid}-${Date.now()}`;
      const context = await ContextOrchestrator.loadContext(
        uid,
        workflowId,
        `Rebalancing agenda for ${dateStr}`,
        undefined,
        "planning"
      );

      // 2. Instruct Gemini to rebalance the day's blocks around any overlaps
      const systemInstruction = `
You are the Daily Schedule Rebalancing Agent.
Your job is to resolve overlapping schedule blocks on a single day (${dateStr}) in a human-centric way.
You must preserve wake/sleep boundaries, fixed recurring commitments, and routine blocks (like Wake, Morning Routine, meals) at their exact original times.
If two blocks overlap:
- Shift other flexible or user-added blocks earlier or later within the user's available wake hours.
- Do NOT overlap any blocks.
- Ensure all times are formatted as HH:mm.
- Respond with a clean list of non-overlapping workBlocks for the day.
`;

      const prompt = `
We are rebalancing the schedule blocks for ${dateStr}.
Below is the current list of blocks for this day (which may contain overlaps due to a new or moved task):

${JSON.stringify(existingBlocks.map(b => ({
  title: b.title,
  startTime: b.startTime,
  endTime: b.endTime,
  duration: b.duration,
  priority: b.priority,
  origin: b.origin,
  tasks: (b.tasks || []).map(t => t.toString())
})), null, 2)}

User Profile & Preferences:
- Wake time: ${context.profile.wakeUpTime || "06:00"}
- Sleep time: ${context.profile.sleepTime || "22:00"}

Please rebalance these blocks to resolve all overlaps. Return a clean, non-overlapping array of workBlocks.
`;

      const schema = {
        type: "OBJECT",
        properties: {
          workBlocks: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                startTime: { type: "STRING" },
                endTime: { type: "STRING" },
                duration: { type: "INTEGER" },
                priority: { type: "INTEGER" },
                origin: { type: "STRING", enum: ["system", "user"] },
                tasks: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                }
              },
              required: ["title", "startTime", "endTime", "duration", "origin"]
            }
          }
        },
        required: ["workBlocks"]
      };

      const response = await provider.generate({
        prompt,
        systemInstruction,
        temperature: 0.15,
        responseMimeType: "application/json",
        responseSchema: schema as any
      });

      if (!response.text) {
        throw new Error("Gemini returned empty rebalanced workBlocks");
      }

      const result = JSON.parse(response.text);
      if (result && Array.isArray(result.workBlocks)) {
        // Map back to schedule day
        const updatedBlocks = result.workBlocks.map((wb: any) => ({
          title: wb.title,
          startTime: wb.startTime,
          endTime: wb.endTime,
          duration: wb.duration || Math.max(0, timeToMinutes(wb.endTime) - timeToMinutes(wb.startTime)),
          priority: wb.priority ?? 0,
          origin: (wb.origin || "user") as WorkBlockOrigin,
          tasks: (wb.tasks || []).map((tid: string) => {
            try {
              return new mongoose.Types.ObjectId(tid);
            } catch {
              return null;
            }
          }).filter(Boolean)
        }));

        // Sort blocks by start time
        updatedBlocks.sort((a: any, b: any) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

        // Update schedule day
        day.workBlocks = updatedBlocks as any;
        await schedule.save();

        console.log(`[ExecutionAgent] Day ${dateStr} successfully rebalanced with ${updatedBlocks.length} blocks.`);
        
        // Queue calendar sync
        CalendarSyncService.queueSync(uid).catch(err => console.error("[ExecutionAgent] Sync failed:", err));
        
        return schedule;
      }
    } catch (error) {
      console.error("[ExecutionAgent] Failed to rebalance agenda:", error);
    }
    return null;
  }
}
