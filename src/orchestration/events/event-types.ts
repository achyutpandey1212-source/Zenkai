/**
 * Zenkai Internal Event System — Event Types
 *
 * These events decouple nodes from each other.
 * Future agents (Calendar, Gmail, Notifications, Search) subscribe
 * to these events without modifying existing orchestration.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Event Names
// ─────────────────────────────────────────────────────────────────────────────

export enum ZenkaiEvent {
  // Memory lifecycle
  MemoryAdmitted = "MemoryAdmitted",
  MemoryConsolidated = "MemoryConsolidated",

  // Goal / Plan lifecycle
  GoalChanged = "GoalChanged",
  PlanCreated = "PlanCreated",
  PlanUpdated = "PlanUpdated",
  PlanArchived = "PlanArchived",

  // Task / Milestone lifecycle
  TaskCompleted = "TaskCompleted",
  TaskDeferred = "TaskDeferred",
  MilestoneCompleted = "MilestoneCompleted",
  MilestoneCreated = "MilestoneCreated",

  // Identity lifecycle
  IdentityProposalCreated = "IdentityProposalCreated",
  IdentityTraitEvolved = "IdentityTraitEvolved",
  IdentityTraitDeprecated = "IdentityTraitDeprecated",

  // Reflection lifecycle
  ReflectionUpdated = "ReflectionUpdated",
  ReflectionCreated = "ReflectionCreated",
  ReflectionDeprecated = "ReflectionDeprecated",

  // Execution / Agenda lifecycle
  AgendaUpdated = "AgendaUpdated",
  AgendaCreated = "AgendaCreated",
  TimelineUpdated = "TimelineUpdated",

  // Workflow lifecycle
  WorkflowStarted = "WorkflowStarted",
  WorkflowCompleted = "WorkflowCompleted",
  WorkflowFailed = "WorkflowFailed",
  NodeSkipped = "NodeSkipped",
  NodeFailed = "NodeFailed",
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Payloads
// ─────────────────────────────────────────────────────────────────────────────

export interface MemoryAdmittedPayload {
  uid: string;
  workflowId: string;
  memoryId: string;
  category: string;
  content: string;
}

export interface GoalChangedPayload {
  uid: string;
  workflowId: string;
  goalId?: string;
  planType?: string;
  action: "created" | "updated" | "archived";
}

export interface TaskCompletedPayload {
  uid: string;
  workflowId: string;
  taskId: string;
  taskTitle: string;
}

export interface MilestoneCompletedPayload {
  uid: string;
  workflowId: string;
  milestoneId: string;
  milestoneTitle: string;
}

export interface IdentityProposalCreatedPayload {
  uid: string;
  workflowId: string;
  trait: string;
  category: string;
  confidence: number;
}

export interface ReflectionUpdatedPayload {
  uid: string;
  workflowId: string;
  reflectionId: string;
  title: string;
  action: "created" | "updated" | "deprecated";
}

export interface AgendaUpdatedPayload {
  uid: string;
  workflowId: string;
  date: string;
  action: "created" | "regenerated";
}

export interface WorkflowLifecyclePayload {
  uid: string;
  workflowId: string;
  workflowVersion: string;
  graphVersion: string;
  durationMs?: number;
  errorCount?: number;
}

export interface NodeEventPayload {
  uid: string;
  workflowId: string;
  nodeName: string;
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Event (stored in GraphState.emittedEvents)
// ─────────────────────────────────────────────────────────────────────────────

export interface InternalEvent {
  name: string;
  payload: unknown;
  emittedAt: string;
}
