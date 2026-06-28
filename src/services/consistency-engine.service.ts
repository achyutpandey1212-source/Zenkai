import { ConsistencyProfile } from "@/models/ConsistencyProfile";
import { ConsistencyEvent } from "@/models/ConsistencyEvent";
import { BehaviorProfile } from "@/models/BehaviorProfile";
import { IdentityTrait } from "@/models/IdentityTrait";
import { Goal } from "@/models/Goal";
import { Plan } from "@/models/Plan";
import { Milestone } from "@/models/Milestone";
import { Task } from "@/models/Task";
import { DailyAgenda } from "@/models/DailyAgenda";
import { BriefingLog } from "@/models/BriefingLog";
import { User } from "@/models/User";

export class ConsistencyEngine {
  /**
   * Retrieves or creates a ConsistencyProfile for a user.
   */
  public static async getOrCreateProfile(uid: string): Promise<any> {
    let profile = await ConsistencyProfile.findOne({ uid });
    if (!profile) {
      profile = await ConsistencyProfile.create({
        uid,
        overallConsistency: 0,
        scoreHistory: [],
        Identity: { identityAlignmentScore: 0, completedRelevantHours: 0, completedIrrelevantHours: 0, alignmentPercentage: 0, evidence: [] },
        Goals: { goalConsistencyScore: 0, goalHoursDistribution: [], topGoal: "", lowestSupportedGoal: "", evidence: [] },
        Planning: { planningConsistencyScore: 0, plannedTasks: 0, completedTasks: 0, rescheduledTasks: 0, missedTasks: 0, evidence: [] },
        Schedule: { scheduleReliabilityScore: 0, evidence: [] },
        Routine: { routineScore: 0, preferredRoutine: "", daysFollowingRoutine: 0, evidence: [] },
        Calendar: { calendarConsistencyScore: 0, calendarOverrideRate: 0, evidence: [] },
        Commitment: { commitmentScore: 0, plansStarted: 0, plansFinished: 0, plansAbandoned: 0, milestonesFinished: 0, averageDelay: 0, evidence: [] },
        Drift: { goalDriftDetected: false, goalDriftPercentage: 0, driftingGoal: "", evidence: [] },
        Trends: { sevenDayAvg: 0, thirtyDayAvg: 0, lifetimeAvg: 0 }
      });
    }
    return profile;
  }

