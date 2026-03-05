import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../../App";
import { MovementsPanel } from "./movements-panel";

const ACCOUNTS = [
  {
    account_id: "acc-1",
    name: "Carteira principal",
    type: "wallet",
    initial_balance: 10000,
    is_active: true,
    current_balance: 15500,
  },
  {
    account_id: "acc-2",
    name: "Reserva",
    type: "savings",
    initial_balance: 5000,
    is_active: true,
    current_balance: 5000,
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

describe("Movements panel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits a new expense and refreshes the dashboard", async () => {
    let dashboardCallCount = 0;
    let accountsCallCount = 0;
    let transactionsCallCount = 0;

    const fetchMock = vi.fn<(typeof fetch)>().mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.includes("/api/cards") && method === "GET") {
        return Promise.resolve(new Response(JSON.stringify([])));
      }

      if (url.includes("/api/invoices") && method === "GET") {
        return Promise.resolve(new Response(JSON.stringify([])));
      }

      if (url.includes("/api/dashboard") && method === "GET") {
        dashboardCallCount += 1;

        return Promise.resolve(
          new Response(
            JSON.stringify(
              dashboardCallCount === 1
                ? {
                    month: "2026-03",
                    total_income: 5000,
                    total_expense: 2000,
                    net_flow: 3000,
                    current_balance: 15500,
                    recent_transactions: [],
                    spending_by_category: [],
                    previous_month: { total_income: 0, total_expense: 0, net_flow: 0 },
                    daily_balance_series: [],
                    review_queue: [],
                  }
                : {
                    month: "2026-03",
                    total_income: 5000,
                    total_expense: 3000,
                    net_flow: 2000,
                    current_balance: 14500,
                    recent_transactions: [
                      {
                        transaction_id: "tx-new",
                        occurred_at: "2026-03-03T12:00:00Z",
                        type: "expense",
                        amount: 1000,
                        account_id: "acc-1",
                        payment_method: "CASH",
                        category_id: "food",
                        description: "Dinner",
                        person_id: null,
                        status: "active",
                      },
                    ],
                    spending_by_category: [{ category_id: "food", total: 3000 }],
                    previous_month: { total_income: 0, total_expense: 0, net_flow: 0 },
                    daily_balance_series: [{ date: "2026-03-03", balance: 2000 }],
                    review_queue: [],
                  },
            ),
          ),
        );
      }

      if (url.includes("/api/accounts") && method === "GET") {
        accountsCallCount += 1;

        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                account_id: "acc-1",
                name: "Main Wallet",
                type: "wallet",
                initial_balance: 10000,
                is_active: true,
                current_balance: accountsCallCount === 1 ? 15500 : 14500,
              },
            ]),
          ),
        );
      }

      if (url.includes("/api/transactions") && method === "GET") {
        transactionsCallCount += 1;

        return Promise.resolve(
          new Response(
            JSON.stringify(
              transactionsCallCount === 1
                ? []
                : [
                    {
                      transaction_id: "tx-new",
                      occurred_at: "2026-03-03T12:00:00Z",
                      type: "expense",
                      amount: 1000,
                      account_id: "acc-1",
                      payment_method: "CASH",
                      category_id: "food",
                      description: "Dinner",
                      person_id: null,
                      status: "active",
                    },
                  ],
            ),
          ),
        );
      }

      if (url.includes("/api/investments/overview") && method === "GET") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              view: "monthly",
              from: "2026-03-01T00:00:00Z",
              to: "2026-03-31T23:59:59Z",
              totals: {
                contribution_total: 0,
                dividend_total: 0,
                withdrawal_total: 0,
                invested_balance: 0,
                cash_balance: 14500,
                wealth: 14500,
                dividends_accumulated: 0,
              },
              goal: {
                target: 500,
                realized: 0,
                remaining: 500,
                progress_percent: 0,
              },
              series: {
                wealth_evolution: [],
                contribution_dividend_trend: [],
              },
            }),
          ),
        );
      }

      if (url.includes("/api/investments/movements") && method === "GET") {
        return Promise.resolve(new Response(JSON.stringify([])));
      }

      if (url.includes("/api/expenses") && method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              transaction_id: "tx-new",
              occurred_at: "2026-03-03T12:00:00Z",
              type: "expense",
              amount: 1000,
              account_id: "acc-1",
              payment_method: "CASH",
              category_id: "food",
              description: "Dinner",
              person_id: null,
              status: "active",
            }),
            { status: 201 },
          ),
        );
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    installDialogEnvironment();

    render(<App />);

    await screen.findAllByText("R$ 155,00", undefined, { timeout: 5_000 });
    await userEvent.click(screen.getByRole("button", { name: /\+\s*lan.ar/i }));

    const dialog = await screen.findByRole("dialog", undefined, { timeout: 5_000 });
    await userEvent.type(within(dialog).getByPlaceholderText("0,00"), "10");
    await userEvent.type(within(dialog).getByLabelText(/^Descricao$/i), "Dinner");
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Categoria$/i), "food");
    await userEvent.click(within(dialog).getByRole("button", { name: /^lan.ar$/i }));

    expect((await screen.findAllByText("R$ 145,00")).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/expenses"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows one active mode at a time and defaults to saída", async () => {
    render(
      <MovementsPanel
        accounts={ACCOUNTS}
        isSubmitting={false}
        onSubmitTransaction={vi.fn(() => Promise.resolve())}
        onSubmitTransfer={vi.fn(() => Promise.resolve())}
      />,
    );

    expect(screen.getByRole("button", { name: "Saída" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText(/^Valor$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /salvar transferência/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Transferência" }));

    expect(screen.getByRole("button", { name: "Transferência" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText(/^Conta de origem$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /salvar saída/i }),
    ).not.toBeInTheDocument();
  });

  it("hydrates persisted defaults and submits in BRL cents", async () => {
    const onSubmitTransaction = vi.fn(() => Promise.resolve());
    const onSubmitTransfer = vi.fn(() => Promise.resolve());

    localStorage.setItem(
      "quick-entry-defaults",
      JSON.stringify({
        accountId: "acc-2",
        paymentMethod: "PIX",
        keepContext: true,
      }),
    );

    render(
      <MovementsPanel
        accounts={ACCOUNTS}
        isSubmitting={false}
        onSubmitTransaction={onSubmitTransaction}
        onSubmitTransfer={onSubmitTransfer}
      />,
    );

    expect(screen.getByLabelText(/^Conta$/i)).toHaveValue("acc-2");
    expect(screen.getByLabelText(/^Método$/i)).toHaveValue("PIX");
    expect(screen.getByLabelText(/salvar e adicionar outra/i)).toBeChecked();

    await userEvent.type(screen.getByLabelText(/^Descrição$/i), "Lunch");
    await userEvent.type(screen.getByLabelText(/^Valor$/i), "12");
    await userEvent.type(screen.getByLabelText(/^Categoria$/i), "food");
    await userEvent.click(screen.getByRole("button", { name: /salvar saída/i }));

    expect(onSubmitTransaction).toHaveBeenCalledWith({
      type: "expense",
      description: "Lunch",
      amountInCents: 1200,
      accountId: "acc-2",
      paymentMethod: "PIX",
      categoryId: "food",
      occurredAt: expect.stringMatching(/^20\d{2}-\d{2}-\d{2}T/),
    });

    expect(screen.getByLabelText(/^Descrição$/i)).toHaveValue("");
    expect(screen.getByLabelText(/^Categoria$/i)).toHaveValue("");
    expect(screen.getByLabelText(/^Conta$/i)).toHaveValue("acc-2");
  });

  it("blocks transfers with identical accounts and allows account inversion", async () => {
    const onSubmitTransfer = vi.fn(() => Promise.resolve());

    render(
      <MovementsPanel
        accounts={ACCOUNTS}
        isSubmitting={false}
        onSubmitTransaction={vi.fn(() => Promise.resolve())}
        onSubmitTransfer={onSubmitTransfer}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Transferência" }));
    await userEvent.selectOptions(screen.getByLabelText(/^Conta de destino$/i), "acc-1");

    expect(
      screen.getByText(/a conta de origem e a conta de destino devem ser diferentes/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /salvar transferência/i })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /inverter contas/i }));

    expect(screen.getByLabelText(/^Conta de origem$/i)).toHaveValue("acc-1");
    expect(screen.getByLabelText(/^Conta de destino$/i)).toHaveValue("acc-2");

    await userEvent.type(screen.getByLabelText(/^Valor$/i), "5");
    await userEvent.click(screen.getByRole("button", { name: /salvar transferência/i }));

    expect(onSubmitTransfer).toHaveBeenCalledWith({
      description: "",
      amountInCents: 500,
      fromAccountId: "acc-1",
      toAccountId: "acc-2",
      occurredAt: expect.stringMatching(/^20\d{2}-\d{2}-\d{2}T/),
    });
  });
});
