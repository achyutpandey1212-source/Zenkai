import mongoose, { Schema, Model, Document } from "mongoose";

/**
 * Profile — stores onboarding data for each user.
 * One-to-one relationship with User (via firebaseUid).
 * Collection: profiles
 */
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
  createdAt: Date;
  updatedAt: Date;
}

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