  /**
   * Computes the full ConsistencyProfile for a user.
   * This is 100% deterministic and evidence-backed.
   */
  public static async computeConsistencyProfile(uid: string): Promise<any> {
    const oldProfileDoc = await ConsistencyProfile.findOne({ uid }).lean();
    const profile = await this.getOrCreateProfile(uid);

    // 0. Load inputs
    const [
      user,
      bp,
      activeTraits,
      rawActiveGoals,
      rawPlans,
      rawMilestones,
      rawCompletedTasks,
      briefingLogs,
      agendas
    ] = await Promise.all([
      User.findOne({ firebaseUid: uid }).lean(),
      BehaviorProfile.findOne({ uid }).lean(),
      IdentityTrait.find({ firebaseUid: uid, status: "active" }).lean(),
      Goal.find({ firebaseUid: uid, status: "active" }).lean(),
      Plan.find({ firebaseUid: uid }).lean(),
      Milestone.find({ firebaseUid: uid }).lean(),
      Task.find({ firebaseUid: uid, status: "completed" }).lean(),
      BriefingLog.find({ uid, status: "success" }).sort({ createdAt: -1 }).limit(14).lean(),
      DailyAgenda.find({ firebaseUid: uid }).sort({ date: -1 }).limit(14).lean()
    ]);

    const nonArchivedPlans = rawPlans.filter(p => p.status !== "archived");
    const nonArchivedPlanIds = new Set(nonArchivedPlans.map(p => p._id.toString()));

    const milestones = rawMilestones.filter(m => nonArchivedPlanIds.has(m.planId?.toString()));
    const activeGoals = rawActiveGoals.filter(g => !g.planId || nonArchivedPlanIds.has(g.planId.toString()));
    const activeGoalIds = new Set(activeGoals.map(g => g._id.toString()));
    const completedTasks = rawCompletedTasks.filter(t => !t.goalId || activeGoalIds.has(t.goalId.toString()));
    const plans = nonArchivedPlans;

    const timezone = user?.briefSettings?.timezone || "UTC";

    // 1. IDENTITY ALIGNMENT
    let identityAlignmentScore = 100;
    let completedRelevantHours = 0;
    let completedIrrelevantHours = 0;
    let alignmentPercentage = 100;
    let identityEvidence: string[] = [];

    const primaryTrait = activeTraits.find(t => t.category === "core_identity") || 
                         activeTraits.find(t => t.category === "aspiration") || 
                         activeTraits[0];

    if (!primaryTrait) {
      identityEvidence = ["* No active identity traits defined. Defaulting to 100% alignment."];
    } else {
      const stopwords = new Set(["a", "an", "the", "of", "to", "in", "on", "at", "become", "becoming", "and", "is", "for", "with", "my", "your", "by", "from", "as", "about"]);
      const tokens = primaryTrait.trait
        .toLowerCase()
        .split(/\s+/)
        .map(w => w.replace(/[^a-z0-9]/g, ""))
        .filter(w => w.length >= 3 && !stopwords.has(w));

      let relevantMin = 0;
      let irrelevantMin = 0;

      for (const task of completedTasks) {
        const est = task.estimatedMinutes || 30;
        let isRelevant = false;

        const tTitle = task.title.toLowerCase();
        const tDesc = (task.description || "").toLowerCase();

        for (const tok of tokens) {
          if (tTitle.includes(tok) || tDesc.includes(tok)) {
            isRelevant = true;
            break;
          }
        }
        
        if (isRelevant) {
          relevantMin += est;
        } else {
          irrelevantMin += est;
        }
      }

      completedRelevantHours = relevantMin / 60;
      completedIrrelevantHours = irrelevantMin / 60;
      const totalHours = completedRelevantHours + completedIrrelevantHours;
      alignmentPercentage = totalHours > 0 ? (completedRelevantHours / totalHours) * 100 : 100;
      identityAlignmentScore = Math.round(alignmentPercentage);
      identityEvidence = [
        `* ${completedRelevantHours.toFixed(1)}h contributed toward "${primaryTrait.trait}"`,
        `* ${completedIrrelevantHours.toFixed(1)}h unrelated work`,
        `* ${identityAlignmentScore}% of completed focus hours align with your primary identity`
      ];
    }

    // 2. GOAL CONSISTENCY
    let goalConsistencyScore = 100;
    let goalHoursDistribution: { goalTitle: string; hours: number }[] = [];
    let topGoal = "";
    let lowestSupportedGoal = "";
    let goalEvidence: string[] = [];

    if (activeGoals.length === 0 || completedTasks.length === 0) {
      goalEvidence = ["* No active goals or completed tasks recorded. Goal consistency is at 100%."];
    } else {
      const goalHoursMap: Record<string, number> = {};
      let totalCompletedHours = 0;
      let weightedHours = 0;

      for (const g of activeGoals) {
        goalHoursMap[g.title] = 0;
      }

      for (const task of completedTasks) {
        const hours = (task.estimatedMinutes || 30) / 60;
        totalCompletedHours += hours;

        if (task.goalId) {
          const matchedGoal = activeGoals.find(g => g._id.toString() === task.goalId?.toString());
          if (matchedGoal) {
            goalHoursMap[matchedGoal.title] = (goalHoursMap[matchedGoal.title] || 0) + hours;
            // weight priority: priority 1 gets 1.0, 2 gets 0.8, 3 gets 0.6, 4 gets 0.4, 5+ gets 0.2
            const weight = Math.max(0.2, 1.2 - 0.2 * matchedGoal.priority);
            weightedHours += hours * weight;
          }
        }
      }

      goalConsistencyScore = totalCompletedHours > 0 ? Math.round((weightedHours / totalCompletedHours) * 100) : 100;
      goalHoursDistribution = Object.entries(goalHoursMap).map(([goalTitle, hours]) => ({ goalTitle, hours }));

      const sortedGoals = [...activeGoals].sort((a, b) => {
        const hoursA = goalHoursMap[a.title] || 0;
        const hoursB = goalHoursMap[b.title] || 0;
        return hoursB - hoursA; // descending
      });

      if (sortedGoals.length > 0) {
        topGoal = sortedGoals[0].title;
        // lowest supported is the one with lowest hours that is > 0
        const nonZeroGoals = sortedGoals.filter(g => (goalHoursMap[g.title] || 0) > 0);
        if (nonZeroGoals.length > 0) {
          lowestSupportedGoal = nonZeroGoals[nonZeroGoals.length - 1].title;
        } else {
          lowestSupportedGoal = sortedGoals[sortedGoals.length - 1].title;
        }
      }

      goalEvidence = [
        `* Completed ${totalCompletedHours.toFixed(1)}h of task work`,
        `* Spent work distribution weighted towards high priority goals: ${goalConsistencyScore}% consistency`,
        `* Top goal supported: "${topGoal || "None"}" (${(goalHoursMap[topGoal] || 0).toFixed(1)}h)`,
        `* Lowest supported goal: "${lowestSupportedGoal || "None"}" (${(goalHoursMap[lowestSupportedGoal] || 0).toFixed(1)}h)`
      ];
    }

    // 3. PLANNING CONSISTENCY
    let planningConsistencyScore = 100;
    let plannedTasksCount = 0;
    let completedTasksCount = 0;
    let rescheduledTasksCount = 0;
    let missedTasksCount = 0;
    let planningEvidence: string[] = [];

    if (!bp) {
      planningEvidence = ["* No behavior profile metrics have been computed yet."];
    } else {
      completedTasksCount = bp.Completion.completedTasks || 0;
      missedTasksCount = bp.Completion.skippedTasks || 0;
      rescheduledTasksCount = bp.Completion.overdueTasks || 0;
      plannedTasksCount = completedTasksCount + missedTasksCount + rescheduledTasksCount;
      planningConsistencyScore = Math.round(bp.Completion.completionRate || 0);

      planningEvidence = [
        `* Planned ${plannedTasksCount} tasks in Zenkai`,
        `* Finished ${completedTasksCount} tasks (${planningConsistencyScore}% completion rate)`,
        `* Deferred/Rescheduled ${rescheduledTasksCount} tasks`,
        `* Skipped/Missed ${missedTasksCount} tasks`
      ];
    }

    // 4. SCHEDULE CONSISTENCY
    let scheduleReliabilityScore = 100;
    let scheduleEvidence: string[] = [];

    // Fetch scheduled tasks in trailing 7 days
    const date7dAgo = new Date();
    date7dAgo.setDate(date7dAgo.getDate() - 7);
    const date7dAgoStr = date7dAgo.toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];

