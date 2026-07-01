/**
 * Companion Node
 *
 * Calls GeminiService to stream the companion response to the client.
 * Also handles intent-aware prompt injection for planning, task update,
 * and execution inquiry flows.
 *
 * Responsibilities:
 * - Build a context-rich planPromptText based on routing intent
 * - Emit foreground status events for planning / execution when relevant
 * - Stream Gemini text chunks through state.streamController in real time
 * - Accumulate the full response text for downstream nodes
 *
 * Error strategy: catch all errors, never throw, return safe empty defaults.
 */

import type { NodeResult } from "../graph/types";
import type { GraphState } from "../graph/state";
import { provider } from "@/services/llm/provider";
import { COMPANION_SYSTEM_PROMPT } from "@/services/gemini.service";
import { Task } from "@/models/Task";
import { Goal } from "@/models/Goal";
import { Milestone } from "@/models/Milestone";
import { Plan } from "@/models/Plan";
import { PlanningAgent } from "@/agents/planning-agent";
import { BehaviorEngine } from "@/services/behavior-engine.service";
import { ZenkaiEvent } from "../events/event-types";
import type { InternalEvent } from "../events/event-types";
import { ContextOrchestrator } from "@/services/context-orchestrator.service";

// ─────────────────────────────────────────────────────────────────────────────
// Streaming protocol helper — null-byte delimited control events
// ─────────────────────────────────────────────────────────────────────────────

function makeStatusEvent(
  agent: string,
  status: "idle" | "running" | "completed" | "skipped",
  message: string
): string {
  return `\0${JSON.stringify({ __type: "status", agent, status, message })}\0`;
}

