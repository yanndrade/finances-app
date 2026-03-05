import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "./App";
import type {
  AccountSummary,
  CardSummary,
  DashboardSummary,
  InvestmentMovementSummary,
  InvestmentOverview,
  ReportSummary,
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
    category_budgets: [],
    budget_alerts: [],
    previous_month: { total_income: 200_000, total_expense: 100_000, net_flow: 100_000 },
    daily_balance_series: [
      { date: "2026-03-01", balance: 250_000 },
      { date: "2026-03-03", balance: 132_500 },
    ],
    review_queue: [],
    ...overrides,
  };
}

function buildInvestmentOverview(
  overrides: Partial<InvestmentOverview> = {},
): InvestmentOverview {
  return {
    view: "monthly",
    from: "2026-03-01T00:00:00Z",
    to: "2026-03-31T23:59:59Z",
    totals: {
      contribution_total: 30_00,
      dividend_total: 5_00,
      withdrawal_total: 10_00,
      invested_balance: 25_00,
      cash_balance: 132_500,
      wealth: 132_525,
      dividends_accumulated: 5_00,
    },
    goal: {
      target: 25_000,
      realized: 35_00,
      remaining: 21_500,
      progress_percent: 14,
    },
    series: {
      wealth_evolution: [
        {
          bucket: "2026-03",
          cash_balance: 132_500,
          invested_balance: 25_00,
          wealth: 132_525,
        },
      ],
      contribution_dividend_trend: [
        {
          bucket: "2026-03",
          contribution_total: 30_00,
          dividend_total: 5_00,
          withdrawal_total: 10_00,
        },
      ],
    },
    ...overrides,
  };
}

