import { User } from "@/models/User";
import { Task, ITask } from "@/models/Task";
import { Goal } from "@/models/Goal";
import { WeeklyExecutionSchedule, IWeeklyExecutionSchedule } from "@/models/WeeklyExecutionSchedule";
import { CalendarSyncLog } from "@/models/CalendarSyncLog";
import { GoogleCalendarService, GoogleEventInput } from "./google-calendar.service";
import crypto from "crypto";

export class CalendarSyncService {
  private static activeDebounceTimers = new Map<string, NodeJS.Timeout>();

  static async queueSync(uid: string): Promise<void> {
    try {
      console.log(`[CalendarSyncService] Queueing 7-day sync for user ${uid} (debounced)...`);
      
      await User.updateOne(
        { firebaseUid: uid },
        {
          $set: {
            "googleCalendarSettings.calendarSyncPending": true,
            "googleCalendarSettings.lastSyncRequestAt": new Date()
          }
        }
      );

      if (this.activeDebounceTimers.has(uid)) {
        clearTimeout(this.activeDebounceTimers.get(uid)!);
        this.activeDebounceTimers.delete(uid);
      }

      const timer = setTimeout(async () => {
        try {
          await User.updateOne(
            { firebaseUid: uid },
            { $set: { "googleCalendarSettings.calendarSyncPending": false } }
          );

          const schedule = await WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" });

          if (schedule) {
            console.log(`[CalendarSyncService] Running debounced 7-day sync for user ${uid}`);
            await this.syncWeeklySchedule(uid, schedule);
          }
        } catch (err) {
          console.error(`[CalendarSyncService] Error in debounced background sync:`, err);
        } finally {
          this.activeDebounceTimers.delete(uid);
        }
      }, 8000);

      this.activeDebounceTimers.set(uid, timer);
    } catch (err) {
      console.error("[CalendarSyncService] Failed to queue calendar sync:", err);
    }
  }

  static async syncWeeklySchedule(uid: string, schedule: IWeeklyExecutionSchedule): Promise<any> {
    const startedAt = new Date();
    let eventsCreated = 0;
    let eventsUpdated = 0;
    let eventsDeleted = 0;
    let eventsSkipped = 0;
    let googleRequests = 0;
    let status: "success" | "failure" = "success";
    let error: string | undefined = undefined;

    try {
      const user = await User.findOne({ firebaseUid: uid });
      if (!user || !user.googleCalendarSettings?.connected) {
        return { skipped: true, reason: "Calendar not connected" };
      }

      const timezone = user.briefSettings?.timezone || "UTC";
      const activeEventIdsForWeek = new Set<string>();

      // Group tasks by work block and create/update block-level events
      for (const day of schedule.days) {
        for (const block of day.workBlocks) {
          const tasks = await Task.find({ _id: { $in: block.tasks } });
          
          const startStr = `${day.date}T${block.startTime}:00`;
          const endStr = `${day.date}T${block.endTime}:00`;

          // Determine priority color based on the highest priority task in the block
          let colorId = "1"; // Default Blue
          const maxPriority = tasks.length > 0 ? Math.max(...tasks.map(t => t.priority || 0)) : 0;
          if (maxPriority === 1) colorId = "11"; // Red
          else if (maxPriority === 2) colorId = "7"; // Peacock

          // Format checklist description
          const taskList = tasks
            .map(t => t.status === "completed" ? `[x] ${t.title}` : `[ ] ${t.title}`)
            .join("\n");
          const description = `**Suggested Work Block**\n\n**Tasks:**\n${taskList}`;

          const eventData: GoogleEventInput = {
            summary: `Zenkai: ${block.title}`,
            description,
            start: {
              dateTime: startStr,
              timeZone: timezone,
            },
            end: {
              dateTime: endStr,
              timeZone: timezone,
            },
            colorId
          };

          const eventHash = crypto.createHash("md5").update(JSON.stringify(eventData)).digest("hex");

          if (block.googleCalendarEventId && block.eventHash === eventHash) {
            activeEventIdsForWeek.add(block.googleCalendarEventId);
            eventsSkipped++;
            continue;
          }

          if (block.googleCalendarEventId) {
            try {
              await GoogleCalendarService.updateEvent(uid, block.googleCalendarEventId, eventData);
              block.eventHash = eventHash;
              activeEventIdsForWeek.add(block.googleCalendarEventId);
              eventsUpdated++;
              googleRequests++;
            } catch (e: any) {
              console.warn(`[CalendarSyncService] Failed to update event ${block.googleCalendarEventId}, recreating:`, e.message);
              const res = await GoogleCalendarService.createEvent(uid, eventData);
              block.googleCalendarEventId = res.id;
              block.eventHash = eventHash;
              activeEventIdsForWeek.add(res.id);
              eventsCreated++;
              googleRequests++;
            }
          } else {
            const res = await GoogleCalendarService.createEvent(uid, eventData);
            block.googleCalendarEventId = res.id;
            block.eventHash = eventHash;
            activeEventIdsForWeek.add(res.id);
            eventsCreated++;
            googleRequests++;
          }
        }
      }

      // Save schedule with updated event IDs and hashes
      if (typeof (schedule as any).markModified === "function") {
        (schedule as any).markModified("days");
        await (schedule as any).save();
      } else {
        const doc = await WeeklyExecutionSchedule.findById((schedule as any)._id || (schedule as any).scheduleId);
        if (doc) {
          doc.days = (schedule as any).days;
          doc.markModified("days");
          await doc.save();
        }
      }

      // ── Cleanup legacy task-level events ──
      const legacyTasks = await Task.find({
        firebaseUid: uid,
        googleCalendarEventId: { $ne: "" }
      });
      for (const t of legacyTasks) {
        try {
          await GoogleCalendarService.deleteEvent(uid, t.googleCalendarEventId!);
          eventsDeleted++;
        } catch (e: any) {
          console.warn("[CalendarSyncService] Legacy task event already deleted in Google Calendar:", e.message);
        }
        t.googleCalendarEventId = "";
        t.googleCalendarEventHash = "";
        await t.save();
      }

      // ── Cleanup obsolete block-level events ──
      const allSchedules = await WeeklyExecutionSchedule.find({ firebaseUid: uid });
      for (const sched of allSchedules) {
        let modified = false;
        for (const day of sched.days) {
          for (const block of day.workBlocks) {
            if (block.googleCalendarEventId && !activeEventIdsForWeek.has(block.googleCalendarEventId)) {
              try {
                await GoogleCalendarService.deleteEvent(uid, block.googleCalendarEventId);
                eventsDeleted++;
              } catch (e: any) {
                console.warn("[CalendarSyncService] Obsolete block event already deleted in Google Calendar:", e.message);
              }
              block.googleCalendarEventId = "";
              block.eventHash = "";
              modified = true;
            }
          }
        }
        if (modified) {
          sched.markModified("days");
          await sched.save();
        }
      }

      let totalSynced = 0;
      for (const sched of allSchedules) {
        for (const day of sched.days) {
          for (const block of day.workBlocks) {
            if (block.googleCalendarEventId) {
              totalSynced++;
            }
          }
        }
      }

      await User.updateOne(
        { firebaseUid: uid },
        { $set: { "googleCalendarSettings.syncedEventsCount": totalSynced } }
      );

      const { BehaviorEngine } = await import("@/services/behavior-engine.service");
      await BehaviorEngine.updateFromCalendar(uid).catch(err =>
        console.error("[CalendarSyncService] Failed to trigger behavior engine update:", err)
      );

    } catch (e: any) {
      console.error("[CalendarSyncService] Sync failed", e);
      status = "failure";
      error = e.message;
    }

    const log = new CalendarSyncLog({
      uid,
      startedAt,
      finishedAt: new Date(),
      duration: new Date().getTime() - startedAt.getTime(),
      eventsCreated,
      eventsUpdated,
      eventsDeleted,
      eventsSkipped,
      googleRequests,
      status,
      error
    });
    await log.save();

    return {
      success: status === "success",
      eventsCreated,
      eventsUpdated,
      eventsDeleted,
      eventsSkipped,
      error
    };
  }

