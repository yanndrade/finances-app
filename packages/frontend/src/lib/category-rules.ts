export type CategoryRule = {
  id: string;
  pattern: string;
  categoryId: string;
};

const CATEGORY_RULES_STORAGE_KEY = "finances.category-rules.v1";

export function readStoredCategoryRules(): CategoryRule[] {
  if (typeof window === "undefined") {
    return [];
  }

  const storedValue = window.localStorage.getItem(CATEGORY_RULES_STORAGE_KEY);
  if (!storedValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(storedValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeCategoryRule)
      .filter((rule): rule is CategoryRule => rule !== null);
  } catch {
    return [];
  }
}

export function storeCategoryRules(rules: CategoryRule[]): CategoryRule[] {
  const normalized = rules
    .map(normalizeCategoryRule)
    .filter((rule): rule is CategoryRule => rule !== null);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(CATEGORY_RULES_STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
}

export function buildCategoryRule(pattern: string, categoryId: string): CategoryRule | null {
  const normalizedPattern = pattern.trim().toLowerCase();
  const normalizedCategoryId = categoryId.trim();

  if (normalizedPattern.length === 0 || normalizedCategoryId.length === 0) {
    return null;
  }

  return {
    id: `${Date.now()}-${normalizedPattern}`,
    pattern: normalizedPattern,
    categoryId: normalizedCategoryId,
  };
}

function normalizeCategoryRule(value: unknown): CategoryRule | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as {
    id?: unknown;
    pattern?: unknown;
    categoryId?: unknown;
  };

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.pattern !== "string" ||
    typeof candidate.categoryId !== "string"
  ) {
    return null;
  }

  const id = candidate.id.trim();
  const pattern = candidate.pattern.trim().toLowerCase();
  const categoryId = candidate.categoryId.trim();

  if (id.length === 0 || pattern.length === 0 || categoryId.length === 0) {
    return null;
  }

  return {
    id,
    pattern,
    categoryId,
  };
}
