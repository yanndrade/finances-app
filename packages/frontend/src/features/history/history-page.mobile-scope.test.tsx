import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as api from "../../lib/api";
import { HistoryPage } from "./history-page";

const accounts: api.AccountSummary[] = [
  {
    account_id: "acc-1",
    name: "Conta principal",
    type: "checking",
    initial_balance: 0,
    is_active: true,
    current_balance: 0,
  },
];

const cards: api.CardSummary[] = [
  {
    card_id: "card-1",
    name: "Cartao Azul",
    limit: 100_000,
    closing_day: 10,
    due_day: 20,
    payment_account_id: "acc-1",
    is_active: true,
    future_installment_total: 0,
  },
];

describe("HistoryPage mobile scope behavior", () => {
  beforeEach(() => {
    vi.spyOn(api, "fetchMovements").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 50,
      pages: 1,
    });
    vi.spyOn(api, "fetchMovementsSummary").mockResolvedValue({
      total_income: 0,
      total_fixed: 0,
      total_installments: 0,
      total_variable: 0,
      total_investments: 0,
      total_reimbursements: 0,
      total_expenses: 0,
      total_result: 0,
      counts: {
        all: 0,
        fixed: 0,
        installments: 0,
        variable: 0,
        transfers: 0,
        investments: 0,
        reimbursements: 0,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears hidden scope filter when switching from desktop to mobile", async () => {
    const user = userEvent.setup();
    const fetchMovementsSpy = vi.mocked(api.fetchMovements);

    const { rerender } = render(
      <HistoryPage
        surface="desktop"
        accounts={accounts}
        cards={cards}
        month="2026-03"
      />,
    );

    await waitFor(() => {
      expect(fetchMovementsSpy).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("tab", { name: /fixos/i }));

    await waitFor(() => {
      const lastFilters = fetchMovementsSpy.mock.calls.at(-1)?.[0] as api.MovementFilters;
      expect(lastFilters.scope).toBe("fixed");
    });

    rerender(
      <HistoryPage
        surface="mobile"
        accounts={accounts}
        cards={cards}
        month="2026-03"
      />,
    );

    await waitFor(() => {
      const lastFilters = fetchMovementsSpy.mock.calls.at(-1)?.[0] as api.MovementFilters;
      expect(lastFilters.scope).toBeUndefined();
    });

    expect(screen.queryByRole("tab", { name: /fixos/i })).not.toBeInTheDocument();
  });
});
