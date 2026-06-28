import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { DailyAgendaRepository } from "@/repositories/daily-agenda.repository";
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

    // 1. Load user's timezone to calculate local today YYYY-MM-DD
    const userDoc = await User.findOne({ firebaseUid: user.firebaseUid }).lean();
    if (!userDoc || !userDoc.googleCalendarSettings?.connected) {
      return NextResponse.json({ success: true, tasks: [] }); // Not connected -> no tasks
    }

    const timezone = userDoc.briefSettings?.timezone || "UTC";
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD

    // 2. Fetch today's Daily Agenda
    const agenda = await DailyAgendaRepository.findByUserAndDate(user.firebaseUid, todayStr);
    if (!agenda) {
      return NextResponse.json({ success: true, tasks: [] }); // No agenda -> no disappeared tasks
    }

    // Collect all task IDs currently scheduled in today's work blocks
    const scheduledTaskIds = new Set<string>();
    agenda.workBlocks.forEach(block => {
      block.tasks.forEach(tid => scheduledTaskIds.add(tid.toString()));
    });

    // 3. Find tasks that have a googleCalendarEventId and suggestedDate = today
    // but are NOT in the active scheduled list, and are not completed.
    const disappeared = await Task.find({
      firebaseUid: user.firebaseUid,
      googleCalendarEventId: { $ne: "", $exists: true },
      suggestedDate: todayStr,
      _id: { $nin: Array.from(scheduledTaskIds) },
      status: { $ne: "completed" }
    }).select("_id title suggestedDate googleCalendarEventId").lean();

    return NextResponse.json({ success: true, tasks: disappeared });
  } catch (error: any) {
    console.error("GET /api/user/calendar/disappeared-tasks error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