    const recentTasks = await Task.find({
      firebaseUid: uid,
      timeBlock: { $nin: [null, ""] },
      $or: [
        { scheduledFor: { $ne: "" } },
        { suggestedDate: { $ne: "" } }
      ]
    }).lean();

    const recentScheduled = recentTasks.filter(t => {
      const dateStr = t.scheduledFor || t.suggestedDate;
      return dateStr && dateStr >= date7dAgoStr && dateStr <= todayStr;
    });

    if (recentScheduled.length === 0) {
      scheduleEvidence = ["* No time-blocked tasks scheduled in the last 7 days."];
    } else {
      const scheduleScores: number[] = [];
      let onTimeCount = 0;
      let delayedCount = 0;
      let missedCount = 0;

      for (const t of recentScheduled) {
        if (t.status === "completed" && t.completedAt) {
          const rawDate = t.scheduledFor || t.suggestedDate;
          const dateStr = rawDate instanceof Date ? rawDate.toISOString().split("T")[0] : (rawDate || "");
          const scheduledStart = this.parseStartFromTimeBlock(t.timeBlock || "", dateStr, timezone);
          if (scheduledStart) {
            const devMin = Math.abs(t.completedAt.getTime() - scheduledStart.getTime()) / (1000 * 60);
            let score = 100;
            if (devMin <= 15) {
              score = 100;
              onTimeCount++;
            } else if (devMin <= 60) {
              score = 90;
              delayedCount++;
            } else if (devMin <= 180) {
              score = 70;
              delayedCount++;
            } else if (devMin <= 360) {
              score = 50;
              delayedCount++;
            } else {
              score = 20;
              delayedCount++;
            }
            scheduleScores.push(score);
          }
        } else if (t.status !== "completed" && t.status !== "in_progress") {
          // missed or skipped scheduled task
          scheduleScores.push(0);
          missedCount++;
        }
      }

      scheduleReliabilityScore = scheduleScores.length > 0 ? Math.round(scheduleScores.reduce((a, b) => a + b, 0) / scheduleScores.length) : 100;
      scheduleEvidence = [
        `* Evaluated ${scheduleScores.length} scheduled time-blocked tasks`,
        `* Completed on-time (within 15m): ${onTimeCount}`,
        `* Completed with schedule deviation: ${delayedCount}`,
        `* Missed scheduled tasks: ${missedCount}`
      ];
    }

