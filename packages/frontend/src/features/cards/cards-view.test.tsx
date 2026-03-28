import type { ComponentProps } from "react";
import { act } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as api from "../../lib/api";
import { CardsView } from "./cards-view";

function installDialogEnvironment() {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })),
  );
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: vi.fn(() => false),
  });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
}

const defaultAccounts: api.AccountSummary[] = [
  {
    account_id: "acc-1",
    name: "Conta principal",
    type: "checking",
    initial_balance: 0,
    is_active: true,
    current_balance: 0,
  },
];

const defaultCards: api.CardSummary[] = [
  {
    card_id: "card-1",
    name: "Cartao Azul",
    limit: 100_000,
    closing_day: 10,
    due_day: 20,
    payment_account_id: "acc-1",
    is_active: true,
    future_installment_total: 0,
  },
];

const defaultInvoices: api.InvoiceSummary[] = [
  {
    invoice_id: "card-1:2026-03",
    card_id: "card-1",
    reference_month: "2026-03",
    closing_date: "2026-03-10",
    due_date: "2026-03-20",
    total_amount: 90_00,
    paid_amount: 20_00,
    remaining_amount: 70_00,
    purchase_count: 3,
    status: "partial",
  },
];

function renderCardsView(overrides: Partial<ComponentProps<typeof CardsView>> = {}) {
  const onCreateCard = overrides.onCreateCard ?? vi.fn(() => Promise.resolve());
  const onOpenLedgerFiltered = overrides.onOpenLedgerFiltered ?? vi.fn();
  const onOpenQuickAdd = overrides.onOpenQuickAdd ?? vi.fn();
  const onOpenSettings = overrides.onOpenSettings ?? vi.fn();
  const onSetCardActive = overrides.onSetCardActive ?? vi.fn(() => Promise.resolve());
  const onUpdateCard = overrides.onUpdateCard ?? vi.fn(() => Promise.resolve());

  render(
    <CardsView
      surface={overrides.surface ?? "desktop"}
      accounts={overrides.accounts ?? defaultAccounts}
      cards={overrides.cards ?? defaultCards}
      invoices={overrides.invoices ?? defaultInvoices}
      selectedMonth={overrides.selectedMonth ?? "2026-03"}
      isSubmitting={overrides.isSubmitting ?? false}
      onCreateCard={onCreateCard}
      onOpenLedgerFiltered={onOpenLedgerFiltered}
      onOpenQuickAdd={onOpenQuickAdd}
      onOpenSettings={onOpenSettings}
      onSetCardActive={onSetCardActive}
      onUpdateCard={onUpdateCard}
      uiDensity={overrides.uiDensity ?? "compact"}
    />,
  );

  return {
    onCreateCard,
    onOpenLedgerFiltered,
    onOpenQuickAdd,
    onSetCardActive,
    onUpdateCard,
  };
}

