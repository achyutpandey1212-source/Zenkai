import mongoose, { Schema, Model, Document } from "mongoose";

export type PlanStatus = "active" | "completed" | "archived";

export interface IPlan extends Document {
  firebaseUid: string;
  title: string;
  description?: string;
  status: PlanStatus;
  priority: number;
  estimatedDuration?: string;
  progress: number; // 0 to 100
  type: string; // career, learning, exams, etc.
  diagnostics?: {
    planningPrompt: string;
    rawGeminiOutput: string;
    normalizedPlan: string;
    executionTimeMs: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>(
  {
    firebaseUid: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
    },
    priority: { type: Number, default: 1 },
    estimatedDuration: { type: String, default: "" },
    progress: { type: Number, default: 0 },
    type: { type: String, default: "personal" },
    diagnostics: {
      planningPrompt: { type: String },
      rawGeminiOutput: { type: String },
      normalizedPlan: { type: String },
      executionTimeMs: { type: Number },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "plans",
  }
);

export const Plan: Model<IPlan> =
  mongoose.models.Plan || mongoose.model<IPlan>("Plan", PlanSchema);