    // 5. ROUTINE CONSISTENCY
    let routineScore = 100;
    let preferredRoutine = "";
    let daysFollowingRoutine = 0;
    let routineEvidence: string[] = [];

    const morningLogs = briefingLogs.filter(l => l.type === "morning" && l.openedAt);
    const eveningLogs = briefingLogs.filter(l => l.type === "evening" && l.openedAt);

    const morningHours = morningLogs.map(l => this.getLocalDecimalHour(l.openedAt!, timezone));
    const eveningHours = eveningLogs.map(l => this.getLocalDecimalHour(l.openedAt!, timezone));
    const agendaHours = agendas.map(a => this.getLocalDecimalHour(a.createdAt, timezone));

    const sdMorning = this.calculateStdDev(morningHours);
    const sdEvening = this.calculateStdDev(eveningHours);
    const sdAgenda = this.calculateStdDev(agendaHours);

    let routineScoresAccum: number[] = [];
    if (morningHours.length >= 2) {
      routineScoresAccum.push(Math.max(20, Math.round(100 - sdMorning * 25)));
    }
    if (eveningHours.length >= 2) {
      routineScoresAccum.push(Math.max(20, Math.round(100 - sdEvening * 25)));
    }
    if (agendaHours.length >= 2) {
      routineScoresAccum.push(Math.max(20, Math.round(100 - sdAgenda * 25)));
    }

    routineScore = routineScoresAccum.length > 0 ? Math.round(routineScoresAccum.reduce((a, b) => a + b, 0) / routineScoresAccum.length) : 80;

    // preferredRoutine
    if (agendaHours.length > 0) {
      const avgAgendaHour = agendaHours.reduce((a, b) => a + b, 0) / agendaHours.length;
      const hh = Math.floor(avgAgendaHour);
      const mm = Math.round((avgAgendaHour - hh) * 60);
      preferredRoutine = `Morning Agenda & Brief (${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")})`;

      // count how many days the user generated agenda within 1 hour of the average
      daysFollowingRoutine = agendas.filter(a => {
        const hr = this.getLocalDecimalHour(a.createdAt, timezone);
        return Math.abs(hr - avgAgendaHour) <= 1.0;
      }).length;
    } else {
      preferredRoutine = "Not established";
      daysFollowingRoutine = 0;
    }

    routineEvidence = [
      `* Morning Brief open variation: ±${sdMorning.toFixed(1)}h (from ${morningHours.length} opens)`,
      `* Evening Brief open variation: ±${sdEvening.toFixed(1)}h (from ${eveningHours.length} opens)`,
      `* Agenda generation variation: ±${sdAgenda.toFixed(1)}h (from ${agendaHours.length} days)`,
      `* Followed routine on ${daysFollowingRoutine} of last 14 days`
    ];

    // 6. CALENDAR CONSISTENCY
    let calendarConsistencyScore = 100;
    let calendarOverrideRate = 0;
    let calendarEvidence: string[] = [];

    const isCalConnected = user?.googleCalendarSettings?.accessToken || false;
    if (!isCalConnected) {
      calendarConsistencyScore = 0;
      calendarOverrideRate = 0;
      calendarEvidence = ["* Google Calendar integration is not active for this account."];
    } else {
      const syncedTasks = await Task.find({
        firebaseUid: uid,
        googleCalendarEventId: { $nin: [null, ""] }
      }).lean();

      const totalSynced = syncedTasks.length;
      const conflictSynced = syncedTasks.filter(t => t.googleCalendarConflict).length;
      calendarOverrideRate = totalSynced > 0 ? Math.round((conflictSynced / totalSynced) * 100) : 0;
      calendarConsistencyScore = bp ? Math.round(bp.Calendar.calendarCompletionRate || 0) : 100;

      calendarEvidence = [
        `* Synced task completion rate: ${calendarConsistencyScore}%`,
        `* External overrides / conflicts resolved: ${conflictSynced} of ${totalSynced} tasks (${calendarOverrideRate}%)`
      ];
    }

