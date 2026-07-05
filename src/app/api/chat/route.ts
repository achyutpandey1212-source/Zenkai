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
import { PendingActionService } from "@/services/pending-action.service";
import { CommandParser } from "@/lib/command-parser";
import { CommandDispatcher } from "@/lib/command-dispatcher";

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

// In-memory concurrency locks map
const activeLocks = new Map<string, { workflowId: string; timestamp: number }>();

export async function POST(request: Request) {
  let lockAcquired = false;
  let parsedConversationId = "";
  const workflowId = generateWorkflowId();

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

    parsedConversationId = conversationId || "";

    // ── Concurrency Lock Check ──
    if (conversationId) {
      const existingLock = activeLocks.get(conversationId);
      if (existingLock && Date.now() - existingLock.timestamp < 30000) {
        console.warn(`[Concurrency Lock] Concurrent request blocked for conversation ${conversationId}. Workflow ${existingLock.workflowId} is active.`);
        
        const encoder = new TextEncoder();
        const customStream = new ReadableStream({
          start(controller) {
            const status1 = `\0${JSON.stringify({ __type: "status", agent: "planning", status: "running", message: "Still working..." })}\0`;
            const status2 = `\0${JSON.stringify({ __type: "status", agent: "execution", status: "running", message: "We're reorganizing your schedule..." })}\0`;
            const textChunk = "Still working... We are reorganizing your schedule and finishing your request. Please wait a moment.";
            
            controller.enqueue(encoder.encode(status1));
            controller.enqueue(encoder.encode(status2));
            controller.enqueue(encoder.encode(textChunk));
            controller.close();
          }
        });
        
        return new Response(customStream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Transfer-Encoding": "chunked",
            "x-conversation-id": conversationId,
          },
        });
      }

      // Acquire Lock
      activeLocks.set(conversationId, { workflowId, timestamp: Date.now() });
      lockAcquired = true;
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
      parsedConversationId = conversationId;
      
      // If we just created the conversation, update the lock map with the new conversation ID
      activeLocks.set(conversationId, { workflowId, timestamp: Date.now() });
      lockAcquired = true;
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

    console.log(`[Chat] New workflow: ${workflowId} | uid=${user.firebaseUid}`);

    // ── 6a. Check for Slash Command ─────────────────────────────────────────────
    if (CommandParser.isCommand(message)) {
      console.log(`[Command] Detected command message: ${message}`);
      const parsed = CommandParser.parse(message);
      const encoder = new TextEncoder();

      const customStream = new ReadableStream({
        async start(controller) {
          try {
            if (!parsed) {
              const statusEvent = `\0${JSON.stringify({
                __type: "status",
                agent: "execution",
                status: "skipped",
                message: "Invalid command syntax."
              })}\0`;
              controller.enqueue(encoder.encode(statusEvent));
              const reply = "Sorry, that command syntax was not recognized. Please type `/` to see the available commands.";
              await MessageRepository.addMessage(parsedConversationId, "assistant", reply);
              controller.enqueue(encoder.encode(reply));
              controller.close();
              return;
            }

            // Stream running status
            const category = parsed.commandId.split(".")[0];
            const startStatus = `\0${JSON.stringify({
              __type: "status",
              agent: category,
              status: "running",
              message: `Executing ${parsed.commandId}...`
            })}\0`;
            controller.enqueue(encoder.encode(startStatus));

            // Dispatch command
            const result = await CommandDispatcher.dispatch(
              user.firebaseUid,
              parsed.commandId,
              parsed.args,
              parsedConversationId
            );

            // Stream completion status
            const finalStatus = `\0${JSON.stringify({
              __type: "status",
              agent: category,
              status: result.success ? "completed" : "skipped",
              message: result.success ? "Success" : result.message
            })}\0`;
            controller.enqueue(encoder.encode(finalStatus));

            // Persist output message to database
            await MessageRepository.addMessage(parsedConversationId, "assistant", result.message);

            // Stream final text chunk
            controller.enqueue(encoder.encode(result.message));
            controller.close();
          } catch (err: any) {
            console.error("[Command] Critical route failure:", err);
            const errReply = "An error occurred during command execution.";
            controller.enqueue(encoder.encode(errReply));
            controller.close();
          } finally {
            if (lockAcquired && parsedConversationId) {
              activeLocks.delete(parsedConversationId);
            }
          }
        }
      });

      return new Response(customStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "x-conversation-id": conversationId,
          "x-workflow-id": workflowId,
        },
      });
    }

    // ── 7. Load pending action for conversation ────────────────────────────────────
    const pendingAction = await PendingActionService.getActive(conversationId);
    if (pendingAction) {
      console.log(`[Chat] Loaded pending action: ${pendingAction.type}`);
    }

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
            conversationId: parsedConversationId,
            userMessage: message,
            history,
            streamController: controller,
            encoder,
            pendingAction: pendingAction,
          });

          // Invoke the main graph
          await invokeMainGraph(initialState);
        } catch (err) {
          console.error(`[Chat][wf:${workflowId.slice(3, 11)}] Stream error:`, err);
          try {
            // Mask raw error with a premium message
            const fallbackText = "\n\nWe couldn't finish that right now. Retrying calendar synchronization... Please try again in a few moments.";
            controller.enqueue(encoder.encode(fallbackText));
            controller.close();
          } catch {
            // controller may already be closed
          }
        } finally {
          if (lockAcquired && parsedConversationId) {
            activeLocks.delete(parsedConversationId);
          }
        }
      },
    });

    return new Response(customStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "x-conversation-id": conversationId,
        "x-workflow-id": workflowId,
      },
    });
  } catch (error) {
    console.error("POST /api/chat Error:", error);
    if (lockAcquired && parsedConversationId) {
      activeLocks.delete(parsedConversationId);
    }
    // Return premium message
    return NextResponse.json({ 
      success: false, 
      error: "We couldn't finish that right now. Please try again in a few moments." 
    }, { status: 500 });
  }
}
