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
      categoryRules={overrides?.categoryRules ?? []}
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
      onDensityChange={overrides?.onDensityChange ?? vi.fn()}
      onUpsertCategoryRule={overrides?.onUpsertCategoryRule ?? vi.fn(() => true)}
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

    expect(screen.getByRole("option", { name: "Dinheiro" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Outro" })).toBeInTheDocument();
    expect(screen.getAllByRole("cell", { name: "Outros" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("cell", { name: "Dinheiro" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /pessoa.*reembolso/i })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Joao" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "--" })).toBeInTheDocument();
    expect(screen.getAllByText("Efetivada").length).toBeGreaterThan(0);
    expect(screen.queryByText("Ativa")).not.toBeInTheDocument();
  });

  it("uses shared category options when editing a transaction", async () => {
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
    expect(screen.getByRole("option", { name: "Alimentacao" })).toBeInTheDocument();
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

  it("supports splitting a transaction from the ledger drawer", async () => {
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
    ]);

    await userEvent.click(screen.getByText("Restaurante"));
    await userEvent.click(await screen.findByRole("button", { name: /iniciar split/i }));

    await userEvent.clear(screen.getByLabelText(/valor da divisao 1/i));
    await userEvent.type(screen.getByLabelText(/valor da divisao 1/i), "30");
    await userEvent.selectOptions(screen.getByLabelText(/categoria da divisao 2/i), "transport");
    await userEvent.clear(screen.getByLabelText(/valor da divisao 2/i));
    await userEvent.type(screen.getByLabelText(/valor da divisao 2/i), "20");
    await userEvent.click(screen.getByRole("button", { name: /salvar split/i }));

    expect(screen.getByRole("cell", { name: /dividida \(2\)/i })).toBeInTheDocument();
    expect(screen.getByText(/split salvo para esta transacao/i)).toBeInTheDocument();
  });

  it("creates an auto-categorization rule from the drawer and applies it to matching rows", async () => {
    const onUpsertCategoryRule = vi.fn(() => true);

    renderTransactionsView(
      [
        {
          transaction_id: "tx-1",
          occurred_at: "2026-03-03T12:00:00Z",
          type: "expense",
          amount: 5_000,
          account_id: "acc-1",
          payment_method: "PIX",
          category_id: "other",
          description: "Uber ida",
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
          category_id: "other",
          description: "Uber volta",
          person_id: null,
          status: "active",
        },
      ],
      {
        onUpsertCategoryRule,
        categoryRules: [{ id: "rule-1", pattern: "uber", categoryId: "transport" }],
      },
    );

    await userEvent.click(screen.getByText("Uber ida"));
    const patternInput = await screen.findByLabelText(/padrao da regra/i);
    await userEvent.clear(patternInput);
    await userEvent.type(patternInput, "uber");
    await userEvent.selectOptions(screen.getByLabelText(/categoria da regra/i), "transport");
    await userEvent.click(screen.getByRole("button", { name: /salvar regra/i }));

    expect(onUpsertCategoryRule).toHaveBeenCalledWith("uber", "transport");
    expect(await screen.findAllByText(/transporte \(regra\)/i)).toHaveLength(2);
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
    expect(within(investmentRow as HTMLTableRowElement).queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
    expect(within(investmentRow as HTMLTableRowElement).queryByRole("button", { name: /^estornar$/i })).not.toBeInTheDocument();
    expect(within(investmentRow as HTMLTableRowElement).getByText("Sem acoes")).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /tipo do filtro/i }),
      "investment",
    );
    expect(screen.getByText("Aporte mensal")).toBeInTheDocument();
    expect(screen.queryByText("Restaurante")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Aporte mensal"));
    expect(await screen.findAllByText("Conta principal")).not.toHaveLength(0);
    expect(screen.getAllByText("Patrimonio investido")).not.toHaveLength(0);
    expect(
      screen.getByText(/lancamento somente leitura\. edicao e estorno nao estao disponiveis\./i),
    ).toBeInTheDocument();
  });
});
