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
  it("opens an existing recurring rule in the edit sheet and submits updates", async () => {
    const onUpdateRule = vi
      .fn<(ruleId: string, payload: object) => Promise<void>>()
      .mockResolvedValue();

    render(
      <FixedExpensesView
        accounts={accounts}
        cards={cards}
        categories={categories}
        isSubmitting={false}
        month="2026-03"
        pendingExpenses={[]}
        recurringRules={recurringRules}
        onConfirmPending={vi.fn().mockResolvedValue(undefined)}
        onCreateRule={vi.fn().mockResolvedValue(undefined)}
        onMonthChange={vi.fn()}
        onOpenLedgerFiltered={vi.fn()}
        onUndoPendingPayment={vi.fn().mockResolvedValue(undefined)}
        onUpdateRule={onUpdateRule}
        uiDensity="compact"
      />,
    );

    await userEvent.click(screen.getByText("Internet"));

    expect(await screen.findByRole("heading", { name: /editar gasto fixo/i })).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/aluguel, internet/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Academia");

    const amountInput = screen.getByPlaceholderText("0,00");
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "89,90");

    await userEvent.clear(screen.getByDisplayValue("10"));
    await userEvent.type(screen.getByRole("spinbutton"), "7");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /categoria/i }), "rent");
    await userEvent.click(screen.getByRole("button", { name: /salvar altera/i }));

    expect(onUpdateRule).toHaveBeenCalledWith("rec-1", {
      name: "Academia",
      amountInCents: 8_990,
      dueDay: 7,
      paymentMethod: "PIX",
      accountId: "acc-1",
      cardId: undefined,
      categoryId: "rent",
      description: "Fibra",
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
        onUndoPendingPayment={vi.fn().mockResolvedValue(undefined)}
        onUpdateRule={vi.fn().mockResolvedValue(undefined)}
        uiDensity="compact"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /pagar agora/i }));

    expect(onConfirmPending).toHaveBeenCalledWith("rec-1:2026-03");
  }, 15_000);

  it("surfaces empty-state summaries when there are no pending items or recurring rules", () => {
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
        onMonthChange={vi.fn()}
        onOpenLedgerFiltered={vi.fn()}
        onUndoPendingPayment={vi.fn().mockResolvedValue(undefined)}
        onUpdateRule={vi.fn().mockResolvedValue(undefined)}
        uiDensity="compact"
      />,
    );

    expect(screen.getByRole("heading", { name: /sem pend/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /sem cadastros/i })).toBeInTheDocument();
  });

  it("shows only pending flow on mobile surface and hides recurring rules management", async () => {
    const onConfirmPending = vi.fn<(pendingId: string) => Promise<void>>().mockResolvedValue();

    render(
      <FixedExpensesView
        surface="mobile"
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
        onUndoPendingPayment={vi.fn().mockResolvedValue(undefined)}
        onUpdateRule={vi.fn().mockResolvedValue(undefined)}
        uiDensity="compact"
      />,
    );

    expect(screen.queryByText(/cadastros fixos/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /editar gasto fixo/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /pagar agora/i }));
    expect(onConfirmPending).toHaveBeenCalledWith("rec-1:2026-03");
  });

  it("allows undoing a confirmed wallet payment directly from the recurring list", async () => {
    const onUndoPendingPayment = vi
      .fn<(transactionId: string) => Promise<void>>()
      .mockResolvedValue();

    render(
      <FixedExpensesView
        accounts={accounts}
        cards={cards}
        categories={categories}
        isSubmitting={false}
        month="2026-03"
        pendingExpenses={[
          {
            ...pendingExpenses[0],
            status: "confirmed",
            transaction_id: "rec-1:2026-03:expense",
          },
        ]}
        recurringRules={recurringRules}
        onConfirmPending={vi.fn().mockResolvedValue(undefined)}
        onCreateRule={vi.fn().mockResolvedValue(undefined)}
        onMonthChange={vi.fn()}
        onOpenLedgerFiltered={vi.fn()}
        onUndoPendingPayment={onUndoPendingPayment}
        onUpdateRule={vi.fn().mockResolvedValue(undefined)}
        uiDensity="compact"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /desfazer/i }));

    expect(onUndoPendingPayment).toHaveBeenCalledWith(
      "rec-1:2026-03:expense",
    );
  });
});
