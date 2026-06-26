import mongoose, { Schema, Model, Document } from "mongoose";

/**
 * IdentityTrait — defines who the user is becoming.
 * The most important collection for the Identity Engine.
 * Collection: identityTraits
 */

export type IdentityTraitStatus = "candidate" | "active" | "deprecated";

export type IdentityTraitCategory =
  | "core_identity"
  | "aspiration"
  | "principle"
  | "behavior_pattern"
  | "current_state";

export interface IIdentityTrait extends Document {
  firebaseUid: string;            // FK → users.firebaseUid
  trait: string;                  // e.g. "Builder", "Deep Thinker"
  category: IdentityTraitCategory;
  confidence: number;             // 0.0 – 1.0
  status: IdentityTraitStatus;
  evidence?: string;              // brief justification
  createdAt: Date;
  updatedAt: Date;
}

const IdentityTraitSchema = new Schema<IIdentityTrait>(
  {
    firebaseUid: { type: String, required: true, index: true },
    trait: { type: String, required: true },
    category: {
      type: String,
      enum: [
        "core_identity",
        "aspiration",
        "principle",
        "behavior_pattern",
        "current_state",
      ],
      required: true,
    },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    status: {
      type: String,
      enum: ["candidate", "active", "deprecated"],
      default: "candidate",
    },
    evidence: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "identityTraits",
  }
);

IdentityTraitSchema.index({ firebaseUid: 1, status: 1 });

export const IdentityTrait: Model<IIdentityTrait> =
  mongoose.models.IdentityTrait ||
  mongoose.model<IIdentityTrait>("IdentityTrait", IdentityTraitSchema);
