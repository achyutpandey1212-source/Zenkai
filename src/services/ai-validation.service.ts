import { telemetryStorage } from "@/lib/telemetry-context";

// Helper to convert "HH:mm" or ISO 8601 datetime string to minutes from midnight
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  // Handle ISO 8601 format like "2026-06-30T07:30:00Z" or "2026-06-30T07:30:00+05:30"
  // Extract the time portion after "T" and strip the timezone suffix
  let normalized = timeStr;
  if (timeStr.includes("T")) {
    const timePart = timeStr.split("T")[1] || "00:00";
    // Strip timezone suffix (Z, +HH:MM, -HH:MM)
    normalized = timePart.replace(/([+-]\d{2}:\d{2}|Z)$/, "").substring(0, 5);
  }
  const parts = normalized.split(":");
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

// Helper to convert minutes from midnight to "HH:mm" time string
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = Math.floor(minutes % 60);
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

export class AIValidationService {
  /**
   * Helper to log planning conflicts to GraphState telemetry
   */
  private static logConflict(day: string, message: string) {
    console.warn(`[Planning Guardrails][${day}] Conflict resolved: ${message}`);
    const store = telemetryStorage.getStore();
    const state = store?.stateRef as any;
    if (state) {
      if (!state.planningConflicts) {
        state.planningConflicts = [];
      }
      state.planningConflicts.push({ day, conflict: message });
    }
  }

  /**
   * Helper to log guardrail triggers
   */
  private static triggerGuardrail(message: string) {
    const store = telemetryStorage.getStore();
    const state = store?.stateRef as any;
    if (state) {
      if (!state.guardrailTriggers) {
        state.guardrailTriggers = [];
      }
      if (!state.guardrailTriggers.includes(message)) {
        state.guardrailTriggers.push(message);
      }
    }
  }

  /**
   * 1. Validate and repair a Plan tree structure.
   */
  public static validateAndRepairPlan(data: any): any {
    if (!data || typeof data !== "object") {
      throw new Error("Plan output is not a valid object");
    }

    const plan = data.plan || data;
    if (!plan.title || typeof plan.title !== "string" || !plan.title.trim()) {
      plan.title = "Untitled Action Plan";
      this.triggerGuardrail("Repaired empty plan title");
    }

    if (!plan.status || !["active", "completed", "archived"].includes(plan.status.toLowerCase())) {
      plan.status = "active";
    } else {
      plan.status = plan.status.toLowerCase();
    }

    if (!plan.type || typeof plan.type !== "string") {
      plan.type = "personal";
    } else {
      plan.type = plan.type.toLowerCase();
    }

    if (!Array.isArray(plan.milestones)) {
      plan.milestones = [];
    }

    plan.milestones = plan.milestones.map((m: any, mIdx: number) => {
      if (!m || typeof m !== "object") {
        m = { title: `Milestone ${mIdx + 1}` };
      }
      if (!m.title || typeof m.title !== "string" || !m.title.trim()) {
        m.title = `Milestone ${mIdx + 1}`;
        this.triggerGuardrail(`Repaired empty milestone title at index ${mIdx}`);
      }

      m.status = ["todo", "in_progress", "completed", "cancelled"].includes(String(m.status).toLowerCase())
        ? String(m.status).toLowerCase()
        : String(m.status).toLowerCase() === "pending"
          ? "todo"
          : "todo";

      m.category = ["Career", "Academics", "Health", "Finance", "Social", "Personal", "Other"].includes(m.category)
        ? m.category
        : "Personal";

      // Repair dates format (e.g. YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (m.startDate && !dateRegex.test(m.startDate)) {
        m.startDate = this.tryNormalizeDate(m.startDate);
      }
      if (m.endDate && !dateRegex.test(m.endDate)) {
        m.endDate = this.tryNormalizeDate(m.endDate);
      }

      if (!Array.isArray(m.goals)) {
        m.goals = [];
      }

      m.goals = m.goals.map((g: any, gIdx: number) => {
        if (!g || typeof g !== "object") {
          g = { title: `Goal ${gIdx + 1}` };
        }
        if (!g.title || typeof g.title !== "string" || !g.title.trim()) {
          g.title = `Goal ${gIdx + 1}`;
        }
        g.status = ["active", "completed", "paused", "cancelled"].includes(String(g.status).toLowerCase())
          ? String(g.status).toLowerCase()
          : String(g.status).toLowerCase() === "pending"
            ? "active"
            : "active";

        if (!Array.isArray(g.tasks)) {
          g.tasks = [];
        }

        g.tasks = g.tasks.map((t: any, tIdx: number) => {
          if (!t || typeof t !== "object") {
            t = { title: `Task ${tIdx + 1}` };
          }
          if (!t.title || typeof t.title !== "string" || !t.title.trim()) {
            t.title = `Task ${tIdx + 1}`;
          }
          t.status = ["todo", "in_progress", "completed", "missed"].includes(String(t.status).toLowerCase())
            ? String(t.status).toLowerCase()
            : String(t.status).toLowerCase() === "pending"
              ? "todo"
              : "todo";

          if (t.suggestedDate && !dateRegex.test(t.suggestedDate)) {
            t.suggestedDate = this.tryNormalizeDate(t.suggestedDate);
          }

          return t;
        });

        return g;
      });

      return m;
    });

