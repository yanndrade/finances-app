export type CategoryOption = {
  value: string;
  label: string;
};

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "food", label: "Alimentação" },
  { value: "transport", label: "Transporte" },
  { value: "housing", label: "Moradia" },
  { value: "health", label: "Saúde" },
  { value: "education", label: "Educação" },
  { value: "entertainment", label: "Lazer" },
  { value: "utilities", label: "Contas" },
  { value: "salary", label: "Salário" },
  { value: "freelance", label: "Freelance" },
  { value: "other", label: "Outros" },
];

export function getCategoryOptions(selectedValue?: string | null): CategoryOption[] {
  if (!selectedValue) {
    return CATEGORY_OPTIONS;
  }

  if (CATEGORY_OPTIONS.some((option) => option.value === selectedValue)) {
    return CATEGORY_OPTIONS;
  }

  return [{ value: selectedValue, label: selectedValue }, ...CATEGORY_OPTIONS];
}
