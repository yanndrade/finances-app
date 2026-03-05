import { CHART_THEME, chartClassNames } from "./chart-theme";

describe("chart theme", () => {
  it("centralizes chart colors using design tokens", () => {
    expect(CHART_THEME.primary).toBe("hsl(var(--chart-primary))");
    expect(CHART_THEME.income).toBe("hsl(var(--chart-income))");
    expect(CHART_THEME.expense).toBe("hsl(var(--chart-expense))");
    expect(CHART_THEME.transfer).toBe("hsl(var(--chart-transfer))");
    expect(CHART_THEME.grid).toBe("hsl(var(--border))");
  });

  it("exposes shared class names for chart cards and tooltip containers", () => {
    expect(chartClassNames.surface).toBe("chart-surface");
    expect(chartClassNames.tooltip).toBe("chart-tooltip");
  });
});
