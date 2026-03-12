export type CategoryOption = {
  value: string;
  label: string;
};

const CATEGORY_STORAGE_KEY = "finances.custom-categories.v1";

const LEGACY_DEFAULT_CATEGORY_IDS = new Set([
  "food",
  "transport",
  "housing",
  "health",
  "education",
  "entertainment",
  "utilities",
  "salary",
  "freelance",
  "other",
]);

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

  return [{ value: selectedValue, label: fallbackCategoryLabel(selectedValue) }, ...options];
}

export function readStoredCategoryOptions(): CategoryOption[] {
  if (typeof window === "undefined") {
    return [];
  }

  const storedValue = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
  if (!storedValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(storedValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeCategoryOption)
      .filter((option): option is CategoryOption => option !== null)
      .filter((option) => !LEGACY_DEFAULT_CATEGORY_IDS.has(option.value));
  } catch {
    return [];
  }
}

export function storeCategoryOptions(options: CategoryOption[]): CategoryOption[] {
  const normalized = options
    .map(normalizeCategoryOption)
    .filter((option): option is CategoryOption => option !== null);

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

export function resolveCategoryLabel(
  categoryId: string,
  options: CategoryOption[] = readStoredCategoryOptions(),
): string {
  return (
    options.find((option) => option.value === categoryId)?.label ??
    fallbackCategoryLabel(categoryId)
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

function fallbackCategoryLabel(categoryId: string): string {
  return BUILT_IN_CATEGORY_LABELS[categoryId] ?? humanizeCategoryId(categoryId);
}

const BUILT_IN_CATEGORY_LABELS: Record<string, string> = {
  food: "Alimentação",
  transport: "Transporte",
  housing: "Moradia",
  health: "Saúde",
  education: "Educação",
  entertainment: "Lazer",
  utilities: "Contas",
  salary: "Salário",
  freelance: "Freelance",
  other: "Outros",
  clothing: "Vestuário",
  transfer: "Transferência",
  invoice_payment: "Pagamento de fatura",
  investment_contribution: "Aporte em investimento",
  investment_withdrawal: "Resgate de investimento",
  reimbursement: "Reembolso",
  reimbursement_received: "Reembolso recebido",
};
