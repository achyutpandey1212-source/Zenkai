import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { User } from "@/models/User";
import { dbConnect } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
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

    // Fetch fresh user document from MongoDB
    const userDoc = await User.findOne({ firebaseUid: user.firebaseUid }).lean();
    if (!userDoc) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Safely structure settings (remove credentials)
    const settings = {
      briefSettings: userDoc.briefSettings || {
        morningBriefEnabled: true,
        eveningBriefEnabled: true,
        preferredMorningTime: "08:00",
        preferredEveningTime: "20:30",
        timezone: "UTC",
        emailFrequency: "daily",
      },
      googleCalendarSettings: userDoc.googleCalendarSettings
        ? {
            connected: userDoc.googleCalendarSettings.connected,
            email: userDoc.googleCalendarSettings.email || "",
            syncNewTasks: userDoc.googleCalendarSettings.syncNewTasks,
            updateTasks: userDoc.googleCalendarSettings.updateTasks,
            deleteTasksAutomatically: userDoc.googleCalendarSettings.deleteTasksAutomatically,
            lastSuccessfulSync: userDoc.googleCalendarSettings.lastSuccessfulSync,
            syncedEventsCount: userDoc.googleCalendarSettings.syncedEventsCount || 0,
            syncHealth: userDoc.googleCalendarSettings.syncHealth || "healthy",
            calendarSyncPending: userDoc.googleCalendarSettings.calendarSyncPending || false,
          }
        : {
            connected: false,
            email: "",
            syncNewTasks: true,
            updateTasks: true,
            deleteTasksAutomatically: false,
            syncedEventsCount: 0,
            syncHealth: "healthy",
            calendarSyncPending: false,
          },
    };

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error("GET /api/user/settings error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const { briefSettings, googleCalendarSettings } = body;

    await dbConnect();

    const updateFields: any = {};

    // 1. Map briefing settings changes if provided
    if (briefSettings) {
      if (briefSettings.morningBriefEnabled !== undefined) {
        updateFields["briefSettings.morningBriefEnabled"] = briefSettings.morningBriefEnabled;
      }
      if (briefSettings.eveningBriefEnabled !== undefined) {
        updateFields["briefSettings.eveningBriefEnabled"] = briefSettings.eveningBriefEnabled;
      }
      if (briefSettings.preferredMorningTime !== undefined) {
        updateFields["briefSettings.preferredMorningTime"] = briefSettings.preferredMorningTime;
      }
      if (briefSettings.preferredEveningTime !== undefined) {
        updateFields["briefSettings.preferredEveningTime"] = briefSettings.preferredEveningTime;
      }
      if (briefSettings.timezone !== undefined) {
        updateFields["briefSettings.timezone"] = briefSettings.timezone;
      }
      if (briefSettings.emailFrequency !== undefined) {
        updateFields["briefSettings.emailFrequency"] = briefSettings.emailFrequency;
      }
    }

    // 2. Map calendar settings changes (avoid modifying access/refresh tokens!)
    if (googleCalendarSettings) {
      if (googleCalendarSettings.syncNewTasks !== undefined) {
        updateFields["googleCalendarSettings.syncNewTasks"] = googleCalendarSettings.syncNewTasks;
      }
      if (googleCalendarSettings.updateTasks !== undefined) {
        updateFields["googleCalendarSettings.updateTasks"] = googleCalendarSettings.updateTasks;
      }
      if (googleCalendarSettings.deleteTasksAutomatically !== undefined) {
        updateFields["googleCalendarSettings.deleteTasksAutomatically"] = googleCalendarSettings.deleteTasksAutomatically;
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ success: true, message: "No changes to update" });
    }

    const updatedUser = await User.findOneAndUpdate(
      { firebaseUid: user.firebaseUid },
      { $set: updateFields },
      { new: true }
    ).lean();

    if (!updatedUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      settings: {
        briefSettings: updatedUser.briefSettings,
        googleCalendarSettings: updatedUser.googleCalendarSettings
          ? {
              connected: updatedUser.googleCalendarSettings.connected,
              email: updatedUser.googleCalendarSettings.email,
              syncNewTasks: updatedUser.googleCalendarSettings.syncNewTasks,
              updateTasks: updatedUser.googleCalendarSettings.updateTasks,
              deleteTasksAutomatically: updatedUser.googleCalendarSettings.deleteTasksAutomatically,
              lastSuccessfulSync: updatedUser.googleCalendarSettings.lastSuccessfulSync,
              syncedEventsCount: updatedUser.googleCalendarSettings.syncedEventsCount || 0,
              syncHealth: updatedUser.googleCalendarSettings.syncHealth || "healthy",
              calendarSyncPending: updatedUser.googleCalendarSettings.calendarSyncPending || false,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("POST /api/user/settings error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
