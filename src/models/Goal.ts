import mongoose, { Schema, Model, Document, Types } from "mongoose";

/**
 * Goal — medium-term goals created by or for the user.
 * Collection: goals
 */

export type GoalStatus = "active" | "completed" | "paused" | "cancelled";

export interface IGoal extends Document {
  firebaseUid: string;        // FK → users.firebaseUid
  planId?: Types.ObjectId;    // optional FK → plans._id
  milestoneId?: Types.ObjectId; // optional FK → milestones._id
  title: string;
  description?: string;
  status: GoalStatus;
  priority: number;           // 1 = highest
  estimatedDuration?: string;
  progress?: number;          // progress percentage (0 - 100)
  targetDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GoalSchema = new Schema<IGoal>(
  {
    firebaseUid: { type: String, required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: "Plan" },
    milestoneId: { type: Schema.Types.ObjectId, ref: "Milestone" },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["active", "completed", "paused", "cancelled"],
      default: "active",
    },
    priority: { type: Number, default: 1 },
    estimatedDuration: { type: String, default: "" },
    progress: { type: Number, default: 0 },
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
