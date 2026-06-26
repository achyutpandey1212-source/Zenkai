import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { MessageRepository } from "@/repositories/message.repository";

export const dynamic = "force-dynamic";

export async function GET() {
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

    const conversations = await MessageRepository.findConversationsByUser(user.firebaseUid);
    return NextResponse.json({ success: true, conversations });
  } catch (error) {
    console.error("GET /api/conversations error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    let title = "New Conversation";
    try {
      const body = await request.json();
      if (body.title) {
        title = body.title;
      }
    } catch {
      // Body might be empty or invalid JSON, fall back to default title
    }

    const conversation = await MessageRepository.createConversation(user.firebaseUid, title);
    return NextResponse.json({ success: true, conversation });
  } catch (error) {
    console.error("POST /api/conversations error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
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

    const body = await request.json();
    const { id, title } = body;

    if (!id || !title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: "id and title are required" },
        { status: 400 }
      );
    }

    // Verify conversation belongs to user
    const conv = await MessageRepository.findConversationById(id);
    if (!conv || conv.firebaseUid !== user.firebaseUid) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    const updated = await MessageRepository.renameConversation(id, title.trim());
    return NextResponse.json({ success: true, conversation: updated });
  } catch (error) {
    console.error("PATCH /api/conversations error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
