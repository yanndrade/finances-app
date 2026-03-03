import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "./App";
import type {
  AccountSummary,
  CardSummary,
  DashboardSummary,
  TransactionSummary,
} from "./lib/api";

type InvoiceSummary = {
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
};

type InvoiceItemSummary = {
  invoice_item_id: string;
  invoice_id: string;
  purchase_id: string;
  card_id: string;
  purchase_date: string;
  category_id: string;
  description: string | null;
  installment_number: number;
  installments_count: number;
  amount: number;
};

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

function buildTransaction(
  overrides: Partial<TransactionSummary> = {},
): TransactionSummary {
  return {
    transaction_id: "tx-1",
    occurred_at: "2026-03-03T12:00:00Z",
    type: "expense",
    amount: 2_500,
    account_id: "acc-1",
    payment_method: "PIX",
    category_id: "mercado",
    description: "Supermercado",
    person_id: null,
    status: "active",
    ...overrides,
  };
}

function buildDashboard(
  overrides: Partial<DashboardSummary> = {},
): DashboardSummary {
  return {
    month: "2026-03",
    total_income: 250_000,
    total_expense: 117_500,
    net_flow: 132_500,
    current_balance: 132_500,
    recent_transactions: [buildTransaction()],
    spending_by_category: [{ category_id: "mercado", total: 2_500 }],
    previous_month: { total_income: 200_000, total_expense: 100_000, net_flow: 100_000 },
    daily_balance_series: [
      { date: "2026-03-01", balance: 250_000 },
      { date: "2026-03-03", balance: 132_500 },
    ],
    review_queue: [],
    ...overrides,
  };
}

function buildCard(overrides: Partial<CardSummary> = {}): CardSummary {
  return {
    card_id: "card-1",
    name: "Nubank",
    limit: 150_000,
    closing_day: 10,
    due_day: 20,
    payment_account_id: "acc-1",
    is_active: true,
    ...overrides,
  };
}

function buildInvoice(overrides: Partial<InvoiceSummary> = {}): InvoiceSummary {
  const invoice: InvoiceSummary = {
    invoice_id: "card-1:2026-03",
    card_id: "card-1",
    reference_month: "2026-03",
    closing_date: "2026-03-10",
    due_date: "2026-03-20",
    total_amount: 100_00,
    paid_amount: 0,
    remaining_amount: 100_00,
    purchase_count: 1,
    status: "open",
    ...overrides,
  };

  if (overrides.remaining_amount === undefined) {
    invoice.remaining_amount = invoice.total_amount - invoice.paid_amount;
  }

  return invoice;
}

function buildInvoiceItem(overrides: Partial<InvoiceItemSummary> = {}): InvoiceItemSummary {
  return {
    invoice_item_id: "purchase-1:1",
    invoice_id: "card-1:2026-03",
    purchase_id: "purchase-1",
    card_id: "card-1",
    purchase_date: "2026-03-03T12:00:00Z",
    category_id: "mercado",
    description: "Supermercado",
    installment_number: 1,
    installments_count: 1,
    amount: 100_00,
    ...overrides,
  };
}

