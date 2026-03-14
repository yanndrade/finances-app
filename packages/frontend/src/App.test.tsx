import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "./App";
import type {
  AccountSummary,
  CardSummary,
  DashboardSummary,
  InvestmentMovementSummary,
  InvestmentOverview,
  InvoiceSummary,
  PendingExpenseSummary,
  RecurringRuleSummary,
  TransactionSummary,
} from "./lib/api";

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
    variable_expenses_total: 0,
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

function buildRecurringRule(
  overrides: Partial<RecurringRuleSummary> = {},
): RecurringRuleSummary {
  return {
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
    ...overrides,
  };
}

function buildPendingExpense(
  overrides: Partial<PendingExpenseSummary> = {},
): PendingExpenseSummary {
  return {
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
    ...overrides,
  };
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

function installViewportMatchMedia(matches: boolean) {
  const addListener = vi.fn();
  const removeListener = vi.fn();
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener,
      removeListener,
      addEventListener: addListener,
      removeEventListener: removeListener,
      dispatchEvent: vi.fn(() => false),
    })),
  );
}

function installAppFetchMock(initialState?: {
  accounts?: AccountSummary[];
  cards?: CardSummary[];
  transactions?: TransactionSummary[];
  recurringRules?: RecurringRuleSummary[];
  pendingExpenses?: PendingExpenseSummary[];
  dashboard?: DashboardSummary;
  investmentOverview?: InvestmentOverview;
  investmentMovements?: InvestmentMovementSummary[];
  invoices?: InvoiceSummary[];
  securityState?: {
    password_configured: boolean;
    is_locked: boolean;
    requires_lock_on_startup: boolean;
    inactivity_lock_seconds: number | null;
  };
}) {
  const state = {
    accounts: initialState?.accounts ?? [buildAccount()],
    cards: initialState?.cards ?? [buildCard()],
    transactions: initialState?.transactions ?? [buildTransaction()],
    recurringRules: initialState?.recurringRules ?? [],
    pendingExpenses: initialState?.pendingExpenses ?? [],
    investmentOverview: initialState?.investmentOverview ?? buildInvestmentOverview(),
    investmentMovements: initialState?.investmentMovements ?? [],
    invoices: initialState?.invoices ?? [buildInvoice()],
    dashboard:
      initialState?.dashboard ??
      buildDashboard({
        recent_transactions: initialState?.transactions ?? [buildTransaction()],
      }),
    securityState: initialState?.securityState ?? {
      password_configured: false,
      is_locked: false,
      requires_lock_on_startup: false,
      inactivity_lock_seconds: null,
    },
  };

  const originalFetch = globalThis.fetch;
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (!url.includes("/api/")) {
      return originalFetch(input, init);
    }

    if (url.includes("/api/dashboard") && method === "GET") {
      return new Response(JSON.stringify(state.dashboard));
    }

    if (url.includes("/api/movements/summary") && method === "GET") {
      return new Response(
        JSON.stringify({
          total_income: 0,
          total_fixed: 0,
          total_installments: 0,
          total_variable: 0,
          total_investments: 0,
          total_reimbursements: 0,
          total_expenses: 0,
          total_result: 0,
          counts: {
            all: 0,
            fixed: 0,
            installments: 0,
            variable: 0,
            transfers: 0,
            investments: 0,
            reimbursements: 0,
          },
        }),
      );
    }

    if (url.includes("/api/movements") && method === "GET") {
      return new Response(
        JSON.stringify({
          items: [],
          total: 0,
          page: 1,
          page_size: 50,
          pages: 1,
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

    if (url.includes("/api/recurring-rules") && method === "GET") {
      return new Response(JSON.stringify(state.recurringRules));
    }

    if (url.includes("/api/pendings") && method === "GET") {
      return new Response(JSON.stringify(state.pendingExpenses));
    }

    if (url.includes("/api/invoices") && method === "GET") {
      return new Response(JSON.stringify(state.invoices));
    }

    if (url.includes("/api/card-installments") && method === "GET") {
      return new Response(JSON.stringify([]));
    }

    if (url.includes("/api/invoices/") && url.endsWith("/items") && method === "GET") {
      return new Response(JSON.stringify([]));
    }

    if (url.includes("/api/transactions") && method === "GET") {
      return new Response(JSON.stringify(state.transactions));
    }

    if (url.includes("/api/security/state") && method === "GET") {
      return new Response(JSON.stringify(state.securityState));
    }

    if (url.includes("/api/security/password") && method === "POST") {
      state.securityState = {
        ...state.securityState,
        password_configured: true,
        is_locked: true,
        requires_lock_on_startup: true,
      };
      return new Response(null, { status: 204 });
    }

    if (url.includes("/api/security/lock") && method === "POST") {
      state.securityState = {
        ...state.securityState,
        is_locked: state.securityState.password_configured,
      };
      return new Response(null, { status: 204 });
    }

    if (url.includes("/api/security/unlock") && method === "POST") {
      state.securityState = {
        ...state.securityState,
        is_locked: false,
      };
      return new Response(JSON.stringify({ unlocked: true }));
    }

    if (url.includes("/api/accounts/") && method === "PATCH") {
      const accountId = url.split("/api/accounts/")[1];
      const payload = JSON.parse(String(init?.body)) as {
        name?: string;
        type?: string;
        initial_balance?: number;
        is_active?: boolean;
      };

      state.accounts = state.accounts.map((account) =>
        account.account_id === accountId
          ? {
              ...account,
              ...(payload.name !== undefined ? { name: payload.name } : {}),
              ...(payload.type !== undefined ? { type: payload.type } : {}),
              ...(payload.initial_balance !== undefined
                ? {
                    initial_balance: payload.initial_balance,
                    current_balance: payload.initial_balance,
                  }
                : {}),
              ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
            }
          : account,
      );

      return new Response(
        JSON.stringify(state.accounts.find((account) => account.account_id === accountId)),
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

      state.cards = state.cards.map((card) =>
        card.card_id === cardId
          ? {
              ...card,
              ...(payload.name !== undefined ? { name: payload.name } : {}),
              ...(payload.limit !== undefined ? { limit: payload.limit } : {}),
              ...(payload.closing_day !== undefined ? { closing_day: payload.closing_day } : {}),
              ...(payload.due_day !== undefined ? { due_day: payload.due_day } : {}),
              ...(payload.payment_account_id !== undefined
                ? { payment_account_id: payload.payment_account_id }
                : {}),
              ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
            }
          : card,
      );

      return new Response(JSON.stringify(state.cards.find((card) => card.card_id === cardId)));
    }

    if (url.includes("/api/pendings/") && url.endsWith("/confirm") && method === "POST") {
      const pendingId = decodeURIComponent(url.split("/api/pendings/")[1]?.replace("/confirm", "") ?? "");
      state.pendingExpenses = state.pendingExpenses.map((pending) =>
        pending.pending_id === pendingId
          ? {
              ...pending,
              status: "confirmed",
              transaction_id: `${pending.pending_id}:expense`,
            }
          : pending,
      );

      return new Response(
        JSON.stringify(state.pendingExpenses.find((pending) => pending.pending_id === pendingId)),
        { status: 201 },
      );
    }

    if (url.endsWith("/api/dev/reset") && method === "POST") {
      state.accounts = [];
      state.cards = [];
      state.transactions = [];
      state.recurringRules = [];
      state.pendingExpenses = [];
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

      return new Response(JSON.stringify({ status: "ok", message: "Application data reset." }));
    }

    return new Response(JSON.stringify([]));
  });

  return fetchMock;
}

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("navigates between dashboard, accounts and history", async () => {
    installAppFetchMock();

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: /vis/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lan/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^contas$/i }));
    expect(await screen.findByRole("region", { name: /contas e saldos/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /hist/i }));
    expect(await screen.findByRole("region", { name: /hist/i })).toBeInTheDocument();
  });

  it("shows a local network warning screen on mobile when API is unreachable", async () => {
    const originalFetch = globalThis.fetch;
    installViewportMatchMedia(true);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).includes("/api/")) {
        throw new TypeError("Failed to fetch");
      }
      return originalFetch(input, init);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /celular fora da rede do desktop/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it("keeps the desktop shell without a fixed contextual panel", async () => {
    installAppFetchMock();

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });

    expect(screen.queryByRole("heading", { name: /painel contextual/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/espaco reservado/i)).not.toBeInTheDocument();
  });

  it("shows the current investments workspace layout", async () => {
    installAppFetchMock();

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /patrim/i }));

    expect(await screen.findByRole("heading", { level: 1, name: /patrim/i })).toBeInTheDocument();
  });

  it("opens the global quick add dialog from the shell launcher", async () => {
    installAppFetchMock();
    installDialogEnvironment();

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /ctrl/i }));

    expect(await screen.findByRole("dialog", undefined, { timeout: 5_000 })).toBeInTheDocument();
  });

  it("opens command palette with the current navigation and action entries", async () => {
    installAppFetchMock({
      invoices: [buildInvoice()],
    });
    installDialogEnvironment();

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    const paletteDialog = await screen.findByRole("dialog", { name: /paleta/i });
    expect(within(paletteDialog).getByText(/registrar despesa/i)).toBeInTheDocument();
    expect(within(paletteDialog).getByText(/gastos fixos/i)).toBeInTheDocument();
  });

  it("removes an account from active operation from the accounts workspace", async () => {
    const fetchMock = installAppFetchMock({
      accounts: [
        buildAccount(),
        buildAccount({
          account_id: "acc-2",
          name: "Reserva secundaria",
          type: "wallet",
          initial_balance: 25_000,
          current_balance: 25_000,
        }),
      ],
    });
    const confirmMock = vi.fn<(message?: string) => boolean>(() => true);
    vi.stubGlobal("confirm", confirmMock);

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /^contas$/i }));

    const accountDeleteButtons = await screen.findAllByRole("button", { name: /excluir/i });
    await userEvent.click(accountDeleteButtons[0]);

    expect(confirmMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return (
            String(url).includes("/api/accounts/acc-1") &&
            init?.method === "PATCH" &&
            String(init?.body).includes('"is_active":false')
          );
        }),
      ).toBe(true);
    });
  });

  it("removes a card from active operation from the management sheet", async () => {
    const fetchMock = installAppFetchMock();
    const confirmMock = vi.fn<(message?: string) => boolean>(() => true);
    vi.stubGlobal("confirm", confirmMock);
    installDialogEnvironment();

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /cart/i }));
    await userEvent.click(await screen.findByRole("button", { name: /gerenciar cart/i }));
    await userEvent.click(screen.getByRole("button", { name: /desativar/i }));

    expect(confirmMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return (
            String(url).includes("/api/cards/card-1") &&
            init?.method === "PATCH" &&
            String(init?.body).includes('"is_active":false')
          );
        }),
      ).toBe(true);
    });
  });

  it("renders cards in aggregate mode and drills down to a specific card", async () => {
    installAppFetchMock({
      cards: [
        buildCard(),
        buildCard({
          card_id: "card-2",
          name: "Bradesco Platinum",
          payment_account_id: "acc-1",
        }),
      ],
      invoices: [
        buildInvoice(),
        buildInvoice({
          invoice_id: "card-2:2026-03",
          card_id: "card-2",
          reference_month: "2026-03",
          total_amount: 200_00,
          remaining_amount: 200_00,
          purchase_count: 2,
        }),
      ],
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /cart/i }));

    const scopeSelect = await screen.findByRole("combobox", { name: /escopo/i });
    expect(scopeSelect).toHaveTextContent(/todos os cart/i);
    expect(screen.getByText("Bradesco Platinum")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: /detalhes/i })[1]);

    expect(screen.getByRole("combobox", { name: /escopo/i })).toHaveTextContent(/bradesco platinum/i);
    expect(screen.getByRole("button", { name: /pagar fatura/i })).toBeInTheDocument();
  });

  it("renders settings with the new sections and resets app data", async () => {
    const fetchMock = installAppFetchMock();
    const confirmMock = vi.fn<(message?: string) => boolean>(() => true);
    vi.stubGlobal("confirm", confirmMock);

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(screen.getByRole("button", { name: /config/i }));

    expect(await screen.findByRole("heading", { name: /dados e backup/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /produtividade/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /zona de perigo/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /zerar tudo/i }));

    expect(confirmMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          return String(url).endsWith("/api/dev/reset") && init?.method === "POST";
        }),
      ).toBe(true);
    });
  });

  it("shows lock overlay and unlocks with password", async () => {
    installAppFetchMock({
      securityState: {
        password_configured: true,
        is_locked: true,
        requires_lock_on_startup: true,
        inactivity_lock_seconds: null,
      },
    });

    render(<App />);

    const passwordInput = await screen.findByLabelText(/senha de desbloqueio/i);
    await userEvent.type(passwordInput, "secret-123");
    await userEvent.click(screen.getByRole("button", { name: /desbloquear/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/senha de desbloqueio/i)).not.toBeInTheDocument();
    });
  });

  it("opens the fixed expenses workspace from the primary navigation", async () => {
    installAppFetchMock({
      recurringRules: [buildRecurringRule()],
      pendingExpenses: [buildPendingExpense()],
      dashboard: buildDashboard({
        monthly_fixed_expenses: [
          {
            pending_id: "rec-1:2026-03",
            rule_id: "rec-1",
            title: "Internet",
            category_id: "internet",
            amount: 120_00,
            due_date: "2026-03-10",
            status: "pending",
            account_id: "acc-1",
            card_id: null,
            payment_method: "PIX",
            transaction_id: null,
          },
        ],
      }),
    });

    render(<App />);

    await screen.findByRole("heading", { level: 1, name: /vis/i });
    await userEvent.click(
      within(screen.getByRole("navigation", { name: /principal/i })).getByRole("button", {
        name: /gastos fixos/i,
      }),
    );

    expect(await screen.findByRole("heading", { level: 1, name: /gastos fixos/i })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /ocorr/i })).toBeInTheDocument();
  });
});
