import mongoose, { Schema, Model, Document } from "mongoose";

export interface IAdaptationValue<T = any> {
  value: T;
  confidence: number;
  lastUpdated: Date;
  derivedFrom: string[];
}

export interface IAdaptivePolicyHistory {
  timestamp: Date;
  adaptationKey: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

export interface IAdaptivePolicy extends Document {
  uid: string; // FK → users.firebaseUid
  updatedAt: Date;
  confidence: number;
  
  adaptations: {
    preferredWorkWindow: IAdaptationValue<"morning" | "afternoon" | "evening" | "night">;
    preferredTaskDuration: IAdaptationValue<number>;
    preferredBreakDuration: IAdaptationValue<number>;
    preferredAgendaDensity: IAdaptationValue<"light" | "balanced" | "dense">;
    planningAggressiveness: IAdaptationValue<"conservative" | "balanced" | "aggressive">;
    roadmapGranularity: IAdaptationValue<"coarse" | "balanced" | "fine">;
    executionStyle: IAdaptationValue<"pomodoro" | "flow" | "batch">;
    calendarBufferMinutes: IAdaptationValue<number>;
    preferredReflectionLength: IAdaptationValue<"short" | "medium" | "long">;
    preferredBriefStyle: IAdaptationValue<"short" | "medium" | "long">;
    preferredCompanionTone: IAdaptationValue<"formal" | "friendly" | "direct" | "motivational" | "minimal">;
    motivationStyle: IAdaptationValue<"achievement" | "consistency" | "curiosity" | "challenge" | "recovery">;
    notificationVerbosity: IAdaptationValue<"minimal" | "normal" | "high">;
    scheduleFlexibility: IAdaptationValue<"rigid" | "flexible" | "very_flexible">;
    preferredFocusSessionLength: IAdaptationValue<number>;
    preferredRecoveryTime: IAdaptationValue<number>;
    preferredPlanningDepth: IAdaptationValue<"shallow" | "balanced" | "deep">;
    preferredDeadlineBuffer: IAdaptationValue<number>;
  };
  
  history: IAdaptivePolicyHistory[];
  reasoning: Record<string, string>; // Maps adaptation key to explaining reasons
}

const AdaptationValueSchema = new Schema({
  value: { type: Schema.Types.Mixed, required: true },
  confidence: { type: Number, required: true, default: 1.0 },
  lastUpdated: { type: Date, default: Date.now },
  derivedFrom: { type: [String], default: [] }
}, { _id: false });

const HistoryEntrySchema = new Schema({
  timestamp: { type: Date, required: true },
  adaptationKey: { type: String, required: true },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  reason: { type: String, required: true }
}, { _id: false });

const AdaptivePolicySchema = new Schema<IAdaptivePolicy>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    updatedAt: { type: Date, default: Date.now },
    confidence: { type: Number, default: 1.0 },
    adaptations: {
      preferredWorkWindow: { type: AdaptationValueSchema, required: true },
      preferredTaskDuration: { type: AdaptationValueSchema, required: true },
      preferredBreakDuration: { type: AdaptationValueSchema, required: true },
      preferredAgendaDensity: { type: AdaptationValueSchema, required: true },
      planningAggressiveness: { type: AdaptationValueSchema, required: true },
      roadmapGranularity: { type: AdaptationValueSchema, required: true },
      executionStyle: { type: AdaptationValueSchema, required: true },
      calendarBufferMinutes: { type: AdaptationValueSchema, required: true },
      preferredReflectionLength: { type: AdaptationValueSchema, required: true },
      preferredBriefStyle: { type: AdaptationValueSchema, required: true },
      preferredCompanionTone: { type: AdaptationValueSchema, required: true },
      motivationStyle: { type: AdaptationValueSchema, required: true },
      notificationVerbosity: { type: AdaptationValueSchema, required: true },
      scheduleFlexibility: { type: AdaptationValueSchema, required: true },
      preferredFocusSessionLength: { type: AdaptationValueSchema, required: true },
      preferredRecoveryTime: { type: AdaptationValueSchema, required: true },
      preferredPlanningDepth: { type: AdaptationValueSchema, required: true },
      preferredDeadlineBuffer: { type: AdaptationValueSchema, required: true }
    },
    history: [HistoryEntrySchema],
    reasoning: { type: Schema.Types.Map, of: String, default: {} }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "adaptivePolicies"
  }
);

export const AdaptivePolicy: Model<IAdaptivePolicy> =
  mongoose.models.AdaptivePolicy ||
  mongoose.model<IAdaptivePolicy>("AdaptivePolicy", AdaptivePolicySchema);