    return { ...data, plan };
  }

  /**
   * 2. Validate, repair, and programmatically rebalance a Weekly Execution Schedule.
   */
  public static validateAndRepairSchedule(data: any, profile: any): any {
    if (!data || typeof data !== "object") {
      throw new Error("Schedule output is not a valid object");
    }

    const days = data.days;
    if (!Array.isArray(days)) {
      throw new Error("Schedule must contain a days array");
    }

    if (days.length !== 7) {
      this.triggerGuardrail(`Repaired invalid days array length of ${days.length} (expected 7)`);
    }

    // Load profile constraints
    const wakeUpTime = profile?.wakeUpTime || "07:00";
    const sleepTime = profile?.sleepTime || "23:00";
    const dailyAvailHrs = parseFloat(profile?.dailyAvailability) || 8.0;
    const maxDailyWorkloadMinutes = Math.min(dailyAvailHrs * 60, 12 * 60); // Hard limit at 12 hours study/work

    const wakeMin = timeToMinutes(wakeUpTime);
    const sleepMin = timeToMinutes(sleepTime);
    const wakeSleepSpan = sleepMin > wakeMin ? sleepMin - wakeMin : (24 * 60 - wakeMin) + sleepMin;

    const rebalancedDays = days.map((dayObj: any, dayIdx: number) => {
      const dayDate = dayObj.date || new Date().toISOString().split("T")[0];
      // Preserve dayNumber exactly as returned by the LLM; fall back to loop index if absent
      const dayNumber = typeof dayObj.dayNumber === "number" ? dayObj.dayNumber : dayIdx;
      const theme = dayObj.focusTheme || "Focus Day";
      const blocks = Array.isArray(dayObj.workBlocks) ? dayObj.workBlocks : [];

      // Determine day of the week (e.g. "Monday", "Tuesday", etc.)
      const dateObj = new Date(dayDate);
      const dayOfWeek = dateObj.toLocaleDateString("en-US", { weekday: "long" });

      // Get profile commitments for this day of week
      const dayCommitments: { title: string; start: number; end: number }[] = [];
      if (Array.isArray(profile?.commitments)) {
        profile.commitments.forEach((c: any) => {
          const repeatDays = Array.isArray(c.days) ? c.days : [];
          if (repeatDays.includes(dayOfWeek) && c.startTime && c.endTime) {
            dayCommitments.push({
              title: c.title || "Commitment",
              start: timeToMinutes(c.startTime),
              end: timeToMinutes(c.endTime),
            });
          }
        });
      }

      // Repair blocks (negative durations, defaults, clamping to wake/sleep window)
      let repairedBlocks = blocks.map((b: any, idx: number) => {
        const title = b.title || `Study block ${idx + 1}`;
        let startM = timeToMinutes(b.startTime || wakeUpTime);
        let duration = parseInt(b.duration, 10) || 60;
        if (duration <= 0) duration = 60;

        let endM = timeToMinutes(b.endTime);
        if (!b.endTime || endM <= startM) {
          endM = startM + duration;
        } else {
          duration = endM - startM;
        }

        const priority = Math.min(Math.max(parseInt(b.priority, 10) || 3, 1), 5);
        const taskIds = Array.isArray(b.taskIds)
          ? b.taskIds
          : Array.isArray(b.tasks)
            ? b.tasks
            : [];

        // Clamp block to wake/sleep window
        if (startM < wakeMin) {
          this.logConflict(dayDate, `Shifting block "${title}" from ${b.startTime} to wake time ${wakeUpTime}`);
          this.triggerGuardrail("Clamped block to wake window");
          startM = wakeMin;
          endM = startM + duration;
        }
        if (endM > sleepMin) {
          this.logConflict(dayDate, `Shrinking block "${title}" ending at ${b.endTime} to fit sleep time ${sleepTime}`);
          this.triggerGuardrail("Clamped block to sleep window");
          endM = sleepMin;
          duration = Math.max(15, endM - startM);
        }

        return {
          title,
          startM,
          endM,
          duration,
          priority,
          taskIds,
        };
      });

      // Sort blocks by start time
      repairedBlocks.sort((a: any, b: any) => a.startM - b.startM);

      // RESOLVE OVERLAPS & COMMITMENTS
      const finalBlocks: typeof repairedBlocks = [];

      for (const block of repairedBlocks) {
        let currentStart = block.startM;
        let currentEnd = block.startM + block.duration;
        let overlapFound = true;
        let shiftsCount = 0;

        while (overlapFound && shiftsCount < 20) {
          overlapFound = false;

          // 1. Check overlaps with already scheduled blocks (with 5 min transition buffer)
          for (const prev of finalBlocks) {
            const buffer = 5;
            if (currentStart < prev.endM + buffer && currentEnd > prev.startM) {
              // Shift current block to start after previous block completes
              this.logConflict(
                dayDate,
                `Overlap detected between "${block.title}" and "${prev.title}". Shifting "${block.title}" by ${prev.endM + buffer - currentStart} mins.`
              );
              this.triggerGuardrail("Resolved block overlap");
              currentStart = prev.endM + buffer;
              currentEnd = currentStart + block.duration;
              overlapFound = true;
              break;
            }
          }

          if (overlapFound) continue;

          // 2. Check overlaps with hard profile commitments
          for (const comm of dayCommitments) {
            if (currentStart < comm.end && currentEnd > comm.start) {
              // Shift study block to start after commitment completes
              this.logConflict(
                dayDate,
                `Conflict between "${block.title}" and commitment "${comm.title}". Shifting study block after commitment.`
              );
              this.triggerGuardrail("Resolved commitment conflict");
              currentStart = comm.end + 5; // 5-minute buffer
              currentEnd = currentStart + block.duration;
              overlapFound = true;
              break;
            }
          }

          shiftsCount++;
        }

        // Check if shifted block exceeds sleep window
        if (currentEnd > sleepMin) {
          // Attempt to shrink duration (minimum 15 mins) to make it fit
          const newDur = Math.max(15, sleepMin - currentStart);
          if (newDur >= 15 && currentStart < sleepMin) {
            this.logConflict(dayDate, `Shrinking block "${block.title}" to ${newDur} mins to fit sleep window.`);
            block.startM = currentStart;
            block.endM = sleepMin;
            block.duration = newDur;
            finalBlocks.push(block);
          } else {
            this.logConflict(dayDate, `Dropped low-priority block "${block.title}" because it could not fit sleep window.`);
            this.triggerGuardrail("Dropped block due to sleep window limit");
          }
        } else {
          block.startM = currentStart;
          block.endM = currentEnd;
          finalBlocks.push(block);
        }
      }

      // EXCEEDING AVAILABLE HOURS / DAILY WORKLOAD LIMITS
      let totalWorkMinutes = finalBlocks.reduce((sum: number, b: any) => sum + b.duration, 0);
      if (totalWorkMinutes > maxDailyWorkloadMinutes) {
        this.logConflict(
          dayDate,
          `Total work minutes ${totalWorkMinutes} exceeds daily limit ${maxDailyWorkloadMinutes}. Compressing study blocks.`
        );
        this.triggerGuardrail("Daily workload limit exceeded");

        // Attempt proportional compression (compress up to 50% duration, but not below 15 mins)
        const excess = totalWorkMinutes - maxDailyWorkloadMinutes;
        let minutesReduced = 0;

        for (const block of finalBlocks) {
          const maxReduction = Math.floor(block.duration * 0.4); // maximum 40% reduction
          const targetReduction = Math.min(maxReduction, excess - minutesReduced);
          if (block.duration - targetReduction >= 15) {
            block.duration -= targetReduction;
            minutesReduced += targetReduction;
          }
          if (minutesReduced >= excess) break;
        }

        // Recalculate block times after compression
        let currentCursor = wakeMin;
        const compactedBlocks: typeof finalBlocks = [];
        for (const block of finalBlocks) {
          // Ensure we don't place blocks inside commitments
          let placementFound = false;
          while (!placementFound) {
            let conflictWithComm = false;
            for (const comm of dayCommitments) {
              if (currentCursor < comm.end && currentCursor + block.duration > comm.start) {
                currentCursor = comm.end + 5;
                conflictWithComm = true;
                break;
              }
            }
            if (!conflictWithComm) {
              placementFound = true;
            }
          }

          if (currentCursor + block.duration <= sleepMin) {
            block.startM = currentCursor;
            block.endM = currentCursor + block.duration;
            compactedBlocks.push(block);
            currentCursor = block.endM + 5;
          } else {
            this.logConflict(dayDate, `Dropped block "${block.title}" during compression: exceeded sleep window.`);
          }
        }

        // If still exceeding, drop lowest priority blocks
        totalWorkMinutes = compactedBlocks.reduce((sum: number, b: any) => sum + b.duration, 0);
        while (totalWorkMinutes > maxDailyWorkloadMinutes && compactedBlocks.length > 0) {
          // Find lowest priority index
          let lowestPriorityIdx = 0;
          for (let i = 1; i < compactedBlocks.length; i++) {
            if (compactedBlocks[i].priority < compactedBlocks[lowestPriorityIdx].priority) {
              lowestPriorityIdx = i;
            }
          }
          const dropped = compactedBlocks.splice(lowestPriorityIdx, 1)[0];
          this.logConflict(dayDate, `Dropped block "${dropped.title}" (priority ${dropped.priority}) to satisfy daily limit.`);
          totalWorkMinutes = compactedBlocks.reduce((sum: number, b: any) => sum + b.duration, 0);
        }

        // Re-align remaining blocks after dropping
        let cursor = wakeMin;
        const reAlignedBlocks: typeof finalBlocks = [];
        for (const block of compactedBlocks) {
          let placementFound = false;
          while (!placementFound) {
            let conflictWithComm = false;
            for (const comm of dayCommitments) {
              if (cursor < comm.end && cursor + block.duration > comm.start) {
                cursor = comm.end + 5;
                conflictWithComm = true;
                break;
              }
            }
            if (!conflictWithComm) {
              placementFound = true;
            }
          }

          if (cursor + block.duration <= sleepMin) {
            block.startM = cursor;
            block.endM = cursor + block.duration;
            reAlignedBlocks.push(block);
            cursor = block.endM + 5;
          }
        }

        finalBlocks.length = 0;
        finalBlocks.push(...reAlignedBlocks);
      }

      // Map back to output format (startTime, endTime strings)
      // NOTE: All structural fields from the LLM output must be forwarded here.
      // dayNumber is required by the Mongoose DayScheduleSchema (required: true).
      return {
        date: dayDate,
        dayNumber,
        focusTheme: theme,
        plannedFocusHours: parseFloat((totalWorkMinutes / 60).toFixed(1)),
        estimatedWorkload: totalWorkMinutes > 360 ? "Heavy" : totalWorkMinutes > 180 ? "Medium" : "Light",
        workBlocks: finalBlocks.map((b: any) => ({
          title: b.title,
          startTime: minutesToTime(b.startM),
          endTime: minutesToTime(b.endM),
          duration: b.duration,
          priority: b.priority,
          taskIds: b.taskIds,
        })),
      };
    });

    return { days: rebalancedDays };
  }

  /**
   * 3. Validate and repair Identity evolution payload.
   */
  public static validateAndRepairIdentity(data: any): any {
    if (!data || typeof data !== "object") {
      throw new Error("Identity evolution is not a valid object");
    }

    const traitsToUpdate = Array.isArray(data.traitsToUpdate) ? data.traitsToUpdate : [];
    const newTraits = Array.isArray(data.newTraits) ? data.newTraits : [];

    const repairedUpdates = traitsToUpdate.map((t: any, idx: number) => {
      if (!t || typeof t !== "object" || !t.traitId) {
        throw new Error(`Invalid trait update payload at index ${idx}`);
      }
      return {
        traitId: String(t.traitId),
        trait: String(t.trait || "Updated Trait").trim(),
        category: ["core_identity", "aspiration", "principle", "behavior_pattern", "current_state"].includes(t.category)
          ? t.category
          : "behavior_pattern",
        description: String(t.description || "").trim(),
        confidence: Math.min(Math.max(parseFloat(t.confidence) || 0.8, 0.0), 1.0),
        stability: Math.min(Math.max(parseFloat(t.stability) || 0.5, 0.0), 1.0),
        status: ["active", "candidate", "deprecated"].includes(t.status) ? t.status : "active",
        evidence: String(t.evidence || "").trim(),
      };
    });

    const repairedNew = newTraits.map((t: any, idx: number) => {
      if (!t || typeof t !== "object" || !t.trait || !String(t.trait).trim()) {
        throw new Error(`Invalid new trait payload at index ${idx}`);
      }
      return {
        trait: String(t.trait).trim(),
        category: ["core_identity", "aspiration", "principle", "behavior_pattern", "current_state"].includes(t.category)
          ? t.category
          : "behavior_pattern",
        description: String(t.description || "").trim(),
        confidence: Math.min(Math.max(parseFloat(t.confidence) || 0.8, 0.0), 1.0),
        stability: Math.min(Math.max(parseFloat(t.stability) || 0.1, 0.0), 1.0),
        evidence: String(t.evidence || "").trim(),
      };
    });

    return {
      traitsToUpdate: repairedUpdates,
      newTraits: repairedNew,
    };
  }

  /**
   * 4. Validate and repair Reflections evolution payload.
   */
  public static validateAndRepairReflections(data: any): any {
    if (!data || typeof data !== "object") {
      throw new Error("Reflections evolution is not a valid object");
    }

    const reflectionsToUpdate = Array.isArray(data.reflectionsToUpdate) ? data.reflectionsToUpdate : [];
    const newReflections = Array.isArray(data.newReflections) ? data.newReflections : [];

    const repairedUpdates = reflectionsToUpdate.map((r: any, idx: number) => {
      if (!r || typeof r !== "object" || !r.reflectionId) {
        throw new Error(`Invalid reflection update payload at index ${idx}`);
      }
      return {
        reflectionId: String(r.reflectionId),
        title: String(r.title || "Updated Reflection").trim(),
        category: String(r.category || "General").trim(),
        content: String(r.content || "").trim(),
        summary: String(r.summary || r.content || "").trim(),
        confidence: Math.min(Math.max(parseFloat(r.confidence) || 0.8, 0.0), 1.0),
        stability: Math.min(Math.max(parseFloat(r.stability) || 0.5, 0.0), 1.0),
        importance: Math.min(Math.max(parseFloat(r.importance) || 5.0, 1.0), 10.0),
        evidenceCount: parseInt(r.evidenceCount, 10) || 1,
        supportingMemoryIds: Array.isArray(r.supportingMemoryIds) ? r.supportingMemoryIds.map(String) : [],
        supportingIdentityTraitIds: Array.isArray(r.supportingIdentityTraitIds) ? r.supportingIdentityTraitIds.map(String) : [],
      };
    });

    const repairedNew = newReflections.map((r: any, idx: number) => {
      if (!r || typeof r !== "object" || !r.title || !String(r.title).trim()) {
        throw new Error(`Invalid new reflection payload at index ${idx}`);
      }
      return {
        title: String(r.title).trim(),
        category: String(r.category || "General").trim(),
        content: String(r.content || "").trim(),
        summary: String(r.summary || r.content || "").trim(),
        confidence: Math.min(Math.max(parseFloat(r.confidence) || 0.8, 0.0), 1.0),
        stability: Math.min(Math.max(parseFloat(r.stability) || 0.1, 0.0), 1.0),
        importance: Math.min(Math.max(parseFloat(r.importance) || 5.0, 1.0), 10.0),
        supportingMemoryIds: Array.isArray(r.supportingMemoryIds) ? r.supportingMemoryIds.map(String) : [],
        supportingIdentityTraitIds: Array.isArray(r.supportingIdentityTraitIds) ? r.supportingIdentityTraitIds.map(String) : [],
      };
    });

    return {
      reflectionsToUpdate: repairedUpdates,
      newReflections: repairedNew,
    };
  }

  /**
   * Helper to normalize a date string from formats like "2026/06/30" or "06-30-2026" to "2026-06-30".
   */
  private static tryNormalizeDate(dateStr: string): string {
    if (!dateStr || typeof dateStr !== "string") return "";
    try {
      const parsed = Date.parse(dateStr.replace(/\//g, "-"));
      if (!isNaN(parsed)) {
        return new Date(parsed).toISOString().split("T")[0];
      }
    } catch {}
    return dateStr;
  }
}
