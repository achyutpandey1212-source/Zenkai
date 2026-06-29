import { dbConnect } from "@/lib/mongodb";
import { User } from "@/models/User";
import { WeeklyExecutionSchedule } from "@/models/WeeklyExecutionSchedule";
import { ProfileRepository } from "@/repositories/profile.repository";
import { MemoryRepository } from "@/repositories/memory.repository";
import { IdentityRepository } from "@/repositories/identity.repository";
import { IdentityProposalRepository } from "@/repositories/identity-proposal.repository";
import { ReflectionRepository } from "@/repositories/reflection.repository";
import { PlanRepository } from "@/repositories/plan.repository";
import { RetrievalPipeline } from "@/memory/retrieval-pipeline";
import { RankingEngine } from "@/memory/ranking-engine";
import type {
  NormalizedUserContext,
  NormalizedIdentityTrait,
  NormalizedIdentity,
  NormalizedPlan,
  NormalizedWeeklySchedule,
  NormalizedMemory,
  NormalizedReflection,
  NormalizedProfile,
} from "@/types/context.types";

export class ContextOrchestrator {
  // Request-scoped cache keyed by workflowId
  private static cache = new Map<string, NormalizedUserContext>();

  /**
   * Estimates token counts using character-based JSON heuristic
   */
  private static estimateTokens(obj: any): number {
    if (!obj) return 0;
    const str = typeof obj === "string" ? obj : JSON.stringify(obj);
    return Math.ceil(str.length / 4.0);
  }

