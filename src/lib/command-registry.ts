export interface CommandParameter {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "time";
  description: string;
  required: boolean;
}

export interface CommandDefinition {
  id: string; // e.g. "schedule.add"
  title: string;
  description: string;
  aliases?: string[];
  category: "Schedule" | "Tasks" | "Roadmap" | "Calendar" | "Memory" | "Workspace" | "Identity" | "Reflection";
  provider: "zenkai" | "google" | "notion" | string;
  type: "internal" | "integration" | "mcp" | string;
  requiresConfirmation: boolean;
  parameters: CommandParameter[];
}

export const COMMAND_REGISTRY: CommandDefinition[] = [
  {
    id: "schedule.today",
    title: "Today's Agenda",
    description: "View today's schedule and agenda details",
    category: "Schedule",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: false,
    parameters: []
  },
  {
    id: "schedule.week",
    title: "Weekly Overview",
    description: "Get a summary of the current week's schedule",
    category: "Schedule",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: false,
    parameters: []
  },
  {
    id: "schedule.add",
    title: "Add Block",
    description: "Add a new work block to your schedule",
    category: "Schedule",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: false,
    parameters: [
      { name: "title", type: "string", description: "Block title", required: true },
      { name: "date", type: "date", description: "Date (YYYY-MM-DD)", required: true },
      { name: "startTime", type: "time", description: "Start time (HH:MM)", required: true },
      { name: "endTime", type: "time", description: "End time (HH:MM)", required: true }
    ]
  },
  {
    id: "schedule.move",
    title: "Move Block",
    description: "Move an existing work block to a new time",
    category: "Schedule",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: false,
    parameters: [
      { name: "title", type: "string", description: "Title of the block to move", required: true },
      { name: "date", type: "date", description: "Date of block", required: true },
      { name: "startTime", type: "time", description: "New start time (HH:MM)", required: true },
      { name: "endTime", type: "time", description: "New end time (HH:MM)", required: true }
    ]
  },
  {
    id: "schedule.resize",
    title: "Resize Block",
    description: "Change the duration of an existing work block",
    category: "Schedule",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: false,
    parameters: [
      { name: "title", type: "string", description: "Title of the block", required: true },
      { name: "date", type: "date", description: "Date of block", required: true },
      { name: "startTime", type: "time", description: "New start time (HH:MM)", required: true },
      { name: "endTime", type: "time", description: "New end time (HH:MM)", required: true }
    ]
  },
  {
    id: "schedule.delete",
    title: "Delete Block",
    description: "Remove a work block from your schedule",
    category: "Schedule",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: false,
    parameters: [
      { name: "title", type: "string", description: "Title of the block to delete", required: true },
      { name: "date", type: "date", description: "Date (YYYY-MM-DD)", required: true }
    ]
  },
  {
    id: "schedule.clear",
    title: "Clear Day",
    description: "Clear all blocks for a specific day",
    category: "Schedule",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: true,
    parameters: [
      { name: "date", type: "date", description: "Date to clear (YYYY-MM-DD)", required: true }
    ]
  },
  {
    id: "task.create",
    title: "Create Task",
    description: "Create and optionally schedule a new execution task",
    category: "Tasks",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: false,
    parameters: [
      { name: "title", type: "string", description: "Task title", required: true },
      { name: "description", type: "string", description: "Optional details", required: false },
      { name: "date", type: "date", description: "Focus execution date (YYYY-MM-DD)", required: false },
      { name: "startTime", type: "string", description: "Time slot start (HH:MM)", required: false },
      { name: "endTime", type: "string", description: "Time slot end (HH:MM)", required: false },
      { name: "estimatedMinutes", type: "number", description: "Estimated duration in minutes", required: false },
      { name: "priority", type: "number", description: "Priority level (1-5)", required: false }
    ]
  },
  {
    id: "task.edit",
    title: "Edit Task",
    description: "Modify an existing task and its schedule",
    category: "Tasks",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: false,
    parameters: [
      { name: "id", type: "string", description: "Task title or ID to edit", required: true },
      { name: "title", type: "string", description: "New title", required: false },
      { name: "description", type: "string", description: "New description", required: false },
      { name: "date", type: "date", description: "Focus execution date (YYYY-MM-DD)", required: false },
      { name: "startTime", type: "string", description: "Time slot start (HH:MM)", required: false },
      { name: "endTime", type: "string", description: "Time slot end (HH:MM)", required: false },
      { name: "estimatedMinutes", type: "number", description: "Estimated duration in minutes", required: false },
      { name: "priority", type: "number", description: "New priority (1-5)", required: false }
    ]
  },
  {
    id: "task.complete",
    title: "Complete Task",
    description: "Mark a task as completed",
    category: "Tasks",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: false,
    parameters: [
      { name: "id", type: "string", description: "Task title or ID", required: true }
    ]
  },
  {
    id: "task.reopen",
    title: "Reopen Task",
    description: "Mark a task as active/todo",
    category: "Tasks",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: false,
    parameters: [
      { name: "id", type: "string", description: "Task title or ID", required: true }
    ]
  },
  {
    id: "task.delete",
    title: "Delete Task",
    description: "Permanently delete a task",
    category: "Tasks",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: true,
    parameters: [
      { name: "id", type: "string", description: "Task title or ID", required: true }
    ]
  },
  {
    id: "task.archive",
    title: "Archive Task",
    description: "Archive a completed or obsolete task",
    category: "Tasks",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: true,
    parameters: [
      { name: "id", type: "string", description: "Task ID", required: true }
    ]
  },
  {
    id: "roadmap.view",
    title: "View Roadmap",
    description: "Display your current goals and roadmap milestones",
    category: "Roadmap",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: false,
    parameters: []
  },
  {
    id: "roadmap.regenerate",
    title: "Regenerate Roadmap",
    description: "Force regeneration of your roadmap and timelines",
    category: "Roadmap",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: true,
    parameters: []
  },
  {
    id: "roadmap.difficulty",
    title: "Adjust Difficulty",
    description: "Change the pacing/intensity of your roadmap",
    category: "Roadmap",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: true,
    parameters: [
      { name: "difficulty", type: "string", description: "Difficulty level (easy, medium, hard)", required: true }
    ]
  },
  {
    id: "roadmap.pause",
    title: "Pause Goal",
    description: "Temporarily pause progress on a specific goal",
    category: "Roadmap",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: true,
    parameters: [
      { name: "title", type: "string", description: "Goal title to pause", required: true }
    ]
  },
  {
    id: "roadmap.resume",
    title: "Resume Goal",
    description: "Resume tracking a paused goal",
    category: "Roadmap",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: true,
    parameters: [
      { name: "title", type: "string", description: "Goal title to resume", required: true }
    ]
  },
  {
    id: "workspace.regenerate",
    title: "Regenerate Workspace",
    description: "Rebuild your weekly schedule from scratch",
    category: "Workspace",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: true,
    parameters: []
  },
  {
    id: "calendar.sync",
    title: "Sync Calendar",
    description: "Manually trigger Google Calendar synchronization",
    category: "Calendar",
    provider: "google",
    type: "integration",
    requiresConfirmation: false,
    parameters: []
  },
  {
    id: "calendar.disconnect",
    title: "Disconnect Calendar",
    description: "Disconnect Google Calendar integration",
    category: "Calendar",
    provider: "google",
    type: "integration",
    requiresConfirmation: true,
    parameters: []
  },
  {
    id: "memory.search",
    title: "Search Memory",
    description: "Search active memories for a keyword",
    category: "Memory",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: false,
    parameters: [
      { name: "query", type: "string", description: "Search query", required: true }
    ]
  },
  {
    id: "memory.forget",
    title: "Forget Memory",
    description: "Deprecate or delete a saved memory fact",
    category: "Memory",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: true,
    parameters: [
      { name: "id", type: "string", description: "Memory ID", required: true }
    ]
  },
  {
    id: "identity.view",
    title: "View Traits",
    description: "View your psychological traits and core attributes",
    category: "Identity",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: false,
    parameters: []
  },
  {
    id: "reflection.view",
    title: "View Insights",
    description: "View consistency reflections and insights",
    category: "Reflection",
    provider: "zenkai",
    type: "internal",
    requiresConfirmation: false,
    parameters: []
  }
];
