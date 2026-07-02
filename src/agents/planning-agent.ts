import { provider } from "@/services/llm/provider";
import type { GraphState } from "@/orchestration/graph/state";
import { AIValidationService } from "@/services/ai-validation.service";
import { telemetryStorage } from "@/lib/telemetry-context";
import { ContextOrchestrator } from "@/services/context-orchestrator.service";
import { PlanSyncService } from "@/services/plan-sync.service";
import { SchedulingService } from "@/services/scheduling.service";
import type { PlanningContext, NormalizedUserContext } from "@/types/context.types";
import { PlanningFormatter } from "@/formatters/prompt-formatters";

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
  isOnboarding?: boolean;
  reasoning?: string;
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
CRITICAL RULE: If the request is generic (e.g. "Plan My Week", "Plan my schedule", "Create a roadmap") without specifying a topic/domain/skill/technology, do NOT guess or hallucinate a goal. Leave both goalTitle and planType empty, null, or omit them from the response.

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
CRITICAL RULE: If the request is generic (e.g. "Plan My Week", "Plan my schedule", "Create a roadmap") without specifying a topic/domain/skill/technology, do NOT guess or hallucinate a goal. Leave both goalTitle and planType empty, null, or omit them from the response.

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
You are the Human-Centric Strategy and Execution Planning Agent for Zenkai.
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

─── CORE PHILOSOPHY & PLANNING PRINCIPLES ───

You must apply these key planning principles when building or updating any roadmap/plan:
1. **Life First**: Schedule around the user's life. Do not expect the user's life to adapt to an unrealistic plan.
2. **Consistency Beats Intensity**: Distribute learning and practice into shorter, recurring sessions. Avoid dumping excessive hours (e.g. 6+ hours) into a single day.
3. **Minimize Context Switching**: Group similar work blocks together. Avoid chaotic transitions between unrelated domains.
4. **Protect Deep Work**: Dedicate uninterrupted blocks of time for creative or complex tasks (e.g. coding, writing, designing).
5. **Deadline Awareness**: Intensify focus as deadlines approach by allocating more time, without completely rewriting the long-term roadmap.
6. **Preserve Buffers**: Keep realistic breathing room. Never schedule every free hour.

─── 5-STAGE INTENTIONAL REASONING FLOW ───

You must explicitly reason through these five steps before forming or modifying the plan tree:
1. **Stage 1 — Build Life Model**: Analyze user details (Onboarding, memories, traits, reflections, daily availability, and profile). Infer wake-up, sleep, work/college hours, travel, meals, habits, and preferred deep work duration.
2. **Stage 2 — Build Availability Map**: Identify occupied vs. available hours for the plan's duration. Separate Hard Constraints (exams, job hours, interviews) from Soft Constraints (gaming, reading, hobbies).
3. **Stage 3 — Classify Activities**: Categorize milestones/tasks into:
   - *Recurring*: Consistent habits (gym, reading).
   - *Deadline-Driven*: Assignments, hackathons, exam revisions.
   - *Creative*: Content creation, writing, coding projects.
   - *Maintenance*: Cleaning, shopping, emails.
   - *Flexible*: Gaming, friends, leisure.
4. **Stage 4 — Weekly Rhythm Construction**: Design a logical weekly pattern (e.g. creative work grouped in deep blocks, recurring habits spaced out).
5. **Stage 5 — Daily Work Block Planning**: Formulate hourly slots respecting sleep, meals, and transition buffers.

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
    0.7–0.89 — Strong implicit signal. User shared structured life info.
    0.5–0.69 — Ambiguous but plausible. Something might need updating.
    0.0–0.49 — Too vague, hypothetical, or contradictory to act on.

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

