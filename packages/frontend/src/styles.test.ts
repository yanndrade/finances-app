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

    expect(styles).toContain("--background: 210 22% 96%");
    expect(styles).toContain("--surface: 0 0% 100%");
    expect(styles).toContain("--surface-elevated:");
    expect(styles).toContain("--mica-base:");
    expect(styles).toContain("--acrylic-surface:");
    expect(styles).toContain("--smoke-overlay:");
    expect(styles).toContain("--ledger-dense-background:");
    expect(styles).toContain("--primary: 282 81% 30%");
    expect(styles).toContain("--primary-accent: 282 73% 40%");
    expect(styles).toContain("--primary-soft: 282 55% 74%");
    expect(styles).toContain("--success: 160 84% 39%");
    expect(styles).toContain("--warning: 38 92% 50%");
    expect(styles).toContain("--danger: 343 78% 50%");
    expect(styles).toContain("--finance-income: 155 60% 28%");
    expect(styles).toContain("--finance-expense: 350 55% 40%");
    expect(styles).toContain("--finance-transfer: 213 18% 50%");
    expect(styles).toContain("--chart-primary: var(--primary-accent)");
    expect(styles).toContain("--chart-income: var(--finance-income)");
    expect(styles).toContain("--chart-expense: var(--finance-expense)");
    expect(styles).toContain("--radius: 0.75rem");
  });

  it("uses the chosen typography tokens and numeric alignment utilities", () => {
    const styles = readFileSync(path.resolve(__dirname, "./styles.css"), "utf8");

    expect(styles).toContain('font-family: "Segoe UI Variable Text", "Segoe UI", "Inter", sans-serif;');
    expect(styles).toMatch(/"Segoe UI Variable Display",\s*"Segoe UI Variable Text",\s*"Segoe UI",\s*sans-serif/);

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

  it("applies fluent materials for desktop shell and dense ledger readability", () => {
    const styles = readFileSync(path.resolve(__dirname, "./styles.css"), "utf8");

    const appLayout = cssBlock(styles, ".app-layout");
    expect(appLayout).toContain("background: var(--mica-base);");

    const drawer = cssBlock(styles, ".ledger-detail-drawer");
    expect(drawer).toContain("background: var(--acrylic-surface);");

    const denseTable = cssBlock(styles, ".table-shell--dense");
    expect(denseTable).toContain("background: var(--ledger-dense-background);");

    const modalOverlay = cssBlock(styles, ".modal-overlay");
    expect(modalOverlay).toContain("background: var(--smoke-overlay);");

    const modalContent = cssBlock(styles, ".modal-content");
    expect(modalContent).toContain("background: var(--acrylic-surface);");

    const toast = cssBlock(styles, ".app-toast");
    expect(toast).toContain("background: var(--acrylic-surface);");
  });
});
