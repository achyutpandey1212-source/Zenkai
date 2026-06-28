import mongoose, { Schema, Model, Document } from "mongoose";

export interface IRiskEvent extends Document {
  uid: string; // FK → users.firebaseUid
  timestamp: Date;
  riskType: string; // e.g. "burnout", "goal_drift", "deadline", "consistency", "execution", "schedule", "calendar", "abandonment"
  oldScore: number;
  newScore: number;
  severity: "Low" | "Moderate" | "High" | "Critical";
  reason: string;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

const RiskEventSchema = new Schema<IRiskEvent>(
  {
    uid: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    riskType: { type: String, required: true },
    oldScore: { type: Number, required: true },
    newScore: { type: Number, required: true },
    severity: { type: String, enum: ["Low", "Moderate", "High", "Critical"], required: true },
    reason: { type: String, required: true },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "riskEvents"
  }
);

export const RiskEvent: Model<IRiskEvent> =
  mongoose.models.RiskEvent ||
  mongoose.model<IRiskEvent>("RiskEvent", RiskEventSchema);
