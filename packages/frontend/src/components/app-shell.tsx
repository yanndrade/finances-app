import type { ReactNode } from "react";

import { Sidebar } from "./sidebar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">{children}</main>
    </div>
  );
}
