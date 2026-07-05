import { COMMAND_REGISTRY, CommandDefinition } from "./command-registry";
import { SchedulePatchService } from "@/services/schedule-patch.service";
import { SchedulingService } from "@/services/scheduling.service";
import { CalendarSyncService } from "@/services/calendar-sync.service";
import { PlanningAgent } from "@/agents/planning-agent";
import { MemoryRepository } from "@/repositories/memory.repository";
import { IdentityRepository } from "@/repositories/identity.repository";
import { ReflectionRepository } from "@/repositories/reflection.repository";
import { PendingActionService } from "@/services/pending-action.service";
import { CommandValidator } from "./command-validator";
import { TaskRepository } from "@/repositories/task.repository";
import { Task } from "@/models/Task";
import { Plan } from "@/models/Plan";
import { Milestone } from "@/models/Milestone";
import { User } from "@/models/User";
import { WeeklyExecutionSchedule } from "@/models/WeeklyExecutionSchedule";
import { Types } from "mongoose";

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
}

export class CommandDispatcher {
  /**
   * Main dispatch entry point.
   */
  static async dispatch(
    uid: string,
    commandId: string,
    args: Record<string, any>,
    conversationId: string
  ): Promise<CommandResult> {
    const start = Date.now();
    console.log(`[Command] Parsing command: ${commandId}`);

    const cmdDef = COMMAND_REGISTRY.find(c => c.id === commandId);
    if (!cmdDef) {
      console.error(`[Command] Unknown command: ${commandId}`);
      return { success: false, message: "Unknown command identifier." };
    }

    // 1. Dedicated Validation Layer
    const validation = await CommandValidator.validate(uid, commandId, args);
    if (!validation.valid) {
      console.warn(`[Command] Validation failed: ${validation.error}`);
      return { success: false, message: validation.error || "Validation failed." };
    }

    // 2. Conflict/Overlap detection
    if (validation.hasConflict) {
      console.log(`[Command] Conflict detected. Creating schedule_conflict PendingAction.`);
      
      let opType: "add_block" | "move_block" | "resize_block" | "delete_block" | "create_task" | "edit_task";
      if (commandId === "task.create") {
        opType = "create_task";
      } else if (commandId === "task.edit") {
        opType = "edit_task";
      } else if (commandId.startsWith("schedule.move")) {
        opType = "move_block";
      } else if (commandId.startsWith("schedule.resize")) {
        opType = "resize_block";
      } else {
        opType = "add_block";
      }

      await PendingActionService.create(conversationId, "schedule_conflict", {
        scheduleOperation: {
          type: opType,
          date: args.date,
          title: args.title || args.blockTitle,
          blockTitle: args.id || args.title || args.blockTitle,
          startTime: args.startTime || args.newStartTime,
          endTime: args.endTime || args.newEndTime,
          description: args.description,
          priority: args.priority,
          estimatedMinutes: args.estimatedMinutes,
        },
        conflicts: validation.conflicts
      });

      return {
        success: true,
        message: `Conflict detected with existing blocks. Please choose what Zen should do.`
      };
    }

    console.log(`[Command] Validation passed`);

    try {
      let result: CommandResult;
      
      switch (commandId) {
        // --- Schedule ---
        case "schedule.today":
          result = await this.handleToday(uid);
          break;
        case "schedule.week":
          result = await this.handleWeek(uid);
          break;
        case "schedule.add":
          result = await this.handleScheduleAdd(uid, args);
          break;
        case "schedule.move":
          result = await this.handleScheduleMove(uid, args);
          break;
        case "schedule.resize":
          result = await this.handleScheduleResize(uid, args);
          break;
        case "schedule.delete":
          result = await this.handleScheduleDelete(uid, args);
          break;
        case "schedule.clear":
          result = await this.handleScheduleClear(uid, args);
          break;

        // --- Tasks ---
        case "task.create":
          result = await this.handleTaskCreate(uid, args);
          break;
        case "task.edit":
          result = await this.handleTaskEdit(uid, args);
          break;
        case "task.complete":
          result = await this.handleTaskUpdate(uid, args, "completed");
          break;
        case "task.reopen":
          result = await this.handleTaskUpdate(uid, args, "todo");
          break;
        case "task.delete":
          result = await this.handleTaskDelete(uid, args);
          break;
        case "task.archive":
          result = await this.handleTaskArchive(uid, args);
          break;

        // --- Roadmap & Workspace ---
        case "roadmap.view":
          result = await this.handleRoadmapView(uid);
          break;
        case "roadmap.regenerate":
          result = await this.handleRoadmapRegenerate(uid);
          break;
        case "roadmap.difficulty":
          result = await this.handleRoadmapDifficulty(uid, args);
          break;
        case "roadmap.pause":
          result = await this.handleRoadmapGoalStatus(uid, args, "pause");
          break;
        case "roadmap.resume":
          result = await this.handleRoadmapGoalStatus(uid, args, "resume");
          break;
        case "workspace.regenerate":
          result = await this.handleWorkspaceRegenerate(uid);
          break;

        // --- Calendar ---
        case "calendar.sync":
          result = await this.handleCalendarSync(uid);
          break;
        case "calendar.disconnect":
          result = await this.handleCalendarDisconnect(uid);
          break;

        // --- Memory ---
        case "memory.search":
          result = await this.handleMemorySearch(uid, args);
          break;
        case "memory.forget":
          result = await this.handleMemoryForget(uid, args);
          break;

        // --- Identity & Reflection ---
        case "identity.view":
          result = await this.handleIdentityView(uid);
          break;
        case "reflection.view":
          result = await this.handleReflectionView(uid);
          break;

        default:
          result = { success: false, message: `No execution handler registered for command: ${commandId}` };
      }

      const elapsed = Date.now() - start;
      if (result.success) {
        console.log(`[Command] Success (${elapsed}ms)`);
      } else {
        console.warn(`[Command] Executed with warning/failure: ${result.message} (${elapsed}ms)`);
      }
      return result;

    } catch (err: any) {
      const elapsed = Date.now() - start;
      console.error(`[Command] Critical error during execution of ${commandId}: ${err.message} (${elapsed}ms)`);
      return { success: false, message: `Execution failed: ${err.message}` };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  private static async handleToday(uid: string): Promise<CommandResult> {
    console.log(`[Schedule] Loading today's agenda`);
    const schedule = await WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" }).lean();
    if (!schedule) {
      return { success: false, message: "No active schedule found. Create a roadmap or regenerate workspace first." };
    }

    const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const dayData = (schedule.days as any[]).find((d: any) => d.date === todayStr);

    if (!dayData || !dayData.workBlocks || dayData.workBlocks.length === 0) {
      return { success: true, message: `Your schedule is clear for today (${todayStr}). Enjoy the breathing room!` };
    }

    const blockList = dayData.workBlocks
      .map((b: any) => `- **${b.startTime} - ${b.endTime}**: ${b.title} [Priority ${b.priority}] (${b.origin || "ai"})`)
      .join("\n");

    return {
      success: true,
      message: `### Today's Agenda (${todayStr})\n\nFocus Theme: *${dayData.focusTheme || "General"}*\n\nWork Blocks:\n${blockList}`,
      data: dayData
    };
  }

  private static async handleWeek(uid: string): Promise<CommandResult> {
    console.log(`[Schedule] Loading weekly overview`);
    const schedule = await WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" }).lean();
    if (!schedule) {
      return { success: false, message: "No active schedule found." };
    }

    const overview = (schedule.days as any[])
      .map((d: any) => {
        const count = d.workBlocks ? d.workBlocks.length : 0;
        return `- **${d.date}** (${d.focusTheme || "General"}): ${count} block(s) scheduled`;
      })
      .join("\n");

    return {
      success: true,
      message: `### Weekly Agenda Overview\n\n${overview}`,
      data: schedule
    };
  }

  private static async handleScheduleAdd(uid: string, args: Record<string, any>): Promise<CommandResult> {
    console.log(`[Schedule] Executing SchedulePatchService.addWorkBlock()`);
    const schedule = await SchedulePatchService.addWorkBlock({
      firebaseUid: uid,
      date: args.date,
      title: args.title,
      startTime: args.startTime,
      endTime: args.endTime
    });

    if (!schedule) {
      return { success: false, message: "Failed to add work block. Date might be outside the active weekly schedule." };
    }

    // Trigger Google Calendar sync
    CalendarSyncService.queueSync(uid).catch(err => console.error("[Command] Sync failed:", err));

    return {
      success: true,
      message: `Added work block **"${args.title}"** to **${args.date}** from **${args.startTime}** to **${args.endTime}**.`
    };
  }

  private static async handleScheduleMove(uid: string, args: Record<string, any>): Promise<CommandResult> {
    console.log(`[Schedule] Executing SchedulePatchService.moveWorkBlock()`);
    const schedule = await SchedulePatchService.moveWorkBlock({
      firebaseUid: uid,
      date: args.date,
      title: args.title,
      newStartTime: args.startTime,
      newEndTime: args.endTime
    });

    if (!schedule) {
      return { success: false, message: `Could not find a user-created block named "${args.title}" on ${args.date} to move.` };
    }

    CalendarSyncService.queueSync(uid).catch(err => console.error("[Command] Sync failed:", err));

    return {
      success: true,
      message: `Moved block **"${args.title}"** on **${args.date}** to **${args.startTime} - ${args.endTime}**.`
    };
  }

  private static async handleScheduleResize(uid: string, args: Record<string, any>): Promise<CommandResult> {
    console.log(`[Schedule] Executing SchedulePatchService.resizeWorkBlock()`);
    const schedule = await SchedulePatchService.resizeWorkBlock({
      firebaseUid: uid,
      date: args.date,
      title: args.title,
      newStartTime: args.startTime,
      newEndTime: args.endTime
    });

    if (!schedule) {
      return { success: false, message: `Could not find block "${args.title}" on ${args.date} to resize.` };
    }

    CalendarSyncService.queueSync(uid).catch(err => console.error("[Command] Sync failed:", err));

    return {
      success: true,
      message: `Resized block **"${args.title}"** on **${args.date}** to **${args.startTime} - ${args.endTime}**.`
    };
  }

  private static async handleScheduleDelete(uid: string, args: Record<string, any>): Promise<CommandResult> {
    console.log(`[Schedule] Executing SchedulePatchService.removeWorkBlock()`);
    const schedule = await SchedulePatchService.removeWorkBlock({
      firebaseUid: uid,
      date: args.date,
      title: args.title
    });

    if (!schedule) {
      return { success: false, message: `Could not find a user-created block named "${args.title}" on ${args.date} to delete.` };
    }

    CalendarSyncService.queueSync(uid).catch(err => console.error("[Command] Sync failed:", err));

    return {
      success: true,
      message: `Removed block **"${args.title}"** from **${args.date}**.`
    };
  }

  private static async handleScheduleClear(uid: string, args: Record<string, any>): Promise<CommandResult> {
    console.log(`[Schedule] Clearing all user blocks on ${args.date}`);
    const schedule = await WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" });
    if (!schedule) return { success: false, message: "No active schedule found." };

    const day = schedule.days.find((d: any) => d.date === args.date);
    if (!day) return { success: false, message: `Date ${args.date} not found in weekly schedule.` };

    const originalLength = day.workBlocks.length;
    day.workBlocks = day.workBlocks.filter((b: any) => b.origin !== "user");

    if (day.workBlocks.length === originalLength) {
      return { success: true, message: `No user blocks found to clear on ${args.date}.` };
    }

    await schedule.save();
    CalendarSyncService.queueSync(uid).catch(err => console.error("[Command] Sync failed:", err));

    return { success: true, message: `Cleared all user-added blocks on **${args.date}**.` };
  }

  private static async handleTaskUpdate(uid: string, args: Record<string, any>, status: "completed" | "todo"): Promise<CommandResult> {
    console.log(`[Execution] Updating task status to ${status}`);
    const identifier = args.id;
    let task = null;

    if (Types.ObjectId.isValid(identifier)) {
      task = await Task.findOneAndUpdate(
        { _id: new Types.ObjectId(identifier), firebaseUid: uid },
        { $set: { status, completedAt: status === "completed" ? new Date() : null } },
        { returnDocument: "after" }
      );
    } else {
      // Find by title case-insensitive
      task = await Task.findOneAndUpdate(
        { title: new RegExp(`^${identifier}$`, "i"), firebaseUid: uid },
        { $set: { status, completedAt: status === "completed" ? new Date() : null } },
        { returnDocument: "after" }
      );
    }

    if (!task) {
      return { success: false, message: `Could not find task matching "${identifier}".` };
    }

    // Recalculate roadmap progress
    await PlanningAgent.recalculateProgress(uid, task._id.toString());

    return {
      success: true,
      message: `Marked task **"${task.title}"** as **${status === "completed" ? "completed ✓" : "active/todo"}**.`
    };
  }

  private static async handleTaskArchive(uid: string, args: Record<string, any>): Promise<CommandResult> {
    console.log(`[Execution] Archiving task`);
    const identifier = args.id;
    let task = null;

    if (Types.ObjectId.isValid(identifier)) {
      task = await Task.findOneAndUpdate(
        { _id: new Types.ObjectId(identifier), firebaseUid: uid },
        { $set: { status: "archived" } },
        { returnDocument: "after" }
      );
    } else {
      task = await Task.findOneAndUpdate(
        { title: new RegExp(`^${identifier}$`, "i"), firebaseUid: uid },
        { $set: { status: "archived" } },
        { returnDocument: "after" }
      );
    }

    if (!task) {
      return { success: false, message: `Could not find task matching "${identifier}".` };
    }

    await PlanningAgent.recalculateProgress(uid, task._id.toString());

    return { success: true, message: `Archived task **"${task.title}"**.` };
  }

  private static async handleRoadmapRegenerate(uid: string): Promise<CommandResult> {
    console.log(`[Planner] Roadmap regeneration requested`);
    const activePlans = await Plan.find({ firebaseUid: uid, status: "active" }).lean();
    if (activePlans.length === 0) {
      return { success: false, message: "No active plans found to regenerate roadmap. Please create a roadmap first." };
    }

    const activePlan = activePlans[0];
    const intent = {
      type: "create_or_modify" as const,
      planType: ((activePlan as any).type || "personal") as any,
      goalTitle: activePlan.title,
    };

    console.log(`[Planner] Running PlanningAgent.generateOrEvolvePlan`);
    const success = await PlanningAgent.generateOrEvolvePlan(
      uid,
      intent,
      `Force regeneration of roadmap: ${activePlan.title}`
    );

    if (!success) {
      return { success: false, message: "Strategic roadmap regeneration failed." };
    }

    return { success: true, message: `Roadmap for **"${activePlan.title}"** has been regenerated successfully.` };
  }

  private static async handleWorkspaceRegenerate(uid: string): Promise<CommandResult> {
    console.log(`[Schedule] Workspace schedule regeneration requested`);
    const activePlans = await Plan.find({ firebaseUid: uid, status: "active" }).lean();
    if (activePlans.length === 0) {
      return { success: false, message: "No active roadmap plans found to generate schedule." };
    }

    const planId = activePlans[0]._id.toString();
    console.log(`[Schedule] Running SchedulingService.applyScheduleChange() with create_workspace`);
    const result: any = await SchedulingService.applyScheduleChange({
      type: "create_workspace",
      userId: uid,
      planId
    });

    if (!result || !result.success) {
      return { success: false, message: "Workspace schedule regeneration failed." };
    }

    return { success: true, message: "Weekly workspace schedule rebuilt from scratch successfully." };
  }

  private static async handleCalendarSync(uid: string): Promise<CommandResult> {
    console.log(`[MCP] Google Calendar sync triggered`);
    const user = await User.findOne({ firebaseUid: uid });
    if (!user || !user.googleCalendarSettings?.connected) {
      return { success: false, message: "Google Calendar is not connected. Connect it in Integrations Settings first." };
    }

    await CalendarSyncService.queueSync(uid);
    return { success: true, message: "Google Calendar synchronization queued." };
  }

  private static async handleCalendarDisconnect(uid: string): Promise<CommandResult> {
    console.log(`[MCP] Disconnecting Google Calendar`);
    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      {
        $set: {
          "googleCalendarSettings.connected": false,
          "googleCalendarSettings.accessToken": null,
          "googleCalendarSettings.refreshToken": null,
          "googleCalendarSettings.expiry": null
        }
      },
      { returnDocument: "after" }
    );

    if (!user) return { success: false, message: "User profile not found." };
    return { success: true, message: "Google Calendar has been disconnected." };
  }

  private static async handleMemorySearch(uid: string, args: Record<string, any>): Promise<CommandResult> {
    console.log(`[Memory] Searching memory for query: ${args.query}`);
    const memories = await MemoryRepository.findApprovedByUser(uid);
    const query = args.query.toLowerCase();
    
    const matches = memories.filter(
      (m: any) =>
        m.content.toLowerCase().includes(query) ||
        (m.keywords && m.keywords.some((k: string) => k.toLowerCase().includes(query)))
    );

    if (matches.length === 0) {
      return { success: true, message: `No active memories found matching query: "${args.query}"` };
    }

    const matchText = matches
      .map((m: any) => `- **[${m.category}]** (Confidence: ${(m.confidence * 100).toFixed(0)}%): "${m.content}" (ID: \`${m._id}\`)`)
      .join("\n");

    return { success: true, message: `### Memory Search Results for "${args.query}"\n\n${matchText}` };
  }

  private static async handleMemoryForget(uid: string, args: Record<string, any>): Promise<CommandResult> {
    console.log(`[Memory] Forgetting memory ID: ${args.id}`);
    const memory = await MemoryRepository.findById(args.id);
    if (!memory || memory.firebaseUid !== uid) {
      return { success: false, message: `Memory ID "${args.id}" not found.` };
    }

    await MemoryRepository.archive(args.id);
    return { success: true, message: `Memory fact **"${memory.summary || memory.content}"** has been forgotten.` };
  }

  private static async handleIdentityView(uid: string): Promise<CommandResult> {
    console.log(`[Identity] Retrieving traits for user ${uid}`);
    const traits = await IdentityRepository.findActiveByUser(uid);
    if (traits.length === 0) {
      return { success: true, message: "No active identity traits captured yet. Continue interacting with Zen to build your identity profile." };
    }

    const traitLines = traits
      .map((t: any) => `- **${t.trait}** (${t.category}): ${t.description || "No description provided."} (Confidence: ${(t.confidence * 100).toFixed(0)}%)`)
      .join("\n");

    return {
      success: true,
      message: `### Core Identity Profile\n\nHere are the psychological and behavior traits Zen has captured for you:\n\n${traitLines}`
    };
  }

  private static async handleReflectionView(uid: string): Promise<CommandResult> {
    console.log(`[Reflection] Retrieving reflection insights for user ${uid}`);
    const reflections = await ReflectionRepository.findActiveByUser(uid);
    if (reflections.length === 0) {
      return { success: true, message: "No reflection insights generated yet. Daily review loops compile consistency reports." };
    }

    const reflectionLines = reflections
      .map((r: any) => `- **${r.title || r.category || 'Insight'}**: ${r.summary} (Importance: ${(r.importance * 10).toFixed(0)}/10)`)
      .join("\n");

    return {
      success: true,
      message: `### Zen Consistency Reflections\n\nRecent psychological and execution consistency insights:\n\n${reflectionLines}`
    };
  }

  private static async handleTaskCreate(uid: string, args: Record<string, any>): Promise<CommandResult> {
    console.log(`[Execution] Creating task: ${args.title}`);
    const taskData: any = {
      firebaseUid: uid,
      title: args.title,
      description: args.description || "",
      source: "USER"
    };
    if (args.priority !== undefined && args.priority !== "") taskData.priority = Number(args.priority);
    if (args.estimatedMinutes !== undefined && args.estimatedMinutes !== "") taskData.estimatedMinutes = Number(args.estimatedMinutes);
    if (args.date !== undefined && args.date !== "") taskData.suggestedDate = args.date;
    if (args.startTime && args.endTime) {
      taskData.timeBlock = `${args.startTime} - ${args.endTime}`;
    }

    const task = await TaskRepository.create(taskData);

    // If date and times are set, add a corresponding user-origin schedule block
    if (args.date && args.startTime && args.endTime) {
      console.log(`[Execution] Auto-scheduling work block for task "${task.title}"`);
      await SchedulePatchService.addWorkBlock({
        firebaseUid: uid,
        date: args.date,
        title: args.title,
        startTime: args.startTime,
        endTime: args.endTime,
        priority: args.priority ? Number(args.priority) : 3,
        tasks: [task._id]
      });
    }

    return {
      success: true,
      message: `Task **"${task.title}"** has been created successfully.`
    };
  }

  private static async handleTaskEdit(uid: string, args: Record<string, any>): Promise<CommandResult> {
    console.log(`[Execution] Editing task: ${args.id}`);
    
    let task = null;
    if (Types.ObjectId.isValid(args.id)) {
      task = await Task.findOne({ _id: new Types.ObjectId(args.id), firebaseUid: uid });
    } else {
      task = await Task.findOne({ title: args.id, firebaseUid: uid });
    }

    if (!task) {
      return { success: false, message: `Task not found.` };
    }

    const updates: any = {};
    if (args.title !== undefined && args.title !== "") updates.title = args.title;
    if (args.description !== undefined && args.description !== "") updates.description = args.description;
    if (args.priority !== undefined && args.priority !== "") updates.priority = Number(args.priority);
    if (args.estimatedMinutes !== undefined && args.estimatedMinutes !== "") updates.estimatedMinutes = Number(args.estimatedMinutes);
    if (args.date !== undefined) updates.suggestedDate = args.date;
    if (args.startTime && args.endTime) {
      updates.timeBlock = `${args.startTime} - ${args.endTime}`;
    } else if (args.date === "") {
      updates.timeBlock = "";
    }

    const updated = await TaskRepository.update(task._id.toString(), updates);

    // Sync schedule block modifications
    if (args.date && args.startTime && args.endTime) {
      // Find and remove any old schedule blocks referencing this task ID
      const schedule = await WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" });
      if (schedule) {
        let blockFound = false;
        for (const day of schedule.days) {
          const idx = day.workBlocks.findIndex(b => b.tasks.some(tid => tid.toString() === task!._id.toString()));
          if (idx !== -1) {
            day.workBlocks.splice(idx, 1);
            blockFound = true;
          }
        }
        if (blockFound) {
          await schedule.save();
        }
      }

      // Add the new schedule block representing the updated slot
      console.log(`[Execution] Auto-updating work block location for task "${updated?.title || task.title}"`);
      await SchedulePatchService.addWorkBlock({
        firebaseUid: uid,
        date: args.date,
        title: args.title || task.title,
        startTime: args.startTime,
        endTime: args.endTime,
        priority: args.priority ? Number(args.priority) : task.priority,
        tasks: [task._id]
      });
    }

    // Recalculate roadmap progress
    await PlanningAgent.recalculateProgress(uid, task._id.toString());

    return {
      success: true,
      message: `Task **"${updated?.title || task.title}"** updated successfully.`
    };
  }

  private static async handleTaskDelete(uid: string, args: Record<string, any>): Promise<CommandResult> {
    console.log(`[Execution] Deleting task: ${args.id}`);
    
    let task = null;
    if (Types.ObjectId.isValid(args.id)) {
      task = await Task.findOne({ _id: new Types.ObjectId(args.id), firebaseUid: uid });
    } else {
      task = await Task.findOne({ title: args.id, firebaseUid: uid });
    }

    if (!task) {
      return { success: false, message: `Task not found.` };
    }

    const title = task.title;
    await TaskRepository.delete(task._id.toString());

    // Clean up corresponding work block on schedule
    const schedule = await WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" });
    if (schedule) {
      let blockFound = false;
      for (const day of schedule.days) {
        const idx = day.workBlocks.findIndex(b => b.tasks.some(tid => tid.toString() === task!._id.toString()) || b.title === task!.title);
        if (idx !== -1) {
          day.workBlocks.splice(idx, 1);
          blockFound = true;
        }
      }
      if (blockFound) {
        await schedule.save();
      }
    }

    // Recalculate roadmap progress
    await PlanningAgent.recalculateProgress(uid, task._id.toString());

    return {
      success: true,
      message: `Task **"${title}"** has been deleted.`
    };
  }

  private static async handleRoadmapView(uid: string): Promise<CommandResult> {
    console.log(`[Planner] Viewing roadmap for user ${uid}`);
    const activePlans = await Plan.find({ firebaseUid: uid, status: "active" }).lean();
    if (activePlans.length === 0) {
      return { success: true, message: "No active roadmap plans found. You can generate one using `/roadmap regenerate`." };
    }

    const plan = activePlans[0];
    const milestones = await Milestone.find({ planId: plan._id }).sort({ priority: 1 }).lean();
    
    const milestoneLines = milestones.map((m: any) => 
      `- **${m.title}** (${m.status}): ${m.description || "No description."} (Progress: ${m.progress || 0}%)`
    ).join("\n") || "No milestones defined yet.";

    return {
      success: true,
      message: `### Strategic Roadmap: ${plan.title}\n\n**Goal**: ${plan.description || "No details."}\n**Progress**: ${plan.progress}%\n\n**Milestones**:\n${milestoneLines}`
    };
  }

  private static async handleRoadmapDifficulty(uid: string, args: Record<string, any>): Promise<CommandResult> {
    console.log(`[Planner] Adjusting roadmap difficulty for user ${uid} to ${args.difficulty}`);
    
    const activePlans = await Plan.find({ firebaseUid: uid, status: "active" });
    if (activePlans.length === 0) {
      return { success: false, message: "No active roadmap plans found to adjust difficulty." };
    }

    // Set priority or diagnostics metadata representing difficulty
    await Plan.updateMany(
      { firebaseUid: uid, status: "active" },
      { $set: { "diagnostics.mergeStrategy": `difficulty_${args.difficulty}` } }
    );

    return {
      success: true,
      message: `Roadmap difficulty adjusted to **${args.difficulty}**. Zen will adjust the intensity of upcoming weekly schedules accordingly.`
    };
  }

  private static async handleRoadmapGoalStatus(
    uid: string,
    args: Record<string, any>,
    statusAction: "pause" | "resume"
  ): Promise<CommandResult> {
    console.log(`[Planner] ${statusAction === "pause" ? "Pausing" : "Resuming"} goal: ${args.title}`);
    
    const status = statusAction === "pause" ? "archived" : "active";
    const plan = await Plan.findOneAndUpdate(
      { title: new RegExp(`^${args.title}$`, "i"), firebaseUid: uid },
      { $set: { status } },
      { returnDocument: "after" }
    );

    if (!plan) {
      return { success: false, message: `Roadmap goal matching "${args.title}" not found.` };
    }

    return {
      success: true,
      message: `Goal **"${plan.title}"** has been ${statusAction === "pause" ? "paused (archived)" : "resumed (activated)"}.`
    };
  }
}
