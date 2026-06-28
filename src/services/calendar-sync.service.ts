import { User } from "@/models/User";
import { Task, ITask } from "@/models/Task";
import { Goal } from "@/models/Goal";
import { Milestone } from "@/models/Milestone";
import { CalendarSyncLog } from "@/models/CalendarSyncLog";
import { GoogleCalendarService, GoogleEventInput } from "./google-calendar.service";
import crypto from "crypto";
import { IDailyAgenda } from "@/models/DailyAgenda";

export class CalendarSyncService {
  // Map to track active in-memory debouncer timeouts per user UID
  private static activeDebounceTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Queue a synchronization run. Debounces execution by 8 seconds.
   * If a sync is already queued, the timer is reset.
   */
  static async queueSync(uid: string): Promise<void> {
    try {
      console.log(`[CalendarSyncService] Queueing sync for user ${uid} (debounced)...`);
      
      // Update pending status and timestamp in MongoDB
      await User.updateOne(
        { firebaseUid: uid },
        {
          $set: {
            "googleCalendarSettings.calendarSyncPending": true,
            "googleCalendarSettings.lastSyncRequestAt": new Date()
          }
        }
      );

      // Cancel any existing debounce timer
      if (this.activeDebounceTimers.has(uid)) {
        clearTimeout(this.activeDebounceTimers.get(uid)!);
        this.activeDebounceTimers.delete(uid);
      }

      // Start new debounce timer (8 seconds delay)
      const timer = setTimeout(async () => {
        try {
          // Clear pending flag in database
          await User.updateOne(
            { firebaseUid: uid },
            { $set: { "googleCalendarSettings.calendarSyncPending": false } }
          );

          // Get timezone-appropriate local YYYY-MM-DD date
          const user = await User.findOne({ firebaseUid: uid }).lean();
          const timezone = user?.briefSettings?.timezone || "UTC";
          const localDateStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone }); // returns YYYY-MM-DD format

          // Load latest agenda
          const { DailyAgendaRepository } = await import("@/repositories/daily-agenda.repository");
          const agenda = await DailyAgendaRepository.findByUserAndDate(uid, localDateStr);

          if (agenda) {
            console.log(`[CalendarSyncService] Running debounced sync for user ${uid} on date ${localDateStr}`);
            await this.syncAgenda(uid, agenda);
          } else {
            console.log(`[CalendarSyncService] No agenda found for user ${uid} on date ${localDateStr} to sync.`);
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

  /**
   * Sync today's agenda tasks to Google Calendar.
   * Produces sync operations (create, update, delete) and performs conflict checks.
   */
  static async syncAgenda(uid: string, agenda: IDailyAgenda): Promise<any> {
    const startedAt = new Date();
    let eventsCreated = 0;
    let eventsUpdated = 0;
    let eventsDeleted = 0;
    let eventsSkipped = 0;
    let googleRequests = 0;
    let status: "success" | "failure" = "success";
    let error: string | undefined = undefined;
    let duration = 0;

    try {
      // 1. Fetch User and check settings
      const user = await User.findOne({ firebaseUid: uid });
      if (!user || !user.googleCalendarSettings?.connected) {
        console.log(`Calendar not connected for user ${uid}. Skipping sync.`);
        return { skipped: true, reason: "Calendar not connected" };
      }

      const settings = user.googleCalendarSettings;
      const timezone = user.briefSettings?.timezone || "UTC";

      // 2. Identify all tasks in today's agenda work blocks
      const agendaTasksMap = new Map<string, { startTime: string; endTime: string; workBlockTitle: string }>();
      for (const block of agenda.workBlocks) {
        for (const taskOrId of block.tasks) {
          const taskIdStr = (taskOrId && typeof taskOrId === "object" && "_id" in (taskOrId as any))
            ? (taskOrId as any)._id.toString()
            : (taskOrId as any).toString();
          agendaTasksMap.set(taskIdStr, {
            startTime: block.startTime,
            endTime: block.endTime,
            workBlockTitle: block.title
          });
        }
      }

      // Fetch the tasks details
      const scheduledTaskIds = Array.from(agendaTasksMap.keys());
      const tasks = await Task.find({ _id: { $in: scheduledTaskIds } });

      // Fetch goals & milestones to build descriptions
      const goalIds = tasks.map(t => t.goalId?.toString()).filter(Boolean) as string[];
      const goals = await Goal.find({ _id: { $in: goalIds } });
      const milestoneIds = goals.map(g => g.milestoneId?.toString()).filter(Boolean) as string[];
      const milestones = await Milestone.find({ _id: { $in: milestoneIds } });

      // 3. Process CREATE and UPDATE operations
      for (const task of tasks) {
        const timeInfo = agendaTasksMap.get(task._id.toString())!;
        const startStr = `${agenda.date}T${timeInfo.startTime}:00`;
        const endStr = `${agenda.date}T${timeInfo.endTime}:00`;

        const goal = goals.find(g => g._id.toString() === task.goalId?.toString());
        const milestone = goal ? milestones.find(m => m._id.toString() === goal.milestoneId?.toString()) : null;

        // Build priority label
        let priorityLabel = "Low";
        if (task.priority === 1) priorityLabel = "High";
        else if (task.priority === 2) priorityLabel = "Medium";

        // Map priority to Google Calendar colorId
        // Google Colors: 11 = Tomato (High), 7 = Peacock (Medium), 1 = Lavender (Low)
        let colorId = "1";
        if (task.priority === 1) colorId = "11";
        else if (task.priority === 2) colorId = "7";

        // Deep link back into Zenkai
        const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const deepLink = `${appUrl}/app`; // Deep link back to dashboard

        // Build description
        const descParts = [
          "Generated by Zenkai",
          `Plan: ${goal?.title || "N/A"}`,
          `Milestone: ${milestone?.title || "N/A"}`,
          `Priority: ${priorityLabel}`,
          task.estimatedMinutes ? `Estimated Duration: ${task.estimatedMinutes} mins` : null,
          task.description ? `\nNotes:\n${task.description}` : null,
          `\nOpen Zenkai: ${deepLink}`
        ].filter(Boolean);

        const description = descParts.join("\n");

        // Construct event payload
        const eventInput: GoogleEventInput = {
          summary: task.title,
          description,
          start: {
            dateTime: startStr,
            timeZone: timezone
          },
          end: {
            dateTime: endStr,
            timeZone: timezone
          },
          colorId
        };

        // Create a unique hash for comparing changes
        const eventHash = crypto
          .createHash("sha256")
          .update(JSON.stringify(eventInput))
          .digest("hex");

        if (!task.googleCalendarEventId) {
          // CREATE EVENT
          if (settings.syncNewTasks) {
            const result = await GoogleCalendarService.createEvent(uid, eventInput);
            googleRequests += result.googleRequests;
            eventsCreated++;

            // Update Task Model
            await Task.updateOne(
              { _id: task._id },
              {
                $set: {
                  googleCalendarEventId: result.id,
                  googleCalendarEventHash: eventHash,
                  googleCalendarConflict: false
                }
              }
            );
          } else {
            eventsSkipped++;
          }
        } else {
          // UPDATE EVENT: Fetch the event from Google Calendar to check if user has manually edited it
          try {
            const getResult = await GoogleCalendarService.getEvent(uid, task.googleCalendarEventId);
            googleRequests += getResult.googleRequests;

            if (!getResult.event) {
              // Event was deleted from Google Calendar manually! recreate it
              if (settings.syncNewTasks) {
                const result = await GoogleCalendarService.createEvent(uid, eventInput);
                googleRequests += result.googleRequests;
                eventsCreated++;

                await Task.updateOne(
                  { _id: task._id },
                  {
                    $set: {
                      googleCalendarEventId: result.id,
                      googleCalendarEventHash: eventHash,
                      googleCalendarConflict: false
                    }
                  }
                );
              } else {
                eventsSkipped++;
              }
              continue;
            }

            // Create a hash of the current Google event to see if it differs from Zenkai's last projection
            const googleEventHash = crypto
              .createHash("sha256")
              .update(JSON.stringify(getResult.event))
              .digest("hex");

            // Compare Google event hash with the stored hash from Zenkai's last sync
            if (googleEventHash !== task.googleCalendarEventHash) {
              // CONFLICT DETECTED! User manually edited the event on Google Calendar.
              console.log(`[CalendarSync] Conflict detected on task ${task._id}. User edited Google event.`);
              
              await Task.updateOne(
                { _id: task._id },
                {
                  $set: {
                    googleCalendarConflict: true,
                    googleCalendarConflictDetails: {
                      title: getResult.event.summary,
                      start: getResult.event.start.dateTime,
                      end: getResult.event.end.dateTime
                    }
                  }
                }
              );
              eventsSkipped++;
              continue;
            }

            // If Google event has no changes and Zenkai has changes:
            if (task.googleCalendarEventHash === eventHash) {
              // No changes in Zenkai either. Skip.
              eventsSkipped++;
            } else {
              if (settings.updateTasks) {
                const result = await GoogleCalendarService.updateEvent(uid, task.googleCalendarEventId, eventInput);
                googleRequests += result.googleRequests;
                eventsUpdated++;

                // Update Task hash in DB
                await Task.updateOne(
                  { _id: task._id },
                  {
                    $set: {
                      googleCalendarEventHash: eventHash,
                      googleCalendarConflict: false
                    }
                  }
                );
              } else {
                eventsSkipped++;
              }
            }
          } catch (err: any) {
            console.error(`Failed to verify/update task event ${task.googleCalendarEventId}:`, err);
            eventsSkipped++;
          }
        }
      }

      // 4. Process DELETES (Tasks that disappeared from Zenkai's today scheduled workBlocks)
      const disappearedTasks = await Task.find({
        firebaseUid: uid,
        googleCalendarEventId: { $ne: null },
        suggestedDate: agenda.date,
        _id: { $nin: scheduledTaskIds },
        status: { $ne: "completed" } // Don't delete completed tasks
      });

      for (const dTask of disappearedTasks) {
        if (settings.deleteTasksAutomatically) {
          // Automatic deletion
          if (dTask.googleCalendarEventId) {
            try {
              const result = await GoogleCalendarService.deleteEvent(uid, dTask.googleCalendarEventId);
              googleRequests += result.googleRequests;
              eventsDeleted++;

              // Clear event details from Task
              await Task.updateOne(
                { _id: dTask._id },
                {
                  $unset: {
                    googleCalendarEventId: "",
                    googleCalendarEventHash: "",
                    googleCalendarConflict: "",
                    googleCalendarConflictDetails: ""
                  }
                }
              );
            } catch (err) {
              console.error(`Failed to delete event ${dTask.googleCalendarEventId}:`, err);
            }
          }
        } else {
          // Auto-delete is disabled. We keep the event, but we don't clear it.
          // The UI will query disappeared tasks to prompt the user.
          eventsSkipped++;
        }
      }

      // 5. Update user's syncedEventsCount and health state to healthy
      const totalSynced = await Task.countDocuments({
        firebaseUid: uid,
        googleCalendarEventId: { $ne: null }
      });

      await User.updateOne(
        { firebaseUid: uid },
        {
          $set: {
            "googleCalendarSettings.lastSuccessfulSync": new Date(),
            "googleCalendarSettings.syncedEventsCount": totalSynced,
            "googleCalendarSettings.syncHealth": "healthy"
          }
        }
      );

    } catch (err: any) {
      status = "failure";
      error = err.message || String(err);
      console.error(`[CalendarSyncService] Error during sync for user ${uid}:`, err);
    } finally {
      const finishedAt = new Date();
      duration = finishedAt.getTime() - startedAt.getTime();

      // Log telemetry
      try {
        await CalendarSyncLog.create({
          uid,
          startedAt,
          finishedAt,
          duration,
          eventsCreated,
          eventsUpdated,
          eventsDeleted,
          eventsSkipped,
          googleRequests,
          status,
          error,
          retryCount: 0
        });

        // Notify BehaviorEngine
        if (status === "success") {
          const { BehaviorEngine } = await import("@/services/behavior-engine.service");
          await BehaviorEngine.updateFromCalendar(uid).catch(err =>
            console.error("[CalendarSyncService] Failed to update behavior profile from calendar sync:", err)
          );
        }
      } catch (logErr) {
        console.error("[CalendarSyncService] Failed to write CalendarSyncLog:", logErr);
      }
    }

    return {
      success: status === "success",
      eventsCreated,
      eventsUpdated,
      eventsDeleted,
      eventsSkipped,
      googleRequests,
      duration,
      error
    };
  }

  /**
   * Resolve manual calendar conflicts
   */
  static async resolveConflict(uid: string, taskId: string, resolution: "keep_google" | "replace_with_zenkai"): Promise<boolean> {
    try {
      const task = await Task.findById(taskId);
      if (!task || !task.googleCalendarEventId) return false;

      if (resolution === "keep_google") {
        // Fetch event from Google Calendar to get its current title/time details
        const getResult = await GoogleCalendarService.getEvent(uid, task.googleCalendarEventId);
        if (!getResult.event) {
          // Google event was deleted, so we just clear conflict
          await Task.updateOne(
            { _id: taskId },
            {
              $set: { googleCalendarConflict: false },
              $unset: { googleCalendarConflictDetails: "" }
            }
          );
          return true;
        }

        // Parse Google date strings
        const googleStart = new Date(getResult.event.start.dateTime);
        
        // Update Zenkai task title and scheduled time to align with Google Calendar
        const newTitle = getResult.event.summary || task.title;
        const newSuggestedDate = googleStart.toISOString().split("T")[0];
        
        // Build new timeBlock string, e.g. "09:00 AM - 10:30 AM" or "09:00 - 10:30"
        const formatTime = (date: Date) => {
          return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
        };
        const googleEnd = new Date(getResult.event.end.dateTime);
        const newTimeBlock = `${formatTime(googleStart)} - ${formatTime(googleEnd)}`;

        // Hash Google's version to mark as synced
        const googleEventHash = crypto
          .createHash("sha256")
          .update(JSON.stringify(getResult.event))
          .digest("hex");

        await Task.updateOne(
          { _id: taskId },
          {
            $set: {
              title: newTitle,
              suggestedDate: newSuggestedDate,
              timeBlock: newTimeBlock,
              scheduledFor: googleStart,
              googleCalendarEventHash: googleEventHash,
              googleCalendarConflict: false
            },
            $unset: {
              googleCalendarConflictDetails: ""
            }
          }
        );

        console.log(`[CalendarSync] Conflict resolved for ${taskId}: Kept Google version.`);
        return true;
      } else if (resolution === "replace_with_zenkai") {
        // Force-overwrite Google Calendar with Zenkai's task version
        const user = await User.findOne({ firebaseUid: uid });
        const timezone = user?.briefSettings?.timezone || "UTC";

        // Build description
        const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const deepLink = `${appUrl}/app`;
        const priorityLabel = task.priority === 1 ? "High" : task.priority === 2 ? "Medium" : "Low";
        const colorId = task.priority === 1 ? "11" : task.priority === 2 ? "7" : "1";

        const description = [
          "Generated by Zenkai",
          `Priority: ${priorityLabel}`,
          task.estimatedMinutes ? `Estimated Duration: ${task.estimatedMinutes} mins` : null,
          task.description ? `\nNotes:\n${task.description}` : null,
          `\nOpen Zenkai: ${deepLink}`
        ].filter(Boolean).join("\n");

        // Set start/end strings from suggestedDate/timeBlock or defaults
        // Wait, if no timeBlock exists, construct from suggestedDate or task scheduledFor
        const localDate = task.suggestedDate || new Date().toISOString().split("T")[0];
        let startTime = "09:00";
        let endTime = "10:00";
        if (task.timeBlock && task.timeBlock.includes("-")) {
          const parts = task.timeBlock.split("-");
          startTime = parts[0].trim();
          endTime = parts[1].trim();
        }

        const startStr = `${localDate}T${startTime}:00`;
        const endStr = `${localDate}T${endTime}:00`;

        const eventInput: GoogleEventInput = {
          summary: task.title,
          description,
          start: {
            dateTime: startStr,
            timeZone: timezone
          },
          end: {
            dateTime: endStr,
            timeZone: timezone
          },
          colorId
        };

        const eventHash = crypto
          .createHash("sha256")
          .update(JSON.stringify(eventInput))
          .digest("hex");

        await GoogleCalendarService.updateEvent(uid, task.googleCalendarEventId, eventInput);

        await Task.updateOne(
          { _id: taskId },
          {
            $set: {
              googleCalendarEventHash: eventHash,
              googleCalendarConflict: false
            },
            $unset: {
              googleCalendarConflictDetails: ""
            }
          }
        );

        console.log(`[CalendarSync] Conflict resolved for ${taskId}: Overwrote Google version.`);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`[CalendarSyncService] Error resolving conflict for task ${taskId}:`, err);
      return false;
    }
  }

  /**
   * Delete a single event manually (used for the "disappeared tasks" user prompt)
   */
  static async deleteEventManually(uid: string, taskId: string): Promise<boolean> {
    try {
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

      // Update user count
      const totalSynced = await Task.countDocuments({
        firebaseUid: uid,
        googleCalendarEventId: { $ne: null }
      });
      await User.updateOne(
        { firebaseUid: uid },
        { $set: { "googleCalendarSettings.syncedEventsCount": totalSynced } }
      );

      return true;
    } catch (err) {
      console.error(`[CalendarSyncService] Failed to delete event manually for task ${taskId}:`, err);
      return false;
    }
  }
}
