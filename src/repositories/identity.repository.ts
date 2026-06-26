import { dbConnect } from "@/lib/mongodb";
import {
  IdentityTrait,
  IIdentityTrait,
  IdentityTraitCategory,
  IdentityTraitStatus,
} from "@/models/IdentityTrait";
import { Types } from "mongoose";

export type IdentityTraitCreateInput = {
  firebaseUid: string;
  trait: string;
  category: IdentityTraitCategory;
  description?: string;
  confidence?: number;
  stability?: number;
  version?: number;
  status?: IdentityTraitStatus;
  evidence?: string;
};

export type IdentityTraitUpdateInput = Partial<
  Omit<IdentityTraitCreateInput, "firebaseUid">
>;

/**
 * IdentityRepository — CRUD for identity traits.
 */
export const IdentityRepository = {
  /**
   * Get all active identity traits for a user.
   */
  async findActiveByUser(uid: string): Promise<IIdentityTrait[]> {
    await dbConnect();
    return IdentityTrait.find({ firebaseUid: uid, status: "active" })
      .sort({ confidence: -1 })
      .lean() as Promise<IIdentityTrait[]>;
  },

  /**
   * Get all candidate (emerging/hypothesis) identity traits for a user.
   */
  async findCandidatesByUser(uid: string): Promise<IIdentityTrait[]> {
    await dbConnect();
    return IdentityTrait.find({ firebaseUid: uid, status: "candidate" })
      .sort({ confidence: -1 })
      .lean() as Promise<IIdentityTrait[]>;
  },

  /**
   * Get all traits for a user (including deprecated for timeline).
   */
  async findAllByUser(uid: string): Promise<IIdentityTrait[]> {
    await dbConnect();
    return IdentityTrait.find({ firebaseUid: uid })
      .sort({ updatedAt: -1 })
      .lean() as Promise<IIdentityTrait[]>;
  },

  /**
   * Get traits by category.
   */
  async findByCategory(
    uid: string,
    category: IdentityTraitCategory
  ): Promise<IIdentityTrait[]> {
    await dbConnect();
    return IdentityTrait.find({ firebaseUid: uid, category, status: "active" })
      .sort({ confidence: -1 })
      .lean() as Promise<IIdentityTrait[]>;
  },

  /**
   * Find a trait by _id.
   */
  async findById(id: string): Promise<IIdentityTrait | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return IdentityTrait.findById(id).lean() as Promise<IIdentityTrait | null>;
  },

  /**
   * Find a trait by user, trait name, and category.
   */
  async findByNameAndCategory(
    uid: string,
    trait: string,
    category: IdentityTraitCategory
  ): Promise<IIdentityTrait | null> {
    await dbConnect();
    return IdentityTrait.findOne({ firebaseUid: uid, trait, category }).lean() as Promise<IIdentityTrait | null>;
  },

  /**
   * Create a new identity trait.
   */
  async create(data: IdentityTraitCreateInput): Promise<IIdentityTrait> {
    await dbConnect();
    const trait = await IdentityTrait.create(data);
    return trait.toObject() as IIdentityTrait;
  },

  /**
   * Update a trait.
   */
  async update(
    id: string,
    data: IdentityTraitUpdateInput
  ): Promise<IIdentityTrait | null> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return null;
    return IdentityTrait.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    ).lean() as Promise<IIdentityTrait | null>;
  },

  /**
   * Activate a candidate trait.
   */
  async activate(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await IdentityTrait.findByIdAndUpdate(id, { $set: { status: "active" } });
  },

  /**
   * Deprecate a trait (soft-delete/archive).
   */
  async deprecate(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await IdentityTrait.findByIdAndUpdate(id, {
      $set: { status: "deprecated" },
    });
  },

  /**
   * Hard delete a trait.
   */
  async delete(id: string): Promise<void> {
    await dbConnect();
    if (!Types.ObjectId.isValid(id)) return;
    await IdentityTrait.findByIdAndDelete(id);
  },

  /**
   * Delete all identity traits for a user.
   */
  async deleteAllByUser(uid: string): Promise<void> {
    await dbConnect();
    await IdentityTrait.deleteMany({ firebaseUid: uid });
  },
};
