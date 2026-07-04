import { dbConnect } from "@/lib/mongodb";
import { Profile, IProfile, ICommitment, IProfileGoal } from "@/models/Profile";

export type ProfileCreateInput = {
  firebaseUid: string;
  profession: string;
  longTermGoal: string;
  currentFocus: string;
  motivation?: string;
  dailyAvailability?: string;
  workStyle?: string;
  biggestChallenge?: string;
  timezone?: string;
  age?: number;
  country?: string;
  locale?: string;
  commitments?: ICommitment[];
  wakeUpTime?: string;
  sleepTime?: string;
  goals?: IProfileGoal[];
  schedulingStyle?: "Strict" | "Flexible" | "Balanced";
  focusDuration?: number;
  deepWorkTime?: "Morning" | "Afternoon" | "Evening" | "Night";
  roles?: string[];
  focusAreas?: string[];
  productivityChallenges?: string[];
  primaryIdentity?: string;
  state?: string;
  branchContext?: Record<string, string>;
};

export type ProfileUpdateInput = Partial<Omit<ProfileCreateInput, "firebaseUid">>;

/**
 * ProfileRepository — CRUD operations for the profiles collection.
 */
export const ProfileRepository = {
  /**
   * Get the profile for a given user.
   */
  async findByFirebaseUid(uid: string): Promise<IProfile | null> {
    await dbConnect();
    return Profile.findOne({ firebaseUid: uid }).lean() as Promise<IProfile | null>;
  },

  /**
   * Create a new profile for a user.
   * Throws if a profile already exists (use upsert for updates).
   */
  async create(data: ProfileCreateInput): Promise<IProfile> {
    await dbConnect();
    const profile = await Profile.create(data);
    return profile.toObject() as IProfile;
  },

  /**
   * Upsert (create or replace) a profile.
   * Safe to call after onboarding completes.
   */
  async upsert(data: ProfileCreateInput): Promise<IProfile> {
    await dbConnect();
    const profile = await Profile.findOneAndUpdate(
      { firebaseUid: data.firebaseUid },
      { $set: data },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
    ).lean();
    return profile as IProfile;
  },

  /**
   * Update specific fields on an existing profile.
   */
  async update(uid: string, data: ProfileUpdateInput): Promise<IProfile | null> {
    await dbConnect();
    return Profile.findOneAndUpdate(
      { firebaseUid: uid },
      { $set: data },
      { returnDocument: "after" }
    ).lean() as Promise<IProfile | null>;
  },

  /**
   * Delete a profile by Firebase UID.
   */
  async deleteByFirebaseUid(uid: string): Promise<void> {
    await dbConnect();
    await Profile.deleteOne({ firebaseUid: uid });
  },
};
