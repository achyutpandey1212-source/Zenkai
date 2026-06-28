import mongoose, { Schema, Model, Document } from "mongoose";

export interface IPredictionEvent extends Document {
  uid: string; // FK → users.firebaseUid
  timestamp: Date;
  predictionType: string; // e.g. "roadmap_completion", "consistency_trend", "goal_forecast"
  oldPrediction: string;
  newPrediction: string;
  confidence: number;
  reason: string;
}

const PredictionEventSchema = new Schema<IPredictionEvent>(
  {
    uid: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    predictionType: { type: String, required: true },
    oldPrediction: { type: String, required: true },
    newPrediction: { type: String, required: true },
    confidence: { type: Number, required: true },
    reason: { type: String, required: true }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "predictionEvents"
  }
);

export const PredictionEvent: Model<IPredictionEvent> =
  mongoose.models.PredictionEvent ||
  mongoose.model<IPredictionEvent>("PredictionEvent", PredictionEventSchema);
