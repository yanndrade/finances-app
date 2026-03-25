import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { AccountSummary, CardSummary, MovementFilters } from "../../lib/api";

import { FilterPanel } from "./filter-panel";

const accounts: AccountSummary[] = [
  {
    account_id: "acc-1",
    name: "Carteira",
    type: "wallet",
    initial_balance: 0,
    is_active: true,
    current_balance: 0,
  },
];

const cards: CardSummary[] = [
  {
    card_id: "card-1",
    name: "Nubank",
    limit: 100_00,
    closing_day: 10,
    due_day: 20,
    payment_account_id: "acc-1",
    is_active: true,
    future_installment_total: 0,
  },
];

describe("FilterPanel", () => {
  it("keeps active filter values visible even when they are legacy or missing from default options", async () => {
    const user = userEvent.setup();
    const filters = {
      kind: "adjustment",
      origin_type: "imported",
      lifecycle_status: "active",
      payment_method: "CARD",
      account_id: "acc-legacy",
      card_id: "card-legacy",
      category_id: "custom-category",
    };

    render(
      <FilterPanel
        filters={filters as MovementFilters}
        accounts={accounts}
        cards={cards}
        onFiltersChange={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /filtros avancados/i }));

    expect(screen.getByRole("combobox", { name: "Tipo" })).toHaveTextContent("Ajuste");
    expect(screen.getByRole("combobox", { name: "Origem" })).toHaveTextContent("Importado");
    expect(screen.getByRole("combobox", { name: "Situacao" })).toHaveTextContent("Compensada");
    expect(screen.getByRole("combobox", { name: "Metodo" })).toHaveTextContent("Cartao");
    expect(screen.getByRole("combobox", { name: "Conta" })).toHaveTextContent("acc-legacy");
    expect(screen.getByRole("combobox", { name: "Cartao" })).toHaveTextContent("card-legacy");
    expect(screen.getByRole("combobox", { name: "Categoria" })).toHaveTextContent("Custom Category");
  });
});
