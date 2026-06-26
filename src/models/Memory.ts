import mongoose, { Schema, Model, Document } from "mongoose";

/**
 * Memory — the long-term knowledge store.
 * Core memory system. Memories are curated facts, NOT raw messages.
 * Collection: memories
 */

export type MemoryStatus = "candidate" | "proposal" | "approved" | "archived";

export type MemoryType =
  | "identity"
  | "aspiration"
  | "principle"
  | "behavior"
  | "constraint"
  | "pattern"
  | "goal"
  | "reflection";

export interface IMemory extends Document {
  firebaseUid: string;     // FK → users.firebaseUid
  memoryType: MemoryType;
  content: string;         // full memory text
  summary: string;         // compressed version for prompt usage
  confidence: number;      // 0.0 – 1.0
  importance: number;      // 0.0 – 1.0
  status: MemoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const MemorySchema = new Schema<IMemory>(
  {
    firebaseUid: { type: String, required: true, index: true },
    memoryType: {
      type: String,
      enum: [
        "identity",
        "aspiration",
        "principle",
        "behavior",
        "constraint",
        "pattern",
        "goal",
        "reflection",
      ],
      required: true,
    },
    content: { type: String, required: true },
    summary: { type: String, required: true },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    importance: { type: Number, default: 0.5, min: 0, max: 1 },
    status: {
      type: String,
      enum: ["candidate", "proposal", "approved", "archived"],
      default: "candidate",
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "memories",
  }
);

// Compound index for efficient per-user memory retrieval
MemorySchema.index({ firebaseUid: 1, status: 1, importance: -1 });

export const Memory: Model<IMemory> =
  mongoose.models.Memory || mongoose.model<IMemory>("Memory", MemorySchema);
