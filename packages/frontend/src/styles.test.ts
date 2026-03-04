import { readFileSync } from "node:fs";
import path from "node:path";

function cssBlock(styles: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));

  expect(match).not.toBeNull();

  return match?.[1] ?? "";
}

describe("styles", () => {
  it("keeps the premium light theme tokens without reintroducing the default dark overrides", () => {
    const styles = readFileSync(path.resolve(__dirname, "./styles.css"), "utf8");

    expect(styles).toContain("--background: 210 40% 98%");
    expect(styles).toContain("--primary: 263 70% 42%");
    expect(styles).toContain("--radius: 1rem");
    expect(styles).not.toContain("--primary: 0 0% 9%;");
    expect(styles).not.toContain("--radius: 0.5rem;");
  });

  it("uses the cards typography system across the shell and shared headings", () => {
    const styles = readFileSync(path.resolve(__dirname, "./styles.css"), "utf8");

    const brandTitle = cssBlock(styles, ".brand-title");
    expect(brandTitle).toContain("font-size: clamp(1.6rem, 2vw, 2rem);");
    expect(brandTitle).toContain("font-weight: 900;");
    expect(brandTitle).toContain("letter-spacing: -0.04em;");

    const eyebrow = cssBlock(styles, ".eyebrow");
    expect(eyebrow).toContain("font-size: 0.68rem;");
    expect(eyebrow).toContain("font-weight: 900;");
    expect(eyebrow).toContain("letter-spacing: 0.22em;");

    const navLabel = cssBlock(styles, ".nav-item__label");
    expect(navLabel).toContain("font-size: 1rem;");
    expect(navLabel).toContain("font-weight: 800;");
    expect(navLabel).toContain("letter-spacing: -0.02em;");

    const pageTitle = cssBlock(styles, ".page-title");
    expect(pageTitle).toContain("font-size: clamp(2.2rem, 3.4vw, 3.35rem);");
    expect(pageTitle).toContain("font-weight: 900;");
    expect(pageTitle).toContain("letter-spacing: -0.05em;");

    const sectionTitle = cssBlock(styles, ".section-title");
    expect(sectionTitle).toContain("font-size: clamp(1.35rem, 2vw, 1.8rem);");
    expect(sectionTitle).toContain("font-weight: 900;");
    expect(sectionTitle).toContain("letter-spacing: -0.04em;");
  });

  it("extends the cards visual language to form labels and table headers", () => {
    const styles = readFileSync(path.resolve(__dirname, "./styles.css"), "utf8");

    const quickEntryTitle = cssBlock(styles, ".quick-entry-form__title");
    expect(quickEntryTitle).toContain("font-size: 1.25rem;");
    expect(quickEntryTitle).toContain("font-weight: 900;");
    expect(quickEntryTitle).toContain("letter-spacing: -0.03em;");

    const quickEntryCopy = cssBlock(styles, ".quick-entry-form__copy");
    expect(quickEntryCopy).toContain("color: #64748b;");
    expect(quickEntryCopy).toContain("font-size: 0.88rem;");
    expect(quickEntryCopy).toContain("line-height: 1.6;");

    const quickEntryField = cssBlock(styles, ".quick-entry-field");
    expect(quickEntryField).toContain("font-size: 0.72rem;");
    expect(quickEntryField).toContain("font-weight: 800;");
    expect(quickEntryField).toContain("letter-spacing: 0.16em;");
    expect(quickEntryField).toContain("text-transform: uppercase;");

    const formLabel = cssBlock(
      styles,
      ".form-card label,\n.filters-grid label,\n.form-grid label",
    );
    expect(formLabel).toContain("font-size: 0.72rem;");
    expect(formLabel).toContain("font-weight: 800;");
    expect(formLabel).toContain("letter-spacing: 0.16em;");
    expect(formLabel).toContain("text-transform: uppercase;");

    const fieldInput = cssBlock(styles, "input,\nselect");
    expect(fieldInput).toContain("font: inherit;");

    const fieldControl = cssBlock(
      styles,
      ".form-card input,\n.form-card select,\n.filters-grid input,\n.filters-grid select,\n.form-grid input,\n.form-grid select,\n.quick-entry-field input,\n.quick-entry-field select",
    );
    expect(fieldControl).toContain("font-size: 0.98rem;");
    expect(fieldControl).toContain("font-weight: 600;");
    expect(fieldControl).toContain("letter-spacing: -0.01em;");

    const tableHeader = cssBlock(styles, ".data-table th");
    expect(tableHeader).toContain("font-size: 0.7rem;");
    expect(tableHeader).toContain("font-weight: 900;");
    expect(tableHeader).toContain("letter-spacing: 0.18em;");
    expect(tableHeader).toContain("color: #94a3b8;");
  });
});