  /**
   * Loads raw database data, normalizes it, estimates diagnostics tokens,
   * caches, and returns a NormalizedUserContext.
   */
  public static async loadContext(
    uid: string,
    workflowId: string,
    trigger: string,
    userMessage?: string
  ): Promise<NormalizedUserContext> {
    if (this.cache.has(workflowId)) {
      return this.cache.get(workflowId)!;
    }

    await dbConnect();

    // 1. Fetch raw MongoDB database data in parallel
    const [
      userDoc,
      profileDoc,
      allTraits,
      pendingProposals,
      activePlanTree,
      activeReflections,
      activeSchedule,
    ] = await Promise.all([
      User.findOne({ firebaseUid: uid }).lean(),
      ProfileRepository.findByFirebaseUid(uid),
      IdentityRepository.findAllByUser(uid),
      IdentityProposalRepository.findPendingByUser(uid),
      PlanRepository.findActivePlanTree(uid),
      ReflectionRepository.findActiveByUser(uid),
      WeeklyExecutionSchedule.findOne({ firebaseUid: uid, status: "ACTIVE" })
        .populate("days.workBlocks.tasks")
        .lean(),
    ]);

    // 2. Fetch or load memories
    let rawMemories = [];
    if (userMessage) {
      // Perform contextual ranked memory retrieval
      const intent = RetrievalPipeline.detectIntent(userMessage);
      const keywords = RetrievalPipeline.extractKeywords(userMessage);

      const keywordCandidates = keywords.length > 0
        ? await MemoryRepository.findRelevantByKeywords(uid, keywords, 30)
        : [];

      const [identityList, goalList, preferenceList, habitList, constraintList, motivationList, projectList] = await Promise.all([
        MemoryRepository.findByCategoryWithLimit(uid, "Identity", 5),
        MemoryRepository.findByCategoryWithLimit(uid, "Goal", 5),
        MemoryRepository.findByCategoryWithLimit(uid, "Preference", 5),
        MemoryRepository.findByCategoryWithLimit(uid, "Habit", 5),
        MemoryRepository.findByCategoryWithLimit(uid, "Constraint", 5),
        MemoryRepository.findByCategoryWithLimit(uid, "Motivation", 5),
        MemoryRepository.findByCategoryWithLimit(uid, "Project", 5),
      ]);

      const allCandidates = [
        ...keywordCandidates,
        ...identityList,
        ...goalList,
        ...preferenceList,
        ...habitList,
        ...constraintList,
        ...motivationList,
        ...projectList,
      ];

      const uniqueMap = new Map<string, any>();
      for (const mem of allCandidates) {
        uniqueMap.set(mem._id.toString(), mem);
      }
      const candidates = Array.from(uniqueMap.values());
      rawMemories = RankingEngine.rankMemories(candidates, userMessage, intent);
    } else {
      // Fallback: fetch approved memories
      rawMemories = await MemoryRepository.findApprovedByUser(uid);
    }

    // 3. Normalization mapping
    const timezone = userDoc?.briefSettings?.timezone || "UTC";

    const normalizedProfile: NormalizedProfile = {
      profession: profileDoc?.profession,
      longTermGoal: profileDoc?.longTermGoal,
      currentFocus: profileDoc?.currentFocus,
      motivation: profileDoc?.motivation,
      dailyAvailability: profileDoc?.dailyAvailability,
      workStyle: profileDoc?.workStyle,
      biggestChallenge: profileDoc?.biggestChallenge,
      timezone,
      calendarSynced: userDoc?.googleCalendarSettings?.connected === true,
    };

    const activeTraits: NormalizedIdentityTrait[] = [];
    const candidateTraits: NormalizedIdentityTrait[] = [];

    allTraits.forEach((t: any) => {
      const trait: NormalizedIdentityTrait = {
        id: t._id.toString(),
        trait: t.trait,
        category: t.category,
        description: t.description || "",
        confidence: t.confidence || 0,
        stability: t.stability || 0,
        version: t.version || 1,
        status: t.status,
        evidence: t.evidence || "",
        updatedAt: t.updatedAt?.toISOString(),
      };
      if (t.status === "active") activeTraits.push(trait);
      else if (t.status === "candidate") candidateTraits.push(trait);
    });

    const normalizedIdentity: NormalizedIdentity = {
      activeTraits,
      candidateTraits,
      pendingProposalsCount: pendingProposals.length,
    };

    let normalizedPlan: NormalizedPlan | null = null;
    if (activePlanTree) {
      normalizedPlan = {
        id: activePlanTree.id || activePlanTree._id.toString(),
        title: activePlanTree.title,
        description: activePlanTree.description || "",
        status: activePlanTree.status,
        priority: activePlanTree.priority || 1,
        estimatedDuration: activePlanTree.estimatedDuration,
        type: activePlanTree.type || "personal",
        progress: activePlanTree.progress || 0,
        milestones: (activePlanTree.milestones || []).map((m: any) => ({
          id: m.id || m._id.toString(),
          title: m.title,
          description: m.description || "",
          status: m.status,
          priority: m.priority || 1,
          startDate: m.startDate || "",
          endDate: m.endDate || "",
          category: m.category || "Personal",
          importance: m.importance || 5,
          flexibility: m.flexibility || 5,
          goals: (m.goals || []).map((g: any) => ({
            id: g.id || g._id.toString(),
            title: g.title,
            description: g.description || "",
            status: g.status,
            priority: g.priority || 1,
            tasks: (g.tasks || []).map((t: any) => ({
              id: t.id || t._id.toString(),
              title: t.title,
              description: t.description || "",
              status: t.status,
              priority: t.priority || 1,
              suggestedDate: t.suggestedDate,
              timeBlock: t.timeBlock,
              dependencies: t.dependencies || [],
            })),
          })),
        })),
      };
    }

    let normalizedWeeklySchedule: NormalizedWeeklySchedule | null = null;
    if (activeSchedule) {
      normalizedWeeklySchedule = {
        scheduleId: activeSchedule._id.toString(),
        version: activeSchedule.version || 1,
        validFrom: activeSchedule.validFrom || "",
        validTo: activeSchedule.validTo || "",
        days: (activeSchedule.days || []).map((d: any) => ({
          date: d.date,
          focusTheme: d.focusTheme,
          estimatedWorkload: d.estimatedWorkload,
          plannedFocusHours: d.plannedFocusHours || 0,
          workBlocks: (d.workBlocks || []).map((wb: any) => ({
            title: wb.title,
            startTime: wb.startTime,
            endTime: wb.endTime,
            duration: wb.duration || 30,
            priority: wb.priority || 3,
            tasks: (wb.tasks || []).map((t: any) => (t._id || t).toString()),
          })),
        })),
      };
    }

    const normalizedMemories: NormalizedMemory[] = rawMemories.map((m: any) => ({
      id: m._id.toString(),
      category: m.category,
      content: m.content,
      summary: m.summary || m.content,
      confidence: m.confidence || 0.8,
      importance: m.importance || 5.0,
      retrievalCount: m.retrievalCount,
      lastRetrievedAt: m.lastRetrievedAt?.toISOString(),
      createdAt: m.createdAt?.toISOString(),
    }));

    const normalizedReflections: NormalizedReflection[] = activeReflections.map((r: any) => ({
      id: r._id.toString(),
      title: r.title,
      category: r.category,
      content: r.content,
      summary: r.summary || r.content,
      confidence: r.confidence || 0.8,
      stability: r.stability || 0.1,
      importance: r.importance || 5.0,
      evidenceCount: r.evidenceCount || 1,
    }));

    // 4. Token Diagnostics Computation
    const tokensPerLayer: Record<string, number> = {
      profile: this.estimateTokens(normalizedProfile),
      identity: this.estimateTokens(normalizedIdentity.activeTraits),
      plan: normalizedPlan ? this.estimateTokens({
        title: normalizedPlan.title,
        description: normalizedPlan.description,
        progress: normalizedPlan.progress,
        status: normalizedPlan.status,
      }) : 0,
      weeklySchedule: this.estimateTokens(normalizedWeeklySchedule),
      memories: this.estimateTokens(normalizedMemories),
      reflections: this.estimateTokens(normalizedReflections),
    };

    if (normalizedPlan) {
      // Planning agent gets the full tree, compute that diagnostics entry too
      tokensPerLayer.planningFullTree = this.estimateTokens(normalizedPlan);
    }

    const totalTokens = Object.values(tokensPerLayer).reduce((a, b) => a + b, 0);

    const contextVersion = this.cache.size + 1; // versioning increment

    const normalizedContext: NormalizedUserContext = {
      metadata: {
        version: contextVersion,
        createdAt: new Date().toISOString(),
        generatedFrom: trigger,
        diagnostics: {
          totalTokens,
          tokensPerLayer,
        },
      },
      identity: normalizedIdentity,
      activePlan: normalizedPlan,
      weeklySchedule: normalizedWeeklySchedule,
      memories: normalizedMemories,
      reflections: normalizedReflections,
      profile: normalizedProfile,
    };

    this.cache.set(workflowId, normalizedContext);
    console.log(`[ContextOrchestrator][wf:${workflowId.slice(0, 8)}] Context loaded (v${contextVersion}, trigger="${trigger}"). Est. total tokens: ${totalTokens}`);
    return normalizedContext;
  }

