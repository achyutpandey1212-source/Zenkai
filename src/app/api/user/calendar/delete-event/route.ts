import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { CalendarSyncService } from "@/services/calendar-sync.service";
import { dbConnect } from "@/lib/mongodb";

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
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json({ success: false, error: "Task ID is required" }, { status: 400 });
    }

    await dbConnect();

    // Call service to delete the event from Google Calendar and update Task document
    const success = await CalendarSyncService.deleteEventManually(user.firebaseUid, taskId);

    if (!success) {
      return NextResponse.json({ success: false, error: "Failed to delete event manually" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/user/calendar/delete-event error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
