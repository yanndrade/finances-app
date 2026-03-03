import type { ReactNode } from "react";

import { Sidebar, type AppView } from "./sidebar";

type AppShellProps = {
  activeView: AppView;
  title: string;
  description: string;
  actions?: ReactNode;
  onNavigate: (view: AppView) => void;
  children: ReactNode;
};

export function AppShell({
  activeView,
  title,
  description,
  actions,
  onNavigate,
  children,
}: AppShellProps) {
  return (
    <div className="app-layout">
      <Sidebar activeView={activeView} onNavigate={onNavigate} />
      <main className="app-main">
        <header className="page-header">
          <div>
            <p className="eyebrow">Release 0.6</p>
            <h1 className="page-title">{title}</h1>
            <p className="page-copy">{description}</p>
          </div>
          {actions ? <div className="page-actions">{actions}</div> : null}
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
