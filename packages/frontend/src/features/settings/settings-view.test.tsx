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

    expect(screen.getByText(/^estrutura base$/i)).toBeInTheDocument();
    expect(screen.getByText(/^categorias$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^regras de auto-categorizacao$/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^cart(õ|o)es$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^backup json$/i }));

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
    await userEvent.click(screen.getByRole("button", { name: "+" }));
    await userEvent.click(screen.getAllByRole("button", { name: /×/i })[0]);

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

    expect(screen.queryByLabelText(/lista de categorias/i)).not.toBeInTheDocument();
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
      screen.queryByRole("button", { name: /zerar tudo/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /zona de perigo/i }));

    expect(
      screen.getByRole("button", { name: /zerar tudo/i }),
    ).toBeInTheDocument();
  });
});
