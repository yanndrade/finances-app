import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "./App";
import type {
  AccountSummary,
  CardSummary,
  DashboardSummary,
  InvestmentOverview,
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

function buildCard(overrides: Partial<CardSummary> = {}): CardSummary {
  return {
    card_id: "card-1",
    name: "Nubank",
    limit: 150_000,
    closing_day: 10,
    due_day: 20,
    payment_account_id: "acc-1",
    is_active: true,
    future_installment_total: 0,
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
    fixed_expenses_total: 35_000,
    installment_total: 12_500,
    invoices_due_total: 10_000,
    free_to_spend: 97_500,
    pending_reimbursements_total: 0,
    pending_reimbursements: [],
    monthly_commitments: [],
    monthly_fixed_expenses: [],
    monthly_installments: [],
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

function buildInvestmentOverview(overrides: Partial<InvestmentOverview> = {}): InvestmentOverview {
  return {
    view: "monthly",
    from: "2026-03-01T00:00:00Z",
    to: "2026-03-31T23:59:59Z",
    totals: {
      contribution_total: 0,
      dividend_total: 0,
      withdrawal_total: 0,
      invested_balance: 0,
      cash_balance: 132_500,
      wealth: 132_500,
      dividends_accumulated: 0,
    },
    goal: {
      target: 25_000,
      realized: 0,
      remaining: 25_000,
      progress_percent: 0,
    },
    series: {
      wealth_evolution: [],
      contribution_dividend_trend: [],
    },
    ...overrides,
  };
}

function installFetchMock(initialState?: {
  accounts?: AccountSummary[];
  cards?: CardSummary[];
  transactions?: TransactionSummary[];
  dashboard?: DashboardSummary;
  invoices?: InvoiceSummary[];
  investmentOverview?: InvestmentOverview;
}) {
  const state = {
    accounts: initialState?.accounts ?? [buildAccount()],
    cards: initialState?.cards ?? [buildCard()],
    transactions: initialState?.transactions ?? [buildTransaction()],
    invoices:
      initialState?.invoices ??
      [
        buildInvoice(),
        buildInvoice({
          invoice_id: "card-2:2026-03",
          card_id: "card-2",
          reference_month: "2026-03",
          total_amount: 200_00,
          remaining_amount: 140_00,
          paid_amount: 60_00,
          purchase_count: 3,
          status: "partial",
        }),
      ],
    dashboard: initialState?.dashboard ?? buildDashboard(),
    investmentOverview: initialState?.investmentOverview ?? buildInvestmentOverview(),
  };

  const fetchMock = vi.fn<(typeof fetch)>().mockImplementation(async (input) => {
    const url = String(input);

    if (url.includes("/api/dashboard")) {
      return new Response(JSON.stringify(state.dashboard));
    }

    if (url.includes("/api/accounts")) {
      return new Response(JSON.stringify(state.accounts));
    }

    if (url.includes("/api/cards")) {
      return new Response(JSON.stringify(state.cards));
    }

    if (url.includes("/api/invoices")) {
      return new Response(JSON.stringify(state.invoices));
    }

    if (url.includes("/api/transactions")) {
      return new Response(JSON.stringify(state.transactions));
    }

    if (url.includes("/api/investments/overview")) {
      return new Response(JSON.stringify(state.investmentOverview));
    }

    if (url.includes("/api/investments/movements")) {
      return new Response(JSON.stringify([]));
    }

    throw new Error(`Unexpected request: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

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

describe("UI consistency and cards overview", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses tighter shell copy and removes duplicate local headers", async () => {
    installFetchMock();
    installDialogEnvironment();

    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: /^vis.o geral$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/resumo mensal e pontos de atencao/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^contas$/i }));
    expect(
      await screen.findByRole("heading", { level: 1, name: /^contas$/i }, { timeout: 5_000 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole(
        "button",
        { name: /abrir configuracoes do sistema/i },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/mapa de contas/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^historico/i }));
    expect(await screen.findByRole("button", { name: /aplicar filtros/i })).toBeInTheDocument();
    expect(screen.queryByText(/hist.rico e filtros/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /\+\s*lan.ar/i }));
    expect(
      await screen.findByRole("dialog", undefined, { timeout: 5_000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  }, 15_000);

  it("opens cards in aggregate mode before drilling down to a specific card", async () => {
    installFetchMock({
      cards: [
        buildCard(),
        buildCard({
          card_id: "card-2",
          name: "Bradesco Platinum",
          payment_account_id: "acc-1",
        }),
      ],
    });

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /cart/i }));

    expect(
      await screen.findByLabelText(/escopo dos cartoes/i, undefined, { timeout: 5_000 }),
    ).toHaveValue("all");
    expect(screen.getByRole("tab", { name: /faturas/i })).toBeInTheDocument();
    expect(screen.getAllByText(/faturas abertas/i).length).toBeGreaterThan(0);
    const bradescoInvoice = screen.getByRole("button", { name: /bradesco platinum/i });
    expect(bradescoInvoice).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: /cart.es e ciclos/i })).not.toBeInTheDocument();

    await userEvent.click(bradescoInvoice);

    expect(screen.getByLabelText(/escopo dos cartoes/i)).toHaveValue("card-2");
    expect(screen.getByRole("button", { name: /pagar agora/i })).toBeInTheDocument();
  });
});