describe("CardsView", () => {
  beforeEach(() => {
    installDialogEnvironment();
    vi.spyOn(api, "fetchCardInstallments").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows month summary in aggregate view", () => {
    renderCardsView();
    expect(screen.getByText(/total do m/i)).toBeInTheDocument();
    expect(screen.getByText(/a pagar/i)).toBeInTheDocument();
  });

  it("shows remaining amount as invoice total when the invoice is partial", async () => {
    const user = userEvent.setup();
    renderCardsView({
      invoices: [
        ...defaultInvoices,
        {
          ...defaultInvoices[0],
          invoice_id: "card-1:2026-02",
          reference_month: "2026-02",
          closing_date: "2026-02-10",
          due_date: "2026-02-20",
        },
      ],
    });

    expect(screen.getByText(/a pagar/i).parentElement).toHaveTextContent("R$ 70,00");
    expect(screen.getAllByText("R$ 70,00").length).toBeGreaterThanOrEqual(2);

    await user.click(screen.getByRole("button", { name: /detalhes/i }));

    expect(screen.getByText(/pago/i).closest("div")).toHaveTextContent("R$ 20,00");
    expect(screen.getByText(/em aberto/i).closest("div")).toHaveTextContent("R$ 70,00");
    expect(screen.getAllByText("R$ 70,00").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("R$ 90,00")).not.toBeInTheDocument();
  });

  it("shows Fechada for open invoices after the closing date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 25, 12, 0, 0));

    renderCardsView({
      invoices: [
        {
          ...defaultInvoices[0],
          paid_amount: 0,
          remaining_amount: 90_00,
          status: "open",
          closing_date: "2026-03-24",
        },
        {
          ...defaultInvoices[0],
          invoice_id: "card-1:2026-02",
          reference_month: "2026-02",
          closing_date: "2026-02-10",
          due_date: "2026-02-20",
          paid_amount: 0,
          remaining_amount: 60_00,
          total_amount: 60_00,
          purchase_count: 2,
          status: "open",
        },
      ],
    });

    expect(screen.getByText("Fechada")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /detalhes/i }));
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(screen.getAllByText("Fechada").length).toBeGreaterThanOrEqual(2);
  });

  it("keeps Aberta for open invoices on the closing date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 24, 12, 0, 0));

    renderCardsView({
      cards: [
        {
          ...defaultCards[0],
          closing_day: 24,
        },
      ],
      invoices: [
        {
          ...defaultInvoices[0],
          paid_amount: 0,
          remaining_amount: 90_00,
          status: "open",
          closing_date: "2026-03-24",
        },
      ],
    });

    expect(screen.getByText("Aberta")).toBeInTheDocument();
    expect(screen.queryByText("Fechada")).not.toBeInTheDocument();
  });

  it("keeps Aberta for open invoices before the closing date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 25, 12, 0, 0));

    renderCardsView({
      cards: [
        {
          ...defaultCards[0],
          closing_day: 26,
        },
      ],
      invoices: [
        {
          ...defaultInvoices[0],
          paid_amount: 0,
          remaining_amount: 90_00,
          status: "open",
          closing_date: "2026-03-26",
        },
      ],
    });

    expect(screen.getByText("Aberta")).toBeInTheDocument();
    expect(screen.queryByText("Fechada")).not.toBeInTheDocument();
  });

  it("uses the current card cycle after changing the closing day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 28, 12, 0, 0));

    renderCardsView({
      cards: [
        {
          ...defaultCards[0],
          closing_day: 28,
        },
      ],
      invoices: [
        {
          ...defaultInvoices[0],
          status: "open",
          paid_amount: 0,
          remaining_amount: 90_00,
          total_amount: 90_00,
          closing_date: "2026-03-27",
          due_date: "2026-03-20",
        },
      ],
    });

    expect(screen.getByText("Aberta")).toBeInTheDocument();
    expect(screen.queryByText("Fechada")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /detalhes/i }));
    });

    expect(screen.getByText("2026-03-28")).toBeInTheDocument();
    expect(screen.getByText("2026-04-20")).toBeInTheDocument();
  });

  it("keeps Parcial after the closing date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 25, 12, 0, 0));

    renderCardsView({
      invoices: [
        {
          ...defaultInvoices[0],
          status: "partial",
          closing_date: "2026-03-24",
        },
      ],
    });

    expect(screen.getByText("Parcial")).toBeInTheDocument();
    expect(screen.queryByText("Fechada")).not.toBeInTheDocument();
  });

  it("keeps Paga after the closing date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 25, 12, 0, 0));

    renderCardsView({
      invoices: [
        {
          ...defaultInvoices[0],
          paid_amount: 90_00,
          remaining_amount: 0,
          status: "paid",
          closing_date: "2026-03-24",
        },
      ],
    });

    expect(screen.getByText("Paga")).toBeInTheDocument();
    expect(screen.queryByText("Fechada")).not.toBeInTheDocument();
  });

  it("opens card detail and allows invoice payment quick add", async () => {
    const user = userEvent.setup();
    const { onOpenQuickAdd } = renderCardsView();

    await user.click(screen.getByRole("button", { name: /detalhes/i }));
    await user.click(screen.getByRole("button", { name: /pagar fatura/i }));

    expect(onOpenQuickAdd).toHaveBeenCalledWith("transfer_invoice_payment", {
      invoiceId: "card-1:2026-03",
    });
  });

  it("opens management drawer on desktop", async () => {
    const user = userEvent.setup();
    renderCardsView();

    await user.click(screen.getByTitle(/gerenciar cart/i));
    expect(screen.getAllByText(/gerenciar cart/i).length).toBeGreaterThanOrEqual(1);
  });

  it("creates a card from management drawer on desktop", async () => {
    const user = userEvent.setup();
    const { onCreateCard } = renderCardsView();

    await user.click(screen.getByTitle(/gerenciar cart/i));
    await user.click(screen.getByRole("button", { name: /^novo$/i }));
    await user.type(screen.getByLabelText(/nome do cart/i), "Cartao Verde");
    await user.clear(screen.getByLabelText(/limite total/i));
    await user.type(screen.getByLabelText(/limite total/i), "250000");
    await user.clear(screen.getByLabelText(/dia de fechamento/i));
    await user.type(screen.getByLabelText(/dia de fechamento/i), "15");
    await user.clear(screen.getByLabelText(/dia de vencimento/i));
    await user.type(screen.getByLabelText(/dia de vencimento/i), "25");
    await user.click(screen.getByRole("button", { name: /criar cart/i }));

    await waitFor(() => {
      expect(onCreateCard).toHaveBeenCalledWith({
        name: "Cartao Verde",
        limitInCents: 250000,
        closingDay: 15,
        dueDay: 25,
        paymentAccountId: undefined,
      });
    });
  });

  it("hides management controls on mobile surface and keeps payment action", async () => {
    const user = userEvent.setup();
    const { onOpenQuickAdd } = renderCardsView({ surface: "mobile" });

    expect(screen.queryByTitle(/gerenciar cart/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^novo$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /detalhes/i }));
    await user.click(screen.getByRole("button", { name: /pagar fatura/i }));

    expect(onOpenQuickAdd).toHaveBeenCalledWith("transfer_invoice_payment", {
      invoiceId: "card-1:2026-03",
    });
  });
});
