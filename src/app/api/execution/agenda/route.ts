import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { ExecutionAgent } from "@/agents/execution-agent";
import { DailyAgendaRepository } from "@/repositories/daily-agenda.repository";
import { dbConnect } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    // Determine target local date (YYYY-MM-DD)
    const clientDate = searchParams.get("date") || new Date().toISOString().split("T")[0];

    await dbConnect();

    // Fetch or generate the daily agenda
    const agenda = await ExecutionAgent.getOrCreateDailyAgenda(user.firebaseUid, clientDate);

    return NextResponse.json({
      success: true,
      agenda
    });
  } catch (error) {
    console.error("GET /api/execution/agenda error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
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
    const { date } = body;
    const targetDate = date || new Date().toISOString().split("T")[0];

    await dbConnect();

    // Force regeneration
    const agenda = await ExecutionAgent.getOrCreateDailyAgenda(user.firebaseUid, targetDate, true);

    return NextResponse.json({
      success: true,
      agenda
    });
  } catch (error) {
    console.error("POST /api/execution/agenda error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
