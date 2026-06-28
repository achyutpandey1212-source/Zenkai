import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { User } from "@/models/User";
import { dbConnect } from "@/lib/mongodb";

export async function POST() {
  try {
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

    // Clear all google calendar settings from user document
    await User.updateOne(
      { firebaseUid: user.firebaseUid },
      {
        $set: {
          "googleCalendarSettings.connected": false,
          "googleCalendarSettings.email": "",
          "googleCalendarSettings.accessToken": "",
          "googleCalendarSettings.refreshToken": "",
          "googleCalendarSettings.expiry": 0,
          "googleCalendarSettings.syncHealth": "healthy",
          "googleCalendarSettings.syncedEventsCount": 0
        }
      }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/auth/google/disconnect error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
