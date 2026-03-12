import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppShell } from "./app-shell";
import type { AppView } from "./sidebar";

type MatchMediaController = {
  setMatches: (matches: boolean) => void;
};

function installMatchMedia(initialMatches: boolean): MatchMediaController {
  let currentMatches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => {
      return {
        get matches() {
          return currentMatches;
        },
        media: "(max-width: 900px)",
        onchange: null,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners.add(listener);
        },
        removeEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void,
        ) => {
          listeners.delete(listener);
        },
        addListener: (listener: (event: MediaQueryListEvent) => void) => {
          listeners.add(listener);
        },
        removeListener: (listener: (event: MediaQueryListEvent) => void) => {
          listeners.delete(listener);
        },
        dispatchEvent: () => true,
      } as MediaQueryList;
    }),
  );

  return {
    setMatches(nextMatches: boolean) {
      currentMatches = nextMatches;
      const event = { matches: currentMatches } as MediaQueryListEvent;
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

function renderShell(overrides?: Partial<ComponentProps<typeof AppShell>>) {
  const onNavigate = vi.fn<(view: AppView) => void>();
  const onOpenQuickAdd = vi.fn();
  const onOpenCommandPalette = vi.fn();
  const onMonthChange = vi.fn();

  render(
    <AppShell
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

  return { onNavigate, onOpenQuickAdd, onOpenCommandPalette, onMonthChange };
}

describe("AppShell responsive behavior", () => {
  it("shows desktop sidebar and contextual panel when not on mobile", () => {
    installMatchMedia(false);

    renderShell({
      contextPanel: <div>Contexto desktop</div>,
    });

    expect(screen.getByRole("navigation", { name: /navega.*principal/i })).toBeInTheDocument();
    expect(screen.getByText("Contexto desktop")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /mobile/i })).not.toBeInTheDocument();
  });

  it("renders reduced mobile navigation with a prominent add-expense action", async () => {
    installMatchMedia(true);
    const user = userEvent.setup();
    const { onNavigate, onOpenQuickAdd } = renderShell();

    const mobileNav = screen.getByRole("navigation", { name: /mobile/i });
    expect(mobileNav).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /in.*cio/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hist/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cart/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /relatorios/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^contas$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cart/i }));
    expect(onNavigate).toHaveBeenCalledWith("cards");

    await user.click(screen.getByRole("button", { name: /adicionar gasto/i }));
    expect(onOpenQuickAdd).toHaveBeenCalledTimes(1);
  });

  it("forces a mobile-safe view when desktop-only sections are active", async () => {
    installMatchMedia(true);
    const { onNavigate } = renderShell({
      activeView: "investments",
    });

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith("dashboard");
    });
  });

  it("switches from desktop to mobile layout when viewport changes", async () => {
    const controller = installMatchMedia(false);
    const { onNavigate } = renderShell({
      activeView: "investments",
    });

    expect(screen.getByRole("navigation", { name: /navega.*principal/i })).toBeInTheDocument();

    act(() => {
      controller.setMatches(true);
    });

    await waitFor(() => {
      expect(screen.getByRole("navigation", { name: /mobile/i })).toBeInTheDocument();
      expect(onNavigate).toHaveBeenCalledWith("dashboard");
    });
  });

  it("routes keyboard shortcuts to quick add and command palette", () => {
    installMatchMedia(false);
    const { onOpenQuickAdd, onOpenCommandPalette } = renderShell();

    fireEvent.keyDown(window, { key: "n", ctrlKey: true });
    expect(onOpenQuickAdd).toHaveBeenCalledTimes(1);
    expect(onOpenCommandPalette).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1);
  });

  it("renders MonthPicker on dashboard and handles month changes", () => {
    installMatchMedia(false);
    const { onMonthChange } = renderShell();

    const monthInput = screen.getByLabelText(/selecionar compet/i);
    expect(monthInput).toBeInTheDocument();
    expect(monthInput).toHaveAttribute("type", "month");
    expect(monthInput).toHaveValue("2026-03");

    fireEvent.change(monthInput, { target: { value: "2026-04" } });
    expect(onMonthChange).toHaveBeenCalledWith("2026-04");
  });

  it("keeps MonthPicker available when the shell receives month controls", () => {
    installMatchMedia(false);
    renderShell({ activeView: "cards" });

    const monthInput = screen.getByLabelText(/selecionar compet/i);
    expect(monthInput).toBeInTheDocument();
    expect(monthInput).toHaveValue("2026-03");
  });
});
