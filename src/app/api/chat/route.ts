import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { MessageRepository } from "@/repositories/message.repository";
import { GeminiService } from "@/services/gemini.service";
import { MemoryAgent } from "@/agents/memory-agent";
import { IdentityRepository } from "@/repositories/identity.repository";
import { IdentityAgent } from "@/agents/identity-agent";

// Mark this route as dynamic
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

    // 2. Parse request body
    const body = await request.json();
    const { message } = body;
    let { conversationId } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    // 3. Resolve active conversation
    let conversation;
    if (conversationId) {
      conversation = await MessageRepository.findConversationById(conversationId);
    }

    // Fallback: Resume the most recent conversation if no valid conversationId was supplied
    if (!conversation) {
      const conversations = await MessageRepository.findConversationsByUser(user.firebaseUid);
      if (conversations.length > 0) {
        conversation = conversations[0];
        conversationId = conversation._id.toString();
      }
    }

    // Still no conversation? Create one.
    if (!conversation) {
      conversation = await MessageRepository.createConversation(user.firebaseUid, "Zenkai Dialogue");
      conversationId = conversation._id.toString();
    }

    // 4. Load recent message history for LLM context (up to 20 messages)
    const recentMessages = await MessageRepository.findRecentMessages(conversationId, 20);
    const history = recentMessages.map((msg) => ({
      role: msg.role === "user" ? ("user" as const) : ("model" as const),
      content: msg.content,
    }));

    // 5. Persist the new user message to MongoDB
    await MessageRepository.addMessage(conversationId, "user", message);

    // 6. Retrieve relevant long-term memories, active identity traits, and format for prompt
    const memoryContext = await MemoryAgent.retrieveForContext(user.firebaseUid, message);
    const memoryPromptText = MemoryAgent.formatMemoriesForPrompt(memoryContext.memories);
    
    const activeTraits = await IdentityRepository.findActiveByUser(user.firebaseUid);
    const identityPromptText = IdentityAgent.formatIdentityForPrompt(activeTraits);

    // 7. Call Gemini streaming API with memory and identity context
    const geminiStream = await GeminiService.generateCompanionStreamWithMemory(message, history, memoryPromptText, identityPromptText);

    // 8. Create a ReadableStream to stream chunks back to client
    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          let accumulatedText = "";
          
          for await (const chunk of geminiStream) {
            // Defensive reading of chunk text content
            let chunkText = "";
            if (typeof chunk.text === "function") {
              chunkText = (chunk.text as Function)();
            } else if (typeof chunk.text === "string") {
              chunkText = chunk.text;
            } else if ((chunk as any).candidates?.[0]?.content?.parts?.[0]?.text) {
              chunkText = (chunk as any).candidates[0].content.parts[0].text;
            }

            if (chunkText) {
              accumulatedText += chunkText;
              controller.enqueue(encoder.encode(chunkText));
            }
          }

          // 9. Once stream completes successfully, persist model response to DB
          if (accumulatedText.trim()) {
            const assistantMsg = await MessageRepository.addMessage(conversationId, "assistant", accumulatedText);
            
            // Post-chat Memory Evaluation (Non-blocking background task)
            MemoryAgent.evaluateAndStore(user.firebaseUid, message, accumulatedText, conversationId, assistantMsg._id.toString())
              .then((newMemory) => {
                if (newMemory) {
                  console.log(`[MemoryAgent] Successfully admitted new memory: ${newMemory._id}`);
                  // Post-memory Identity Evaluation (Non-blocking background task)
                  IdentityAgent.evaluateAndEvolve(user.firebaseUid)
                    .then((evolved) => {
                      if (evolved) {
                        console.log(`[IdentityAgent] Successfully evolved identity traits for: ${user.firebaseUid}`);
                      }
                    })
                    .catch((err) => {
                      console.error("[IdentityAgent] Error in background evolution:", err);
                    });
                }
              })
              .catch((err) => {
                console.error("[MemoryAgent] Error in background evaluation/store:", err);
              });
          }

          controller.close();
        } catch (err) {
          console.error("Error reading Gemini response stream:", err);
          controller.error(err);
        }
      },
    });

    // 9. Return the stream response with conversation ID in headers
    return new Response(customStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "x-conversation-id": conversationId,
      },
    });
  } catch (error) {
    console.error("POST /api/chat Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