    // 7. COMMITMENT RELIABILITY
    let commitmentScore = 100;
    let plansStarted = plans.length;
    let plansFinished = plans.filter(p => p.status === "completed").length;
    let plansAbandoned = plans.filter(p => p.status === "archived").length;
    let milestonesFinished = milestones.filter(m => m.status === "completed").length;
    let averageDelay = 0;
    let commitmentEvidence: string[] = [];

    const completedMilestones = milestones.filter(m => m.status === "completed" && m.endDate);
    if (completedMilestones.length > 0) {
      let totalDelayDays = 0;
      for (const m of completedMilestones) {
        const end = new Date(m.endDate! + "T12:00:00");
        const comp = new Date(m.updatedAt);
        const delay = (comp.getTime() - end.getTime()) / (1000 * 60 * 60 * 24);
        if (delay > 0) totalDelayDays += delay;
      }
      averageDelay = totalDelayDays / completedMilestones.length;
    }

    commitmentScore = Math.max(0, Math.min(100, Math.round(100 - (plansAbandoned * 10) - (averageDelay * 5))));
    commitmentEvidence = [
      `* Active / Started plans: ${plansStarted}`,
      `* Completed plans: ${plansFinished}, Abandoned: ${plansAbandoned}`,
      `* Completed milestones: ${milestonesFinished}`,
      `* Average milestone deadline delay: ${averageDelay.toFixed(1)} days`
    ];

    // 8. GOAL DRIFT DETECTION
    let goalDriftDetected = false;
    let goalDriftPercentage = 0;
    let driftingGoal = "";
    let driftEvidence: string[] = [];

    const primaryGoal = [...activeGoals].sort((a, b) => a.priority - b.priority)[0]; // priority 1 is top
    if (!primaryGoal) {
      goalDriftDetected = false;
      goalDriftPercentage = 0;
      driftingGoal = "";
      driftEvidence = ["* No active goals defined to monitor for goal drift."];
    } else {
      // Look at completed tasks in the last 7 days
      const completedRecent = completedTasks.filter(t => {
        return new Date(t.completedAt || t.updatedAt) >= date7dAgo;
      });

      let totalHrs = 0;
      let primaryHrs = 0;

      for (const t of completedRecent) {
        const hrs = (t.estimatedMinutes || 30) / 60;
        totalHrs += hrs;
        if (t.goalId?.toString() === primaryGoal._id.toString()) {
          primaryHrs += hrs;
        }
      }

      if (totalHrs > 0) {
        const primaryRatio = primaryHrs / totalHrs;
        const unrelatedRatio = (totalHrs - primaryHrs) / totalHrs;

        if (primaryRatio < 0.25 && unrelatedRatio > 0.50) {
          goalDriftDetected = true;
          goalDriftPercentage = Math.round(unrelatedRatio * 100);
          driftingGoal = primaryGoal.title;
          driftEvidence = [
            `* Warning: Goal Drift Detected!`,
            `* Primary priority "${primaryGoal.title}" received only ${(primaryRatio * 100).toFixed(0)}% of your completed focus hours`,
            `* ${goalDriftPercentage}% of focus work was spent on unrelated tasks or lower priority goals`
          ];
        } else {
          goalDriftDetected = false;
          goalDriftPercentage = 0;
          driftingGoal = "";
          driftEvidence = [
            `* Behavior matches active priority: "${primaryGoal.title}"`,
            `* Time spent on primary priority: ${(primaryRatio * 100).toFixed(0)}% of completed focus hours`
          ];
        }
      } else {
        goalDriftDetected = false;
        goalDriftPercentage = 0;
        driftingGoal = "";
        driftEvidence = ["* Insufficient focus hour completions in the last 7 days to calculate drift."];
      }
    }

    // 9. OVERALL CONSISTENCY SCORE
    // Weighted formula:
    // Identity: 30%, Goals: 20%, Planning: 15%, Schedule: 10%, Routine: 10%, Commitment: 10%, Calendar: 5% (distribute if not connected)
    let weights = {
      Identity: 0.30,
      Goals: 0.20,
      Planning: 0.15,
      Schedule: 0.10,
      Routine: 0.10,
      Commitment: 0.10,
      Calendar: 0.05
    };

