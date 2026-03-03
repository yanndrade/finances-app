import { render, screen, waitFor } from "@testing-library/react";
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

describe("Movements panel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

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
              recent_transactions: [],
              spending_by_category: [],
              previous_month: { total_income: 0, total_expense: 0, net_flow: 0 },
              daily_balance_series: [],
              review_queue: [],
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
              ],
              spending_by_category: [{ category_id: "food", total: 3000 }],
              previous_month: { total_income: 0, total_expense: 0, net_flow: 0 },
              daily_balance_series: [{ date: "2026-03-03", balance: 2000 }],
              review_queue: [],
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
    await userEvent.click(screen.getByRole("button", { name: /^movimentar$/i }));

    await userEvent.type(screen.getByLabelText(/^Descrição$/i), "Dinner");
    await userEvent.type(screen.getByLabelText(/^Valor$/i), "10");
    await userEvent.type(screen.getByLabelText(/^Categoria$/i), "food");
    await userEvent.click(screen.getByRole("button", { name: /salvar saída/i }));
    await userEvent.click(screen.getByRole("button", { name: /^dashboard$/i }));

    expect((await screen.findAllByText("R$ 145,00")).length).toBeGreaterThan(0);
    expect(screen.getByText("Dinner")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(7);
    });
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
