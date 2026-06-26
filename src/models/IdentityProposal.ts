import mongoose, { Schema, Model, Document } from "mongoose";
import { IdentityTraitCategory } from "./IdentityTrait";

/**
 * IdentityProposal — stores pending identity trait proposals for user confirmation.
 * Collection: identityProposals
 */

export type IdentityProposalStatus = "pending" | "approved" | "rejected";

export interface IIdentityProposal extends Document {
  firebaseUid: string;            // Owner (FK → users.firebaseUid)
  trait: string;                  // e.g. "Builder"
  category: IdentityTraitCategory;
  confidence: number;             // Proposed confidence (0.0 - 1.0)
  reason: string;                 // Evidence or explanation for the proposal
  status: IdentityProposalStatus; // Status of the proposal
  createdAt: Date;
  updatedAt: Date;
}

const IdentityProposalSchema = new Schema<IIdentityProposal>(
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
    confidence: { type: Number, required: true, min: 0, max: 1 },
    reason: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "identityProposals",
  }
);

IdentityProposalSchema.index({ firebaseUid: 1, status: 1 });

export const IdentityProposal: Model<IIdentityProposal> =
  mongoose.models.IdentityProposal ||
  mongoose.model<IIdentityProposal>("IdentityProposal", IdentityProposalSchema);