function installAppFetchMock(initialState?: {
  accounts?: AccountSummary[];
  cards?: CardSummary[];
  transactions?: TransactionSummary[];
  dashboard?: DashboardSummary;
  invoices?: InvoiceSummary[];
  invoiceItemsByInvoiceId?: Record<string, InvoiceItemSummary[]>;
}) {
  const state = {
    accounts: initialState?.accounts ?? [buildAccount()],
    cards: initialState?.cards ?? [buildCard()],
    transactions: initialState?.transactions ?? [buildTransaction()],
    invoices: initialState?.invoices ?? [],
    invoiceItemsByInvoiceId: initialState?.invoiceItemsByInvoiceId ?? {},
    dashboard:
      initialState?.dashboard ??
      buildDashboard({
        recent_transactions: initialState?.transactions ?? [buildTransaction()],
      }),
  };

  const fetchMock = vi.fn<(typeof fetch)>().mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.includes("/api/dashboard") && method === "GET") {
      return new Response(JSON.stringify(state.dashboard));
    }

    if (url.includes("/api/accounts") && method === "GET") {
      return new Response(JSON.stringify(state.accounts));
    }

    if (url.includes("/api/cards") && method === "GET") {
      return new Response(JSON.stringify(state.cards));
    }

    if (url.includes("/api/invoices/") && url.endsWith("/items") && method === "GET") {
      const invoiceId = decodeURIComponent(
        url.split("/api/invoices/")[1]?.replace("/items", "") ?? "",
      );

      return new Response(
        JSON.stringify(state.invoiceItemsByInvoiceId[invoiceId] ?? []),
      );
    }

    if (url.includes("/api/invoices") && method === "GET") {
      const currentUrl = new URL(url);
      const cardId = currentUrl.searchParams.get("card");

      return new Response(
        JSON.stringify(
          cardId === null
            ? state.invoices
            : state.invoices.filter((invoice) => invoice.card_id === cardId),
        ),
      );
    }

    if (url.includes("/api/transactions") && method === "GET") {
      return new Response(JSON.stringify(state.transactions));
    }

    if (url.endsWith("/api/dev/reset") && method === "POST") {
      state.accounts = [];
      state.cards = [];
      state.transactions = [];
      state.dashboard = buildDashboard({
        total_income: 0,
        total_expense: 0,
        net_flow: 0,
        current_balance: 0,
        recent_transactions: [],
        spending_by_category: [],
        previous_month: { total_income: 0, total_expense: 0, net_flow: 0 },
        daily_balance_series: [],
        review_queue: [],
      });

      return new Response(
        JSON.stringify({ status: "ok", message: "Application data reset." }),
      );
    }

    if (url.endsWith("/api/accounts") && method === "POST") {
      const payload = JSON.parse(String(init?.body)) as {
        id: string;
        name: string;
        type: string;
        initial_balance: number;
      };
      const nextAccount = buildAccount({
        account_id: payload.id,
        name: payload.name,
        type: payload.type,
        initial_balance: payload.initial_balance,
        current_balance: payload.initial_balance,
      });
      state.accounts = [...state.accounts, nextAccount];

      return new Response(JSON.stringify(nextAccount), { status: 201 });
    }

    if (url.endsWith("/api/cards") && method === "POST") {
      const payload = JSON.parse(String(init?.body)) as {
        id: string;
        name: string;
        limit: number;
        closing_day: number;
        due_day: number;
        payment_account_id: string;
      };
      const nextCard = buildCard({
        card_id: payload.id,
        name: payload.name,
        limit: payload.limit,
        closing_day: payload.closing_day,
        due_day: payload.due_day,
        payment_account_id: payload.payment_account_id,
      });
      state.cards = [...state.cards, nextCard];

      return new Response(JSON.stringify(nextCard), { status: 201 });
    }

    if (url.endsWith("/api/card-purchases") && method === "POST") {
      const payload = JSON.parse(String(init?.body)) as {
        purchase_date: string;
        amount: number;
        card_id: string;
        installments_count?: number;
      };
      const card = state.cards.find((item) => item.card_id === payload.card_id);
      if (!card) {
        return new Response("Card not found", { status: 404 });
      }

      const nextInvoices = allocateMockInvoices({
        amount: payload.amount,
        card,
        installmentsCount: payload.installments_count ?? 1,
        purchaseDate: payload.purchase_date,
      });
      for (const nextInvoice of nextInvoices) {
        const existingInvoice = state.invoices.find(
          (invoice) => invoice.invoice_id === nextInvoice.invoice_id,
        );

        if (existingInvoice) {
          existingInvoice.total_amount += nextInvoice.total_amount;
          existingInvoice.remaining_amount += nextInvoice.remaining_amount;
          existingInvoice.purchase_count += nextInvoice.purchase_count;
        } else {
          state.invoices = [nextInvoice, ...state.invoices];
        }
      }

      return new Response(
        JSON.stringify({
          purchase_id: "purchase-ui-1",
          purchase_date: payload.purchase_date,
          amount: payload.amount,
          category_id: "transport",
          card_id: payload.card_id,
          description: "Taxi",
          installments_count: payload.installments_count ?? 1,
          invoice_id: nextInvoices[0].invoice_id,
          reference_month: nextInvoices[0].reference_month,
          closing_date: nextInvoices[0].closing_date,
          due_date: nextInvoices[0].due_date,
        }),
        { status: 201 },
      );
    }

    if (url.includes("/api/cards/") && method === "PATCH") {
      const cardId = url.split("/api/cards/")[1];
      const payload = JSON.parse(String(init?.body)) as {
        name?: string;
        limit?: number;
        closing_day?: number;
        due_day?: number;
        payment_account_id?: string;
        is_active?: boolean;
      };

      state.cards = state.cards.map((card) => {
        if (card.card_id !== cardId) {
          return card;
        }

        return {
          ...card,
          ...payload,
        };
      });

      return new Response(
        JSON.stringify(state.cards.find((card) => card.card_id === cardId)),
      );
    }

    if (url.includes("/api/invoices/") && url.endsWith("/payments") && method === "POST") {
      const invoiceId = decodeURIComponent(
        url.split("/api/invoices/")[1]?.replace("/payments", "") ?? "",
      );
      const payload = JSON.parse(String(init?.body)) as {
        id: string;
        amount: number;
        account_id: string;
        paid_at: string;
      };
      const invoice = state.invoices.find((item) => item.invoice_id === invoiceId);
      if (!invoice) {
        return new Response("Invoice not found", { status: 404 });
      }

      const appliedAmount = Math.min(payload.amount, invoice.remaining_amount);
      invoice.paid_amount += appliedAmount;
      invoice.remaining_amount -= appliedAmount;
      invoice.status = invoice.remaining_amount === 0 ? "paid" : "partial";

      state.accounts = state.accounts.map((account) => {
        if (account.account_id !== payload.account_id) {
          return account;
        }

        return {
          ...account,
          current_balance: account.current_balance - appliedAmount,
        };
      });

      const paymentTransaction: TransactionSummary = {
        transaction_id: `${payload.id}:invoice-payment`,
        occurred_at: payload.paid_at,
        type: "expense",
        amount: appliedAmount,
        account_id: payload.account_id,
        payment_method: "OTHER",
        category_id: "invoice_payment",
        description: `Pagamento de fatura ${invoiceId}`,
        person_id: null,
        status: "active",
      };
      state.transactions = [paymentTransaction, ...state.transactions];

      return new Response(JSON.stringify(invoice), { status: 201 });
    }

    if (url.includes("/api/transactions/") && method === "PATCH") {
      const transactionId = url.split("/api/transactions/")[1];
      const payload = JSON.parse(String(init?.body)) as {
        occurred_at?: string;
        type?: string;
        amount?: number;
        account_id?: string;
        payment_method?: string;
        category_id?: string;
        description?: string | null;
        person_id?: string | null;
      };

      state.transactions = state.transactions.map((transaction) => {
        if (transaction.transaction_id !== transactionId) {
          return transaction;
        }

        return {
          ...transaction,
          ...payload,
        };
      });
      state.dashboard = {
        ...state.dashboard,
        recent_transactions: state.transactions,
      };

      return new Response(
        JSON.stringify(
          state.transactions.find((transaction) => transaction.transaction_id === transactionId),
        ),
      );
    }

    if (url.includes("/api/transactions/") && url.endsWith("/void") && method === "POST") {
      const transactionId = url.split("/api/transactions/")[1].replace("/void", "");
      state.transactions = state.transactions.map((transaction) => {
        if (transaction.transaction_id !== transactionId) {
          return transaction;
        }

        return {
          ...transaction,
          status: "voided",
        };
      });
      state.dashboard = {
        ...state.dashboard,
        recent_transactions: state.transactions,
      };

      return new Response(
        JSON.stringify(
          state.transactions.find((transaction) => transaction.transaction_id === transactionId),
        ),
      );
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

describe("App", () => {
  it("navigates between desktop views", async () => {
    installAppFetchMock();

    render(<App />);

    expect(await screen.findByText("Como voce esta")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^contas$/i }));
    expect(
      await screen.findByRole("region", { name: /gerenciar contas/i }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^transacoes$/i }));
    expect(
      await screen.findByRole("region", { name: /historico e filtros/i }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^movimentar$/i }));
    expect(
      await screen.findByRole("heading", { level: 1, name: /entrada r.+pida de caixa/i }),
    ).toBeInTheDocument();
  });

  it("creates an account from the accounts view and refreshes the desktop data", async () => {
    const fetchMock = installAppFetchMock();

    render(<App />);

    await screen.findByText("Como voce esta");
    await userEvent.click(screen.getByRole("button", { name: /^contas$/i }));

    await userEvent.click(screen.getByRole("button", { name: /\+ adicionar conta/i }));
    await userEvent.type(screen.getByLabelText(/nome da conta/i), "Reserva");
    await userEvent.selectOptions(screen.getByLabelText(/tipo da conta/i), "savings");
    const balanceInput = screen.getByDisplayValue("0,00");
    await userEvent.clear(balanceInput);
    await userEvent.type(balanceInput, "500");
    await userEvent.click(screen.getByRole("button", { name: /criar conta/i }));

    expect(await screen.findByText("Reserva")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return String(url).endsWith("/api/accounts") && init?.method === "POST";
        }),
      ).toBe(true);
    });
  });

  it("creates and edits a card from the cards view", async () => {
    const fetchMock = installAppFetchMock({
      cards: [],
    });

    render(<App />);

    await screen.findByText("Como voce esta");
    await userEvent.click(screen.getByRole("button", { name: /^cards$/i }));

    expect(
      await screen.findByText(/voce ainda nao tem cartoes cadastrados/i),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /\+ adicionar cartao/i }));
    await userEvent.type(screen.getByLabelText(/nome do cartao/i), "Visa Infinite");
    const limitInput = screen.getByLabelText(/limite do cartao/i);
    await userEvent.clear(limitInput);
    await userEvent.type(limitInput, "5000");
    await userEvent.clear(screen.getByLabelText(/dia de fechamento/i));
    await userEvent.type(screen.getByLabelText(/dia de fechamento/i), "12");
    await userEvent.clear(screen.getByLabelText(/dia de vencimento/i));
    await userEvent.type(screen.getByLabelText(/dia de vencimento/i), "22");
    await userEvent.selectOptions(
      screen.getByLabelText(/conta padrao para pagamento/i),
      "acc-1",
    );
    await userEvent.click(screen.getByRole("button", { name: /criar cartao/i }));

    const cardsSection = await screen.findByRole("region", { name: /gerenciar cartoes/i });
    expect(within(cardsSection).getByText("Visa Infinite")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /editar visa infinite/i }));
    await userEvent.clear(screen.getByLabelText(/nome do cartao/i));
    await userEvent.type(screen.getByLabelText(/nome do cartao/i), "Visa Black");
    await userEvent.click(screen.getByRole("button", { name: /salvar cartao/i }));

    expect(within(cardsSection).getByText("Visa Black")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return String(url).endsWith("/api/cards") && init?.method === "POST";
        }),
      ).toBe(true);
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return String(url).includes("/api/cards/") && init?.method === "PATCH";
        }),
      ).toBe(true);
    });
  });

  it("creates an installment card purchase and shows the projected invoices in the cards view", async () => {
    const fetchMock = installAppFetchMock({
      invoices: [],
    });

    render(<App />);

    await screen.findByText("Como voce esta");
    await userEvent.click(screen.getByRole("button", { name: /^cards$/i }));

    expect(
      await screen.findByText(/nenhuma fatura pendente para os cartoes cadastrados/i),
    ).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/cartao da compra/i), "card-1");
    await userEvent.clear(screen.getByLabelText(/data da compra/i));
    await userEvent.type(screen.getByLabelText(/data da compra/i), "2026-03-11T12:00");
    const amountInput = screen.getByLabelText(/valor da compra/i);
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "5000");
    await userEvent.clear(screen.getByLabelText(/parcelas/i));
    await userEvent.type(screen.getByLabelText(/parcelas/i), "3");
    await userEvent.type(screen.getByLabelText(/categoria da compra/i), "transport");
    await userEvent.type(screen.getByLabelText(/descricao da compra/i), "Taxi");
    await userEvent.click(screen.getByRole("button", { name: /registrar compra/i }));

    const invoicesSection = await screen.findByRole("region", { name: /faturas pendentes/i });
    expect(within(invoicesSection).getByText(/referencia 2026-04/i)).toBeInTheDocument();
    expect(within(invoicesSection).getByText(/referencia 2026-06/i)).toBeInTheDocument();
    expect(within(invoicesSection).getAllByText("R$ 16,66").length).toBe(2);
    expect(within(invoicesSection).getByText("R$ 16,68")).toBeInTheDocument();
    expect(within(invoicesSection).getAllByText(/1 parcela/i).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return String(url).endsWith("/api/card-purchases") && init?.method === "POST";
        }),
      ).toBe(true);
    });
  });

  it("registers an invoice payment from the cards view and keeps partial invoices visible", async () => {
    const fetchMock = installAppFetchMock({
      invoices: [
        buildInvoice({
          invoice_id: "card-1:2026-04",
          card_id: "card-1",
          reference_month: "2026-04",
          closing_date: "2026-04-10",
          due_date: "2026-04-20",
          total_amount: 100_00,
        }),
      ],
    });

    render(<App />);

    await screen.findByText("Como voce esta");
    await userEvent.click(screen.getByRole("button", { name: /^cards$/i }));

    const invoicesSection = await screen.findByRole("region", { name: /faturas pendentes/i });
    expect(within(invoicesSection).getByText("R$ 100,00")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /registrar pagamento/i }));
    await userEvent.clear(screen.getByLabelText(/valor do pagamento/i));
    await userEvent.type(screen.getByLabelText(/valor do pagamento/i), "3000");
    await userEvent.click(screen.getByRole("button", { name: /confirmar pagamento/i }));

    await waitFor(() => {
      expect(within(invoicesSection).getByText("Parcial")).toBeInTheDocument();
    });
    expect(within(invoicesSection).getByText("R$ 70,00")).toBeInTheDocument();
    expect(within(invoicesSection).getByText(/total r\$ 100,00/i)).toBeInTheDocument();
    expect(within(invoicesSection).getByText(/pago r\$ 30,00/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return String(url).includes("/api/invoices/card-1%3A2026-04/payments") &&
            init?.method === "POST";
        }),
      ).toBe(true);
    });
  });

  it("expands invoice details inline and shows the invoice items", async () => {
    const fetchMock = installAppFetchMock({
      invoices: [
        buildInvoice({
          invoice_id: "card-1:2026-04",
          card_id: "card-1",
          reference_month: "2026-04",
          closing_date: "2026-04-10",
          due_date: "2026-04-20",
          total_amount: 100_00,
        }),
      ],
      invoiceItemsByInvoiceId: {
        "card-1:2026-04": [
          buildInvoiceItem({
            invoice_item_id: "purchase-1:1",
            invoice_id: "card-1:2026-04",
            purchase_id: "purchase-1",
            card_id: "card-1",
            purchase_date: "2026-03-15T12:00:00Z",
            category_id: "electronics",
            description: "Headphones",
            installment_number: 1,
            installments_count: 3,
            amount: 33_33,
          }),
        ],
      },
    });

    render(<App />);

    await screen.findByText("Como voce esta");
    await userEvent.click(screen.getByRole("button", { name: /^cards$/i }));
    await userEvent.click(screen.getByRole("button", { name: /ver itens/i }));

    expect(await screen.findByText("Headphones")).toBeInTheDocument();
    expect(screen.getByText(/electronics/)).toBeInTheDocument();
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
    expect(screen.getByText(/33,33/)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return (
            String(url).includes("/api/invoices/card-1%3A2026-04/items") &&
            (init?.method ?? "GET") === "GET"
          );
        }),
      ).toBe(true);
    });
  });

  it("shows feedback as a global toast that auto-hides after success", async () => {
    render(<App />);

    await screen.findByText("Como voce esta");
    await userEvent.click(screen.getByRole("button", { name: /^contas$/i }));

    await userEvent.click(screen.getByRole("button", { name: /\+ adicionar conta/i }));
    await userEvent.type(screen.getByLabelText(/nome da conta/i), "Reserva toast");
    await userEvent.selectOptions(screen.getByLabelText(/tipo da conta/i), "savings");
    const balanceInput = screen.getByDisplayValue("0,00");
    await userEvent.clear(balanceInput);
    await userEvent.type(balanceInput, "500");
    await userEvent.click(screen.getByRole("button", { name: /criar conta/i }));

    expect(
      await screen.findByRole("status", { name: /conta criada com sucesso/i }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^transacoes$/i }));
    expect(
      screen.queryByText("Conta criada com sucesso.", { selector: ".success-banner" }),
    ).not.toBeInTheDocument();

    await waitFor(
      () => {
        expect(
          screen.queryByRole("status", { name: /conta criada com sucesso/i }),
        ).not.toBeInTheDocument();
      },
      { timeout: 4500 },
    );
  });

  it("updates and voids a transaction from the transactions view", async () => {
    const fetchMock = installAppFetchMock();

    render(<App />);

    await screen.findByText("Como voce esta");
    await userEvent.click(screen.getByRole("button", { name: /^transacoes$/i }));

    const transactionsSection = await screen.findByRole("region", {
      name: /historico e filtros/i,
    });
    expect(within(transactionsSection).getByText("Supermercado")).toBeInTheDocument();

    await userEvent.click(within(transactionsSection).getByRole("button", { name: /editar/i }));
    await userEvent.clear(screen.getByLabelText(/descricao da transacao/i));
    await userEvent.type(screen.getByLabelText(/descricao da transacao/i), "Mercado mensal");
    await userEvent.click(screen.getByRole("button", { name: /salvar alteracoes/i }));

    expect(await screen.findByText("Mercado mensal")).toBeInTheDocument();

    await userEvent.click(within(transactionsSection).getByRole("button", { name: /estornar/i }));
    expect(await screen.findByText(/^Estornada$/)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return String(url).includes("/api/transactions/tx-1") && init?.method === "PATCH";
        }),
      ).toBe(true);
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return (
            String(url).includes("/api/transactions/tx-1/void") &&
            init?.method === "POST"
          );
        }),
      ).toBe(true);
    });
  });

  it("renders settings and resets the app in development mode", async () => {
    const fetchMock = installAppFetchMock();
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);

    render(<App />);

    await screen.findByText("Como voce esta");
    await userEvent.click(screen.getByRole("button", { name: /^configura/i }));

    expect(
      await screen.findByRole("heading", { name: /ferramentas de desenvolvimento/i }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /apagar todos os dados/i }));

    expect(confirmMock).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return String(url).endsWith("/api/dev/reset") && init?.method === "POST";
        }),
      ).toBe(true);
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: /visao geral do caixa/i }),
    ).toBeInTheDocument();
    expect((await screen.findAllByText("R$ 0,00")).length).toBeGreaterThan(0);
  });
});

