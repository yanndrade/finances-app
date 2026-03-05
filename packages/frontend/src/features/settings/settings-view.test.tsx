import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SettingsView } from "./settings-view";

describe("SettingsView", () => {
  it("renders actionable setup sections including backup export", async () => {
    const onExportBackup = vi.fn();

    render(
      <SettingsView
        budgetMonth="2026-03"
        categoryBudgets={[]}
        isSubmitting={false}
        onOpenAccounts={vi.fn()}
        onUpsertCategoryBudget={vi.fn(() => Promise.resolve())}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={onExportBackup}
        onUiDensityChange={vi.fn()}
        uiDensity="compact"
      />,
    );

    expect(screen.getByText(/categorias e hierarquia/i)).toBeInTheDocument();
    expect(screen.getByText(/regras de auto-categorizacao/i)).toBeInTheDocument();
    expect(screen.getByText(/importacao, exportacao e backup/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /exportar backup json/i }));

    expect(onExportBackup).toHaveBeenCalledTimes(1);
  });

  it("keeps danger zone collapsed until the user expands it", async () => {
    render(
      <SettingsView
        budgetMonth="2026-03"
        categoryBudgets={[]}
        isSubmitting={false}
        onOpenAccounts={vi.fn()}
        onUpsertCategoryBudget={vi.fn(() => Promise.resolve())}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={vi.fn()}
        onUiDensityChange={vi.fn()}
        uiDensity="compact"
      />,
    );

    expect(
      screen.queryByRole("button", { name: /apagar todos os dados/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /zona de perigo/i }));

    expect(
      screen.getByRole("button", { name: /apagar todos os dados/i }),
    ).toBeInTheDocument();
  });

  it("lets the user change the global density preference", async () => {
    const onUiDensityChange = vi.fn();

    render(
      <SettingsView
        budgetMonth="2026-03"
        categoryBudgets={[]}
        isSubmitting={false}
        onOpenAccounts={vi.fn()}
        onUpsertCategoryBudget={vi.fn(() => Promise.resolve())}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={vi.fn()}
        onUiDensityChange={onUiDensityChange}
        uiDensity="compact"
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: /denso/i }));

    expect(onUiDensityChange).toHaveBeenCalledWith("dense");
  });

  it("links the settings hub back to account management", async () => {
    const onOpenAccounts = vi.fn();

    render(
      <SettingsView
        budgetMonth="2026-03"
        categoryBudgets={[]}
        isSubmitting={false}
        onOpenAccounts={onOpenAccounts}
        onUpsertCategoryBudget={vi.fn(() => Promise.resolve())}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={vi.fn()}
        onUiDensityChange={vi.fn()}
        uiDensity="compact"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /gerenciar contas/i }));

    expect(onOpenAccounts).toHaveBeenCalledTimes(1);
  });
});
