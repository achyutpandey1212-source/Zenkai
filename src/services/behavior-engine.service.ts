import { dbConnect } from "@/lib/mongodb";
import { BehaviorProfile, IBehaviorProfile } from "@/models/BehaviorProfile";
import { Task } from "@/models/Task";
import { Plan } from "@/models/Plan";
import { Milestone } from "@/models/Milestone";
import { DailyAgenda } from "@/models/DailyAgenda";
import { BriefingLog } from "@/models/BriefingLog";
import { CalendarSyncLog } from "@/models/CalendarSyncLog";
import { Reflection } from "@/models/Reflection";
import { User } from "@/models/User";
import { Types } from "mongoose";

export class BehaviorEngine {
  /**
   * Helper to format Date to YYYY-MM-DD in user timezone
   */
  private static getLocalDateString(date: Date | string | number, timezone: string): string {
    try {
      const d = new Date(date);
      return d.toLocaleDateString("en-CA", { timeZone: timezone }); // Returns YYYY-MM-DD
    } catch (err) {
      const d = new Date(date);
      return d.toISOString().split("T")[0];
    }
  }

  /**
   * Helper to check if two YYYY-MM-DD dates are consecutive days
   */
  private static areConsecutive(d1Str: string, d2Str: string): boolean {
    try {
      const d1 = new Date(d1Str);
      const d2 = new Date(d2Str);
      d1.setHours(12, 0, 0, 0);
      d2.setHours(12, 0, 0, 0);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return diffDays === 1;
    } catch (e) {
      return false;
    }
  }

  /**
   * Fetch or initialize user behavior profile
   */
  static async getOrCreateProfile(uid: string): Promise<IBehaviorProfile> {
    await dbConnect();
    let profile = await BehaviorProfile.findOne({ uid });
    if (!profile) {
      profile = await BehaviorProfile.create({ uid });
    }
    return profile;
  }

  /**
   * Full recalculation of BehaviorProfile from historical logs
   */
  static async computeBehaviorProfile(uid: string): Promise<IBehaviorProfile> {
    await dbConnect();
    
    // 1. Get user and timezone
    const user = await User.findOne({ firebaseUid: uid }).select("briefSettings.timezone").lean();
    const timezone = user?.briefSettings?.timezone || "UTC";

    const profile = await this.getOrCreateProfile(uid);
    const todayStr = this.getLocalDateString(new Date(), timezone);

    // 2. Fetch all collections for the user
    const allTasks = await Task.find({ firebaseUid: uid }).lean();
    const completedTasks = allTasks.filter(t => t.status === "completed");
    const skippedTasks = allTasks.filter(t => t.status === "skipped");
    
    // Overdue definition: missed status, or todo/in_progress/blocked with scheduled date in the past
    const overdueTasks = allTasks.filter(t => {
      if (t.status === "missed") return true;
      if (["todo", "in_progress", "blocked"].includes(t.status)) {
        const dStr = t.suggestedDate || (t.scheduledFor ? this.getLocalDateString(t.scheduledFor, timezone) : "");
        return dStr && dStr < todayStr;
      }
      return false;
    });

    const completedCount = completedTasks.length;
    const skippedCount = skippedTasks.length;
    const overdueCount = overdueTasks.length;
    const completionRateDenominator = completedCount + skippedCount + overdueCount;
    const completionRate = completionRateDenominator > 0 ? (completedCount / completionRateDenominator) * 100 : 0;

    // 3. Productivity & Focus Time
    const agendas = await DailyAgenda.find({ firebaseUid: uid }).lean();
    const dailyAgendaGenerated = agendas.length;
    const totalPlannedFocusMinutes = agendas.reduce((sum, a) => sum + (a.estimatedFocusTime || 0), 0);
    const averagePlannedHours = dailyAgendaGenerated > 0 ? (totalPlannedFocusMinutes / dailyAgendaGenerated) / 60 : 0;

    const totalCompletedFocusMinutes = completedTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0); // Default to 30 min
    const averageCompletedHours = dailyAgendaGenerated > 0 
      ? (totalCompletedFocusMinutes / dailyAgendaGenerated) / 60 
      : (completedCount > 0 ? (totalCompletedFocusMinutes / completedCount) / 60 : 0);

    const workCompletionRatio = averagePlannedHours > 0 ? averageCompletedHours / averagePlannedHours : 0;

