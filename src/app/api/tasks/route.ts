import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { TaskRepository } from "@/repositories/task.repository";

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

    const allTasks = await TaskRepository.findAllByUser(user.firebaseUid);
    
    // Filter active/todo tasks for pickers
    const activeTasks = allTasks.filter(t => t.status !== "completed" && t.status !== "skipped");

    return NextResponse.json({
      success: true,
      tasks: activeTasks,
      allTasks
    });
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
