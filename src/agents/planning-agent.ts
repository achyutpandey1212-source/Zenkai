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
import { BehaviorEngine } from "@/services/behavior-engine.service";

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

─── CONTEXT PRIORITY — STRICT ORDER (this determines what you plan) ───

You receive context from multiple sources. ALWAYS give them this exact priority:

  1. EXPLICIT USER REQUEST (this session’s message + conversation context)
     → This is ABSOLUTE ground truth. If the user names a topic, skill, domain,
       or technology in their current message, that IS the plan’s subject.
       Do NOT override or reinterpret with any other context.

  2. CONVERSATION CONTEXT (recent message history)
     → Use to understand follow-ups, confirmations, and clarifications.
       “yes” or “go ahead” confirms whatever the assistant last proposed.

  3. ONBOARDING INFORMATION (profession, long-term goal, current focus)
     → Use to fill in gaps the user left unspecified (e.g., tech stack, daily
       availability). Never use to override an explicit request.

  4. LONG-TERM MEMORY (approved memories)
     → Use to personalize tone and approach, not to determine what to plan.

  5. PROFILE FIELDS (work style, availability, biggest challenge)
     → Use for scheduling realism only. Lowest priority.

Example: If the user says “I want to study DSA for a week” and their profile says
“current focus: web development” — plan DSA. The profile is irrelevant here.

─── CONFIDENCE SCORING & ACTION SELECTION ───

Before generating a plan, assess your confidence that this message represents
a genuine, deliberate intent to create or modify a roadmap.

Return BOTH fields in your response:

  planningConfidence (0.0 to 1.0):
    0.9–1.0 — Explicit, unambiguous request. User clearly wants a plan NOW.
              Examples: “I want to study DSA for a week, 3-5 hours daily”,
                        “Plan my semester around these exam dates: ...”
    0.7–0.89 — Strong implicit signal. User shared structured life info.
              Examples: “My end-sem exams start May 25”,
                        “I have a placement interview in 3 weeks”
    0.5–0.69 — Ambiguous but plausible. Something might need updating.
              Examples: “I might try competitive programming later”,
                        “I’ve been thinking about fitness goals”
    0.0–0.49 — Too vague, hypothetical, or contradictory to act on.
              Examples: “Maybe I should learn Rust someday”,
                        “I wonder if I should change careers”

  planningAction: one of “create” | “modify” | “merge” | “ignore”
    “create”  — Confidence ≥ 0.80, no existing plan covers this domain/goal.
    “modify”  — Confidence ≥ 0.80, evolving or updating an existing plan.
    “merge”   — Confidence 0.50–0.79, add new milestones without deleting existing ones.
    “ignore”  — Confidence < 0.50, take no action. Return empty plan shell.

CRITICAL: If planningAction is “ignore”, set plan.status to “archived” and return
an empty milestones array. The system will discard this response safely.

─── DOMAIN-AWARE STRATEGY INFERENCES ───

Customize the planning strategy, milestones, and task blocks based on the identified domain:
1. **Student / Academic**: Syllabus breakdown, concept building, study blocks, mock exams, exam prep.
2. **Software Engineer / Tech**: Development cycles, architecture design, sprint iterations, testing, deployment.
3. **Founder / Entrepreneur**: Strategic priorities, business validation, MVP creation, feedback loops, daily sprints.
4. **Content Creator**: Creation pipelines: brainstorming, scripting, shooting, editing, publishing.
5. **Job Seeker**: Application pipeline: resume, portfolio, mock interviews, cold outreach, skill building.
6. **Freelancer**: Client delivery: scope gathering, milestone iterations, feedback, final delivery, billing.

─── URGENCY-BASED STUDY ROADMAP DIRECTIVES (For Students) ───

Adapt tasks dynamically to time remaining before the exam date:
- **Exam > 30 days away**: Build concepts, read textbooks/lectures, complete syllabus, build consistency.
- **Exam 10–30 days away**: Finish remaining topics, transition to PYQs, initiate weekly revision cycles.
- **Exam 3–7 days away**: PYQs, identify repeated patterns, formula sheets, high-weightage chapters.
- **Exam tomorrow**: Revision/retrieval only, review mistakes, read formula sheets, rest.
- **Strict constraint**: Never generate unrealistic advice. Respect daily availability limits.

