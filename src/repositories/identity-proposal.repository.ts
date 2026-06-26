import { dbConnect } from "@/lib/mongodb";
import { IdentityProposal, IIdentityProposal, IdentityProposalStatus } from "@/models/IdentityProposal";
import { Types } from "mongoose";
import { IdentityTraitCategory } from "@/models/IdentityTrait";

export const IdentityProposalRepository = {
  /**
   * Get all pending proposals for a user.
   */
  async findPendingByUser(uid: string): Promise<IIdentityProposal[]> {
    await dbConnect();
    return IdentityProposal.find({ firebaseUid: uid, status: "pending" })
      .sort({ createdAt: -1 })
      .lean() as Promise<IIdentityProposal[]>;
  },

  /**
   * Find a proposal by _id.
   */
  async findById(id: string): Promise<IIdentityProposal | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return IdentityProposal.findById(id).lean() as Promise<IIdentityProposal | null>;
  },

  /**
   * Find a proposal by name and category (useful to check duplicates).
   */
  async findByNameCategoryAndStatus(
    uid: string,
    trait: string,
    category: IdentityTraitCategory,
    status: IdentityProposalStatus
  ): Promise<IIdentityProposal | null> {
    await dbConnect();
    return IdentityProposal.findOne({ firebaseUid: uid, trait, category, status }).lean() as Promise<IIdentityProposal | null>;
  },

  /**
   * Create a new proposal.
   */
  async create(data: {
    firebaseUid: string;
    trait: string;
    category: IdentityTraitCategory;
    confidence: number;
    reason: string;
  }): Promise<IIdentityProposal> {
    await dbConnect();
    const proposal = await IdentityProposal.create({
      ...data,
      status: "pending"
    });
    return proposal.toObject() as IIdentityProposal;
  },

  /**
   * Update proposal status.
   */
  async updateStatus(id: string, status: IdentityProposalStatus): Promise<IIdentityProposal | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return IdentityProposal.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    ).lean() as Promise<IIdentityProposal | null>;
  },

  /**
   * Update proposal confidence and reason.
   */
  async updatePendingProposal(
    id: string,
    confidence: number,
    reason: string
  ): Promise<IIdentityProposal | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return IdentityProposal.findByIdAndUpdate(
      id,
      { $set: { confidence, reason } },
      { new: true }
    ).lean() as Promise<IIdentityProposal | null>;
  },

  /**
   * Delete a proposal.
   */
  async delete(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await IdentityProposal.findByIdAndDelete(id);
  },

  /**
   * Delete all proposals for a user.
   */
  async deleteAllByUser(uid: string): Promise<void> {
    await dbConnect();
    await IdentityProposal.deleteMany({ firebaseUid: uid });
  },
};
