import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../../App";

describe("Dashboard view", () => {
  it("loads the monthly summary and accounts on startup", async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn<(typeof fetch)>().mockImplementation((input, init) => {
      const url = String(input);

      if (!url.includes("/api/")) {
        return originalFetch(input, init);
      }

      if (url.includes("/api/dashboard")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              month: "2026-03",
              total_income: 5000,
              total_expense: 2000,
              net_flow: 3000,
              current_balance: 15500,
              fixed_expenses_total: 500,
              installment_total: 200,
              invoices_due_total: 750,
              free_to_spend: 2500,
              pending_reimbursements_total: 0,
              pending_reimbursements: [],
              monthly_commitments: [],
              monthly_fixed_expenses: [],
              monthly_installments: [],
              recent_transactions: [
                {
                  transaction_id: "tx-2",
                  occurred_at: "2026-03-02T12:02:00Z",
                  type: "expense",
                  amount: 2000,
                  account_id: "acc-1",
                  payment_method: "CASH",
                  category_id: "food",
                  description: "Lunch",
                  person_id: null,
                  status: "active"
                }
              ],
              spending_by_category: [
                { category_id: "food", total: 2000 }
              ],
              category_budgets: [],
              budget_alerts: [],
              previous_month: {
                total_income: 4000,
                total_expense: 1500,
                net_flow: 2500,
              },
              daily_balance_series: [
                { date: "2026-03-01", balance: 5000 },
                { date: "2026-03-02", balance: 3000 },
              ],
              review_queue: [],
            }),
          ),
        );
      }

      if (url.includes("/api/accounts")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                account_id: "acc-1",
                name: "Main Wallet",
                type: "wallet",
                initial_balance: 10000,
                is_active: true,
                current_balance: 15500
              }
            ]),
          ),
        );
      }

      if (url.includes("/api/cards")) {
        return Promise.resolve(new Response(JSON.stringify([])));
      }

      if (url.includes("/api/invoices")) {
        return Promise.resolve(new Response(JSON.stringify([])));
      }

      if (url.includes("/api/transactions")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                transaction_id: "tx-2",
                occurred_at: "2026-03-02T12:02:00Z",
                type: "expense",
                amount: 2000,
                account_id: "acc-1",
                payment_method: "CASH",
                category_id: "food",
                description: "Lunch",
                person_id: null,
                status: "active"
              }
            ]),
          ),
        );
      }

      if (url.includes("/api/investments/overview")) {
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
                cash_balance: 15500,
                wealth: 15500,
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

      if (url.includes("/api/investments/movements")) {
        return Promise.resolve(new Response(JSON.stringify([])));
      }

      return Promise.resolve(new Response(JSON.stringify([])));
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(
      await screen.findByText(/Entradas/i, undefined, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/20,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/5,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/alimenta/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/raio-x de despesas/i)).toBeInTheDocument();
    expect(screen.getByText(/próximos compromissos/i)).toBeInTheDocument();

    expect(screen.getByText(/tudo em dia/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(7);
    });
  }, 15_000);
});
