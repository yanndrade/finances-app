import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, render, screen } from "@testing-library/react";

import { App } from "./App";

function installStartupFetchMock() {
  const fetchMock = vi.fn<(typeof fetch)>().mockImplementation((input) => {
    const url = String(input);

    if (url.includes("/api/dashboard")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            month: "2026-03",
            total_income: 0,
            total_expense: 0,
            net_flow: 0,
            current_balance: 0,
            recent_transactions: [],
            spending_by_category: [],
            previous_month: {
              total_income: 0,
              total_expense: 0,
              net_flow: 0,
            },
            daily_balance_series: [],
            review_queue: [],
          }),
        ),
      );
    }

    if (
      url.includes("/api/accounts") ||
      url.includes("/api/cards") ||
      url.includes("/api/invoices") ||
      url.includes("/api/transactions")
    ) {
      return Promise.resolve(new Response(JSON.stringify([])));
    }

    throw new Error(`Unexpected request: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
}

describe("App startup performance", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defers heavy views behind lazy boundaries and still renders the shell immediately", async () => {
    installStartupFetchMock();

    const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
    const tailwindConfigSource = readFileSync(join(process.cwd(), "tailwind.config.js"), "utf8");

    expect(appSource).toContain('const DashboardView = lazy(async () => {');
    expect(appSource).toContain('const CardsView = lazy(async () => {');
    expect(appSource).toContain('const QuickAddComposer = lazy(async () => {');
    expect(appSource).not.toContain(
      'import { DashboardView } from "./features/dashboard/dashboard-view";',
    );
    expect(appSource).not.toContain('import { CardsView } from "./features/cards/cards-view";');
    expect(appSource).not.toContain(
      'import { QuickAddComposer } from "./components/quick-add-composer";',
    );
    expect(tailwindConfigSource).toContain('"!./src/**/node_modules/**"');
    expect(tailwindConfigSource).toContain('"!./src/my-app/**"');

    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText("Versão 0.6")).toBeInTheDocument();
  });
});
