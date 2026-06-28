import { RiskProfile } from "@/models/RiskProfile";
import { RiskEvent } from "@/models/RiskEvent";
import { UserIntelligenceSnapshotBuilder } from "./prediction-engine.service";

/**
 * RiskEngine.
 * Analyzes burnout, goal drift, deadline breaches, consistency collapse,
 * execution schedules, calendar overrides, and abandonment patterns.
 */
export class RiskEngine {
  /**
   * Retrieves or creates a default RiskProfile.
   */
  public static async getOrCreateProfile(uid: string): Promise<any> {
    let profile = await RiskProfile.findOne({ uid });
    if (!profile) {
      const defaultMetric = { score: 0, confidence: 100, evidence: [] };
      profile = await RiskProfile.create({
        uid,
        overallRisk: 0,
        burnoutRisk: defaultMetric,
        goalDriftRisk: defaultMetric,
        deadlineRisk: defaultMetric,
        consistencyRisk: defaultMetric,
        scheduleRisk: defaultMetric,
        executionRisk: defaultMetric,
        calendarRisk: defaultMetric,
        abandonmentRisk: defaultMetric,
        confidence: 100,
        activeWarnings: [],
        rollingRisk: []
      });
    }
    return profile;
  }

  /**
   * Computes risk metrics from snapshot.
   */
  public static async computeRiskProfile(uid: string): Promise<any> {
    const oldProfileDoc = await RiskProfile.findOne({ uid }).lean();
    const profile = await this.getOrCreateProfile(uid);
    const snapshot = await UserIntelligenceSnapshotBuilder.build(uid);

    const timezone = snapshot.profile?.briefSettings?.timezone || "UTC";
    const localTodayStr = this.getLocalTodayDateStr(timezone);

    // 1. BURNOUT RISK
    const avgFocusHours = snapshot.behavior?.Productivity?.averageCompletedHours || 1.5;
    const activeStreak = snapshot.behavior?.Activity?.currentStreak || 0;
    
    // Count overdue tasks
    const now = new Date();
    const overdueTasks = snapshot.execution.tasks.filter((t: any) => {
      if (t.status === "completed" || t.status === "skipped" || t.status === "archived") return false;
      if (t.status === "overdue") return true;
      if (t.deadline && new Date(t.deadline) < now) return true;
      return false;
    });
    const overdueCount = overdueTasks.length;

    let burnoutScore = 10;
    if (avgFocusHours > 6) burnoutScore += 15;
    if (avgFocusHours > 8) burnoutScore += 20;
    if (activeStreak > 7) burnoutScore += 10;
    if (activeStreak > 14) burnoutScore += 15;
    if (overdueCount > 3) burnoutScore += 10;
    if (overdueCount > 7) burnoutScore += 15;

    // Check if peak hour is late
    const peakHours = snapshot.behavior?.TimePreference?.peakHours || "";
    if (peakHours && (peakHours.includes("21:") || peakHours.includes("22:") || peakHours.includes("23:") || peakHours.includes("00:"))) {
      burnoutScore += 10;
    }
    burnoutScore = Math.min(100, Math.round(burnoutScore));

    const burnoutEvidence = [
      `* Average focus hours: ${avgFocusHours.toFixed(1)}h/day`,
      `* Active streak: ${activeStreak} consecutive days`,
      `* Overdue tasks: ${overdueCount} pending`,
      `* Peak productivity window: ${peakHours || "Not established"}`
    ];

    // 2. GOAL DRIFT RISK
    const goalConsistencyScore = snapshot.consistency?.Goals?.goalConsistencyScore || 50;
    const goalDriftScore = Math.min(100, Math.max(0, 100 - goalConsistencyScore));

    const primaryGoalTitle = snapshot.consistency?.Goals?.evidence?.[2]?.replace("* Top goal supported:", "")?.trim() || "Active Roadmap Goals";
    const goalDriftEvidence = [
      `* Goal alignment consistency: ${goalConsistencyScore}%`,
      `* Active Primary Goal: ${primaryGoalTitle}`,
      `* Non-relevance focus threshold: ${snapshot.consistency?.Goals?.completedIrrelevantHours || 0} hours spent on unrelated tasks`
    ];

    // 3. DEADLINE RISK
    const deadlineForecast = snapshot.prediction?.deadlineForecast || [];
    let deadlineScore = 15;
    const deadlineEvidence: string[] = [];

    if (deadlineForecast.length > 0) {
      // Find maximum probability of being late across all deadlines
      const maxLateProb = Math.max(...deadlineForecast.map((d: any) => d.probabilityLate));
      deadlineScore = maxLateProb;
      for (const d of deadlineForecast) {
        deadlineEvidence.push(`* Goal "${d.goalTitle}": Probability Late = ${d.probabilityLate}% (Early = ${d.probabilityEarly}%)`);
      }
    } else {
      deadlineEvidence.push("* No target deadlines scheduled on active goals.");
    }

    // 4. CONSISTENCY COLLAPSE RISK
    const overallConsistency = snapshot.consistency?.overallConsistency || 50;
    const sevenDayAvg = snapshot.consistency?.Trends?.sevenDayAvg || overallConsistency;
    const thirtyDayAvg = snapshot.consistency?.Trends?.thirtyDayAvg || overallConsistency;
    const trendDiff = sevenDayAvg - thirtyDayAvg;

    let consistencyCollapseScore = 20;
    if (trendDiff < -5) {
      consistencyCollapseScore = Math.min(95, 30 + Math.abs(trendDiff) * 3);
    } else if (trendDiff > 5) {
      consistencyCollapseScore = Math.max(5, 20 - trendDiff * 1.5);
    }

    const consistencyEvidence = [
      `* Overall Consistency: ${overallConsistency}%`,
      `* Short-term trend (7d vs 30d): ${trendDiff > 0 ? "+" : ""}${trendDiff.toFixed(1)}%`
    ];

    // 5. SCHEDULE RISK
    const todayTasks = snapshot.execution.tasks.filter(
      (t: any) => t.status !== "completed" && t.status !== "skipped" && 
                 (t.scheduledFor === localTodayStr || t.suggestedDate === localTodayStr)
    );
    let scheduleScore = 10;
    let mismatchCount = 0;
    const preferredWindow = snapshot.behavior?.TimePreference?.preferredWorkingWindow || "";

    if (todayTasks.length > 0) {
      for (const t of todayTasks) {
        if (t.timeBlock && preferredWindow) {
          const matched = this.isTimeBlockInPeriod(t.timeBlock, preferredWindow);
          if (!matched) mismatchCount++;
        }
      }
      const mismatchRatio = mismatchCount / todayTasks.length;
      scheduleScore = Math.min(98, Math.round(10 + mismatchRatio * 60));
    }

    const scheduleEvidence = [
      `* Today's tasks scheduled: ${todayTasks.length}`,
      `* Preferred working window: ${preferredWindow || "Not established"}`,
      `* Mismatch schedule blocks: ${mismatchCount} tasks scheduled outside productive slots`
    ];

    // 6. EXECUTION RISK
    const estimatedHoursRequired = todayTasks.length * 1.25; // 1.25 hours average per task
    let executionScore = 15;

    if (estimatedHoursRequired > avgFocusHours) {
      const ratio = estimatedHoursRequired / Math.max(0.5, avgFocusHours);
      executionScore = Math.min(100, Math.round(20 + (ratio - 1) * 80));
    }

    const executionEvidence = [
      `* Today's agenda requires: ~${estimatedHoursRequired.toFixed(1)} focus hours`,
      `* User's daily focus limit: ${avgFocusHours.toFixed(1)} hours`
    ];

    // 7. CALENDAR RISK
    const calendarScore = Math.min(100, Math.max(0, 100 - (snapshot.consistency?.Calendar?.calendarConsistencyScore || 100)));
    const calendarEvidence = [
      `* Calendar sync reliability: ${snapshot.consistency?.Calendar?.calendarConsistencyScore || 100}%`,
      `* Synced override rate: ${snapshot.consistency?.Calendar?.calendarOverrideRate || 0}%`
    ];

    // 8. ABANDONMENT RISK
    const briefLogs = snapshot.briefings?.logs || [];
    let unopenedStreak = 0;
    for (const log of briefLogs) {
      if (!log.opened) unopenedStreak++;
      else break;
    }

    // Days since last completed task
    let daysSinceLastActivity = 5;
    const completedTasks = snapshot.execution.tasks.filter((t: any) => t.status === "completed" && t.completedAt);
    if (completedTasks.length > 0) {
      const latestTask = completedTasks.reduce((latest: any, t: any) => {
        return !latest || new Date(t.completedAt) > new Date(latest.completedAt) ? t : latest;
      }, null);
      const diffMs = now.getTime() - new Date(latestTask.completedAt).getTime();
      daysSinceLastActivity = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    let abandonmentScore = 10;
    if (unopenedStreak > 3) abandonmentScore += 20;
    if (unopenedStreak > 7) abandonmentScore += 30;
    if (daysSinceLastActivity > 3) abandonmentScore += 20;
    if (daysSinceLastActivity > 7) abandonmentScore += 30;
    if (!snapshot.profile?.googleCalendarSettings?.accessToken) abandonmentScore += 10;
    abandonmentScore = Math.min(100, Math.round(abandonmentScore));

    const abandonmentEvidence = [
      `* Briefing unopened streak: ${unopenedStreak} days`,
      `* Days since last task action: ${daysSinceLastActivity} days`,
      `* Calendar connection status: ${snapshot.profile?.googleCalendarSettings?.accessToken ? "Connected" : "Disconnected"}`
    ];

    // OVERALL RISK (Weighted aggregation)
    const overallRisk = Math.round(
      burnoutScore * 0.20 +
      goalDriftScore * 0.20 +
      deadlineScore * 0.15 +
      consistencyCollapseScore * 0.15 +
      executionScore * 0.10 +
      scheduleScore * 0.10 +
      calendarScore * 0.05 +
      abandonmentScore * 0.05
    );

    // CONFIDENCE
    const avgConfidence = Math.round(
      (85 + 90 + (deadlineForecast.length > 0 ? 85 : 100) + 80 + 75 + 80 + 90 + 85) / 8
    );

    // ACTIVE WARNINGS
    const activeWarnings: string[] = [];
    if (burnoutScore >= 61) activeWarnings.push("High Burnout Risk Detected");
    if (goalDriftScore >= 61) activeWarnings.push("Significant Goal Drift Detected");
    if (deadlineScore >= 61) activeWarnings.push("Roadmap Deadlines Unrealistic");
    if (calendarScore >= 61) activeWarnings.push("Low Calendar Reliability");
    if (abandonmentScore >= 61) activeWarnings.push("High Abandonment Risk");

    // ROLLING RISK HISTORY
    const rollingRisk = profile.rollingRisk || [];
    rollingRisk.push({
      timestamp: new Date(),
      overallRisk,
      burnoutRisk: burnoutScore,
      goalDriftRisk: goalDriftScore,
      deadlineRisk: deadlineScore
    });

    if (rollingRisk.length > 60) {
      rollingRisk.shift();
    }

    // Save profile values
    profile.overallRisk = overallRisk;
    profile.burnoutRisk = { score: burnoutScore, confidence: 85, evidence: burnoutEvidence };
    profile.goalDriftRisk = { score: goalDriftScore, confidence: 90, evidence: goalDriftEvidence };
    profile.deadlineRisk = { score: deadlineScore, confidence: 85, evidence: deadlineEvidence };
    profile.consistencyRisk = { score: consistencyCollapseScore, confidence: 80, evidence: consistencyEvidence };
    profile.scheduleRisk = { score: scheduleScore, confidence: 75, evidence: scheduleEvidence };
    profile.executionRisk = { score: executionScore, confidence: 80, evidence: executionEvidence };
    profile.calendarRisk = { type: "calendar", score: calendarScore, confidence: 90, evidence: calendarEvidence };
    profile.abandonmentRisk = { score: abandonmentScore, confidence: 85, evidence: abandonmentEvidence };
    profile.confidence = avgConfidence;
    profile.activeWarnings = activeWarnings;
    profile.rollingRisk = rollingRisk;
    profile.lastUpdated = new Date();

    await profile.save();

    // LOG RISK EVENTS
    if (oldProfileDoc) {
      const risksToCheck = [
        { type: "burnout", newScore: burnoutScore, oldScore: oldProfileDoc.burnoutRisk?.score || 0 },
        { type: "goal_drift", newScore: goalDriftScore, oldScore: oldProfileDoc.goalDriftRisk?.score || 0 },
        { type: "deadline", newScore: deadlineScore, oldScore: oldProfileDoc.deadlineRisk?.score || 0 },
        { type: "consistency", newScore: consistencyCollapseScore, oldScore: oldProfileDoc.consistencyRisk?.score || 0 },
        { type: "execution", newScore: executionScore, oldScore: oldProfileDoc.executionRisk?.score || 0 },
        { type: "abandonment", newScore: abandonmentScore, oldScore: oldProfileDoc.abandonmentRisk?.score || 0 }
      ];

      for (const r of risksToCheck) {
        const severity = this.getSeverity(r.newScore);
        const oldSeverity = this.getSeverity(r.oldScore);

        // Boundary cross or change > 10%
        if (severity !== oldSeverity || Math.abs(r.newScore - r.oldScore) > 10) {
          await RiskEvent.create({
            uid,
            riskType: r.type,
            oldScore: r.oldScore,
            newScore: r.newScore,
            severity,
            reason: `Risk score for ${r.type.replace(/_/g, " ")} changed from ${r.oldScore}% to ${r.newScore}% (Severity: ${severity})`,
            resolved: r.newScore < 30 && r.oldScore >= 60,
            resolvedAt: (r.newScore < 30 && r.oldScore >= 60) ? new Date() : undefined
          });
        }
      }
    }

    return profile;
  }

  // --- PRIVATE HELPERS ---

  private static getSeverity(score: number): "Low" | "Moderate" | "High" | "Critical" {
    if (score <= 30) return "Low";
    if (score <= 60) return "Moderate";
    if (score <= 80) return "High";
    return "Critical";
  }

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
}
