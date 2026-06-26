import { dbConnect } from "@/lib/mongodb";
import { Goal, IGoal, GoalStatus } from "@/models/Goal";
import { Types } from "mongoose";

export type GoalCreateInput = {
  firebaseUid: string;
  title: string;
  description?: string;
  status?: GoalStatus;
  priority?: number;
  targetDate?: Date;
};

export type GoalUpdateInput = Partial<Omit<GoalCreateInput, "firebaseUid">>;

/**
 * GoalRepository — CRUD operations for the goals collection.
 */
export const GoalRepository = {
  /**
   * Get all goals for a user.
   */
  async findAllByUser(uid: string): Promise<IGoal[]> {
    await dbConnect();
    return Goal.find({ firebaseUid: uid })
      .sort({ priority: 1, createdAt: -1 })
      .lean() as Promise<IGoal[]>;
  },

  /**
   * Get active goals only.
   */
  async findActiveByUser(uid: string): Promise<IGoal[]> {
    await dbConnect();
    return Goal.find({ firebaseUid: uid, status: "active" })
      .sort({ priority: 1 })
      .lean() as Promise<IGoal[]>;
  },

  /**
   * Find a single goal by its _id.
   */
  async findById(id: string): Promise<IGoal | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Goal.findById(id).lean() as Promise<IGoal | null>;
  },

  /**
   * Create a new goal.
   */
  async create(data: GoalCreateInput): Promise<IGoal> {
    await dbConnect();
    const goal = await Goal.create(data);
    return goal.toObject() as IGoal;
  },

  /**
   * Update a goal by _id.
   */
  async update(id: string, data: GoalUpdateInput): Promise<IGoal | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Goal.findByIdAndUpdate(id, { $set: data }, { new: true }).lean() as Promise<IGoal | null>;
  },

  /**
   * Update goal status.
   */
  async updateStatus(id: string, status: GoalStatus): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await Goal.findByIdAndUpdate(id, { $set: { status } });
  },

  /**
   * Delete a goal by _id.
   */
  async delete(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await Goal.findByIdAndDelete(id);
  },

  /**
   * Delete all goals for a user.
   */
  async deleteAllByUser(uid: string): Promise<void> {
    await dbConnect();
    await Goal.deleteMany({ firebaseUid: uid });
  },
};
