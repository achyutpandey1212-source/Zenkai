import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { MessageRepository } from "@/repositories/message.repository";
import { PendingActionService } from "@/services/pending-action.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const paramConversationId = searchParams.get("conversationId");

    let activeConversation = null;

    if (paramConversationId) {
      activeConversation = await MessageRepository.findConversationById(paramConversationId);
    } else {
      // Fetch the most recent conversation for the user
      const conversations = await MessageRepository.findConversationsByUser(user.firebaseUid);
      if (conversations.length > 0) {
        const latestConv = conversations[0];
        
        // Inactivity check: 2 hours (2 * 60 * 60 * 1000 ms)
        const lastUpdated = new Date(latestConv.updatedAt).getTime();
        const inactiveTime = Date.now() - lastUpdated;
        
        if (inactiveTime <= 2 * 60 * 60 * 1000) {
          activeConversation = latestConv;
        }
      }
    }

    if (!activeConversation) {
      return NextResponse.json({
        success: true,
        conversation: null,
        messages: [],
      });
    }

    const conversationId = activeConversation._id.toString();

    // 3. Load all messages in chronological order
    const messages = await MessageRepository.findMessagesByConversation(conversationId);

    // 4. Load active pending action
    const pendingAction = await PendingActionService.getActive(conversationId);

    return NextResponse.json({
      success: true,
      conversation: activeConversation,
      messages: messages,
      pendingAction: pendingAction
    });
  } catch (error) {
    console.error("GET /api/chat/history Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
