import mongoose, { Schema, Model } from "mongoose";

export interface IUserBriefSettings {
  morningBriefEnabled: boolean;
  eveningBriefEnabled: boolean;
  preferredMorningTime: string;
  preferredEveningTime: string;
  timezone: string;
  emailFrequency: "daily" | "weekly";
}

export interface IGoogleCalendarSettings {
  connected: boolean;
  email?: string;
  accessToken?: string; // encrypted with AES-256-GCM
  refreshToken?: string; // encrypted with AES-256-GCM
  expiry?: number; // timestamp in ms
  syncNewTasks: boolean;
  updateTasks: boolean;
  deleteTasksAutomatically: boolean;
  lastSuccessfulSync?: Date;
  syncedEventsCount?: number;
  syncHealth: "healthy" | "reconnect_required";
  calendarSyncPending: boolean;
  lastSyncRequestAt?: Date;
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
  googleCalendarSettings?: IGoogleCalendarSettings;
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
    googleCalendarSettings: {
      connected: { type: Boolean, default: false },
      email: { type: String },
      accessToken: { type: String },
      refreshToken: { type: String },
      expiry: { type: Number },
      syncNewTasks: { type: Boolean, default: true },
      updateTasks: { type: Boolean, default: true },
      deleteTasksAutomatically: { type: Boolean, default: false },
      lastSuccessfulSync: { type: Date },
      syncedEventsCount: { type: Number, default: 0 },
      syncHealth: { type: String, enum: ["healthy", "reconnect_required"], default: "healthy" },
      calendarSyncPending: { type: Boolean, default: false },
      lastSyncRequestAt: { type: Date },
    },
  },
  {
    versionKey: false,
  }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
