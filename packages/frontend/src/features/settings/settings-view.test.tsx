import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SettingsView } from "./settings-view";

const defaultCategories = [
  { value: "pets", label: "Pets" },
  { value: "travel", label: "Viagens" },
];

describe("SettingsView", () => {
  it("renders actionable setup sections including cards and backup actions", async () => {
    const onExportBackup = vi.fn();
    const onOpenCards = vi.fn();

    render(
      <SettingsView
        accountsCount={1}
        cardsCount={2}
        categories={defaultCategories}
        isSubmitting={false}
        onCreateCategory={vi.fn(() => true)}
        onOpenAccounts={vi.fn()}
        onOpenCards={onOpenCards}
        onRemoveCategory={vi.fn()}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={onExportBackup}
      />,
    );

    expect(screen.getByText(/contas, cart(õ|o)es e estrutura base/i)).toBeInTheDocument();
    expect(screen.getByText(/^categorias$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^regras de auto-categorizacao$/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /gerenciar cart(õ|o)es/i }));
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
        cardsCount={0}
        categories={defaultCategories}
        isSubmitting={false}
        onCreateCategory={onCreateCategory}
        onOpenAccounts={vi.fn()}
        onOpenCards={vi.fn()}
        onRemoveCategory={onRemoveCategory}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/nova categoria/i), "Viagens");
    await userEvent.click(screen.getByRole("button", { name: /adicionar categoria/i }));
    await userEvent.click(screen.getAllByRole("button", { name: /excluir categoria/i })[0]);

    expect(onCreateCategory).toHaveBeenCalledWith("Viagens");
    expect(onRemoveCategory).toHaveBeenCalledWith("pets");
  });

  it("shows empty state when there are no categories", () => {
    render(
      <SettingsView
        accountsCount={0}
        cardsCount={0}
        categories={[]}
        isSubmitting={false}
        onCreateCategory={vi.fn(() => true)}
        onOpenAccounts={vi.fn()}
        onOpenCards={vi.fn()}
        onRemoveCategory={vi.fn()}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={vi.fn()}
      />,
    );

    expect(screen.getByText(/nenhuma categoria cadastrada ainda/i)).toBeInTheDocument();
  });

  it("keeps danger zone collapsed until the user expands it", async () => {
    render(
      <SettingsView
        accountsCount={0}
        cardsCount={0}
        categories={defaultCategories}
        isSubmitting={false}
        onCreateCategory={vi.fn(() => true)}
        onOpenAccounts={vi.fn()}
        onOpenCards={vi.fn()}
        onRemoveCategory={vi.fn()}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={vi.fn()}
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
});
