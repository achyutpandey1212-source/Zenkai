import mongoose, { Schema, Model, Document } from "mongoose";

/**
 * Memory — the long-term knowledge store.
 * Core memory system. Memories are curated facts, NOT raw messages.
 * Collection: memories
 */

export type MemoryStatus = "candidate" | "proposal" | "approved" | "archived";

export type MemoryCategory =
  | "Goal"
  | "Preference"
  | "Habit"
  | "Constraint"
  | "Identity"
  | "Project"
  | "Achievement"
  | "Relationship"
  | "Behavior"
  | "Motivation"
  | "Knowledge";

export interface IMemory extends Document {
  firebaseUid: string;       // Owner (FK → users.firebaseUid)
  category: MemoryCategory;  // Category
  content: string;           // Content
  summary: string;           // Compressed summary for prompt context
  importance: number;        // Importance Score (0.0 - 10.0)
  importanceReason?: string; // Reason for importance score
  confidence: number;        // Confidence (0.0 - 1.0)
  reason: string;            // Admission decision reason
  lastRetrievedAt?: Date;    // Last Retrieved
  retrievalCount: number;    // Retrieval Count
  conversationId?: string;   // Conversation ID
  messageId?: string;        // Message ID
  status: MemoryStatus;      // Status
  version: number;           // Version
  keywords: string[];        // Keywords for local matching
  createdAt: Date;
  updatedAt: Date;
}

const MemorySchema = new Schema<IMemory>(
  {
    firebaseUid: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: [
        "Goal",
        "Preference",
        "Habit",
        "Constraint",
        "Identity",
        "Project",
        "Achievement",
        "Relationship",
        "Behavior",
        "Motivation",
        "Knowledge",
      ],
      required: true,
    },
    content: { type: String, required: true },
    summary: { type: String, required: true },
    importance: { type: Number, default: 5.0, min: 0, max: 10 },
    importanceReason: { type: String },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    reason: { type: String, required: true },
    lastRetrievedAt: { type: Date },
    retrievalCount: { type: Number, default: 0 },
    conversationId: { type: String },
    messageId: { type: String },
    status: {
      type: String,
      enum: ["candidate", "proposal", "approved", "archived"],
      default: "candidate",
    },
    version: { type: Number, default: 1 },
    keywords: { type: [String], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "memories",
  }
);

// Compound indexes for efficient per-user memory retrieval
MemorySchema.index({ firebaseUid: 1, status: 1, importance: -1 });
MemorySchema.index({ firebaseUid: 1, category: 1, status: 1 });
MemorySchema.index({ firebaseUid: 1, keywords: 1 });

export const Memory: Model<IMemory> =
  mongoose.models.Memory || mongoose.model<IMemory>("Memory", MemorySchema);
