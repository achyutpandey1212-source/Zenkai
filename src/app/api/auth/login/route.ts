import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { dbConnect } from "@/lib/db";
import { User } from "@/models/User";

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json(
        { success: false, error: "Missing idToken" },
        { status: 400 }
      );
    }

    if (!adminAuth) {
      return NextResponse.json(
        { success: false, error: "Firebase Admin SDK is not initialized. Check server configurations." },
        { status: 500 }
      );
    }

    // Verify Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const { uid, name, email, picture } = decodedToken;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required for authentication" },
        { status: 400 }
      );
    }

    await dbConnect();

    // Find or create user
    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      // First-time login: create new user
      user = await User.create({
        firebaseUid: uid,
        name: name || email.split("@")[0],
        email: email,
        photoURL: picture || "",
        createdAt: new Date(),
        lastLogin: new Date(),
        onboardingCompleted: false,
      });
    } else {
      // Existing user: update last login
      user.lastLogin = new Date();
      await user.save();
    }

    // Create session cookie (expires in 14 days)
    const expiresIn = 60 * 60 * 24 * 14 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        firebaseUid: user.firebaseUid,
        name: user.name,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        onboardingCompleted: user.onboardingCompleted,
      },
    });

    // Set cookie
    response.cookies.set("session", sessionCookie, {
      maxAge: expiresIn / 1000, // seconds
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("Login API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
