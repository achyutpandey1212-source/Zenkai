import mongoose, { Schema, Model, Document, Types } from "mongoose";

export type MilestoneStatus = "todo" | "in_progress" | "completed" | "cancelled";

export interface IMilestone extends Document {
  planId: Types.ObjectId;
  firebaseUid: string;
  title: string;
  description?: string;
  status: MilestoneStatus;
  priority: number;
  estimatedDuration?: string;
  progress: number; // 0 to 100
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  category?: string; // Exam, Study, Hackathon, Meetup, Content Creation, Startup, Coding, Reading, Fitness, Interview, Personal
  importance?: number; // 1-10
  flexibility?: number; // 1-10
  createdAt: Date;
  updatedAt: Date;
}

const MilestoneSchema = new Schema<IMilestone>(
  {
    planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true, index: true },
    firebaseUid: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["todo", "in_progress", "completed", "cancelled"],
      default: "todo",
    },
    priority: { type: Number, default: 1 },
    estimatedDuration: { type: String, default: "" },
    progress: { type: Number, default: 0 },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    category: { type: String, default: "Personal" },
    importance: { type: Number, default: 5 },
    flexibility: { type: Number, default: 5 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "milestones",
  }
);

export const Milestone: Model<IMilestone> =
  mongoose.models.Milestone || mongoose.model<IMilestone>("Milestone", MilestoneSchema);
