import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../../App";

describe("Movements panel", () => {
  it("submits a new expense and refreshes the dashboard", async () => {
    const fetchMock = vi
      .fn<(typeof fetch)>()
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              month: "2026-03",
              total_income: 5000,
              total_expense: 2000,
              net_flow: 3000,
              current_balance: 15500,
              recent_transactions: []
            }),
          ),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
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
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(new Response(JSON.stringify([]))),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
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
              status: "active"
            }),
            { status: 201 },
          ),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
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
                  status: "active"
                }
              ]
            }),
          ),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(
            JSON.stringify([
              {
                account_id: "acc-1",
                name: "Main Wallet",
                type: "wallet",
                initial_balance: 10000,
                is_active: true,
                current_balance: 14500
              }
            ]),
          ),
        ),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(
            JSON.stringify([
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
                status: "active"
              }
            ]),
          ),
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await screen.findAllByText("R$ 155,00");

    await userEvent.type(screen.getByLabelText(/^descricao$/i), "Dinner");
    await userEvent.type(screen.getByLabelText(/^valor$/i), "10");
    await userEvent.selectOptions(screen.getByLabelText(/tipo/i), "expense");
    await userEvent.selectOptions(screen.getByLabelText(/^conta$/i), "acc-1");
    await userEvent.selectOptions(screen.getByLabelText(/metodo/i), "CASH");
    await userEvent.type(screen.getByLabelText(/categoria/i), "food");
    await userEvent.click(screen.getByRole("button", { name: /salvar transacao/i }));

    expect((await screen.findAllByText("R$ 145,00")).length).toBeGreaterThan(0);
    expect(screen.getByText("Dinner")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(7);
    });
  });
});
