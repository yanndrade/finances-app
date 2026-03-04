import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TransactionsView } from "./transactions-view";

describe("TransactionsView copy", () => {
  it("shows localized payment and category labels instead of raw backend codes", async () => {
    render(
      <TransactionsView
        accounts={[
          {
            account_id: "acc-1",
            name: "Nubank",
            type: "checking",
            initial_balance: 100_000,
            is_active: true,
            current_balance: 100_000,
          },
        ]}
        filters={{
          from: "",
          to: "",
          category: "",
          account: "",
          method: "",
          person: "",
          text: "",
        }}
        isSubmitting={false}
        onApplyFilters={vi.fn(async () => undefined)}
        onUpdateTransaction={vi.fn(async () => undefined)}
        onVoidTransaction={vi.fn(async () => undefined)}
        transactions={[
          {
            transaction_id: "tx-1",
            occurred_at: "2026-03-03T12:00:00Z",
            type: "expense",
            amount: 5_000,
            account_id: "acc-1",
            payment_method: "CASH",
            category_id: "other",
            description: "Padaria",
            person_id: null,
            status: "active",
          },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /filtros avancados/i }));

    expect(screen.getByRole("option", { name: "Dinheiro" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Outro" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Outros" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Dinheiro" })).toBeInTheDocument();
    expect(screen.getByText("Efetivada")).toBeInTheDocument();
    expect(screen.queryByText("Ativa")).not.toBeInTheDocument();
  });

  it("uses shared category options when editing a transaction", async () => {
    render(
      <TransactionsView
        accounts={[
          {
            account_id: "acc-1",
            name: "Nubank",
            type: "checking",
            initial_balance: 100_000,
            is_active: true,
            current_balance: 100_000,
          },
        ]}
        filters={{
          from: "",
          to: "",
          category: "",
          account: "",
          method: "",
          person: "",
          text: "",
        }}
        isSubmitting={false}
        onApplyFilters={vi.fn(async () => undefined)}
        onUpdateTransaction={vi.fn(async () => undefined)}
        onVoidTransaction={vi.fn(async () => undefined)}
        transactions={[
          {
            transaction_id: "tx-1",
            occurred_at: "2026-03-03T12:00:00Z",
            type: "expense",
            amount: 5_000,
            account_id: "acc-1",
            payment_method: "CASH",
            category_id: "other",
            description: "Padaria",
            person_id: null,
            status: "active",
          },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /editar/i }));

    expect(screen.getByLabelText(/categoria da transacao/i).tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "Alimentação" })).toBeInTheDocument();
  });
});
