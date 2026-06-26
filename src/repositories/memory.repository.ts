import { dbConnect } from "@/lib/mongodb";
import { Memory, IMemory, MemoryType, MemoryStatus } from "@/models/Memory";
import { Types } from "mongoose";

export type MemoryCreateInput = {
  firebaseUid: string;
  memoryType: MemoryType;
  content: string;
  summary: string;
  confidence?: number;
  importance?: number;
  status?: MemoryStatus;
};

export type MemoryUpdateInput = Partial<Omit<MemoryCreateInput, "firebaseUid">>;

/**
 * MemoryRepository — CRUD for the long-term memory store.
 */
export const MemoryRepository = {
  /**
   * Get all approved memories for a user, ranked by importance.
   */
  async findApprovedByUser(uid: string): Promise<IMemory[]> {
    await dbConnect();
    return Memory.find({ firebaseUid: uid, status: "approved" })
      .sort({ importance: -1, createdAt: -1 })
      .lean() as Promise<IMemory[]>;
  },

  /**
   * Get memories by type.
   */
  async findByType(uid: string, memoryType: MemoryType): Promise<IMemory[]> {
    await dbConnect();
    return Memory.find({ firebaseUid: uid, memoryType, status: "approved" })
      .sort({ importance: -1 })
      .lean() as Promise<IMemory[]>;
  },

  /**
   * Get top N most important approved memories (for prompt context).
   */
  async findTopByUser(uid: string, limit = 10): Promise<IMemory[]> {
    await dbConnect();
    return Memory.find({ firebaseUid: uid, status: "approved" })
      .sort({ importance: -1 })
      .limit(limit)
      .lean() as Promise<IMemory[]>;
  },

  /**
   * Find a memory by _id.
   */
  async findById(id: string): Promise<IMemory | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Memory.findById(id).lean() as Promise<IMemory | null>;
  },

  /**
   * Create a new memory candidate.
   */
  async create(data: MemoryCreateInput): Promise<IMemory> {
    await dbConnect();
    const memory = await Memory.create(data);
    return memory.toObject() as IMemory;
  },

  /**
   * Update a memory.
   */
  async update(id: string, data: MemoryUpdateInput): Promise<IMemory | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Memory.findByIdAndUpdate(id, { $set: data }, { new: true }).lean() as Promise<IMemory | null>;
  },

  /**
   * Approve a memory candidate.
   */
  async approve(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await Memory.findByIdAndUpdate(id, { $set: { status: "approved" } });
  },

  /**
   * Archive (soft-delete) a memory.
   */
  async archive(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await Memory.findByIdAndUpdate(id, { $set: { status: "archived" } });
  },

  /**
   * Hard delete a memory.
   */
  async delete(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await Memory.findByIdAndDelete(id);
  },

  /**
   * Delete all memories for a user.
   */
  async deleteAllByUser(uid: string): Promise<void> {
    await dbConnect();
    await Memory.deleteMany({ firebaseUid: uid });
  },
};
