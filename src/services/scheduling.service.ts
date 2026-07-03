import type { PlanningContext, NormalizedProfile } from "@/types/context.types";
import { ContextOrchestrator } from "@/services/context-orchestrator.service";
import { AIValidationService, timeToMinutes } from "@/services/ai-validation.service";
import { PlanSyncService } from "@/services/plan-sync.service";
import { provider } from "@/services/llm/provider";
import { PlanningFormatter } from "@/formatters/prompt-formatters";
import type { GraphState } from "@/orchestration/graph/state";
import { WeeklyExecutionSchedule, type WorkBlockOrigin } from "@/models/WeeklyExecutionSchedule";

export type ScheduleChangeIntent = {
  type: "create_workspace" | "modify_schedule" | "calendar_import" | "recurring_habit";
  userId: string;
  planId: string;
  context?: Record<string, unknown>;
};

export type ScheduleModification = {
  operation: "add_recurring_habit" | "move_task" | "delete_task" | "reschedule_task";
  payload: {
    taskId?: string;
    title?: string;
    date?: string;
    fromDate?: string;
    toDate?: string;
    startTime?: string;
    endTime?: string;
    days?: string[];
    duration?: number;
    scheduleDetails?: string;
    [key: string]: unknown;
  };
};

export type SchedulingResult = {
  success: boolean;
  scheduleDoc: Record<string, unknown> | null;
  persisted: boolean;
  warnings: string[];
  aiCallsMade: number;
};

export type ModifyScheduleResult = {
  success: boolean;
  scheduleDoc?: Record<string, unknown> | null;
  persisted: boolean;
  modified: boolean;
  warnings: string[];
  affectedTasks: string[];
  affectedDays: string[];
};

type LeanWorkBlock = {
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  priority: number;
  tasks?: string[];
  origin?: WorkBlockOrigin;
};

type LeanDaySchedule = {
  date: string;
  dayNumber: number;
  focusTheme: string;
  estimatedWorkload: string;
  plannedFocusHours: number;
  workBlocks: LeanWorkBlock[];
};

type LeanWeeklySchedule = {
  days: LeanDaySchedule[];
};

export class SchedulingService {
  /**
   * Unified entry point for all schedule change operations.
   */
  static async applyScheduleChange(
    intent: ScheduleChangeIntent,
    state?: GraphState
  ): Promise<SchedulingResult | ModifyScheduleResult> {
    const { type, userId, planId, context } = intent;
    
    console.log(`[SchedulingService] applyScheduleChange called with type=${type} for user ${userId}`);
    
    // [ScheduleDebug] SchedulingService
    console.log(`[ScheduleDebug] [3] SchedulingService`);
    console.log(`[ScheduleDebug] Input payload: type=${type}, userId=${userId}, planId=${planId}, context=${JSON.stringify(context)}`);
    
    if (type === "create_workspace") {
      console.log(`[ScheduleDebug] Chosen handler: generateWeeklySchedule`);
      return SchedulingService.generateWeeklySchedule(userId, planId, state);
    }
    
    if (type === "modify_schedule") {
      console.log(`[ScheduleDebug] Chosen handler: modifySchedule`);
      const modification = context as ScheduleModification;
      const result = await SchedulingService.modifySchedule(userId, planId, modification, state);
      
      // Add conflict detection and persistence logs
      const modResult = result as ModifyScheduleResult & { scheduleDoc?: Record<string, unknown> };
      if (modResult.success) {
        console.log(`[ScheduleDebug] Conflict detection result: No conflicts detected`);
        console.log(`[ScheduleDebug] Whether persistence was attempted: true`);
        console.log(`[ScheduleDebug] Verification result: success=true, scheduleDoc exists=${!!modResult.scheduleDoc}`);
      } else {
        console.log(`[ScheduleDebug] Conflict detection result: Conflicts detected - ${modResult.warnings.join("; ")}`);
        console.log(`[ScheduleDebug] Whether persistence was attempted: false (due to conflicts)`);
        console.log(`[ScheduleDebug] Verification result: success=false`);
      }
      return result;
    }
    
    // Not yet implemented
    console.log(`[ScheduleDebug] Chosen handler: none (unimplemented type)`);
    return {
      success: false,
      scheduleDoc: null,
      persisted: false,
      warnings: [`Schedule change type '${type}' is not yet implemented`],
      aiCallsMade: 0
    };
  }
  
