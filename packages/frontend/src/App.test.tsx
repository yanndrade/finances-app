import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "./App";
import type { AccountSummary, DashboardSummary, TransactionSummary } from "./lib/api";

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

function installAppFetchMock(initialState?: {
  accounts?: AccountSummary[];
  transactions?: TransactionSummary[];
  dashboard?: DashboardSummary;
}) {
  const state = {
    accounts: initialState?.accounts ?? [buildAccount()],
    transactions: initialState?.transactions ?? [buildTransaction()],
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

    if (url.includes("/api/transactions") && method === "GET") {
      return new Response(JSON.stringify(state.transactions));
    }

    if (url.endsWith("/api/dev/reset") && method === "POST") {
      state.accounts = [];
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
