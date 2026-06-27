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
import { GeminiService } from "@/services/gemini.service";
import { Task } from "@/models/Task";
import { ExecutionAgent } from "@/agents/execution-agent";
import { PlanningAgent } from "@/agents/planning-agent";

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

function buildProactivePlanningPrompt(extractionReason: string): string {
  return `
## PROACTIVE OUTCOME-BASED PLANNING INSTRUCTION:
Zenkai is currently building the user's roadmap in the background while you respond.

Your response MUST focus purely on OUTCOMES and reducing mental burden.
- Do NOT say "I updated your roadmap" or "Planning agent has started".
- Speak in terms of real-life relief:
  - "Everything before your first exam has been organized."
  - "You now have a clear study plan until [Date]."
  - "I've adjusted your schedule to account for your hackathon on July 4."
- DO NOT ask follow-up questions or prompt "how would you like to approach this?". Act like a competent assistant who has already taken full charge.

Life signals detected: ${extractionReason || "Planning intent confirmed."}
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
  const optionalLines = (agenda.optionalLines as string[]) ?? [];
  const stretchLines = (agenda.stretchLines as string[]) ?? [];

  return `
## Today's Daily Agenda (Execution Plan):
Date: ${agenda.date as string}
Intention: "${agenda.intention as string}"
Focus: "${agenda.focus as string}"

Suggested Work Blocks & Tasks:
${formattedBlocks.join("\n\n")}

Optional Tasks:
${optionalLines.join("\n") || "None"}

Stretch Goals:
${stretchLines.join("\n") || "None"}

Estimated Focus Time: ${agenda.estimatedFocusTime as number} minutes
Current Priority: ${agenda.currentPriority as string}
Upcoming Deadline: ${agenda.upcomingDeadline as string}
Execution Reasoning: "${agenda.executionReasoning as string}"

INSTRUCTIONS FOR COMPANION AGENT:
- Address the user's execution query by explaining what is on their agenda today.
- Reference their intention, focus, work blocks, and task priorities.
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
      streamController,
      encoder,
    } = state;

    let planPromptText = "";
    let taskUpdateExecuted = false;

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

      planPromptText = buildProactivePlanningPrompt(
        lifeEvents?.extractionReason ?? ""
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
        const agenda = await ExecutionAgent.getOrCreateDailyAgenda(uid, todayStr);

        if (agenda) {
          // Resolve work block task titles
          const formattedBlocks = await Promise.all(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (agenda.workBlocks as any[]).map(async (wb: any) => {
              const taskIds = wb.tasks.map((t: any) => t._id || t);
              const taskDocs =
                taskIds.length > 0
                  ? await Task.find({ _id: { $in: taskIds } }).lean()
                  : [];
              const taskTitles = taskDocs
                .map((t: any) => `- ${t.title} (${t.status})`)
                .join("\n");
              return `Block: ${wb.title} (${wb.startTime} - ${wb.endTime})\nTasks:\n${
                taskTitles || "No tasks scheduled"
              }`;
            })
          );

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const optionalTaskIds = (agenda.optionalTasks as any[]).map(
            (t: any) => t._id || t
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stretchGoalIds = (agenda.stretchGoals as any[]).map(
            (t: any) => t._id || t
          );

          const [optionalDocs, stretchDocs] = await Promise.all([
            optionalTaskIds.length > 0
              ? Task.find({ _id: { $in: optionalTaskIds } }).lean()
              : Promise.resolve([]),
            stretchGoalIds.length > 0
              ? Task.find({ _id: { $in: stretchGoalIds } }).lean()
              : Promise.resolve([]),
          ]);

          planPromptText = buildExecutionAgendaPrompt({
            date: agenda.date,
            intention: agenda.intention,
            focus: agenda.focus,
            formattedBlocks,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            optionalLines: optionalDocs.map((t: any) => `- ${t.title} (${t.status})`),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stretchLines: stretchDocs.map((t: any) => `- ${t.title} (${t.status})`),
            estimatedFocusTime: agenda.estimatedFocusTime,
            currentPriority: agenda.currentPriority,
            upcomingDeadline: agenda.upcomingDeadline,
            executionReasoning: agenda.executionReasoning,
          });
        }
      } catch (agendaErr) {
        console.error("[CompanionNode] Failed to inject daily agenda context:", agendaErr);
      }
    }

    // ── 2. Call Gemini streaming ───────────────────────────────────────────────
    const geminiStream = await GeminiService.generateCompanionStreamWithMemory(
      userMessage,
      history,
      memoryPromptText,
      identityPromptText,
      profilePromptText,
      reflectionPromptText,
      planPromptText
    );

    let accumulatedText = "";

    for await (const chunk of geminiStream) {
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

    return {
      patch: {
        companionResponseDraft: "",
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
