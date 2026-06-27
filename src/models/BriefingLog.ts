import mongoose, { Schema, Model, Document } from "mongoose";

export interface IBriefingLog extends Document {
  uid: string;
  email: string;
  type: "morning" | "evening";
  status: "success" | "failed";
  sentAt?: Date;
  scheduledTime: string; // e.g. "08:00" or "20:30"
  durationMs: number;
  tokensUsed: number;
  cost: number;
  failuresCount: number;
  lastError?: string;
  retryAttempts: number;
  skipped: boolean; // true if nothing changed and we sent a cached/deterministic brief without AI call
  createdAt: Date;
  updatedAt: Date;
}

const BriefingLogSchema = new Schema<IBriefingLog>(
  {
    uid: { type: String, required: true, index: true },
    email: { type: String, required: true },
    type: { type: String, enum: ["morning", "evening"], required: true, index: true },
    status: { type: String, enum: ["success", "failed"], required: true, index: true },
    sentAt: { type: Date },
    scheduledTime: { type: String, required: true },
    durationMs: { type: Number, default: 0 },
    tokensUsed: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    failuresCount: { type: Number, default: 0 },
    lastError: { type: String },
    retryAttempts: { type: Number, default: 0 },
    skipped: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "briefing_logs",
  }
);

export const BriefingLog: Model<IBriefingLog> =
  mongoose.models.BriefingLog || mongoose.model<IBriefingLog>("BriefingLog", BriefingLogSchema);
