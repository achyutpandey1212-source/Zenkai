import { GoogleGenAI } from "@google/genai";
import { Plan, IPlan } from "@/models/Plan";
import { Milestone, IMilestone } from "@/models/Milestone";
import { Goal, IGoal } from "@/models/Goal";
import { Task, ITask } from "@/models/Task";
import { ProfileRepository } from "@/repositories/profile.repository";
import { MemoryRepository } from "@/repositories/memory.repository";
import { IdentityRepository } from "@/repositories/identity.repository";
import { ReflectionRepository } from "@/repositories/reflection.repository";
import { PlanRepository } from "@/repositories/plan.repository";
import { Types } from "mongoose";
import type { GraphState } from "@/orchestration/graph/state";

// Re-exported so chat route can import them
export type LifeEvent = {
  type: "exam" | "deadline" | "project" | "goal" | "event" | "constraint" | "career" | "habit";
  title: string;
  date?: string;
  description: string;
};

export type LifeEventExtraction = {
  hasActionableContent: boolean;
  suggestsPlanning: boolean;
  extractionReason: string;
  detectedEvents: LifeEvent[];
};

export type PlanningIntent = {
  type: "create_or_modify" | "task_update" | "execution_inquiry" | "none";
  taskTitle?: string;
  taskStatus?: "completed" | "in_progress" | "todo";
  planType?: "career" | "learning" | "exams" | "projects" | "fitness" | "habits" | "business" | "personal";
  goalTitle?: string;
  details?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// LIFE EVENT EXTRACTION PROMPT
// ─────────────────────────────────────────────────────────────────────────────
const LIFE_EVENT_EXTRACTION_PROMPT = `
You are a context extractor for Zenkai, an AI growth companion.

Your job is to silently analyse every user message and determine whether it contains structured, actionable life information that Zenkai should autonomously act on — WITHOUT the user explicitly asking for a plan.

Every user message is an opportunity for autonomous work.

Detect these life signals:
- Upcoming exams, tests, or assessments (with or without dates)
- Project deadlines or submission dates
- Career goals, job/internship targets, placements
- Skill or learning goals ("I want to learn X", "I need to clear Y", "I'm preparing for Z")
- Events, hackathons, meetups, interviews scheduled
- Habits the user wants to build or break
- Constraints ("I only have 2 hours a day", "I'm available on weekends only")
- Long-term goals or aspirations shared in passing

Rules:
- If the message is purely casual conversation ("hey", "thanks", "how are you", small talk), set hasActionableContent: false, suggestsPlanning: false.
- If the message contains ANY of the above life signals — even implicitly — set hasActionableContent: true.
- Set suggestsPlanning: true if Zenkai should proactively create or update a roadmap based on this message.
- Always provide a brief extractionReason explaining your decision.

Return a JSON object matching the schema.
`;

// ─────────────────────────────────────────────────────────────────────────────
// INTENT DETECTION PROMPT
// ─────────────────────────────────────────────────────────────────────────────
const INTENT_DETECTION_SYSTEM_PROMPT = `
You are the Intent Detection Agent for Zenkai's Planning Engine.
Your job is to analyse the user's latest message and recent conversation history to classify intent.

Classifications:
1. "create_or_modify" — User wants to create a new plan or evolve an existing roadmap/study plan/project/career goal. Examples: "I want to become an SDE", "Plan my semester", "Help me prepare for placements", "I no longer want to build a startup", sharing exam dates/schedules, describing academic or career goals.
2. "task_update" — User is updating the status of a specific, named task. Examples: "I've completed Arrays", "I finished my revision task", "I am working on Linked Lists now". IMPORTANT: Only classify as task_update if a SPECIFIC named task is mentioned.
3. "execution_inquiry" — User is asking what to do TODAY specifically. Examples: "What should I do today?", "What should I study?", "Plan my day", "What's on my agenda?".
4. "none" — Standard conversation with no planning, task, or execution relevance.

For "create_or_modify": identify planType ("career" | "learning" | "exams" | "projects" | "fitness" | "habits" | "business" | "personal") and a descriptive goalTitle.
For "task_update": extract the EXACT taskTitle and taskStatus ("completed" | "in_progress" | "todo"). Leave taskTitle empty string if no specific task name is mentioned.

Return a JSON object matching the requested schema.
`;

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED ROUTER & EXTRACTION PROMPT
// ─────────────────────────────────────────────────────────────────────────────
const MERGED_ROUTER_SYSTEM_PROMPT = `
You are the Unified Routing and Extraction Agent for Zenkai's Growth Engine.
Your job is to analyse the user's latest message and recent conversation history to perform intent classification AND life event extraction in a single, unified pass.

PART 1: INTENT CLASSIFICATION
Classifications:
1. "create_or_modify" — User wants to create a new plan or evolve an existing roadmap/study plan/project/career goal. Examples: "I want to become an SDE", "Plan my semester", "Help me prepare for placements", "I no longer want to build a startup", sharing exam dates/schedules, describing academic or career goals.
2. "task_update" — User is updating the status of a specific, named task. Examples: "I've completed Arrays", "I finished my revision task", "I am working on Linked Lists now". IMPORTANT: Only classify as task_update if a SPECIFIC named task is mentioned.
3. "execution_inquiry" — User is asking what to do TODAY specifically. Examples: "What should I do today?", "What should I study?", "Plan my day", "What's on my agenda?".
4. "none" — Standard conversation with no planning, task, or execution relevance.

For "create_or_modify": identify planType ("career" | "learning" | "exams" | "projects" | "fitness" | "habits" | "business" | "personal") and a goalTitle (short, descriptive goal).
For "task_update": extract the EXACT taskTitle and taskStatus ("completed" | "in_progress" | "todo"). Leave taskTitle empty string if no specific task name is mentioned.

PART 2: LIFE EVENT EXTRACTION
Silently determine whether the message contains structured, actionable life information that Zenkai should autonomously act on — WITHOUT the user explicitly asking for a plan.
Detect these life signals:
- Upcoming exams, tests, or assessments (with or without dates)
- Project deadlines or submission dates
- Career goals, job/internship targets, placements
- Skill or learning goals ("I want to learn X", "I need to clear Y", "I'm preparing for Z")
- Events, hackathons, meetups, interviews scheduled
- Habits the user wants to build or break
- Constraints ("I only have 2 hours a day", "I'm available on weekends only")
- Long-term goals or aspirations shared in passing

Rules:
- If the message contains ANY of the above life signals — even implicitly — set hasActionableContent: true.
- Set suggestsPlanning: true if Zenkai should proactively create or update a roadmap based on this message. (Note: If suggestsPlanning is true, the intentType should generally be "create_or_modify").

You must return a JSON response matching the requested schema.
`;

const PLANNER_SYSTEM_PROMPT = `
You are the Strategy and Execution Planning Agent for Zenkai.
Your mission is to build, merge, or evolve a structured, chronological roadmap for the user.

A plan is represented as a 4-tier hierarchy:
Plan -> Milestones -> Goals -> Tasks

Every level contains:
- title: concise, active wording.
- description: clear details of what this level entails.
- status:
  - Plan: "active" | "completed" | "archived"
  - Milestone: "todo" | "in_progress" | "completed" | "cancelled"
  - Goal: "active" | "completed" | "paused" | "cancelled"
  - Task: "todo" | "in_progress" | "completed" | "missed"
- priority: integer where 1 is highest priority.
- estimatedDuration: string indicating duration (e.g., "4 weeks", "10 hours", "2 days").

DOMAIN-AWARE STRATEGY INFERENCES:
Analyze the user's profile context (profession, long-term goals, current focus) and determine their active domain. Customize the planning strategy, milestones, and task blocks based on the active domain:
1. **Student / Academic**: Focus on syllabus breakdown, concept building, study blocks, mock exams, and exam preparation.
2. **Software Engineer / Tech**: Structure around development cycles: architecture design, sprint iterations, epic building, testing, documentation, and deployment.
3. **Founder / Entrepreneur**: Focus on strategic priorities, business validation, MVP creation, investor meetings, customer feedback loops, and daily execution sprints.
4. **Content Creator**: Focus on creation pipelines: brainstorming, scripting, storyboarding, shooting, video editing, publishing, and social media outreach.
5. **Job Seeker**: Structure around application pipeline sprints: resume optimization, portfolio review, mock interviews, cold outreach, and skill building.
6. **Freelancer**: Focus on client delivery: scope gathering, milestone iterations, feedback collection, final delivery, and billing setup.

URGENCY-BASED STUDY ROADMAP DIRECTIVES (For Students):
When scheduling academic study and exam prep, you must adapt tasks dynamically to the time remaining before the exam date:
- **Exam > 30 days away**: Focus on build concepts, read textbooks/lectures, complete syllabus, and build long-term consistency.
- **Exam 10–30 days away**: Focus on finishing remaining topics, transition to PYQs (Previous Year Questions), and initiate weekly revision cycles.
- **Exam 3–7 days away**: Prioritize PYQs, identify repeated exam patterns, create/review formula sheets, focus on high-weightage chapters, and prioritize practice/retrieval over passive reading.
- **Exam tomorrow**: Revision/retrieval only, review mistakes notebook, read formula sheets, rest.
- **Strict constraint**: Never generate unrealistic or physically impossible advice (e.g., scheduling 40 hours of lecture watching or reading the night before an exam). Be highly practical and respect daily availability limits.

CHRONOLOGICAL TIMELINE DIRECTIVES:
- Every milestone must occupy an actual place on the timeline, marked with:
  - startDate: "YYYY-MM-DD"
  - endDate: "YYYY-MM-DD"
- Every task must contain:
  - suggestedDate: "YYYY-MM-DD"
  - timeBlock: optional time slot string (e.g. "09:00 AM - 10:30 AM" or empty)
- Every milestone must be categorized into exactly one of the following activity categories:
  - Exam, Study, Hackathon, Meetup, Content Creation, Startup, Coding, Reading, Fitness, Interview, Personal

SMART CONSTRAINTS (IMPORTANCE & FLEXIBILITY):
- Classify events as Hard Constraints (e.g. Exams, Job Interviews, Medical appointments) or Soft Constraints (e.g. Meetups, Hackathons, Study sessions, Fitness, Content Creation, etc.).
- Hard constraints have: importance: 10, flexibility: 0. They cannot move.
- Soft constraints have flexible dates and lower importance (e.g. importance: 4-8, flexibility: 5-9).
- You must schedule study and flexible milestones around hard constraints. For example, if there is an exam on July 6th, and a buildathon on July 5th-6th, digital communication exam preparation must be scheduled *before* the buildathon, and post-exam goals (like YouTube content creation) must start *strictly after* the exam period ends on July 9th.

CORE DIRECTIVES FOR EVOLUTION & MERGING:
- Zenkai plans are living systems. Do NOT recreate them from scratch.
- If evolving an existing plan, PRESERVE the exact database "id" (re-mapped to "id" field in JSON) for existing Plans, Milestones, Goals, and Tasks. Omit the "id" field ONLY for brand new items.
- If the user cancels or removes an event (e.g. "I am no longer attending the AIC meetup"), find its milestone and set its status to "cancelled". Do NOT remove it from the list — let it stay in the payload as "cancelled" so history preserves it.
- In addition to the "plan" tree, you must return:
  - plannerReasoning: Explaining how you resolved conflicts, rescheduled tasks, and respected hard/soft constraints.
  - changeSummary: A concise description of the revision (e.g., "Cancelled AIC Developers Meet and rescheduled YouTube sprint").
  - detectedConstraints: Summary of identified hard and soft constraints.
  - mergeStrategy: Summary of how you preserved progress while updating dates.
  - timelineRecalculation: Explanation of chronological date shifts.

Return a JSON object containing the plan tree and these diagnostic details.
`;

export class PlanningAgent {
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
   * Deterministically classifies common casual messages (greetings, thanks, acknowledgements)
   * or simple task updates to bypass Gemini router calls completely.
   */
  static detectLocalIntentShortcut(
    message: string,
    history: { role: "user" | "model"; content: string }[]
  ): { intent: PlanningIntent; lifeEvents: LifeEventExtraction; budget: number } | null {
    const text = message.trim().toLowerCase();

    // Helper patterns
    const greetings = ["hi", "hello", "hey", "yo", "sup", "greetings", "good morning", "good afternoon", "good evening"];
    const thanks = ["thanks", "thank you", "thankyou", "thx", "appreciate it"];
    const acknowledgements = ["ok", "okay", "yep", "yup", "sure", "cool", "nice", "awesome", "great", "perfect", "got it", "fine", "indeed"];

    const isGreeting = greetings.includes(text) || greetings.some(g => text.startsWith(g + " "));
    const isThanks = thanks.includes(text) || thanks.some(th => text.startsWith(th + " "));
    const isAck = acknowledgements.includes(text) || text.length <= 3;
    const isEmoji = /^[\p{Emoji_Presentation}\p{Emoji}\u200d\uFE0F\s]+$/u.test(text);

    if (isGreeting || isThanks || isAck || isEmoji) {
      // Make the AI budget configurable per workflow type rather than hardcoded. For example:
      // Greeting: 2
      // General chat: 3
      // Planning: 5
      // Future premium workflows can increase this budget without changing orchestration logic.
      const budget = isGreeting ? 2 : 3;
      return {
        intent: { type: "none", details: "Deterministic casual classification" },
        lifeEvents: {
          hasActionableContent: false,
          suggestsPlanning: false,
          extractionReason: "Deterministic casual bypass",
          detectedEvents: []
        },
        budget
      };
    }

    // Deterministic task updates
    const completedPatterns = [
      /^(?:i\s+)?(?:completed|finished|done\s+with|marked|checked)\s+([a-zA-Z0-9\s-_]{3,50})$/i,
      /^([a-zA-Z0-9\s-_]{3,50})\s+(?:is\s+)?(?:completed|finished|done|checked)$/i
    ];

    const todoPatterns = [
      /^(?:i\s+)?(?:unchecked|reset|reopened)\s+([a-zA-Z0-9\s-_]{3,50})$/i,
      /^([a-zA-Z0-9\s-_]{3,50})\s+(?:is\s+)?(?:unchecked|reset|reopened)$/i
    ];

    for (const pat of completedPatterns) {
      const match = text.match(pat);
      if (match) {
        return {
          intent: {
            type: "task_update",
            taskTitle: match[1].trim(),
            taskStatus: "completed",
            details: "Deterministic task completion bypass"
          },
          lifeEvents: {
            hasActionableContent: false,
            suggestsPlanning: false,
            extractionReason: "Deterministic task update bypass",
            detectedEvents: []
          },
          budget: 3 // Task updates are general chat level budget
        };
      }
    }

    for (const pat of todoPatterns) {
      const match = text.match(pat);
      if (match) {
        return {
          intent: {
            type: "task_update",
            taskTitle: match[1].trim(),
            taskStatus: "todo",
            details: "Deterministic task reopening bypass"
          },
          lifeEvents: {
            hasActionableContent: false,
            suggestsPlanning: false,
            extractionReason: "Deterministic task update bypass",
            detectedEvents: []
          },
          budget: 3
        };
      }
    }

    return null;
  }

  /**
   * Merged Gemini API call that detects both intent and life events in a single call.
   */
  static async detectIntentAndExtractLifeEvents(
    message: string,
    history: { role: "user" | "model"; content: string }[]
  ): Promise<{ intent: PlanningIntent; lifeEvents: LifeEventExtraction; budget: number }> {
    try {
      const ai = this.getClient();
      const chatHistoryText = history
        .slice(-6)
        .map((h) => `${h.role === "user" ? "User" : "Zenkai"}: ${h.content}`)
        .join("\n");

      const prompt = `
Conversation History:
\${chatHistoryText}

Latest Message:
User: \${message}

Determine the intent and extract any life events:
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: MERGED_ROUTER_SYSTEM_PROMPT.trim(),
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              intentType: {
                type: "STRING",
                enum: ["create_or_modify", "task_update", "execution_inquiry", "none"],
              },
              taskTitle: { type: "STRING" },
              taskStatus: { type: "STRING" },
              planType: { type: "STRING" },
              goalTitle: { type: "STRING" },
              details: { type: "STRING" },
              lifeEvents: {
                type: "OBJECT",
                properties: {
                  hasActionableContent: { type: "BOOLEAN" },
                  suggestsPlanning: { type: "BOOLEAN" },
                  extractionReason: { type: "STRING" },
                  detectedEvents: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        type: {
                          type: "STRING",
                          enum: ["exam", "deadline", "project", "goal", "event", "constraint", "career", "habit"],
                        },
                        title: { type: "STRING" },
                        date: { type: "STRING" },
                        description: { type: "STRING" },
                      },
                      required: ["type", "title", "description"],
                    },
                  },
                },
                required: ["hasActionableContent", "suggestsPlanning", "extractionReason", "detectedEvents"],
              },
            },
            required: ["intentType", "lifeEvents"],
          },
        },
      });

      const text = response.text;
      if (!text) {
        return {
          intent: { type: "none" },
          lifeEvents: { hasActionableContent: false, suggestsPlanning: false, extractionReason: "No response", detectedEvents: [] },
          budget: 3
        };
      }

      const parsed = JSON.parse(text) as {
        intentType: "create_or_modify" | "task_update" | "execution_inquiry" | "none";
        taskTitle?: string;
        taskStatus?: string;
        planType?: string;
        goalTitle?: string;
        details?: string;
        lifeEvents: {
          hasActionableContent: boolean;
          suggestsPlanning: boolean;
          extractionReason: string;
          detectedEvents: LifeEvent[];
        };
      };

      const validTaskStatuses = ["completed", "in_progress", "todo"];
      const validPlanTypes = ["career", "learning", "exams", "projects", "fitness", "habits", "business", "personal"];

      const intent: PlanningIntent = {
        type: parsed.intentType,
        taskTitle: parsed.taskTitle,
        taskStatus: validTaskStatuses.includes(parsed.taskStatus || "")
          ? (parsed.taskStatus as "completed" | "in_progress" | "todo")
          : undefined,
        planType: validPlanTypes.includes(parsed.planType || "")
          ? (parsed.planType as PlanningIntent["planType"])
          : undefined,
        goalTitle: parsed.goalTitle,
        details: parsed.details,
      };

      // Safety guard: task_update requires a non-empty taskTitle
      if (intent.type === "task_update" && !intent.taskTitle?.trim()) {
        intent.type = "none";
      }

      // Make the AI budget configurable per workflow type rather than hardcoded. For example:
      // Greeting: 2
      // General chat: 3
      // Planning: 5
      // Future premium workflows can increase this budget without changing orchestration logic.
      let budget = 3;
      if (intent.type === "create_or_modify" || parsed.lifeEvents.suggestsPlanning) {
        budget = 5;
      }

      return {
        intent,
        lifeEvents: parsed.lifeEvents,
        budget
      };
    } catch (error) {
      console.error("[PlanningAgent] Unified intent and extraction error:", error);
      return {
        intent: { type: "none" },
        lifeEvents: { hasActionableContent: false, suggestsPlanning: false, extractionReason: "Extraction failed", detectedEvents: [] },
        budget: 3
      };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LIFE EVENT EXTRACTION
  // ───────────────────────────────────────────────────────────────────────────
  /**
   * Fast, lightweight extraction pass on every user message.
   * Detects whether the message contains actionable life context (exams, goals,
   * deadlines, constraints) and whether Zenkai should autonomously trigger planning.
   * Every user message is an opportunity for autonomous work.
   */
  static async extractLifeEvents(message: string): Promise<LifeEventExtraction> {
    try {
      const ai = this.getClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: `Analyse this message:\n"${message}"` }] }],
        config: {
          systemInstruction: LIFE_EVENT_EXTRACTION_PROMPT.trim(),
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              hasActionableContent: { type: "BOOLEAN" },
              suggestsPlanning: { type: "BOOLEAN" },
              extractionReason: { type: "STRING" },
              detectedEvents: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    type: {
                      type: "STRING",
                      enum: ["exam", "deadline", "project", "goal", "event", "constraint", "career", "habit"],
                    },
                    title: { type: "STRING" },
                    date: { type: "STRING" },
                    description: { type: "STRING" },
                  },
                  required: ["type", "title", "description"],
                },
              },
            },
            required: ["hasActionableContent", "suggestsPlanning", "extractionReason", "detectedEvents"],
          },
        },
      });

      const text = response.text;
      if (!text) {
        return { hasActionableContent: false, suggestsPlanning: false, extractionReason: "No response", detectedEvents: [] };
      }
      return JSON.parse(text) as LifeEventExtraction;
    } catch (error) {
      console.error("[PlanningAgent] Life event extraction error:", error);
      return { hasActionableContent: false, suggestsPlanning: false, extractionReason: "Extraction failed", detectedEvents: [] };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // INTENT DETECTION
  // ───────────────────────────────────────────────────────────────────────────
  /**
   * Detect planning or task update intent.
   * If life event extraction already flagged planning, skips the Gemini call (saves ~1-2s).
   */
  static async detectIntent(
    message: string,
    history: { role: "user" | "model"; content: string }[],
    lifeEvents?: LifeEventExtraction
  ): Promise<PlanningIntent> {
    try {
      // Fast-path: life event extraction already determined planning is needed
      if (lifeEvents?.suggestsPlanning) {
        console.log(
          `[PlanningAgent] Life events suggest planning (${lifeEvents.extractionReason}). Fast-pathing to create_or_modify.`
        );
        return { type: "create_or_modify", details: lifeEvents.extractionReason };
      }

      const ai = this.getClient();
      const chatHistoryText = history
        .slice(-6)
        .map((h) => `${h.role === "user" ? "User" : "Zenkai"}: ${h.content}`)
        .join("\n");

      const prompt = `
Conversation History:
${chatHistoryText}

Latest Message:
User: ${message}

Determine the intent:
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: INTENT_DETECTION_SYSTEM_PROMPT.trim(),
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              intentType: {
                type: "STRING",
                enum: ["create_or_modify", "task_update", "execution_inquiry", "none"],
              },
              taskTitle: { type: "STRING" },
              taskStatus: { type: "STRING" },
              planType: { type: "STRING" },
              goalTitle: { type: "STRING" },
              details: { type: "STRING" },
            },
            required: ["intentType"],
          },
        },
      });

      const text = response.text;
      if (!text) return { type: "none" };

      const parsed = JSON.parse(text) as {
        intentType: "create_or_modify" | "task_update" | "execution_inquiry" | "none";
        taskTitle?: string;
        taskStatus?: string;
        planType?: string;
        goalTitle?: string;
        details?: string;
      };

      // Safety guard: task_update requires a non-empty taskTitle
      if (parsed.intentType === "task_update" && !parsed.taskTitle?.trim()) {
        console.warn("[PlanningAgent] task_update detected but no taskTitle extracted. Falling back to none.");
        return { type: "none" };
      }

      const validTaskStatuses = ["completed", "in_progress", "todo"];
      const validPlanTypes = ["career", "learning", "exams", "projects", "fitness", "habits", "business", "personal"];

      return {
        type: parsed.intentType,
        taskTitle: parsed.taskTitle,
        taskStatus: validTaskStatuses.includes(parsed.taskStatus || "")
          ? (parsed.taskStatus as "completed" | "in_progress" | "todo")
          : undefined,
        planType: validPlanTypes.includes(parsed.planType || "")
          ? (parsed.planType as PlanningIntent["planType"])
          : undefined,
        goalTitle: parsed.goalTitle,
        details: parsed.details,
      };
    } catch (error) {
      console.error("[PlanningAgent] Intent detection error:", error);
      return { type: "none" };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PLAN GENERATION / EVOLUTION
  // ───────────────────────────────────────────────────────────────────────────
  /**
   * Generate or evolve a plan. Returns plan stats on success, null on failure.
   */
  static async generateOrEvolvePlan(
    uid: string,
    intent: PlanningIntent,
    userMessage: string,
    lifeEvents?: LifeEventExtraction,
    state?: GraphState
  ): Promise<{ success: boolean; milestonesCreated: number; tasksCreated: number } | null> {
    const startTime = Date.now();
    try {
      console.log(`[PlanningAgent] Executing plan generation/evolution for user ${uid}`);
      // 1. Fetch user context — reuse GraphState if available to avoid duplicate DB reads
      const profile = state?.profile ?? await ProfileRepository.findByFirebaseUid(uid);
      
      // Use pruned top-N memories from GraphState, falls back to full list
      const memories = state?.memoryContext?.memories ?? await MemoryRepository.findApprovedByUser(uid);
      
      const traits = (state?.activeTraits && state.activeTraits.length > 0) 
        ? state.activeTraits 
        : await IdentityRepository.findActiveByUser(uid);
        
      const reflections = (state?.activeReflections && state.activeReflections.length > 0) 
        ? state.activeReflections 
        : await ReflectionRepository.findActiveByUser(uid);
        
      const existingPlans = (state?.activePlans && state.activePlans.length > 0) 
        ? state.activePlans 
        : await PlanRepository.findFullTree(uid);

      // Prune existingPlans to strip heavy fields like history and diagnostics
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prunedPlans = existingPlans.map((p: any) => ({
        id: p._id?.toString() || p.id,
        title: p.title,
        description: p.description || "",
        status: p.status,
        priority: p.priority,
        estimatedDuration: p.estimatedDuration,
        type: p.type,
        progress: p.progress,
        milestones: (p.milestones || []).map((m: any) => ({
          id: m._id?.toString() || m.id,
          title: m.title,
          description: m.description || "",
          status: m.status,
          priority: m.priority,
          estimatedDuration: m.estimatedDuration,
          category: m.category,
          startDate: m.startDate,
          endDate: m.endDate,
          progress: m.progress,
          goals: (m.goals || []).map((g: any) => ({
            id: g._id?.toString() || g.id,
            title: g.title,
            description: g.description || "",
            status: g.status,
            priority: g.priority,
            progress: g.progress,
            tasks: (g.tasks || []).map((t: any) => ({
              id: t._id?.toString() || t.id,
              title: t.title,
              description: t.description || "",
              status: t.status,
              priority: t.priority,
              suggestedDate: t.suggestedDate,
              timeBlock: t.timeBlock,
              dependencies: t.dependencies,
            })),
          })),
        })),
      }));

      // 2. Format context for prompt
      const lifeEventsContext = lifeEvents?.detectedEvents?.length
        ? `\nDetected Life Events (auto-extracted):\n${JSON.stringify(lifeEvents.detectedEvents, null, 2)}\n`
        : "";

      const contextPrompt = `
User Profile:
- Long-term goal: ${profile?.longTermGoal || "None"}
- Profession: ${profile?.profession || "None"}
- Current Focus: ${profile?.currentFocus || "None"}
- Peak focus availability: ${profile?.dailyAvailability || "None"}
- Working Style: ${profile?.workStyle || "None"}

Memories:
${JSON.stringify(memories.map((m) => m.summary), null, 2)}

Active Traits:
${JSON.stringify(traits.map((t) => ({ trait: t.trait, description: t.description })), null, 2)}

Active Reflections:
${JSON.stringify(reflections.map((r) => ({ title: r.title, summary: r.summary })), null, 2)}
${lifeEventsContext}
Existing Plans Tree (Pruned):
${JSON.stringify(prunedPlans, null, 2)}
`;

      const prompt = `
User Context:
${contextPrompt}

Latest User request: "${userMessage}"
Detected Intent Details: ${JSON.stringify(intent)}

Create a new plan or modify/evolve an existing plan based on the request.
Remember:
- If a plan is for a goal/career/project the user no longer wants, mark its status as "archived" and create a new plan.
- If evolving an existing plan, PRESERVE the exact database "id" for existing Plans, Milestones, Goals, and Tasks.
- Break the plan down into Milestones. Each Milestone must have Goals. Each Goal must have actionable Tasks.
- Every milestone MUST have startDate, endDate, category, importance, flexibility.
- Every task MUST have suggestedDate (YYYY-MM-DD).
`;

      const ai = this.getClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: PLANNER_SYSTEM_PROMPT.trim(),
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              // ── Diagnostic fields MUST be in properties AND required ──
              plannerReasoning: { type: "STRING" },
              changeSummary: { type: "STRING" },
              detectedConstraints: { type: "STRING" },
              mergeStrategy: { type: "STRING" },
              timelineRecalculation: { type: "STRING" },
              // ── Plan tree ──
              plan: {
                type: "OBJECT",
                properties: {
                  id: { type: "STRING" },
                  title: { type: "STRING" },
                  description: { type: "STRING" },
                  status: { type: "STRING", enum: ["active", "completed", "archived"] },
                  priority: { type: "NUMBER" },
                  estimatedDuration: { type: "STRING" },
                  type: {
                    type: "STRING",
                    enum: ["career", "learning", "exams", "projects", "fitness", "habits", "business", "personal"],
                  },
                  milestones: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        id: { type: "STRING" },
                        title: { type: "STRING" },
                        description: { type: "STRING" },
                        status: { type: "STRING", enum: ["todo", "in_progress", "completed", "cancelled"] },
                        priority: { type: "NUMBER" },
                        estimatedDuration: { type: "STRING" },
                        startDate: { type: "STRING" },
                        endDate: { type: "STRING" },
                        category: {
                          type: "STRING",
                          enum: [
                            "Exam",
                            "Study",
                            "Hackathon",
                            "Meetup",
                            "Content Creation",
                            "Startup",
                            "Coding",
                            "Reading",
                            "Fitness",
                            "Interview",
                            "Personal",
                          ],
                        },
                        importance: { type: "NUMBER" },
                        flexibility: { type: "NUMBER" },
                        goals: {
                          type: "ARRAY",
                          items: {
                            type: "OBJECT",
                            properties: {
                              id: { type: "STRING" },
                              title: { type: "STRING" },
                              description: { type: "STRING" },
                              status: { type: "STRING", enum: ["active", "completed", "paused", "cancelled"] },
                              priority: { type: "NUMBER" },
                              estimatedDuration: { type: "STRING" },
                              tasks: {
                                type: "ARRAY",
                                items: {
                                  type: "OBJECT",
                                  properties: {
                                    id: { type: "STRING" },
                                    title: { type: "STRING" },
                                    description: { type: "STRING" },
                                    status: { type: "STRING", enum: ["todo", "in_progress", "completed", "missed"] },
                                    priority: { type: "NUMBER" },
                                    estimatedDuration: { type: "STRING" },
                                    suggestedDate: { type: "STRING" },
                                    timeBlock: { type: "STRING" },
                                    dependencies: {
                                      type: "ARRAY",
                                      items: { type: "STRING" },
                                    },
                                  },
                                  required: ["title", "status", "priority", "estimatedDuration", "suggestedDate"],
                                },
                              },
                            },
                            required: ["title", "status", "priority", "estimatedDuration", "tasks"],
                          },
                        },
                      },
                      required: [
                        "title",
                        "status",
                        "priority",
                        "estimatedDuration",
                        "startDate",
                        "endDate",
                        "category",
                        "importance",
                        "flexibility",
                        "goals",
                      ],
                    },
                  },
                },
                required: ["title", "status", "priority", "estimatedDuration", "type", "milestones"],
              },
            },
            required: [
              "plan",
              "plannerReasoning",
              "changeSummary",
              "detectedConstraints",
              "mergeStrategy",
              "timelineRecalculation",
            ],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) return null;

      const result = JSON.parse(responseText) as {
        plan: any;
        plannerReasoning: string;
        changeSummary: string;
        detectedConstraints: string;
        mergeStrategy: string;
        timelineRecalculation: string;
      };
      const normalizedPlan = result.plan;
      const executionTimeMs = Date.now() - startTime;

      // Track stats
      let totalTasksCreated = 0;
      let totalMilestonesCreated = 0;

      // 3. Persist to Database
      let planDoc: any;
      const diagnostics = {
        planningPrompt: prompt,
        rawGeminiOutput: responseText,
        normalizedPlan: JSON.stringify(normalizedPlan, null, 2),
        executionTimeMs,
        plannerReasoning: result.plannerReasoning,
        detectedConstraints: result.detectedConstraints,
        mergeStrategy: result.mergeStrategy,
        timelineRecalculation: result.timelineRecalculation,
      };

      if (normalizedPlan.id && Types.ObjectId.isValid(normalizedPlan.id)) {
        // Update existing plan
        planDoc = await Plan.findByIdAndUpdate(
          normalizedPlan.id,
          {
            $set: {
              title: normalizedPlan.title,
              description: normalizedPlan.description || "",
              status: normalizedPlan.status,
              priority: normalizedPlan.priority,
              estimatedDuration: normalizedPlan.estimatedDuration,
              type: normalizedPlan.type,
              diagnostics,
            },
          },
          { returnDocument: "after" }
        );
      } else {
        // Create new plan
        planDoc = await Plan.create({
          firebaseUid: uid,
          title: normalizedPlan.title,
          description: normalizedPlan.description || "",
          status: normalizedPlan.status || "active",
          priority: normalizedPlan.priority || 1,
          estimatedDuration: normalizedPlan.estimatedDuration,
          type: normalizedPlan.type || "personal",
          progress: 0,
          diagnostics,
        });
      }

      if (!planDoc) {
        throw new Error("Failed to create or update Plan document.");
      }

      const planId = planDoc._id;

      // Fetch all existing milestones, goals, and tasks for clean ORM sync/deletion
      const existingMilestones = await Milestone.find({ planId });
      const existingMilestoneIds = existingMilestones.map((m) => m._id.toString());

      const milestoneIdsInPayload = new Set<string>();
      const goalIdsInPayload = new Set<string>();
      const taskIdsInPayload = new Set<string>();

      // Process Milestones
      for (const milestone of normalizedPlan.milestones) {
        let milestoneDoc: any;
        if (milestone.id && Types.ObjectId.isValid(milestone.id)) {
          milestoneDoc = await Milestone.findByIdAndUpdate(
            milestone.id,
            {
              $set: {
                title: milestone.title,
                description: milestone.description || "",
                status: milestone.status,
                priority: milestone.priority,
                estimatedDuration: milestone.estimatedDuration,
                startDate: milestone.startDate || "",
                endDate: milestone.endDate || "",
                category: milestone.category || "Personal",
                importance: milestone.importance || 5,
                flexibility: milestone.flexibility || 5,
              },
            },
            { returnDocument: "after" }
          );
          milestoneIdsInPayload.add(milestone.id);
        } else {
          milestoneDoc = await Milestone.create({
            planId,
            firebaseUid: uid,
            title: milestone.title,
            description: milestone.description || "",
            status: milestone.status || "todo",
            priority: milestone.priority || 1,
            estimatedDuration: milestone.estimatedDuration,
            progress: 0,
            startDate: milestone.startDate || "",
            endDate: milestone.endDate || "",
            category: milestone.category || "Personal",
            importance: milestone.importance || 5,
            flexibility: milestone.flexibility || 5,
          });
          milestoneIdsInPayload.add(milestoneDoc._id.toString());
          totalMilestonesCreated++;
        }

        const milestoneId = milestoneDoc._id;

        // Process Goals under this Milestone
        for (const goal of milestone.goals) {
          let goalDoc: any;
          if (goal.id && Types.ObjectId.isValid(goal.id)) {
            goalDoc = await Goal.findByIdAndUpdate(
              goal.id,
              {
                $set: {
                  planId,
                  milestoneId,
                  title: goal.title,
                  description: goal.description || "",
                  status: goal.status,
                  priority: goal.priority,
                  estimatedDuration: goal.estimatedDuration,
                },
              },
              { returnDocument: "after" }
            );
            goalIdsInPayload.add(goal.id);
          } else {
            goalDoc = await Goal.create({
              firebaseUid: uid,
              planId,
              milestoneId,
              title: goal.title,
              description: goal.description || "",
              status: goal.status || "active",
              priority: goal.priority || 1,
              estimatedDuration: goal.estimatedDuration,
              progress: 0,
            });
            goalIdsInPayload.add(goalDoc._id.toString());
          }

          const goalId = goalDoc._id;

          // Process Tasks under this Goal
          for (const task of goal.tasks) {
            let taskDoc: any;
            if (task.id && Types.ObjectId.isValid(task.id)) {
              taskDoc = await Task.findByIdAndUpdate(
                task.id,
                {
                  $set: {
                    goalId,
                    title: task.title,
                    description: task.description || "",
                    status: task.status,
                    priority: task.priority,
                    estimatedDuration: task.estimatedDuration,
                    dependencies: task.dependencies || [],
                    suggestedDate: task.suggestedDate || "",
                    timeBlock: task.timeBlock || "",
                  },
                },
                { returnDocument: "after" }
              );
              taskIdsInPayload.add(task.id);
            } else {
              taskDoc = await Task.create({
                firebaseUid: uid,
                goalId,
                title: task.title,
                description: task.description || "",
                status: task.status || "todo",
                priority: task.priority || 1,
                estimatedDuration: task.estimatedDuration,
                dependencies: task.dependencies || [],
                suggestedDate: task.suggestedDate || "",
                timeBlock: task.timeBlock || "",
              });
              taskIdsInPayload.add(taskDoc._id.toString());
              totalTasksCreated++;
            }
          }
        }
      }

      // Sync deletes: Remove orphaned elements NOT in the new payload.
      // Guard: only delete if payload is non-empty (protects against truncated LLM responses).
      const goalsOfThisPlan = await Goal.find({ planId });
      const goalIdsOfThisPlan = goalsOfThisPlan.map((g) => g._id);

      if (taskIdsInPayload.size > 0) {
        await Task.deleteMany({
          goalId: { $in: goalIdsOfThisPlan },
          _id: { $nin: Array.from(taskIdsInPayload).map((id) => new Types.ObjectId(id)) },
        });
      }

      if (goalIdsInPayload.size > 0) {
        await Goal.deleteMany({
          planId,
          _id: { $nin: Array.from(goalIdsInPayload).map((id) => new Types.ObjectId(id)) },
        });
      }

      if (milestoneIdsInPayload.size > 0) {
        await Milestone.deleteMany({
          planId,
          _id: { $nin: Array.from(milestoneIdsInPayload).map((id) => new Types.ObjectId(id)) },
        });
      }

      // 4. Trigger progress recalculation for the entire plan structure to sync numbers
      await this.recalculatePlanProgress(planId.toString());

      // 5. Version Control: Capture full snapshot of updated plan and push to history
      const updatedPlanTree = await Plan.findById(planId).lean();
      const updatedMilestones = await Milestone.find({ planId }).sort({ startDate: 1 }).lean();
      const milestoneTrees = [];
      for (const m of updatedMilestones) {
        const goals = await Goal.find({ milestoneId: m._id }).sort({ priority: 1 }).lean();
        const goalTrees = [];
        for (const g of goals) {
          const tasks = await Task.find({ goalId: g._id }).sort({ priority: 1 }).lean();
          goalTrees.push({ ...g, tasks });
        }
        milestoneTrees.push({ ...m, goals: goalTrees });
      }
      const fullSnapshot = {
        ...updatedPlanTree,
        milestones: milestoneTrees
      };

      const changeSummary = result.changeSummary || (normalizedPlan.id ? "Updated plan" : "New plan");
      await Plan.findByIdAndUpdate(planId, {
        $push: {
          history: {
            timestamp: new Date(),
            changeSummary,
            snapshot: JSON.stringify(fullSnapshot),
          },
        },
      });

      console.log(
        `[PlanningAgent] Plan complete in ${Date.now() - startTime}ms. Milestones: ${updatedMilestones.length}, New tasks: ${totalTasksCreated}`
      );

      return {
        success: true,
        milestonesCreated: updatedMilestones.length,
        tasksCreated: totalTasksCreated,
      };
    } catch (error) {
      console.error("[PlanningAgent] Plan generation/evolution error:", error);
      return null;
    }
  }

  /**
   * Recalculates progress recursively starting from a task ID.
   */
  static async recalculateProgress(uid: string, taskId: string): Promise<void> {
    try {
      const task = await Task.findById(taskId);
      if (!task || !task.goalId) return;

      const goalId = task.goalId.toString();
      const goal = await Goal.findById(goalId);
      if (!goal) return;

      // 1. Recalculate Goal Progress
      const tasks = await Task.find({ goalId: task.goalId });
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === "completed").length;
      const goalProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const goalStatus = goalProgress === 100 ? "completed" : "active";

      await Goal.findByIdAndUpdate(goalId, {
        $set: { progress: goalProgress, status: goalStatus },
      });

      if (!goal.milestoneId) return;

      const milestoneId = goal.milestoneId.toString();
      const milestone = await Milestone.findById(milestoneId);
      if (!milestone) return;

      // 2. Recalculate Milestone Progress
      const goals = await Goal.find({ milestoneId: goal.milestoneId });
      const totalGoals = goals.length;
      const completedGoalsProgress = goals.reduce((sum, g) => sum + (g.progress || 0), 0);
      const milestoneProgress = totalGoals > 0 ? Math.round(completedGoalsProgress / totalGoals) : 0;
      const milestoneStatus = milestoneProgress === 100 ? "completed" : "in_progress";

      await Milestone.findByIdAndUpdate(milestoneId, {
        $set: { progress: milestoneProgress, status: milestoneStatus },
      });

      if (!milestone.planId) return;

      // 3. Recalculate Plan Progress
      const planId = milestone.planId.toString();
      const milestones = await Milestone.find({ planId: milestone.planId });
      const totalMilestones = milestones.length;
      const completedMilestonesProgress = milestones.reduce((sum, m) => sum + (m.progress || 0), 0);
      const planProgress = totalMilestones > 0 ? Math.round(completedMilestonesProgress / totalMilestones) : 0;
      const planStatus = planProgress === 100 ? "completed" : "active";

      await Plan.findByIdAndUpdate(planId, {
        $set: { progress: planProgress, status: planStatus },
      });

      console.log(`[PlanningAgent] Recalculated progress recursively. Plan ${planId}: ${planProgress}%`);
    } catch (error) {
      console.error("[PlanningAgent] Error during recursive progress calculation:", error);
    }
  }

  /**
   * Helper to recalculate progress for an entire plan by its ID.
   */
  static async recalculatePlanProgress(planId: string): Promise<void> {
    try {
      const milestones = await Milestone.find({ planId: new Types.ObjectId(planId) });
      for (const m of milestones) {
        const goals = await Goal.find({ milestoneId: m._id });
        for (const g of goals) {
          const tasks = await Task.find({ goalId: g._id });
          const totalTasks = tasks.length;
          const completedTasks = tasks.filter((t) => t.status === "completed").length;
          const goalProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
          const goalStatus = goalProgress === 100 ? "completed" : g.status;
          await Goal.findByIdAndUpdate(g._id, { $set: { progress: goalProgress, status: goalStatus } });
        }

        const totalGoals = goals.length;
        const milestoneProgress = totalGoals > 0
          ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / totalGoals)
          : 0;
        const milestoneStatus = milestoneProgress === 100 ? "completed" : m.status;
        await Milestone.findByIdAndUpdate(m._id, { $set: { progress: milestoneProgress, status: milestoneStatus } });
      }

      const totalMilestones = milestones.length;
      const planProgress = totalMilestones > 0
        ? Math.round(milestones.reduce((sum, m) => sum + (m.progress || 0), 0) / totalMilestones)
        : 0;
      const plan = await Plan.findById(planId);
      const planStatus = planProgress === 100 ? "completed" : (plan?.status || "active");
      await Plan.findByIdAndUpdate(planId, { $set: { progress: planProgress, status: planStatus } });
    } catch (error) {
      console.error(`[PlanningAgent] Failed to recalculate plan progress for plan ${planId}:`, error);
    }
  }
}
