import { dbConnect } from "@/lib/mongodb";
import { Task, ITask, TaskStatus } from "@/models/Task";
import { Types } from "mongoose";

export type TaskCreateInput = {
  firebaseUid: string;
  goalId?: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: number;
  estimatedMinutes?: number;
  scheduledFor?: Date;
};

export type TaskUpdateInput = Partial<Omit<TaskCreateInput, "firebaseUid">>;

/**
 * TaskRepository — CRUD operations for the tasks collection.
 */
export const TaskRepository = {
  /**
   * Get all tasks for a user.
   */
  async findAllByUser(uid: string): Promise<ITask[]> {
    await dbConnect();
    return Task.find({ firebaseUid: uid })
      .sort({ priority: 1, scheduledFor: 1 })
      .lean() as Promise<ITask[]>;
  },

  /**
   * Get today's tasks for a user.
   */
  async findTodayByUser(uid: string): Promise<ITask[]> {
    await dbConnect();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return Task.find({
      firebaseUid: uid,
      scheduledFor: { $gte: startOfDay, $lte: endOfDay },
    })
      .sort({ priority: 1 })
      .lean() as Promise<ITask[]>;
  },

  /**
   * Get tasks by status.
   */
  async findByStatus(uid: string, status: TaskStatus): Promise<ITask[]> {
    await dbConnect();
    return Task.find({ firebaseUid: uid, status })
      .sort({ priority: 1 })
      .lean() as Promise<ITask[]>;
  },

  /**
   * Get tasks linked to a goal.
   */
  async findByGoal(goalId: string): Promise<ITask[]> {
    await dbConnect();
    if (!Types.ObjectId.isValid(goalId)) return [];
    return Task.find({ goalId }).lean() as Promise<ITask[]>;
  },

  /**
   * Find a task by its _id.
   */
  async findById(id: string): Promise<ITask | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Task.findById(id).lean() as Promise<ITask | null>;
  },

  /**
   * Create a new task.
   */
  async create(data: TaskCreateInput): Promise<ITask> {
    await dbConnect();
    const task = await Task.create({
      ...data,
      goalId: data.goalId && Types.ObjectId.isValid(data.goalId)
        ? new Types.ObjectId(data.goalId)
        : undefined,
    });
    return task.toObject() as ITask;
  },

  /**
   * Update a task by _id.
   */
  async update(id: string, data: TaskUpdateInput): Promise<ITask | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Task.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after" }).lean() as Promise<ITask | null>;
  },

  /**
   * Mark a task as completed.
   */
  async markComplete(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await Task.findByIdAndUpdate(id, {
      $set: { status: "completed", completedAt: new Date() },
    });
  },

  /**
   * Delete a task by _id.
   */
  async delete(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await Task.findByIdAndDelete(id);
  },

  /**
   * Delete all tasks for a user.
   */
  async deleteAllByUser(uid: string): Promise<void> {
    await dbConnect();
    await Task.deleteMany({ firebaseUid: uid });
  },
};
