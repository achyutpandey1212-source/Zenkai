import mongoose, { Schema, Model, Document } from "mongoose";

export interface ICalendarSyncLog extends Document {
  uid: string;
  startedAt: Date;
  finishedAt: Date;
  duration: number; // ms
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  eventsSkipped: number;
  googleRequests: number;
  status: "success" | "failure";
  error?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CalendarSyncLogSchema = new Schema<ICalendarSyncLog>(
  {
    uid: { type: String, required: true, index: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
    duration: { type: Number, default: 0 },
    eventsCreated: { type: Number, default: 0 },
    eventsUpdated: { type: Number, default: 0 },
    eventsDeleted: { type: Number, default: 0 },
    eventsSkipped: { type: Number, default: 0 },
    googleRequests: { type: Number, default: 0 },
    status: { type: String, enum: ["success", "failure"], required: true, index: true },
    error: { type: String },
    retryCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "calendar_sync_logs",
  }
);

export const CalendarSyncLog: Model<ICalendarSyncLog> =
  mongoose.models.CalendarSyncLog || mongoose.model<ICalendarSyncLog>("CalendarSyncLog", CalendarSyncLogSchema);
