import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { DailyAgendaRepository } from "@/repositories/daily-agenda.repository";
import { CalendarSyncService } from "@/services/calendar-sync.service";
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

    // Determine the user's timezone and today's date string
    const userDoc = await User.findOne({ firebaseUid: user.firebaseUid }).lean();
    if (!userDoc || !userDoc.googleCalendarSettings?.connected) {
      return NextResponse.json({ success: false, error: "Google Calendar not connected" }, { status: 400 });
    }

    const timezone = userDoc.briefSettings?.timezone || "UTC";
    const localDateStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone }); // returns YYYY-MM-DD format

    // Find the daily agenda for today
    const agenda = await DailyAgendaRepository.findByUserAndDate(user.firebaseUid, localDateStr);
    if (!agenda) {
      return NextResponse.json({ success: false, error: `No daily agenda exists for today (${localDateStr}) to sync.` }, { status: 404 });
    }

    // Trigger calendar sync synchronously (bypassing debounce)
    console.log(`[ManualSyncApi] Running manual sync for ${user.firebaseUid} on ${localDateStr}`);
    const result = await CalendarSyncService.syncAgenda(user.firebaseUid, agenda);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || "Sync pass failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, stats: result });
  } catch (error: any) {
    console.error("POST /api/auth/google/sync error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
