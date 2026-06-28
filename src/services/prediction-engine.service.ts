import { PredictionProfile } from "@/models/PredictionProfile";
import { PredictionEvent } from "@/models/PredictionEvent";
import { RiskProfile } from "@/models/RiskProfile";
import { BehaviorProfile } from "@/models/BehaviorProfile";
import { ConsistencyProfile } from "@/models/ConsistencyProfile";
import { IdentityTrait } from "@/models/IdentityTrait";
import { Goal } from "@/models/Goal";
import { Plan } from "@/models/Plan";
import { Milestone } from "@/models/Milestone";
import { Task } from "@/models/Task";
import { DailyAgenda } from "@/models/DailyAgenda";
import { BriefingLog } from "@/models/BriefingLog";
import { Memory } from "@/models/Memory";
import { Reflection } from "@/models/Reflection";
import { CalendarSyncLog } from "@/models/CalendarSyncLog";
import { User } from "@/models/User";

/**
 * Standardized snapshot builder.
 * Aggregates all user context into a single normalized data structure.
 */
export class UserIntelligenceSnapshotBuilder {
  public static async build(uid: string): Promise<any> {
    const [
      user,
      bp,
      cp,
      activeTraits,
      rawActiveGoals,
      rawPlans,
      rawMilestones,
      rawTasks,
      agendas,
      syncLogs,
      memories,
      reflections,
      briefingLogs,
      pp,
      rp
    ] = await Promise.all([
      User.findOne({ firebaseUid: uid }).lean(),
      BehaviorProfile.findOne({ uid }).lean(),
      ConsistencyProfile.findOne({ uid }).lean(),
      IdentityTrait.find({ firebaseUid: uid, status: "active" }).lean(),
      Goal.find({ firebaseUid: uid, status: "active" }).lean(),
      Plan.find({ firebaseUid: uid }).lean(),
      Milestone.find({ firebaseUid: uid }).lean(),
      Task.find({ firebaseUid: uid }).lean(),
      DailyAgenda.find({ firebaseUid: uid }).sort({ date: -1 }).limit(30).lean(),
      CalendarSyncLog.find({ uid }).sort({ createdAt: -1 }).limit(10).lean(),
      Memory.find({ firebaseUid: uid }).lean(),
      Reflection.find({ firebaseUid: uid }).lean(),
      BriefingLog.find({ uid, status: "success" }).sort({ createdAt: -1 }).limit(14).lean(),
      PredictionProfile.findOne({ uid }).lean(),
      RiskProfile.findOne({ uid }).lean()
    ]);

    const plans = rawPlans.filter(p => p.status !== "archived");
    const nonArchivedPlanIds = new Set(plans.map(p => p._id.toString()));

    const milestones = rawMilestones.filter(m => nonArchivedPlanIds.has(m.planId?.toString()));
    const activeGoals = rawActiveGoals.filter(g => !g.planId || nonArchivedPlanIds.has(g.planId.toString()));
    const activeGoalIds = new Set(activeGoals.map(g => g._id.toString()));
    const tasks = rawTasks.filter(t => !t.goalId || activeGoalIds.has(t.goalId.toString()));

    const primaryTrait = activeTraits.find(t => t.category === "core_identity") || 
                         activeTraits.find(t => t.category === "aspiration") || 
                         activeTraits[0] || null;

    return {
      uid,
      identity: {
        activeTraits,
        primaryTrait
      },
      behavior: bp,
      consistency: cp,
      execution: {
        dailyAgendas: agendas,
        tasks
      },
      planning: {
        plans,
        milestones,
        goals: activeGoals
      },
      calendar: {
        syncLogs
      },
      memory: {
        memories
      },
      reflections: {
        reflections
      },
      briefings: {
        logs: briefingLogs
      },
      profile: user,
      prediction: pp,
      risk: rp ? {
        overall: rp.overallRisk,
        burnout: rp.burnoutRisk?.score || 0,
        goalDrift: rp.goalDriftRisk?.score || 0,
        deadline: rp.deadlineRisk?.score || 0,
        consistency: rp.consistencyRisk?.score || 0,
        execution: rp.executionRisk?.score || 0,
        schedule: rp.scheduleRisk?.score || 0,
        calendar: rp.calendarRisk?.score || 0,
        abandonment: rp.abandonmentRisk?.score || 0,
        warnings: rp.activeWarnings || []
      } : null
    };
  }
}

