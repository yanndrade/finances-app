import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QuickAddComposer } from "./quick-add-composer";

import type { AccountSummary, CardSummary } from "../lib/api";

type MatchMediaController = {
  setMatches: (matches: boolean) => void;
};

const ACCOUNTS: AccountSummary[] = [
  {
    account_id: "acc-1",
    name: "Conta principal",
    type: "checking",
    initial_balance: 0,
    is_active: true,
    current_balance: 0,
  },
  {
    account_id: "acc-2",
    name: "Reserva",
    type: "savings",
    initial_balance: 0,
    is_active: true,
    current_balance: 0,
  },
];

const CARDS: CardSummary[] = [
  {
    card_id: "card-1",
    name: "Cartao azul",
    limit: 100_000,
    closing_day: 10,
    due_day: 20,
    payment_account_id: "acc-1",
    is_active: true,
  },
];

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

function installMatchMedia(initialMatches: boolean): MatchMediaController {
  let currentMatches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => {
      return {
        get matches() {
          return currentMatches;
        },
        media: "(max-width: 900px)",
        onchange: null,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners.add(listener);
        },
        removeEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void,
        ) => {
          listeners.delete(listener);
        },
        addListener: (listener: (event: MediaQueryListEvent) => void) => {
          listeners.add(listener);
        },
        removeListener: (listener: (event: MediaQueryListEvent) => void) => {
          listeners.delete(listener);
        },
        dispatchEvent: () => true,
      } as MediaQueryList;
    }),
  );

  return {
    setMatches(nextMatches: boolean) {
      currentMatches = nextMatches;
      const event = { matches: currentMatches } as MediaQueryListEvent;
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

function renderComposer(options?: {
  invoices?: Array<{
    invoice_id: string;
    card_id: string;
    reference_month: string;
    closing_date: string;
    due_date: string;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    purchase_count: number;
    status: string;
  }>;
}) {
  const onSubmitTransaction = vi.fn(() => Promise.resolve());
  const onSubmitTransfer = vi.fn(() => Promise.resolve());
  const onSubmitCardPurchase = vi.fn(() => Promise.resolve());
  const onSubmitInvoicePayment = vi.fn(() => Promise.resolve());
  const onSubmitInvestmentMovement = vi.fn(() => Promise.resolve());

  render(
    <QuickAddComposer
      isOpen
      onClose={vi.fn()}
      accounts={ACCOUNTS}
      cards={CARDS}
      invoices={options?.invoices ?? []}
      onSubmitTransaction={onSubmitTransaction}
      onSubmitTransfer={onSubmitTransfer}
      onSubmitCardPurchase={onSubmitCardPurchase}
      onSubmitInvoicePayment={onSubmitInvoicePayment}
      onSubmitInvestmentMovement={onSubmitInvestmentMovement}
      isSubmitting={false}
    />,
  );

  return {
    onSubmitTransaction,
    onSubmitTransfer,
    onSubmitCardPurchase,
    onSubmitInvoicePayment,
    onSubmitInvestmentMovement,
  };
}

describe("QuickAddComposer", () => {
  beforeEach(() => {
    installDialogEnvironment();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders desktop dialog and keeps the amount input focused", () => {
    installMatchMedia(false);

    renderComposer();

    expect(screen.getByTestId("quick-add-dialog")).toBeInTheDocument();
    expect(screen.queryByTestId("quick-add-drawer")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("0,00")).toHaveFocus();
  });

  it("renders mobile sheet variant when viewport is small", () => {
    installMatchMedia(true);

    renderComposer();

    expect(screen.getByTestId("quick-add-drawer")).toBeInTheDocument();
    expect(screen.queryByTestId("quick-add-dialog")).not.toBeInTheDocument();
  });

  it("shows validation feedback when invoice payment has no open invoice selected", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const { onSubmitInvoicePayment } = renderComposer();

    await user.type(screen.getByPlaceholderText("0,00"), "12");
    await user.selectOptions(screen.getByLabelText(/tipo/i), "transfer");
    await user.selectOptions(screen.getByLabelText(/modo da transferencia/i), "invoice_payment");
    await user.click(screen.getByRole("button", { name: /^lancar$/i }));

    expect(onSubmitInvoicePayment).not.toHaveBeenCalled();
    expect(screen.getByText(/selecione uma fatura em aberto/i)).toBeInTheDocument();
  });

  it("does not submit when Enter is pressed on a select control", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const { onSubmitTransaction } = renderComposer();

    await user.type(screen.getByPlaceholderText("0,00"), "2500");

    const typeSelect = screen.getByLabelText(/tipo/i);
    typeSelect.focus();
    await user.keyboard("{ArrowDown}{Enter}");

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(onSubmitTransaction).not.toHaveBeenCalled();
  });

  it("submits card purchases with Enter on the description field", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const { onSubmitCardPurchase } = renderComposer();

    await user.type(screen.getByPlaceholderText("0,00"), "4500");
    await user.selectOptions(screen.getByLabelText(/modo de pagamento/i), "CARD");
    await user.type(screen.getByLabelText(/^descricao$/i), "Taxi{Enter}");

    await waitFor(() => {
      expect(onSubmitCardPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          amountInCents: 4500,
          description: "Taxi",
          cardId: "card-1",
          installmentsCount: 1,
        }),
      );
    });
  });
});
