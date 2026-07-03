import mongoose from "mongoose";
import { WeeklyExecutionSchedule, type WorkBlockOrigin, type IWorkBlock, type IDaySchedule, type IWeeklyExecutionSchedule } from "@/models/WeeklyExecutionSchedule";
import { timeToMinutes } from "@/services/ai-validation.service";

export interface AddWorkBlockInput {
  firebaseUid: string;
  date: string; // YYYY-MM-DD
  title: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  priority?: number;
  tasks?: mongoose.Types.ObjectId[];
}

export interface RemoveWorkBlockInput {
  firebaseUid: string;
  date: string; // YYYY-MM-DD
  blockId?: string; // MongoDB subdocument id (not currently available)
  startTime?: string; // fallback identifier
  endTime?: string; // fallback identifier
  title?: string; // fallback identifier
}

export interface MoveWorkBlockInput {
  firebaseUid: string;
  date: string; // YYYY-MM-DD
  title: string; // block to identify for moving
  newStartTime: string; // HH:mm
  newEndTime: string; // HH:mm
}

export interface ResizeWorkBlockInput {
  firebaseUid: string;
  date: string; // YYYY-MM-DD
  title: string; // block to identify for resizing
  newStartTime: string; // HH:mm
  newEndTime: string; // HH:mm
}

export interface ConflictCheck {
  hasConflict: boolean;
  conflicts: IWorkBlock[];
}

function computeDuration(startTime: string, endTime: string): number {
  return Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime));
}

function findDay(schedule: IWeeklyExecutionSchedule, date: string): IDaySchedule | undefined {
  return schedule.days.find((d) => d.date === date);
}

function findUserBlock(
  day: IDaySchedule | undefined,
  identifier: { startTime?: string; endTime?: string; title?: string }
): { day: IDaySchedule; index: number; block: IWorkBlock } | null {
  if (!day) return null;

  const index = day.workBlocks.findIndex((block) => {
    if (block.origin !== "user") return false;
    const matchesTitle = identifier.title && block.title === identifier.title;
    return !!matchesTitle;
  });

  if (index === -1) return null;
  return { day, index, block: day.workBlocks[index] };
}

export class SchedulePatchService {
  /**
   * Add a new work block to a specific day.
   * Only user can add - origin is set to "user".
   */
  static async addWorkBlock(input: AddWorkBlockInput): Promise<IWeeklyExecutionSchedule | null> {
    const schedule = await WeeklyExecutionSchedule.findOne({
      firebaseUid: input.firebaseUid,
      status: "ACTIVE",
    });

    if (!schedule) return null;

    const day = findDay(schedule, input.date);
    if (!day) return null;

    const newBlock: IWorkBlock = {
      title: input.title,
      startTime: input.startTime,
      endTime: input.endTime,
      duration: computeDuration(input.startTime, input.endTime),
      priority: input.priority ?? 0,
      tasks: input.tasks ?? [],
      origin: "user" as WorkBlockOrigin,
    };

    day.workBlocks.push(newBlock);
    day.workBlocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    await schedule.save();
    return schedule;
  }

  /**
   * Remove a work block.
   * ONLY removes blocks where origin === "user".
   * Never removes system or ai blocks.
   */
  static async removeWorkBlock(input: RemoveWorkBlockInput): Promise<IWeeklyExecutionSchedule | null> {
    const schedule = await WeeklyExecutionSchedule.findOne({
      firebaseUid: input.firebaseUid,
      status: "ACTIVE",
    });

    if (!schedule) return null;

    const day = findDay(schedule, input.date);
    if (!day) return null;

    const originalLength = day.workBlocks.length;
    day.workBlocks = day.workBlocks.filter(
      (block) => !(block.origin === "user" && SchedulePatchService.doesBlockMatch(block, input))
    );

    if (day.workBlocks.length === originalLength) return null;

    await schedule.save();
    return schedule;
  }

  private static doesBlockMatch(block: IWorkBlock, input: { startTime?: string; endTime?: string; title?: string }): boolean {
    if (!block.origin || block.origin !== "user") return false;
    const matchesTitle = input.title && block.title === input.title;
    const matchesTime = input.startTime && input.endTime && block.startTime === input.startTime && block.endTime === input.endTime;
    const matchesStart = input.startTime && block.startTime === input.startTime;
    return !!(matchesTitle || matchesTime || matchesStart);
  }

  /**
   * Move a work block to new times.
   * Only works on blocks where origin === "user".
   */
  static async moveWorkBlock(input: MoveWorkBlockInput): Promise<IWeeklyExecutionSchedule | null> {
    const schedule = await WeeklyExecutionSchedule.findOne({
      firebaseUid: input.firebaseUid,
      status: "ACTIVE",
    });

    if (!schedule) return null;

    const day = findDay(schedule, input.date);
    if (!day) return null;

    const found = findUserBlock(day, {
      title: input.title,
    });

    if (!found) return null;

    found.block.startTime = input.newStartTime;
    found.block.endTime = input.newEndTime;
    found.block.duration = computeDuration(input.newStartTime, input.newEndTime);

    day.workBlocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    await schedule.save();
    return schedule;
  }

  /**
   * Resize a work block (change startTime/endTime/duration).
   * Only works on blocks where origin === "user".
   */
  static async resizeWorkBlock(input: ResizeWorkBlockInput): Promise<IWeeklyExecutionSchedule | null> {
    const schedule = await WeeklyExecutionSchedule.findOne({
      firebaseUid: input.firebaseUid,
      status: "ACTIVE",
    });

    if (!schedule) return null;

    const day = findDay(schedule, input.date);
    if (!day) return null;

    const found = findUserBlock(day, {
      title: input.title,
    });

    if (!found) return null;

    found.block.startTime = input.newStartTime;
    found.block.endTime = input.newEndTime;
    found.block.duration = computeDuration(input.newStartTime, input.newEndTime);

    day.workBlocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    await schedule.save();
    return schedule;
  }

  /**
   * Check for overlapping blocks on a given day.
   * Does NOT resolve conflicts - just reports them.
   */
  static async checkConflicts(firebaseUid: string, date: string, startTime: string, endTime: string): Promise<ConflictCheck> {
    const schedule = await WeeklyExecutionSchedule.findOne({
      firebaseUid,
      status: "ACTIVE",
    });

    if (!schedule) return { hasConflict: false, conflicts: [] };

    const day = findDay(schedule, date);
    if (!day) return { hasConflict: false, conflicts: [] };

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    const conflicts = day.workBlocks.filter((block) => {
      const blockStart = timeToMinutes(block.startTime);
      const blockEnd = timeToMinutes(block.endTime);
      return startMinutes < blockEnd && endMinutes > blockStart;
    });

    return { hasConflict: conflicts.length > 0, conflicts };
  }
}