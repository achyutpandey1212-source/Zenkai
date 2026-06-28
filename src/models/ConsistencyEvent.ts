import mongoose, { Schema, Model, Document } from "mongoose";

export interface IConsistencyEvent extends Document {
  uid: string; // FK → users.firebaseUid
  timestamp: Date;
  type: string; // e.g. "identity_alignment_improved", "planning_reliability_dropped", "routine_established", "longest_streak", "goal_drift_detected"
  scoreBefore: number;
  scoreAfter: number;
  reason: string;
  evidence: string[];
}

const ConsistencyEventSchema = new Schema<IConsistencyEvent>(
  {
    uid: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    type: { type: String, required: true },
    scoreBefore: { type: Number, required: true },
    scoreAfter: { type: Number, required: true },
    reason: { type: String, required: true },
    evidence: { type: [String], default: [] }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "consistencyEvents"
  }
);

export const ConsistencyEvent: Model<IConsistencyEvent> =
  mongoose.models.ConsistencyEvent ||
  mongoose.model<IConsistencyEvent>("ConsistencyEvent", ConsistencyEventSchema);
