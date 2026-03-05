import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SettingsView } from "./settings-view";

const defaultCategories = [
  { value: "food", label: "Alimentacao" },
  { value: "other", label: "Outros" },
  { value: "pets", label: "Pets" },
];

describe("SettingsView", () => {
  it("renders actionable setup sections including cards and backup actions", async () => {
    const onExportBackup = vi.fn();
    const onOpenCards = vi.fn();

    render(
      <SettingsView
        accountsCount={1}
        budgetMonth="2026-03"
        cardsCount={2}
        categories={defaultCategories}
        categoryRules={[]}
        categoryBudgets={[]}
        isSubmitting={false}
        onCreateCategory={vi.fn(() => true)}
        onOpenAccounts={vi.fn()}
        onOpenCards={onOpenCards}
        onRemoveCategory={vi.fn()}
        onRemoveCategoryRule={vi.fn()}
        onUpsertCategoryBudget={vi.fn(() => Promise.resolve())}
        onUpsertCategoryRule={vi.fn(() => true)}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={onExportBackup}
        onUiDensityChange={vi.fn()}
        uiDensity="compact"
      />,
    );

    expect(screen.getByText(/contas, cartoes e estrutura base/i)).toBeInTheDocument();
    expect(screen.getByText(/^categorias$/i)).toBeInTheDocument();
    expect(screen.getByText(/^regras de auto-categorizacao$/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /gerenciar cartoes/i }));
    await userEvent.click(screen.getByRole("button", { name: /exportar backup json/i }));

    expect(onOpenCards).toHaveBeenCalledTimes(1);
    expect(onExportBackup).toHaveBeenCalledTimes(1);
  });

  it("lets the user add categories and remove custom ones", async () => {
    const onCreateCategory = vi.fn(() => true);
    const onRemoveCategory = vi.fn();

    render(
      <SettingsView
        accountsCount={0}
        budgetMonth="2026-03"
        cardsCount={0}
        categories={defaultCategories}
        categoryRules={[]}
        categoryBudgets={[]}
        isSubmitting={false}
        onCreateCategory={onCreateCategory}
        onOpenAccounts={vi.fn()}
        onOpenCards={vi.fn()}
        onRemoveCategory={onRemoveCategory}
        onRemoveCategoryRule={vi.fn()}
        onUpsertCategoryBudget={vi.fn(() => Promise.resolve())}
        onUpsertCategoryRule={vi.fn(() => true)}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={vi.fn()}
        onUiDensityChange={vi.fn()}
        uiDensity="compact"
      />,
    );

    await userEvent.type(screen.getByLabelText(/nova categoria/i), "Viagens");
    await userEvent.click(screen.getByRole("button", { name: /adicionar categoria/i }));
    await userEvent.click(screen.getByRole("button", { name: /excluir categoria/i }));

    expect(onCreateCategory).toHaveBeenCalledWith("Viagens");
    expect(onRemoveCategory).toHaveBeenCalledWith("pets");
  });

  it("lets the user manage persistent category rules", async () => {
    const onRemoveCategoryRule = vi.fn();
    const onUpsertCategoryRule = vi.fn(() => true);

    render(
      <SettingsView
        accountsCount={0}
        budgetMonth="2026-03"
        cardsCount={0}
        categories={defaultCategories}
        categoryRules={[
          {
            id: "rule-1",
            pattern: "uber",
            categoryId: "food",
          },
        ]}
        categoryBudgets={[]}
        isSubmitting={false}
        onCreateCategory={vi.fn(() => true)}
        onOpenAccounts={vi.fn()}
        onOpenCards={vi.fn()}
        onRemoveCategory={vi.fn()}
        onRemoveCategoryRule={onRemoveCategoryRule}
        onUpsertCategoryBudget={vi.fn(() => Promise.resolve())}
        onUpsertCategoryRule={onUpsertCategoryRule}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={vi.fn()}
        onUiDensityChange={vi.fn()}
        uiDensity="compact"
      />,
    );

    const existingRuleCard = screen.getByText("uber").closest(".settings-token-card");
    expect(existingRuleCard).not.toBeNull();

    await userEvent.type(screen.getByLabelText(/padrao da regra/i), "mercado");
    await userEvent.selectOptions(screen.getByLabelText(/categoria da regra/i), "pets");
    await userEvent.click(screen.getByRole("button", { name: /salvar regra/i }));
    await userEvent.click(within(existingRuleCard as HTMLElement).getByRole("button", { name: /^remover$/i }));

    expect(onUpsertCategoryRule).toHaveBeenCalledWith("mercado", "pets");
    expect(onRemoveCategoryRule).toHaveBeenCalledWith("rule-1");
  });

  it("keeps danger zone collapsed until the user expands it", async () => {
    render(
      <SettingsView
        accountsCount={0}
        budgetMonth="2026-03"
        cardsCount={0}
        categories={defaultCategories}
        categoryRules={[]}
        categoryBudgets={[]}
        isSubmitting={false}
        onCreateCategory={vi.fn(() => true)}
        onOpenAccounts={vi.fn()}
        onOpenCards={vi.fn()}
        onRemoveCategory={vi.fn()}
        onRemoveCategoryRule={vi.fn()}
        onUpsertCategoryBudget={vi.fn(() => Promise.resolve())}
        onUpsertCategoryRule={vi.fn(() => true)}
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
        accountsCount={0}
        budgetMonth="2026-03"
        cardsCount={0}
        categories={defaultCategories}
        categoryRules={[]}
        categoryBudgets={[]}
        isSubmitting={false}
        onCreateCategory={vi.fn(() => true)}
        onOpenAccounts={vi.fn()}
        onOpenCards={vi.fn()}
        onRemoveCategory={vi.fn()}
        onRemoveCategoryRule={vi.fn()}
        onUpsertCategoryBudget={vi.fn(() => Promise.resolve())}
        onUpsertCategoryRule={vi.fn(() => true)}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={vi.fn()}
        onUiDensityChange={onUiDensityChange}
        uiDensity="compact"
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: /denso/i }));

    expect(onUiDensityChange).toHaveBeenCalledWith("dense");
  });
});
