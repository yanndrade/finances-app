import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FixedExpensesView } from "./fixed-expenses-view";
import type {
  AccountSummary,
  CardSummary,
  PendingExpenseSummary,
  RecurringRuleSummary,
} from "../../lib/api";

const accounts: AccountSummary[] = [
  {
    account_id: "acc-1",
    name: "Conta principal",
    type: "checking",
    initial_balance: 10_000,
    current_balance: 10_000,
    is_active: true,
  },
];

const cards: CardSummary[] = [
  {
    card_id: "card-1",
    name: "Nubank",
    limit: 20_000,
    closing_day: 10,
    due_day: 20,
    payment_account_id: "acc-1",
    is_active: true,
    future_installment_total: 0,
  },
];

const categories = [
  { value: "internet", label: "Internet" },
  { value: "rent", label: "Moradia" },
];

const recurringRules: RecurringRuleSummary[] = [
  {
    rule_id: "rec-1",
    name: "Internet",
    amount: 120_00,
    due_day: 10,
    account_id: "acc-1",
    card_id: null,
    payment_method: "PIX",
    category_id: "internet",
    description: "Fibra",
    is_active: true,
  },
];

const pendingExpenses: PendingExpenseSummary[] = [
  {
    pending_id: "rec-1:2026-03",
    rule_id: "rec-1",
    month: "2026-03",
    name: "Internet",
    amount: 120_00,
    due_date: "2026-03-10",
    account_id: "acc-1",
    card_id: null,
    payment_method: "PIX",
    category_id: "internet",
    description: "Fibra",
    status: "pending",
    transaction_id: null,
  },
];

describe("FixedExpensesView", () => {
  it("submits a new recurring rule", async () => {
    const onCreateRule = vi.fn<(payload: object) => Promise<void>>().mockResolvedValue();

    render(
      <FixedExpensesView
        accounts={accounts}
        cards={cards}
        categories={categories}
        isSubmitting={false}
        month="2026-03"
        pendingExpenses={[]}
        recurringRules={[]}
        onConfirmPending={vi.fn().mockResolvedValue(undefined)}
        onCreateRule={onCreateRule}
        onMonthChange={vi.fn()}
        onOpenLedgerFiltered={vi.fn()}
        onUpdateRule={vi.fn().mockResolvedValue(undefined)}
        uiDensity="compact"
      />,
    );

    await userEvent.type(screen.getByPlaceholderText(/aluguel, internet/i), "Academia");
    await userEvent.type(screen.getByPlaceholderText("0,00"), "89,90");
    await userEvent.clear(screen.getByDisplayValue("1"));
    await userEvent.type(screen.getByRole("spinbutton"), "7");
    await userEvent.selectOptions(screen.getByDisplayValue("Internet"), "rent");
    await userEvent.click(screen.getByRole("button", { name: /salvar regra/i }));

    expect(onCreateRule).toHaveBeenCalledWith({
      name: "Academia",
      amountInCents: 8_990,
      dueDay: 7,
      paymentMethod: "PIX",
      accountId: "acc-1",
      cardId: undefined,
      categoryId: "rent",
      description: undefined,
    });
  }, 15_000);

  it("confirms a pending expense", async () => {
    const onConfirmPending = vi.fn<(pendingId: string) => Promise<void>>().mockResolvedValue();

    render(
      <FixedExpensesView
        accounts={accounts}
        cards={cards}
        categories={categories}
        isSubmitting={false}
        month="2026-03"
        pendingExpenses={pendingExpenses}
        recurringRules={recurringRules}
        onConfirmPending={onConfirmPending}
        onCreateRule={vi.fn().mockResolvedValue(undefined)}
        onMonthChange={vi.fn()}
        onOpenLedgerFiltered={vi.fn()}
        onUpdateRule={vi.fn().mockResolvedValue(undefined)}
        uiDensity="compact"
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: /pendencias/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    expect(onConfirmPending).toHaveBeenCalledWith("rec-1:2026-03");
  }, 15_000);

  it("allows changing the month via MonthPicker", () => {
    const onMonthChange = vi.fn();

    render(
      <FixedExpensesView
        accounts={accounts}
        cards={cards}
        categories={categories}
        isSubmitting={false}
        month="2026-03"
        pendingExpenses={[]}
        recurringRules={[]}
        onConfirmPending={vi.fn().mockResolvedValue(undefined)}
        onCreateRule={vi.fn().mockResolvedValue(undefined)}
        onMonthChange={onMonthChange}
        onOpenLedgerFiltered={vi.fn()}
        onUpdateRule={vi.fn().mockResolvedValue(undefined)}
        uiDensity="compact"
      />,
    );

    const monthInput = screen.getByDisplayValue("2026-03");
    expect(monthInput).toBeInTheDocument();
    expect(monthInput).toHaveAttribute("type", "month");

    fireEvent.change(monthInput, { target: { value: "2026-04" } });
    expect(onMonthChange).toHaveBeenCalledWith("2026-04");
  });
});
