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
import { PlanningAgent, LifeEventExtraction } from "@/agents/planning-agent";
import { Task } from "@/models/Task";
import { ExecutionAgent } from "@/agents/execution-agent";

// Mark this route as dynamic
export const dynamic = "force-dynamic";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// STREAMING PROTOCOL HELPERS
// Null-byte delimited control events injected into the text stream.
// Client parses \0{...}\0 segments for state; everything else is chat text.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function makeStatusEvent(stage: string, message: string): string {
  return `\0${JSON.stringify({ __type: "status", stage, message })}\0`;
}

function makePlanningCompleteEvent(stats: {
  milestonesCreated: number;
  tasksCreated: number;
  agendaBuilt: boolean;
}): string {
  return `\0${JSON.stringify({ __type: "planning_complete", stats })}\0`;
}

export async function POST(request: Request) {
  try {
    // â”€â”€ 1. Authenticate user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // â”€â”€ 2. Parse request body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const body = await request.json();
    const { message } = body;
    let { conversationId } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }

    // â”€â”€ 3. Resolve active conversation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let conversation;
    if (conversationId) {
      conversation = await MessageRepository.findConversationById(conversationId);
    }
    if (!conversation) {
      const conversations = await MessageRepository.findConversationsByUser(user.firebaseUid);
      if (conversations.length > 0) {
        conversation = conversations[0];
        conversationId = conversation._id.toString();
      }
    }
    if (!conversation) {
      conversation = await MessageRepository.createConversation(user.firebaseUid, "Zenkai Dialogue");
      conversationId = conversation._id.toString();
    }

    // â”€â”€ 4. Load context (parallel) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const recentMessages = await MessageRepository.findRecentMessages(conversationId, 20);
    const history = recentMessages.map((msg) => ({
      role: msg.role === "user" ? ("user" as const) : ("model" as const),
      content: msg.content,
    }));

    // Persist user message
    await MessageRepository.addMessage(conversationId, "user", message);

    // Load all context in parallel for speed
    const [memoryContext, activeTraits, activeReflections, profile, lifeEvents] = await Promise.all([
      MemoryAgent.retrieveForContext(user.firebaseUid, message),
      IdentityRepository.findActiveByUser(user.firebaseUid),
      ReflectionRepository.findActiveByUser(user.firebaseUid),
      ProfileRepository.findByFirebaseUid(user.firebaseUid),
      PlanningAgent.extractLifeEvents(message), // Every message is an opportunity for autonomous work
    ]);

    // â”€â”€ 5. Determine intent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const intent = await PlanningAgent.detectIntent(message, history, lifeEvents);
    console.log(`[ChatRoute] Intent: ${intent.type} | Life events suggest planning: ${lifeEvents.suggestsPlanning}`);

    // â”€â”€ 6. Format context for companion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const memoryPromptText = MemoryAgent.formatMemoriesForPrompt(memoryContext.memories);
    const identityPromptText = IdentityAgent.formatIdentityForPrompt(activeTraits);
    const reflectionPromptText = ReflectionAgent.formatReflectionsForPrompt(activeReflections);

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

    // â”€â”€ 7. Autonomous orchestration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const todayStr = new Date().toISOString().split("T")[0];
    let planningPromise: Promise<{ success: boolean; milestonesCreated: number; tasksCreated: number } | null> | null = null;
    let planPromptText = "";
    let planningTriggered = false;

    if (intent.type === "create_or_modify") {
      // Start planning as non-blocking background Promise â€” companion streams immediately
      planningTriggered = true;
      planningPromise = PlanningAgent.generateOrEvolvePlan(user.firebaseUid, intent, message, lifeEvents);
      console.log(`[ChatRoute] Planning started in background (non-blocking).`);

      planPromptText = `
## PROACTIVE PLANNING INSTRUCTION:
Zenkai is currently building the user's roadmap in the background while you respond.

Your response MUST:
1. Acknowledge what the user shared naturally (their goals, exams, timeline, etc.).
2. Tell them that you've already started preparing their roadmap and today's schedule.
3. Invite them to explore their Plans screen to see the full roadmap once ready.
4. DO NOT ask follow-up questions. DO NOT say "how would you like to approach this?". Act like an executive assistant who got to work immediately.
5. Feel proactive, calm, and confident. You have already understood the situation and acted.

Life signals detected: ${lifeEvents.extractionReason || "Planning intent confirmed."}
`;
    } else if (intent.type === "task_update") {
      // Guard: taskTitle must be non-empty (already validated in detectIntent, but double-check)
      if (intent.taskTitle?.trim()) {
        console.log(`[ChatRoute] task_update intent. Searching for task: "${intent.taskTitle}"`);
        const tasks = await Task.find({
          firebaseUid: user.firebaseUid,
          title: { $regex: new RegExp(intent.taskTitle.trim(), "i") },
        });
        if (tasks.length > 0) {
          const targetTask = tasks[0];
          const newStatus = intent.taskStatus || "completed";
          await Task.findByIdAndUpdate(targetTask._id, {
            $set: {
              status: newStatus,
              completedAt: newStatus === "completed" ? new Date() : null,
            },
          });
          await PlanningAgent.recalculateProgress(user.firebaseUid, targetTask._id.toString());
          planPromptText = `
## Task Progress Update:
You have just marked the task "${targetTask.title}" as "${newStatus}".
Naturally acknowledge this completion, celebrate their progress briefly, and mention what's likely next based on their plan.
`;
        }
      }
    } else if (intent.type === "execution_inquiry") {
      console.log(`[ChatRoute] execution_inquiry intent. Fetching today's daily agenda.`);
      try {
        const agenda = await ExecutionAgent.getOrCreateDailyAgenda(user.firebaseUid, todayStr);
        if (agenda) {
          // Fix: Hydrate task documents from IDs before formatting
          const formattedBlocks = await Promise.all(
            agenda.workBlocks.map(async (wb: any) => {
              const taskIds = wb.tasks.map((t: any) => t._id || t);
              const taskDocs = taskIds.length > 0
                ? await Task.find({ _id: { $in: taskIds } }).lean()
                : [];
              const taskTitles = taskDocs
                .map((t: any) => `- ${t.title} (${t.status})`)
                .join("\n");
              return `Block: ${wb.title} (${wb.startTime} - ${wb.endTime})\nTasks:\n${taskTitles || "No tasks scheduled"}`;
            })
          );

          // Hydrate optional tasks and stretch goals
          const optionalTaskIds = agenda.optionalTasks.map((t: any) => t._id || t);
          const stretchGoalIds = agenda.stretchGoals.map((t: any) => t._id || t);
          const [optionalDocs, stretchDocs] = await Promise.all([
            optionalTaskIds.length > 0 ? Task.find({ _id: { $in: optionalTaskIds } }).lean() : Promise.resolve([]),
            stretchGoalIds.length > 0 ? Task.find({ _id: { $in: stretchGoalIds } }).lean() : Promise.resolve([]),
          ]);

          planPromptText = `
## Today's Daily Agenda (Execution Plan):
Date: ${agenda.date}
Intention: "${agenda.intention}"
Focus: "${agenda.focus}"

Suggested Work Blocks & Tasks:
${formattedBlocks.join("\n\n")}

Optional Tasks:
${optionalDocs.map((t: any) => `- ${t.title} (${t.status})`).join("\n") || "None"}

Stretch Goals:
${stretchDocs.map((t: any) => `- ${t.title} (${t.status})`).join("\n") || "None"}

Estimated Focus Time: ${agenda.estimatedFocusTime} minutes
Current Priority: ${agenda.currentPriority}
Upcoming Deadline: ${agenda.upcomingDeadline}
Execution Reasoning: "${agenda.executionReasoning}"

INSTRUCTIONS FOR COMPANION AGENT:
- Address the user's execution query by explaining what is on their agenda today.
- Reference their intention, focus, work blocks, and task priorities.
- Do NOT talk about long-term roadmaps. Keep attention on "Today's Agenda".
- Speak naturally. Do NOT say "according to the execution agent" or "your daily agenda".
`;
        }
      } catch (err) {
        console.error("[ChatRoute] Failed to inject daily agenda context:", err);
      }
    }

    // â”€â”€ 8. Stream companion response â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const geminiStream = await GeminiService.generateCompanionStreamWithMemory(
      message,
      history,
      memoryPromptText,
      identityPromptText,
      profilePromptText,
      reflectionPromptText,
      planPromptText
    );

    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          // Emit initial status event
          if (planningTriggered) {
            controller.enqueue(encoder.encode(makeStatusEvent("building_plan", "Building your roadmap...")));
          } else if (intent.type === "execution_inquiry") {
            controller.enqueue(encoder.encode(makeStatusEvent("scheduling", "Loading your agenda...")));
          } else {
            controller.enqueue(encoder.encode(makeStatusEvent("understanding", "Understanding your situation...")));
          }

          let accumulatedText = "";

          // Stream companion response chunks
          for await (const chunk of geminiStream) {
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

          // â”€â”€ 9. After stream: await planning result (if triggered) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          let planningStats: { milestonesCreated: number; tasksCreated: number; agendaBuilt: boolean } | null = null;

          if (planningPromise) {
            controller.enqueue(encoder.encode(makeStatusEvent("building_plan", "Finalizing your roadmap...")));
            const planResult = await planningPromise;

            if (planResult?.success) {
              // Execution handoff: force-regenerate today's agenda with new plan data
              let agendaBuilt = false;
              try {
                controller.enqueue(encoder.encode(makeStatusEvent("scheduling", "Scheduling today's work...")));
                await ExecutionAgent.getOrCreateDailyAgenda(user.firebaseUid, todayStr, true);
                agendaBuilt = true;
                console.log(`[ChatRoute] Execution handoff complete. Today's agenda regenerated.`);
              } catch (agendaErr) {
                console.error("[ChatRoute] Execution handoff failed:", agendaErr);
              }

              planningStats = {
                milestonesCreated: planResult.milestonesCreated,
                tasksCreated: planResult.tasksCreated,
                agendaBuilt,
              };

              // Emit planning complete event for frontend to render Summary Card
              controller.enqueue(encoder.encode(makePlanningCompleteEvent(planningStats)));
            }
          }

          // â”€â”€ 10. Persist assistant message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          if (accumulatedText.trim()) {
            const assistantMsg = await MessageRepository.addMessage(conversationId, "assistant", accumulatedText);

            // Background pipeline: memory, identity, reflection (fire-and-forget)
            (async () => {
              try {
                const newMemory = await MemoryAgent.evaluateAndStore(
                  user.firebaseUid,
                  message,
                  accumulatedText,
                  conversationId,
                  assistantMsg._id.toString()
                );
                if (newMemory) {
                  console.log(`[MemoryAgent] Admitted new memory: ${newMemory._id}`);
                }

                const evolvedTraits = await IdentityAgent.evaluateAndEvolve(user.firebaseUid);
                if (evolvedTraits) {
                  console.log(`[IdentityAgent] Evolved identity for: ${user.firebaseUid}`);
                }

                const evolvedReflections = await ReflectionAgent.evaluateAndEvolve(user.firebaseUid);
                if (evolvedReflections) {
                  console.log(`[ReflectionAgent] Evolved reflections for: ${user.firebaseUid}`);
                }
              } catch (err) {
                console.error("[Background Pipeline] Error:", err);
              }
            })();
          }

          controller.close();
        } catch (err) {
          console.error("[ChatRoute] Stream error:", err);
          controller.error(err);
        }
      },
    });

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
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
