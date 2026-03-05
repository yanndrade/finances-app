export type CategoryOption = {
  value: string;
  label: string;
};

const CATEGORY_STORAGE_KEY = "finances.custom-categories.v1";

export const DEFAULT_CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "food", label: "Alimentacao" },
  { value: "transport", label: "Transporte" },
  { value: "housing", label: "Moradia" },
  { value: "health", label: "Saude" },
  { value: "education", label: "Educacao" },
  { value: "entertainment", label: "Lazer" },
  { value: "utilities", label: "Contas" },
  { value: "salary", label: "Salario" },
  { value: "freelance", label: "Freelance" },
  { value: "other", label: "Outros" },
] as const;

export function getCategoryOptions(
  selectedValue?: string | null,
  options: CategoryOption[] = readStoredCategoryOptions(),
): CategoryOption[] {
  if (!selectedValue) {
    return options;
  }

  if (options.some((option) => option.value === selectedValue)) {
    return options;
  }

  return [{ value: selectedValue, label: humanizeCategoryId(selectedValue) }, ...options];
}

export function readStoredCategoryOptions(): CategoryOption[] {
  if (typeof window === "undefined") {
    return [...DEFAULT_CATEGORY_OPTIONS];
  }

  const storedValue = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
  if (!storedValue) {
    return [...DEFAULT_CATEGORY_OPTIONS];
  }

  try {
    const parsed = JSON.parse(storedValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_CATEGORY_OPTIONS];
    }

    const normalized = parsed
      .map(normalizeCategoryOption)
      .filter((option): option is CategoryOption => option !== null);

    if (normalized.length === 0) {
      return [...DEFAULT_CATEGORY_OPTIONS];
    }

    return normalized;
  } catch {
    return [...DEFAULT_CATEGORY_OPTIONS];
  }
}

export function storeCategoryOptions(options: CategoryOption[]): CategoryOption[] {
  const normalized = options
    .map(normalizeCategoryOption)
    .filter((option): option is CategoryOption => option !== null);

  if (normalized.length === 0) {
    return [...DEFAULT_CATEGORY_OPTIONS];
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
}

export function createCategoryOption(
  label: string,
  existingOptions: CategoryOption[],
): CategoryOption | null {
  const normalizedLabel = label.trim();
  if (normalizedLabel.length === 0) {
    return null;
  }

  const value = createCategoryId(normalizedLabel, existingOptions);
  return {
    value,
    label: normalizedLabel,
  };
}

export function isDefaultCategory(categoryId: string): boolean {
  return DEFAULT_CATEGORY_OPTIONS.some((option) => option.value === categoryId);
}

export function resolveCategoryLabel(
  categoryId: string,
  options: CategoryOption[] = readStoredCategoryOptions(),
): string {
  return (
    options.find((option) => option.value === categoryId)?.label ??
    BUILT_IN_CATEGORY_LABELS[categoryId] ??
    humanizeCategoryId(categoryId)
  );
}

function normalizeCategoryOption(value: unknown): CategoryOption | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as { value?: unknown; label?: unknown };
  if (typeof candidate.value !== "string" || typeof candidate.label !== "string") {
    return null;
  }

  const normalizedValue = candidate.value.trim();
  const normalizedLabel = candidate.label.trim();
  if (normalizedValue.length === 0 || normalizedLabel.length === 0) {
    return null;
  }

  return {
    value: normalizedValue,
    label: normalizedLabel,
  };
}

function createCategoryId(label: string, existingOptions: CategoryOption[]): string {
  const baseSlug = slugifyCategoryLabel(label) || "categoria";
  const existingValues = new Set(existingOptions.map((option) => option.value));

  if (!existingValues.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (existingValues.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

function slugifyCategoryLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function humanizeCategoryId(categoryId: string): string {
  return categoryId
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const BUILT_IN_CATEGORY_LABELS: Record<string, string> = {
  clothing: "Vestuario",
  transfer: "Transferencia",
  invoice_payment: "Pagamento de fatura",
  investment_contribution: "Aporte em investimento",
  investment_withdrawal: "Resgate de investimento",
  reimbursement: "Reembolso",
  reimbursement_received: "Reembolso recebido",
};
