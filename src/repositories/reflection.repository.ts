import { dbConnect } from "@/lib/mongodb";
import { Reflection, IReflection, ReflectionType, ReflectionStatus, IReflectionVersion } from "@/models/Reflection";
import { Types } from "mongoose";

export type ReflectionCreateInput = {
  firebaseUid: string;
  reflectionType: ReflectionType;
  title?: string;
  content: string;
  summary: string;
  category?: string;
  confidence?: number;
  importance?: number;
  supportingMemoryIds?: string[];
  supportingIdentityTraitIds?: string[];
  lastValidatedAt?: Date;
  status?: ReflectionStatus;
  version?: number;
  evidenceCount?: number;
  stability?: number;
  llmReasoning?: string;
  evolutionReason?: string;
  confidenceHistory?: { confidence: number; timestamp: Date; reason?: string }[];
  versions?: IReflectionVersion[];
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
   * Get active reflections for a user.
   */
  async findActiveByUser(uid: string): Promise<IReflection[]> {
    await dbConnect();
    return Reflection.find({ firebaseUid: uid, status: "active" })
      .sort({ createdAt: -1 })
      .lean() as Promise<IReflection[]>;
  },

  /**
   * Find a reflection by name and category for a user.
   */
  async findByNameAndCategory(
    uid: string,
    title: string,
    category: string
  ): Promise<IReflection | null> {
    await dbConnect();
    return Reflection.findOne({ firebaseUid: uid, title, category })
      .lean() as Promise<IReflection | null>;
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
    return Reflection.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after" }).lean() as Promise<IReflection | null>;
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
