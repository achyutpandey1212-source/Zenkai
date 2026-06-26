import { dbConnect } from "@/lib/mongodb";
import { User, IUser } from "@/models/User";

/**
 * UserRepository — CRUD operations for the users collection.
 * All application code should use this instead of calling User model directly.
 */
export const UserRepository = {
  /**
   * Find a user by their Firebase UID.
   */
  async findByFirebaseUid(uid: string): Promise<IUser | null> {
    await dbConnect();
    return User.findOne({ firebaseUid: uid }).lean() as Promise<IUser | null>;
  },

  /**
   * Find a user by their email address.
   */
  async findByEmail(email: string): Promise<IUser | null> {
    await dbConnect();
    return User.findOne({ email }).lean() as Promise<IUser | null>;
  },

  /**
   * Create a new user document.
   */
  async create(data: {
    firebaseUid: string;
    name: string;
    email: string;
    photoURL?: string;
  }): Promise<IUser> {
    await dbConnect();
    const user = await User.create({
      firebaseUid: data.firebaseUid,
      name: data.name,
      email: data.email,
      photoURL: data.photoURL ?? "",
      createdAt: new Date(),
      lastLogin: new Date(),
      onboardingCompleted: false,
    });
    return user.toObject() as IUser;
  },

  /**
   * Mark onboarding as complete for a user.
   */
  async markOnboardingComplete(uid: string): Promise<void> {
    await dbConnect();
    await User.updateOne(
      { firebaseUid: uid },
      { $set: { onboardingCompleted: true } }
    );
  },

  /**
   * Update the lastLogin timestamp.
   */
  async updateLastLogin(uid: string): Promise<void> {
    await dbConnect();
    await User.updateOne(
      { firebaseUid: uid },
      { $set: { lastLogin: new Date() } }
    );
  },

  /**
   * Update user's display name.
   */
  async updateName(uid: string, name: string): Promise<void> {
    await dbConnect();
    await User.updateOne({ firebaseUid: uid }, { $set: { name } });
  },

  /**
   * Delete a user by Firebase UID.
   */
  async deleteByFirebaseUid(uid: string): Promise<void> {
    await dbConnect();
    await User.deleteOne({ firebaseUid: uid });
  },
};
