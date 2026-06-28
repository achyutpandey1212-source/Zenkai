import mongoose, { Schema, Model, Document, Types } from "mongoose";

/**
 * Task — execution-layer items, optionally linked to a Goal.
 * Collection: tasks
 */

export type TaskStatus = "todo" | "in_progress" | "completed" | "skipped" | "deferred" | "blocked" | "missed";

export interface ITask extends Document {
  firebaseUid: string;         // FK → users.firebaseUid
  goalId?: Types.ObjectId;     // optional FK → goals._id
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number;            // 1 = highest
  estimatedMinutes?: number;
  estimatedDuration?: string;  // planning estimated duration string
  dependencies?: string[];     // list of task titles or IDs this task depends on
  scheduledFor?: Date;
  completedAt?: Date;
  suggestedDate?: string;      // YYYY-MM-DD suggested execution date
  timeBlock?: string;          // optional time slot, e.g. "09:00 AM - 10:30 AM"
  deferredCount?: number;      // number of times task has been postponed
  lastExecutedAt?: Date;       // timestamp of execution action
  executionOrder?: number;     // manual order in daily agenda
  googleCalendarEventId?: string;     // Google Calendar event ID
  googleCalendarEventHash?: string;   // hash of event details to detect changes
  googleCalendarConflict?: boolean;   // flag indicating a manual conflict
  googleCalendarConflictDetails?: any; // details of the Google event under conflict
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
      enum: ["todo", "in_progress", "completed", "skipped", "deferred", "blocked", "missed"],
      default: "todo",
    },
    priority: { type: Number, default: 1 },
    estimatedMinutes: { type: Number },
    estimatedDuration: { type: String, default: "" },
    dependencies: [{ type: String }],
    scheduledFor: { type: Date },
    completedAt: { type: Date },
    suggestedDate: { type: String, default: "" },
    timeBlock: { type: String, default: "" },
    deferredCount: { type: Number, default: 0 },
    lastExecutedAt: { type: Date },
    executionOrder: { type: Number },
    googleCalendarEventId: { type: String, default: "" },
    googleCalendarEventHash: { type: String, default: "" },
    googleCalendarConflict: { type: Boolean, default: false },
    googleCalendarConflictDetails: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "tasks",
  }
);

export const Task: Model<ITask> =
  mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema);
