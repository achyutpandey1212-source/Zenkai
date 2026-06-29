export interface ProfileBudgets {
  companion: number;
  planning: number;
  weekly_scheduling: number;
  motivation: number;
  identity: number;
  reflection: number;
  progress_review: number;
}

export const CONTEXT_BUDGET_REGISTRY: Record<"free" | "pro", ProfileBudgets> = {
  free: {
    companion: 2000,
    planning: 5000,
    weekly_scheduling: 4500,
    motivation: 1500,
    identity: 1500,
    reflection: 1500,
    progress_review: 3000,
  },
  pro: {
    companion: 4000,
    planning: 10000,
    weekly_scheduling: 9000,
    motivation: 3000,
    identity: 3000,
    reflection: 3000,
    progress_review: 6000,
  },
};

/**
   * Helper to retrieve budgets based on user plan tier.
   * Defaulting to free budget limits.
   */
export function getContextBudgets(tier?: string): ProfileBudgets {
  if (tier === "pro") return CONTEXT_BUDGET_REGISTRY.pro;
  return CONTEXT_BUDGET_REGISTRY.free;
}
