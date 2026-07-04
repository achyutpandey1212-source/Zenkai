import mongoose, { Schema, Model, Document } from "mongoose";

/**
 * Profile — stores onboarding data for each user.
 * One-to-one relationship with User (via firebaseUid).
 * Collection: profiles
 */
export interface ICommitment {
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  days: string[]; // e.g. ["Monday", "Tuesday"]
}

export interface IProfileGoal {
  title: string;
  priority: number;
}

export interface IProfile extends Document {
  firebaseUid: string;        // FK → users.firebaseUid
  profession: string;
  longTermGoal: string;
  currentFocus: string;
  motivation: string;
  dailyAvailability: string;
  workStyle: string;
  biggestChallenge: string;
  timezone?: string;
  age?: number;
  country?: string;
  locale?: string;
  commitments: ICommitment[];
  wakeUpTime?: string;
  sleepTime?: string;
  goals: IProfileGoal[];
  schedulingStyle?: "Strict" | "Flexible" | "Balanced";
  focusDuration?: number;
  deepWorkTime?: "Morning" | "Afternoon" | "Evening" | "Night";
  roles?: string[];
  focusAreas?: string[];
  productivityChallenges?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CommitmentSchema = new Schema<ICommitment>(
  {
    name: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    days: { type: [String], required: true },
  },
  { _id: false }
);

const ProfileGoalSchema = new Schema<IProfileGoal>(
  {
    title: { type: String, required: true },
    priority: { type: Number, required: true },
  },
  { _id: false }
);

const ProfileSchema = new Schema<IProfile>(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    profession: { type: String, required: true },
    longTermGoal: { type: String, required: true },
    currentFocus: { type: String, required: true },
    motivation: { type: String, default: "" },
    dailyAvailability: { type: String, default: "" },
    workStyle: { type: String, default: "" },
    biggestChallenge: { type: String, default: "" },
    timezone: { type: String, default: "UTC" },
    age: { type: Number },
    country: { type: String },
    locale: { type: String },
    commitments: { type: [CommitmentSchema], default: [] },
    wakeUpTime: { type: String, default: "07:00" },
    sleepTime: { type: String, default: "23:00" },
    goals: { type: [ProfileGoalSchema], default: [] },
    schedulingStyle: { type: String, enum: ["Strict", "Flexible", "Balanced"], default: "Balanced" },
    focusDuration: { type: Number, default: 45 },
    deepWorkTime: { type: String, enum: ["Morning", "Afternoon", "Evening", "Night"], default: "Morning" },
    roles: { type: [String], default: [] },
    focusAreas: { type: [String], default: [] },
    productivityChallenges: { type: [String], default: [] },
  },
  {
    timestamps: true,  // auto-manages createdAt + updatedAt
    versionKey: false,
    collection: "profiles",
  }
);

export const Profile: Model<IProfile> =
  mongoose.models.Profile ||
  mongoose.model<IProfile>("Profile", ProfileSchema);
