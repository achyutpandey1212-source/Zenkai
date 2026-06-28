import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { Task } from "@/models/Task";
import { CalendarSyncService } from "@/services/calendar-sync.service";
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

    // Fetch all tasks for this user with an active conflict
    const conflictedTasks = await Task.find({
      firebaseUid: user.firebaseUid,
      googleCalendarConflict: true
    }).select("_id title suggestedDate timeBlock googleCalendarConflictDetails").lean();

    return NextResponse.json({ success: true, conflicts: conflictedTasks });
  } catch (error: any) {
    console.error("GET /api/user/calendar/conflicts error:", error);
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
    const { taskId, resolution } = body;

    if (!taskId || !resolution || !["keep_google", "replace_with_zenkai"].includes(resolution)) {
      return NextResponse.json({ success: false, error: "Invalid request payload. Must supply taskId and resolution." }, { status: 400 });
    }

    await dbConnect();

    // Resolve conflict via Service
    const success = await CalendarSyncService.resolveConflict(user.firebaseUid, taskId, resolution);

    if (!success) {
      return NextResponse.json({ success: false, error: "Failed to resolve conflict" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/user/calendar/conflicts error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
