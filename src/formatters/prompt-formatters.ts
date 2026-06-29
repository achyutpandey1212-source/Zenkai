import type {
  PlanningContext,
  CompanionContext,
} from "@/types/context.types";

export class PlanningFormatter {
  public static format(context: PlanningContext): string {
    const { profile, identity, activePlan, memories, reflections } = context;

    const profileText = [
      "## Onboarding Profile",
      profile.profession ? `- **Profession**: ${profile.profession}` : null,
      profile.longTermGoal ? `- **Long-term Goal**: ${profile.longTermGoal}` : null,
      profile.currentFocus ? `- **Current Focus**: ${profile.currentFocus}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const memoriesText = memories
      .map((m) => `- ${m.summary} (${m.category})`)
      .join("\n") || "None";

    const traitsText = identity.activeTraits
      .map((t) => `- ${t.trait}: ${t.description}`)
      .join("\n") || "None";

    const reflectionsText = reflections
      .map((r) => `- ${r.title}: ${r.summary}`)
      .join("\n") || "None";

    const planText = activePlan
      ? JSON.stringify(activePlan, null, 2)
      : "No active plan found.";

    return `
${profileText}

## Long-Term Memories
${memoriesText}

## Identity Traits
${traitsText}

## Behavioral Reflections
${reflectionsText}

## Existing Active Plan Tree (for merge/evolution)
${planText}
`.trim();
  }
}

export class CompanionFormatter {
  public static format(context: CompanionContext, planPromptText: string = ""): string {
    const { profile, identity, currentState, memories, reflections, todayAgenda } = context;

    const profileText = [
      "## User Foundational Profile",
      profile.profession ? `- **Profession**: ${profile.profession}` : null,
      profile.longTermGoal ? `- **Long-term Goal**: ${profile.longTermGoal}` : null,
      profile.currentFocus ? `- **Current Focus**: ${profile.currentFocus}` : null,
      profile.dailyAvailability ? `- **Availability**: ${profile.dailyAvailability}` : null,
      profile.workStyle ? `- **Working Style**: ${profile.workStyle}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const memoriesText = memories
      .map((m) => `- ${m.summary} (${m.content})`)
      .join("\n") || "None";

    const traitsText = identity.activeTraits
      .map((t) => `- **${t.trait}**: ${t.description}`)
      .join("\n") || "None";

    const reflectionsText = reflections
      .map((r) => `- **${r.title}**: ${r.content}`)
      .join("\n") || "None";

    let stateText = "";
    if (currentState) {
      stateText = `
## Active Plan Overview
- **Active Plan**: "${currentState.activePlanTitle || "N/A"}" (Progress: ${currentState.activePlanProgress || 0}%)
- **Description**: "${currentState.activePlanDescription || ""}"
- **Current Milestone Focus**: ${currentState.activeMilestoneTitle || "None"} (${currentState.activeMilestoneStartDate || ""} to ${currentState.activeMilestoneEndDate || ""})
- **Active Goals**: ${currentState.activeGoalsCount} goals
- **Google Calendar Synced**: ${currentState.calendarSynced ? "Yes" : "No"}
`.trim();
    }

    let agendaText = "";
    if (todayAgenda) {
      const blocksText = todayAgenda.workBlocks.map(wb => {
        const tasks = wb.tasks.map(t => `- ${t.title} (${t.status})`).join("\n");
        return `Block: ${wb.title} (${wb.startTime} - ${wb.endTime})\nTasks:\n${tasks || "No tasks"}`;
      }).join("\n\n");

      agendaText = `
## Today's Daily Agenda
- **Date**: ${todayAgenda.date}
- **Focus Theme**: "${todayAgenda.focusTheme || "General Focus"}"
- **Workload**: "${todayAgenda.estimatedWorkload || "Medium"}"
- **Planned Focus Hours**: ${todayAgenda.plannedFocusHours} hours

Suggested Work Blocks & Tasks:
${blocksText}
`.trim();
    }

    return [
      profileText,
      stateText,
      agendaText,
      "## Long-Term Memories",
      memoriesText,
      "## Identity Traits",
      traitsText,
      "## Behavioral Reflections",
      reflectionsText,
      planPromptText,
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }
}

export class MotivationFormatter {
  public static format(context: any): string {
    const { identity, reflections, memories, activeGoal } = context;

    const memoriesText = memories.map((m: any) => `- ${m.summary}`).join("\n") || "None";
    const traitsText = identity.activeTraits.map((t: any) => `- ${t.trait}: ${t.description}`).join("\n") || "None";
    const reflectionsText = reflections.map((r: any) => `- ${r.title}: ${r.summary}`).join("\n") || "None";
    const goalText = activeGoal
      ? `Goal: "${activeGoal.title}"\nDescription: "${activeGoal.description}"`
      : "None";

    return `
## Current Focus Goal
${goalText}

## Long-Term Memories (Motivation Anchors)
${memoriesText}

## Identity Traits (Drive & Resilience)
${traitsText}

## Behavioral Reflections (Performance & Rhythm Patterns)
${reflectionsText}
`.trim();
  }
}

export class ReflectionFormatter {
  public static format(context: any): string {
    const { reflections, memories, identity } = context;

    const reflectionsText = reflections.map((r: any) => `- ${r.title} (${r.category}): ${r.content}`).join("\n") || "None";
    const memoriesText = memories.map((m: any) => `- ${m.summary}`).join("\n") || "None";
    const traitsText = identity.activeTraits.map((t: any) => `- ${t.trait}: ${t.description}`).join("\n") || "None";

    return `
## Current Behavioral Reflections
${reflectionsText}

## Confirmed Memories (Evidence)
${memoriesText}

## Identity Traits
${traitsText}
`.trim();
  }
}

export class IdentityFormatter {
  public static format(context: any): string {
    const { identity, reflections, memories } = context;

    const traitsText = [
      ...identity.activeTraits,
      ...identity.candidateTraits,
    ]
      .map((t: any) => `- ${t.trait} (${t.status}): ${t.description}`)
      .join("\n") || "None";

    const reflectionsText = reflections.map((r: any) => `- ${r.title}: ${r.summary}`).join("\n") || "None";
    const memoriesText = memories.map((m: any) => `- ${m.summary}`).join("\n") || "None";

    return `
## Current Identity Profile
${traitsText}

## Behavioral Reflections
${reflectionsText}

## Confirmed Memories
${memoriesText}
`.trim();
  }
}

export class ProgressFormatter {
  public static format(context: any): string {
    const { activePlanOverview, intelligenceMetrics } = context;

    let planText = "No active plan.";
    if (activePlanOverview) {
      planText = `Plan: "${activePlanOverview.title}" (Progress: ${activePlanOverview.progress}%)\nDescription: "${activePlanOverview.description}"`;
    }

    const metricsText = intelligenceMetrics
      ? JSON.stringify(intelligenceMetrics, null, 2)
      : "None available.";

    return `
## Active Plan Overview
${planText}

## Execution & Behavior Metrics
${metricsText}
`.trim();
  }
}