Return a JSON object containing the plan tree, confidence fields, and these diagnostic details. Inside the "plannerReasoning" field, you MUST explicitly output your step-by-step reasoning corresponding to the 5-Stage Intentional Reasoning Flow (Life Model analysis, Availability Map, Weekly Rhythm, and Daily Blocks allocation).
`;

export class PlanningAgent {

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

       const response = await provider.generate({
         prompt,
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
        lifeEvents?: {
          hasActionableContent: boolean;
          suggestsPlanning: boolean;
          extractionReason: string;
          detectedEvents: LifeEvent[];
        };
      };

      const validTaskStatuses = ["completed", "in_progress", "todo"];
      const validPlanTypes = ["career", "learning", "exams", "projects", "fitness", "habits", "business", "personal"];
      const validIntentTypes = ["create_or_modify", "task_update", "execution_inquiry", "none"] as const;

      const intentType = validIntentTypes.includes(parsed.intentType)
        ? parsed.intentType
        : "none";

      const intent: PlanningIntent = {
        type: intentType,
        taskTitle: parsed.taskTitle,
        taskStatus: validTaskStatuses.includes(parsed.taskStatus || "")
          ? (parsed.taskStatus as "completed" | "in_progress" | "todo")
          : undefined,
        planType: validPlanTypes.includes(parsed.planType || "")
          ? (parsed.planType as PlanningIntent["planType"])
          : undefined,
        goalTitle: parsed.goalTitle,
        details: parsed.details,
        reasoning: intentType === "none" && !parsed.intentType
          ? "Missing intent in LLM response"
          : undefined,
      };

      // Safety guard: task_update requires a non-empty taskTitle
      if (intent.type === "task_update" && !intent.taskTitle?.trim()) {
        intent.type = "none";
      }

      const lifeEvents = parsed.lifeEvents || {
        hasActionableContent: false,
        suggestsPlanning: false,
        extractionReason: "Missing lifeEvents in LLM response",
        detectedEvents: [],
      };

      // Make the AI budget configurable per workflow type rather than hardcoded. For example:
      // Greeting: 2
      // General chat: 3
      // Planning: 5
      // Future premium workflows can increase this budget without changing orchestration logic.
      let budget = 3;
      if (intent.type === "create_or_modify" || lifeEvents.suggestsPlanning) {
        budget = 5;
      }

      return {
        intent,
        lifeEvents,
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

       const response = await provider.generate({
         prompt: `Analyse this message:\n"${message}"`,
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

       const response = await provider.generate({
         prompt,
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

  /**
   * PURE AI Reasoning function. Consumes typed context contracts only.
   * No database, no repository, no Mongoose models.
   */
  static async generateOrEvolvePlanLogic(
    context: PlanningContext,
    intent: PlanningIntent,
    userMessage: string,
    lifeEvents?: LifeEventExtraction
  ): Promise<{
    plan: any;
    planningConfidence: number;
    planningAction: "create" | "modify" | "merge" | "ignore";
    plannerReasoning: string;
    changeSummary: string;
    detectedConstraints: string;
    mergeStrategy: string;
    timelineRecalculation: string;
    promptText: string;
    rawGeminiOutput: string;
  } | null> {
    try {
      const plansList = context.activePlan ? [context.activePlan] : [];
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

${PlanningFormatter.format(context)}

## CURRENT DATE/TIME CONTEXT
- Current Timestamp: ${new Date().toString()}
- Current Date: ${new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Current Local Time: ${new Date().toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}
`;

      const prompt = `
${contextPrompt}

Based on the PRIORITY 1 user request above, decide your planningConfidence and planningAction, then generate the plan.
Remember:
- The user's explicit request in PRIORITY 1 determines the subject. If the user request is generic (e.g. "Plan My Week", "Plan my schedule", "Create a roadmap") and does not name a topic/domain/skill/technology, use the primary goal from their onboarding profile/goals (Priority 1 goal) as the subject of the plan, rather than rejecting it or hallucinating a new goal.
- If evolving an existing plan, PRESERVE the exact database "id" for existing Plans, Milestones, Goals, and Tasks.
- Break the plan down into Milestones. Each Milestone must have Goals. Each Goal must have actionable Tasks.
- Every milestone MUST have startDate, endDate, category, importance, flexibility.
- Every task MUST have suggestedDate (YYYY-MM-DD).
- CRITICAL Date & Time Reasoning: Reason about relative time terms (like "today", "tomorrow", "this evening", "this weekend", "next week") relative to the Current Date/Time Context.
`;

      const planResponseSchema: any = {
        type: "OBJECT",
        properties: {
          planningConfidence: { type: "NUMBER" },
          planningAction: {
            type: "STRING",
            enum: ["create", "modify", "merge", "ignore"],
          },
          plannerReasoning: { type: "STRING" },
          changeSummary: { type: "STRING" },
          detectedConstraints: { type: "STRING" },
          mergeStrategy: { type: "STRING" },
          timelineRecalculation: { type: "STRING" },
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
      };

      
const response = await provider.generate({

         prompt,
         systemInstruction: PLANNER_SYSTEM_PROMPT.trim(),
         temperature: 0.2,
         responseMimeType: "application/json",
         responseSchema: planResponseSchema,
       });

      let responseText = response.text;
      if (!responseText) return null;

      let result: any;
      try {
        result = JSON.parse(responseText);
        result = AIValidationService.validateAndRepairPlan(result);
      } catch (validationErr: any) {
        console.warn(`[AI Validation] Initial plan validation failed: ${validationErr.message}. Retrying once...`);
        const store = telemetryStorage.getStore();
        const state = store?.stateRef as any;
        if (state) {
          if (!state.retries) state.retries = [];
          state.retries.push({ action: "planValidationRetry", attempt: 1, error: validationErr.message });
        }

        const retryPrompt = `
${prompt}

---
IMPORTANT: Your previous response failed structural validation with the following error:
"${validationErr.message}"

Please fix this issue, ensure all required fields are present with correct types, and respond again in the exact requested schema.
`;
const retryResponse = await provider.generate({
           prompt: retryPrompt,
           systemInstruction: PLANNER_SYSTEM_PROMPT.trim(),
           temperature: 0.1,
           responseMimeType: "application/json",
           responseSchema: planResponseSchema,
         });

        const retryResponseText = retryResponse.text;
        if (!retryResponseText) throw new Error("Retry plan response was empty");
        responseText = retryResponseText;
        result = JSON.parse(responseText);

        result = AIValidationService.validateAndRepairPlan(result);
      }

      return {
        ...result,
        promptText: prompt,
        rawGeminiOutput: responseText,
      };
    } catch (err) {
      console.error("[PlanningAgent] generateOrEvolvePlanLogic failed:", err);
      return null;
    }
  }

  /**
   * Shell wrapper for plan generation/evolution to preserve compatibility with Graph Node and routes.
   * Handles cached load fallback and delegates persistence to PlanSyncService.
   */
  static async generateOrEvolvePlan(
    uid: string,
    intent: PlanningIntent,
    userMessage: string,
    lifeEvents?: LifeEventExtraction,
    state?: GraphState
  ): Promise<{ success: boolean; milestonesCreated: number; tasksCreated: number; planVersion?: number; ignored?: boolean; planId?: string } | null> {
    const startTime = Date.now();
    try {
      console.log(`[PlanningAgent] Executing planning workflow shell for user ${uid}`);
      const workflowId = state?.workflowId || `fallback-planning-${uid}-${Date.now()}`;

      // 1. Resolve normalized user context
      let normalizedContext: NormalizedUserContext;
      if (state && state.contextVersion) {
        normalizedContext = ContextOrchestrator.getContext(workflowId);
      } else {
        // Fallback loading when called outside request lifecycle
        normalizedContext = await ContextOrchestrator.loadContext(
          uid,
          workflowId,
          "Fallback planning shell execution",
          userMessage,
          intent.isOnboarding ? "onboarding" : undefined
        );
      }

      // Map to contract PlanningContext
      const planningContext: PlanningContext = {
        metadata: normalizedContext.metadata,
        identity: {
          activeTraits: normalizedContext.identity.activeTraits,
        },
        activePlan: normalizedContext.activePlan,
        memories: normalizedContext.memories,
        reflections: normalizedContext.reflections,
        profile: normalizedContext.profile,
      };

      // 2. Execute Pure AI Logic
      let aiResult = await this.generateOrEvolvePlanLogic(
        planningContext,
        intent,
        userMessage,
        lifeEvents
      );

      const isForOnboarding = !!(intent.isOnboarding || (state?.workflowId && state.workflowId.toLowerCase().includes("onboarding")) || (workflowId && workflowId.toLowerCase().includes("onboarding")));

      if (isForOnboarding) {
        let confidence = aiResult?.planningConfidence ?? 0;
        let planningAction = aiResult?.planningAction ?? "ignore";

        if (!aiResult || planningAction === "ignore" || confidence < 0.50) {
          console.warn(`[PlanningAgent] Onboarding planning confidence low (${confidence}) or ignore action. Retrying once...`);
          aiResult = await this.generateOrEvolvePlanLogic(
            planningContext,
            intent,
            userMessage,
            lifeEvents
          );
          confidence = aiResult?.planningConfidence ?? 0;
          planningAction = aiResult?.planningAction ?? "ignore";
        }

        if (!aiResult || planningAction === "ignore" || confidence < 0.50) {
          console.warn(`[PlanningAgent] Onboarding plan still low confidence/ignore after retry. Creating minimal starter roadmap directly from onboarding inputs.`);
          aiResult = this.createMinimalStarterRoadmap(uid, planningContext, intent);
        }
      } else {
        if (!aiResult) {
          return null;
        }

        const confidence = aiResult.planningConfidence ?? 0;
        const planningAction = aiResult.planningAction ?? "ignore";

        if (planningAction === "ignore" || confidence < 0.50) {
          console.log(`[PlanningAgent] Shell: Confidence ${confidence} too low or ignore action. Skipping persistence.`);
          return { success: false, milestonesCreated: 0, tasksCreated: 0, ignored: true };
        }
      }

      if (!aiResult) {
        return null;
      }

      // 3. Write plan tree updates using PlanSyncService (decoupled DB writes)
      const executionTimeMs = Date.now() - startTime;
      const syncResult = await PlanSyncService.persistPlanChanges(
        uid,
        aiResult,
        aiResult.promptText,
        aiResult.rawGeminiOutput,
        executionTimeMs
      );

      // Invalidate fallback cache if we instantiated it ourselves
      if (!state || !state.contextVersion) {
        ContextOrchestrator.invalidateCache(workflowId);
      }

      return {
        success: syncResult.success,
        milestonesCreated: syncResult.milestonesCreated,
        tasksCreated: syncResult.tasksCreated,
        planVersion: syncResult.planVersion,
        planId: syncResult.planId,
      };
    } catch (error) {
      console.error("[PlanningAgent] Evolve plan shell failed:", error);
      return null;
    }
  }

  /**
   * Backwards-compatible progress recalculation wrapper.
   */
  static async recalculateProgress(uid: string, taskId: string): Promise<void> {
    await PlanSyncService.recalculateProgress(uid, taskId);
  }

  /**
   * Backwards-compatible plan progress recalculation wrapper.
   */
  static async recalculatePlanProgress(planId: string): Promise<void> {
    await PlanSyncService.recalculatePlanProgress(planId);
  }

