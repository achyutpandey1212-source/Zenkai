import { dbConnect } from "@/lib/mongodb";
import { Reflection, IReflection, ReflectionType } from "@/models/Reflection";
import { Types } from "mongoose";

export type ReflectionCreateInput = {
  firebaseUid: string;
  reflectionType: ReflectionType;
  content: string;
  summary: string;
  confidence?: number;
};

export type ReflectionUpdateInput = Partial<
  Omit<ReflectionCreateInput, "firebaseUid">
>;

/**
 * ReflectionRepository — CRUD for reflection outputs.
 */
export const ReflectionRepository = {
  /**
   * Get all reflections for a user (most recent first).
   */
  async findAllByUser(uid: string): Promise<IReflection[]> {
    await dbConnect();
    return Reflection.find({ firebaseUid: uid })
      .sort({ createdAt: -1 })
      .lean() as Promise<IReflection[]>;
  },

  /**
   * Get reflections by type.
   */
  async findByType(uid: string, type: ReflectionType): Promise<IReflection[]> {
    await dbConnect();
    return Reflection.find({ firebaseUid: uid, reflectionType: type })
      .sort({ createdAt: -1 })
      .lean() as Promise<IReflection[]>;
  },

  /**
   * Get the most recent reflection of any type.
   */
  async findLatestByUser(uid: string): Promise<IReflection | null> {
    await dbConnect();
    return Reflection.findOne({ firebaseUid: uid })
      .sort({ createdAt: -1 })
      .lean() as Promise<IReflection | null>;
  },

  /**
   * Find a reflection by _id.
   */
  async findById(id: string): Promise<IReflection | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Reflection.findById(id).lean() as Promise<IReflection | null>;
  },

  /**
   * Create a new reflection.
   */
  async create(data: ReflectionCreateInput): Promise<IReflection> {
    await dbConnect();
    const reflection = await Reflection.create(data);
    return reflection.toObject() as IReflection;
  },

  /**
   * Update a reflection.
   */
  async update(
    id: string,
    data: ReflectionUpdateInput
  ): Promise<IReflection | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Reflection.findByIdAndUpdate(id, { $set: data }, { new: true }).lean() as Promise<IReflection | null>;
  },

  /**
   * Delete a reflection by _id.
   */
  async delete(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await Reflection.findByIdAndDelete(id);
  },

  /**
   * Delete all reflections for a user.
   */
  async deleteAllByUser(uid: string): Promise<void> {
    await dbConnect();
    await Reflection.deleteMany({ firebaseUid: uid });
  },
};
