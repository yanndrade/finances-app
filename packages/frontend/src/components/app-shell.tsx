import { type ReactNode, useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { MOBILE_NAV_ITEMS, Sidebar, isMobileEssentialView, type AppView } from "./sidebar";
import { Button } from "./ui/button";
import { MonthPicker } from "./ui/month-picker";
import { cn } from "../lib/utils";
import type { UiDensity } from "../lib/ui-density";

type AppShellProps = {
  activeView: AppView;
  title: string;
  description: string;
  actions?: ReactNode;
  contextPanel?: ReactNode;
  onNavigate: (view: AppView) => void;
  onOpenQuickAdd?: () => void;
  onOpenCommandPalette?: () => void;
  children: ReactNode;
  uiDensity: UiDensity;
  month?: string;
  onMonthChange?: (month: string) => void;
};

const MOBILE_QUERY = "(max-width: 900px)";

export function AppShell({
  activeView,
  title,
  description,
  actions,
  contextPanel,
  onNavigate,
  onOpenQuickAdd,
  onOpenCommandPalette,
  children,
  uiDensity,
  month,
  onMonthChange,
}: AppShellProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isShortcut = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (!isShortcut) {
        return;
      }

      if (key === "n") {
        event.preventDefault();
        onOpenQuickAdd?.();
        return;
      }

      if (key === "k") {
        event.preventDefault();
        (onOpenCommandPalette ?? onOpenQuickAdd)?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenCommandPalette, onOpenQuickAdd]);

  useEffect(() => {
    if (!isMobile || isMobileEssentialView(activeView)) {
      return;
    }

    onNavigate("dashboard");
  }, [activeView, isMobile, onNavigate]);

  if (isMobile) {
    return (
      <div className={`app-layout app-layout--mobile ui-density--${uiDensity}`}>
        <main className="app-main app-main--mobile">
          <header className="page-header page-header--mobile">
            <div>
              <p className="eyebrow">Versão 0.6</p>
              <h1 className="page-title">{title}</h1>
              <p className="page-copy">{description}</p>
            </div>
          </header>
          <div className="page-content">{children}</div>
        </main>

        {onOpenQuickAdd ? (
          <Button
            aria-label="Adicionar gasto"
            className="mobile-fab"
            onClick={onOpenQuickAdd}
            size="icon"
            type="button"
          >
            <Plus className="h-6 w-6" />
          </Button>
        ) : null}

        <nav aria-label="Navegacao mobile" className="mobile-nav">
          {MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                aria-current={isActive ? "page" : undefined}
                className={`mobile-nav__item${isActive ? " is-active" : ""}`}
                onClick={() => onNavigate(item.id)}
                type="button"
              >
                <Icon aria-hidden="true" className="mobile-nav__icon" />
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div className={`app-layout app-layout--desktop ui-density--${uiDensity}`}>
      <Sidebar activeView={activeView} onNavigate={onNavigate} />

      <div className="app-workspace">
        <main className="app-main">
          <header className="page-header">
            <div className="page-header__intro">
              <p className="eyebrow">Versão 0.6</p>
              <h1 className="page-title">{title}</h1>
              <p className="page-copy">{description}</p>
            </div>
            <div className="page-header__controls flex flex-wrap items-center gap-2 lg:gap-3">
              {actions ? <div className="page-actions">{actions}</div> : null}
              {month && onMonthChange && activeView === "dashboard" ? (
                <div className="flex-shrink-0">
                  <MonthPicker
                    month={month}
                    onMonthChange={onMonthChange}
                    uiDensity={uiDensity}
                  />
                </div>
              ) : null}
              {onOpenQuickAdd ? (
                <Button
                  onClick={onOpenQuickAdd}
                  className={cn(
                    "bg-primary text-primary-foreground hover:bg-primary/90 font-black tracking-[-0.01em] shadow-md rounded-2xl whitespace-nowrap flex-shrink-0",
                    uiDensity === "dense"
                      ? "px-3 py-4 text-sm"
                      : uiDensity === "compact"
                        ? "px-4 py-4 text-sm"
                        : "px-4 py-5 text-base",
                  )}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Lançar
                  <kbd className="ml-2 hidden sm:inline-flex h-4 items-center gap-0.5 rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1 font-mono text-[9px] font-medium opacity-100">
                    <span>Ctrl</span>
                    <span>N</span>
                  </kbd>
                </Button>
              ) : null}
            </div>
          </header>

          <div className={`page-body${contextPanel ? " page-body--with-context" : ""}`}>
            <section className="page-content-shell">
              <div className="page-content">{children}</div>
            </section>
            {contextPanel ? (
              <aside aria-label="Painel contextual" className="context-panel">
                {contextPanel}
              </aside>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mediaQuery.matches);

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}