    // 4. Deep Work (Tasks with estimatedMinutes >= 45)
    const deepWorkTasks = completedTasks.filter(t => (t.estimatedMinutes || 0) >= 45);
    const deepWorkSessions = deepWorkTasks.length;
    const averageDeepWorkMinutes = deepWorkSessions > 0 
      ? deepWorkTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0) / deepWorkSessions 
      : 0;
    const longestDeepWorkMinutes = deepWorkSessions > 0 
      ? Math.max(...deepWorkTasks.map(t => t.estimatedMinutes || 0)) 
      : 0;

    // 5. Time Preference (Task completions by hour)
    const hourCounts = new Array(24).fill(0);
    completedTasks.forEach(t => {
      if (t.completedAt) {
        try {
          const hourStr = new Date(t.completedAt).toLocaleTimeString("en-US", {
            timeZone: timezone,
            hour: "numeric",
            hour12: false
          });
          const hr = parseInt(hourStr);
          if (hr >= 0 && hr < 24) hourCounts[hr]++;
        } catch (e) {
          const hr = new Date(t.completedAt).getUTCHours();
          hourCounts[hr]++;
        }
      }
    });

    // Classify into windows
    const morningCount = hourCounts.slice(6, 12).reduce((a, b) => a + b, 0); // 6 AM - 12 PM
    const afternoonCount = hourCounts.slice(12, 18).reduce((a, b) => a + b, 0); // 12 PM - 6 PM
    const eveningCount = hourCounts.slice(18, 24).reduce((a, b) => a + b, 0); // 6 PM - 12 AM
    const lateNightCount = hourCounts.slice(0, 6).reduce((a, b) => a + b, 0); // 12 AM - 6 AM

    const windowCounts = [
      { name: "Morning", count: morningCount },
      { name: "Afternoon", count: afternoonCount },
      { name: "Evening", count: eveningCount },
      { name: "Late Night", count: lateNightCount }
    ];
    windowCounts.sort((a, b) => b.count - a.count);
    const preferredWorkingWindow = completedCount > 0 ? windowCounts[0].name : "Morning";

    // 3-hour Peak Productivity Window
    let maxWindowSum = 0;
    let peakStartHour = 8; // Default to 8 AM
    for (let i = 0; i < 24; i++) {
      const sum = hourCounts[i] + hourCounts[(i + 1) % 24] + hourCounts[(i + 2) % 24];
      if (sum > maxWindowSum) {
        maxWindowSum = sum;
        peakStartHour = i;
      }
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    const peakHours = `${pad(peakStartHour)}:00–${pad((peakStartHour + 3) % 24)}:00`;

    // 6. Weekly Rhythm (Weekday vs Weekend completion rate)
    const weekdayTasks = allTasks.filter(t => {
      const dStr = t.suggestedDate || (t.scheduledFor ? this.getLocalDateString(t.scheduledFor, timezone) : "");
      if (!dStr) return false;
      const day = new Date(dStr).getDay();
      return day >= 1 && day <= 5; // Monday to Friday
    });
    const weekendTasks = allTasks.filter(t => {
      const dStr = t.suggestedDate || (t.scheduledFor ? this.getLocalDateString(t.scheduledFor, timezone) : "");
      if (!dStr) return false;
      const day = new Date(dStr).getDay();
      return day === 0 || day === 6; // Sunday or Saturday
    });

    const getGroupCompletionRate = (tasksGroup: typeof allTasks) => {
      const comp = tasksGroup.filter(t => t.status === "completed").length;
      const skip = tasksGroup.filter(t => t.status === "skipped").length;
      const over = tasksGroup.filter(t => {
        if (t.status === "missed") return true;
        if (["todo", "in_progress", "blocked"].includes(t.status)) {
          const dStr = t.suggestedDate || (t.scheduledFor ? this.getLocalDateString(t.scheduledFor, timezone) : "");
          return dStr && dStr < todayStr;
        }
        return false;
      }).length;
      const denom = comp + skip + over;
      return denom > 0 ? (comp / denom) * 100 : 0;
    };
    const weekdayCompletionRate = getGroupCompletionRate(weekdayTasks);
    const weekendCompletionRate = getGroupCompletionRate(weekendTasks);

    // 7. Planning Behavior
    const plans = await Plan.find({ firebaseUid: uid }).lean();
    const plansCreated = plans.length;
    const plansCompleted = plans.filter(p => p.status === "completed").length;
    const plansAbandoned = plans.filter(p => p.status === "archived").length;

    const lifetimePlans = plans.filter(p => ["completed", "archived"].includes(p.status));
    let totalLifetimeDays = 0;
    lifetimePlans.forEach(p => {
      const diffMs = new Date(p.updatedAt).getTime() - new Date(p.createdAt).getTime();
      totalLifetimeDays += diffMs / (1000 * 60 * 60 * 24);
    });
    const averagePlanLifetime = lifetimePlans.length > 0 ? parseFloat((totalLifetimeDays / lifetimePlans.length).toFixed(2)) : 0;

    // 8. Calendar Reliability
    const syncLogs = await CalendarSyncLog.find({ uid, status: "success" }).lean();
    const calendarUsageDays = new Set(syncLogs.map(l => this.getLocalDateString(l.createdAt, timezone))).size;

    const syncedTasks = allTasks.filter(t => t.googleCalendarEventId && t.googleCalendarEventId !== "");
    const calendarCompletionRate = getGroupCompletionRate(syncedTasks);

    // 9. Briefing Engagement
    const briefings = await BriefingLog.find({ uid, status: "success" }).lean();
    const morningBriefs = briefings.filter(b => b.type === "morning");
    const eveningBriefs = briefings.filter(b => b.type === "evening");

    const morningBriefOpenRate = morningBriefs.length > 0 
      ? (morningBriefs.filter(b => b.opened).length / morningBriefs.length) * 100 
      : 0;
    const eveningBriefOpenRate = eveningBriefs.length > 0 
      ? (eveningBriefs.filter(b => b.opened).length / eveningBriefs.length) * 100 
      : 0;

    // 10. Execution Reliability
    let dailyAgendaCompleted = 0;
    let totalAgendaCompletionsSum = 0;
    for (const agenda of agendas) {
      const taskIds = (agenda.workBlocks || []).flatMap(wb => (wb.tasks || []).map(t => t.toString()));
      if (taskIds.length === 0) {
        totalAgendaCompletionsSum += 100;
        dailyAgendaCompleted++;
        continue;
      }
      const agendaTasks = allTasks.filter(t => taskIds.includes(t._id.toString()));
      const comp = agendaTasks.filter(t => t.status === "completed").length;
      const completionPercentage = (comp / agendaTasks.length) * 100;
      totalAgendaCompletionsSum += completionPercentage;

      if (comp === agendaTasks.length) {
        dailyAgendaCompleted++;
      }
    }
    const averageAgendaCompletion = dailyAgendaGenerated > 0 ? totalAgendaCompletionsSum / dailyAgendaGenerated : 0;

    // 11. Activity (Streak Recalculation)
    const { currentStreak, longestStreak, daysActive, lastActivity, activeDates } = await this.recalculateStreakMetrics(uid, timezone);

    // Update profile document
    profile.Activity = { currentStreak, longestStreak, daysActive, lastActivity, activeDates };
    profile.Completion = { completedTasks: completedCount, skippedTasks: skippedCount, overdueTasks: overdueCount, completionRate };
    profile.Productivity = { averagePlannedHours, averageCompletedHours, workCompletionRatio };
    profile.DeepWork = { deepWorkSessions, averageDeepWorkMinutes, longestDeepWorkMinutes };
    profile.TimePreference = { preferredWorkingWindow, peakHours };
    profile.Weekly = { weekdayCompletionRate, weekendCompletionRate };
    profile.Planning = { plansCreated, plansCompleted, plansAbandoned, averagePlanLifetime };
    profile.Calendar = { calendarUsageDays, calendarCompletionRate };
    profile.Briefings = { morningBriefOpenRate, eveningBriefOpenRate };
    profile.Execution = { dailyAgendaGenerated, dailyAgendaCompleted, averageAgendaCompletion };
    profile.Metadata = { engineVersion: "1.0.0", lastComputed: new Date() };

    await profile.save();
    return profile;
  }

  /**
   * Helper to recalculate streak metrics (returns raw metrics)
   */
  private static async recalculateStreakMetrics(uid: string, timezone: string) {
    // 1. Gather all activity dates
    const activityDates = new Set<string>();

    // Completed Tasks
    const tasks = await Task.find({ firebaseUid: uid, status: "completed" }).select("completedAt").lean();
    tasks.forEach(t => {
      if (t.completedAt) activityDates.add(this.getLocalDateString(t.completedAt, timezone));
    });

    // Completed Milestones
    const milestones = await Milestone.find({ firebaseUid: uid, status: "completed" }).select("updatedAt").lean();
    milestones.forEach(m => {
      if (m.updatedAt) activityDates.add(this.getLocalDateString(m.updatedAt, timezone));
    });

    // Plan modifications (createdAt, updatedAt, history timestamps)
    const plans = await Plan.find({ firebaseUid: uid }).select("createdAt updatedAt history.timestamp").lean();
    plans.forEach(p => {
      activityDates.add(this.getLocalDateString(p.createdAt, timezone));
      activityDates.add(this.getLocalDateString(p.updatedAt, timezone));
      if (p.history) {
        p.history.forEach(h => {
          activityDates.add(this.getLocalDateString(h.timestamp, timezone));
        });
      }
    });

    // Daily Agendas generated
    const agendas = await DailyAgenda.find({ firebaseUid: uid }).select("date").lean();
    agendas.forEach(a => {
      if (a.date) activityDates.add(a.date); // DailyAgenda date is already YYYY-MM-DD
    });

    // Reflections created
    const reflections = await Reflection.find({ firebaseUid: uid }).select("createdAt").lean();
    reflections.forEach(r => {
      if (r.createdAt) activityDates.add(this.getLocalDateString(r.createdAt, timezone));
    });

    const sortedDates = Array.from(activityDates).sort();
    const daysActive = sortedDates.length;
    const lastActivity = sortedDates.length > 0 ? new Date(sortedDates[sortedDates.length - 1]) : null;

    const now = new Date();
    const todayStr = this.getLocalDateString(now, timezone);
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this.getLocalDateString(yesterday, timezone);

    const { currentStreak, longestStreak } = this.calculateStreakFromDates(sortedDates, todayStr, yesterdayStr);

    return { currentStreak, longestStreak, daysActive, lastActivity, activeDates: sortedDates };
  }

  /**
   * Internal streak algorithm
   */
  private static calculateStreakFromDates(dates: string[], todayStr: string, yesterdayStr: string) {
    if (dates.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    const dateSet = new Set(dates);
    let currentStreak = 0;

    const hasActivityToday = dateSet.has(todayStr);
    const hasActivityYesterday = dateSet.has(yesterdayStr);

    if (hasActivityToday || hasActivityYesterday) {
      let checkDate = hasActivityToday ? new Date(todayStr) : new Date(yesterdayStr);
      while (true) {
        // Format to local date string (noon set first to avoid timezone boundary wrap bugs)
        checkDate.setHours(12, 0, 0, 0);
        const checkStr = checkDate.toISOString().split("T")[0];
        if (dateSet.has(checkStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Longest Streak
    let longestStreak = 0;
    let tempStreak = 0;
    for (let i = 0; i < dates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        if (this.areConsecutive(dates[i - 1], dates[i])) {
          tempStreak++;
        } else {
          if (tempStreak > longestStreak) {
            longestStreak = tempStreak;
          }
          tempStreak = 1;
        }
      }
    }
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }

    return { currentStreak, longestStreak };
  }

  /**
   * Event API: Task Completion
   */
  static async updateFromTaskCompletion(uid: string, taskId: string): Promise<void> {
    console.log(`[BehaviorEngine] Event: updateFromTaskCompletion for user ${uid}, task ${taskId}`);
    await this.computeBehaviorProfile(uid); // Recompute user metrics deterministically
  }

  /**
   * Event API: Task Skip
   */
  static async updateFromTaskSkip(uid: string, taskId: string): Promise<void> {
    console.log(`[BehaviorEngine] Event: updateFromTaskSkip for user ${uid}, task ${taskId}`);
    await this.computeBehaviorProfile(uid);
  }

  /**
   * Event API: Agenda Generated
   */
  static async updateFromAgenda(uid: string, dateStr: string): Promise<void> {
    console.log(`[BehaviorEngine] Event: updateFromAgenda for user ${uid}, date ${dateStr}`);
    await this.computeBehaviorProfile(uid);
  }

  /**
   * Event API: Plan Modified/Created/Archived
   */
  static async updateFromPlan(uid: string, planId: string, actionType: string): Promise<void> {
    console.log(`[BehaviorEngine] Event: updateFromPlan for user ${uid}, plan ${planId}, action ${actionType}`);
    await this.computeBehaviorProfile(uid);
  }

  /**
   * Event API: Calendar mirror complete
   */
  static async updateFromCalendar(uid: string): Promise<void> {
    console.log(`[BehaviorEngine] Event: updateFromCalendar for user ${uid}`);
    await this.computeBehaviorProfile(uid);
  }

  /**
   * Event API: Briefing sent/opened
   */
  static async updateFromBriefing(uid: string, type: "morning" | "evening", action: "sent" | "opened"): Promise<void> {
    console.log(`[BehaviorEngine] Event: updateFromBriefing for user ${uid}, type ${type}, action ${action}`);
    await this.computeBehaviorProfile(uid);
  }

  /**
   * Public wrapper to trigger streak recalculation
   */
  static async recalculateStreak(uid: string): Promise<void> {
    await this.computeBehaviorProfile(uid);
  }
}
