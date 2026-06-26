import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import { MessageRepository } from "@/repositories/message.repository";
import { GeminiService } from "@/services/gemini.service";
import { MemoryAgent } from "@/agents/memory-agent";
import { IdentityRepository } from "@/repositories/identity.repository";
import { IdentityAgent } from "@/agents/identity-agent";
import { ProfileRepository } from "@/repositories/profile.repository";
import { ReflectionRepository } from "@/repositories/reflection.repository";
import { ReflectionAgent } from "@/agents/reflection-agent";
import { PlanningAgent } from "@/agents/planning-agent";
import { PlanRepository } from "@/repositories/plan.repository";
import { Task } from "@/models/Task";

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

    // 5b. Detect planning/task update intent
    const intent = await PlanningAgent.detectIntent(message, history);
    let planHeaderValue = "false";
    let planPromptText = "";

    if (intent.type === "create_or_modify") {
      console.log(`[ChatRoute] Detected create_or_modify intent. Running PlanningAgent.`);
      const success = await PlanningAgent.generateOrEvolvePlan(user.firebaseUid, intent, message);
      if (success) {
        planHeaderValue = "true";
        // Fetch newly created/evolved plan to pass to Companion Agent
        const plans = await PlanRepository.findFullTree(user.firebaseUid);
        if (plans.length > 0) {
          planPromptText = `
## Zenkai Planning Engine generated/updated roadmap:
You have just successfully generated/updated the user's roadmap:
${JSON.stringify(plans[0], null, 2)}
Your companion response should naturally reference this generation or update. Explain what milestones you've laid out or adjusted, and encourage them. Remind them that they can see the full roadmap in the Plans screen.
`;
        }
      }
    } else if (intent.type === "task_update") {
      console.log(`[ChatRoute] Detected task_update intent. Searching for task: ${intent.taskTitle}`);
      // Find task matching title (case-insensitive search)
      const tasks = await Task.find({
        firebaseUid: user.firebaseUid,
        title: { $regex: new RegExp(intent.taskTitle || "", "i") }
      });
      if (tasks.length > 0) {
        const targetTask = tasks[0];
        const newStatus = intent.taskStatus || "completed";
        await Task.findByIdAndUpdate(targetTask._id, {
          $set: {
            status: newStatus,
            completedAt: newStatus === "completed" ? new Date() : null
          }
        });
        await PlanningAgent.recalculateProgress(user.firebaseUid, targetTask._id.toString());
        planHeaderValue = "updated";
        planPromptText = `
## Zenkai Planning Engine Task Update:
You have just marked the task "${targetTask.title}" as "${newStatus}".
Your companion response should naturally acknowledge this completion or update, celebrate their progress, and discuss what priorities or milestones are next in line.
`;
      }
    }

    // 6. Retrieve relevant long-term memories, active identity traits, active reflections and format for prompt
    const memoryContext = await MemoryAgent.retrieveForContext(user.firebaseUid, message);
    const memoryPromptText = MemoryAgent.formatMemoriesForPrompt(memoryContext.memories);
    
    const activeTraits = await IdentityRepository.findActiveByUser(user.firebaseUid);
    const identityPromptText = IdentityAgent.formatIdentityForPrompt(activeTraits);

    const activeReflections = await ReflectionRepository.findActiveByUser(user.firebaseUid);
    const reflectionPromptText = ReflectionAgent.formatReflectionsForPrompt(activeReflections);

    // Retrieve onboarding profile to provide foundational goals/profession context
    const profile = await ProfileRepository.findByFirebaseUid(user.firebaseUid);
    let profilePromptText = "";
    if (profile) {
      profilePromptText = `
## User Foundational Profile (from Onboarding)
- **Profession**: ${profile.profession}
- **Long-term Goal**: ${profile.longTermGoal}
- **Current Focus**: ${profile.currentFocus}
${profile.motivation ? `- **Motivation**: ${profile.motivation}` : ""}
${profile.dailyAvailability ? `- **Daily Availability**: ${profile.dailyAvailability}` : ""}
${profile.workStyle ? `- **Working Style**: ${profile.workStyle}` : ""}
${profile.biggestChallenge ? `- **Biggest Challenge**: ${profile.biggestChallenge}` : ""}
`.trim();
    }

    // 7. Call Gemini streaming API with profile, memory, identity, reflection, and plan context
    const geminiStream = await GeminiService.generateCompanionStreamWithMemory(
      message,
      history,
      memoryPromptText,
      identityPromptText,
      profilePromptText,
      reflectionPromptText,
      planPromptText
    );

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
            
            // Post-chat background execution pipeline
            (async () => {
              try {
                // a. Memory Evaluation & Storage
                const newMemory = await MemoryAgent.evaluateAndStore(user.firebaseUid, message, accumulatedText, conversationId, assistantMsg._id.toString());
                if (newMemory) {
                  console.log(`[MemoryAgent] Successfully admitted new memory: ${newMemory._id}`);
                }
                
                // b. Identity Evolution
                const evolvedTraits = await IdentityAgent.evaluateAndEvolve(user.firebaseUid);
                if (evolvedTraits) {
                  console.log(`[IdentityAgent] Successfully evolved identity traits for: ${user.firebaseUid}`);
                }

                // c. Reflection Evaluation & Storage
                const evolvedReflections = await ReflectionAgent.evaluateAndEvolve(user.firebaseUid);
                if (evolvedReflections) {
                  console.log(`[ReflectionAgent] Successfully evolved reflections for: ${user.firebaseUid}`);
                }
              } catch (err) {
                console.error("[Background Pipeline] Error during post-chat evaluation sequence:", err);
              }
            })();
          }

          controller.close();
        } catch (err) {
          console.error("Error reading Gemini response stream:", err);
          controller.error(err);
        }
      },
    });

    // 9. Return the stream response with conversation ID and plan headers
    return new Response(customStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "x-conversation-id": conversationId,
        "x-plan-generated": planHeaderValue,
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
