import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { MemoryRepository } from "@/repositories/memory.repository";

export const dynamic = "force-dynamic";

export async function GET() {
  // Gate debug route to development mode only
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { success: false, error: "Forbidden in production environment" },
      { status: 403 }
    );
  }

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const memories = await MemoryRepository.findAllByUserDebug(user.firebaseUid);
    return NextResponse.json({ success: true, memories });
  } catch (error) {
    console.error("GET /api/memory/debug error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  // Gate debug route to development mode only
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { success: false, error: "Forbidden in production environment" },
      { status: 403 }
    );
  }

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearAll = searchParams.get("all");

    if (clearAll === "true") {
      await MemoryRepository.deleteAllByUser(user.firebaseUid);
      return NextResponse.json({ success: true, message: "All memories cleared successfully" });
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Memory ID or 'all=true' is required" },
        { status: 400 }
      );
    }

    await MemoryRepository.delete(id);
    return NextResponse.json({ success: true, message: "Memory deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/memory/debug error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
