import mongoose, { Schema, Model } from "mongoose";

export interface IUserBriefSettings {
  morningBriefEnabled: boolean;
  eveningBriefEnabled: boolean;
  preferredMorningTime: string;
  preferredEveningTime: string;
  timezone: string;
  emailFrequency: "daily" | "weekly";
}

export interface IUser {
  firebaseUid: string;
  name: string;
  email: string;
  photoURL?: string;
  createdAt: Date;
  lastLogin?: Date;
  onboardingCompleted: boolean;
  briefSettings?: IUserBriefSettings;
}

const UserSchema = new Schema<IUser>(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    photoURL: { type: String },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    onboardingCompleted: { type: Boolean, default: false },
    briefSettings: {
      morningBriefEnabled: { type: Boolean, default: true },
      eveningBriefEnabled: { type: Boolean, default: true },
      preferredMorningTime: { type: String, default: "08:00" },
      preferredEveningTime: { type: String, default: "20:30" },
      timezone: { type: String, default: "UTC" },
      emailFrequency: { type: String, default: "daily" },
    },
  },
  {
    versionKey: false,
  }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
