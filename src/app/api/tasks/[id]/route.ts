import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { Task } from "@/models/Task";
import { PlanningAgent } from "@/agents/planning-agent";
import { dbConnect } from "@/lib/mongodb";
import { Types } from "mongoose";
import { BehaviorEngine } from "@/services/behavior-engine.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
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

    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid task ID" }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ success: false, error: "Status is required" }, { status: 400 });
    }

    await dbConnect();

    const updateFields: any = { status };
    if (status === "completed") {
      updateFields.completedAt = new Date();
    } else {
      updateFields.completedAt = null;
    }

    const updatedTask = await Task.findOneAndUpdate(
      { _id: new Types.ObjectId(id), firebaseUid: user.firebaseUid },
      { $set: updateFields },
      { returnDocument: "after" }
    );

    if (!updatedTask) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
    }

    // Trigger recursive progress recalculation
    await PlanningAgent.recalculateProgress(user.firebaseUid, id);

    // Notify BehaviorEngine
    if (status === "completed") {
      await BehaviorEngine.updateFromTaskCompletion(user.firebaseUid, id).catch(err =>
        console.error("[TaskPatchRoute] Failed to update behavior profile from completion:", err)
      );
    } else if (status === "skipped") {
      await BehaviorEngine.updateFromTaskSkip(user.firebaseUid, id).catch(err =>
        console.error("[TaskPatchRoute] Failed to update behavior profile from skip:", err)
      );
    }

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (error) {
    console.error("PATCH /api/tasks/[id] error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