  /**
   * Handles schedule modifications: add_recurring_habit, move_task, delete_task, reschedule_task.
   */
private static async modifySchedule(
    uid: string,
    planId: string,
    modification: ScheduleModification,
    state?: GraphState
  ): Promise<ModifyScheduleResult> {
    const warnings: string[] = [];
    const affectedTasks: string[] = [];
    const affectedDays: string[] = [];
    let hasConflicts = false;
    const conflictDetails: string[] = [];

    try {
      // 1. Load current workspace
      const workflowId = state?.workflowId || `modify-schedule-${uid}-${Date.now()}`;
      let normalizedContext: PlanningContext;
      
      if (state && state.contextVersion) {
        normalizedContext = ContextOrchestrator.getContext(workflowId) as PlanningContext;
      } else {
        normalizedContext = await ContextOrchestrator.loadContext(
          uid,
          workflowId,
          "Schedule modification",
          undefined,
          "planning"
        ) as PlanningContext;
      }
      
      const timezone = normalizedContext.profile.timezone || "UTC";
      
      // 2. Load existing schedule
      const existingSchedule = await WeeklyExecutionSchedule.findOne({
        firebaseUid: uid,
        planId: planId,
        status: "ACTIVE"
      }).lean() as unknown as LeanWeeklySchedule;
      
      if (!existingSchedule) {
        return {
          success: false,
          persisted: false,
          modified: false,
          warnings: ["No active schedule found for modification"],
          affectedTasks: [],
          affectedDays: []
        };
      }
      
      // 3. Apply modification
      const scheduleData = existingSchedule.days;
      
      switch (modification.operation) {
        case "add_recurring_habit":
          // Extract habit details from payload
          const habitTitle = modification.payload.title || "New Habit";
          const preferredDays = modification.payload.days || [];
          const habitStartTime = modification.payload.startTime || "09:00";
          const habitEndTime = modification.payload.endTime || "10:00";
          const habitDuration = modification.payload.duration || 60;
          
          // Parse times to minutes for conflict detection
          const habitStartMin = timeToMinutes(habitStartTime);
          const habitEndMin = timeToMinutes(habitEndTime);
          
          // Phase 1: Check all target days for conflicts
          for (const day of scheduleData) {
            const dayOfWeek = new Date(day.date).toLocaleDateString("en-US", { weekday: "long", timeZone: timezone });
            
            if (preferredDays.length > 0 && !preferredDays.includes(dayOfWeek)) {
              continue;
            }
            
            // Check for overlapping work blocks
            for (const wb of day.workBlocks) {
              const wbStart = timeToMinutes(wb.startTime);
              const wbEnd = timeToMinutes(wb.endTime);
              
              // Detect overlap: (habitStart < wbEnd && habitEnd > wbStart)
              if (habitStartMin < wbEnd && habitEndMin > wbStart) {
                hasConflicts = true;
                conflictDetails.push(`Conflict on ${day.date}: overlaps with "${wb.title}" (${wb.startTime}-${wb.endTime})`);
              }
            }
          }
          
          // Phase 2: If no conflicts, insert the habit block on all target days
          if (!hasConflicts) {
            for (const day of scheduleData) {
              const dayOfWeek = new Date(day.date).toLocaleDateString("en-US", { weekday: "long", timeZone: timezone });
              
              if (preferredDays.length > 0 && !preferredDays.includes(dayOfWeek)) {
                continue;
              }
              
              // Insert the habit block (using tasks array for lean doc compatibility)
              day.workBlocks.push({
                title: habitTitle,
                startTime: habitStartTime,
                endTime: habitEndTime,
                duration: habitDuration,
                priority: 3,
                tasks: []
              });
              affectedDays.push(day.date);
            }
          }
          
          if (hasConflicts) {
            warnings.push(`add_recurring_habit conflicts detected: ${conflictDetails.join("; ")}`);
          }
          break;
          
        case "move_task":
          warnings.push("move_task operation not yet implemented");
          break;
        case "delete_task":
          warnings.push("delete_task operation not yet implemented");
          break;
        case "reschedule_task":
          warnings.push("reschedule_task operation not yet implemented");
          break;
        default:
          warnings.push(`Unknown operation: ${(modification as Record<string, unknown>).operation}`);
      }
      
      // 4. Persist through existing path (only if no conflicts)
      if (hasConflicts) {
        return {
          success: false,
          persisted: false,
          modified: false,
          warnings: [...warnings, ...conflictDetails],
          affectedTasks,
          affectedDays
        };
      }
      
      const startDate = new Date();
      const startDateStr = startDate.toLocaleDateString("en-CA", { timeZone: timezone });
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      const endDateStr = endDate.toLocaleDateString("en-CA", { timeZone: timezone });
      
      const scheduleDoc = await PlanSyncService.persistWeeklySchedule(
        uid,
        planId,
        { days: scheduleData },
        startDateStr,
        endDateStr,
        timezone
      );
      
      // 5. Verify persistence
      const verifiedSchedule = await WeeklyExecutionSchedule.findById(scheduleDoc._id).lean();
      
      if (!verifiedSchedule) {
        warnings.push("Schedule document not found after persistence");
      }
      
      return {
        success: verifiedSchedule !== null,
        scheduleDoc: verifiedSchedule || scheduleDoc,
        persisted: verifiedSchedule !== null,
        modified: affectedTasks.length > 0 || affectedDays.length > 0,
        warnings,
        affectedTasks,
        affectedDays
      };
    } catch (err) {
      console.error("[SchedulingService] Schedule modification failed:", err);
      return {
        success: false,
        persisted: false,
        modified: false,
        warnings: err instanceof Error ? [err.message] : ["Unknown error during schedule modification"],
        affectedTasks: [],
        affectedDays: []
      };
    }
  }

