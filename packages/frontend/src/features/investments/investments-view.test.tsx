import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { AccountSummary, InvestmentMovementSummary } from "../../lib/api";
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
  movements?: InvestmentMovementSummary[];
  onOpenLedgerFiltered?: ReturnType<typeof vi.fn>;
  onOpenQuickAdd?: ReturnType<typeof vi.fn>;
}) {
  const onOpenLedgerFiltered = options?.onOpenLedgerFiltered ?? vi.fn();
  const onOpenQuickAdd = options?.onOpenQuickAdd ?? vi.fn();
  const onUpdateMovement = vi.fn();
  const onRefreshData = vi.fn();
  const onError = vi.fn();

  render(
    <InvestmentsView
      accounts={options?.accounts ?? [buildAccount()]}
      loading={false}
      isSubmitting={false}
      movements={options?.movements ?? []}
      current={{
        snapshot: {
          id: "snap-1",
          date: "2026-03-31T23:59:59Z",
          period: "2026-03",
          total_patrimony: 83_00,
          applied_value: 15_00,
          gross_balance: 15_00,
          free_cash: 68_00,
          accumulated_dividends: 5_00,
          monthly_contribution_target: 0,
          fii_applied_value: 0,
          fii_monthly_income: 0,
          stock_applied_value: 0,
          stock_monthly_income: 0,
          total_monthly_income: 0,
          reinvested_income: 0,
          notes: null,
        },
        assets: [],
        allocation_targets: [],
        income_records: [],
      }}
      history={{
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
      onUpdateMovement={onUpdateMovement}
      onRefreshData={onRefreshData}
      onError={onError}
      uiDensity="compact"
    />,
  );

  return { onOpenLedgerFiltered, onOpenQuickAdd, onUpdateMovement, onRefreshData, onError };
}

describe("InvestmentsView", () => {
  it("renders four tabs without calculators or evolution labels", () => {
    renderInvestmentsView();

    expect(screen.getByRole("tab", { name: /painel/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /carteira/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /proventos/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /movimentos/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /calculadoras/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /evolu/i })).not.toBeInTheDocument();
  });

  it("does not show manual/calculated/movement badges on summary cards", () => {
    renderInvestmentsView();

    expect(screen.queryByText(/^Manual$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Calculado$/)).not.toBeInTheDocument();
  });

  it("opens contribution quick add from the movements tab", async () => {
    const user = userEvent.setup();
    const onOpenQuickAdd = vi.fn();

    renderInvestmentsView({ onOpenQuickAdd });

    await user.click(screen.getByRole("tab", { name: /movimentos/i }));
    await user.click(screen.getByRole("button", { name: /novo aporte/i }));

    expect(onOpenQuickAdd).toHaveBeenCalledWith("investment_contribution");
  });

  it("does not expose reinvest button in movements header", async () => {
    const user = userEvent.setup();
    renderInvestmentsView();

    await user.click(screen.getByRole("tab", { name: /movimentos/i }));

    expect(screen.queryByRole("button", { name: /reinvestir/i })).not.toBeInTheDocument();
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

  it("edits an investment movement account", async () => {
    const user = userEvent.setup();
    const { onUpdateMovement } = renderInvestmentsView({
      accounts: [
        buildAccount(),
        buildAccount({
          account_id: "acc-2",
          name: "Conta correta",
        }),
      ],
      movements: [
        {
          movement_id: "inv-1",
          occurred_at: "2026-03-10T12:00:00Z",
          type: "contribution",
          account_id: "acc-1",
          description: "Aporte mensal",
          contribution_amount: 30_00,
          dividend_amount: 0,
          reinvested_dividend_amount: 0,
          cash_amount: 30_00,
          invested_amount: 30_00,
          cash_delta: -30_00,
          invested_delta: 30_00,
        },
      ],
    });

    await user.click(screen.getByRole("tab", { name: /movimentos/i }));
    await user.click(screen.getByRole("button", { name: /^editar$/i }));
    await user.selectOptions(screen.getByLabelText(/conta/i), "acc-2");
    await user.clear(screen.getByLabelText(/descrição/i));
    await user.type(screen.getByLabelText(/descrição/i), "Aporte corrigido");
    await user.click(screen.getByRole("button", { name: /salvar alterações/i }));

    expect(onUpdateMovement).toHaveBeenCalledWith("inv-1", {
      accountId: "acc-2",
      description: "Aporte corrigido",
    });
  });
});
