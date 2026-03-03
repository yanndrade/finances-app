import { render, screen, waitFor } from "@testing-library/react";

import { App } from "../../App";

describe("Dashboard view", () => {
  it("loads the monthly summary and accounts on startup", async () => {
    const fetchMock = vi.fn<(typeof fetch)>().mockImplementation((input) => {
      const url = String(input);

      if (url.includes("/api/dashboard")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              month: "2026-03",
              total_income: 5000,
              total_expense: 2000,
              net_flow: 3000,
              current_balance: 15500,
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

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect((await screen.findAllByText("R$ 155,00")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 50,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 20,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Main Wallet").length).toBeGreaterThan(0);
    expect(screen.getByText("Lunch")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });
});