function allocateMockInvoices({
  amount,
  card,
  installmentsCount,
  purchaseDate,
}: {
  amount: number;
  card: CardSummary;
  installmentsCount: number;
  purchaseDate: string;
}): InvoiceSummary[] {
  const normalizedPurchaseDate = purchaseDate.endsWith("Z")
    ? purchaseDate
    : `${purchaseDate}:00Z`;
  const purchase = new Date(normalizedPurchaseDate);
  const baseAmount = Math.floor(amount / installmentsCount);
  const remainder = amount % installmentsCount;
  const firstOffset = purchase.getUTCDate() > card.closing_day ? 1 : 0;

  return Array.from({ length: installmentsCount }, (_value, index) => {
    const target = new Date(
      Date.UTC(purchase.getUTCFullYear(), purchase.getUTCMonth() + firstOffset + index, 1),
    );
    const referenceMonth = `${target.getUTCFullYear()}-${String(
      target.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    const closingDate = `${referenceMonth}-${String(card.closing_day).padStart(2, "0")}`;
    const dueDate = `${referenceMonth}-${String(card.due_day).padStart(2, "0")}`;

    return buildInvoice({
      invoice_id: `${card.card_id}:${referenceMonth}`,
      card_id: card.card_id,
      reference_month: referenceMonth,
      closing_date: closingDate,
      due_date: dueDate,
      total_amount: index === installmentsCount - 1 ? baseAmount + remainder : baseAmount,
      purchase_count: 1,
    });
  });
}