function enqueueEvent(
  streamController: ReadableStreamDefaultController | null,
  encoder: TextEncoder | null,
  event: string
): void {
  if (streamController && encoder) {
    try {
      streamController.enqueue(encoder.encode(event));
    } catch {
      // Stream may already be closed — swallow silently
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan prompt builders — mirrors exact text from route.ts
// ─────────────────────────────────────────────────────────────────────────────

function buildProactivePlanningPrompt(
  extractionReason: string,
  goalTitle?: string,
  detectedEvents?: Array<{ type: string; title: string; description: string; date?: string }>
): string {
  const goalContext = goalTitle
    ? `The user's explicit goal: "${goalTitle}"` 
    : "";
  const eventsContext = detectedEvents?.length
    ? `Detected life events: ${detectedEvents.map((e) => `${e.type}: ${e.title}${e.date ? ` (${e.date})` : ""}`).join(", ")}`
    : `Life signals: ${extractionReason || "Planning intent confirmed."}`;

  return `
## PROACTIVE OUTCOME-BASED PLANNING INSTRUCTION:
Zenkai is currently building the user's roadmap in the background while you respond.
${goalContext}
${eventsContext}

Your response MUST focus purely on OUTCOMES and reducing mental burden.
- Do NOT say "I updated your roadmap" or "Planning agent has started".
- Speak in terms of real-life relief, referencing the specific goal/topic above:
  - "Your 7-day DSA roadmap has been organized."
  - "Everything before your first exam has been structured."
  - "I've adjusted your schedule to account for your hackathon."

CRITICAL: You MUST NOT ask any questions. Planning is already executing.
Simply confirm the outcome in 2-3 sentences, referencing the specific goal above.
Do NOT say "Would you like...", "Shall I...", or ask anything.
`.trim();
}

function buildTaskCompletionPrompt(taskTitle: string, newStatus: string): string {
  return `
## Task Completion Update:
You have marked the task "${taskTitle}" as "${newStatus}".
Focus on outcomes: celebrate progress briefly, reassure them that this moves them closer to their goal, and mention what is next.
`.trim();
}

function buildExecutionAgendaPrompt(agenda: Record<string, unknown>): string {
  const formattedBlocks = (agenda.formattedBlocks as string[]) ?? [];

  return `
## Today's Daily Agenda (Execution Plan):
Date: ${agenda.date as string}
Focus Theme: "${agenda.focusTheme as string}"
Estimated Workload: "${agenda.estimatedWorkload as string}"
Planned Focus Time: ${agenda.plannedFocusHours as number} hours

Suggested Work Blocks & Tasks:
${formattedBlocks.join("\n\n")}

INSTRUCTIONS FOR COMPANION AGENT:
- Address the user's execution query by explaining what is on their agenda today.
- Reference their focus theme, workload, work blocks, and task priorities.
- Do NOT talk about long-term roadmaps. Keep attention on "Today's Agenda".
- Speak naturally. Do NOT say "according to the execution agent" or "your daily agenda".
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Companion Node Function
// ─────────────────────────────────────────────────────────────────────────────

export async function companionNode(
  state: Readonly<GraphState>
): Promise<NodeResult<GraphState>> {
  const startedAt = Date.now();
  const { streamController, encoder } = state;

  try {
    const {
      uid,
      userMessage,
      history,
      intent,
      lifeEvents,
      memoryPromptText,
      identityPromptText,
      profilePromptText,
      reflectionPromptText,
      todayStr,
      workflowId,
      profile,
    } = state;

    let planPromptText = "";
    let taskUpdateExecuted = false;
    const newEvents: InternalEvent[] = [];

    // ── 1. Build intent-aware planPromptText ──────────────────────────────────

    const intentType = intent?.type ?? "none";
    const lifeEventsSuggestPlanning = lifeEvents?.suggestsPlanning ?? false;

    // ── 1a. create_or_modify (or life events suggest planning) ────────────────
    if (intentType === "create_or_modify" || lifeEventsSuggestPlanning) {
      enqueueEvent(
        streamController,
        encoder,
        makeStatusEvent("planning", "running", "Designing your roadmap...")
      );

      const profileGoal = profile?.longTermGoal || profile?.currentFocus || "";
      const goalToPlan = intent?.goalTitle || profileGoal || "your goals";

      planPromptText = buildProactivePlanningPrompt(
        lifeEvents?.extractionReason ?? "",
        goalToPlan,
        lifeEvents?.detectedEvents
      );
    }

    // ── 1b. task_update ───────────────────────────────────────────────────────
    if (intentType === "task_update" && intent?.taskTitle?.trim()) {
      console.log(
        `[CompanionNode] task_update intent. Searching for task: "${intent.taskTitle}"`
      );

      try {
        const tasks = await Task.find({
          firebaseUid: uid,
          title: { $regex: new RegExp(intent.taskTitle.trim(), "i") },
        });

        if (tasks.length > 0) {
          const targetTask = tasks[0];
          const newStatus = intent.taskStatus ?? "completed";

          await Task.findByIdAndUpdate(targetTask._id, {
            $set: {
              status: newStatus,
              completedAt: newStatus === "completed" ? new Date() : null,
            },
          });

          await PlanningAgent.recalculateProgress(uid, targetTask._id.toString());

          // Notify BehaviorEngine
          if (newStatus === "completed") {
            await BehaviorEngine.updateFromTaskCompletion(uid, targetTask._id.toString()).catch(err =>
              console.error("[CompanionNode] Failed to update behavior profile from completion:", err)
            );
          } else if ((newStatus as string) === "skipped") {
            await BehaviorEngine.updateFromTaskSkip(uid, targetTask._id.toString()).catch(err =>
              console.error("[CompanionNode] Failed to update behavior profile from skip:", err)
            );
          }

          // Fetch the updated goals/milestones/plans to emit events
          const updatedTask = await Task.findById(targetTask._id).lean();
          const goal = updatedTask?.goalId ? await Goal.findById(updatedTask.goalId).lean() : null;
          const milestone = goal?.milestoneId ? await Milestone.findById(goal.milestoneId).lean() : null;
          const plan = milestone?.planId ? await Plan.findById(milestone.planId).lean() : null;

          if (newStatus === "completed") {
            newEvents.push({
              name: ZenkaiEvent.TaskCompleted,
              payload: {
                uid,
                workflowId: state.workflowId,
                taskId: targetTask._id.toString(),
                taskTitle: targetTask.title,
              },
              emittedAt: new Date().toISOString(),
            });
          }

          if (milestone && milestone.progress === 100) {
            newEvents.push({
              name: ZenkaiEvent.MilestoneCompleted,
              payload: {
                uid,
                workflowId: state.workflowId,
                milestoneId: milestone._id.toString(),
                milestoneTitle: milestone.title,
              },
              emittedAt: new Date().toISOString(),
            });
          }

          if (plan) {
            newEvents.push({
              name: ZenkaiEvent.PlanUpdated,
              payload: {
                uid,
                workflowId: state.workflowId,
                planId: plan._id.toString(),
                planTitle: plan.title,
              },
              emittedAt: new Date().toISOString(),
            });
          }

          taskUpdateExecuted = true;
          planPromptText = buildTaskCompletionPrompt(targetTask.title, newStatus);

          console.log(
            `[CompanionNode] Task "${targetTask.title}" updated to "${newStatus}".`
          );
        } else {
          console.log(
            `[CompanionNode] No task found matching: "${intent.taskTitle}"`
          );
        }
      } catch (taskErr) {
        console.error("[CompanionNode] Task update failed:", taskErr);
      }
    }

    // ── 1c. execution_inquiry ─────────────────────────────────────────────────
    if (intentType === "execution_inquiry") {
      enqueueEvent(
        streamController,
        encoder,
        makeStatusEvent("execution", "running", "Creating actionable work blocks...")
      );
      try {
        planPromptText = ContextOrchestrator.formatDailyAgendaPrompt(workflowId, todayStr);
      } catch (agendaErr) {
        console.error("[CompanionNode] Failed to inject daily agenda context from cache:", agendaErr);
      }
    }

    // ── 1d. Add Active Plan Overview summary to prevent task overload ─────────
    const activePlanOverviewText = ContextOrchestrator.formatActivePlanOverviewPrompt(workflowId);
    const finalPlanPromptText = [activePlanOverviewText, planPromptText].filter(Boolean).join("\n\n");

    // ── 2. Call LLM streaming ───────────────────────────────────────────────────
    const systemPromptWithMemory = `
${COMPANION_SYSTEM_PROMPT.trim()}

${profilePromptText}

${memoryPromptText}

${identityPromptText}

${reflectionPromptText}

${finalPlanPromptText}

IMPORTANT MEMORY & REFLECTION USAGE DIRECTIVES:
- Never say "I searched my memory", "According to my database", "I recall from our past conversations", "My records say", or "My reflections indicate".
- Never quote memories or reflections in a robotic, dry, or formal way.
- Instead, speak naturally. Weave the context into your responses as if you simply remember the user and understand their traits/patterns, just like a close human friend or mentor would.
- Keep the user's goals, preferences, and recurring behavioral patterns in mind when formulating suggestions and feedback.
- STRICT ANTI-HALLUCINATION GUARDRAILS: Do NOT invent or guess user memories, preferences, plans, tasks, or reflections. If details are not explicitly present in the provided context (profile, memories, identity, reflections, plan, or conversation history), do not assume or invent them. If information is unknown, say it is unknown and never guess.
`.trim();

    const contents = history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));
    contents.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    const companionStream = await provider.generateStream({
      contents,
      systemInstruction: systemPromptWithMemory,
      temperature: 0.7,
    });

    let accumulatedText = "";

    for await (const chunk of companionStream) {
      let chunkText = "";

      if (typeof chunk.text === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chunkText = (chunk.text as any)();
      } else if (typeof chunk.text === "string") {
        chunkText = chunk.text;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } else if ((chunk as any).candidates?.[0]?.content?.parts?.[0]?.text) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chunkText = (chunk as any).candidates[0].content.parts[0].text;
      }

      if (chunkText) {
        accumulatedText += chunkText;
        enqueueEvent(streamController, encoder, chunkText);
      }
    }

    // ── 3. Emit skipped events for agents not triggered ───────────────────────
    if (
      intentType !== "create_or_modify" &&
      !lifeEventsSuggestPlanning
    ) {
      enqueueEvent(
        streamController,
        encoder,
        makeStatusEvent("planning", "skipped", "No strategy modifications required.")
      );
    }

    if (intentType === "execution_inquiry") {
      enqueueEvent(
        streamController,
        encoder,
        makeStatusEvent("execution", "completed", "Scheduled today's work blocks.")
      );
    } else if (intentType !== "create_or_modify") {
      enqueueEvent(
        streamController,
        encoder,
        makeStatusEvent("execution", "skipped", "No schedule updates required.")
      );
    }

    console.log(
      `[CompanionNode] Response streamed — ${accumulatedText.length} chars | intent: ${intentType} | taskUpdateExecuted: ${taskUpdateExecuted}`
    );

    return {
      patch: {
        companionResponseDraft: accumulatedText,
        taskUpdateExecuted,
        planPromptText,
        emittedEvents: [...state.emittedEvents, ...newEvents],
      },
      metadata: {
        success: true,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `Companion streamed ${accumulatedText.length} chars | intent: ${intentType}`,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[CompanionNode] Error:", err);

    // Stream a friendly fallback error message directly to the client so the UI doesn't hang blankly
    const fallbackText = "Oops! Zenkai is experiencing high request volume or a temporary rate limit. Please wait a moment and try again.";
    try {
      if (streamController && encoder) {
        streamController.enqueue(encoder.encode(fallbackText));
      }
    } catch (e) {
      console.error("[CompanionNode] Failed to stream fallback error:", e);
    }

    return {
      patch: {
        companionResponseDraft: fallbackText,
        taskUpdateExecuted: false,
        planPromptText: "",
      },
      metadata: {
        success: false,
        duration: Date.now() - startedAt,
        skipped: false,
        reason: `CompanionNode error: ${errorMessage}`,
      },
    };
  }
}
