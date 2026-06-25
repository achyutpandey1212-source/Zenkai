import { adminAuth } from "./firebaseAdmin";
import { dbConnect } from "./db";
import { User, IUser } from "@/models/User";

export async function verifySession(sessionCookie: string | undefined): Promise<IUser | null> {
  if (!sessionCookie) return null;
  
  try {
    if (!adminAuth) {
      console.warn("Firebase Admin SDK is not initialized. Skipping session verification.");
      return null;
    }
    // Verify the session cookie.
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    
    await dbConnect();
    
    // Find the user in MongoDB
    const user = await User.findOne({ firebaseUid: decodedClaims.uid }).lean();
    if (!user) return null;
    
    // Return standard object matching IUser interface
    return {
      firebaseUid: user.firebaseUid,
      name: user.name,
      email: user.email,
      photoURL: user.photoURL,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      onboardingCompleted: user.onboardingCompleted,
    };
  } catch (error) {
    console.error("Session verification failed:", error);
    return null;
  }
}
