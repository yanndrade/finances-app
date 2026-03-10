import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  AccountSummary,
  CardSummary,
  DashboardSummary,
  InvoiceSummary,
} from "../../lib/api";
import { DashboardBento } from "./dashboard-bento";

const accounts: AccountSummary[] = [
  {
    account_id: "acc-1",
    name: "Conta principal",
    type: "checking",
    initial_balance: 100_000,
    is_active: true,
    current_balance: 132_500,
  },
];

const cards: CardSummary[] = [
  {
    card_id: "card-1",
    name: "Nubank",
    limit: 150_000,
    closing_day: 10,
    due_day: 20,
    payment_account_id: "acc-1",
    is_active: true,
    future_installment_total: 0,
  },
];

const invoices: InvoiceSummary[] = [
  {
    invoice_id: "card-1:2026-03",
    card_id: "card-1",
    reference_month: "2026-03",
    closing_date: "2026-03-10",
    due_date: "2026-03-20",
    total_amount: 100_00,
    paid_amount: 0,
    remaining_amount: 100_00,
    purchase_count: 2,
    status: "open",
  },
];

const dashboard: DashboardSummary = {
  month: "2026-03",
  total_income: 250_000,
  total_expense: 117_500,
  net_flow: 132_500,
  current_balance: 132_500,
  fixed_expenses_total: 35_000,
  installment_total: 12_500,
  variable_expenses_total: 70_000,
  invoices_due_total: 10_000,
  free_to_spend: 97_500,
  pending_reimbursements_total: 4_000,
  pending_reimbursements: [
    {
      transaction_id: "reimb-1",
      person_id: "Ana",
      amount: 4_000,
      status: "pending",
      account_id: "acc-1",
      occurred_at: "2026-02-20T12:00:00Z",
      received_at: null,
      receipt_transaction_id: null,
    },
  ],
  monthly_commitments: [
    {
      commitment_id: "pending-1",
      kind: "recurring",
      title: "Aluguel",
      category_id: "housing",
      amount: 20_000,
      due_date: "2026-03-08",
      status: "pending",
      account_id: "acc-1",
      card_id: null,
      payment_method: "PIX",
      source: "recorrente",
    },
    {
      commitment_id: "card-1:2026-03",
      kind: "invoice",
      title: "card-1",
      category_id: null,
      amount: 10_000,
      due_date: "2026-03-20",
      status: "open",
      account_id: null,
      card_id: "card-1",
      payment_method: "INVOICE",
      source: "fatura",
    },
  ],
  monthly_fixed_expenses: [
    {
      pending_id: "pending-1",
      rule_id: "rule-1",
      title: "Aluguel",
      category_id: "housing",
      amount: 20_000,
      due_date: "2026-03-08",
      status: "pending",
      account_id: "acc-1",
      payment_method: "PIX",
      transaction_id: null,
    },
  ],
  monthly_installments: [
    {
      installment_id: "purchase-1:1",
      purchase_id: "purchase-1",
      title: "Notebook",
      category_id: "electronics",
      amount: 12_500,
      card_id: "card-1",
      installment_number: 1,
      installments_count: 3,
      due_date: "2026-03-18",
      reference_month: "2026-03",
    },
  ],
  recent_transactions: [
    {
      transaction_id: "tx-1",
      occurred_at: "2026-03-03T12:00:00Z",
      type: "expense",
      amount: 2_500,
      account_id: "acc-1",
      payment_method: "CASH",
      category_id: "food",
      description: "Supermercado",
      person_id: null,
      status: "active",
    },
  ],
  spending_by_category: [
    { category_id: "food", total: 8_500 },
    { category_id: "housing", total: 20_000 },
  ],
  category_budgets: [],
  budget_alerts: [],
  previous_month: {
    total_income: 200_000,
    total_expense: 100_000,
    net_flow: 100_000,
  },
  daily_balance_series: [
    { date: "2026-03-01", balance: 250_000 },
    { date: "2026-03-03", balance: 132_500 },
  ],
  review_queue: [
    {
      transaction_id: "tx-review",
      occurred_at: "2026-03-02T12:00:00Z",
      type: "expense",
      amount: 1_000,
      account_id: "acc-1",
      payment_method: "PIX",
      category_id: "other",
      description: "Compra sem categoria",
      person_id: null,
      status: "active",
    },
  ],
};

describe("DashboardBento", () => {
  it("renders the main sections of the overview page", () => {
    render(
      <DashboardBento
        dashboard={dashboard}
        investmentOverview={null}
        cards={cards}
        onNavigate={vi.fn()}
        onOpenLedgerFiltered={vi.fn()}
        onOpenQuickAdd={vi.fn()}
        uiDensity="compact"
      />,
    );

    // Hero metrics
    expect(screen.getByText(/entradas/i)).toBeInTheDocument();
    expect(screen.getByText(/gasto do mês/i)).toBeInTheDocument();
    expect(screen.getByText(/resultado/i)).toBeInTheDocument();

    // Metric strip
    expect(screen.getAllByText(/gastos fixos/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/parceladas/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/variáveis/i).length).toBeGreaterThan(0);

    // Features
    expect(screen.getByText(/raio-x de despesas/i)).toBeInTheDocument();
    expect(screen.getByText(/próximos compromissos/i)).toBeInTheDocument();

    // Check for some data
    expect(screen.getByText(/nubank/i)).toBeInTheDocument();
    expect(screen.getByText(/aluguel/i)).toBeInTheDocument();
  });

  it("handles navigation interactions correctly", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onOpenLedgerFiltered = vi.fn();

    render(
      <DashboardBento
        dashboard={dashboard}
        investmentOverview={null}
        cards={cards}
        onNavigate={onNavigate}
        onOpenLedgerFiltered={onOpenLedgerFiltered}
        onOpenQuickAdd={vi.fn()}
        uiDensity="compact"
      />,
    );

    // Click Gastos Fixos in MetricStrip
    const fixedExpensesBtn = screen.getByRole("button", {
      name: /gastos fixos/i,
    });
    await user.click(fixedExpensesBtn);
    expect(onNavigate).toHaveBeenCalledWith("fixedExpenses");

    // Click category in ExpenseXray
    const foodCategoryBtn = screen.getByRole("button", {
      name: /alimentacao/i,
    });
    await user.click(foodCategoryBtn);
    expect(onOpenLedgerFiltered).toHaveBeenCalledWith(
      expect.objectContaining({
        period: "month",
        category: "food",
        type: "expense",
      }),
      "2026-03",
    );
  });
});
