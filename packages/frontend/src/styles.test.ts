import { readFileSync } from "node:fs";
import path from "node:path";

function cssBlock(styles: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));

  expect(match).not.toBeNull();

  return match?.[1] ?? "";
}

describe("styles", () => {
  it("defines finance theme tokens for semantic states and chart usage", () => {
    const styles = readFileSync(path.resolve(__dirname, "./styles.css"), "utf8");

    expect(styles).toContain("--background: 0 0% 98%");
    expect(styles).toContain("--surface: 0 0% 100%");
    expect(styles).toContain("--surface-elevated:");
    expect(styles).toContain("--primary: 276 100% 20%");
    expect(styles).toContain("--primary-accent: 280 52% 46%");
    expect(styles).toContain("--primary-soft: 278 100% 87%");
    expect(styles).toContain("--success: 160 84% 39%");
    expect(styles).toContain("--warning: 38 92% 50%");
    expect(styles).toContain("--danger: 343 78% 50%");
    expect(styles).toContain("--finance-income: var(--success)");
    expect(styles).toContain("--finance-expense: var(--danger)");
    expect(styles).toContain("--finance-transfer: 220 9% 46%");
    expect(styles).toContain("--chart-primary: var(--primary-accent)");
    expect(styles).toContain("--chart-income: var(--success)");
    expect(styles).toContain("--chart-expense: var(--danger)");
    expect(styles).toContain("--radius: 1rem");
  });

  it("uses the chosen typography tokens and numeric alignment utilities", () => {
    const styles = readFileSync(path.resolve(__dirname, "./styles.css"), "utf8");

    expect(styles).toContain('font-family: "Geist Sans", "Inter", "Segoe UI", sans-serif;');

    const moneyValue = cssBlock(styles, ".money-value");
    expect(moneyValue).toContain("font-variant-numeric: tabular-nums;");
    expect(moneyValue).toContain("font-feature-settings: \"tnum\" 1;");
  });

  it("keeps chart tooltip and chart surface classes as a shared convention", () => {
    const styles = readFileSync(path.resolve(__dirname, "./styles.css"), "utf8");

    const chartSurface = cssBlock(styles, ".chart-surface");
    expect(chartSurface).toContain("background: hsl(var(--surface-elevated));");
    expect(chartSurface).toContain("border: 1px solid hsl(var(--border));");

    const chartTooltip = cssBlock(styles, ".chart-tooltip");
    expect(chartTooltip).toContain("background: hsl(var(--surface));");
    expect(chartTooltip).toContain("border: 1px solid hsl(var(--border));");
    expect(chartTooltip).toContain("border-radius: 0.75rem;");
  });
});
