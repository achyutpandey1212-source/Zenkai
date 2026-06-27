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
import { Milestone } from "@/models/Milestone";
import { ExecutionAgent } from "@/agents/execution-agent";

// Mark this route as dynamic
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// STREAMING PROTOCOL HELPERS
// Null-byte delimited control events injected into the text stream.
// Client parses \0{...}\0 segments for state; everything else is chat text.
// ─────────────────────────────────────────────────────────────────────────────
function makeStatusEvent(
  agent: "memory" | "planning" | "execution" | "identity" | "reflection",
  status: "idle" | "running" | "completed" | "skipped",
  message: string
): string {
  return `\0${JSON.stringify({ __type: "status", agent, status, message })}\0`;
}

export async function POST(request: Request) {
  try {
    // ── 1. Authenticate user ──────────────────────────────────────────────────
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // ── 2. Parse request body ─────────────────────────────────────────────────
    const body = await request.json();
    const { message } = body;
    let { conversationId } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }

    // ── 3. Resolve active conversation ────────────────────────────────────────
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

    // ── 4. Load context (parallel) ────────────────────────────────────────────
    const recentMessages = await MessageRepository.findRecentMessages(conversationId, 20);
    const history = recentMessages.map((msg) => ({
      role: msg.role === "user" ? ("user" as const) : ("model" as const),
      content: msg.content,
    }));

    // Persist user message
    await MessageRepository.addMessage(conversationId, "user", message);

    // ── 5. Setup encoder and stream channels ──────────────────────────────────
    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          // Expose Memory Agent: retrieval phase starts
          controller.enqueue(
            encoder.encode(makeStatusEvent("memory", "running", "Remembering important details..."))
          );

          // Load all context in parallel for speed
          const [memoryContext, activeTraits, activeReflections, profile, lifeEvents] = await Promise.all([
            MemoryAgent.retrieveForContext(user.firebaseUid, message),
            IdentityRepository.findActiveByUser(user.firebaseUid),
            ReflectionRepository.findActiveByUser(user.firebaseUid),
            ProfileRepository.findByFirebaseUid(user.firebaseUid),
            PlanningAgent.extractLifeEvents(message),
          ]);

          // Expose Memory Agent: retrieval completed
          controller.enqueue(
            encoder.encode(makeStatusEvent("memory", "completed", "Remembered key details from conversation history."))
          );

          // ── 6. Determine planning / execution intent ────────────────────────────
          const intent = await PlanningAgent.detectIntent(message, history, lifeEvents);
          console.log(`[ChatRoute] Intent: ${intent.type} | Life events suggest planning: ${lifeEvents.suggestsPlanning}`);

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

          // ── 7. Fork background planning ─────────────────────────────────────────
          const todayStr = new Date().toISOString().split("T")[0];
          let planningPromise: Promise<{ success: boolean; milestonesCreated: number; tasksCreated: number } | null> | null = null;
          let planPromptText = "";
          let planningTriggered = false;

          if (intent.type === "create_or_modify") {
            planningTriggered = true;
            controller.enqueue(
              encoder.encode(makeStatusEvent("planning", "running", "Designing your roadmap..."))
            );
            planningPromise = PlanningAgent.generateOrEvolvePlan(user.firebaseUid, intent, message, lifeEvents);

            planPromptText = `
## PROACTIVE OUTCOME-BASED PLANNING INSTRUCTION:
Zenkai is currently building the user's roadmap in the background while you respond.

Your response MUST focus purely on OUTCOMES and reducing mental burden.
- Do NOT say "I updated your roadmap" or "Planning agent has started".
- Speak in terms of real-life relief:
  - "Everything before your first exam has been organized."
  - "You now have a clear study plan until [Date]."
  - "I've adjusted your schedule to account for your hackathon on July 4."
- DO NOT ask follow-up questions or prompt "how would you like to approach this?". Act like a competent assistant who has already taken full charge.

Life signals detected: ${lifeEvents.extractionReason || "Planning intent confirmed."}
`;
          } else {
            // Expose Planning Agent: skipped
            controller.enqueue(
              encoder.encode(makeStatusEvent("planning", "skipped", "No strategy modifications required."))
            );
          }

          let taskUpdateExecuted = false;
          if (intent.type === "task_update") {
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
                taskUpdateExecuted = true;
                planPromptText = `
## Task Completion Update:
You have marked the task "${targetTask.title}" as "${newStatus}".
Focus on outcomes: celebrate progress briefly, reassure them that this moves them closer to their goal, and mention what is next.
`;
              }
            }
          }

          if (intent.type === "execution_inquiry") {
            controller.enqueue(
              encoder.encode(makeStatusEvent("execution", "running", "Creating actionable work blocks..."))
            );
            try {
              const agenda = await ExecutionAgent.getOrCreateDailyAgenda(user.firebaseUid, todayStr);
              if (agenda) {
                const formattedBlocks = await Promise.all(
                  agenda.workBlocks.map(async (wb: any) => {
                    const taskIds = wb.tasks.map((t: any) => t._id || t);
                    const taskDocs = taskIds.length > 0 ? await Task.find({ _id: { $in: taskIds } }).lean() : [];
                    const taskTitles = taskDocs.map((t: any) => `- ${t.title} (${t.status})`).join("\n");
                    return `Block: ${wb.title} (${wb.startTime} - ${wb.endTime})\nTasks:\n${taskTitles || "No tasks scheduled"}`;
                  })
                );

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

          // ── 8. Call Gemini streaming API ────────────────────────────────────────
          const geminiStream = await GeminiService.generateCompanionStreamWithMemory(
            message,
            history,
            memoryPromptText,
            identityPromptText,
            profilePromptText,
            reflectionPromptText,
            planPromptText
          );

          let accumulatedText = "";

          // Stream companion text chunks
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

          // ── 9. Await and complete Planning / Execution tasks ────────────────────
          let planResult: { success: boolean; milestonesCreated: number; tasksCreated: number } | null = null;
          let agendaBuilt = false;

          if (planningPromise) {
            planResult = await planningPromise;
            if (planResult?.success) {
              controller.enqueue(
                encoder.encode(makeStatusEvent("planning", "completed", "Designed your roadmap successfully."))
              );

              // Execution Handoff: Force-regenerate today's agenda with new plan data
              controller.enqueue(
                encoder.encode(makeStatusEvent("execution", "running", "Creating actionable work blocks..."))
              );
              try {
                await ExecutionAgent.getOrCreateDailyAgenda(user.firebaseUid, todayStr, true);
                agendaBuilt = true;
                controller.enqueue(
                  encoder.encode(makeStatusEvent("execution", "completed", "Scheduled today's work blocks."))
                );
              } catch (agendaErr) {
                console.error("[ChatRoute] Execution handoff failed:", agendaErr);
                controller.enqueue(
                  encoder.encode(makeStatusEvent("execution", "skipped", "Failed to schedule today's work blocks."))
                );
              }
            } else {
              controller.enqueue(
                encoder.encode(makeStatusEvent("planning", "skipped", "Failed to design roadmap."))
              );
              controller.enqueue(
                encoder.encode(makeStatusEvent("execution", "skipped", "No schedule updates made."))
              );
            }
          } else {
            if (intent.type === "execution_inquiry") {
              controller.enqueue(
                encoder.encode(makeStatusEvent("execution", "completed", "Scheduled today's work blocks."))
              );
            } else {
              controller.enqueue(
                encoder.encode(makeStatusEvent("execution", "skipped", "No schedule updates required."))
              );
            }
          }

          // ── 10. Run Identity & Reflection evaluations (visible steps) ───────────
          // Evolve Identity
          controller.enqueue(
            encoder.encode(makeStatusEvent("identity", "running", "Updating your long-term profile..."))
          );
          const evolvedTraits = await IdentityAgent.evaluateAndEvolve(user.firebaseUid);
          controller.enqueue(
            encoder.encode(
              makeStatusEvent(
                "identity",
                evolvedTraits ? "completed" : "skipped",
                evolvedTraits ? "Profile updated with new traits." : "Profile checked. No new traits detected."
              )
            )
          );

          // Evolve Reflections
          controller.enqueue(
            encoder.encode(makeStatusEvent("reflection", "running", "Learning from today's conversation..."))
          );
          const evolvedReflections = await ReflectionAgent.evaluateAndEvolve(user.firebaseUid);
          controller.enqueue(
            encoder.encode(
              makeStatusEvent(
                "reflection",
                evolvedReflections ? "completed" : "skipped",
                evolvedReflections ? "Recorded growth patterns." : "No new growth patterns recorded."
              )
            )
          );

          // Evaluate Memory
          const newMemory = await MemoryAgent.evaluateAndStore(
            user.firebaseUid,
            message,
            accumulatedText,
            conversationId,
            "" // temp placeholder
          );

          // ── 11. Compile Stats & Save Execution Summary Card ─────────────────────
          const agenda = await ExecutionAgent.getOrCreateDailyAgenda(user.firebaseUid, todayStr);
          const workloadStr = agenda
            ? `${(agenda.estimatedFocusTime / 60).toFixed(1)} hrs/day`
            : "0.0 hrs/day";
          const priorityStr = agenda?.focus || agenda?.currentPriority || "General focus";

          // Fetch next milestone chronologically
          const upcomingMilestones = await Milestone.find({
            firebaseUid: user.firebaseUid,
            status: { $in: ["todo", "in_progress"] },
          })
            .sort({ startDate: 1 })
            .limit(1)
            .lean();

          const nextMilestoneStr = upcomingMilestones.length > 0
            ? `${upcomingMilestones[0].title} • ${new Date(upcomingMilestones[0].startDate || "").toLocaleDateString([], { month: "short", day: "numeric" })}`
            : "None scheduled";

          const summaryCardData = {
            __type: "execution_summary",
            stats: {
              milestonesCreated: planResult?.milestonesCreated || 0,
              tasksCreated: planResult?.tasksCreated || 0,
              agendaBuilt: agendaBuilt || taskUpdateExecuted,
              identityUpdated: !!evolvedTraits,
              reflectionRecorded: !!evolvedReflections,
              memoryUpdated: !!newMemory,
            },
            workload: workloadStr,
            priority: priorityStr,
            nextMilestone: nextMilestoneStr,
          };

          const summaryMessageContent = `\0${JSON.stringify(summaryCardData)}\0`;

          // Persist the assistant text + summary card message
          if (accumulatedText.trim()) {
            const assistantMsg = await MessageRepository.addMessage(conversationId, "assistant", accumulatedText);
            // Save the execution summary card as a separate assistant message in history
            await MessageRepository.addMessage(conversationId, "assistant", summaryMessageContent);

            // Update memory's assistant message ID link
            if (newMemory) {
              await newMemory.updateOne({ assistantMessageId: assistantMsg._id });
            }
          }

          // Stream the summary card event as the final block
          controller.enqueue(encoder.encode(summaryMessageContent));

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
