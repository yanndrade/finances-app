import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

function renderInvestmentsView(options?: {
  accounts?: AccountSummary[];
  onOpenLedgerFiltered?: ReturnType<typeof vi.fn>;
  onOpenQuickAdd?: ReturnType<typeof vi.fn>;
}) {
  const onOpenLedgerFiltered = options?.onOpenLedgerFiltered ?? vi.fn();
  const onOpenQuickAdd = options?.onOpenQuickAdd ?? vi.fn();

  render(
    <InvestmentsView
      accounts={options?.accounts ?? [buildAccount()]}
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
      onOpenLedgerFiltered={onOpenLedgerFiltered}
      onOpenQuickAdd={onOpenQuickAdd}
      onRangeChange={() => {}}
      onViewChange={() => {}}
      view="monthly"
      fromDate="2026-03-01"
      toDate="2026-03-31"
      uiDensity="compact"
    />,
  );

  return { onOpenLedgerFiltered, onOpenQuickAdd };
}

describe("InvestmentsView", () => {
  it("uses internal tabs to separate panel, charts and movements", async () => {
    const user = userEvent.setup();

    renderInvestmentsView();

    expect(screen.getByRole("tab", { name: /painel/i })).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("heading", { name: /composi/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /evolu.*patrim/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /evolu/i }));

    expect(screen.getByRole("heading", { name: /evolu.*patrim/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /aporte/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /dividendos/i })).toBeInTheDocument();
  });

  it("opens contribution quick add from the movements tab", async () => {
    const user = userEvent.setup();
    const onOpenQuickAdd = vi.fn();

    renderInvestmentsView({ onOpenQuickAdd });

    await user.click(screen.getByRole("tab", { name: /movimentos/i }));
    await user.click(screen.getByRole("button", { name: /novo aporte/i }));

    expect(onOpenQuickAdd).toHaveBeenCalledWith("investment_contribution");
  });

  it("opens the filtered ledger shortcut from the movements tab", async () => {
    const user = userEvent.setup();
    const onOpenLedgerFiltered = vi.fn();

    renderInvestmentsView({ onOpenLedgerFiltered });

    await user.click(screen.getByRole("tab", { name: /movimentos/i }));
    await user.click(screen.getByRole("button", { name: /ver movimentos no hist/i }));

    expect(onOpenLedgerFiltered).toHaveBeenCalledWith(
      expect.objectContaining({
        period: "custom",
        from: "2026-03-01",
        to: "2026-03-31",
        type: "investment",
      }),
      "2026-03",
    );
  });

  it("disables movement actions when no cash account is available", async () => {
    const user = userEvent.setup();

    renderInvestmentsView({
      accounts: [
        buildAccount({
          account_id: "acc-invest",
          name: "Conta investimento",
          type: "investment",
        }),
      ],
    });

    await user.click(screen.getByRole("tab", { name: /movimentos/i }));

    expect(screen.getByRole("button", { name: /novo aporte/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /novo resgate/i })).toBeDisabled();
    expect(
      screen.getByText(/cadastre uma conta de caixa para registrar aportes e resgates/i),
    ).toBeInTheDocument();
  });
});
