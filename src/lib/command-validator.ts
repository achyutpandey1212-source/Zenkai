import { SchedulePatchService } from "@/services/schedule-patch.service";
import { Task } from "@/models/Task";
import { COMMAND_REGISTRY } from "./command-registry";
import { Types } from "mongoose";

export interface ValidationOutcome {
  valid: boolean;
  error?: string;
  hasConflict?: boolean;
  conflicts?: any[];
}

export class CommandValidator {
  /**
   * Validate parameters before dispatching.
   */
  static async validate(
    uid: string,
    commandId: string,
    args: Record<string, any>
  ): Promise<ValidationOutcome> {
    const cmd = COMMAND_REGISTRY.find(c => c.id === commandId);
    if (!cmd) {
      return { valid: false, error: `Command not found: ${commandId}` };
    }

    // 1. Check required parameters
    for (const p of cmd.parameters) {
      if (p.required && (args[p.name] === undefined || args[p.name] === null || args[p.name] === "")) {
        return { valid: false, error: `Parameter "${p.name}" is required for ${cmd.title}.` };
      }
    }

    // 2. Validate dates & times
    if (args.date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(args.date)) {
        return { valid: false, error: `Invalid date format: "${args.date}". Use YYYY-MM-DD.` };
      }
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (args.startTime && !timeRegex.test(args.startTime)) {
      return { valid: false, error: `Invalid start time: "${args.startTime}". Use HH:MM.` };
    }
    if (args.endTime && !timeRegex.test(args.endTime)) {
      return { valid: false, error: `Invalid end time: "${args.endTime}". Use HH:MM.` };
    }
    if (args.newStartTime && !timeRegex.test(args.newStartTime)) {
      return { valid: false, error: `Invalid start time: "${args.newStartTime}". Use HH:MM.` };
    }
    if (args.newEndTime && !timeRegex.test(args.newEndTime)) {
      return { valid: false, error: `Invalid end time: "${args.newEndTime}". Use HH:MM.` };
    }

    // Logical invariants: end > start
    const start = args.startTime || args.newStartTime;
    const end = args.endTime || args.newEndTime;
    if (start && end) {
      const startMinutes = this.timeToMinutes(start);
      const endMinutes = this.timeToMinutes(end);
      if (endMinutes <= startMinutes) {
        return { valid: false, error: `End time must be after start time.` };
      }
    }

    // 3. Task existence check
    if (args.id && (commandId.startsWith("task.complete") || commandId.startsWith("task.reopen") || commandId.startsWith("task.delete") || commandId.startsWith("task.archive") || commandId.startsWith("task.edit"))) {
      if (Types.ObjectId.isValid(args.id)) {
        const task = await Task.findOne({ _id: new Types.ObjectId(args.id), firebaseUid: uid });
        if (!task) {
          return { valid: false, error: `Task not found with ID "${args.id}".` };
        }
      } else {
        const task = await Task.findOne({ title: args.id, firebaseUid: uid });
        if (!task) {
          return { valid: false, error: `Task not found with title "${args.id}".` };
        }
      }
    }

    // 4. Overlap/Conflict checks
    if (args.date && start && end && (
      commandId === "schedule.add" || 
      commandId === "schedule.move" || 
      commandId === "schedule.resize" ||
      commandId === "task.create" ||
      commandId === "task.edit"
    )) {
      const conflictCheck = await SchedulePatchService.checkConflicts(uid, args.date, start, end);
      
      // Filter out self-conflicts if updating an existing named item
      let actualConflicts = conflictCheck.conflicts;
      const selfTitle = args.title || args.blockTitle;
      if (selfTitle) {
        actualConflicts = actualConflicts.filter(b => b.title !== selfTitle);
      }

      if (actualConflicts.length > 0) {
        return {
          valid: true, // structurally valid, but requires conflict resolution
          hasConflict: true,
          conflicts: actualConflicts
        };
      }
    }

    return { valid: true };
  }

  private static timeToMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  }
}
