export const CHART_THEME = {
  primary: "hsl(var(--chart-primary))",
  income: "hsl(var(--chart-income))",
  expense: "hsl(var(--chart-expense))",
  transfer: "hsl(var(--chart-transfer))",
  grid: "hsl(var(--border))",
} as const;

export const chartClassNames = {
  surface: "chart-surface",
  tooltip: "chart-tooltip",
} as const;
