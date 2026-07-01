import { User } from "@/models/User";
import { ProfileRepository } from "@/repositories/profile.repository";
import { WeeklyExecutionSchedule } from "@/models/WeeklyExecutionSchedule";
import { PlanRepository } from "@/repositories/plan.repository";
import { Task } from "@/models/Task";
import { Goal } from "@/models/Goal";
import { Plan } from "@/models/Plan";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";
import { BriefingLog } from "@/models/BriefingLog";
import { telemetryStorage } from "@/lib/telemetry-context";
import { provider } from "@/services/llm/provider";
import crypto from "crypto";

export class BriefComposerService {
  /**
   * Compiles data for the Morning Brief
   */
  static async composeMorningBrief(uid: string) {
    const user = await User.findOne({ firebaseUid: uid }).lean();
    if (!user) throw new Error(`User not found: ${uid}`);

    const timezone = user.briefSettings?.timezone || "UTC";
    const now = new Date();
    const localTimeStr = now.toLocaleString("en-US", { timeZone: timezone });
    const dateStr = new Date(localTimeStr).toISOString().split("T")[0];

    const profile = await ProfileRepository.findByFirebaseUid(uid);
    const schedule = await WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" }).populate("days.workBlocks.tasks").lean();
    const agenda = schedule?.days.find((d: any) => d.date === dateStr);
    const plansTree = await PlanRepository.findFullTree(uid);

    const priorities: string[] = [];
    const agendaBlocks: Array<{ time: string; title: string }> = [];
    const deadlines: Array<{ title: string; due: string }> = [];
    const milestones: Array<{ title: string; progress: number }> = [];

    // Agenda & top priorities
    if (agenda && agenda.workBlocks) {
      agenda.workBlocks.forEach((wb: any) => {
        agendaBlocks.push({
          time: `${wb.startTime} - ${wb.endTime}`,
          title: wb.title,
        });
      });
      if (agenda.focusTheme) {
        priorities.push(agenda.focusTheme);
      }
    }

    // Milestones & Deadlines from plans
    plansTree.forEach((plan) => {
      if (plan.milestones) {
        plan.milestones.forEach((m: any) => {
          if (m.status !== "completed") {
            milestones.push({
              title: m.title,
              progress: m.progress || 0,
            });
          }
          if (m.goals) {
            m.goals.forEach((g: any) => {
              if (g.tasks) {
                g.tasks.forEach((t: any) => {
                  if (t.status !== "completed" && t.suggestedDate) {
                    const taskDate = new Date(t.suggestedDate);
                    const diffDays = Math.ceil((taskDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays >= 0 && diffDays <= 3) {
                      deadlines.push({
                        title: t.title,
                        due: t.suggestedDate,
                      });
                    }
                  }
                });
              }
            });
          }
        });
      }
    });

    // Fallback: If agenda is empty, populate with upcoming tasks
    if (agendaBlocks.length === 0) {
      const pendingTasks = await Task.find({
        firebaseUid: uid,
        status: { $in: ["todo", "in_progress"] },
      })
        .sort({ priority: 1, createdAt: -1 })
        .limit(4)
        .lean();

      pendingTasks.forEach((t) => {
        agendaBlocks.push({
          time: t.timeBlock || "Today",
          title: t.title,
        });
        priorities.push(t.title);
      });
    }

    // Check if anything meaningful changed since last morning brief
    const lastLog = await BriefingLog.findOne({ uid, type: "morning", status: "success" })
      .sort({ createdAt: -1 })
      .lean();

    let hasChanges = true;
    const lastSentAt = lastLog?.createdAt;

    if (lastSentAt) {
      const userConvs = await Conversation.find({ firebaseUid: uid }).select("_id").lean();
      const convIds = userConvs.map((c) => c._id);

      const [newTasks, newGoals, newPlans, newMessages] = await Promise.all([
        Task.exists({ firebaseUid: uid, updatedAt: { $gt: lastSentAt } }),
        Goal.exists({ firebaseUid: uid, updatedAt: { $gt: lastSentAt } }),
        Plan.exists({ firebaseUid: uid, updatedAt: { $gt: lastSentAt } }),
        Message.exists({ conversationId: { $in: convIds }, createdAt: { $gt: lastSentAt } }),
      ]);

      if (!newTasks && !newGoals && !newPlans && !newMessages) {
        hasChanges = false;
      }
    }

    // 5% AI Generated Insight
    let insight = "Consistent daily effort leads to long-term success. Focus on completing your agenda blocks today.";
    let telemetry: any = null;
    let skipped = true;

    if (hasChanges) {
      skipped = false;
      const workflowId = `morning-brief-${crypto.randomUUID()}`;
      const aiCalls: any[] = [];
      const stateRef = {};

      const profilePrompt = profile
        ? `User profile focus: "${profile.currentFocus}", motivation: "${profile.motivation}", biggest challenge: "${profile.biggestChallenge}".`
        : "";
      const prioritiesPrompt = priorities.length > 0 ? `Today's priorities: ${priorities.join(", ")}.` : "";
      const agendaPrompt = agendaBlocks.length > 0 ? `Agenda blocks: ${agendaBlocks.map(a => a.title).join(", ")}.` : "";

      const systemPrompt = `
You are Zenkai, a calm and thoughtful AI companion.
Write a short, highly personalized 2-sentence "Today's Insight" for the morning email.
Tone must be supportive, calm, mentoring, and direct.
- Never use exclamation marks.
- Never use emojis.
- Never say "I recall", "In your database", or reference memories.
- Write in the second person ("you").
- Focus on keeping the user clear-headed and focused.
      `.trim();

      const userPrompt = `
Context:
${profilePrompt}
${prioritiesPrompt}
${agendaPrompt}
      `.trim();

      try {
        insight = await telemetryStorage.run({ workflowId, aiCalls, stateRef }, async () => {
          const response = await provider.generate({
            prompt: userPrompt,
            systemInstruction: systemPrompt,
            temperature: 0.7,
            maxOutputTokens: 100,
          });
          return response.text?.trim() || insight;
        });

        if (aiCalls.length > 0) {
          telemetry = aiCalls[0];
        }
      } catch (err) {
        console.error("[BriefComposer] Morning AI generation failed:", err);
      }
    }

    return {
      data: {
        userName: user.name || "friend",
        dateStr: new Date(localTimeStr).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        insight,
        priorities: priorities.slice(0, 3),
        agenda: agendaBlocks,
        deadlines: deadlines.slice(0, 3),
        milestones: milestones.slice(0, 3),
        timezone,
      },
      telemetry,
      skipped,
      email: user.email,
    };
  }

  /**
   * Compiles data for the Evening Brief
   */
  static async composeEveningBrief(uid: string) {
    const user = await User.findOne({ firebaseUid: uid }).lean();
    if (!user) throw new Error(`User not found: ${uid}`);

    const timezone = user.briefSettings?.timezone || "UTC";
    const now = new Date();
    const localTimeStr = now.toLocaleString("en-US", { timeZone: timezone });
    const dateStr = new Date(localTimeStr).toISOString().split("T")[0];

    const profile = await ProfileRepository.findByFirebaseUid(uid);

    const startOfUserDay = new Date(new Date(dateStr + "T00:00:00").toLocaleString("en-US", { timeZone: timezone }));
    const endOfUserDay = new Date(new Date(dateStr + "T23:59:59").toLocaleString("en-US", { timeZone: timezone }));

    // Load tasks completed today or scheduled today
    const todayTasks = await Task.find({
      firebaseUid: uid,
      $or: [
        { suggestedDate: dateStr },
        { scheduledFor: { $gte: startOfUserDay, $lte: endOfUserDay } },
        { completedAt: { $gte: startOfUserDay, $lte: endOfUserDay } }
      ]
    }).lean();

    const completedTasks = todayTasks
      .filter((t) => t.status === "completed")
      .map((t) => t.title);

    const pendingTasks = todayTasks
      .filter((t) => t.status !== "completed" && t.status !== "skipped")
      .map((t) => t.title);

    // Compute progress stats
    const allTasks = await Task.find({ firebaseUid: uid }).lean();
    const totalTasksCount = allTasks.length;
    const completedTasksCount = allTasks.filter((t) => t.status === "completed").length;
    const progressPercentage = totalTasksCount > 0 
      ? Math.round((completedTasksCount / totalTasksCount) * 100) 
      : 0;

    const timelineProgress = {
      totalTasks: totalTasksCount,
      completedTasks: completedTasksCount,
      progressPercentage,
    };

    // Check if anything meaningful changed since last evening brief
    const lastLog = await BriefingLog.findOne({ uid, type: "evening", status: "success" })
      .sort({ createdAt: -1 })
      .lean();

    let hasChanges = true;
    const lastSentAt = lastLog?.createdAt;

    if (lastSentAt) {
      const userConvs = await Conversation.find({ firebaseUid: uid }).select("_id").lean();
      const convIds = userConvs.map((c) => c._id);

      const [newTasks, newGoals, newPlans, newMessages] = await Promise.all([
        Task.exists({ firebaseUid: uid, updatedAt: { $gt: lastSentAt } }),
        Goal.exists({ firebaseUid: uid, updatedAt: { $gt: lastSentAt } }),
        Plan.exists({ firebaseUid: uid, updatedAt: { $gt: lastSentAt } }),
        Message.exists({ conversationId: { $in: convIds }, createdAt: { $gt: lastSentAt } }),
      ]);

      if (!newTasks && !newGoals && !newPlans && !newMessages) {
        hasChanges = false;
      }
    }

    // 5% AI Generated Reflection
    let reflection = "Take a moment to rest and recharge. You did your best today, and tomorrow brings new opportunities.";
    let tomorrowSuggestedFocus = "Review your goals in the morning to align your work blocks with your vision.";
    let telemetry: any = null;
    let skipped = true;

    if (hasChanges) {
      skipped = false;
      const workflowId = `evening-brief-${crypto.randomUUID()}`;
      const aiCalls: any[] = [];
      const stateRef = {};

      const profilePrompt = profile
        ? `User profile focus: "${profile.currentFocus}", goals: "${profile.longTermGoal}", motivation: "${profile.motivation}".`
        : "";
      const completedPrompt = completedTasks.length > 0 ? `Completed today: ${completedTasks.join(", ")}.` : "Completed nothing today.";
      const pendingPrompt = pendingTasks.length > 0 ? `Pending tasks: ${pendingTasks.join(", ")}.` : "No pending tasks today.";

      const systemPrompt = `
You are Zenkai, a calm and thoughtful AI companion.
Return a JSON object containing:
- "reflection": A calm, encouraging 2-sentence reflection on today's efforts.
- "tomorrowSuggestedFocus": A 1-sentence recommendation on what to prioritize tomorrow.

Guidelines:
- Maintain a calm, supportive, mentoring tone.
- Never use exclamation marks.
- Never use emojis.
- Never mention databases or memories.
- Write in the second person ("you").
- Format the response as raw JSON ONLY.
      `.trim();

      const userPrompt = `
Context:
${profilePrompt}
${completedPrompt}
${pendingPrompt}
      `.trim();

      try {
        const jsonText = await telemetryStorage.run({ workflowId, aiCalls, stateRef }, async () => {
          const response = await provider.generate({
            prompt: userPrompt,
            systemInstruction: systemPrompt,
            temperature: 0.7,
            responseMimeType: "application/json",
            maxOutputTokens: 200,
          });
          return response.text?.trim() || "";
        });

        if (jsonText) {
          const parsed = JSON.parse(jsonText);
          if (parsed.reflection) reflection = parsed.reflection;
          if (parsed.tomorrowSuggestedFocus) tomorrowSuggestedFocus = parsed.tomorrowSuggestedFocus;
        }

        if (aiCalls.length > 0) {
          telemetry = aiCalls[0];
        }
      } catch (err) {
        console.error("[BriefComposer] Evening AI generation failed:", err);
      }
    }

    return {
      data: {
        userName: user.name || "friend",
        dateStr: new Date(localTimeStr).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        reflection,
        completedTasks,
        pendingTasks,
        timelineProgress,
        tomorrowSuggestedFocus,
        timezone,
      },
      telemetry,
      skipped,
      email: user.email,
    };
  }
}
