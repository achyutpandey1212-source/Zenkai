/**
 * POST /api/chat — Graph-Driven Chat Endpoint
 *
 * This file is now a thin adapter. All orchestration has moved to:
 *   src/orchestration/graphs/main.graph.ts
 *
 * Responsibilities of this route:
 * 1. Authenticate the user
 * 2. Parse the request body
 * 3. Resolve or create the conversation
 * 4. Build initial GraphState
 * 5. Set up ReadableStream and inject controller + encoder into state
 * 6. Invoke the main graph inside the stream controller
 * 7. Return the streaming response with identical headers as before
 *
 * The streaming protocol (\0{...}\0 control events) is preserved exactly —
 * the frontend does not change in any way.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { MessageRepository } from "@/repositories/message.repository";
import { createInitialState } from "@/orchestration/graph/state";
import { invokeMainGraph } from "@/orchestration/graphs/main.graph";
import { dbConnect } from "@/lib/mongodb";

// ── Route config ───────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";

// ── Workflow ID generator ──────────────────────────────────────────────────────
function generateWorkflowId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `wf_${timestamp}_${random}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // ── 1. Authenticate user ────────────────────────────────────────────────────
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // ── 2. Parse request body ───────────────────────────────────────────────────
    const body = await request.json();
    const { message } = body;
    let { conversationId } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }

    // ── 3. Ensure DB connection ─────────────────────────────────────────────────
    await dbConnect();

    // ── 4. Resolve or create conversation ──────────────────────────────────────
    let conversation;
    if (conversationId) {
      conversation = await MessageRepository.findConversationById(conversationId);
    }
    if (!conversation) {
      let initialTitle = "Zenkai Dialogue";
      const cleanMessage = message.trim();
      if (cleanMessage) {
        initialTitle = cleanMessage.length > 40 ? cleanMessage.slice(0, 40) + "..." : cleanMessage;
      }
      conversation = await MessageRepository.createConversation(user.firebaseUid, initialTitle);
      conversationId = conversation._id.toString();
    }

    // ── 5. Load conversation history ────────────────────────────────────────────
    const recentMessages = await MessageRepository.findRecentMessages(conversationId, 20);
    const history = recentMessages.map((msg) => ({
      role: msg.role === "user" ? ("user" as const) : ("model" as const),
      content: msg.content,
    }));

    // If this is the first message in this conversation, and the title is a generic placeholder, auto-rename it
    if (history.length === 0 && conversation) {
      if (conversation.title === "New Conversation" || conversation.title === "Zenkai Dialogue") {
        let newTitle = "Zenkai Dialogue";
        const cleanMessage = message.trim();
        if (cleanMessage) {
          newTitle = cleanMessage.length > 40 ? cleanMessage.slice(0, 40) + "..." : cleanMessage;
        }
        await MessageRepository.renameConversation(conversationId, newTitle).catch((err) => {
          console.error("[Chat API] Failed to auto-rename conversation:", err);
        });
      }
    }

    // ── 6. Persist user message ─────────────────────────────────────────────────
    await MessageRepository.addMessage(conversationId, "user", message);

    // ── 7. Generate workflow ID for this request ────────────────────────────────
    const workflowId = generateWorkflowId();
    console.log(`[Chat] New workflow: ${workflowId} | uid=${user.firebaseUid}`);

    // ── 8. Build streaming response ─────────────────────────────────────────────
    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          // Build initial graph state — inject controller and encoder
          // so nodes can stream directly without passing them around as arguments.
          const initialState = createInitialState({
            workflowId,
            uid: user.firebaseUid,
            conversationId,
            userMessage: message,
            history,
            streamController: controller,
            encoder,
          });

          // Invoke the main graph — this runs everything:
          // router → context → companion (streaming) → planning → execution → background → assembler
          await invokeMainGraph(initialState);

          // Graph assembler node closes the controller.
          // If it somehow didn't (error path), close here as safety net.
        } catch (err) {
          console.error(`[Chat][wf:${workflowId.slice(3, 11)}] Stream error:`, err);
          try {
            controller.error(err);
          } catch {
            // controller may already be closed
          }
        }
      },
    });

    return new Response(customStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "x-conversation-id": conversationId,
        // Expose workflow ID for debugging (visible in browser DevTools network tab)
        "x-workflow-id": workflowId,
      },
    });
  } catch (error) {
    console.error("POST /api/chat Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
