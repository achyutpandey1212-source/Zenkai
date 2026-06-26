import mongoose, { Schema, Model, Document, Types } from "mongoose";

/**
 * Task — execution-layer items, optionally linked to a Goal.
 * Collection: tasks
 */

export type TaskStatus = "todo" | "in_progress" | "completed" | "missed";

export interface ITask extends Document {
  firebaseUid: string;         // FK → users.firebaseUid
  goalId?: Types.ObjectId;     // optional FK → goals._id
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number;            // 1 = highest
  estimatedMinutes?: number;
  scheduledFor?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    firebaseUid: { type: String, required: true, index: true },
    goalId: { type: Schema.Types.ObjectId, ref: "Goal" },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["todo", "in_progress", "completed", "missed"],
      default: "todo",
    },
    priority: { type: Number, default: 1 },
    estimatedMinutes: { type: Number },
    scheduledFor: { type: Date },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "tasks",
  }
);

export const Task: Model<ITask> =
  mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema);