/**
 * PredictionEngine.
 * Computes roadmap forecasts, task probabilities, and trends.
 */
export class PredictionEngine {
  /**
   * Retrieves or creates a default PredictionProfile for a user.
   */
  public static async getOrCreateProfile(uid: string): Promise<any> {
    let profile = await PredictionProfile.findOne({ uid });
    if (!profile) {
      profile = await PredictionProfile.create({
        uid,
        completionForecast: { estimatedCompletionDate: new Date(), estimatedRemainingDays: 0, confidence: 100, evidence: [] },
        dailyTaskForecast: [],
        productivityForecast: {
          expectedFocusHours7d: { min: 0, max: 0 },
          expectedCompletedTasks7d: { min: 0, max: 0 },
          expectedDeepWorkSessions7d: { min: 0, max: 0 },
          expectedAgendaCompletion7d: { min: 0, max: 0 },
          expectedFocusHours30d: { min: 0, max: 0 },
          expectedCompletedTasks30d: { min: 0, max: 0 },
          expectedDeepWorkSessions30d: { min: 0, max: 0 },
          expectedAgendaCompletion30d: { min: 0, max: 0 },
          evidence: []
        },
        consistencyForecast: { predictedConsistencyNextWeek: 0, trendDirection: "stable", evidence: [] },
        goalForecast: [],
        deadlineForecast: [],
        habitForecast: { currentStreak: 0, probabilityContinueTomorrow: 0, probabilityContinueNextWeek: 0, probabilityLoseStreak: 0, evidence: [] },
        averageConfidence: 0,
        rollingPredictions: []
      });
    }
    return profile;
  }

  /**
   * Performs full prediction engine recalculations based on snapshot.
   */
  public static async computePredictionProfile(uid: string): Promise<any> {
    const oldProfileDoc = await PredictionProfile.findOne({ uid }).lean();
    const profile = await this.getOrCreateProfile(uid);
    const snapshot = await UserIntelligenceSnapshotBuilder.build(uid);

    const timezone = snapshot.profile?.briefSettings?.timezone || "UTC";
    const overallConsistency = snapshot.consistency?.overallConsistency || 50;

    // 1. ROADMAP COMPLETION FORECAST
    const remainingMilestones = snapshot.planning.milestones.filter(
      (m: any) => m.status !== "completed" && m.status !== "cancelled"
    ).length;

    const date30dAgo = new Date();
    date30dAgo.setDate(date30dAgo.getDate() - 30);

    const completedRecentMilestones = snapshot.planning.milestones.filter(
      (m: any) => m.status === "completed" && new Date(m.updatedAt) >= date30dAgo
    ).length;

    // milestones completed per week (past 30 days)
    const velocity = Math.max(0.2, completedRecentMilestones / 4);
    // scale velocity by consistency score: ranges from 0.5 (low) to 1.0 (high)
    const consistencyFactor = 0.5 + (overallConsistency / 100) * 0.5;
    const adjustedVelocity = velocity * consistencyFactor;

    const estimatedRemainingDays = remainingMilestones > 0 
      ? Math.min(365, Math.ceil((remainingMilestones / adjustedVelocity) * 7)) 
      : 0;

    const estimatedCompletionDate = new Date();
    estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + estimatedRemainingDays);

    const roadmapCompletionConfidence = Math.round(
      Math.max(20, Math.min(98, 60 + (overallConsistency / 100) * 20 + Math.min(18, completedRecentMilestones * 3)))
    );

    const completionEvidence = [
      `* Remaining milestones to complete: ${remainingMilestones}`,
      `* Milestone velocity: ${velocity.toFixed(2)} milestones/week (trailing 30 days)`,
      `* Consistency modifier: x${consistencyFactor.toFixed(2)}`,
      `* Adjusted velocity: ${adjustedVelocity.toFixed(2)} milestones/week`
    ];

    // 2. DAILY TASK COMPLETION PROBABILITY
    const dailyTaskForecast: any[] = [];
    
