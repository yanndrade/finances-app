import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TransactionsView } from "./transactions-view";

const defaultAccount = {
  account_id: "acc-1",
  name: "Conta principal",
  type: "checking",
  initial_balance: 100_000,
  is_active: true,
  current_balance: 100_000,
} as const;

function renderTransactionsView(
  transactions: Array<{
    transaction_id: string;
    occurred_at: string;
    type: string;
    amount: number;
    account_id: string;
    payment_method: string;
    category_id: string;
    description: string | null;
    person_id: string | null;
    status: string;
    ledger_event_type?: string;
    ledger_source?: string;
    ledger_destination?: string;
  }>,
  overrides?: Partial<Parameters<typeof TransactionsView>[0]>,
) {
  render(
    <TransactionsView
      accounts={overrides?.accounts ?? [defaultAccount]}
      cards={overrides?.cards ?? []}
      filters={
        overrides?.filters ?? {
          from: "",
          to: "",
          category: "",
          account: "",
          card: "",
          method: "",
          person: "",
          text: "",
        }
      }
      isSubmitting={overrides?.isSubmitting ?? false}
      onApplyFilters={overrides?.onApplyFilters ?? vi.fn(async () => undefined)}
      onUpdateTransaction={overrides?.onUpdateTransaction ?? vi.fn(async () => undefined)}
      onVoidTransaction={overrides?.onVoidTransaction ?? vi.fn(async () => undefined)}
      transactions={transactions}
      uiDensity={overrides?.uiDensity ?? "compact"}
    />,
  );
}

describe("TransactionsView copy", () => {
  it("shows localized payment and category labels instead of raw backend codes", async () => {
    renderTransactionsView([
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
      {
        transaction_id: "tx-2",
        occurred_at: "2026-03-02T12:00:00Z",
        type: "expense",
        amount: 3_000,
        account_id: "acc-1",
        payment_method: "PIX",
        category_id: "transport",
        description: "Taxi",
        person_id: "Joao",
        status: "active",
      },
    ]);

    await userEvent.click(screen.getByRole("button", { name: /mostrar filtros avancados/i }));

    expect(screen.getByRole("option", { name: "Dinheiro" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Outro" })).toBeInTheDocument();
    expect(screen.getAllByRole("cell", { name: "Outros" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("cell", { name: "Dinheiro" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /pessoa/i })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Joao" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "--" })).toBeInTheDocument();
    expect(screen.getAllByText("Efetivada").length).toBeGreaterThan(0);
    expect(screen.queryByText("Ativa")).not.toBeInTheDocument();
  });

  it("keeps the current transaction category available while editing", async () => {
    renderTransactionsView([
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
    ]);

    await userEvent.click(screen.getByRole("button", { name: /editar/i }));

    expect(screen.getByLabelText(/categoria da transacao/i).tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "Outros" })).toBeInTheDocument();
  });

  it("supports sortable ledger columns for value in both directions", async () => {
    renderTransactionsView([
      {
        transaction_id: "tx-salary",
        occurred_at: "2026-03-05T12:00:00Z",
        type: "income",
        amount: 15_000,
        account_id: "acc-1",
        payment_method: "PIX",
        category_id: "salary",
        description: "Salario",
        person_id: null,
        status: "active",
      },
      {
        transaction_id: "tx-market",
        occurred_at: "2026-03-04T12:00:00Z",
        type: "expense",
        amount: 4_000,
        account_id: "acc-1",
        payment_method: "CASH",
        category_id: "food",
        description: "Mercado",
        person_id: null,
        status: "active",
      },
      {
        transaction_id: "tx-bill",
        occurred_at: "2026-03-03T12:00:00Z",
        type: "expense",
        amount: 8_000,
        account_id: "acc-1",
        payment_method: "OTHER",
        category_id: "utilities",
        description: "Conta de luz",
        person_id: null,
        status: "active",
      },
    ]);

    const getDescriptionsInOrder = () => {
      const rows = screen.getAllByRole("row").slice(1);
      return rows.map((row) => within(row).getAllByRole("cell")[1]?.textContent);
    };

    await userEvent.click(screen.getByRole("button", { name: /ordenar por valor/i }));
    expect(getDescriptionsInOrder()).toEqual(["Salario", "Conta de luz", "Mercado"]);

    await userEvent.click(screen.getByRole("button", { name: /ordenar por valor/i }));
    expect(getDescriptionsInOrder()).toEqual(["Mercado", "Conta de luz", "Salario"]);
  });

  it("shows investment ledger labels and allows filtering by investment type", async () => {
    renderTransactionsView([
      {
        transaction_id: "tx-1",
        occurred_at: "2026-03-03T12:00:00Z",
        type: "expense",
        amount: 5_000,
        account_id: "acc-1",
        payment_method: "CASH",
        category_id: "food",
        description: "Restaurante",
        person_id: null,
        status: "active",
      },
      {
        transaction_id: "inv-1:investment",
        occurred_at: "2026-03-04T12:00:00Z",
        type: "investment",
        amount: 4_000,
        account_id: "acc-1",
        payment_method: "OTHER",
        category_id: "investment_contribution",
        description: "Aporte mensal",
        person_id: null,
        status: "readonly",
        ledger_event_type: "investment_contribution",
        ledger_source: "account:acc-1",
        ledger_destination: "investment_asset:acc-1",
      },
    ]);

    expect(screen.getByRole("cell", { name: "Investimento" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Somente leitura" })).toBeInTheDocument();
    const investmentRow = screen.getByText("Aporte mensal").closest("tr");
    expect(investmentRow).not.toBeNull();
    expect(
      within(investmentRow as HTMLTableRowElement).queryByRole("button", { name: /^editar$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(investmentRow as HTMLTableRowElement).queryByRole("button", { name: /^estornar$/i }),
    ).not.toBeInTheDocument();
    expect(within(investmentRow as HTMLTableRowElement).getByText("Sem acoes")).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /tipo do filtro/i }),
      "investment",
    );
    expect(screen.getByText("Aporte mensal")).toBeInTheDocument();
    expect(screen.queryByText("Restaurante")).not.toBeInTheDocument();
  });

  it("filters parcelled card expenses through the installment preset", async () => {
    renderTransactionsView([
      {
        transaction_id: "purchase-1:1:card-installment",
        occurred_at: "2026-03-10T12:00:00Z",
        type: "expense",
        amount: 3_000,
        account_id: "acc-1",
        payment_method: "OTHER",
        category_id: "electronics",
        description: "Notebook - Parcela 1/3",
        person_id: null,
        status: "readonly",
        ledger_event_type: "card_installment",
        ledger_source: "card_liability:card-1",
        ledger_destination: "category:electronics",
      },
      {
        transaction_id: "tx-market",
        occurred_at: "2026-03-04T12:00:00Z",
        type: "expense",
        amount: 2_000,
        account_id: "acc-1",
        payment_method: "CASH",
        category_id: "food",
        description: "Mercado",
        person_id: null,
        status: "active",
      },
    ]);

    await userEvent.click(screen.getByRole("button", { name: /parcelas do mes/i }));

    expect(screen.getByText(/notebook - parcela 1\/3/i)).toBeInTheDocument();
    expect(screen.queryByText("Mercado")).not.toBeInTheDocument();
  });
});