    if (!isCalConnected) {
      weights.Calendar = 0.00;
      weights.Identity = 0.35; // redistribute
    }

    const overallConsistency = Math.round(
      identityAlignmentScore * weights.Identity +
      goalConsistencyScore * weights.Goals +
      planningConsistencyScore * weights.Planning +
      scheduleReliabilityScore * weights.Schedule +
      routineScore * weights.Routine +
      commitmentScore * weights.Commitment +
      calendarConsistencyScore * weights.Calendar
    );

    // Update history
    const scoreHistory = profile.scoreHistory || [];
    scoreHistory.push({ score: overallConsistency, timestamp: new Date() });
    
    // limit to 365 entries
    if (scoreHistory.length > 365) {
      scoreHistory.shift();
    }

    // Compute trends
    const now = new Date();
    const ms7d = 7 * 24 * 60 * 60 * 1000;
    const ms30d = 30 * 24 * 60 * 60 * 1000;

    const scores7d = scoreHistory.filter((sh: any) => now.getTime() - new Date(sh.timestamp).getTime() <= ms7d);
    const scores30d = scoreHistory.filter((sh: any) => now.getTime() - new Date(sh.timestamp).getTime() <= ms30d);

    const sevenDayAvg = scores7d.length > 0 ? Math.round(scores7d.reduce((sum: number, sh: any) => sum + sh.score, 0) / scores7d.length) : overallConsistency;
    const thirtyDayAvg = scores30d.length > 0 ? Math.round(scores30d.reduce((sum: number, sh: any) => sum + sh.score, 0) / scores30d.length) : overallConsistency;
    const lifetimeAvg = scoreHistory.length > 0 ? Math.round(scoreHistory.reduce((sum: number, sh: any) => sum + sh.score, 0) / scoreHistory.length) : overallConsistency;

    // Apply values to profile
    profile.overallConsistency = overallConsistency;
    profile.scoreHistory = scoreHistory;

    profile.Identity = {
      identityAlignmentScore,
      completedRelevantHours,
      completedIrrelevantHours,
      alignmentPercentage,
      evidence: identityEvidence
    };

    profile.Goals = {
      goalConsistencyScore,
      goalHoursDistribution,
      topGoal,
      lowestSupportedGoal,
      evidence: goalEvidence
    };

    profile.Planning = {
      planningConsistencyScore,
      plannedTasks: plannedTasksCount,
      completedTasks: completedTasksCount,
      rescheduledTasks: rescheduledTasksCount,
      missedTasks: missedTasksCount,
      evidence: planningEvidence
    };

    profile.Schedule = {
      scheduleReliabilityScore,
      evidence: scheduleEvidence
    };

    profile.Routine = {
      routineScore,
      preferredRoutine,
      daysFollowingRoutine,
      evidence: routineEvidence
    };

    profile.Calendar = {
      calendarConsistencyScore,
      calendarOverrideRate,
      evidence: calendarEvidence
    };

    profile.Commitment = {
      commitmentScore,
      plansStarted,
      plansFinished,
      plansAbandoned,
      milestonesFinished,
      averageDelay,
      evidence: commitmentEvidence
    };

    profile.Drift = {
      goalDriftDetected,
      goalDriftPercentage,
      driftingGoal,
      evidence: driftEvidence
    };

    profile.Trends = {
      sevenDayAvg,
      thirtyDayAvg,
      lifetimeAvg
    };

    profile.lastUpdated = new Date();

    await profile.save();

