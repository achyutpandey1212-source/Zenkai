import { AdaptivePolicy, IAdaptivePolicy } from "@/models/AdaptivePolicy";
import { UserIntelligenceSnapshotBuilder } from "./prediction-engine.service";

/**
 * AdaptiveCognitionEngine.
 * Analyzes behavior, consistency, prediction, and risk metrics
 * to produce an adaptive policy that regulates Zenkai components.
 */
export class AdaptiveCognitionEngine {
  
  // Standard Default Preferences
  private static DEFAULTS: Record<string, any> = {
    preferredWorkWindow: "morning",
    preferredTaskDuration: 45,
    preferredBreakDuration: 10,
    preferredAgendaDensity: "balanced",
    planningAggressiveness: "balanced",
    roadmapGranularity: "balanced",
    executionStyle: "batch",
    calendarBufferMinutes: 15,
    preferredReflectionLength: "medium",
    preferredBriefStyle: "medium",
    preferredCompanionTone: "direct",
    motivationStyle: "achievement",
    notificationVerbosity: "normal",
    scheduleFlexibility: "flexible",
    preferredFocusSessionLength: 40,
    preferredRecoveryTime: 15,
    preferredPlanningDepth: "balanced",
    preferredDeadlineBuffer: 2
  };

  /**
   * Resolves the active value for an adaptation based on its confidence and tier constraints.
   */
  public static getActiveValue(adaptationKey: string, adaptationObj: any): any {
    const value = adaptationObj.value;
    const confidence = adaptationObj.confidence;
    const defaultValue = this.DEFAULTS[adaptationKey];

    // Tier 1: Confidence < 0.60 → Observe only, don't change behavior (return default)
    if (confidence < 0.60) {
      return defaultValue;
    }

    // Tier 2: Confidence 0.60–0.80 → Make soft adaptations only
    const softKeys = [
      "preferredBriefStyle",
      "preferredCompanionTone",
      "notificationVerbosity",
      "motivationStyle"
    ];
    if (confidence < 0.80 && !softKeys.includes(adaptationKey)) {
      return defaultValue;
    }

    // Tier 3: Confidence > 0.80 → Allow strong adaptations (planning, work windows, buffers, density)
    return value;
  }

  /**
   * Gets or creates the default AdaptivePolicy.
   */
  public static async getOrCreatePolicy(uid: string): Promise<any> {
    let policy = await AdaptivePolicy.findOne({ uid });
    if (!policy) {
      const now = new Date();
      const defaultAdaptations: Record<string, any> = {};

      for (const [key, val] of Object.entries(this.DEFAULTS)) {
        defaultAdaptations[key] = {
          value: val,
          confidence: 0.50, // Starts at 0.50 (low confidence / default)
          lastUpdated: now,
          derivedFrom: ["defaults"]
        };
      }

      policy = await AdaptivePolicy.create({
        uid,
        updatedAt: now,
        confidence: 0.50,
        adaptations: defaultAdaptations,
        history: [],
        reasoning: {}
      });
    }
    return policy;
  }

