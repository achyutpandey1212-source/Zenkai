import { dbConnect } from "@/lib/mongodb";
import { Memory, IMemory, MemoryCategory, MemoryStatus } from "@/models/Memory";
import { Types } from "mongoose";

export type MemoryCreateInput = {
  firebaseUid: string;
  category: MemoryCategory;
  content: string;
  summary: string;
  importance?: number;
  importanceReason?: string;
  confidence?: number;
  reason: string;
  status?: MemoryStatus;
  conversationId?: string;
  messageId?: string;
  version?: number;
  keywords?: string[];
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
   * Get memories by category.
   */
  async findByCategory(uid: string, category: MemoryCategory): Promise<IMemory[]> {
    await dbConnect();
    return Memory.find({ firebaseUid: uid, category, status: "approved" })
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
   * Create a new memory.
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
    return Memory.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after" }).lean() as Promise<IMemory | null>;
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

  /**
   * Find approved memories matching a set of keywords.
   */
  async findRelevantByKeywords(uid: string, keywords: string[], limit = 50): Promise<IMemory[]> {
    await dbConnect();
    if (!keywords || keywords.length === 0) return [];
    return Memory.find({
      firebaseUid: uid,
      status: "approved",
      keywords: { $in: keywords }
    })
      .sort({ importance: -1, createdAt: -1 })
      .limit(limit)
      .lean() as Promise<IMemory[]>;
  },

  /**
   * Find approved memories of a specific category with a limit.
   */
  async findByCategoryWithLimit(uid: string, category: MemoryCategory, limit = 10): Promise<IMemory[]> {
    await dbConnect();
    return Memory.find({
      firebaseUid: uid,
      category,
      status: "approved"
    })
      .sort({ importance: -1, createdAt: -1 })
      .limit(limit)
      .lean() as Promise<IMemory[]>;
  },

  /**
   * Get all memories (including candidates) for a user, for the debug API.
   */
  async findAllByUserDebug(uid: string): Promise<IMemory[]> {
    await dbConnect();
    return Memory.find({ firebaseUid: uid })
      .sort({ createdAt: -1 })
      .lean() as Promise<IMemory[]>;
  },

  /**
   * Increment the retrieval count and update the lastRetrievedAt timestamp.
   */
  async incrementRetrievalCount(id: string): Promise<IMemory | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Memory.findByIdAndUpdate(
      id,
      {
        $inc: { retrievalCount: 1 },
        $set: { lastRetrievedAt: new Date() }
      },
      { returnDocument: "after" }
    ).lean() as Promise<IMemory | null>;
  },

  /**
   * Update the last accessed timestamp.
   */
  async updateLastRetrieved(id: string): Promise<IMemory | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return Memory.findByIdAndUpdate(
      id,
      { $set: { lastRetrievedAt: new Date() } },
      { returnDocument: "after" }
    ).lean() as Promise<IMemory | null>;
  },
};
