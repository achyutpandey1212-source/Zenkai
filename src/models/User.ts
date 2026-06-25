import mongoose, { Schema, Model } from "mongoose";

export interface IUser {
  firebaseUid: string;
  name: string;
  email: string;
  photoURL?: string;
  createdAt: Date;
  lastLogin?: Date;
  onboardingCompleted: boolean;
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
  },
  {
    versionKey: false,
  }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