  /**
   * Computes the adaptive policy for a user.
   */
  public static async computeAdaptivePolicy(uid: string): Promise<any> {
    const oldPolicyDoc = await AdaptivePolicy.findOne({ uid }).lean();
    const policy = await this.getOrCreatePolicy(uid);
    const snapshot = await UserIntelligenceSnapshotBuilder.build(uid);

    const now = new Date();
    const newAdaptations: Record<string, any> = {};
    const newReasoning: Record<string, string> = {};

    // 1. WORK WINDOW
    const avgFocusHours = snapshot.behavior?.Productivity?.averageCompletedHours || 1.5;
    const peakHours = snapshot.behavior?.TimePreference?.peakHours || "";
    let workWindow: "morning" | "afternoon" | "evening" | "night" = "morning";
    let windowConf = 0.55;
    let windowReason = "Standard morning default working window.";

    if (peakHours) {
      windowConf = 0.85;
      if (peakHours.includes("18:") || peakHours.includes("19:") || peakHours.includes("20:") || peakHours.includes("21:")) {
        workWindow = "evening";
        windowReason = "Peak focus activity indicates highest productivity during evening hours.";
      } else if (peakHours.includes("22:") || peakHours.includes("23:") || peakHours.includes("00:") || peakHours.includes("01:")) {
        workWindow = "night";
        windowReason = "Peak focus activity indicates highest productivity during night hours.";
      } else if (peakHours.includes("12:") || peakHours.includes("13:") || peakHours.includes("14:") || peakHours.includes("15:") || peakHours.includes("16:") || peakHours.includes("17:")) {
        workWindow = "afternoon";
        windowReason = "Peak focus activity indicates highest productivity during afternoon hours.";
      } else {
        workWindow = "morning";
        windowReason = "Peak focus activity indicates highest productivity during morning hours.";
      }
    }
    newAdaptations.preferredWorkWindow = {
      value: workWindow,
      confidence: windowConf,
      lastUpdated: now,
      derivedFrom: ["behavior"]
    };
    newReasoning.preferredWorkWindow = windowReason;

    // 2. FOCUS SESSION LENGTH & BREAKS
    let focusSession = 40;
    let breakDuration = 10;
    let focusConf = 0.70;
    let focusReason = "Standard balanced deep work block size.";

    if (avgFocusHours > 4) {
      focusSession = 50;
      breakDuration = 15;
      focusConf = 0.85;
      focusReason = "High average focus times imply optimal capacity for longer deep-work blocks (50m).";
    } else if (avgFocusHours > 0 && avgFocusHours < 1.5) {
      focusSession = 25;
      breakDuration = 5;
      focusConf = 0.85;
      focusReason = "Shorter focus streaks suggest a Pomodoro structure (25m) maximizes work consistency.";
    }

    newAdaptations.preferredFocusSessionLength = {
      value: focusSession,
      confidence: focusConf,
      lastUpdated: now,
      derivedFrom: ["behavior"]
    };
    newReasoning.preferredFocusSessionLength = focusReason;

    newAdaptations.preferredBreakDuration = {
      value: breakDuration,
      confidence: focusConf - 0.05,
      lastUpdated: now,
      derivedFrom: ["behavior"]
    };
    newReasoning.preferredBreakDuration = `Break adjusted to ${breakDuration}m to support a ${focusSession}m focus session.`;

    // 3. TASK DURATION & RECOVERY
    newAdaptations.preferredTaskDuration = {
      value: focusSession,
      confidence: focusConf,
      lastUpdated: now,
      derivedFrom: ["behavior"]
    };
    newReasoning.preferredTaskDuration = `Task length calibrated to align with deep-work session length (${focusSession}m).`;

    newAdaptations.preferredRecoveryTime = {
      value: breakDuration + 5,
      confidence: focusConf - 0.1,
      lastUpdated: now,
      derivedFrom: ["behavior"]
    };
    newReasoning.preferredRecoveryTime = `Recovery time padded slightly past the standard break block.`;

    // 4. AGENDA DENSITY
    const completionRate = snapshot.behavior?.Productivity?.completionRate || 60;
    let density: "light" | "balanced" | "dense" = "balanced";
    let densityConf = 0.75;
    let densityReason = "Agenda density set to balanced based on moderate completion rates.";

    if (completionRate < 45) {
      density = "light";
      densityConf = 0.85;
      densityReason = "Low completed task ratio (<45%) triggers light agenda density to prevent backlog overwhelm.";
    } else if (completionRate > 80) {
      density = "dense";
      densityConf = 0.85;
      densityReason = "Exceptional completed task ratio (>80%) triggers dense agenda planning to maximize throughput.";
    }
    newAdaptations.preferredAgendaDensity = {
      value: density,
      confidence: densityConf,
      lastUpdated: now,
      derivedFrom: ["behavior", "consistency"]
    };
    newReasoning.preferredAgendaDensity = densityReason;

    // 5. PLANNING AGGRESSIVENESS
    const overallRisk = snapshot.risk?.overall || 30;
    const burnoutRisk = snapshot.risk?.burnout || 30;
    let aggressiveness: "conservative" | "balanced" | "aggressive" = "balanced";
    let aggConf = 0.80;
    let aggReason = "Standard planning aggressiveness based on moderate risk metrics.";

    if (burnoutRisk >= 61 || overallRisk >= 61) {
      aggressiveness = "conservative";
      aggConf = 0.90;
      aggReason = "High burnout / trajectory risk signals planning engine to throttle task allocations.";
    } else if (overallRisk <= 25) {
      aggressiveness = "aggressive";
      aggConf = 0.85;
      aggReason = "Minimal trajectory risks allow for more aggressive roadmap schedules.";
    }
    newAdaptations.planningAggressiveness = {
      value: aggressiveness,
      confidence: aggConf,
      lastUpdated: now,
      derivedFrom: ["risk"]
    };
    newReasoning.planningAggressiveness = aggReason;

    // 6. ROADMAP GRANULARITY
    const planningConsistency = snapshot.consistency?.Planning?.planningConsistencyScore || 50;
    let granularity: "coarse" | "balanced" | "fine" = "balanced";
    let granConf = 0.75;
    let granReason = "Balanced granularity fits user's standard planning cycle.";

    if (planningConsistency >= 75) {
      granularity = "fine";
      granConf = 0.85;
      granReason = "Strong planning consistency suggests user thrives with highly detailed, fine-grained milestones.";
    } else if (planningConsistency < 40) {
      granularity = "coarse";
      granConf = 0.85;
      granReason = "Erratic planning structure triggers coarse granularity to offer looser, less rigid plan scopes.";
    }
    newAdaptations.roadmapGranularity = {
      value: granularity,
      confidence: granConf,
      lastUpdated: now,
      derivedFrom: ["consistency"]
    };
    newReasoning.roadmapGranularity = granReason;

    // 7. EXECUTION STYLE
    let execStyle: "pomodoro" | "flow" | "batch" = "batch";
    if (focusSession <= 30) execStyle = "pomodoro";
    else if (focusSession >= 50) execStyle = "flow";

    newAdaptations.executionStyle = {
      value: execStyle,
      confidence: focusConf,
      lastUpdated: now,
      derivedFrom: ["behavior"]
    };
    newReasoning.executionStyle = `Execution style set to ${execStyle} to match focus threshold of ${focusSession}m.`;

    // 8. CALENDAR BUFFER MINUTES
    const calendarOverrideRate = snapshot.consistency?.Calendar?.calendarOverrideRate || 0;
    let calBuffer = 15;
    let calBufferConf = 0.70;
    let calReason = "Default 15-minute inter-task buffer.";

    if (calendarOverrideRate >= 30) {
      calBuffer = 30;
      calBufferConf = 0.85;
      calReason = "Frequent calendar adjustments and conflicts (>30%) prompt a wider 30m inter-task buffer.";
    }
    newAdaptations.calendarBufferMinutes = {
      value: calBuffer,
      confidence: calBufferConf,
      lastUpdated: now,
      derivedFrom: ["consistency"]
    };
    newReasoning.calendarBufferMinutes = calReason;

    // 9. REFLECTION LENGTH
    const reflectionScore = snapshot.consistency?.Routine?.routineScore || 50;
    let reflectionStyle: "short" | "medium" | "long" = "medium";
    let reflectionConf = 0.75;
    let reflectionReason = "Medium length reflections balance detail and compliance.";

    if (reflectionScore < 40) {
      reflectionStyle = "short";
      reflectionConf = 0.85;
      reflectionReason = "Lower routine consistency calls for shorter reflection queries to prevent engagement drops.";
    } else if (reflectionScore >= 80) {
      reflectionStyle = "long";
      reflectionConf = 0.85;
      reflectionReason = "Exceptional routine adherence allows for long-form detailed reflection blocks.";
    }
    newAdaptations.preferredReflectionLength = {
      value: reflectionStyle,
      confidence: reflectionConf,
      lastUpdated: now,
      derivedFrom: ["consistency"]
    };
    newReasoning.preferredReflectionLength = reflectionReason;

    // 10. BRIEF STYLE
    const briefLogs = snapshot.briefings?.logs || [];
    let unopenedStreak = 0;
    for (const log of briefLogs) {
      if (!log.opened) unopenedStreak++;
      else break;
    }
    
    let briefStyle: "short" | "medium" | "long" = "medium";
    let briefConf = 0.80;
    let briefReason = "Default medium-density briefings.";

    if (unopenedStreak > 3) {
      briefStyle = "short";
      briefReason = "Briefings remained unopened for multiple days. Shortening content to re-engage.";
    } else if (briefLogs.length > 5 && unopenedStreak === 0) {
      briefStyle = "long";
      briefReason = "Active briefing open history indicates preference for thorough, long-form briefings.";
    }
    newAdaptations.preferredBriefStyle = {
      value: briefStyle,
      confidence: briefConf,
      lastUpdated: now,
      derivedFrom: ["behavior", "briefings"]
    };
    newReasoning.preferredBriefStyle = briefReason;

    // 11. COMPANION TONE
    let tone: "formal" | "friendly" | "direct" | "motivational" | "minimal" = "direct";
    let toneConf = 0.75;
    let toneReason = "Direct and objective dialogue matches default tone settings.";

    if (burnoutRisk >= 61) {
      tone = "minimal";
      toneReason = "High burnout risk prompts a minimal, non-intrusive companion tone.";
    } else if (snapshot.behavior?.Activity?.currentStreak > 5) {
      tone = "motivational";
      toneReason = "High active work streak unlocks motivational, milestone-centric feedback.";
    } else if (completionRate < 45) {
      tone = "friendly";
      toneReason = "Reduced completion rate triggers a friendly, highly encouraging response style.";
    }
    newAdaptations.preferredCompanionTone = {
      value: tone,
      confidence: toneConf,
      lastUpdated: now,
      derivedFrom: ["risk", "behavior"]
    };
    newReasoning.preferredCompanionTone = toneReason;

    // 12. MOTIVATION STYLE
    let motivation: "achievement" | "consistency" | "curiosity" | "challenge" | "recovery" = "achievement";
    let motConf = 0.80;
    let motReason = "Achievement-centric incentives drive default behavior.";

    if (burnoutRisk >= 61) {
      motivation = "recovery";
      motReason = "Heightened burnout metrics warrant recovery-focused, break-encouraging motivators.";
    } else if (snapshot.behavior?.Activity?.currentStreak > 7) {
      motivation = "consistency";
      motReason = "Strong active streak suggests consistency-focused visual reinforcement works best.";
    }
    newAdaptations.motivationStyle = {
      value: motivation,
      confidence: motConf,
      lastUpdated: now,
      derivedFrom: ["behavior", "risk"]
    };
    newReasoning.motivationStyle = motReason;

    // 13. NOTIFICATION VERBOSITY
    const abandonmentRisk = snapshot.risk?.abandonment || 30;
    let verbosity: "minimal" | "normal" | "high" = "normal";
    let verbConf = 0.75;
    let verbReason = "Standard balanced notifications.";

    if (burnoutRisk >= 61) {
      verbosity = "minimal";
      verbReason = "High burnout risk throttles notification frequency to minimal.";
    } else if (abandonmentRisk >= 61) {
      verbosity = "high";
      verbReason = "High abandonment risk triggers high re-engagement verbosity.";
    }
    newAdaptations.notificationVerbosity = {
      value: verbosity,
      confidence: verbConf,
      lastUpdated: now,
      derivedFrom: ["risk"]
    };
    newReasoning.notificationVerbosity = verbReason;

    // 14. SCHEDULE FLEXIBILITY
    const routineScore = snapshot.consistency?.Routine?.routineScore || 50;
    let flexibility: "rigid" | "flexible" | "very_flexible" = "flexible";
    let flexConf = 0.80;
    let flexReason = "Flexible scheduling windows to handle minor routine variances.";

    if (routineScore >= 75) {
      flexibility = "rigid";
      flexReason = "Impeccable routine adherence suggests rigid scheduling constraints.";
    } else if (routineScore < 35) {
      flexibility = "very_flexible";
      flexReason = "Low routine stability demands very flexible scheduling margins.";
    }
    newAdaptations.scheduleFlexibility = {
      value: flexibility,
      confidence: flexConf,
      lastUpdated: now,
      derivedFrom: ["consistency"]
    };
    newReasoning.scheduleFlexibility = flexReason;

    // 15. PLANNING DEPTH
    let depth: "shallow" | "balanced" | "deep" = "balanced";
    if (planningConsistency >= 75) depth = "deep";
    newAdaptations.preferredPlanningDepth = {
      value: depth,
      confidence: 0.75,
      lastUpdated: now,
      derivedFrom: ["consistency"]
    };
    newReasoning.preferredPlanningDepth = `Planning depth set to ${depth} based on planning metrics.`;

    // 16. DEADLINE BUFFER
    const deadlineForecast = snapshot.prediction?.deadlineForecast || [];
    let bufferDays = 2;
    let bufReason = "Standard 2-day margin of safety on milestones.";

    if (deadlineForecast.length > 0) {
      const maxLateProb = Math.max(...deadlineForecast.map((d: any) => d.probabilityLate));
      if (maxLateProb >= 60) {
        bufferDays = 3;
        bufReason = "Late projections on target dates prompt padding future deadlines with a 3-day buffer.";
      } else if (maxLateProb <= 20) {
        bufferDays = 1;
        bufReason = "High on-time probabilities allow tightening buffers to 1 day.";
      }
    }
    newAdaptations.preferredDeadlineBuffer = {
      value: bufferDays,
      confidence: 0.80,
      lastUpdated: now,
      derivedFrom: ["prediction"]
    };
    newReasoning.preferredDeadlineBuffer = bufReason;

    // OVERALL CONFIDENCE (Average)
    let totalConf = 0;
    let count = 0;
    for (const item of Object.values(newAdaptations)) {
      totalConf += item.confidence;
      count++;
    }
    const overallConf = count > 0 ? Math.round((totalConf / count) * 100) / 100 : 0.50;

    // DETECT ADAPTATION HISTORY CHANGES
    const history = policy.history || [];
    if (oldPolicyDoc && oldPolicyDoc.adaptations) {
      for (const key of Object.keys(newAdaptations)) {
        const oldVal = (oldPolicyDoc.adaptations as any)[key]?.value;
        const newVal = newAdaptations[key]?.value;
        if (oldVal !== undefined && oldVal !== newVal) {
          history.push({
            timestamp: now,
            adaptationKey: key,
            oldValue: oldVal,
            newValue: newVal,
            reason: newReasoning[key] || "Policy recalculated."
          });
        }
      }
    }

    if (history.length > 50) {
      history.shift();
    }

    // Save Policy values
    policy.adaptations = newAdaptations as any;
    policy.reasoning = newReasoning;
    policy.history = history;
    policy.confidence = overallConf;
    policy.updatedAt = now;

    await policy.save();

    return policy;
  }
}
export const AdaptivePolicyBuilder = {
  build: async (uid: string) => {
    const policy = await AdaptivePolicy.findOne({ uid });
    if (!policy) return null;

    const resolved: Record<string, any> = {};
    for (const key of Object.keys(policy.adaptations)) {
      resolved[key] = {
        value: AdaptiveCognitionEngine.getActiveValue(key, (policy.adaptations as any)[key]),
        confidence: (policy.adaptations as any)[key].confidence,
        reason: (policy.reasoning as any)?.[key] || (policy.reasoning as any)?.get?.(key) || "Recalculated",
        evidence: (policy.adaptations as any)[key].derivedFrom
      };
    }
    return resolved;
  }
};