─── CHRONOLOGICAL TIMELINE DIRECTIVES ───

- Every milestone must occupy an actual place on the timeline:
  - startDate: "YYYY-MM-DD"
  - endDate: "YYYY-MM-DD"
- Every task must contain:
  - suggestedDate: "YYYY-MM-DD"
  - timeBlock: optional time slot string (e.g. "09:00 AM - 10:30 AM" or empty)
- Every milestone must be categorized into exactly one activity category:
  Exam, Study, Hackathon, Meetup, Content Creation, Startup, Coding, Reading, Fitness, Interview, Personal

─── SMART CONSTRAINTS ───

- Classify events as Hard Constraints (Exams, Interviews, Medical) or Soft Constraints (Meetups, Fitness, etc.).
- Hard constraints: importance: 10, flexibility: 0. They cannot move.
- Soft constraints: flexible dates, importance 4–8, flexibility 5–9.
- Schedule study and flexible milestones around hard constraints.

─── CORE DIRECTIVES FOR EVOLUTION & MERGING ───

- Zenkai plans are living systems. Do NOT recreate from scratch unless planningAction is "create".
- If planningAction is "modify": PRESERVE the exact database "id" for existing Plans, Milestones, Goals, and Tasks.
  Omit the "id" field ONLY for brand new items.
- If planningAction is "merge": ADD new milestones to the existing plan without deleting any existing items.
  Do NOT change status of existing milestones. Only add.
- If the user cancels/removes an event, set its milestone status to "cancelled" — do NOT delete it.
- Return:
  - plannerReasoning: How you resolved conflicts, rescheduled tasks, respected constraints.
  - changeSummary: Concise description of revision.
  - detectedConstraints: Hard and soft constraints identified.
  - mergeStrategy: How you preserved progress while updating dates.
  - timelineRecalculation: Explanation of chronological date shifts.

