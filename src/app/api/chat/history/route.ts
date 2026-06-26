import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { MessageRepository } from "@/repositories/message.repository";

// Mark this route as dynamic
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Authenticate user
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

    // 2. Fetch the most recent conversation for the user
    const conversations = await MessageRepository.findConversationsByUser(user.firebaseUid);

    if (conversations.length === 0) {
      return NextResponse.json({
        success: true,
        conversation: null,
        messages: [],
      });
    }

    // Use the latest conversation
    const activeConversation = conversations[0];
    const conversationId = activeConversation._id.toString();

    // 3. Load all messages in chronological order
    const messages = await MessageRepository.findMessagesByConversation(conversationId);

    return NextResponse.json({
      success: true,
      conversation: activeConversation,
      messages: messages,
    });
  } catch (error: any) {
    console.error("GET /api/chat/history Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
