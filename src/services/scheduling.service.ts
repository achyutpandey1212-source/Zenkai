import type { PlanningContext } from "@/types/context.types";
import { ContextOrchestrator } from "@/services/context-orchestrator.service";
import { AIValidationService, timeToMinutes } from "@/services/ai-validation.service";
import { PlanSyncService } from "@/services/plan-sync.service";
import { provider } from "@/services/llm/provider";
import { PlanningFormatter } from "@/formatters/prompt-formatters";
import type { GraphState } from "@/orchestration/graph/state";

export type SchedulingResult = {
  scheduleDoc: any;
  aiCallsMade: number;
};

export class SchedulingService {
  /**
   * PURE AI Reasoning function for weekly scheduling.
   * Consumes only typed contracts and active tasks, returning the generated schedule days.
   */
  private static async generateWeeklyScheduleLogic(
    context: PlanningContext,
    activeTasks: any[],
    startDateStr: string,
    timezone: string,
    dailyCapacities: { day: string; date: string; minutes: number }[]
  ): Promise<any> {
    const systemInstruction = `
You are the Human-Centric Weekly Planning Agent for Zenkai.
Your mission is to distribute the user's active tasks across the next 7 days, starting from ${startDateStr}, in a way that respects their life model, availability constraints, and cognitive rhythm.

─── CORE PHILOSOPHY & PLANNING PRINCIPLES ───
1. **Life First**: Schedule around the user's life (school, work, travel, sleep, meals). Never expect the user's life to adapt to an unrealistic plan.
2. **Consistency Beats Intensity**: Distribute learning and practice into shorter, recurring sessions. Avoid dumping 6+ hours of work into a single day.
3. **Minimize Context Switching**: Group similar work blocks together. Avoid chaotic transitions between unrelated tasks.
4. **Protect Deep Work**: Schedule uninterrupted blocks of time (e.g. 1.5 - 3 hours) for creative or complex tasks (e.g. coding, content creation, writing).
5. **Deadline Awareness**: As deadlines approach, naturally allocate more time in the future schedule without completely rewriting the long-term roadmap.
6. **Preserve Buffers**: Do not schedule every free hour. Leave realistic breathing room and transition buffers between blocks.
7. **Daily Work Limits**: Never schedule more work/study time on any given day than the available minutes calculated for that day.

─── 5-STAGE REASONING STEPS ───
You must follow these 5 steps to design the weekly schedule:
1. **Stage 1 — Build Life Model**: Analyze the user's profile, memories, traits, and reflections to deduce wake/sleep patterns, fixed obligations (school, work, travel), meals, and preferences.
2. **Stage 2 — Build Availability Map**: For each of the 7 days, identify occupied hours vs. available hours.
3. **Stage 3 — Classify Activities**: Group the available tasks into:
   - *Recurring*: Habits or recurring studies.
   - *Deadline-Driven*: Deliverables nearing their due dates.
   - *Creative*: Project building, writing, video editing.
   - *Maintenance*: Simple tasks, email, cleaning.
   - *Flexible*: Casual study, leisure, entertainment.
4. **Stage 4 — Weekly Rhythm Construction**: Design a consistent daily focus and workflow rhythm across the week.
5. **Stage 5 — Daily Work Block Planning**: Create a clean daily timeline.
   - STRICT RULE: Create exactly ONE consolidated calendar event (Work Block) per session, with tasks listed as children in that block.
   - STRICT RULE: Never generate overlapping blocks. All blocks must have non-overlapping startTime and endTime.
   - All times must be in the local timezone: ${timezone}.

Your output must follow the requested JSON schema.
`;

    const capacitiesStr = dailyCapacities.map(c => `- ${c.day} (${c.date}): maximum ${c.minutes} work/study minutes`).join("\n");

    const prompt = `
Create a realistic, human-centric 7-day schedule. Start Date: ${startDateStr}. Timezone: ${timezone}.

## DAILY WORK/STUDY CAPACITY CONSTRAINTS
CRITICAL: You MUST respect these daily work/study capacity limits. Under no circumstances should the combined duration of work/study blocks (excluding sleep, meals, and recurring commitments) on any given day exceed these available minutes:
${capacitiesStr}

## USER LIFE MODEL INPUTS
${PlanningFormatter.format(context)}

## TASKS TO SCHEDULE
${JSON.stringify(activeTasks.map(t => ({ id: (t._id || t.id)?.toString(), title: t.title, durationMinutes: t.estimatedMinutes || 30, priority: t.priority })), null, 2)}

## SCHEDULING GUIDELINES & DEFAULT BLOCKS
CRITICAL: Even if the list of tasks to schedule is small or empty, DO NOT generate an empty weekly schedule.
You must construct a realistic, believable daily structure based on the user's Life Model inputs:
1. **Sleep boundaries**: Schedule rest and sleep blocks outside their wake/sleep times.
2. **Fixed Obligations**: Always include their fixed recurring commitments (e.g., Office, Gym, College, Classes) at their specified start/end times.
3. **Buffer & Routine Blocks**: Insert standard routine blocks:
   - "Travel / Transition Buffer" before and after fixed commitments if needed.
   - "Meals & Rest Buffers" (Lunch, Dinner).
   - "Daily Study / Review Block" (e.g. 1.5 - 2 hours) for their long-term goal/focus (e.g. studying, placements, project building) during their preferred deep work time.
   - "Daily Consistency / Habit Block" (e.g. 30 mins) for focus consistency.
   - "Rest & Recharge" blocks on weekends or evenings.
4. If tasks are provided, schedule them inside the appropriate Daily Study, Routine, or Project work blocks (populating the \`taskIds\` array). If no tasks are provided or tasks are empty, create the work blocks anyway (e.g. "Focus Session" or "Gym Workout") and leave the \`taskIds\` array empty.

Each block must have a clear startTime and endTime, non-overlapping, and must feel believably structured.
`;

    const scheduleResponseSchema: any = {
      type: "OBJECT",
      properties: {
        lifeModelAnalysis: { type: "STRING" },
        availabilityMap: { type: "STRING" },
        weeklyRhythmReasoning: { type: "STRING" },
        days: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              date: { type: "STRING" },
              dayNumber: { type: "NUMBER" },
              focusTheme: { type: "STRING" },
              estimatedWorkload: { type: "STRING", enum: ["Light", "Medium", "Heavy"] },
              plannedFocusHours: { type: "NUMBER" },
              workBlocks: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    startTime: { type: "STRING" },
                    endTime: { type: "STRING" },
                    duration: { type: "NUMBER" },
                    priority: { type: "NUMBER" },
                    taskIds: {
                      type: "ARRAY",
                      items: { type: "STRING" }
                    }
                  },
                  required: ["title", "startTime", "endTime", "duration", "priority", "taskIds"]
                }
              }
            },
            required: ["date", "dayNumber", "focusTheme", "estimatedWorkload", "plannedFocusHours", "workBlocks"]
          }
        }
      },
      required: ["lifeModelAnalysis", "availabilityMap", "weeklyRhythmReasoning", "days"]
    };

    const response = await provider.generate({
      prompt,
      systemInstruction: systemInstruction.trim(),
      temperature: 0.15,
      responseMimeType: "application/json",
      responseSchema: scheduleResponseSchema,
    });

    const content = response.text;
    if (!content) throw new Error("Empty response from Weekly Planner LLM");

    let result: any;
    try {
      result = JSON.parse(content);
      console.log("[DEBUG-AI-BEFORE] Raw AI workBlocks taskIds:", JSON.stringify(result?.days?.[0]?.workBlocks?.map((wb: any) => ({ title: wb.title, taskIds: wb.taskIds })), null, 2));
      result = AIValidationService.validateAndRepairSchedule(result, context.profile);
      console.log("[DEBUG-AI-AFTER] Validated workBlocks taskIds:", JSON.stringify(result?.days?.[0]?.workBlocks?.map((wb: any) => ({ title: wb.title, taskIds: wb.taskIds })), null, 2));
    } catch (validationErr: any) {
      console.warn(`[AI Validation] Initial schedule validation failed: ${validationErr.message}. Retrying once...`);
      const retryPrompt = `
${prompt}

---
IMPORTANT: Your previous response failed structural validation with the following error:
"${validationErr.message}"

Please fix this issue, ensure all days have exactly 1 date and a workBlocks array, and respond again in the exact requested schema.
`;
      const retryResponse = await provider.generate({
        prompt: retryPrompt,
        systemInstruction: systemInstruction.trim(),
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: scheduleResponseSchema,
      });

      const retryContent = retryResponse.text;
      if (!retryContent) throw new Error("Retry schedule response was empty");
      result = JSON.parse(retryContent);
      result = AIValidationService.validateAndRepairSchedule(result, context.profile);
    }

    return result;
  }

  /**
   * Generates a 7-day WeeklyExecutionSchedule for a user.
   * Orchestration layer that fetches context, computes capacities, and persists schedule.
   */
  static async generateWeeklySchedule(
    uid: string,
    planId: string,
    state?: GraphState
  ): Promise<SchedulingResult | null> {
    try {
      console.log(`[SchedulingService] Generating weekly schedule for plan ${planId}`);
      const workflowId = state?.workflowId || `fallback-scheduling-${uid}-${Date.now()}`;

      // 1. Resolve normalized user context
      let normalizedContext: PlanningContext;
      if (state && state.contextVersion) {
        normalizedContext = ContextOrchestrator.getContext(workflowId) as PlanningContext;
      } else {
        // Fallback loading — must pass "planning" as parentIntent
        normalizedContext = await ContextOrchestrator.loadContext(
          uid,
          workflowId,
          "Fallback weekly schedule shell execution",
          undefined,
          "planning"
        ) as PlanningContext;
      }

      const timezone = normalizedContext.profile.timezone || "UTC";
      const startDate = new Date();
      const startDateStr = startDate.toLocaleDateString("en-CA", { timeZone: timezone });

      // 2. Fetch all active tasks from context
      const activeTasks: any[] = [];
      if (normalizedContext.activePlan) {
        normalizedContext.activePlan.milestones.forEach((m) => {
          if (m.status === "todo" || m.status === "in_progress") {
            m.goals.forEach((g) => {
              if (g.status === "active") {
                g.tasks.forEach((t) => {
                  if (t.status === "todo" || t.status === "in_progress") {
                    activeTasks.push(t);
                  }
                });
              }
            });
          }
        });
      }

      // 3. Compute capacities and select subset of tasks
      const dailyCapacities = SchedulingService.calculateDailyCapacities(normalizedContext.profile, startDate, timezone);
      const totalCapacityMinutes = dailyCapacities.reduce((sum, d) => sum + d.minutes, 0);
      const selectedTasks = SchedulingService.selectTasksForCapacity(activeTasks, totalCapacityMinutes);

      console.log(`[SchedulingService] Capacity computed: ${totalCapacityMinutes} mins. Active tasks: ${activeTasks.length}. Selected tasks fitting capacity: ${selectedTasks.length}`);

      // 4. Call Pure AI Weekly Schedule reasoning logic
      const scheduleData = await SchedulingService.generateWeeklyScheduleLogic(
        normalizedContext,
        selectedTasks,
        startDateStr,
        timezone,
        dailyCapacities
      );

      console.log("[DEBUG-AI] AI scheduleData days:", scheduleData?.days?.length);
      console.log("[DEBUG-AI] AI activeTasks passed to scheduler:", selectedTasks?.length);
      if (scheduleData?.days?.[0]?.workBlocks?.[0]) {
        console.log("[DEBUG-AI] First workBlock taskIds:", scheduleData.days[0].workBlocks[0].taskIds);
      }

      // 5. Save schedule using PlanSyncService (database layer)
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      const endDateStr = endDate.toLocaleDateString("en-CA", { timeZone: timezone });

      const scheduleDoc = await PlanSyncService.persistWeeklySchedule(
        uid,
        planId,
        scheduleData,
        startDateStr,
        endDateStr,
        timezone
      );

      // Invalidate fallback cache if instantiated here
      if (!state || !state.contextVersion) {
        ContextOrchestrator.invalidateCache(workflowId);
      }

      return {
        scheduleDoc,
        aiCallsMade: 1
      };
    } catch (err) {
      console.error("[SchedulingService] Weekly Schedule generation failed:", err);
      return null;
    }
  }

  /**
   * Computes available work/study capacity in minutes for each of the next 7 days.
   */
  private static calculateDailyCapacities(
    profile: any,
    startDate: Date,
    timezone: string
  ): { day: string; date: string; minutes: number }[] {
    const dailyCapacities: { day: string; date: string; minutes: number }[] = [];
    const wakeUpTime = profile?.wakeUpTime || "07:00";
    const sleepTime = profile?.sleepTime || "23:00";
    const dailyAvailHrs = parseFloat(profile?.dailyAvailability) || 8.0;
    const dailyBudgetMinutes = dailyAvailHrs * 60;

    const wakeMin = timeToMinutes(wakeUpTime);
    const sleepMin = timeToMinutes(sleepTime);
    const wakingSpan = sleepMin > wakeMin ? sleepMin - wakeMin : (24 * 60 - wakeMin) + sleepMin;

    for (let i = 0; i < 7; i++) {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + i);
      const dateStr = current.toLocaleDateString("en-CA", { timeZone: timezone });
      const dayOfWeek = current.toLocaleDateString("en-US", { weekday: "long", timeZone: timezone });

      let commitmentsMin = 0;
      if (Array.isArray(profile?.commitments)) {
        profile.commitments.forEach((c: any) => {
          const repeatDays = Array.isArray(c.days) ? c.days : [];
          if (repeatDays.includes(dayOfWeek) && c.startTime && c.endTime) {
            const startC = timeToMinutes(c.startTime);
            const endC = timeToMinutes(c.endTime);
            const duration = endC > startC ? endC - startC : (24 * 60 - startC) + endC;
            commitmentsMin += duration;
          }
        });
      }

      const availableWakingMinutes = Math.max(0, wakingSpan - commitmentsMin);
      const dayCapacity = Math.min(availableWakingMinutes, dailyBudgetMinutes);

      dailyCapacities.push({
        day: dayOfWeek,
        date: dateStr,
        minutes: dayCapacity
      });
    }

    return dailyCapacities;
  }

  /**
   * Sorts tasks by priority and dependency state, filtering down to the subset that fits capacity.
   */
  private static selectTasksForCapacity(
    activeTasks: any[],
    totalCapacityMinutes: number
  ): any[] {
    const getTaskMinutes = (t: any): number => {
      if (t.estimatedMinutes && t.estimatedMinutes > 0) {
        return t.estimatedMinutes;
      }
      const dur = t.estimatedDuration;
      if (dur) {
        const clean = dur.toLowerCase().trim();
        if (clean.includes("h")) {
          const hours = parseFloat(clean.replace(/[^\d.]/g, ""));
          if (!isNaN(hours)) return Math.round(hours * 60);
        }
        if (clean.includes("m")) {
          const mins = parseFloat(clean.replace(/[^\d.]/g, ""));
          if (!isNaN(mins)) return Math.round(mins);
        }
        const rawNum = parseFloat(clean);
        if (!isNaN(rawNum)) return Math.round(rawNum);
      }
      return 30;
    };

    const tasksWithMetadata = activeTasks.map(t => ({
      task: t,
      duration: getTaskMinutes(t),
      priority: typeof t.priority === "number" ? t.priority : 3,
      id: (t._id || t.id)?.toString()
    }));

    tasksWithMetadata.sort((a, b) => a.priority - b.priority);

    const selectedTasks: any[] = [];
    const selectedTaskIds = new Set<string>();
    let scheduledMinutes = 0;

    const activeTaskIds = new Set(tasksWithMetadata.map(t => t.id));

    let addedInPass = true;
    while (addedInPass && scheduledMinutes < totalCapacityMinutes) {
      addedInPass = false;

      for (const item of tasksWithMetadata) {
        if (selectedTaskIds.has(item.id)) {
          continue;
        }

        let dependenciesMet = true;
        if (Array.isArray(item.task.dependencies)) {
          for (const dep of item.task.dependencies) {
            if (activeTaskIds.has(dep) && !selectedTaskIds.has(dep)) {
              dependenciesMet = false;
              break;
            }
          }
        }

        if (dependenciesMet) {
          if (scheduledMinutes + item.duration <= totalCapacityMinutes) {
            selectedTasks.push(item.task);
            selectedTaskIds.add(item.id);
            scheduledMinutes += item.duration;
            addedInPass = true;
          }
        }
      }
    }

    return selectedTasks;
  }
}