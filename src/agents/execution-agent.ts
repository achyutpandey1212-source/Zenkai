import { GoogleGenAI } from "@google/genai";
import { ProfileRepository } from "@/repositories/profile.repository";
import { MemoryRepository } from "@/repositories/memory.repository";
import { IdentityRepository } from "@/repositories/identity.repository";
import { ReflectionRepository } from "@/repositories/reflection.repository";
import { PlanRepository } from "@/repositories/plan.repository";
import { DailyAgendaRepository } from "@/repositories/daily-agenda.repository";
import { Task, ITask } from "@/models/Task";
import { Milestone } from "@/models/Milestone";
import { Types } from "mongoose";
import type { GraphState } from "@/orchestration/graph/state";

const EXECUTION_AGENT_SYSTEM_PROMPT = `
You are the Execution Agent for Zenkai, a luxury AI growth companion.
Your mission is to turn long-term strategies, milestones, active tasks, constraints, and reflections into a calm, focused daily agenda.

Daily Execution Philosophy:
- Execution should reduce anxiety. Never overwhelm. Never dump twenty tasks.
- The user should always feel: "I know exactly what to do next."
- Design every day intentionally with:
  1. Today's Intention: A thoughtful, calm, non-cheesy, and non-motivational statement (e.g., "Today's intention is to build confidence before your Microprocessors exam," or "We're protecting your energy today because tomorrow is your hardest exam.").
  2. Today's Focus: A single, overarching focus.
  3. Today's Work Blocks: 2-3 focused sessions (e.g. Deep Work 09:00-10:30, Practice 10:45-11:30, Revision 16:00-16:30). Suggested blocks, not rigid calendar events.
  4. Task Queue (Avoid Overloading): Target 3 Critical (placed within Work Blocks), 2 Optional, 1 Stretch Goal.
  5. Estimated Focus Time: Total minutes planned for today's tasks.
  6. Current Priority & Upcoming Deadline.
  7. Execution Reasoning: Why you prioritized these tasks, how you respected upcoming exams/constraints, and if tasks were deferred.

SMART RESCHEDULING & DEFERRED TASKS:
- If a task is repeatedly skipped (indicated by a high deferredCount, e.g., >= 3), you must highlight it in the deferredExplanation.
- If today's work is reorganized or rebalanced, explain WHY in the executionReasoning or deferredExplanation (e.g., "I moved Probability revision to tomorrow because your Microprocessors exam is sooner.").

DIAGNOSTIC TRACKING:
- In the "diagnostics" field, explain:
  - priorityCalculations: how you calculated task importance.
  - constraintEvaluation: how you scheduled study sessions around exams.
  - deferredLogic: why certain tasks were postponed.
  - workBlockGeneration: reasoning for session timings.

TASK MAPPING:
You will be provided with a JSON array of available Tasks, each containing a string "_id".
When assigning tasks to "workBlocks", "optionalTasks", or "stretchGoals", you MUST use the exact string "_id" value from the input tasks list. Do NOT invent new IDs.

You must return a JSON response matching the requested schema.
`;

export class ExecutionAgent {
  private static client: GoogleGenAI | null = null;

  private static getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY environment variable.");
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Get or generate today's Daily Agenda for a user.
   */
  static async getOrCreateDailyAgenda(uid: string, dateStr: string, forceRegenerate = false, state?: GraphState) {
    try {
      if (!forceRegenerate) {
        const existing = await DailyAgendaRepository.findByUserAndDate(uid, dateStr);
        if (existing) {
          console.log(`[ExecutionAgent] Found existing daily agenda for user ${uid} on date ${dateStr}`);
          return existing;
        }
      }

      console.log(`[ExecutionAgent] Generating daily agenda for user ${uid} on date ${dateStr}`);
      return await this.generateDailyAgenda(uid, dateStr, state);
    } catch (error) {
      console.error("[ExecutionAgent] Error in getOrCreateDailyAgenda:", error);
      throw error;
    }
  }