    // Resolve today's date in local timezone
    const localTodayStr = this.getLocalTodayDateStr(timezone);
    const todayTasks = snapshot.execution.tasks.filter(
      (t: any) => t.status !== "completed" && t.status !== "skipped" && 
                 (t.scheduledFor === localTodayStr || t.suggestedDate === localTodayStr)
    );

    const baseProb = snapshot.behavior?.Completion?.completionRate || 70;
    const preferredWindow = snapshot.behavior?.TimePreference?.preferredWorkingWindow || "";
    const peakHours = snapshot.behavior?.TimePreference?.peakHours || "";

    for (const t of todayTasks) {
      let adj = 0;
      // Peak working hours
      if (t.timeBlock) {
        adj += 8; // Scheduled bonus
        // Check if falls in preferred period
        if (preferredWindow && this.isTimeBlockInPeriod(t.timeBlock, preferredWindow)) {
          adj += 7;
        }
        if (peakHours && this.isTimeBlockInPeakHours(t.timeBlock, peakHours)) {
          adj += 10;
        }
      }
      
      // Task priority
      if (t.priority === 1) adj += 10;
      else if (t.priority === 2) adj += 5;
      else if (t.priority >= 4) adj -= 10;

      // Calendar conflicts
      if (t.googleCalendarConflict) adj -= 20;

      // Consistency modifier
      if (overallConsistency > 80) adj += 5;
      else if (overallConsistency < 50) adj -= 10;

      const completionProbability = Math.max(5, Math.min(98, Math.round(baseProb + adj)));
      dailyTaskForecast.push({
        taskId: t._id.toString(),
        title: t.title,
        completionProbability
      });
    }

    // 3. PRODUCTIVITY FORECAST
    const avgHoursPerDay = snapshot.behavior?.Productivity?.averageCompletedHours || 1.0;
    const daysActive = snapshot.behavior?.Activity?.daysActive || 1;
    const completedTasksCount = snapshot.behavior?.Completion?.completedTasks || 0;
    const avgTasksPerDay = completedTasksCount / daysActive || 1.0;
    const deepWorkSessions = snapshot.behavior?.DeepWork?.deepWorkSessions || 0;
    const avgDeepWorkPerWeek = (deepWorkSessions / (daysActive || 7)) * 7 || 0.5;
    const avgAgendaComp = snapshot.behavior?.Execution?.averageAgendaCompletion || 70;

    const productivityForecast = {
      expectedFocusHours7d: {
        min: Math.round(avgHoursPerDay * 7 * 0.9 * 10) / 10,
        max: Math.round(avgHoursPerDay * 7 * 1.1 * 10) / 10
      },
      expectedCompletedTasks7d: {
        min: Math.round(avgTasksPerDay * 7 * 0.9),
        max: Math.round(avgTasksPerDay * 7 * 1.1)
      },
      expectedDeepWorkSessions7d: {
        min: Math.round(avgDeepWorkPerWeek * 0.9),
        max: Math.round(avgDeepWorkPerWeek * 1.1)
      },
      expectedAgendaCompletion7d: {
        min: Math.max(10, Math.round(avgAgendaComp * 0.9)),
        max: Math.min(100, Math.round(avgAgendaComp * 1.1))
      },
      expectedFocusHours30d: {
        min: Math.round(avgHoursPerDay * 30 * 0.85 * 10) / 10,
        max: Math.round(avgHoursPerDay * 30 * 1.15 * 10) / 10
      },
      expectedCompletedTasks30d: {
        min: Math.round(avgTasksPerDay * 30 * 0.85),
        max: Math.round(avgTasksPerDay * 30 * 1.15)
      },
      expectedDeepWorkSessions30d: {
        min: Math.round((avgDeepWorkPerWeek * 4.28) * 0.85),
        max: Math.round((avgDeepWorkPerWeek * 4.28) * 1.15)
      },
      expectedAgendaCompletion30d: {
        min: Math.max(10, Math.round(avgAgendaComp * 0.85)),
        max: Math.min(100, Math.round(avgAgendaComp * 1.15))
      },
      evidence: [
        `* Based on historical focus completed hours of ${avgHoursPerDay.toFixed(1)}h/day`,
        `* Based on average daily task completion velocity: ${avgTasksPerDay.toFixed(1)} tasks/day`,
        `* Projected from weekly deep work velocity of ${avgDeepWorkPerWeek.toFixed(1)} sessions/week`
      ]
    };

