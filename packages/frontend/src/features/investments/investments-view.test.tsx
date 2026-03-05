import { render, screen } from "@testing-library/react";

import type { AccountSummary } from "../../lib/api";
import { InvestmentsView } from "./investments-view";

function buildAccount(overrides: Partial<AccountSummary> = {}): AccountSummary {
  return {
    account_id: "acc-1",
    name: "Conta principal",
    type: "checking",
    initial_balance: 100_000,
    is_active: true,
    current_balance: 132_500,
    ...overrides,
  };
}

describe("InvestmentsView", () => {
  it("renders wealth evolution and contribution/dividend controls", () => {
    render(
      <InvestmentsView
        accounts={[buildAccount()]}
        loading={false}
        isSubmitting={false}
        movements={[]}
        overview={{
          view: "monthly",
          from: "2026-03-01T00:00:00Z",
          to: "2026-03-31T23:59:59Z",
          totals: {
            contribution_total: 30_00,
            dividend_total: 5_00,
            withdrawal_total: 18_00,
            invested_balance: 15_00,
            cash_balance: 68_00,
            wealth: 83_00,
            dividends_accumulated: 5_00,
          },
          goal: {
            target: 0,
            realized: 35_00,
            remaining: 0,
            progress_percent: 100,
          },
          series: {
            wealth_evolution: [
              {
                bucket: "2026-03",
                cash_balance: 68_00,
                invested_balance: 15_00,
                wealth: 83_00,
              },
            ],
            contribution_dividend_trend: [
              {
                bucket: "2026-03",
                contribution_total: 30_00,
                dividend_total: 5_00,
                withdrawal_total: 18_00,
              },
            ],
          },
        }}
        onCreateMovement={async () => {}}
        onRangeChange={() => {}}
        onViewChange={() => {}}
        view="monthly"
        fromDate="2026-03-01"
        toDate="2026-03-31"
      />,
    );

    expect(screen.getByRole("heading", { name: /evolu..o do patrim.nio/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /aporte/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /dividendos/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /registrar aporte/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /registrar resgate/i })).toBeInTheDocument();
  });
});
