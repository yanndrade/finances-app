import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SettingsView } from "./settings-view";

describe("SettingsView", () => {
  it("renders data and backup section with export action", async () => {
    const onExportBackup = vi.fn();

    render(
      <SettingsView
        isSubmitting={false}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={onExportBackup}
      />,
    );

    expect(screen.getByText(/dados e backup/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /exportar json/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /exportar json/i }));
    expect(onExportBackup).toHaveBeenCalledTimes(1);
  });

  it("renders productivity shortcuts section", () => {
    render(
      <SettingsView
        isSubmitting={false}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={vi.fn()}
      />,
    );

    expect(screen.getByText(/produtividade/i)).toBeInTheDocument();
    expect(screen.getByText(/ctrl\+n/i)).toBeInTheDocument();
    expect(screen.getByText(/ctrl\+k/i)).toBeInTheDocument();
  });

  it("renders danger zone with reset action", async () => {
    const onResetApplicationData = vi.fn(() => Promise.resolve());

    render(
      <SettingsView
        isSubmitting={false}
        onResetApplicationData={onResetApplicationData}
        onExportBackup={vi.fn()}
      />,
    );

    expect(screen.getByText(/zona de perigo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zerar tudo/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /zerar tudo/i }));
    expect(onResetApplicationData).toHaveBeenCalledTimes(1);
  });

  it("disables destructive actions while submitting", () => {
    render(
      <SettingsView
        isSubmitting={true}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /zerar tudo/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /exportar json/i })).toBeDisabled();
  });

  it("does not render Estrutura base or Categorias sections", () => {
    render(
      <SettingsView
        isSubmitting={false}
        onResetApplicationData={vi.fn(() => Promise.resolve())}
        onExportBackup={vi.fn()}
      />,
    );

    expect(screen.queryByText(/^estrutura base$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^categorias$/i)).not.toBeInTheDocument();
  });
});