    // 4. CONSISTENCY FORECAST
    const sevenDayAvg = snapshot.consistency?.Trends?.sevenDayAvg || overallConsistency;
    const thirtyDayAvg = snapshot.consistency?.Trends?.thirtyDayAvg || overallConsistency;
    const trendDiff = sevenDayAvg - thirtyDayAvg;

    let trendDirection: "up" | "down" | "stable" = "stable";
    let predictedConsistencyNextWeek = overallConsistency;

    if (trendDiff > 3) {
      trendDirection = "up";
      predictedConsistencyNextWeek = Math.min(98, overallConsistency + Math.round(trendDiff * 0.6));
    } else if (trendDiff < -3) {
      trendDirection = "down";
      predictedConsistencyNextWeek = Math.max(5, overallConsistency + Math.round(trendDiff * 0.6));
    }

    const consistencyEvidence = [
      `* Current overall consistency: ${overallConsistency}%`,
      `* Trailing 7-day average: ${sevenDayAvg}% (30-day average: ${thirtyDayAvg}%)`,
      `* Trend direction: trending ${trendDirection} (${trendDiff > 0 ? "+" : ""}${trendDiff.toFixed(1)}% shift)`
    ];

    // 5. GOAL COMPLETION FORECAST
    const goalForecast: any[] = [];
    const goalEvidence: string[] = [];

    for (const goal of snapshot.planning.goals) {
      const goalTasks = snapshot.execution.tasks.filter(
        (t: any) => t.goalId?.toString() === goal._id.toString()
      );
      const completedGoalTasks = goalTasks.filter((t: any) => t.status === "completed");
      const remainingGoalTasks = goalTasks.filter(
        (t: any) => t.status !== "completed" && t.status !== "skipped"
      );

      const recentCompletedGoalTasks = completedGoalTasks.filter(
        (t: any) => new Date(t.completedAt || t.updatedAt) >= date30dAgo
      ).length;

      const goalTasksVelocity = Math.max(1.0, recentCompletedGoalTasks / 4); // tasks per week
      const adjustedGoalVelocity = goalTasksVelocity * consistencyFactor;

      const remainingGoalDays = remainingGoalTasks.length > 0
        ? Math.min(365, Math.ceil((remainingGoalTasks.length / adjustedGoalVelocity) * 7))
        : 0;

      const goalEstCompletionDate = new Date();
      goalEstCompletionDate.setDate(goalEstCompletionDate.getDate() + remainingGoalDays);

      const goalConfidence = Math.round(
        Math.max(20, Math.min(98, 70 + (overallConsistency / 100) * 15 - (remainingGoalTasks.length > 10 ? 8 : 0)))
      );
      const likelihood = goalConfidence >= 80 ? "High" : (goalConfidence >= 50 ? "Medium" : "Low");

      goalForecast.push({
        goalId: goal._id.toString(),
        goalTitle: goal.title,
        estimatedCompletionDate: goalEstCompletionDate,
        confidence: goalConfidence,
        likelihood
      });

      goalEvidence.push(
        `* Goal "${goal.title}": Remaining tasks = ${remainingGoalTasks.length}, pacing at ${adjustedGoalVelocity.toFixed(1)} tasks/week`
      );
    }

    // 6. DEADLINE FORECAST
    const deadlineForecast: any[] = [];
    for (const goal of snapshot.planning.goals) {
      if (goal.targetDate) {
        const goalForecastRecord = goalForecast.find(f => f.goalId === goal._id.toString());
        const estDate = goalForecastRecord ? goalForecastRecord.estimatedCompletionDate : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const deadline = new Date(goal.targetDate);

        const marginMs = deadline.getTime() - estDate.getTime();
        const marginDays = marginMs / (1000 * 60 * 60 * 24);

        let probabilityEarly = 10;
        let probabilityOnTime = 70;
        let probabilityLate = 20;

        if (marginDays >= 14) {
          probabilityEarly = 60;
          probabilityOnTime = 38;
          probabilityLate = 2;
        } else if (marginDays >= 0) {
          probabilityEarly = 20;
          probabilityOnTime = 70;
          probabilityLate = 10;
        } else if (marginDays >= -7) {
          probabilityEarly = 5;
          probabilityOnTime = 25;
          probabilityLate = 70;
        } else {
          probabilityEarly = 1;
          probabilityOnTime = 9;
          probabilityLate = 90;
        }

        deadlineForecast.push({
          goalId: goal._id.toString(),
          goalTitle: goal.title,
          deadline,
          probabilityEarly,
          probabilityOnTime,
          probabilityLate
        });
      }
    }

