import mongoose, { Schema, Model, Document } from "mongoose";

export interface IWorkBlock {
  title: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  milestoneId?: mongoose.Types.ObjectId;
  tasks: mongoose.Types.ObjectId[];
  duration: number; // minutes
  priority: number;
  eventHash?: string; // used for differential calendar sync
  googleCalendarEventId?: string; // stored for block-level sync
}

export interface IDaySchedule {
  date: string; // YYYY-MM-DD
  dayNumber: number; // 0 to 6
  focusTheme: string;
  estimatedWorkload: string;
  plannedFocusHours: number;
  workBlocks: IWorkBlock[];
}

export interface IWeeklyExecutionSchedule extends Document {
  firebaseUid: string;
  planId: mongoose.Types.ObjectId;
  version: number;
  generatedAt: Date;
  validFrom: string; // YYYY-MM-DD
  validTo: string; // YYYY-MM-DD
  status: "ACTIVE" | "ARCHIVED";
  days: IDaySchedule[];
}

const WorkBlockSchema = new Schema<IWorkBlock>(
  {
    title: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    milestoneId: { type: Schema.Types.ObjectId, ref: "Milestone" },
    tasks: [{ type: Schema.Types.ObjectId, ref: "Task" }],
    duration: { type: Number, required: true },
    priority: { type: Number, default: 0 },
    eventHash: { type: String },
    googleCalendarEventId: { type: String },
  },
  { _id: false }
);

const DayScheduleSchema = new Schema<IDaySchedule>(
  {
    date: { type: String, required: true },
    dayNumber: { type: Number, required: true },
    focusTheme: { type: String, required: true },
    estimatedWorkload: { type: String, required: true },
    plannedFocusHours: { type: Number, required: true },
    workBlocks: [WorkBlockSchema],
  },
  { _id: false }
);

const WeeklyExecutionScheduleSchema = new Schema<IWeeklyExecutionSchedule>(
  {
    firebaseUid: { type: String, required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    version: { type: Number, required: true, default: 1 },
    generatedAt: { type: Date, required: true, default: Date.now },
    validFrom: { type: String, required: true },
    validTo: { type: String, required: true },
    status: { type: String, enum: ["ACTIVE", "ARCHIVED"], default: "ACTIVE", index: true },
    days: [DayScheduleSchema],
  },
  { timestamps: true }
);

// Compound index for quick active schedule resolution
WeeklyExecutionScheduleSchema.index({ firebaseUid: 1, status: 1 });

export const WeeklyExecutionSchedule: Model<IWeeklyExecutionSchedule> =
  mongoose.models.WeeklyExecutionSchedule ||
  mongoose.model<IWeeklyExecutionSchedule>("WeeklyExecutionSchedule", WeeklyExecutionScheduleSchema);