Return a JSON object containing the plan tree, confidence fields, and these diagnostic details.
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
      // Before short-circuiting to 'none', check if the last model message proposed a plan.
      // If so, this acknowledgement is a CONFIRMATION — route to Gemini for proper handling.
      if (isAck || isEmoji) {
        const lastModelMsg = history.filter((h) => h.role === "model").at(-1)?.content ?? "";
        const modelProposedPlan = /would you like|shall i|here(?:'s| is) a|proposed schedule|study plan|dsa schedule|roadmap|plan your|organize your|structure your|schedule for/i.test(lastModelMsg);
        if (modelProposedPlan) {
          // Don't bypass — send to Gemini router with full history context
          console.log(`[Router] Ack detected but model proposed a plan — escalating to Gemini router.`);
          return null;
        }
      }

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
        .slice(-10) // increased from 6 for better confirmation and context tracking
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
  ): Promise<{ success: boolean; milestonesCreated: number; tasksCreated: number; planVersion?: number; ignored?: boolean } | null> {
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

      // 2. Format context for prompt — ordered by priority (user request first)
      const lifeEventsContext = lifeEvents?.detectedEvents?.length
        ? `\nDetected Life Events (auto-extracted):\n${JSON.stringify(lifeEvents.detectedEvents, null, 2)}\n`
        : "";

      const contextPrompt = `
## PRIORITY 1 — EXPLICIT USER REQUEST (ABSOLUTE GROUND TRUTH)
Latest User Message: "${userMessage}"
Detected Intent: ${JSON.stringify(intent)}
${lifeEventsContext}
## PRIORITY 2 — CONVERSATION CONTEXT
(The recent message history provides follow-up and confirmation signals. "yes" or "go ahead" confirms the last proposed plan.)

## PRIORITY 3 — ONBOARDING INFORMATION (fills gaps only, never overrides Priority 1)
- Profession: ${profile?.profession || "None"}
- Long-term goal: ${profile?.longTermGoal || "None"}
- Current Focus: ${profile?.currentFocus || "None"}

## PRIORITY 4 — LONG-TERM MEMORY (personalizes approach, does not determine what to plan)
${JSON.stringify(memories.map((m) => m.summary), null, 2)}

Active Traits:
${JSON.stringify(traits.map((t) => ({ trait: t.trait, description: t.description })), null, 2)}

Active Reflections:
${JSON.stringify(reflections.map((r) => ({ title: r.title, summary: r.summary })), null, 2)}

## PRIORITY 5 — PROFILE FIELDS (scheduling realism only)
- Peak focus availability: ${profile?.dailyAvailability || "None"}
- Working Style: ${profile?.workStyle || "None"}

## CURRENT DATE/TIME CONTEXT
- Current Timestamp: ${new Date().toString()}
- Current Date: ${new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Current Local Time: ${new Date().toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}

## EXISTING PLANS TREE (for evolution/merging)
${JSON.stringify(prunedPlans, null, 2)}
`;

      const prompt = `
${contextPrompt}

Based on the PRIORITY 1 user request above, decide your planningConfidence and planningAction, then generate the plan.
Remember:
- The user's explicit request in PRIORITY 1 determines the subject. NEVER infer from profile.
- If evolving an existing plan, PRESERVE the exact database "id" for existing Plans, Milestones, Goals, and Tasks.
- Break the plan down into Milestones. Each Milestone must have Goals. Each Goal must have actionable Tasks.
- Every milestone MUST have startDate, endDate, category, importance, flexibility.
- Every task MUST have suggestedDate (YYYY-MM-DD).
- CRITICAL Date & Time Reasoning: Reason about relative time terms (like "today", "tomorrow", "this evening", "this weekend", "next week") relative to the Current Date/Time Context.
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
              // ── Confidence gate fields (evaluated BEFORE any plan write) ──
              planningConfidence: { type: "NUMBER" },
              planningAction: {
                type: "STRING",
                enum: ["create", "modify", "merge", "ignore"],
              },
              // ── Diagnostic fields ──
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
              "planningConfidence",
              "planningAction",
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
        planningConfidence: number;
        planningAction: "create" | "modify" | "merge" | "ignore";
        plannerReasoning: string;
        changeSummary: string;
        detectedConstraints: string;
        mergeStrategy: string;
        timelineRecalculation: string;
      };

      // ── Confidence Gate ─────────────────────────────────────────────────────
      const confidence = result.planningConfidence ?? 0;
      const planningAction = result.planningAction ?? "ignore";

      console.log(`[PlanningAgent] Confidence: ${confidence} | Action: ${planningAction}`);

      if (planningAction === "ignore" || confidence < 0.50) {
        console.log(`[PlanningAgent] Confidence ${confidence} below threshold (action=${planningAction}). Skipping plan write.`);
        return { success: false, milestonesCreated: 0, tasksCreated: 0, ignored: true };
      }

      // merge mode: disable orphan deletion so no existing items are removed
      const isMergeMode = planningAction === "merge" || (confidence >= 0.50 && confidence < 0.80);

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
      // Merge mode: SKIP all deletions — only add new items, never remove.
      if (!isMergeMode) {
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
      } else {
        console.log(`[PlanningAgent] Merge mode: skipping orphan deletion to preserve existing plan items.`);
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
      const updatedPlanDoc = await Plan.findByIdAndUpdate(planId, {
        $push: {
          history: {
            timestamp: new Date(),
            changeSummary,
            snapshot: JSON.stringify(fullSnapshot),
          },
        },
        $inc: { version: 1 }, // increment version on every write — used for frontend cache-busting
      }, { returnDocument: "after" });

      const newPlanVersion = updatedPlanDoc?.version ?? 1;

      console.log(
        `[PlanningAgent] Plan complete in ${Date.now() - startTime}ms. Milestones: ${updatedMilestones.length}, New tasks: ${totalTasksCreated}, Version: ${newPlanVersion}`
      );

      // Notify BehaviorEngine
      await BehaviorEngine.updateFromPlan(uid, planId, "update").catch(err =>
        console.error("[PlanningAgent] Failed to update behavior profile from plan update:", err)
      );

      return {
        success: true,
        milestonesCreated: updatedMilestones.length,
        tasksCreated: totalTasksCreated,
        planVersion: newPlanVersion,
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

      if (plan) {
        await BehaviorEngine.updateFromPlan(plan.firebaseUid, planId, planStatus === "completed" ? "complete" : "update").catch(err =>
          console.error("[PlanningAgent] Failed to update behavior profile from plan progress update:", err)
        );
      }
    } catch (error) {
      console.error(`[PlanningAgent] Failed to recalculate plan progress for plan ${planId}:`, error);
    }
  }
}