/**
    * Creates a minimal starter roadmap directly from onboarding inputs.
   * Guarantees activePlanId, milestones, tasks, and schedule data exist.
   */
  static createMinimalStarterRoadmap(
    uid: string,
    context: PlanningContext,
    intent: PlanningIntent
  ): any {
    const profile = context.profile;
    const primaryGoal = intent.goalTitle || profile?.longTermGoal || "Core Growth and Success";
    const profession = profile?.profession || "Professional";
    const timezone = profile?.timezone || "UTC";
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone });

    const plusDays = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toLocaleDateString("en-CA", { timeZone: timezone });
    };

    const wakeTime = profile?.wakeUpTime || "07:00";
    const sleepTime = profile?.sleepTime || "23:00";
    const focusDuration = profile?.focusDuration || 45;
    const deepWorkTime = profile?.deepWorkTime || "Morning";

    const fallbackPlan = {
      title: `Roadmap: ${primaryGoal}`,
      description: `Starter roadmap for ${profession} to pursue: ${primaryGoal}`,
      status: "active",
      priority: 1,
      estimatedDuration: "4 weeks",
      type: "personal" as const,
      milestones: [
        {
          title: `Milestone 1: Initiation and Routines`,
          description: "Establish wake-sleep boundaries and set up daily deep work blocks.",
          status: "in_progress" as const,
          priority: 1,
          estimatedDuration: "1 week",
          startDate: todayStr,
          endDate: plusDays(7),
          category: "Personal" as const,
          importance: 9,
          flexibility: 2,
          goals: [
            {
              title: "Establish consistent daily wake and sleep boundaries",
              description: "Maintain sleep schedules to support peak cognitive performance.",
              status: "active" as const,
              priority: 1,
              estimatedDuration: "daily",
              tasks: [
                {
                  title: `Align sleep routines (${wakeTime} - ${sleepTime})`,
                  description: `Go to sleep at ${sleepTime} and wake up at ${wakeTime}.`,
                  status: "todo" as const,
                  priority: 1,
                  estimatedDuration: "30m",
                  suggestedDate: todayStr,
                  timeBlock: "morning",
                  dependencies: [],
                },
                {
                  title: "Review daily availability and commitments",
                  description: "Align your daily agenda with commitments and availability settings.",
                  status: "todo" as const,
                  priority: 2,
                  estimatedDuration: "15m",
                  suggestedDate: todayStr,
                  timeBlock: "evening",
                  dependencies: [],
                }
              ]
            }
          ]
        },
        {
          title: `Milestone 2: Deep Work Acceleration`,
          description: `Dedicate focused time blocks directly targeting ${primaryGoal}.`,
          status: "todo" as const,
          priority: 2,
          estimatedDuration: "2 weeks",
          startDate: plusDays(8),
          endDate: plusDays(21),
          category: "Study" as const,
          importance: 8,
          flexibility: 3,
          goals: [
            {
              title: "Dedicate regular deep focus blocks to main objectives",
              description: "Execute focused work blocks targeting primary goal.",
              status: "active" as const,
              priority: 2,
              estimatedDuration: "daily",
              tasks: [
                {
                  title: `Execute deep focus block (${focusDuration} mins)`,
                  description: `Perform dedicated work on ${primaryGoal} during preferred time: ${deepWorkTime}.`,
                  status: "todo" as const,
                  priority: 1,
                  estimatedDuration: `${focusDuration}m`,
                  suggestedDate: plusDays(8),
                  timeBlock: deepWorkTime.toLowerCase(),
                  dependencies: [],
                },
                {
                  title: "Minimize study/work session distractions",
                  description: "Remove digital friction and environmental alerts for the block.",
                  status: "todo" as const,
                  priority: 2,
                  estimatedDuration: "10m",
                  suggestedDate: plusDays(9),
                  timeBlock: deepWorkTime.toLowerCase(),
                  dependencies: [],
                }
              ]
            }
          ]
        },
        {
          title: `Milestone 3: Tracking & Consistency`,
          description: "Review progress metrics weekly and optimize scheduling style.",
          status: "todo" as const,
          priority: 3,
          estimatedDuration: "1 week",
          startDate: plusDays(22),
          endDate: plusDays(28),
          category: "Personal" as const,
          importance: 7,
          flexibility: 4,
          goals: [
            {
              title: "Review roadmap milestones and update weekly backlog",
              description: "Maintain long-term roadmap alignment and tasks status checks.",
              status: "active" as const,
              priority: 3,
              estimatedDuration: "weekly",
              tasks: [
                {
                  title: "Review weekly roadmap goals",
                  description: "Assess milestones achievements and backlog priorities.",
                  status: "todo" as const,
                  priority: 1,
                  estimatedDuration: "15m",
                  suggestedDate: plusDays(22),
                  timeBlock: "evening",
                  dependencies: [],
                },
                {
                  title: "Optimize scheduling preferences",
                  description: "Adjust focus duration and deep work time based on weekly results.",
                  status: "todo" as const,
                  priority: 2,
                  estimatedDuration: "15m",
                  suggestedDate: plusDays(23),
                  timeBlock: "evening",
                  dependencies: [],
                }
              ]
            }
          ]
        }
      ]
    };

    return {
      planningConfidence: 1.0,
      planningAction: "create" as const,
      plannerReasoning: "Fallback minimal starter roadmap created deterministically from onboarding inputs.",
      changeSummary: "Deterministic minimal starter plan initialized.",
      detectedConstraints: "Commitments and sleep boundaries applied.",
      mergeStrategy: "overwrite",
      timelineRecalculation: "none",
      plan: fallbackPlan,
      promptText: "Deterministic Fallback Roadmap Execution",
      rawGeminiOutput: JSON.stringify(fallbackPlan),
    };
  }

/**
    * Generates a 7-day WeeklyExecutionSchedule using Gemini.
    * Delegates to SchedulingService.applyScheduleChange() for orchestration.
    */
  static async generateWeeklySchedule(uid: string, planId: string, state?: GraphState): Promise<any> {
    const result = await SchedulingService.applyScheduleChange(
      { type: "create_workspace", userId: uid, planId },
      state
    );
    return result.scheduleDoc ?? null;
  }
}
