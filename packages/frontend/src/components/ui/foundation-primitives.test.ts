import { readdirSync } from "node:fs";
import path from "node:path";

describe("ui foundation primitives", () => {
  it("includes the base shadcn components for core financial flows", () => {
    const componentFiles = readdirSync(path.resolve(__dirname));

    expect(componentFiles).toEqual(
      expect.arrayContaining([
        "button.tsx",
        "input.tsx",
        "select.tsx",
        "popover.tsx",
        "calendar.tsx",
        "date-picker.tsx",
        "card.tsx",
        "table.tsx",
        "dialog.tsx",
        "sheet.tsx",
        "tabs.tsx",
        "form.tsx",
      ]),
    );
  });
});
