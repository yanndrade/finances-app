import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QuickAddComposer } from "./quick-add-composer";

import type {
  AccountSummary,
  CardHolderSummary,
  CardSummary,
} from "../lib/api";
import type { CategoryOption } from "../lib/categories";

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
    future_installment_total: 0,
  },
];

const HOLDERS: CardHolderSummary[] = [
  {
    holder_id: "holder-sergio",
    card_id: "card-1",
    name: "Sergio Mello",
    last_four: "6186",
    is_primary: false,
    sub_limit: null,
    reimbursable_person_id: null,
    is_active: true,
    spent_open_invoice: 0,
    spent_future_installments: 0,
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
  preset?:
    | "expense"
    | "income"
    | "transfer_internal"
    | "transfer_invoice_payment"
    | "investment_contribution"
    | "investment_withdrawal"
    | "expense_card";
  presetInvoiceId?: string;
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
  categories?: CategoryOption[];
  onCreateCategory?: (label: string) => boolean;
  onRemoveCategory?: (categoryId: string) => void;
  holdersByCard?: Record<string, CardHolderSummary[]>;
  presetDraft?: Parameters<typeof QuickAddComposer>[0]["presetDraft"];
  recurringRules?: Parameters<typeof QuickAddComposer>[0]["recurringRules"];
  isReviewingImport?: boolean;
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
      holdersByCard={options?.holdersByCard}
      presetDraft={options?.presetDraft}
      invoices={options?.invoices ?? []}
      recurringRules={options?.recurringRules}
      isReviewingImport={options?.isReviewingImport}
      preset={options?.preset}
      presetInvoiceId={options?.presetInvoiceId}
      categories={options?.categories}
      onCreateCategory={options?.onCreateCategory}
      onRemoveCategory={options?.onRemoveCategory}
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
    expect(screen.getByText(/modo rápido/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/pessoa relacionada/i)).not.toBeInTheDocument();
  });

  it("renders mobile sheet variant when viewport is small", () => {
    installMatchMedia(true);

    renderComposer();

    expect(screen.getByTestId("quick-add-drawer")).toBeInTheDocument();
    expect(screen.queryByTestId("quick-add-dialog")).not.toBeInTheDocument();
  });

  it("links an imported expense to an existing fixed expense", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const { onSubmitTransaction } = renderComposer({
      preset: "expense",
      presetDraft: {
        amount: "450.00",
        description: "Condomínio",
        accountId: "acc-1",
        date: "2026-09-03",
      },
      isReviewingImport: true,
      recurringRules: [
        {
          rule_id: "rule-condo",
          name: "Condomínio",
          amount: 45_000,
          due_day: 3,
          account_id: "acc-1",
          card_id: null,
          payment_method: "PIX",
          category_id: "moradia",
          description: null,
          is_active: true,
        },
      ],
    });

    await user.selectOptions(
      screen.getByLabelText(/vincular a gasto fixo/i),
      "rule-condo",
    );
    await user.click(screen.getByRole("button", { name: /^lançar$/i }));

    expect(onSubmitTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        recurringRuleId: "rule-condo",
        categoryId: "moradia",
      }),
    );
  });

  it("keeps the imported amount when reclassifying it as an investment", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const { onSubmitInvestmentMovement } = renderComposer({
      preset: "expense",
      presetDraft: {
        amount: "6645.43",
        description: "Aplicação RDB",
        accountId: "acc-1",
        date: "2026-09-03",
      },
      isReviewingImport: true,
    });

    await user.click(screen.getByRole("button", { name: /^investimento$/i }));
    await user.click(screen.getByRole("button", { name: /^lançar$/i }));

    expect(onSubmitInvestmentMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "contribution",
        contributionAmountInCents: 664_543,
        investedAmountInCents: 664_543,
      }),
    );
  });

  it("shows validation feedback when invoice payment has no open invoice selected", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const { onSubmitInvoicePayment } = renderComposer();

    await user.type(screen.getByPlaceholderText("0,00"), "12");
    await user.click(screen.getByRole("button", { name: /^transferência$/i }));
    await user.selectOptions(screen.getByLabelText(/modo da transfer.ncia/i), "invoice_payment");
    await user.click(screen.getByRole("button", { name: /^lançar$/i }));

    expect(onSubmitInvoicePayment).not.toHaveBeenCalled();
    expect(screen.getByText(/selecione uma fatura em aberto/i)).toBeInTheDocument();
  });

  it("applies transfer invoice payment preset on open", async () => {
    installMatchMedia(false);

    renderComposer({
      preset: "transfer_invoice_payment",
      invoices: [
        {
          invoice_id: "invoice-1",
          card_id: "card-1",
          reference_month: "2026-03",
          closing_date: "2026-03-10",
          due_date: "2026-03-20",
          total_amount: 10_000,
          paid_amount: 0,
          remaining_amount: 10_000,
          purchase_count: 1,
          status: "open",
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/modo da transfer.ncia/i)).toHaveValue("invoice_payment");
    });
    expect(screen.getByLabelText(/^fatura$/i)).toBeInTheDocument();
  });


  it("keeps the selected invoice when opening the invoice payment preset", async () => {
    installMatchMedia(false);

    renderComposer({
      preset: "transfer_invoice_payment",
      presetInvoiceId: "invoice-2",
      invoices: [
        {
          invoice_id: "invoice-1",
          card_id: "card-1",
          reference_month: "2026-03",
          closing_date: "2026-03-10",
          due_date: "2026-03-20",
          total_amount: 10_000,
          paid_amount: 0,
          remaining_amount: 10_000,
          purchase_count: 1,
          status: "open",
        },
        {
          invoice_id: "invoice-2",
          card_id: "card-1",
          reference_month: "2026-04",
          closing_date: "2026-04-10",
          due_date: "2026-04-20",
          total_amount: 20_000,
          paid_amount: 0,
          remaining_amount: 20_000,
          purchase_count: 2,
          status: "open",
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/^fatura$/i)).toHaveValue("invoice-2");
    });
    expect(screen.getByLabelText(/conta que vai pagar a fatura/i)).toBeInTheDocument();
  });

  it("does not submit when Enter is pressed on a select control", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const { onSubmitTransaction } = renderComposer();

    await user.type(screen.getByPlaceholderText("0,00"), "2500");

    const paymentModeSelect = screen.getByLabelText(/modo de pagamento/i);
    paymentModeSelect.focus();
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
    await user.type(screen.getByLabelText(/pessoa relacionada/i), "empresa");
    await user.type(screen.getByLabelText(/pessoa relacionada/i), "empresa");
    await user.type(screen.getByLabelText(/^descrição$/i), "Taxi{Enter}");

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

  it("attributes a card purchase to the holder who carries the card", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const { onSubmitCardPurchase } = renderComposer({
      holdersByCard: { "card-1": HOLDERS },
    });

    await user.type(screen.getByPlaceholderText("0,00"), "5367");
    await user.selectOptions(screen.getByLabelText(/modo de pagamento/i), "CARD");
    await user.selectOptions(screen.getByLabelText(/portador/i), "holder-sergio");
    await user.type(screen.getByLabelText(/^descrição$/i), "Pizzaria{Enter}");

    await waitFor(() => {
      expect(onSubmitCardPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: "card-1",
          holderId: "holder-sergio",
        }),
      );
    });
  });

  it("offers no holder field on a card that has none", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    renderComposer();

    await user.selectOptions(screen.getByLabelText(/modo de pagamento/i), "CARD");

    expect(screen.queryByLabelText(/portador/i)).not.toBeInTheDocument();
  });

  it("opens on the holder a reviewed proposal was attributed to", async () => {
    // The import resolves the holder from the card's last four digits, and the
    // review has to show that before it is written, not silently keep it.
    installMatchMedia(false);
    renderComposer({
      preset: "expense_card",
      holdersByCard: { "card-1": HOLDERS },
      presetDraft: {
        amount: "53.67",
        description: "99Food *Pizzaria Brocado",
        cardId: "card-1",
        holderId: "holder-sergio",
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/portador/i)).toHaveValue("holder-sergio");
    });
  });

  it("does not submit the parent entry when adding a category from the manager", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const onCreateCategory = vi.fn(() => true);
    const { onSubmitTransaction } = renderComposer({
      categories: [],
      onCreateCategory,
      onRemoveCategory: vi.fn(),
    });

    await user.type(screen.getByPlaceholderText("0,00"), "2000");
    const descriptionInput = document.querySelector<HTMLInputElement>("#quick-add-description");
    expect(descriptionInput).not.toBeNull();
    await user.type(descriptionInput!, "Cinema");
    await user.click(screen.getByRole("button", { name: /gerenciar categorias/i }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/nova categoria/i), "Cinema premium");
    await user.click(within(dialog).getByRole("button", { name: /^adicionar$/i }));

    expect(onCreateCategory).toHaveBeenCalledWith("Cinema premium");
    expect(onSubmitTransaction).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("status")).toHaveTextContent(/adicionada/i);
  });

  it("hides the account field for card expenses and still submits", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const { onSubmitCardPurchase } = renderComposer();

    await user.type(screen.getByPlaceholderText("0,00"), "21264");
    await user.type(screen.getByLabelText(/^descrição$/i), "Ventilador");
    await user.selectOptions(screen.getByLabelText(/modo de pagamento/i), "CARD");
    await user.type(screen.getByLabelText(/pessoa relacionada/i), "empresa");

    expect(screen.queryByLabelText(/^conta$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^cartão$/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^lançar$/i }));

    await waitFor(() => {
      expect(onSubmitCardPurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          amountInCents: 21264,
          description: "Ventilador",
          cardId: "card-1",
          personId: "empresa",
        }),
      );
    });
  });

  it("submits investment contributions with new money and reinvested dividends", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const { onSubmitInvestmentMovement } = renderComposer({ preset: "investment_contribution" });

    await user.type(screen.getByLabelText(/dinheiro novo/i), "50000");
    await user.type(screen.getByLabelText(/proventos reinvestidos/i), "456");
    await user.click(screen.getByRole("button", { name: /^lançar$/i }));

    await waitFor(() => {
      expect(onSubmitInvestmentMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "contribution",
          contributionAmountInCents: 500_00,
          reinvestedDividendAmountInCents: 4_56,
          cashAmountInCents: 500_00,
          investedAmountInCents: 504_56,
        }),
      );
    });
  });

  it("opens advanced mode on demand for optional fields", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();

    renderComposer();

    expect(screen.queryByLabelText(/pessoa relacionada/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /modo avançado/i }));

    expect(screen.getByText(/modo avançado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pessoa relacionada/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/salvar e adicionar outra/i)).toBeInTheDocument();
  });
});
