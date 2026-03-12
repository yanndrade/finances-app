import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppShell } from "./app-shell";
import type { AppView } from "./sidebar";

function renderShell(overrides?: Partial<ComponentProps<typeof AppShell>>) {
  const onNavigate = vi.fn<(view: AppView) => void>();
  const onOpenQuickAdd = vi.fn();
  const onOpenCommandPalette = vi.fn();
  const onMonthChange = vi.fn();

  const result = render(
    <AppShell
      surface="desktop"
      activeView="dashboard"
      title="Visao geral"
      description="Resumo mensal e atalhos."
      onNavigate={onNavigate}
      onOpenQuickAdd={onOpenQuickAdd}
      onOpenCommandPalette={onOpenCommandPalette}
      uiDensity="compact"
      month="2026-03"
      onMonthChange={onMonthChange}
      {...overrides}
    >
      <section>Conteudo</section>
    </AppShell>,
  );

  return { ...result, onNavigate, onOpenQuickAdd, onOpenCommandPalette, onMonthChange };
}

describe("AppShell responsive behavior", () => {
  it("shows desktop sidebar and contextual panel on desktop surface", () => {
    renderShell({
      contextPanel: <div>Contexto desktop</div>,
    });

    expect(screen.getByRole("navigation", { name: /navega.*principal/i })).toBeInTheDocument();
    expect(screen.getByText("Contexto desktop")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /mobile/i })).not.toBeInTheDocument();
  });

  it("renders 5-item mobile navigation with reimbursements and quick add action", async () => {
    const user = userEvent.setup();
    const { onNavigate, onOpenQuickAdd } = renderShell({ surface: "mobile" });

    const mobileNav = screen.getByRole("navigation", { name: /mobile/i });
    expect(mobileNav).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /in.*cio/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hist/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cart/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fixos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reembols/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^contas$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /reembols/i }));
    expect(onNavigate).toHaveBeenCalledWith("reimbursements");

    await user.click(screen.getByRole("button", { name: /adicionar gasto/i }));
    expect(onOpenQuickAdd).toHaveBeenCalledTimes(1);
  });

  it("forces a mobile-safe view when desktop-only sections are active", async () => {
    const { onNavigate } = renderShell({
      surface: "mobile",
      activeView: "investments",
    });

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith("dashboard");
    });
  });

  it("switches from desktop to mobile layout when surface changes", async () => {
    const { rerender, onNavigate } = renderShell({
      activeView: "investments",
      surface: "desktop",
    });

    expect(screen.getByRole("navigation", { name: /navega.*principal/i })).toBeInTheDocument();

    rerender(
      <AppShell
        surface="mobile"
        activeView="investments"
        title="Visao geral"
        description="Resumo mensal e atalhos."
        onNavigate={onNavigate}
        onOpenQuickAdd={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        uiDensity="compact"
        month="2026-03"
        onMonthChange={vi.fn()}
      >
        <section>Conteudo</section>
      </AppShell>,
    );

    await waitFor(() => {
      expect(screen.getByRole("navigation", { name: /mobile/i })).toBeInTheDocument();
      expect(onNavigate).toHaveBeenCalledWith("dashboard");
    });
  });

  it("routes keyboard shortcuts to quick add and command palette", () => {
    const { onOpenQuickAdd, onOpenCommandPalette } = renderShell();

    fireEvent.keyDown(window, { key: "n", ctrlKey: true });
    expect(onOpenQuickAdd).toHaveBeenCalledTimes(1);
    expect(onOpenCommandPalette).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1);
  });

  it("renders MonthPicker on dashboard and handles month changes", () => {
    const { onMonthChange } = renderShell();

    const monthInput = screen.getByLabelText(/selecionar compet/i);
    expect(monthInput).toBeInTheDocument();
    expect(monthInput).toHaveAttribute("type", "month");
    expect(monthInput).toHaveValue("2026-03");

    fireEvent.change(monthInput, { target: { value: "2026-04" } });
    expect(onMonthChange).toHaveBeenCalledWith("2026-04");
  });

  it("keeps MonthPicker available when the shell receives month controls", () => {
    renderShell({ activeView: "cards" });

    const monthInput = screen.getByLabelText(/selecionar compet/i);
    expect(monthInput).toBeInTheDocument();
    expect(monthInput).toHaveValue("2026-03");
  });
});
