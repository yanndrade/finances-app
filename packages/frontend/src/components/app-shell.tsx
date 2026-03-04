import { type ReactNode, useEffect } from "react";
import { Plus } from "lucide-react";

import { Sidebar, type AppView } from "./sidebar";
import { Button } from "./ui/button";

type AppShellProps = {
  activeView: AppView;
  title: string;
  description: string;
  actions?: ReactNode;
  onNavigate: (view: AppView) => void;
  onOpenQuickAdd?: () => void;
  children: ReactNode;
};

export function AppShell({
  activeView,
  title,
  description,
  actions,
  onNavigate,
  onOpenQuickAdd,
  children,
}: AppShellProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && (event.key === "k" || event.key === "n")) {
        event.preventDefault();
        onOpenQuickAdd?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenQuickAdd]);

  return (
    <div className="app-layout">
      <Sidebar activeView={activeView} onNavigate={onNavigate} />
      <main className="app-main">
        <header className="page-header">
          <div>
            <p className="eyebrow">{"Vers\u00E3o 0.6"}</p>
            <h1 className="page-title">{title}</h1>
            <p className="page-copy">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {actions && <div className="page-actions">{actions}</div>}
            {onOpenQuickAdd && (
              <Button
                onClick={onOpenQuickAdd}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-black tracking-[-0.01em] shadow-md px-5 py-6 rounded-2xl"
              >
                <Plus className="mr-2 h-5 w-5" />
                {"+ Lan\u00E7ar"}
                <kbd className="ml-3 hidden sm:inline-flex h-5 items-center gap-1 rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 font-mono text-[10px] font-medium opacity-100">
                  <span>Ctrl</span>
                  <span>N</span>
                </kbd>
              </Button>
            )}
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
