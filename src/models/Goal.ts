import mongoose, { Schema, Model, Document } from "mongoose";

/**
 * Goal — medium-term goals created by or for the user.
 * Collection: goals
 */

export type GoalStatus = "active" | "completed" | "paused" | "cancelled";

export interface IGoal extends Document {
  firebaseUid: string;        // FK → users.firebaseUid
  title: string;
  description?: string;
  status: GoalStatus;
  priority: number;           // 1 = highest
  targetDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GoalSchema = new Schema<IGoal>(
  {
    firebaseUid: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["active", "completed", "paused", "cancelled"],
      default: "active",
    },
    priority: { type: Number, default: 1 },
    targetDate: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "goals",
  }
);

export const Goal: Model<IGoal> =
  mongoose.models.Goal || mongoose.model<IGoal>("Goal", GoalSchema);