  static async cleanObsoleteEvents(uid: string, planId: string): Promise<void> {
    try {
      const user = await User.findOne({ firebaseUid: uid }).lean();
      if (!user || !user.googleCalendarSettings?.connected) {
        return;
      }

      const goals = await Goal.find({ planId });
      const goalIds = goals.map(g => g._id);

      const tasks = await Task.find({
        firebaseUid: uid,
        goalId: { $in: goalIds },
        googleCalendarEventId: { $ne: "" }
      });

      for (const task of tasks) {
        if (task.googleCalendarEventId) {
          await GoogleCalendarService.deleteEvent(uid, task.googleCalendarEventId).catch(err => {
            console.error(`[CalendarSyncService] Failed to delete obsolete event ${task.googleCalendarEventId}:`, err);
          });
          await Task.updateOne(
            { _id: task._id },
            {
              $unset: {
                googleCalendarEventId: "",
                googleCalendarEventHash: "",
                googleCalendarConflict: "",
                googleCalendarConflictDetails: ""
              }
            }
          );
        }
      }

      const totalSynced = await Task.countDocuments({
        firebaseUid: uid,
        googleCalendarEventId: { $ne: null }
      });
      await User.updateOne(
        { firebaseUid: uid },
        { $set: { "googleCalendarSettings.syncedEventsCount": totalSynced } }
      );
    } catch (err) {
      console.error(`[CalendarSyncService] Error cleaning obsolete events for plan ${planId}:`, err);
    }
  }

  static async deleteEvent(uid: string, taskId: string): Promise<boolean> {
    try {
      const user = await User.findOne({ firebaseUid: uid });
      if (!user || !user.googleCalendarSettings?.connected) return false;

      const task = await Task.findById(taskId);
      if (!task || !task.googleCalendarEventId) return false;

      await GoogleCalendarService.deleteEvent(uid, task.googleCalendarEventId);
      
      await Task.updateOne(
        { _id: taskId },
        {
          $unset: {
            googleCalendarEventId: "",
            googleCalendarEventHash: "",
            googleCalendarConflict: "",
            googleCalendarConflictDetails: ""
          }
        }
      );

      return true;
    } catch (err) {
      console.error(`[CalendarSyncService] Failed to delete event manually for task ${taskId}:`, err);
      return false;
    }
  }
}