  /**
   * Run the Execution Agent pipeline to generate today's agenda.
   */
  private static async generateDailyAgenda(uid: string, dateStr: string, state?: GraphState) {
    const startTime = Date.now();

    // 1. Fetch User Context — reuse GraphState if available to avoid duplicate DB reads
    const profile = state?.profile ?? await ProfileRepository.findByFirebaseUid(uid);
    const activePlans = (state?.activePlans && state.activePlans.length > 0)
      ? state.activePlans
      : await PlanRepository.findFullTree(uid);
    const activeTraits = (state?.activeTraits && state.activeTraits.length > 0)
      ? state.activeTraits
      : await IdentityRepository.findActiveByUser(uid);
    const activeReflections = (state?.activeReflections && state.activeReflections.length > 0)
      ? state.activeReflections
      : await ReflectionRepository.findActiveByUser(uid);

    // Get all tasks for this user
    // We fetch tasks that are suggested for today, or have been deferred/todo/in-progress
    const allTasks = await Task.find({
      firebaseUid: uid,
      status: { $in: ["todo", "in_progress", "deferred", "blocked"] }
    }).lean() as ITask[];

    // Find upcoming hard constraints (Milestones with category Exam or Interview)
    let upcomingHardConstraints: any[] = [];
    if (activePlans.length > 0) {
      const planIds = activePlans.map(p => p._id);
      upcomingHardConstraints = await Milestone.find({
        planId: { $in: planIds },
        category: { $in: ["Exam", "Interview"] },
        status: { $in: ["todo", "in_progress"] }
      }).sort({ startDate: 1 }).lean();
    }

    // Get yesterday's agenda to verify if there are unfinished items we need to carry over or defer
    const yesterday = new Date(dateStr);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const yesterdayAgenda = await DailyAgendaRepository.findByUserAndDate(uid, yesterdayStr);

    // 2. Format context for prompt
    const tasksFormatted = allTasks.map(t => ({
      _id: t._id.toString(),
      title: t.title,
      description: t.description || "",
      status: t.status,
      priority: t.priority,
      suggestedDate: t.suggestedDate || "",
      timeBlock: t.timeBlock || "",
      deferredCount: t.deferredCount || 0,
      estimatedMinutes: t.estimatedMinutes || 30
    }));

    const constraintsFormatted = upcomingHardConstraints.map(m => ({
      title: m.title,
      category: m.category,
      startDate: m.startDate,
      endDate: m.endDate,
      importance: m.importance || 10
    }));

    const contextPrompt = `
User Profile:
- Long-term goal: ${profile?.longTermGoal || "None"}
- Peak focus availability: ${profile?.dailyAvailability || "None"}
- Style: ${profile?.workStyle || "None"}

Active Identity Traits:
${JSON.stringify(activeTraits.map(t => ({ trait: t.trait, description: t.description })), null, 2)}

Active Reflections:
${JSON.stringify(activeReflections.map(r => ({ title: r.title, summary: r.summary, category: r.category })), null, 2)}

Upcoming Hard Constraints (Exams/Deadlines):
${JSON.stringify(constraintsFormatted, null, 2)}

Yesterday's Daily Agenda:
${yesterdayAgenda ? JSON.stringify({
  intention: yesterdayAgenda.intention,
  focus: yesterdayAgenda.focus,
  deferredExplanation: yesterdayAgenda.deferredExplanation
}) : "None"}

All Unfinished Tasks available for today (${dateStr}):
${JSON.stringify(tasksFormatted, null, 2)}
`;

    const prompt = `
User Context:
${contextPrompt}

Target Date: ${dateStr}

Please generate the daily agenda. Make sure you select the most critical tasks from the list based on priority, deadline constraints, and learning styles.
Assign task IDs exactly from the available tasks list.
Remember:
- Target 3 critical tasks (split into 2-3 Work Blocks).
- Target 2 optional tasks.
- Target 1 stretch goal.
- If yesterday's agenda existed and tasks scheduled for yesterday are still incomplete, mark them as deferred and reschedule them for today or tomorrow, incrementing their deferredCount. Explain this shift in deferredExplanation.
`;

    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: EXECUTION_AGENT_SYSTEM_PROMPT.trim(),
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            intention: { type: "STRING" },
            focus: { type: "STRING" },
            workBlocks: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  startTime: { type: "STRING" },
                  endTime: { type: "STRING" },
                  tasks: {
                    type: "ARRAY",
                    items: { type: "STRING" }
                  }
                },
                required: ["title", "startTime", "endTime", "tasks"]
              }
            },
            optionalTasks: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            stretchGoals: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            estimatedFocusTime: { type: "INTEGER" },
            currentPriority: { type: "STRING" },
            upcomingDeadline: { type: "STRING" },
            executionReasoning: { type: "STRING" },
            deferredExplanation: { type: "STRING" },
            diagnostics: {
              type: "OBJECT",
              properties: {
                priorityCalculations: { type: "STRING" },
                constraintEvaluation: { type: "STRING" },
                deferredLogic: { type: "STRING" },
                workBlockGeneration: { type: "STRING" }
              },
              required: ["priorityCalculations", "constraintEvaluation", "deferredLogic", "workBlockGeneration"]
            }
          },
          required: ["intention", "focus", "workBlocks", "optionalTasks", "stretchGoals", "estimatedFocusTime", "currentPriority", "upcomingDeadline", "executionReasoning", "diagnostics"]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Execution Agent returned empty output");
    }

    const result = JSON.parse(responseText);
    const executionTimeMs = Date.now() - startTime;

    // 3. Update task metadata based on the LLM selections
    // For critical tasks (in work blocks), optional tasks, and stretch goals, we set their suggestedDate to today, and if yesterday's agenda had tasks that were skipped, we increment their deferredCount and change their status.
    const allAssignedIds = new Set<string>();
    
    // Helper to gather task IDs
    result.workBlocks.forEach((block: any) => {
      block.tasks.forEach((tid: string) => {
        if (Types.ObjectId.isValid(tid)) allAssignedIds.add(tid);
      });
    });
    result.optionalTasks.forEach((tid: string) => {
      if (Types.ObjectId.isValid(tid)) allAssignedIds.add(tid);
    });
    result.stretchGoals.forEach((tid: string) => {
      if (Types.ObjectId.isValid(tid)) allAssignedIds.add(tid);
    });

    // Update the assigned tasks' suggestedDate and status
    for (const tid of Array.from(allAssignedIds)) {
      const dbTask = allTasks.find(t => t._id.toString() === tid);
      if (dbTask) {
        const updates: any = {
          suggestedDate: dateStr
        };

        // If the task was previously todo/missed but is now scheduled, we can reset or keep deferred
        if (dbTask.status === "deferred") {
          // Keep it deferred or transition to todo/in_progress
          updates.status = "todo";
        }
        await Task.findByIdAndUpdate(tid, { $set: updates });
      }
    }

    // Identify if any yesterday tasks were NOT completed and not scheduled today
    if (yesterdayAgenda) {
      const yesterdayTaskIds = new Set<string>();
      yesterdayAgenda.workBlocks.forEach(wb => {
        wb.tasks.forEach(t => yesterdayTaskIds.add(t.toString()));
      });
      yesterdayAgenda.optionalTasks.forEach(t => yesterdayTaskIds.add(t.toString()));
      yesterdayAgenda.stretchGoals.forEach(t => yesterdayTaskIds.add(t.toString()));

      for (const ytid of Array.from(yesterdayTaskIds)) {
        // Fetch fresh task to verify completion
        const taskObj = await Task.findById(ytid);
        if (taskObj && taskObj.status !== "completed") {
          // It was not completed! If it is NOT in today's agenda, we mark it as deferred and increment deferredCount
          if (!allAssignedIds.has(ytid)) {
            await Task.findByIdAndUpdate(ytid, {
              $set: { status: "deferred" },
              $inc: { deferredCount: 1 }
            });
          } else {
            // It is in today's agenda, so we increment deferredCount since it carries over
            await Task.findByIdAndUpdate(ytid, {
              $inc: { deferredCount: 1 }
            });
          }
        }
      }
    }

    // 4. Save and return Daily Agenda
    const agendaData = {
      firebaseUid: uid,
      date: dateStr,
      intention: result.intention,
      focus: result.focus,
      workBlocks: result.workBlocks.map((wb: any) => ({
        title: wb.title,
        startTime: wb.startTime,
        endTime: wb.endTime,
        tasks: wb.tasks.filter((tid: string) => Types.ObjectId.isValid(tid)).map((tid: string) => new Types.ObjectId(tid))
      })),
      optionalTasks: result.optionalTasks.filter((tid: string) => Types.ObjectId.isValid(tid)).map((tid: string) => new Types.ObjectId(tid)),
      stretchGoals: result.stretchGoals.filter((tid: string) => Types.ObjectId.isValid(tid)).map((tid: string) => new Types.ObjectId(tid)),
      estimatedFocusTime: result.estimatedFocusTime,
      currentPriority: result.currentPriority,
      upcomingDeadline: result.upcomingDeadline,
      executionReasoning: result.executionReasoning,
      deferredExplanation: result.deferredExplanation || "",
      diagnostics: {
        priorityCalculations: result.diagnostics.priorityCalculations,
        constraintEvaluation: result.diagnostics.constraintEvaluation,
        deferredLogic: result.diagnostics.deferredLogic,
        workBlockGeneration: result.diagnostics.workBlockGeneration,
        executionTimeMs
      }
    };

    return await DailyAgendaRepository.saveAgenda(uid, dateStr, agendaData);
  }

  /**
   * Rebalance the daily agenda because of a task status change (e.g. deferral or skip).
   */
  static async rebalanceAgenda(uid: string, dateStr: string) {
    console.log(`[ExecutionAgent] Rebalancing agenda for user ${uid} on date ${dateStr}`);
    // Regenerating is equivalent to rebalancing as it reads the updated task statuses,
    // increments deferredCounts, and re-maps to tomorrow / today.
    return await this.generateDailyAgenda(uid, dateStr);
  }
}
