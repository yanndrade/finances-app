export const INVESTMENT_GOAL_PERCENT_STORAGE_KEY = "finance.investment-goal-percent";
export const DEFAULT_INVESTMENT_GOAL_PERCENT = 10;

export function normalizeInvestmentGoalPercent(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.min(100, Math.max(0, parsed));
    }
  }

  return DEFAULT_INVESTMENT_GOAL_PERCENT;
}

export function readStoredInvestmentGoalPercent(): number {
  if (typeof window === "undefined") {
    return DEFAULT_INVESTMENT_GOAL_PERCENT;
  }

  return normalizeInvestmentGoalPercent(
    window.localStorage.getItem(INVESTMENT_GOAL_PERCENT_STORAGE_KEY),
  );
}
