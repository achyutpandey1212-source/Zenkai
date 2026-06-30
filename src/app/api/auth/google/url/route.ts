import { NextResponse } from "next/server";
import { getPublicAppOrigin } from "@/lib/public-url";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = getPublicAppOrigin(request);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const isMock = !clientId;

    if (isMock) {
      // Mock Mode: redirect immediately to callback with mock code
      const mockCode = `mock-code-${Date.now()}`;
      const mockCallbackUrl = `${origin}/api/auth/google/callback?code=${mockCode}`;
      return NextResponse.json({ success: true, url: mockCallbackUrl, isMock: true });
    }

    const redirectUri = `${origin}/api/auth/google/callback`;
    const scopes = [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email"
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId || "");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");

    return NextResponse.json({ success: true, url: authUrl.toString(), isMock: false });
  } catch (error: any) {
    console.error("GET /api/auth/google/url error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