    // 7. HABIT FORECAST
    const currentStreak = snapshot.behavior?.Activity?.currentStreak || 0;
    const activeDates = snapshot.behavior?.Activity?.activeDates || [];
    const isActiveToday = activeDates.includes(localTodayStr);

    const probabilityContinueTomorrow = isActiveToday 
      ? 99 
      : Math.round(snapshot.behavior?.Completion?.completionRate || 75);

    const probabilityContinueNextWeek = Math.round(
      Math.max(10, Math.min(95, overallConsistency * 0.95))
    );

    const probabilityLoseStreak = Math.max(1, 100 - probabilityContinueTomorrow);

    const habitEvidence = [
      `* Active contribution streak: ${currentStreak} days`,
      `* Focus activity logged today (${localTodayStr}): ${isActiveToday ? "Yes" : "No"}`,
      `* Baseline tomorrow streak survival probability: ${probabilityContinueTomorrow}%`
    ];

    // 8. AVERAGE CONFIDENCE
    let totalConfidenceScores = [
      roadmapCompletionConfidence,
      predictedConsistencyNextWeek,
      probabilityContinueTomorrow
    ];
    if (goalForecast.length > 0) {
      const avgGoalConfidence = goalForecast.reduce((sum, g) => sum + g.confidence, 0) / goalForecast.length;
      totalConfidenceScores.push(avgGoalConfidence);
    }
    const averageConfidence = Math.round(
      totalConfidenceScores.reduce((sum, val) => sum + val, 0) / totalConfidenceScores.length
    );

    // 9. ROLLING PREDICTIONS
    const rollingPredictions = profile.rollingPredictions || [];
    rollingPredictions.push({
      timestamp: new Date(),
      roadmapEstimatedRemainingDays: estimatedRemainingDays,
      overallConfidence: averageConfidence
    });

    // limit to last 60 predictions
    if (rollingPredictions.length > 60) {
      rollingPredictions.shift();
    }

    // Save profile values
    profile.completionForecast = {
      estimatedCompletionDate,
      estimatedRemainingDays,
      confidence: roadmapCompletionConfidence,
      evidence: completionEvidence
    };
    profile.dailyTaskForecast = dailyTaskForecast;
    profile.productivityForecast = productivityForecast;
    profile.consistencyForecast = {
      predictedConsistencyNextWeek,
      trendDirection,
      evidence: consistencyEvidence
    };
    profile.goalForecast = goalForecast;
    profile.deadlineForecast = deadlineForecast;
    profile.habitForecast = {
      currentStreak,
      probabilityContinueTomorrow,
      probabilityContinueNextWeek,
      probabilityLoseStreak,
      evidence: habitEvidence
    };
    profile.averageConfidence = averageConfidence;
    profile.rollingPredictions = rollingPredictions;
    profile.lastUpdated = new Date();

    await profile.save();

