import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
    status: "open",
  },
];

function renderCardsView(
  overrides: Partial<ComponentProps<typeof CardsView>> = {},
) {
  const onCreateCard = overrides.onCreateCard ?? vi.fn(() => Promise.resolve());
  const onCreateCardPurchase =
    overrides.onCreateCardPurchase ?? vi.fn(() => Promise.resolve());
  const onOpenLedgerFiltered = overrides.onOpenLedgerFiltered ?? vi.fn();
  const onOpenQuickAdd = overrides.onOpenQuickAdd ?? vi.fn();
  const onSetCardActive = overrides.onSetCardActive ?? vi.fn(() => Promise.resolve());
  const onUpdateCard = overrides.onUpdateCard ?? vi.fn(() => Promise.resolve());

  render(
    <CardsView
      accounts={overrides.accounts ?? defaultAccounts}
      cards={overrides.cards ?? defaultCards}
      invoices={overrides.invoices ?? defaultInvoices}
      isSubmitting={overrides.isSubmitting ?? false}
      onCreateCard={onCreateCard}
      onCreateCardPurchase={onCreateCardPurchase}
      onOpenLedgerFiltered={onOpenLedgerFiltered}
      onOpenQuickAdd={onOpenQuickAdd}
      onSetCardActive={onSetCardActive}
      onUpdateCard={onUpdateCard}
      uiDensity={overrides.uiDensity ?? "compact"}
    />,
  );

  return {
    onCreateCard,
    onOpenQuickAdd,
    onSetCardActive,
    onUpdateCard,
  };
}

describe("CardsView", () => {
  beforeEach(() => {
    installDialogEnvironment();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens invoice payment quick add with the selected invoice id", async () => {
    const user = userEvent.setup();
    const { onOpenQuickAdd } = renderCardsView();

    await user.selectOptions(screen.getByLabelText(/escopo dos cartoes/i), "card-1");
    await user.click(screen.getByRole("button", { name: /pagar agora/i }));

    expect(onOpenQuickAdd).toHaveBeenCalledWith("transfer_invoice_payment", {
      invoiceId: "card-1:2026-03",
    });
  });

  it("keeps card creation reachable from the settings tab", async () => {
    const user = userEvent.setup();
    const { onCreateCard } = renderCardsView();

    await user.click(screen.getByRole("tab", { name: /ajustes/i }));
    await user.click(screen.getAllByRole("button", { name: /^novo cartao$/i })[1]);
    expect((screen.getByLabelText(/limite total/i) as HTMLInputElement).value).toMatch(/R\$\s*0,00/);
    expect(screen.getByText(/opcional\./i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/nome do cartao/i), "Cartao Verde");
    await user.clear(screen.getByLabelText(/limite total/i));
    await user.type(screen.getByLabelText(/limite total/i), "250000");
    await user.clear(screen.getByLabelText(/dia de fechamento/i));
    await user.type(screen.getByLabelText(/dia de fechamento/i), "15");
    await user.clear(screen.getByLabelText(/dia de vencimento/i));
    await user.type(screen.getByLabelText(/dia de vencimento/i), "25");
    await user.click(screen.getByRole("button", { name: /criar cartao/i }));

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

  it("keeps card editing reachable from the settings tab", async () => {
    const user = userEvent.setup();
    const onUpdateCard = vi.fn(() => Promise.resolve());

    renderCardsView({ onUpdateCard });

    await user.click(screen.getByRole("tab", { name: /ajustes/i }));
    await user.click(screen.getByRole("button", { name: /editar$/i }));
    await user.clear(screen.getByLabelText(/limite total/i));
    await user.type(screen.getByLabelText(/limite total/i), "150000");
    await user.click(screen.getByRole("button", { name: /salvar cartao/i }));

    await waitFor(() => {
      expect(onUpdateCard).toHaveBeenCalledWith("card-1", {
        name: "Cartao Azul",
        limitInCents: 150000,
        closingDay: 10,
        dueDay: 20,
        paymentAccountId: "acc-1",
        isActive: true,
      });
    });
  });

  it("lets the user remove a card from active operation in the settings tab", async () => {
    const user = userEvent.setup();
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);
    const { onSetCardActive } = renderCardsView();

    await user.click(screen.getByRole("tab", { name: /ajustes/i }));
    await user.click(screen.getByRole("button", { name: /excluir cartao/i }));

    expect(confirmMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(onSetCardActive).toHaveBeenCalledWith(defaultCards[0], false);
    });
  });

  it("shows invoice item loading errors instead of silently hiding them", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "fetchInvoiceItems").mockRejectedValue(new Error("network"));

    renderCardsView();

    await user.selectOptions(screen.getByLabelText(/escopo dos cartoes/i), "card-1");
    await user.click(screen.getByRole("button", { name: /ver itens/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/nao foi possivel carregar os itens da fatura/i),
      ).toBeInTheDocument();
    });
  });
});