  /**
    * Generates a 7-day WeeklyExecutionSchedule for a user.
    * Internal implementation detail - use applyScheduleChange() for orchestration.
    */
   private static async generateWeeklySchedule(
    uid: string,
    planId: string,
    state?: GraphState
  ): Promise<SchedulingResult> {
    try {
      console.log(`[SchedulingService] Generating weekly schedule for plan ${planId}`);
      const workflowId = state?.workflowId || `fallback-scheduling-${uid}-${Date.now()}`;

      // 1. Resolve normalized user context
      let normalizedContext: PlanningContext;
      if (state && state.contextVersion) {
        normalizedContext = ContextOrchestrator.getContext(workflowId) as PlanningContext;
      } else {
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
      const activeTasks: unknown[] = [];
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

      console.log("[DEBUG-AI] AI scheduleData days:", (scheduleData?.days as Array<Record<string, unknown>> | undefined)?.length);
      console.log("[DEBUG-AI] AI activeTasks passed to scheduler:", selectedTasks?.length);
      const firstDay = (scheduleData?.days as Array<Record<string, unknown>> | undefined)?.[0] as Record<string, unknown> | undefined;
      const debugWorkBlocks = (firstDay?.workBlocks as Array<Record<string, unknown>> | undefined);
      if (debugWorkBlocks?.[0]) {
        console.log("[DEBUG-AI] First workBlock taskIds:", debugWorkBlocks[0].taskIds);
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

      // 6. Verify persistence by reloading from database
      console.log("[SchedulingService] Verifying persistence of schedule...");
      const verifiedSchedule = await WeeklyExecutionSchedule.findById(scheduleDoc._id).lean();
      
      const verificationWarnings: string[] = [];
      
      if (!verifiedSchedule) {
        verificationWarnings.push("Schedule document not found after persistence");
      } else if (verifiedSchedule.firebaseUid !== uid) {
        verificationWarnings.push("Schedule document has incorrect firebaseUid");
      } else if (verifiedSchedule.planId?.toString() !== planId) {
        verificationWarnings.push("Schedule document has incorrect planId");
      } else if (!verifiedSchedule.days || verifiedSchedule.days.length === 0) {
        verificationWarnings.push("Schedule document has no days array");
      } else if (!verifiedSchedule.days.every((d) => d.workBlocks && d.workBlocks.length >= 0)) {
        verificationWarnings.push("Schedule document has days missing workBlocks");
      }

      // Invalidate fallback cache if instantiated here
      if (!state || !state.contextVersion) {
        ContextOrchestrator.invalidateCache(workflowId);
      }

      return {
        success: verifiedSchedule !== null && verificationWarnings.length === 0,
        scheduleDoc: verifiedSchedule || scheduleDoc,
        persisted: verifiedSchedule !== null,
        warnings: verificationWarnings,
        aiCallsMade: 1
      };
    } catch (err) {
      console.error("[SchedulingService] Weekly Schedule generation failed:", err);
      return {
        success: false,
        scheduleDoc: null,
        persisted: false,
        warnings: err instanceof Error ? [err.message] : ["Unknown error during schedule generation"],
        aiCallsMade: 0
      };
    }
  }

  /**
    * Builds structured unavailable time windows for the scheduling prompt.
    * Combines sleep boundaries and recurring commitments into explicit time blocks.
    */
   private static buildUnavailableWindows(
     profile: NormalizedProfile,
     timezone: string,
     startDate: Date
   ): { day: string; date: string; unavailableWindows: { name: string; startTime: string; endTime: string }[] }[] {
     const unavailableWindows: { day: string; date: string; unavailableWindows: { name: string; startTime: string; endTime: string }[] }[] = [];
     const wakeTime = profile.wakeUpTime || "07:00";
     const sleepTime = profile.sleepTime || "23:00";
     
     for (let i = 0; i < 7; i++) {
       const current = new Date(startDate);
       current.setDate(startDate.getDate() + i);
       const dateStr = current.toLocaleDateString("en-CA", { timeZone: timezone });
       const dayOfWeek = current.toLocaleDateString("en-US", { weekday: "long", timeZone: timezone });
       
       const windows: { name: string; startTime: string; endTime: string }[] = [];
       
       // Sleep window - generic "Sleep" block outside wake/sleep times
       const wakeMin = timeToMinutes(wakeTime);
       const sleepMin = timeToMinutes(sleepTime);
       if (wakeMin > sleepMin) {
         // Sleep spans midnight
         windows.push({ name: "Sleep", startTime: "00:00", endTime: sleepTime });
         windows.push({ name: "Sleep", startTime: wakeTime, endTime: "23:59" });
       } else {
         // Sleep is continuous block
         windows.push({ name: "Sleep", startTime: "00:00", endTime: wakeTime });
         windows.push({ name: "Sleep", startTime: sleepTime, endTime: "23:59" });
       }
       
       // Add recurring commitments as unavailable
       const commitments = profile.commitments || [];
       commitments.forEach((commitment) => {
         if (commitment.days?.includes(dayOfWeek)) {
           windows.push({
             name: commitment.name,
             startTime: commitment.startTime,
             endTime: commitment.endTime
           });
         }
       });
       
       unavailableWindows.push({
         day: dayOfWeek,
         date: dateStr,
         unavailableWindows: windows
       });
     }
     
return unavailableWindows;
    }

   /**
    * Builds the base timeline from wake/sleep + commitments.
    * These blocks are automatically generated from profile and DO NOT go through AI.
    */
private static buildBaseTimeline(
      profile: NormalizedProfile,
      startDate: Date,
      timezone: string
    ): Array<{
      date: string;
      dayNumber: number;
      dayOfWeek: string;
      baseBlocks: Array<{ title: string; startTime: string; endTime: string; duration: number; priority: number; taskIds: string[]; origin: WorkBlockOrigin }>;
    }> {
const baseTimeline: Array<{
        date: string;
        dayNumber: number;
        dayOfWeek: string;
        baseBlocks: Array<{ title: string; startTime: string; endTime: string; duration: number; priority: number; taskIds: string[]; origin: WorkBlockOrigin }>;
      }> = [];
     
     const wakeTime = profile.wakeUpTime || "07:00";
     const sleepTime = profile.sleepTime || "23:00";
     
     for (let i = 0; i < 7; i++) {
       const current = new Date(startDate);
       current.setDate(startDate.getDate() + i);
       const dateStr = current.toLocaleDateString("en-CA", { timeZone: timezone });
       const dayOfWeek = current.toLocaleDateString("en-US", { weekday: "long", timeZone: timezone });
       
const baseBlocks: Array<{ title: string; startTime: string; endTime: string; duration: number; priority: number; taskIds: string[]; origin: WorkBlockOrigin; }> = [];
      
        // Wake block (morning routine time before first commitment)
        baseBlocks.push({
          title: "Wake & Morning Routine",
          startTime: "00:00",
          endTime: wakeTime,
          duration: timeToMinutes(wakeTime),
          priority: 5, // Low priority - just structure
          taskIds: [], // Structure-only block, no tasks
          origin: "system"
        });
        
        // Add commitments as structure blocks
        const commitments = profile.commitments || [];
        commitments.forEach((commitment) => {
          if (commitment.days?.includes(dayOfWeek) && commitment.startTime && commitment.endTime) {
            baseBlocks.push({
              title: commitment.name,
              startTime: commitment.startTime,
              endTime: commitment.endTime,
              duration: timeToMinutes(commitment.endTime) - timeToMinutes(commitment.startTime),
              priority: 4, // Medium priority - fixed
              taskIds: [], // Structure-only block
              origin: "system"
            });
          }
        });
        
        // Sleep block
        baseBlocks.push({
          title: "Rest & Sleep",
          startTime: sleepTime,
          endTime: "23:59",
          duration: (24 * 60 - timeToMinutes(sleepTime)),
          priority: 5, // Low priority - just structure
          taskIds: [], // Structure-only block
          origin: "system"
        });
       
       baseTimeline.push({
         date: dateStr,
         dayNumber: i,
         dayOfWeek,
         baseBlocks
       });
     }
     
     return baseTimeline;
   }

   /**
    * Merges AI-generated work blocks with base timeline, sorted chronologically.
    * Filters out empty work blocks (those with no tasks).
    */
private static mergeTimelineWithAI(
      baseTimeline: Array<{
        date: string;
        dayNumber: number;
        dayOfWeek: string;
        baseBlocks: Array<{ title: string; startTime: string; endTime: string; duration: number; priority: number; taskIds: string[]; origin: WorkBlockOrigin }>;
      }>,
      aiDays: Array<Record<string, unknown>>
    ): Array<Record<string, unknown>> {
      return baseTimeline.map((day, idx) => {
        const aiDay = aiDays[idx] || {};
        const aiBlocks = (aiDay.workBlocks as Array<{ title: string; startTime: string; endTime: string; duration: number; priority: number; taskIds: string[]; origin?: WorkBlockOrigin }> | undefined) || [];
        
        // Filter out empty work blocks (no tasks) and ensure origin: "ai" for AI-generated blocks
        const validAIBlocks = aiBlocks
          .filter(b => (b.taskIds?.length ?? 0) > 0)
          .map(b => ({ ...b, origin: "ai" as const }));
       
       // Merge all blocks
       const allBlocks = [...day.baseBlocks, ...validAIBlocks];
       
       // Sort chronologically by startTime
       allBlocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
       
       return {
         date: day.date,
         dayNumber: day.dayNumber,
         focusTheme: aiDay.focusTheme || "Task Execution",
         estimatedWorkload: aiDay.estimatedWorkload || "Medium",
         plannedFocusHours: aiDay.plannedFocusHours || allBlocks.reduce((sum, b) => sum + b.duration, 0) / 60,
         workBlocks: allBlocks
       };
     });
   }

  /**
    * PURE AI Reasoning function for weekly scheduling.
    */
   private static async generateWeeklyScheduleLogic(
    context: PlanningContext,
    activeTasks: unknown[],
    startDateStr: string,
    timezone: string,
    dailyCapacities: { day: string; date: string; minutes: number }[]
  ): Promise<Record<string, unknown>> {
    const profile = context.profile;
    
    // Preprocess: Build structured unavailable windows
    const startDate = new Date(startDateStr);
    const unavailableWindows = SchedulingService.buildUnavailableWindows(profile, timezone, startDate);
    const unavailableWindowsStr = unavailableWindows.map(uw => 
      `${uw.date} (${uw.day}): ${uw.unavailableWindows.map(w => `${w.name}: ${w.startTime}-${w.endTime}`).join(", ")}`
    ).join("\n");

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
    
    // Preprocess: Extract existing commitment names to prevent duplication
    const existingCommitmentNames = (profile.commitments || []).map(c => c.name.toLowerCase());
    const commitmentDeduplicationGuide = existingCommitmentNames.length > 0
      ? `\nCRITICAL: The user already has these commitments: ${existingCommitmentNames.join(", ")}. DO NOT create duplicate work blocks with different names for these activities.`
      : "";

    const prompt = `
Create a realistic, human-centric 7-day schedule. Start Date: ${startDateStr}. Timezone: ${timezone}.

## UNAVAILABLE TIME WINDOWS (DO NOT SCHEDULE WORK IN THESE)
${unavailableWindowsStr}

## DAILY WORK/STUDY CAPACITY CONSTRAINTS
CRITICAL: You MUST respect these daily work/study capacity limits. Under no circumstances should the combined duration of work/study blocks (excluding sleep, meals, and recurring commitments) on any given day exceed these available minutes:
${capacitiesStr}

## USER LIFE MODEL INPUTS
${PlanningFormatter.format(context)}

## TASKS TO SCHEDULE
${JSON.stringify((activeTasks as Array<{ _id?: string; id?: string; title: string; estimatedMinutes?: number; priority?: number }>).map(t => ({ id: (t._id || t.id)?.toString(), title: t.title, durationMinutes: t.estimatedMinutes || 30, priority: t.priority })), null, 2)}

## SCHEDULING GUIDELINES & DEFAULT BLOCKS
CRITICAL: Even if the list of tasks to schedule is small or empty, DO NOT generate an empty weekly schedule.
You must construct a realistic, believable daily structure based on the user's Life Model inputs:
1. **Sleep boundaries**: Schedule rest and sleep blocks outside their wake/sleep times.
2. **Fixed Obligations**: Always include their fixed recurring commitments at their specified start/end times. DO NOT recreate them with different names.
3. **Buffer & Routine Blocks**: Insert standard routine blocks:
   - "Travel / Transition Buffer" before and after fixed commitments if needed.
   - "Meals & Rest Buffers" (Lunch, Dinner).
   - "Daily Study / Review Block" (e.g. 1.5 - 2 hours) for their long-term goal/focus during their preferred deep work time.
   - "Daily Consistency / Habit Block" (e.g. 30 mins) for focus consistency.
   - "Rest & Recharge" blocks on weekends or evenings.
4. **EMPTY WORK BLOCKS FORBIDDEN**: Every generated work block MUST contain at least one task in its \`taskIds\` array. If no tasks are relevant for a time slot, DO NOT create a work block there.
${commitmentDeduplicationGuide}

Each block must have a clear startTime and endTime, non-overlapping, and must feel believably structured.
`;

    const scheduleResponseSchema = {
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

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(content);
      const daysArray = result?.days as Array<Record<string, unknown>> | undefined;
      const firstDay = daysArray?.[0] as Record<string, unknown> | undefined;
      const workBlocks = firstDay?.workBlocks as Array<Record<string, unknown>> | undefined;
      console.log("[DEBUG-AI-BEFORE] Raw AI workBlocks taskIds:", JSON.stringify(workBlocks?.map((wb) => ({ title: wb.title, taskIds: wb.taskIds })), null, 2));
      result = AIValidationService.validateAndRepairSchedule(result, profile);
      const validatedDays = result?.days as Array<Record<string, unknown>> | undefined;
      const validatedFirstDay = validatedDays?.[0] as Record<string, unknown> | undefined;
      const validatedWorkBlocks = validatedFirstDay?.workBlocks as Array<Record<string, unknown>> | undefined;
      console.log("[DEBUG-AI-AFTER] Validated workBlocks taskIds:", JSON.stringify(validatedWorkBlocks?.map((wb) => ({ title: wb.title, taskIds: wb.taskIds })), null, 2));
    } catch {
      console.warn(`[AI Validation] Initial schedule validation failed. Retrying once...`);
      const retryPrompt = `
${prompt}

---
IMPORTANT: Your previous response failed structural validation.
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
      result = AIValidationService.validateAndRepairSchedule(result, profile);
    }

    // Build base timeline from profile and merge with AI output
    const baseTimeline = SchedulingService.buildBaseTimeline(profile, startDate, timezone);
    const mergedDays = SchedulingService.mergeTimelineWithAI(baseTimeline, result.days as Array<Record<string, unknown>>);
    
    return { ...result, days: mergedDays };
  }

  /**
    * Computes available work/study capacity in minutes for each of the next 7 days.
    */
   private static calculateDailyCapacities(
    profile: NormalizedProfile,
    startDate: Date,
    timezone: string
  ): { day: string; date: string; minutes: number }[] {
    const dailyCapacities: { day: string; date: string; minutes: number }[] = [];
    const wakeUpTime = (profile?.wakeUpTime as string) || "07:00";
    const sleepTime = (profile?.sleepTime as string) || "23:00";
    const dailyAvailHrs = parseFloat((profile?.dailyAvailability as string) || "8.0");
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
      const commitments = profile.commitments;
      if (Array.isArray(commitments)) {
        commitments.forEach((c) => {
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
    activeTasks: unknown[],
    totalCapacityMinutes: number
  ): unknown[] {
    const getTaskMinutes = (t: Record<string, unknown>): number => {
      if (typeof t.estimatedMinutes === "number" && t.estimatedMinutes > 0) {
        return t.estimatedMinutes;
      }
      const dur = t.estimatedDuration as string | undefined;
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

    const tasksWithMetadata = (activeTasks as Array<Record<string, unknown>>).map(t => ({
      task: t,
      duration: getTaskMinutes(t),
      priority: typeof t.priority === "number" ? t.priority : 3,
      id: (t._id || t.id) as string
    }));

    tasksWithMetadata.sort((a, b) => a.priority - b.priority);

    const selectedTasks: unknown[] = [];
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
        const deps = item.task.dependencies as string[] | undefined;
        if (Array.isArray(deps)) {
          for (const dep of deps) {
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