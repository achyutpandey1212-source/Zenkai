export type ContextIntent =
  | "planning"
  | "weekly_scheduling"
  | "daily_agenda"
  | "roadmap_evolution"
  | "goal_modification"
  | "productivity_coaching"
  | "motivation"
  | "reflection"
  | "identity_evolution"
  | "general_companion"
  | "progress_review"
  | "task_breakdown"
  | "calendar_planning"
  | "memory_retrieval"
  | "decision_support";

export type ContextProfile =
  | "companion"
  | "planning"
  | "weekly_scheduling"
  | "motivation"
  | "identity"
  | "reflection"
  | "progress_review";

export class ContextRouterService {
  /**
   * Deterministically classifies the user request into a granular ContextIntent.
   * Runs in < 1 ms with zero AI/Gemini latency.
   */
  public static classifyIntent(
    userMessage: string,
    parentIntent?: "create_or_modify" | "task_update" | "execution_inquiry" | "none" | string
  ): ContextIntent {
    const msg = userMessage.toLowerCase().trim();

    // Onboarding bypass: explicitly request planning context
    if (parentIntent === "onboarding") {
      return "planning";
    }

    // 1. If parent is create_or_modify (Roadmap planning triggers)
    if (parentIntent === "create_or_modify") {
      if (
        /\b(goal|milestone|target|objective)\b.*\b(change|modify|remove|delete|pause|cancel|update)\b/i.test(msg) ||
        /\b(change|modify|remove|delete|pause|cancel|update)\b.*\b(goal|milestone|target|objective)\b/i.test(msg)
      ) {
        return "goal_modification";
      }
      if (
        /\b(task|step|action|subtask)\b.*\b(break down|split|divide|list)\b/i.test(msg) ||
        /\b(break down|split|divide|list)\b.*\b(task|step|action|subtask)\b/i.test(msg)
      ) {
        return "task_breakdown";
      }
      if (
        /\b(change|evolve|restructure|update|archive|history|version)\b.*\b(plan|roadmap|path|career|direction)\b/i.test(msg) ||
        /\b(plan|roadmap|path|career|direction)\b.*\b(change|evolve|restructure|update|archive|history|version)\b/i.test(msg)
      ) {
        return "roadmap_evolution";
      }
      return "planning";
    }

    // 2. If parent is execution_inquiry (Schedule/agenda queries)
    if (parentIntent === "execution_inquiry") {
      if (/\b(week|weekly|next 7 days|schedule week)\b/i.test(msg)) {
        return "weekly_scheduling";
      }
      if (/\b(calendar|gcal|google calendar|meeting|event|sync|appointment)\b/i.test(msg)) {
        return "calendar_planning";
      }
      return "daily_agenda";
    }

    // 3. If parent is task_update -> falls under execution agenda context
    if (parentIntent === "task_update") {
      return "daily_agenda";
    }

    // 4. Default casual conversation or other parent intents
    // Motivation
    if (/\b(motivate|tired|discouraged|sad|stress|burnout|unmotivated|give up|pep talk|inspire|down|depressed)\b/i.test(msg)) {
      return "motivation";
    }

    // Productivity Coaching
    if (/\b(focus|procrastinat|study|concentrat|distract|time management|efficient|productive|technique|pomodoro)\b/i.test(msg)) {
      return "productivity_coaching";
    }

    // Reflection
    if (/\b(reflect|pattern|habit|observation|behavior|self-reflection|tendency)\b/i.test(msg)) {
      return "reflection";
    }

    // Identity
    if (/\b(who am i|personality|trait|identity|blueprint|character|profile)\b/i.test(msg)) {
      return "identity_evolution";
    }

    // Progress Review
    if (/\b(progress|stat|metric|completion|how am i doing|score|analytics|review)\b/i.test(msg)) {
      return "progress_review";
    }

    // Memory Retrieval
    if (/\b(remember|recall|memory|discuss|we talked about|did you keep)\b/i.test(msg)) {
      return "memory_retrieval";
    }

    // Decision Support
    if (/\b(decide|decision|pros and cons|choice|choose|framework|option|pro con)\b/i.test(msg)) {
      return "decision_support";
    }

    // Default Fallback
    return "general_companion";
  }

  /**
   * Maps granular ContextIntent to core ContextProfile groups
   */
  public static getIntentProfile(intent: ContextIntent): ContextProfile {
    switch (intent) {
      case "planning":
      case "roadmap_evolution":
      case "goal_modification":
      case "task_breakdown":
      case "decision_support":
        return "planning";

      case "weekly_scheduling":
      case "calendar_planning":
        return "weekly_scheduling";

      case "daily_agenda":
      case "memory_retrieval":
      case "general_companion":
        return "companion";

      case "motivation":
      case "productivity_coaching":
        return "motivation";

      case "identity_evolution":
        return "identity";

      case "reflection":
        return "reflection";

      case "progress_review":
        return "progress_review";
    }
  }
}
