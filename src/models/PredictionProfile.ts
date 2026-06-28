import mongoose, { Schema, Model, Document } from "mongoose";

export interface IDailyTaskPrediction {
  taskId: string;
  title: string;
  completionProbability: number;
}

export interface IGoalPrediction {
  goalId: string;
  goalTitle: string;
  estimatedCompletionDate: Date;
  confidence: number;
  likelihood: "High" | "Medium" | "Low";
}

export interface IDeadlinePrediction {
  goalId: string;
  goalTitle: string;
  deadline: Date;
  probabilityEarly: number;
  probabilityOnTime: number;
  probabilityLate: number;
}

export interface IRollingPrediction {
  timestamp: Date;
  roadmapEstimatedRemainingDays: number;
  overallConfidence: number;
}

export interface IPredictionProfile extends Document {
  uid: string; // FK → users.firebaseUid
  lastUpdated: Date;
  
  completionForecast: {
    estimatedCompletionDate: Date;
    estimatedRemainingDays: number;
    confidence: number;
    evidence: string[];
  };
  
  dailyTaskForecast: IDailyTaskPrediction[];
  
  productivityForecast: {
    expectedFocusHours7d: { min: number; max: number };
    expectedCompletedTasks7d: { min: number; max: number };
    expectedDeepWorkSessions7d: { min: number; max: number };
    expectedAgendaCompletion7d: { min: number; max: number };
    expectedFocusHours30d: { min: number; max: number };
    expectedCompletedTasks30d: { min: number; max: number };
    expectedDeepWorkSessions30d: { min: number; max: number };
    expectedAgendaCompletion30d: { min: number; max: number };
    evidence: string[];
  };
  
  consistencyForecast: {
    predictedConsistencyNextWeek: number;
    trendDirection: "up" | "down" | "stable";
    evidence: string[];
  };
  
  goalForecast: IGoalPrediction[];
  
  deadlineForecast: IDeadlinePrediction[];
  
  habitForecast: {
    currentStreak: number;
    probabilityContinueTomorrow: number;
    probabilityContinueNextWeek: number;
    probabilityLoseStreak: number;
    evidence: string[];
  };
  
  averageConfidence: number;
  rollingPredictions: IRollingPrediction[];
}

const DailyTaskPredictionSchema = new Schema<IDailyTaskPrediction>({
  taskId: { type: String, required: true },
  title: { type: String, required: true },
  completionProbability: { type: Number, required: true }
}, { _id: false });

const GoalPredictionSchema = new Schema<IGoalPrediction>({
  goalId: { type: String, required: true },
  goalTitle: { type: String, required: true },
  estimatedCompletionDate: { type: Date, required: true },
  confidence: { type: Number, required: true },
  likelihood: { type: String, enum: ["High", "Medium", "Low"], required: true }
}, { _id: false });

const DeadlinePredictionSchema = new Schema<IDeadlinePrediction>({
  goalId: { type: String, required: true },
  goalTitle: { type: String, required: true },
  deadline: { type: Date, required: true },
  probabilityEarly: { type: Number, required: true },
  probabilityOnTime: { type: Number, required: true },
  probabilityLate: { type: Number, required: true }
}, { _id: false });

const RollingPredictionSchema = new Schema<IRollingPrediction>({
  timestamp: { type: Date, required: true },
  roadmapEstimatedRemainingDays: { type: Number, required: true },
  overallConfidence: { type: Number, required: true }
}, { _id: false });

const PredictionProfileSchema = new Schema<IPredictionProfile>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    lastUpdated: { type: Date, default: Date.now },
    
    completionForecast: {
      estimatedCompletionDate: { type: Date },
      estimatedRemainingDays: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
      evidence: { type: [String], default: [] }
    },
    
    dailyTaskForecast: [DailyTaskPredictionSchema],
    
    productivityForecast: {
      expectedFocusHours7d: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      },
      expectedCompletedTasks7d: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      },
      expectedDeepWorkSessions7d: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      },
      expectedAgendaCompletion7d: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      },
      expectedFocusHours30d: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      },
      expectedCompletedTasks30d: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      },
      expectedDeepWorkSessions30d: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      },
      expectedAgendaCompletion30d: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 }
      },
      evidence: { type: [String], default: [] }
    },
    
    consistencyForecast: {
      predictedConsistencyNextWeek: { type: Number, default: 0 },
      trendDirection: { type: String, enum: ["up", "down", "stable"], default: "stable" },
      evidence: { type: [String], default: [] }
    },
    
    goalForecast: [GoalPredictionSchema],
    
    deadlineForecast: [DeadlinePredictionSchema],
    
    habitForecast: {
      currentStreak: { type: Number, default: 0 },
      probabilityContinueTomorrow: { type: Number, default: 0 },
      probabilityContinueNextWeek: { type: Number, default: 0 },
      probabilityLoseStreak: { type: Number, default: 0 },
      evidence: { type: [String], default: [] }
    },
    
    averageConfidence: { type: Number, default: 0 },
    rollingPredictions: [RollingPredictionSchema]
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "predictionProfiles"
  }
);

export const PredictionProfile: Model<IPredictionProfile> =
  mongoose.models.PredictionProfile ||
  mongoose.model<IPredictionProfile>("PredictionProfile", PredictionProfileSchema);
