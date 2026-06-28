import mongoose, { Schema, Model, Document } from "mongoose";

export interface IScoreHistory {
  score: number;
  timestamp: Date;
}

export interface IConsistencyProfile extends Document {
  uid: string; // FK → users.firebaseUid
  overallConsistency: number;
  scoreHistory: IScoreHistory[];
  
  Identity: {
    identityAlignmentScore: number;
    completedRelevantHours: number;
    completedIrrelevantHours: number;
    alignmentPercentage: number;
    evidence: string[];
  };
  
  Goals: {
    goalConsistencyScore: number;
    goalHoursDistribution: { goalTitle: string; hours: number }[];
    topGoal: string;
    lowestSupportedGoal: string;
    evidence: string[];
  };
  
  Planning: {
    planningConsistencyScore: number;
    plannedTasks: number;
    completedTasks: number;
    rescheduledTasks: number;
    missedTasks: number;
    evidence: string[];
  };
  
  Schedule: {
    scheduleReliabilityScore: number;
    evidence: string[];
  };
  
  Routine: {
    routineScore: number;
    preferredRoutine: string;
    daysFollowingRoutine: number;
    evidence: string[];
  };
  
  Calendar: {
    calendarConsistencyScore: number;
    calendarOverrideRate: number;
    evidence: string[];
  };
  
  Commitment: {
    commitmentScore: number;
    plansStarted: number;
    plansFinished: number;
    plansAbandoned: number;
    milestonesFinished: number;
    averageDelay: number;
    evidence: string[];
  };
  
  Drift: {
    goalDriftDetected: boolean;
    goalDriftPercentage: number;
    driftingGoal: string;
    evidence: string[];
  };
  
  Trends: {
    sevenDayAvg: number;
    thirtyDayAvg: number;
    lifetimeAvg: number;
  };
  
  lastUpdated: Date;
}

const ScoreHistorySchema = new Schema<IScoreHistory>({
  score: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const ConsistencyProfileSchema = new Schema<IConsistencyProfile>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    overallConsistency: { type: Number, default: 0 },
    scoreHistory: [ScoreHistorySchema],
    
    Identity: {
      identityAlignmentScore: { type: Number, default: 0 },
      completedRelevantHours: { type: Number, default: 0 },
      completedIrrelevantHours: { type: Number, default: 0 },
      alignmentPercentage: { type: Number, default: 0 },
      evidence: { type: [String], default: [] }
    },
    
    Goals: {
      goalConsistencyScore: { type: Number, default: 0 },
      goalHoursDistribution: [{
        goalTitle: { type: String, required: true },
        hours: { type: Number, required: true }
      }],
      topGoal: { type: String, default: "" },
      lowestSupportedGoal: { type: String, default: "" },
      evidence: { type: [String], default: [] }
    },
    
    Planning: {
      planningConsistencyScore: { type: Number, default: 0 },
      plannedTasks: { type: Number, default: 0 },
      completedTasks: { type: Number, default: 0 },
      rescheduledTasks: { type: Number, default: 0 },
      missedTasks: { type: Number, default: 0 },
      evidence: { type: [String], default: [] }
    },
    
    Schedule: {
      scheduleReliabilityScore: { type: Number, default: 0 },
      evidence: { type: [String], default: [] }
    },
    
    Routine: {
      routineScore: { type: Number, default: 0 },
      preferredRoutine: { type: String, default: "" },
      daysFollowingRoutine: { type: Number, default: 0 },
      evidence: { type: [String], default: [] }
    },
    
    Calendar: {
      calendarConsistencyScore: { type: Number, default: 0 },
      calendarOverrideRate: { type: Number, default: 0 },
      evidence: { type: [String], default: [] }
    },
    
    Commitment: {
      commitmentScore: { type: Number, default: 0 },
      plansStarted: { type: Number, default: 0 },
      plansFinished: { type: Number, default: 0 },
      plansAbandoned: { type: Number, default: 0 },
      milestonesFinished: { type: Number, default: 0 },
      averageDelay: { type: Number, default: 0 },
      evidence: { type: [String], default: [] }
    },
    
    Drift: {
      goalDriftDetected: { type: Boolean, default: false },
      goalDriftPercentage: { type: Number, default: 0 },
      driftingGoal: { type: String, default: "" },
      evidence: { type: [String], default: [] }
    },
    
    Trends: {
      sevenDayAvg: { type: Number, default: 0 },
      thirtyDayAvg: { type: Number, default: 0 },
      lifetimeAvg: { type: Number, default: 0 }
    },
    
    lastUpdated: { type: Date, default: Date.now }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "consistencyProfiles"
  }
);

export const ConsistencyProfile: Model<IConsistencyProfile> =
  mongoose.models.ConsistencyProfile ||
  mongoose.model<IConsistencyProfile>("ConsistencyProfile", ConsistencyProfileSchema);
