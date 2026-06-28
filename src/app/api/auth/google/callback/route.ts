import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { User } from "@/models/User";
import { encrypt } from "@/lib/encryption";
import { dbConnect } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    
    if (!code) {
      return NextResponse.json({ success: false, error: "OAuth authorization code missing" }, { status: 400 });
    }

    // 1. Verify user session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const isMock = code.startsWith("mock-code") || !clientId;

    let accessToken = "";
    let refreshToken = "";
    let expiry = 0;
    let email = "";

    if (isMock) {
      // Setup mock data for simulator
      accessToken = `mock-access-token-${Date.now()}`;
      refreshToken = `mock-refresh-token-${Date.now()}`;
      expiry = Date.now() + 3600 * 1000; // 1 hour
      email = "demo-user@gmail.com";
      console.log(`[MOCK] Exchanged OAuth code for simulator user. Connected to ${email}`);
    } else {
      // Exchange OAuth code for tokens
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
      const origin = new URL(request.url).origin;
      const redirectUri = `${origin}/api/auth/google/callback`;

      console.log(`Exchanging Google OAuth code for user ${user.firebaseUid}`);
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        console.error("Google Token Exchange failed:", errorText);
        return NextResponse.json({ success: false, error: `Token exchange failed: ${errorText}` }, { status: 400 });
      }

      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;
      // Google only returns refresh_token on initial consent (which prompt=consent enforces)
      refreshToken = tokenData.refresh_token || "";
      expiry = Date.now() + (tokenData.expires_in * 1000);

      // Fetch user's Google email address
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!profileRes.ok) {
        const errorText = await profileRes.text();
        console.error("Google Profile fetch failed:", errorText);
        return NextResponse.json({ success: false, error: `Failed to fetch profile: ${errorText}` }, { status: 400 });
      }

      const profileData = await profileRes.json();
      email = profileData.email;
    }

    // Encrypt tokens
    const encryptedAccess = encrypt(accessToken);
    const encryptedRefresh = encrypt(refreshToken);

    // Save connection state in User document
    const updateQuery: any = {
      "googleCalendarSettings.connected": true,
      "googleCalendarSettings.email": email,
      "googleCalendarSettings.accessToken": encryptedAccess,
      "googleCalendarSettings.expiry": expiry,
      "googleCalendarSettings.syncHealth": "healthy"
    };

    // Only update refresh token if we got a new one (sometimes Google doesn't return one if already approved)
    if (refreshToken) {
      updateQuery["googleCalendarSettings.refreshToken"] = encryptedRefresh;
    }

    await User.updateOne({ firebaseUid: user.firebaseUid }, { $set: updateQuery });

    // Redirect user back to settings screen
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/app?screen=settings`);
  } catch (error: any) {
    console.error("GET /api/auth/google/callback error:", error);
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/app?screen=settings&error=${encodeURIComponent(error.message)}`);
  }
}