    // 10. GENERATE CONSISTENCY EVENTS
    if (oldProfileDoc) {
      const oldIdentityScore = oldProfileDoc.Identity?.identityAlignmentScore || 0;
      const oldPlanningScore = oldProfileDoc.Planning?.planningConsistencyScore || 0;
      const oldRoutineScore = oldProfileDoc.Routine?.routineScore || 0;
      const oldDrift = oldProfileDoc.Drift?.goalDriftDetected || false;

      // Identity Alignment Improved
      if (identityAlignmentScore - oldIdentityScore >= 5) {
        await ConsistencyEvent.create({
          uid,
          type: "identity_alignment_improved",
          scoreBefore: oldIdentityScore,
          scoreAfter: identityAlignmentScore,
          reason: `Identity alignment with "${primaryTrait?.trait || "Primary Identity"}" improved from ${oldIdentityScore}% to ${identityAlignmentScore}%`,
          evidence: identityEvidence
        });
      }

      // Planning Reliability Dropped
      if (oldPlanningScore - planningConsistencyScore >= 10) {
        await ConsistencyEvent.create({
          uid,
          type: "planning_reliability_dropped",
          scoreBefore: oldPlanningScore,
          scoreAfter: planningConsistencyScore,
          reason: `Planning consistency dropped from ${oldPlanningScore}% to ${planningConsistencyScore}% due to deferred or skipped tasks`,
          evidence: planningEvidence
        });
      }

      // Goal Drift Detected
      if (!oldDrift && goalDriftDetected) {
        await ConsistencyEvent.create({
          uid,
          type: "goal_drift_detected",
          scoreBefore: 0,
          scoreAfter: goalDriftPercentage,
          reason: `Goal Drift Detected: Behavior drifted away from primary goal "${driftingGoal}"`,
          evidence: driftEvidence
        });
      }

      // Routine Established
      if (oldRoutineScore < 85 && routineScore >= 85) {
        await ConsistencyEvent.create({
          uid,
          type: "routine_established",
          scoreBefore: oldRoutineScore,
          scoreAfter: routineScore,
          reason: `A stable routine has been established with routine score reaching ${routineScore}%`,
          evidence: routineEvidence
        });
      }

      // Streak milestones
      const newStreak = bp?.Activity?.currentStreak || 0;
      if (newStreak > 0 && newStreak % 5 === 0) {
        const alreadyLogged = await ConsistencyEvent.exists({
          uid,
          type: "longest_consistency_streak",
          scoreAfter: newStreak
        });
        if (!alreadyLogged) {
          await ConsistencyEvent.create({
            uid,
            type: "longest_consistency_streak",
            scoreBefore: newStreak - 5,
            scoreAfter: newStreak,
            reason: `New consistency streak milestone reached: ${newStreak} consecutive active days!`,
            evidence: [`* Active days streak: ${newStreak}`]
          });
        }
      }
    }

    try {
      const { PredictionEngine } = await import("./prediction-engine.service");
      await PredictionEngine.computePredictionProfile(uid);
    } catch (err) {
      console.error("[ConsistencyEngine] Failed to trigger PredictionEngine:", err);
    }

    return profile;
  }

  // --- HELPERS ---

  private static parseStartFromTimeBlock(timeBlock: string, dateStr: string, timezone: string): Date | null {
    if (!timeBlock) return null;
    try {
      const parts = timeBlock.split("-");
      const startPart = parts[0].trim();
      
      let hour = 0;
      let minute = 0;
      
      const ampmMatch = startPart.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (ampmMatch) {
        hour = parseInt(ampmMatch[1]);
        minute = parseInt(ampmMatch[2]);
        const ampm = ampmMatch[3].toUpperCase();
        if (ampm === "PM" && hour < 12) hour += 12;
        if (ampm === "AM" && hour === 12) hour = 0;
      } else {
        const match = startPart.match(/(\d+):(\d+)/);
        if (match) {
          hour = parseInt(match[1]);
          minute = parseInt(match[2]);
        } else {
          return null;
        }
      }
      
      const [y, m, d] = dateStr.split("-").map(Number);
      // Construct date object in local time context
      const targetDate = new Date(y, m - 1, d, hour, minute, 0);
      return targetDate;
    } catch (err) {
      return null;
    }
  }

  private static getLocalDecimalHour(date: Date, timezone: string): number {
    try {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: false
      };
      const formatter = new Intl.DateTimeFormat("en-US", options);
      const formatted = formatter.format(date);
      const [h, m, s] = formatted.split(":").map(Number);
      return h + m / 60 + s / 3600;
    } catch (err) {
      // Fallback to UTC decimal hour
      return date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    }
  }

  private static calculateStdDev(hours: number[]): number {
    if (hours.length < 2) return 0;
    const avg = hours.reduce((a, b) => a + b, 0) / hours.length;
    const variance = hours.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / (hours.length - 1);
    return Math.sqrt(variance);
  }
}
