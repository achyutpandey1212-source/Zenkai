import mongoose, { Schema, Model, Document } from "mongoose";

/**
 * Reflection — AI-generated insights about the user's behavior and growth.
 * Collection: reflections
 */

export type ReflectionType = "session" | "daily" | "weekly" | "monthly";
export type ReflectionStatus = "active" | "deprecated";

export interface IReflectionVersion {
  version: number;
  title: string;
  content: string;
  summary: string;
  confidence: number;
  stability: number;
  evidenceCount: number;
  supportingMemoryIds: string[];
  supportingIdentityTraitIds: string[];
  evolutionReason: string;
  llmReasoning: string;
  updatedAt: Date;
}

export interface IReflection extends Document {
  firebaseUid: string;          // FK → users.firebaseUid (userId)
  reflectionType: ReflectionType;
  title: string;
  content: string;              // full reflection text
  summary: string;              // compressed for display
  category: string;             // e.g. "Learning Style", "Productivity", etc.
  confidence: number;           // 0.0 – 1.0
  importance: number;           // 0.0 - 10.0
  supportingMemoryIds: string[]; // references to Memory
  supportingIdentityTraitIds: string[]; // references to IdentityTrait
  lastValidatedAt: Date;
  status: ReflectionStatus;
  version: number;
  evidenceCount: number;
  stability: number;
  llmReasoning: string;
  evolutionReason: string;
  confidenceHistory: {
    confidence: number;
    timestamp: Date;
    reason?: string;
  }[];
  versions: IReflectionVersion[]; // Timeline history
  createdAt: Date;
  updatedAt: Date;
}

const ReflectionVersionSchema = new Schema<IReflectionVersion>({
  version: { type: Number, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  summary: { type: String, required: true },
  confidence: { type: Number, required: true },
  stability: { type: Number, required: true },
  evidenceCount: { type: Number, required: true },
  supportingMemoryIds: { type: [String], default: [] },
  supportingIdentityTraitIds: { type: [String], default: [] },
  evolutionReason: { type: String, default: "" },
  llmReasoning: { type: String, default: "" },
  updatedAt: { type: Date, required: true },
});

const ReflectionSchema = new Schema<IReflection>(
  {
    firebaseUid: { type: String, required: true, index: true },
    reflectionType: {
      type: String,
      enum: ["session", "daily", "weekly", "monthly"],
      required: true,
    },
    title: { type: String, default: "Insight" },
    content: { type: String, required: true },
    summary: { type: String, required: true },
    category: { type: String, default: "General" },
    confidence: { type: Number, default: 0.4, min: 0, max: 1 },
    importance: { type: Number, default: 5.0, min: 0, max: 10 },
    supportingMemoryIds: { type: [String], default: [] },
    supportingIdentityTraitIds: { type: [String], default: [] },
    lastValidatedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["active", "deprecated"],
      default: "active",
    },
    version: { type: Number, default: 1 },
    evidenceCount: { type: Number, default: 1 },
    stability: { type: Number, default: 0.1, min: 0, max: 1 },
    llmReasoning: { type: String, default: "" },
    evolutionReason: { type: String, default: "" },
    confidenceHistory: {
      type: [
        {
          confidence: { type: Number, required: true },
          timestamp: { type: Date, default: Date.now },
          reason: { type: String },
        },
      ],
      default: [],
    },
    versions: { type: [ReflectionVersionSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "reflections",
  }
);

ReflectionSchema.index({ firebaseUid: 1, status: 1 });
ReflectionSchema.index({ firebaseUid: 1, reflectionType: 1 });
ReflectionSchema.index({ firebaseUid: 1, createdAt: -1 });

export const Reflection: Model<IReflection> =
  mongoose.models.Reflection ||
  mongoose.model<IReflection>("Reflection", ReflectionSchema);