function buildReportSummary(
  overrides: Partial<ReportSummary> = {},
): ReportSummary {
  return {
    period: {
      type: "month",
      from: "2026-03-01T00:00:00Z",
      to: "2026-03-31T23:59:59Z",
    },
    totals: {
      income_total: 250_000,
      expense_total: 117_500,
      net_total: 132_500,
    },
    category_breakdown: [{ category_id: "mercado", total: 2_500 }],
    weekly_trend: [
      {
        week: "2026-W10",
        income_total: 250_000,
        expense_total: 117_500,
        net_total: 132_500,
      },
    ],
    future_commitments: {
      period_installment_impact_total: 0,
      future_installment_total: 0,
      future_installment_months: [],
    },
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
  investmentOverview?: InvestmentOverview;
  investmentMovements?: InvestmentMovementSummary[];
  reportSummary?: ReportSummary;
  invoices?: InvoiceSummary[];
  invoiceItemsByInvoiceId?: Record<string, InvoiceItemSummary[]>;
}) {
  const state = {
    accounts: initialState?.accounts ?? [buildAccount()],
    cards: initialState?.cards ?? [buildCard()],
    transactions: initialState?.transactions ?? [buildTransaction()],
    investmentOverview: initialState?.investmentOverview ?? buildInvestmentOverview(),
    investmentMovements: initialState?.investmentMovements ?? [],
    reportSummary: initialState?.reportSummary ?? buildReportSummary(),
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

    if (url.includes("/api/backups/export") && method === "GET") {
      return new Response(
        JSON.stringify({
          accounts: state.accounts,
          cards: state.cards,
          invoices: state.invoices,
          transactions: state.transactions,
          investment_movements: state.investmentMovements,
          report_summary: state.reportSummary,
        }),
      );
    }

    if (url.includes("/api/investments/overview") && method === "GET") {
      return new Response(JSON.stringify(state.investmentOverview));
    }

    if (url.includes("/api/investments/movements") && method === "GET") {
      return new Response(JSON.stringify(state.investmentMovements));
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

    if (url.includes("/api/reports/summary") && method === "GET") {
      return new Response(JSON.stringify(state.reportSummary));
    }

    if (
      url.includes("/api/reimbursements/") &&
      url.endsWith("/mark-received") &&
      method === "POST"
    ) {
      const reimbursementId = decodeURIComponent(
        url.split("/api/reimbursements/")[1]?.replace("/mark-received", "") ?? "",
      );
      const payload = JSON.parse(String(init?.body)) as {
        received_at: string;
        account_id?: string;
      };
      const pendingReimbursements = state.dashboard.pending_reimbursements ?? [];
      const reimbursement = pendingReimbursements.find(
        (item) => item.transaction_id === reimbursementId,
      );

      if (!reimbursement) {
        return new Response("Reimbursement not found", { status: 404 });
      }

      const accountId = payload.account_id ?? reimbursement.account_id;
      const receiptTransactionId = `${reimbursementId}:reimbursement-receipt`;
      const received = {
        ...reimbursement,
        status: "received",
        account_id: accountId,
        received_at: payload.received_at,
        receipt_transaction_id: receiptTransactionId,
      };
      state.dashboard.pending_reimbursements = pendingReimbursements.filter(
        (item) => item.transaction_id !== reimbursementId,
      );
      state.dashboard.pending_reimbursements_total = (
        state.dashboard.pending_reimbursements ?? []
      ).reduce((sum, item) => sum + item.amount, 0);
      state.dashboard.total_income += reimbursement.amount;
      state.dashboard.net_flow += reimbursement.amount;
      state.dashboard.current_balance += reimbursement.amount;

      state.accounts = state.accounts.map((account) => {
        if (account.account_id !== accountId) {
          return account;
        }

        return {
          ...account,
          current_balance: account.current_balance + reimbursement.amount,
        };
      });

      const receiptTransaction: TransactionSummary = {
        transaction_id: receiptTransactionId,
        occurred_at: payload.received_at,
        type: "income",
        amount: reimbursement.amount,
        account_id: accountId,
        payment_method: "PIX",
        category_id: "reimbursement",
        description: `Reembolso recebido de ${reimbursement.person_id}`,
        person_id: reimbursement.person_id,
        status: "active",
      };
      state.transactions = [receiptTransaction, ...state.transactions];
      state.dashboard.recent_transactions = [receiptTransaction, ...state.dashboard.recent_transactions];

      return new Response(JSON.stringify(received), { status: 201 });
    }

    if (url.endsWith("/api/dev/reset") && method === "POST") {
      state.accounts = [];
      state.cards = [];
      state.transactions = [];
      state.investmentMovements = [];
      state.investmentOverview = buildInvestmentOverview({
        totals: {
          contribution_total: 0,
          dividend_total: 0,
          withdrawal_total: 0,
          invested_balance: 0,
          cash_balance: 0,
          wealth: 0,
          dividends_accumulated: 0,
        },
        goal: {
          target: 0,
          realized: 0,
          remaining: 0,
          progress_percent: 100,
        },
        series: {
          wealth_evolution: [],
          contribution_dividend_trend: [],
        },
      });
      state.dashboard = buildDashboard({
        total_income: 0,
        total_expense: 0,
        net_flow: 0,
        current_balance: 0,
        pending_reimbursements_total: 0,
        pending_reimbursements: [],
        recent_transactions: [],
        spending_by_category: [],
        category_budgets: [],
        budget_alerts: [],
        previous_month: { total_income: 0, total_expense: 0, net_flow: 0 },
        daily_balance_series: [],
        review_queue: [],
      });

      return new Response(
        JSON.stringify({ status: "ok", message: "Application data reset." }),
      );
    }

    if (url.endsWith("/api/investments/movements") && method === "POST") {
      const payload = JSON.parse(String(init?.body)) as {
        id: string;
        occurred_at: string;
        type: "contribution" | "withdrawal";
        account_id: string;
        description?: string;
        contribution_amount?: number;
        dividend_amount?: number;
        cash_amount?: number;
        invested_amount?: number;
      };
      const movement: InvestmentMovementSummary = {
        movement_id: payload.id,
        occurred_at: payload.occurred_at,
        type: payload.type,
        account_id: payload.account_id,
        description: payload.description ?? null,
        contribution_amount: payload.contribution_amount ?? 0,
        dividend_amount: payload.dividend_amount ?? 0,
        cash_amount: payload.cash_amount ?? 0,
        invested_amount: payload.invested_amount ?? 0,
        cash_delta:
          payload.type === "contribution"
            ? -(payload.cash_amount ?? payload.contribution_amount ?? 0)
            : payload.cash_amount ?? 0,
        invested_delta:
          payload.type === "contribution"
            ? payload.invested_amount ?? (payload.contribution_amount ?? 0) + (payload.dividend_amount ?? 0)
            : -(payload.invested_amount ?? 0),
      };
      state.investmentMovements = [movement, ...state.investmentMovements];
      return new Response(JSON.stringify(movement), { status: 201 });
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

    if (url.endsWith("/api/budgets") && method === "POST") {
      const payload = JSON.parse(String(init?.body)) as {
        category_id: string;
        month: string;
        limit: number;
      };
      const existingBudgets = state.dashboard.category_budgets ?? [];
      const spendingByCategory = state.dashboard.spending_by_category.find(
        (item) => item.category_id === payload.category_id,
      )?.total ?? 0;
      const spent = existingBudgets.find(
        (budget) =>
          budget.category_id === payload.category_id &&
          budget.month === payload.month,
      )?.spent ?? spendingByCategory;
      const usagePercent = payload.limit > 0
        ? Math.round((spent * 100) / payload.limit)
        : 0;
      const status = spent > payload.limit
        ? "exceeded"
        : usagePercent >= 80
          ? "warning"
          : "ok";
      const budgetSummary = {
        category_id: payload.category_id,
        month: payload.month,
        limit: payload.limit,
        spent,
        usage_percent: usagePercent,
        status,
      };
      const hasExisting = existingBudgets.some(
        (budget) =>
          budget.category_id === payload.category_id &&
          budget.month === payload.month,
      );
      state.dashboard.category_budgets = hasExisting
        ? existingBudgets.map((budget) =>
            budget.category_id === payload.category_id && budget.month === payload.month
              ? budgetSummary
              : budget,
          )
        : [...existingBudgets, budgetSummary];
      state.dashboard.budget_alerts = (state.dashboard.category_budgets ?? []).filter(
        (budget) => budget.status !== "ok",
      );

      return new Response(JSON.stringify(budgetSummary), { status: hasExisting ? 200 : 201 });
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
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("navigates between desktop views", async () => {
    installAppFetchMock();

    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+\s*lan.ar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /lan.amento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^movimentar$/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^contas$/i }));
    expect(
      await screen.findByRole("region", { name: /contas e saldos/i }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^historico/i }));
    expect(
      await screen.findByRole("region", { name: /historico e filtros/i }),
    ).toBeInTheDocument();
  });

  it("does not render a fixed contextual panel in desktop shell", async () => {
    installAppFetchMock();

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });

    expect(
      screen.queryByRole("heading", { name: /painel contextual/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/espaco reservado para formularios rapidos/i),
    ).not.toBeInTheDocument();
  });

  it("uses unified desktop navigation taxonomy labels", async () => {
    installAppFetchMock();

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });

    expect(
      screen.getByRole("button", { name: /historico unificado/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /patrimonio & investimentos/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /analises & relatorios/i }),
    ).toBeInTheDocument();
  });

  it("navigates to investments view and shows advanced analytics", async () => {
    installAppFetchMock();

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });
    await userEvent.click(screen.getByRole("button", { name: /^patrimonio/i }));
    await screen.findByRole("heading", { level: 1, name: /patrim.nio & investimentos/i });

    expect(
      await screen.findByRole(
        "heading",
        { level: 2, name: /evolu..o do patrim.nio/i },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /di.rio/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /semanal/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mensal/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bimestral/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /trimestral/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /anual/i })).toBeInTheDocument();
  });

  it("routes investment actions to the global quick add with presets", async () => {
    installAppFetchMock();

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });
    await userEvent.click(screen.getByRole("button", { name: /^patrimonio/i }));

    expect(screen.queryByRole("button", { name: /salvar aporte/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /salvar resgate/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /novo aporte/i }));

    const dialog = await screen.findByRole("dialog", undefined, { timeout: 5_000 });
    expect(within(dialog).getByLabelText(/^tipo$/i)).toHaveValue("investment");
    expect(within(dialog).getByLabelText(/tipo do movimento/i)).toHaveValue("contribution");
  });

  it("opens the unified ledger from investments quick action", async () => {
    installAppFetchMock({
      transactions: [
        buildTransaction({
          transaction_id: "tx-invest",
          description: "Invest aporte mensal",
          category_id: "investment",
        }),
        buildTransaction({
          transaction_id: "tx-salary",
          type: "income",
          category_id: "salary",
          description: "Salario principal",
          amount: 7_500_00,
        }),
      ],
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });
    await userEvent.click(screen.getByRole("button", { name: /^patrimonio/i }));
    await userEvent.click(
      await screen.findByRole("button", { name: /ver movimentos no historico/i }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: /hist.rico unificado/i }),
    ).toBeInTheDocument();
    const searchInput = await screen.findByLabelText(/buscar/i);
    expect(searchInput).toHaveValue("invest");
    expect(await screen.findByText(/invest aporte mensal/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/salario principal/i)).not.toBeInTheDocument();
    });
  });

  it("marks a pending reimbursement as received from dashboard", async () => {
    const fetchMock = installAppFetchMock({
      dashboard: buildDashboard({
        pending_reimbursements_total: 2_500,
        pending_reimbursements: [
          {
            transaction_id: "tx-1",
            person_id: "Ana",
            amount: 2_500,
            status: "pending",
            account_id: "acc-1",
            occurred_at: "2026-03-03T12:00:00Z",
            received_at: null,
            receipt_transaction_id: null,
          },
        ],
      }),
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });
    expect(await screen.findByText(/reembolsos pendentes/i)).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 25,00").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: /marcar recebido/i }));

    expect(
      await screen.findByRole("status", { name: /reembolso confirmado com sucesso/i }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Ana")).not.toBeInTheDocument();
    });
    expect(screen.getByText(/nenhum valor pendente/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return String(url).includes("/api/reimbursements/tx-1/mark-received") &&
            init?.method === "POST";
        }),
      ).toBe(true);
    });
  });

  it("shows category budget alerts on dashboard and updates monthly limits from settings", async () => {
    const fetchMock = installAppFetchMock({
      dashboard: buildDashboard({
        spending_by_category: [{ category_id: "food", total: 8_500 }],
        category_budgets: [
          {
            category_id: "food",
            month: "2026-03",
            limit: 10_000,
            spent: 8_500,
            usage_percent: 85,
            status: "warning",
          },
        ],
        budget_alerts: [
          {
            category_id: "food",
            month: "2026-03",
            limit: 10_000,
            spent: 8_500,
            usage_percent: 85,
            status: "warning",
          },
        ],
      }),
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });
    expect(await screen.findByText(/orcamentos por categoria/i)).toBeInTheDocument();
    expect(screen.getByText(/^Em alerta$/i)).toBeInTheDocument();
    expect(screen.getByText(/r\$\s*85,00 de r\$\s*100,00/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /salvar limite/i })).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /ajustar limites em configuracoes/i }),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: /^config/i }),
    ).toBeInTheDocument();

    const budgetLimitInput = await screen.findByLabelText(/limite mensal/i);
    await userEvent.clear(budgetLimitInput);
    await userEvent.type(budgetLimitInput, "15000");
    await userEvent.click(screen.getByRole("button", { name: /salvar limite/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return String(url).endsWith("/api/budgets") && init?.method === "POST";
        }),
      ).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByText(/saudavel/i)).toBeInTheDocument();
    });
  });

  it("opens the unified ledger with budget-alert context from dashboard quick corrections", async () => {
    installAppFetchMock({
      transactions: [
        buildTransaction({
          transaction_id: "tx-food",
          category_id: "food",
          description: "Mercado semanal",
        }),
        buildTransaction({
          transaction_id: "tx-salary",
          type: "income",
          category_id: "salary",
          description: "Salario principal",
          amount: 7_500_00,
        }),
      ],
      dashboard: buildDashboard({
        spending_by_category: [{ category_id: "food", total: 8_500 }],
        category_budgets: [
          {
            category_id: "food",
            month: "2026-03",
            limit: 10_000,
            spent: 8_500,
            usage_percent: 85,
            status: "warning",
          },
        ],
        budget_alerts: [
          {
            category_id: "food",
            month: "2026-03",
            limit: 10_000,
            spent: 8_500,
            usage_percent: 85,
            status: "warning",
          },
        ],
      }),
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });
    await userEvent.click(screen.getByRole("button", { name: /ver categorias em alerta/i }));

    expect(
      await screen.findByRole("heading", { level: 1, name: /hist.rico unificado/i }),
    ).toBeInTheDocument();
    const searchInput = await screen.findByLabelText(/buscar/i);
    expect(searchInput).toHaveValue("Alimentação");
    expect(await screen.findByText(/mercado semanal/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/salario principal/i)).not.toBeInTheDocument();
    });
  });

  it("opens the unified ledger with review-queue context from dashboard quick corrections", async () => {
    installAppFetchMock({
      transactions: [
        buildTransaction({
          transaction_id: "tx-review",
          category_id: "other",
          description: "Compra sem categoria",
        }),
        buildTransaction({
          transaction_id: "tx-salary",
          type: "income",
          category_id: "salary",
          description: "Salario principal",
          amount: 7_500_00,
        }),
      ],
      dashboard: buildDashboard({
        review_queue: [
          {
            transaction_id: "tx-review",
            occurred_at: "2026-03-03T12:00:00Z",
            type: "expense",
            amount: 12_000,
            account_id: "acc-1",
            payment_method: "PIX",
            category_id: "other",
            description: "Compra sem categoria",
            person_id: null,
            status: "active",
          },
        ],
      }),
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });
    expect(await screen.findByText(/^Sem categoria$/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^resolver$/i }));

    expect(
      await screen.findByRole("heading", { level: 1, name: /hist.rico unificado/i }),
    ).toBeInTheDocument();
    const searchInput = await screen.findByLabelText(/buscar/i);
    expect(searchInput).toHaveValue("Compra sem categoria");
    expect(await screen.findByText(/compra sem categoria/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/salario principal/i)).not.toBeInTheDocument();
    });
  });

  it("opens the unified ledger from reports category shortcuts", async () => {
    installAppFetchMock({
      reportSummary: buildReportSummary({
        category_breakdown: [{ category_id: "food", total: 30_000 }],
      }),
      transactions: [
        buildTransaction({
          transaction_id: "tx-food",
          category_id: "food",
          description: "Mercado mensal",
          amount: 30_000,
        }),
        buildTransaction({
          transaction_id: "tx-rent",
          category_id: "housing",
          description: "Aluguel",
          amount: 120_000,
        }),
      ],
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });
    await userEvent.click(screen.getByRole("button", { name: /analises.*relatorios/i }));
    expect(
      await screen.findByRole("heading", { level: 1, name: /^an.lises/i }),
    ).toBeInTheDocument();

    const openLedgerFromReportsButton = await screen.findByRole("button", {
      name: /abrir .*hist.rico/i,
    });
    await userEvent.click(openLedgerFromReportsButton);

    expect(
      await screen.findByRole("heading", { level: 1, name: /hist.rico unificado/i }),
    ).toBeInTheDocument();
    const searchInput = await screen.findByLabelText(/buscar/i);
    expect((searchInput as HTMLInputElement).value).toMatch(/alimenta/i);
    expect(await screen.findByText(/mercado mensal/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/aluguel/i)).not.toBeInTheDocument();
    });
  });

  it("preserves the report range when drilling from weekly reports into the ledger", async () => {
    const fetchMock = installAppFetchMock({
      reportSummary: buildReportSummary({
        period: {
          type: "week",
          from: "2026-04-07T00:00:00Z",
          to: "2026-04-13T23:59:59Z",
        },
      }),
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });
    await userEvent.click(screen.getByRole("button", { name: /analises.*relatorios/i }));
    expect(
      await screen.findByRole("heading", { level: 1, name: /^an.lises/i }),
    ).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: /ver recorte do periodo/i }));

    expect(
      await screen.findByRole("heading", { level: 1, name: /hist.rico unificado/i }),
    ).toBeInTheDocument();

    const transactionCalls = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes("/api/transactions"));
    const ledgerRequest = new URL(transactionCalls.at(-1) ?? "http://127.0.0.1");
    expect(ledgerRequest.searchParams.get("from")).toBe("2026-04-07T00:00:00Z");
    expect(ledgerRequest.searchParams.get("to")).toBe("2026-04-13T23:59:59Z");
  });

  it("shows upcoming events on dashboard and opens cards workspace from that section", async () => {
    installAppFetchMock({
      cards: [
        buildCard({ card_id: "card-1", name: "Nubank" }),
      ],
      invoices: [
        buildInvoice({
          invoice_id: "card-1:2026-03",
          card_id: "card-1",
          reference_month: "2026-03",
          due_date: "2026-03-20",
          total_amount: 100_00,
          remaining_amount: 100_00,
          status: "open",
        }),
      ],
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });
    expect(await screen.findByText(/proximos eventos/i)).toBeInTheDocument();
    expect(screen.getByText(/nubank/i)).toBeInTheDocument();
    expect(screen.getByText(/vence em 2026-03-20/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /abrir cartoes/i }));

    expect(await screen.findByRole("heading", { level: 1, name: /^cart/i })).toBeInTheDocument();
  });

  it("opens quick add with controlled category selection", async () => {
    installAppFetchMock();
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

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });

    await userEvent.click(screen.getByRole("button", { name: /\+\s*lan.ar/i }));

    const dialog = await screen.findByRole("dialog", undefined, { timeout: 5_000 });
    expect(within(dialog).getByRole("button", { name: /^lan.ar$/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole("tab", { name: /cart.o/i })).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("tab", { name: /pagamento de fatura/i }),
    ).not.toBeInTheDocument();

    await userEvent.selectOptions(within(dialog).getByLabelText(/tipo/i), "expense");
    await userEvent.selectOptions(
      within(dialog).getByLabelText(/modo de pagamento/i),
      "CARD",
    );

    expect(within(dialog).getByLabelText(/cart.o/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/parcelas/i)).toBeInTheDocument();

    await userEvent.selectOptions(within(dialog).getByLabelText(/tipo/i), "transfer");
    expect(within(dialog).getByLabelText(/conta destino/i)).toBeInTheDocument();
    await userEvent.selectOptions(
      within(dialog).getByLabelText(/modo da transfer.ncia/i),
      "invoice_payment",
    );
    expect(within(dialog).getByLabelText(/fatura/i)).toBeInTheDocument();

    await userEvent.selectOptions(within(dialog).getByLabelText(/tipo/i), "expense");
    const categorySelect = await within(dialog).findByRole("combobox", { name: /categoria/i }, {
      timeout: 5_000,
    });
    expect(categorySelect).toBeInTheDocument();

    await userEvent.click(categorySelect);

    expect(await screen.findByRole("option", { name: /alimenta/i })).toBeInTheDocument();
  });

  it("opens command palette with Ctrl+K and routes actions to the global launcher", async () => {
    installAppFetchMock({
      invoices: [buildInvoice()],
    });
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

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    const paletteDialog = await screen.findByRole("dialog", {
      name: /command palette/i,
    });
    expect(within(paletteDialog).getByText(/registrar despesa/i)).toBeInTheDocument();

    await userEvent.click(within(paletteDialog).getByText(/registrar despesa/i));

    const launcherDialog = await screen.findByRole("dialog", {
      name: /^lancar$/i,
    });
    expect(within(launcherDialog).getByLabelText(/^tipo$/i)).toHaveValue("expense");
  });

  it("uses explicit invoice payment copy", async () => {
    installAppFetchMock({
      invoices: [buildInvoice()],
    });
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

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });
    await userEvent.click(screen.getByRole("button", { name: /\+\s*lan.ar/i }));

    const dialog = await screen.findByRole("dialog", undefined, { timeout: 5_000 });
    await userEvent.selectOptions(
      within(dialog).getByLabelText(/tipo/i),
      "transfer",
    );
    await userEvent.selectOptions(
      within(dialog).getByLabelText(/modo da transfer.ncia/i),
      "invoice_payment",
    );

    expect(within(dialog).getByText(/quitar saldo do cartao/i)).toBeInTheDocument();
  });

  it("shows card limit availability", async () => {
    installAppFetchMock({
      invoices: [buildInvoice()],
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^cart/i }));

    expect(
      await screen.findByText(/limite comprometido/i, undefined, { timeout: 5_000 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/limite dispon/i)).toBeInTheDocument();
  });

  it("restores account management actions from the accounts workspace", async () => {
    installAppFetchMock();

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^contas$/i }));

    const accountsSection = await screen.findByRole("region", { name: /gerenciar contas/i });
    expect(within(accountsSection).getByRole("button", { name: /\+ adicionar conta/i })).toBeInTheDocument();
    expect(within(accountsSection).getByRole("button", { name: /^editar$/i })).toBeInTheDocument();
    expect(within(accountsSection).getByRole("button", { name: /abrir configuracoes/i })).toBeInTheDocument();
  });

  it("renders the cards overview and wallet settings", async () => {
    installAppFetchMock({
      invoices: [buildInvoice()],
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^cart/i }));

    expect((await screen.findAllByText(/faturas abertas/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/carteira/i).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("tab", { name: /ajustes/i }));

    expect(await screen.findByText(/ajustes da carteira/i)).toBeInTheDocument();
    expect(screen.getByText(/contas de pagamento/i)).toBeInTheDocument();
  });

  it("opens the unified ledger from cards quick action", async () => {
    installAppFetchMock({
      transactions: [
        buildTransaction({
          transaction_id: "purchase-1:card-purchase",
          description: "Mercado no cartao",
          category_id: "food",
          payment_method: "OTHER",
          ledger_event_type: "card_purchase",
          ledger_source: "card_liability:card-1",
          ledger_destination: "category:food",
          status: "readonly",
        }),
        buildTransaction({
          transaction_id: "tx-salary",
          type: "income",
          category_id: "salary",
          description: "Salario principal",
          amount: 7_500_00,
        }),
      ],
      invoices: [buildInvoice()],
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^cart/i }));
    await userEvent.click(await screen.findByRole("button", { name: /referencia 2026-03/i }));
    await userEvent.click(await screen.findByRole("button", { name: /ver gastos/i }));

    expect(
      await screen.findByRole("heading", { level: 1, name: /hist.rico unificado/i }),
    ).toBeInTheDocument();
    const cardFilter = await screen.findByLabelText(/cartao do filtro/i);
    expect(cardFilter).toHaveValue("card-1");
    expect(await screen.findByText(/mercado no cartao/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/salario principal/i)).not.toBeInTheDocument();
    });
  });

  it("shows consolidated invoice rows in the cards purchases tab", async () => {
    installAppFetchMock({
      invoices: [
        buildInvoice({
          invoice_id: "card-1:2026-03",
          reference_month: "2026-03",
          closing_date: "2026-03-10",
          due_date: "2026-03-20",
          total_amount: 50_00,
          purchase_count: 3,
        }),
      ],
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^cart/i }));
    await userEvent.click(screen.getByRole("tab", { name: /compras/i }));

    expect(await screen.findByText(/compras consolidadas/i)).toBeInTheDocument();
    expect(screen.getByText("2026-03")).toBeInTheDocument();
    expect(screen.getByText("R$ 50,00")).toBeInTheDocument();
  });

  it("registers an invoice payment from the cards view and keeps partial invoices visible", async () => {
    const fetchMock = installAppFetchMock({
      invoices: [
        buildInvoice({
          invoice_id: "card-1:2026-03",
          card_id: "card-1",
          reference_month: "2026-03",
          closing_date: "2026-03-10",
          due_date: "2026-03-20",
          total_amount: 100_00,
        }),
      ],
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^cart/i }));

    const invoiceButton = await screen.findByRole("button", { name: /referencia 2026-03/i });
    await userEvent.click(invoiceButton);

    expect(await screen.findByText(/fatura de 2026-03/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /pagar agora/i }));

    const dialog = await screen.findByRole("dialog", undefined, { timeout: 5_000 });
    expect(within(dialog).getByLabelText(/^tipo$/i)).toHaveValue("transfer");
    expect(within(dialog).getByLabelText(/modo da transfer.ncia/i)).toHaveValue("invoice_payment");
    await userEvent.type(within(dialog).getByPlaceholderText("0,00"), "3000");
    await userEvent.click(within(dialog).getByRole("button", { name: /^lan.ar$/i }));

    await waitFor(() => {
      expect(screen.getByText("Parcial")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/R\$\s*70,00/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s*100,00/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s*30,00/i).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return String(url).includes("/api/invoices/card-1%3A2026-03/payments") &&
            init?.method === "POST";
        }),
      ).toBe(true);
    });
  });

  it("keeps the viewed invoice selected when paying from cards with multiple open invoices", async () => {
    const fetchMock = installAppFetchMock({
      cards: [
        buildCard({ card_id: "card-1", name: "Cartao A" }),
        buildCard({ card_id: "card-2", name: "Cartao B" }),
      ],
      invoices: [
        buildInvoice({
          invoice_id: "card-1:2026-03",
          card_id: "card-1",
          reference_month: "2026-03",
          closing_date: "2026-03-10",
          due_date: "2026-03-20",
          total_amount: 80_00,
        }),
        buildInvoice({
          invoice_id: "card-2:2026-03",
          card_id: "card-2",
          reference_month: "2026-03",
          closing_date: "2026-03-10",
          due_date: "2026-03-20",
          total_amount: 120_00,
        }),
      ],
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^cart/i }));
    await userEvent.selectOptions(screen.getByLabelText(/escopo dos cartoes/i), "card-2");

    expect(await screen.findByText(/fatura de 2026-03/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /pagar agora/i }));

    const dialog = await screen.findByRole("dialog", undefined, { timeout: 5_000 });
    await waitFor(() => {
      expect(within(dialog).getByLabelText(/fatura/i)).toHaveValue("card-2:2026-03");
    });

    await userEvent.type(within(dialog).getByPlaceholderText("0,00"), "5000");
    await userEvent.click(within(dialog).getByRole("button", { name: /^lan.ar$/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return String(url).includes("/api/invoices/card-2%3A2026-03/payments") &&
            init?.method === "POST";
        }),
      ).toBe(true);
    });
  });

  it("expands invoice details inline and shows the invoice items", async () => {
    const fetchMock = installAppFetchMock({
      invoices: [
        buildInvoice({
          invoice_id: "card-1:2026-03",
          card_id: "card-1",
          reference_month: "2026-03",
          closing_date: "2026-03-10",
          due_date: "2026-03-20",
          total_amount: 100_00,
        }),
      ],
      invoiceItemsByInvoiceId: {
        "card-1:2026-03": [
          buildInvoiceItem({
            invoice_item_id: "purchase-1:1",
            invoice_id: "card-1:2026-03",
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

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^cart/i }));
    await userEvent.click(await screen.findByRole("button", { name: /referencia 2026-03/i }));
    await userEvent.click(await screen.findByRole("button", { name: /ver itens/i }));

    expect(await screen.findByText("Headphones")).toBeInTheDocument();
    expect(screen.getByText(/resumo detalhado/i)).toBeInTheDocument();
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
    expect(screen.getByText(/r\$ 33,33/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return (
            String(url).includes("/api/invoices/card-1%3A2026-03/items") &&
            (init?.method ?? "GET") === "GET"
          );
        }),
      ).toBe(true);
    });
  });

  it("shows feedback as a global toast that auto-hides after success", async () => {
    const confirmMock = vi.fn<(message?: string) => boolean>(() => true);
    vi.stubGlobal("confirm", confirmMock);

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^config/i }));
    await screen.findByRole("region", { name: /configuracoes do sistema/i });
    await userEvent.click(screen.getByRole("button", { name: /zona de perigo/i }));
    await userEvent.click(screen.getByRole("button", { name: /apagar todos os dados/i }));

    expect(
      await screen.findByRole("status", { name: /aplicacao zerada com sucesso/i }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^historico/i }));
    expect(
      screen.queryByText("Aplicacao zerada com sucesso.", { selector: ".success-banner" }),
    ).not.toBeInTheDocument();

    await waitFor(
      () => {
        expect(
          screen.queryByRole("status", { name: /aplicacao zerada com sucesso/i }),
        ).not.toBeInTheDocument();
      },
      { timeout: 4500 },
    );
  });

  it("updates and voids a transaction from the transactions view", async () => {
    const fetchMock = installAppFetchMock();

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^historico/i }));

    const transactionsSection = await screen.findByRole("region", {
      name: /historico e filtros/i,
    });
    expect(within(transactionsSection).getByText("Supermercado")).toBeInTheDocument();
    expect(screen.getByLabelText(/m.todo do filtro/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/categoria do filtro/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pessoa do filtro/i)).toBeInTheDocument();

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

  it("shows unified ledger header with top filters and slice KPIs", async () => {
    installAppFetchMock({
      transactions: [
        buildTransaction({
          transaction_id: "tx-income",
          type: "income",
          amount: 500_00,
          description: "Salario",
          category_id: "salary",
        }),
        buildTransaction({
          transaction_id: "tx-expense",
          type: "expense",
          amount: 125_00,
          description: "Mercado",
          category_id: "food",
        }),
      ],
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^historico/i }));

    expect(
      await screen.findByRole("heading", { level: 2, name: /historico unificado/i }),
    ).toBeInTheDocument();
    const kpiGroup = screen.getByRole("group", { name: /kpis do recorte/i });
    expect(within(kpiGroup).getByText(/entradas/i)).toBeInTheDocument();
    expect(within(kpiGroup).getByText(/saidas/i)).toBeInTheDocument();
    expect(within(kpiGroup).getByText(/resultado/i)).toBeInTheDocument();
    expect(within(kpiGroup).getByText(/R\$\s*500,00/i)).toBeInTheDocument();
    expect(within(kpiGroup).getByText(/R\$\s*125,00/i)).toBeInTheDocument();
    expect(within(kpiGroup).getByText(/R\$\s*375,00/i)).toBeInTheDocument();

    expect(screen.getByLabelText(/periodo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/buscar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/conta do filtro/i)).toBeInTheDocument();
  });

  it("shows origem e destino columns in the unified ledger and drawer details", async () => {
    installAppFetchMock({
      transactions: [
        buildTransaction({
          transaction_id: "tx-expense",
          type: "expense",
          amount: 90_00,
          category_id: "food",
          description: "Almoco",
        }),
      ],
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^historico/i }));

    const transactionsSection = await screen.findByRole("region", {
      name: /historico e filtros/i,
    });
    expect(within(transactionsSection).getByText(/^Origem$/i)).toBeInTheDocument();
    expect(within(transactionsSection).getByText(/^Destino$/i)).toBeInTheDocument();

    await userEvent.click(within(transactionsSection).getByText("Almoco"));

    const detailDialog = await screen.findByRole("dialog", {
      name: /detalhes da transacao/i,
    });
    expect(within(detailDialog).getByText(/^Origem$/i)).toBeInTheDocument();
    expect(within(detailDialog).getByText(/^Destino$/i)).toBeInTheDocument();
  });

  it("filters the ledger table instantly through the top search field", async () => {
    installAppFetchMock({
      transactions: [
        buildTransaction({
          transaction_id: "tx-market",
          description: "Supermercado centro",
          category_id: "food",
        }),
        buildTransaction({
          transaction_id: "tx-salary",
          type: "income",
          description: "Salario principal",
          category_id: "salary",
          amount: 8_500_00,
        }),
      ],
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^historico/i }));

    expect(await screen.findByText(/supermercado centro/i)).toBeInTheDocument();
    expect(screen.getByText(/salario principal/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/buscar/i), "super");

    expect(screen.getByText(/supermercado centro/i)).toBeInTheDocument();
    expect(screen.queryByText(/salario principal/i)).not.toBeInTheDocument();
  });

  it("supports density modes for the ledger table", async () => {
    installAppFetchMock();

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^historico/i }));

    const transactionsSection = await screen.findByRole("region", {
      name: /historico e filtros/i,
    });
    const dataTable = within(transactionsSection).getByRole("table");
    const tableShell = dataTable.closest(".table-shell");
    expect(tableShell).toHaveClass("table-shell--compact");

    await userEvent.selectOptions(screen.getByLabelText(/densidade da tabela/i), "compact");
    expect(tableShell).toHaveClass("table-shell--compact");

    await userEvent.selectOptions(screen.getByLabelText(/densidade da tabela/i), "dense");
    expect(tableShell).toHaveClass("table-shell--dense");
  });

  it("opens ledger drill-down details when selecting a transaction row", async () => {
    installAppFetchMock({
      transactions: [
        buildTransaction({
          transaction_id: "tx-detail",
          description: "Supermercado centro",
          category_id: "food",
        }),
      ],
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^historico/i }));

    const transactionsSection = await screen.findByRole("region", {
      name: /historico e filtros/i,
    });
    await userEvent.click(within(transactionsSection).getByText("Supermercado centro"));

    const detailDialog = await screen.findByRole("dialog", {
      name: /detalhes da transacao/i,
    });
    expect(detailDialog).toHaveClass("ledger-detail-drawer");
    expect(within(detailDialog).getByText(/supermercado centro/i)).toBeInTheDocument();
    expect(within(detailDialog).getByText(/^categoria$/i)).toBeInTheDocument();
    expect(within(detailDialog).getByText(/forma de pagamento/i)).toBeInTheDocument();
  });

  it("keeps report summary visible when a stale non-report refresh settles later", async () => {
    let resolveFirstTransactionsRequest: (() => void) | null = null;
    const firstTransactionsRequestBlocked = new Promise<void>((resolve) => {
      resolveFirstTransactionsRequest = resolve;
    });
    let transactionRequestCount = 0;
    const reportSummary = buildReportSummary({
      category_breakdown: [{ category_id: "food", total: 3_000 }],
    });
    const fetchMock = vi.fn<(typeof fetch)>().mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.includes("/api/transactions") && method === "GET") {
        transactionRequestCount += 1;
        if (transactionRequestCount === 1) {
          await firstTransactionsRequestBlocked;
        }
        return new Response(JSON.stringify([buildTransaction()]));
      }

      if (url.includes("/api/reports/summary") && method === "GET") {
        return new Response(JSON.stringify(reportSummary));
      }

      if (url.includes("/api/dashboard") && method === "GET") {
        return new Response(JSON.stringify(buildDashboard()));
      }

      if (url.includes("/api/accounts") && method === "GET") {
        return new Response(JSON.stringify([buildAccount()]));
      }

      if (url.includes("/api/cards") && method === "GET") {
        return new Response(JSON.stringify([buildCard()]));
      }

      if (url.includes("/api/invoices") && method === "GET") {
        return new Response(JSON.stringify([]));
      }

      if (url.includes("/api/investments/overview") && method === "GET") {
        return new Response(JSON.stringify(buildInvestmentOverview()));
      }

      if (url.includes("/api/investments/movements") && method === "GET") {
        return new Response(JSON.stringify([]));
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i });
    await userEvent.click(screen.getByRole("button", { name: /^analises/i }));
    expect(await screen.findByRole("heading", { level: 1, name: /relat/i })).toBeInTheDocument();
    expect(await screen.findByText(/consumo por categoria/i)).toBeInTheDocument();

    await act(async () => {
      resolveFirstTransactionsRequest?.();
      await new Promise((resolve) => {
        setTimeout(resolve, 60);
      });
    });

    expect(transactionRequestCount).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/consumo por categoria/i)).toBeInTheDocument();
    expect(screen.queryByText(/n.o foi poss.vel carregar os relat.rios/i)).not.toBeInTheDocument();
  });

  it("exports a full backup snapshot from the dedicated backup endpoint", async () => {
    const fullTransactions = [
      buildTransaction({
        transaction_id: "tx-full-1",
        occurred_at: "2026-02-01T10:00:00Z",
        description: "Snapshot transaction",
      }),
      buildTransaction({
        transaction_id: "tx-full-2",
        occurred_at: "2026-03-10T10:00:00Z",
        description: "Another transaction",
      }),
    ];
    const fullInvestmentMovements = [
      {
        movement_id: "inv-full-1",
        occurred_at: "2026-01-15T10:00:00Z",
        type: "contribution" as const,
        account_id: "acc-1",
        description: "Aporte anual",
        contribution_amount: 100_00,
        dividend_amount: 0,
        cash_amount: 100_00,
        invested_amount: 100_00,
        cash_delta: -100_00,
        invested_delta: 100_00,
      },
    ];
    const fullReportSummary = buildReportSummary({
      period: {
        type: "custom",
        from: "2026-02-01T10:00:00Z",
        to: "2026-03-10T10:00:00Z",
      },
      category_breakdown: [{ category_id: "backup", total: 4_000 }],
    });
    const fetchMock = installAppFetchMock({
      transactions: fullTransactions,
      investmentMovements: fullInvestmentMovements,
      reportSummary: fullReportSummary,
      invoices: [
        {
          invoice_id: "card-1:2026-03",
          card_id: "card-1",
          reference_month: "2026-03",
          closing_date: "2026-03-10",
          due_date: "2026-03-20",
          total_amount: 12_000,
          paid_amount: 0,
          remaining_amount: 12_000,
          purchase_count: 1,
          status: "open",
        },
      ],
    });
    let serializedBackup = "";
    const OriginalBlob = Blob;
    class BackupBlob extends Blob {
      constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {
        super(blobParts, options);
        serializedBackup = String(blobParts?.[0] ?? "");
      }
    }
    vi.stubGlobal("Blob", BackupBlob);
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectUrlSpy = vi.fn(() => "blob:backup");
    const revokeObjectUrlSpy = vi.fn(() => undefined);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectUrlSpy,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectUrlSpy,
    });
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^config/i }));
    await screen.findByRole("region", { name: /configuracoes do sistema/i });
    await userEvent.click(screen.getByRole("button", { name: /exportar backup json/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return String(url).endsWith("/api/backups/export") && (init?.method ?? "GET") === "GET";
        }),
      ).toBe(true);
    });

    expect(serializedBackup).not.toBe("");

    const payload = JSON.parse(serializedBackup) as {
      transactions: TransactionSummary[];
      investment_movements: InvestmentMovementSummary[];
      report_summary: ReportSummary | null;
      invoices: InvoiceSummary[];
      selected_month: string;
    };

    expect(payload.selected_month).toBe("2026-03");
    expect(payload.transactions).toEqual(fullTransactions);
    expect(payload.investment_movements).toEqual(fullInvestmentMovements);
    expect(payload.report_summary).toEqual(fullReportSummary);
    expect(payload.invoices).toHaveLength(1);
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:backup");

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
    vi.stubGlobal("Blob", OriginalBlob);
    anchorClickSpy.mockRestore();
  });

  it("renders settings and resets the app in development mode", async () => {
    const fetchMock = installAppFetchMock();
    const confirmMock = vi.fn<(message?: string) => boolean>(() => true);
    vi.stubGlobal("confirm", confirmMock);

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^config/i }));
    await screen.findByRole("region", { name: /configuracoes do sistema/i });

    expect(
      await screen.findByRole("button", { name: /zona de perigo/i }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /zona de perigo/i }));
    expect(
      await screen.findByRole("heading", { name: /zerar aplicacao/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/limpa compras, transferencias e contas/i),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /apagar todos os dados/i }));

    expect(confirmMock).toHaveBeenCalledTimes(1);
    const confirmationMessage = String(confirmMock.mock.calls[0]?.[0] ?? "");
    expect(confirmationMessage).toMatch(/compras/i);
    expect(confirmationMessage).toMatch(/transferencias/i);
    expect(confirmationMessage).toMatch(/contas/i);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return String(url).endsWith("/api/dev/reset") && init?.method === "POST";
        }),
      ).toBe(true);
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: /vis/i }),
    ).toBeInTheDocument();
    expect((await screen.findAllByText("R$ 0,00")).length).toBeGreaterThan(0);
  });

  it("navigates from settings back to the account management workspace", async () => {
    installAppFetchMock();

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^config/i }));
    await screen.findByRole("region", { name: /configuracoes do sistema/i });

    await userEvent.click(screen.getByRole("button", { name: /gerenciar contas/i }));

    expect(await screen.findByRole("region", { name: /gerenciar contas/i })).toBeInTheDocument();
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












