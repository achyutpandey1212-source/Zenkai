import mongoose, { Schema, Model, Document } from "mongoose";

export interface IRiskMetric {
  score: number;
  confidence: number;
  evidence: string[];
}

export interface IRollingRisk {
  timestamp: Date;
  overallRisk: number;
  burnoutRisk: number;
  goalDriftRisk: number;
  deadlineRisk: number;
}

export interface IRiskProfile extends Document {
  uid: string; // FK → users.firebaseUid
  lastUpdated: Date;
  overallRisk: number;
  
  burnoutRisk: IRiskMetric;
  goalDriftRisk: IRiskMetric;
  deadlineRisk: IRiskMetric;
  consistencyRisk: IRiskMetric;
  scheduleRisk: IRiskMetric;
  executionRisk: IRiskMetric;
  calendarRisk: IRiskMetric;
  abandonmentRisk: IRiskMetric;
  
  confidence: number;
  activeWarnings: string[];
  rollingRisk: IRollingRisk[];
}

const RiskMetricSchema = new Schema<IRiskMetric>({
  score: { type: Number, required: true, default: 0 },
  confidence: { type: Number, required: true, default: 100 },
  evidence: { type: [String], default: [] }
}, { _id: false });

const RollingRiskSchema = new Schema<IRollingRisk>({
  timestamp: { type: Date, required: true },
  overallRisk: { type: Number, required: true },
  burnoutRisk: { type: Number, required: true },
  goalDriftRisk: { type: Number, required: true },
  deadlineRisk: { type: Number, required: true }
}, { _id: false });

const RiskProfileSchema = new Schema<IRiskProfile>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    lastUpdated: { type: Date, default: Date.now },
    overallRisk: { type: Number, default: 0 },
    
    burnoutRisk: { type: RiskMetricSchema, required: true },
    goalDriftRisk: { type: RiskMetricSchema, required: true },
    deadlineRisk: { type: RiskMetricSchema, required: true },
    consistencyRisk: { type: RiskMetricSchema, required: true },
    scheduleRisk: { type: RiskMetricSchema, required: true },
    executionRisk: { type: RiskMetricSchema, required: true },
    calendarRisk: { type: RiskMetricSchema, required: true },
    abandonmentRisk: { type: RiskMetricSchema, required: true },
    
    confidence: { type: Number, default: 100 },
    activeWarnings: { type: [String], default: [] },
    rollingRisk: [RollingRiskSchema]
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "riskProfiles"
  }
);

export const RiskProfile: Model<IRiskProfile> =
  mongoose.models.RiskProfile ||
  mongoose.model<IRiskProfile>("RiskProfile", RiskProfileSchema);
