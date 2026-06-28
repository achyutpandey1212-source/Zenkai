import mongoose, { Schema, Model, Document } from "mongoose";

export interface IBehaviorProfile extends Document {
  uid: string;
  createdAt: Date;
  updatedAt: Date;
  Activity: {
    currentStreak: number;
    longestStreak: number;
    daysActive: number;
    lastActivity: Date | null;
    activeDates: string[];
  };
  Completion: {
    completedTasks: number;
    skippedTasks: number;
    overdueTasks: number;
    completionRate: number; // percentage (0-100)
  };
  Productivity: {
    averagePlannedHours: number;
    averageCompletedHours: number;
    workCompletionRatio: number; // ratio (completed / planned)
  };
  DeepWork: {
    deepWorkSessions: number;
    averageDeepWorkMinutes: number;
    longestDeepWorkMinutes: number;
  };
  TimePreference: {
    preferredWorkingWindow: string; // "Morning", "Afternoon", "Evening", "Late Night"
    peakHours: string; // e.g., "08:00–11:00"
  };
  Weekly: {
    weekdayCompletionRate: number; // percentage (0-100)
    weekendCompletionRate: number; // percentage (0-100)
  };
  Planning: {
    plansCreated: number;
    plansCompleted: number;
    plansAbandoned: number;
    averagePlanLifetime: number; // in days
  };
  Calendar: {
    calendarUsageDays: number;
    calendarCompletionRate: number; // percentage (0-100)
  };
  Briefings: {
    morningBriefOpenRate: number; // percentage (0-100)
    eveningBriefOpenRate: number; // percentage (0-100)
  };
  Execution: {
    dailyAgendaGenerated: number;
    dailyAgendaCompleted: number;
    averageAgendaCompletion: number; // percentage (0-100)
  };
  Metadata: {
    engineVersion: string;
    lastComputed: Date;
  };
}

const BehaviorProfileSchema = new Schema<IBehaviorProfile>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    Activity: {
      currentStreak: { type: Number, default: 0 },
      longestStreak: { type: Number, default: 0 },
      daysActive: { type: Number, default: 0 },
      lastActivity: { type: Date, default: null },
      activeDates: [{ type: String }],
    },
    Completion: {
      completedTasks: { type: Number, default: 0 },
      skippedTasks: { type: Number, default: 0 },
      overdueTasks: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
    },
    Productivity: {
      averagePlannedHours: { type: Number, default: 0 },
      averageCompletedHours: { type: Number, default: 0 },
      workCompletionRatio: { type: Number, default: 0 },
    },
    DeepWork: {
      deepWorkSessions: { type: Number, default: 0 },
      averageDeepWorkMinutes: { type: Number, default: 0 },
      longestDeepWorkMinutes: { type: Number, default: 0 },
    },
    TimePreference: {
      preferredWorkingWindow: { type: String, default: "Morning" },
      peakHours: { type: String, default: "08:00–11:00" },
    },
    Weekly: {
      weekdayCompletionRate: { type: Number, default: 0 },
      weekendCompletionRate: { type: Number, default: 0 },
    },
    Planning: {
      plansCreated: { type: Number, default: 0 },
      plansCompleted: { type: Number, default: 0 },
      plansAbandoned: { type: Number, default: 0 },
      averagePlanLifetime: { type: Number, default: 0 },
    },
    Calendar: {
      calendarUsageDays: { type: Number, default: 0 },
      calendarCompletionRate: { type: Number, default: 0 },
    },
    Briefings: {
      morningBriefOpenRate: { type: Number, default: 0 },
      eveningBriefOpenRate: { type: Number, default: 0 },
    },
    Execution: {
      dailyAgendaGenerated: { type: Number, default: 0 },
      dailyAgendaCompleted: { type: Number, default: 0 },
      averageAgendaCompletion: { type: Number, default: 0 },
    },
    Metadata: {
      engineVersion: { type: String, default: "1.0.0" },
      lastComputed: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
    collection: "behavior_profiles",
  }
);

export const BehaviorProfile: Model<IBehaviorProfile> =
  mongoose.models.BehaviorProfile ||
  mongoose.model<IBehaviorProfile>("BehaviorProfile", BehaviorProfileSchema);