    // 10. DETECT SIGNIFICANT FORECAST SHIFTS & LOG EVENTS
    if (oldProfileDoc) {
      const oldRemaining = oldProfileDoc.completionForecast?.estimatedRemainingDays || 0;
      const oldProjectedConsistency = oldProfileDoc.consistencyForecast?.predictedConsistencyNextWeek || 0;

      // Completion shifted > 5 days
      if (Math.abs(estimatedRemainingDays - oldRemaining) > 5) {
        await PredictionEvent.create({
          uid,
          predictionType: "roadmap_completion",
          oldPrediction: `${oldRemaining} days remaining`,
          newPrediction: `${estimatedRemainingDays} days remaining`,
          confidence: roadmapCompletionConfidence,
          reason: `Roadmap completion forecast shifted from ${oldRemaining} to ${estimatedRemainingDays} days due to milestone velocity changes`
        });
      }

      // Projected consistency shift > 10%
      if (Math.abs(predictedConsistencyNextWeek - oldProjectedConsistency) > 10) {
        await PredictionEvent.create({
          uid,
          predictionType: "consistency_trend",
          oldPrediction: `${oldProjectedConsistency}%`,
          newPrediction: `${predictedConsistencyNextWeek}%`,
          confidence: averageConfidence,
          reason: `Projected next week consistency trend shifted from ${oldProjectedConsistency}% to ${predictedConsistencyNextWeek}%`
        });
      }

      // Goal shifts
      for (const goalProj of goalForecast) {
        const oldGoalProj = (oldProfileDoc.goalForecast || []).find((g: any) => g.goalId === goalProj.goalId);
        if (oldGoalProj && Math.abs(goalProj.confidence - oldGoalProj.confidence) > 10) {
          await PredictionEvent.create({
            uid,
            predictionType: "goal_forecast",
            oldPrediction: `${oldGoalProj.confidence}% confidence`,
            newPrediction: `${goalProj.confidence}% confidence`,
            confidence: goalProj.confidence,
            reason: `Goal prediction confidence for "${goalProj.goalTitle}" changed significantly`
          });
        }
      }
    }

    try {
      const { RiskEngine } = await import("./risk-engine.service");
      await RiskEngine.computeRiskProfile(uid);
    } catch (err) {
      console.error("[PredictionEngine] Failed to trigger RiskEngine:", err);
    }

    return profile;
  }

  // --- PRIVATE HELPERS ---

  private static getLocalTodayDateStr(timezone: string): string {
    try {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      };
      const formatter = new Intl.DateTimeFormat("en-US", options);
      const parts = formatter.formatToParts(new Date());
      const y = parts.find(p => p.type === "year")?.value;
      const m = parts.find(p => p.type === "month")?.value;
      const d = parts.find(p => p.type === "day")?.value;
      return `${y}-${m}-${d}`;
    } catch (err) {
      return new Date().toISOString().split("T")[0];
    }
  }

  private static isTimeBlockInPeriod(timeBlock: string, period: string): boolean {
    // e.g. timeBlock = "09:00 AM - 10:30 AM", period = "Morning"
    // Periods: Morning (06:00-12:00), Afternoon (12:00-18:00), Evening (18:00-24:00), Late Night (00:00-06:00)
    try {
      const parts = timeBlock.split("-");
      const start = parts[0].trim();
      let hour = 0;
      
      const match = start.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        hour = parseInt(match[1]);
        const ampm = match[3].toUpperCase();
        if (ampm === "PM" && hour < 12) hour += 12;
        if (ampm === "AM" && hour === 12) hour = 0;
      } else {
        const simple = start.match(/(\d+):(\d+)/);
        if (simple) hour = parseInt(simple[1]);
      }
      
      const lower = period.toLowerCase();
      if (lower.includes("morning") && hour >= 6 && hour < 12) return true;
      if (lower.includes("afternoon") && hour >= 12 && hour < 18) return true;
      if (lower.includes("evening") && hour >= 18 && hour < 24) return true;
      if (lower.includes("night") && (hour >= 0 && hour < 6)) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  private static isTimeBlockInPeakHours(timeBlock: string, peakHours: string): boolean {
    // e.g. timeBlock = "09:00 AM - 10:30 AM", peakHours = "08:00–11:00"
    try {
      const startPart = timeBlock.split("-")[0].trim();
      let startHour = 0;
      const startMatch = startPart.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (startMatch) {
        startHour = parseInt(startMatch[1]);
        if (startMatch[3].toUpperCase() === "PM" && startHour < 12) startHour += 12;
        if (startMatch[3].toUpperCase() === "AM" && startHour === 12) startHour = 0;
      } else {
        const simple = startPart.match(/(\d+):(\d+)/);
        if (simple) startHour = parseInt(simple[1]);
      }
      
      // Parse peakHours start
      // e.g. "08:00"
      const peakStartStr = peakHours.split("–")[0].trim();
      const peakStartHour = parseInt(peakStartStr.split(":")[0]);
      const peakEndStr = peakHours.split("–")[1]?.trim() || "";
      const peakEndHour = parseInt(peakEndStr.split(":")[0]) || peakStartHour + 3;
      
      return startHour >= peakStartHour && startHour < peakEndHour;
    } catch (e) {
      return false;
    }
  }
}
