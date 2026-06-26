import mongoose, { Schema, Model, Document } from "mongoose";

/**
 * Reflection — AI-generated insights about the user's behavior and growth.
 * Collection: reflections
 */

export type ReflectionType = "session" | "daily" | "weekly" | "monthly";

export interface IReflection extends Document {
  firebaseUid: string;          // FK → users.firebaseUid
  reflectionType: ReflectionType;
  content: string;              // full reflection text
  summary: string;              // compressed for display
  confidence: number;           // 0.0 – 1.0
  createdAt: Date;
  updatedAt: Date;
}

const ReflectionSchema = new Schema<IReflection>(
  {
    firebaseUid: { type: String, required: true, index: true },
    reflectionType: {
      type: String,
      enum: ["session", "daily", "weekly", "monthly"],
      required: true,
    },
    content: { type: String, required: true },
    summary: { type: String, required: true },
    confidence: { type: Number, default: 0.7, min: 0, max: 1 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "reflections",
  }
);

ReflectionSchema.index({ firebaseUid: 1, createdAt: -1 });

export const Reflection: Model<IReflection> =
  mongoose.models.Reflection ||
  mongoose.model<IReflection>("Reflection", ReflectionSchema);