  /**
   * Retrieves the cached context packet. Throws if not loaded.
   */
  public static getContext(workflowId: string): NormalizedUserContext {
    const ctx = this.cache.get(workflowId);
    if (!ctx) {
      throw new Error(`[ContextOrchestrator] Cache miss for workflow ID: ${workflowId}`);
    }
    return ctx;
  }

  /**
   * Invalidates the cached request context to prevent memory leaks.
   */
  public static invalidateCache(workflowId: string): void {
    if (this.cache.has(workflowId)) {
      this.cache.delete(workflowId);
      console.log(`[ContextOrchestrator][wf:${workflowId.slice(0, 8)}] Cache entry cleared.`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Centralized Prompt Formatters
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Formats user onboarding profile for system instructions
   */
  public static formatProfilePrompt(workflowId: string): string {
    const { profile } = this.getContext(workflowId);
    if (!profile) return "";

    return [
      "## User Foundational Profile (from Onboarding)",
      profile.profession ? `- **Profession**: ${profile.profession}` : null,
      profile.longTermGoal ? `- **Long-term Goal**: ${profile.longTermGoal}` : null,
      profile.currentFocus ? `- **Current Focus**: ${profile.currentFocus}` : null,
      profile.motivation ? `- **Motivation**: ${profile.motivation}` : null,
      profile.dailyAvailability ? `- **Daily Availability**: ${profile.dailyAvailability}` : null,
      profile.workStyle ? `- **Working Style**: ${profile.workStyle}` : null,
      profile.biggestChallenge ? `- **Biggest Challenge**: ${profile.biggestChallenge}` : null,
    ]
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  /**
   * Formats ranked user memories for companion injection
   */
  public static formatMemoryPrompt(workflowId: string): string {
    const { memories } = this.getContext(workflowId);
    // Limit to companion budget of 5 memories
    const budgeted = memories.slice(0, 5);
    if (budgeted.length === 0) return "";

    const memoryBlocks = budgeted.map((mem) => {
      return `- ${mem.summary} (Category: ${mem.category}, Detail: ${mem.content})`;
    });

    return `
## User Context (From Zenkai Memory)
Below is important long-term context Zenkai has remembered about the user. Use this to tailor your response, address their goals, and personalize their growth journey. Do NOT quote this info robotically. Integrate it naturally.

${memoryBlocks.join("\n")}
`.trim();
  }

  /**
   * Formats active identity traits for tone adaptation
   */
  public static formatIdentityPrompt(workflowId: string): string {
    const { identity } = this.getContext(workflowId);
    const traits = identity.activeTraits;
    if (traits.length === 0) return "";

    const traitLines = traits.map((t) => {
      const confidencePercent = Math.round(t.confidence * 100);
      const stabilityPercent = Math.round(t.stability * 100);
      return `- **${t.trait}** (${t.category}): ${t.description} (Confidence: ${confidencePercent}%, Stability: ${stabilityPercent}%)`;
    });

    return `
## User Identity Profile (Self-Awareness Context)
Zenkai has synthesized the following active identity blueprint about the user. Use these traits to subtly adapt your conversational tone, recommendations, and guiding style.

Traits Profile:
${traitLines.join("\n")}

Directives for tone adaptation based on categories:
- **core_identity**: Shape your overall lens. A "Builder" values prototypes and actions; a "Student" values learning and clarity; a "Deep Thinker" values reflection and depth.
- **aspiration**: Direct user attention toward these outcomes. Help them realize their goals.
- **principle**: Align your support style with these values.
- **behavior_pattern**: Tailor your responses to account for these (e.g. procrastination under overwhelm).
- **current_state**: Reference their current focus areas naturally.

CRITICAL TONE RULES:
1. Do NOT explicitly tell the user that you are adapting to their identity (e.g. never say "Because you are a Builder...", "As an AI Entrepreneur...").
2. Do NOT mention the names of these identity traits directly in conversation unless requested. The adaptation must remain completely invisible to the user.
`.trim();
  }

  /**
   * Formats active behavioral reflections
   */
  public static formatReflectionPrompt(workflowId: string): string {
    const { reflections } = this.getContext(workflowId);
    if (reflections.length === 0) return "";

    const reflectionLines = reflections.map((r) => {
      const confidencePercent = Math.round(r.confidence * 100);
      const stabilityPercent = Math.round(r.stability * 100);
      return `- **${r.title}** (${r.category}): ${r.content} (Confidence: ${confidencePercent}%, Stability: ${stabilityPercent}%)`;
    });

    return `
## User Behavioral Reflections (Distilled Wisdom Context)
Zenkai has observed the following recurring behavioral, learning, and productivity patterns about the user over time:
${reflectionLines.join("\n")}

Directives for tone and recommendation adaptation:
1. Subtly guide the user using these reflections. For example, if a reflection notes they overcommit or learn best by building, naturally nudge them to break tasks down or suggest small hands-on projects.
2. Keep it invisible. Never say "According to my reflections...".
`.trim();
  }

  /**
   * Formats a lightweight summary of the active plan for companion general awareness.
   * This excludes the heavy task lists, saving huge amounts of tokens.
   */
  public static formatActivePlanOverviewPrompt(workflowId: string): string {
    const { activePlan } = this.getContext(workflowId);
    if (!activePlan) return "";

    let currentMilestoneStr = "None";
    const inProgress = activePlan.milestones.find((m) => m.status === "in_progress");
    const nextTodo = activePlan.milestones.find((m) => m.status === "todo");
    const m = inProgress || nextTodo;
    if (m) {
      currentMilestoneStr = `"${m.title}" (${m.category}, Status: ${m.status}, Dates: ${m.startDate || "N/A"} to ${m.endDate || "N/A"})`;
    }

    return `
## Active Plan Overview (Situational Awareness)
You are aware that the user is currently working on the following roadmap. Do NOT show this list to the user unless they ask about it.
- **Active Plan**: "${activePlan.title}" (${activePlan.type}, Progress: ${activePlan.progress}%)
- **Plan Description**: "${activePlan.description}"
- **Current Milestone Focus**: ${currentMilestoneStr}
- **Active Goals Count**: ${activePlan.milestones.reduce((acc, m) => acc + m.goals.filter(g => g.status === 'active').length, 0)} goals
`.trim();
  }

  /**
   * Formats daily agenda prompt context from cache
   */
  public static formatDailyAgendaPrompt(workflowId: string, todayStr: string): string {
    const ctx = this.getContext(workflowId);
    const schedule = ctx.weeklySchedule;
    if (!schedule) return "";

    const agenda = schedule.days.find(d => d.date === todayStr);
    if (!agenda) return "";

    // Flat map of all tasks from activePlan
    const taskMap = new Map<string, any>();
    ctx.activePlan?.milestones.forEach(m => {
      m.goals.forEach(g => {
        g.tasks.forEach(t => {
          taskMap.set(t.id, t);
        });
      });
    });

    const formattedBlocks = agenda.workBlocks.map(wb => {
      const taskTitles = wb.tasks.map(id => {
        const t = taskMap.get(id);
        return t ? `- ${t.title} (${t.status})` : `- Unknown Task (${id})`;
      }).join("\n");

      return `Block: ${wb.title} (${wb.startTime} - ${wb.endTime})\nTasks:\n${
        taskTitles || "No tasks scheduled"
      }`;
    });

    return [
      `## Today's Daily Agenda (Execution Plan):`,
      `Date: ${agenda.date}`,
      `Focus Theme: "${agenda.focusTheme || "General focus"}"`,
      `Estimated Workload: "${agenda.estimatedWorkload || "Medium"}"`,
      `Planned Focus Time: ${agenda.plannedFocusHours} hours`,
      "",
      `Suggested Work Blocks & Tasks:`,
      formattedBlocks.join("\n\n"),
      "",
      `INSTRUCTIONS FOR COMPANION AGENT:`,
      `- Address the user's execution query by explaining what is on their agenda today.`,
      `- Reference their focus theme, workload, work blocks, and task priorities.`,
      `- Do NOT talk about long-term roadmaps. Keep attention on "Today's Agenda".`,
      `- Speak naturally. Do NOT say "according to the execution agent" or "your daily agenda".`
    ].join("\n");
  }
}
