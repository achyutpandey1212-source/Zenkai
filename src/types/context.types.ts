import type { IMemory } from "@/models/Memory";
import type { IIdentityTrait } from "@/models/IdentityTrait";
import type { IReflection } from "@/models/Reflection";

// ── Context Metadata (Versioning & Diagnostics) ───────────────────────────
export interface ContextMetadata {
  version: number;
  createdAt: string;
  generatedFrom: string;
  diagnostics: {
    totalTokens: number;
    tokensPerLayer: Record<string, number>;
    currentIntent?: string;
    contextProfileUsed?: string;
    budgetLimit?: number;
    remainingBudget?: number;
    ignoredMemoriesCount?: number;
    droppedElements?: {
      type: "memory" | "reflection" | "trait" | "section";
      idOrName: string;
      reason: string;
    }[];
  };
}

// ── Normalized Contracts (Independent of MongoDB/Mongoose) ──────────────────
export interface NormalizedIdentityTrait {
  id: string;
  trait: string;
  category: string;
  description: string;
  confidence: number;
  stability: number;
  version: number;
  status: "active" | "candidate" | "deprecated";
  evidence: string;
  updatedAt?: string;
}

export interface NormalizedIdentity {
  activeTraits: NormalizedIdentityTrait[];
  candidateTraits: NormalizedIdentityTrait[];
  pendingProposalsCount: number;
}

export interface NormalizedPlanTask {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "completed" | "missed";
  priority: number;
  suggestedDate?: string;
  timeBlock?: string;
  dependencies: string[];
}

export interface NormalizedPlanGoal {
  id: string;
  title: string;
  description: string;
  status: "active" | "completed" | "paused" | "cancelled";
  priority: number;
  tasks: NormalizedPlanTask[];
}

export interface NormalizedPlanMilestone {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "completed" | "cancelled";
  priority: number;
  startDate: string;
  endDate: string;
  category: string;
  importance: number;
  flexibility: number;
  goals: NormalizedPlanGoal[];
}

export interface NormalizedPlan {
  id: string;
  title: string;
  description: string;
  status: "active" | "completed" | "archived";
  priority: number;
  estimatedDuration?: string;
  type: string;
  progress: number;
  milestones: NormalizedPlanMilestone[];
}

export interface NormalizedWeeklySchedule {
  scheduleId: string;
  version: number;
  validFrom: string;
  validTo: string;
  days: {
    date: string;
    focusTheme?: string;
    estimatedWorkload?: string;
    plannedFocusHours: number;
    workBlocks: {
      title: string;
      startTime: string;
      endTime: string;
      duration: number;
      priority: number;
      tasks: string[]; // task IDs
    }[];
  }[];
}

export interface NormalizedMemory {
  id: string;
  category: string;
  content: string;
  summary: string;
  confidence: number;
  importance: number;
  retrievalCount?: number;
  lastRetrievedAt?: string;
  createdAt?: string;
}

export interface NormalizedReflection {
  id: string;
  title: string;
  category: string;
  content: string;
  summary: string;
  confidence: number;
  stability: number;
  importance: number;
  evidenceCount: number;
}

export interface NormalizedProfile {
  profession?: string;
  longTermGoal?: string;
  currentFocus?: string;
  motivation?: string;
  dailyAvailability?: string;
  workStyle?: string;
  biggestChallenge?: string;
  timezone: string;
  calendarSynced: boolean;
  age?: number;
  country?: string;
  locale?: string;
  commitments?: {
    name: string;
    startTime: string;
    endTime: string;
    days: string[];
  }[];
  wakeUpTime?: string;
  sleepTime?: string;
  goals?: {
    title: string;
    priority: number;
  }[];
  schedulingStyle?: "Strict" | "Flexible" | "Balanced";
  focusDuration?: number;
  deepWorkTime?: "Morning" | "Afternoon" | "Evening" | "Night";
  roles?: string[];
  focusAreas?: string[];
  productivityChallenges?: string[];
}

// ── The Consolidated Normalized Cache Package ──────────────────────────────
export interface NormalizedUserContext {
  metadata: ContextMetadata;
  identity: NormalizedIdentity;
  activePlan: NormalizedPlan | null;
  weeklySchedule: NormalizedWeeklySchedule | null;
  memories: NormalizedMemory[];
  reflections: NormalizedReflection[];
  profile: NormalizedProfile;
}

// ── Agent-Specific Contract Payloads ────────────────────────────────────────

export interface CompanionContext {
  metadata: ContextMetadata;
  identity: {
    activeTraits: Omit<NormalizedIdentityTrait, "evidence" | "updatedAt">[];
  };
  currentState: {
    activePlanTitle?: string;
    activePlanDescription?: string;
    activePlanProgress?: number;
    activeMilestoneTitle?: string;
    activeMilestoneStartDate?: string;
    activeMilestoneEndDate?: string;
    activeGoalsCount: number;
    upcomingDeadline?: string;
    calendarSynced: boolean;
  } | null;
  memories: NormalizedMemory[];
  reflections: NormalizedReflection[];
  profile: Omit<NormalizedProfile, "timezone" | "calendarSynced">;
  todayAgenda?: {
    date: string;
    focusTheme?: string;
    estimatedWorkload?: string;
    plannedFocusHours: number;
    workBlocks: {
      title: string;
      startTime: string;
      endTime: string;
      duration: number;
      tasks: { id: string; title: string; status: string }[];
    }[];
  } | null;
}

export interface PlanningContext {
  metadata: ContextMetadata;
  identity: {
    activeTraits: Omit<NormalizedIdentityTrait, "evidence" | "updatedAt">[];
  };
  activePlan: NormalizedPlan | null;
  memories: NormalizedMemory[];
  reflections: NormalizedReflection[];
  profile: NormalizedProfile;
}
