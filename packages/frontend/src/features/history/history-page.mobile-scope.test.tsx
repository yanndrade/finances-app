import { render, screen, waitFor, within } from "@testing-library/react";
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

function buildMovement(
  movementId: string,
  title: string,
  overrides: Partial<api.UnifiedMovement> = {},
): api.UnifiedMovement {
  return {
    movement_id: movementId,
    kind: "expense",
    origin_type: "manual",
    title,
    description: title,
    amount: 10_00,
    posted_at: "2026-03-10T00:00:00Z",
    competence_month: "2026-03",
    account_id: "acc-1",
    card_id: null,
    payment_method: "PIX",
    category_id: "food",
    counterparty: null,
    lifecycle_status: "cleared",
    edit_policy: "editable",
    parent_id: null,
    group_id: null,
    transfer_direction: null,
    installment_number: null,
    installment_total: null,
    source_event_type: "TransactionAdded",
    ...overrides,
  };
}

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
    vi.spyOn(api, "fetchCardPurchases").mockResolvedValue([]);
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

  it("applies initial filters coming from app navigation", async () => {
    const fetchMovementsSpy = vi.mocked(api.fetchMovements);

    render(
      <HistoryPage
        surface="desktop"
        accounts={accounts}
        cards={cards}
        month="2026-03"
        initialFilters={{
          preset: "fixed",
          text: "internet",
          account: "acc-1",
          method: "PIX",
        }}
      />,
    );

    await waitFor(() => {
      expect(fetchMovementsSpy).toHaveBeenCalled();
    });

    const lastFilters = fetchMovementsSpy.mock.calls.at(-1)?.[0] as api.MovementFilters;
    expect(lastFilters.scope).toBe("fixed");
    expect(lastFilters.text).toBe("internet");
    expect(lastFilters.account_id).toBe("acc-1");
    expect(lastFilters.payment_method).toBe("PIX");
  });

  it("navigates between pages and resets to the first page after a new search", async () => {
    const user = userEvent.setup();
    const fetchMovementsSpy = vi
      .mocked(api.fetchMovements)
      .mockImplementation(async (filters) => {
        if (filters?.page === 2) {
          return {
            items: [buildMovement("movement-page-2", "Lote 2")],
            total: 55,
            page: 2,
            page_size: 50,
            pages: 2,
          };
        }

        return {
          items: [
            buildMovement(
              filters?.text === "mercado" ? "movement-search" : "movement-page-1",
              filters?.text === "mercado" ? "Mercado" : "Lote 1",
            ),
          ],
          total: 55,
          page: 1,
          page_size: 50,
          pages: 2,
        };
      });

    render(
      <HistoryPage
        surface="desktop"
        accounts={accounts}
        cards={cards}
        month="2026-03"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/pagina 1 de 2/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /anterior/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /proxima/i }));

    await waitFor(() => {
      const lastFilters = fetchMovementsSpy.mock.calls.at(-1)?.[0] as api.MovementFilters;
      expect(lastFilters.page).toBe(2);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /lote 2/i })).toBeInTheDocument();
      expect(screen.getByText(/pagina 2 de 2/i)).toBeInTheDocument();
    });

    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "mercado");

    await waitFor(() => {
      const lastFilters = fetchMovementsSpy.mock.calls.at(-1)?.[0] as api.MovementFilters;
      expect(lastFilters.page).toBe(1);
      expect(lastFilters.text).toBe("mercado");
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /mercado/i })).toBeInTheDocument();
      expect(screen.getByText(/pagina 1 de 2/i)).toBeInTheDocument();
    });
  });

  it("marks recurring forecast movements as paid from the drawer", async () => {
    const user = userEvent.setup();
    const onConfirmPending = vi.fn<(pendingId: string) => Promise<void>>().mockResolvedValue();

    vi.mocked(api.fetchMovements).mockResolvedValue({
      items: [
        {
          movement_id: "rule-rent:2026-03",
          kind: "expense",
          origin_type: "recurring",
          title: "Internet",
          description: "Fibra",
          amount: 120_00,
          posted_at: "2026-03-10T00:00:00Z",
          competence_month: "2026-03",
          account_id: "acc-1",
          card_id: null,
          payment_method: "PIX",
          category_id: "internet",
          counterparty: null,
          lifecycle_status: "forecast",
          edit_policy: "inherited",
          parent_id: null,
          group_id: "rec-1",
          transfer_direction: null,
          installment_number: null,
          installment_total: null,
          source_event_type: "RecurringRuleCreated",
        },
      ],
      total: 1,
      page: 1,
      page_size: 50,
      pages: 1,
    });

    render(
      <HistoryPage
        surface="desktop"
        accounts={accounts}
        cards={cards}
        month="2026-03"
        onConfirmPending={onConfirmPending}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /internet/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /internet/i }));
    await user.click(screen.getByRole("button", { name: /marcar como pago/i }));

    expect(onConfirmPending).toHaveBeenCalledWith("rule-rent:2026-03");
  });

  it("shows the 'Debito em' column only for card purchases in desktop history", async () => {
    vi.mocked(api.fetchMovements).mockResolvedValue({
      items: [
        buildMovement("purchase-1:1", "Notebook", {
          origin_type: "card_purchase",
          posted_at: "2026-03-25T00:00:00Z",
          competence_month: "2026-04",
          card_id: "card-1",
          payment_method: "CREDIT_CASH",
          source_event_type: "CardPurchaseCreated",
        }),
        buildMovement("tx-1", "Mercado"),
      ],
      total: 2,
      page: 1,
      page_size: 50,
      pages: 1,
    });

    render(
      <HistoryPage
        surface="desktop"
        accounts={accounts}
        cards={cards}
        month="2026-03"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/debito em/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /notebook/i })).toBeInTheDocument();
    });

    expect(screen.getAllByText(/abril de 2026/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/março de 2026/i)).not.toBeInTheDocument();
  });

  it("shows debit month for card purchases inside the drawer", async () => {
    const user = userEvent.setup();

    vi.mocked(api.fetchMovements).mockResolvedValue({
      items: [
        buildMovement("purchase-1:1", "Notebook", {
          origin_type: "card_purchase",
          posted_at: "2026-03-25T00:00:00Z",
          competence_month: "2026-04",
          card_id: "card-1",
          payment_method: "CREDIT_CASH",
          source_event_type: "CardPurchaseCreated",
        }),
      ],
      total: 1,
      page: 1,
      page_size: 50,
      pages: 1,
    });

    render(
      <HistoryPage
        surface="desktop"
        accounts={accounts}
        cards={cards}
        month="2026-03"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /notebook/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /notebook/i }));

    expect(screen.getByText(/débito em/i)).toBeInTheDocument();
    expect(screen.getAllByText(/abril de 2026/i).length).toBeGreaterThan(0);
  });

  it("allows editing a card purchase from the history drawer", async () => {
    const user = userEvent.setup();
    const onUpdateCardPurchase = vi
      .fn<(purchaseId: string, payload: api.CardPurchaseUpdatePayload) => Promise<void>>()
      .mockResolvedValue();

    vi.mocked(api.fetchMovements).mockResolvedValue({
      items: [
        {
          movement_id: "purchase-1:1",
          kind: "expense",
          origin_type: "installment",
          title: "Notebook - Parcela 1/3",
          description: "Notebook",
          amount: 300_00,
          posted_at: "2026-03-20T00:00:00Z",
          competence_month: "2026-03",
          account_id: "acc-1",
          card_id: "card-1",
          payment_method: "CREDIT_INSTALLMENT",
          category_id: "electronics",
          counterparty: "empresa",
          lifecycle_status: "pending",
          edit_policy: "locked",
          parent_id: "purchase-1",
          group_id: null,
          transfer_direction: null,
          installment_number: 1,
          installment_total: 3,
          source_event_type: "CardPurchaseCreated",
        },
      ],
      total: 1,
      page: 1,
      page_size: 50,
      pages: 1,
    });
    vi.mocked(api.fetchCardPurchases).mockResolvedValue([
      {
        purchase_id: "purchase-1",
        purchase_date: "2026-03-10T14:30:00Z",
        amount: 900_00,
        category_id: "electronics",
        card_id: "card-1",
        description: "Notebook",
        installments_count: 3,
        invoice_id: "card-1:2026-03",
        reference_month: "2026-03",
        closing_date: "2026-03-10",
        due_date: "2026-03-20",
      },
    ]);

    render(
      <HistoryPage
        surface="desktop"
        accounts={accounts}
        cards={[
          ...cards,
          {
            card_id: "card-2",
            name: "Cartao Verde",
            limit: 80_000,
            closing_day: 15,
            due_day: 25,
            payment_account_id: "acc-1",
            is_active: true,
            future_installment_total: 0,
          },
        ]}
        month="2026-03"
        onUpdateCardPurchase={onUpdateCardPurchase}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /notebook - parcela 1\/3/i }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /notebook - parcela 1\/3/i }),
    );
    await user.click(screen.getByRole("button", { name: /^editar$/i }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByLabelText(/valor total/i)).toHaveValue(900);
    });
    await user.clear(within(dialog).getByLabelText(/valor total/i));
    await user.type(within(dialog).getByLabelText(/valor total/i), "1200");
    await user.clear(within(dialog).getByLabelText(/^parcelas$/i));
    await user.type(within(dialog).getByLabelText(/^parcelas$/i), "4");
    await user.clear(within(dialog).getByLabelText(/^pessoa$/i));
    await user.type(within(dialog).getByLabelText(/^pessoa$/i), "cliente");
    await user.selectOptions(within(dialog).getByLabelText(/cartão da compra/i), "card-2");
    await user.click(within(dialog).getByRole("button", { name: /salvar altera/i }));

    expect(onUpdateCardPurchase).toHaveBeenCalledWith("purchase-1", {
      purchaseDate: "2026-03-10T14:30:00Z",
      amountInCents: 1200_00,
      installmentsCount: 4,
      categoryId: "electronics",
      cardId: "card-2",
      description: "Notebook",
      personId: "cliente",
    });
  });

  it("allows updating only the related person on a card purchase", async () => {
    const user = userEvent.setup();
    const onUpdateCardPurchase = vi
      .fn<(purchaseId: string, payload: api.CardPurchaseUpdatePayload) => Promise<void>>()
      .mockResolvedValue();

    vi.mocked(api.fetchMovements).mockResolvedValue({
      items: [
        {
          movement_id: "purchase-1:1",
          kind: "expense",
          origin_type: "card_purchase",
          title: "Lunch",
          description: "Lunch",
          amount: 90_00,
          posted_at: "2026-03-02T12:00:00Z",
          competence_month: "2026-03",
          account_id: "acc-1",
          card_id: "card-1",
          payment_method: "CREDIT_CASH",
          category_id: "food",
          counterparty: null,
          lifecycle_status: "pending",
          edit_policy: "locked",
          parent_id: "purchase-1",
          group_id: null,
          transfer_direction: null,
          installment_number: null,
          installment_total: null,
          source_event_type: "CardPurchaseCreated",
        },
      ],
      total: 1,
      page: 1,
      page_size: 50,
      pages: 1,
    });
    vi.mocked(api.fetchCardPurchases).mockResolvedValue([
      {
        purchase_id: "purchase-1",
        purchase_date: "2026-03-02T12:00:00Z",
        amount: 90_00,
        category_id: "food",
        card_id: "card-1",
        description: "Lunch",
        installments_count: 1,
        invoice_id: "card-1:2026-03",
        reference_month: "2026-03",
        closing_date: "2026-03-10",
        due_date: "2026-03-20",
      },
    ]);

    render(
      <HistoryPage
        surface="desktop"
        accounts={accounts}
        cards={cards}
        month="2026-03"
        onUpdateCardPurchase={onUpdateCardPurchase}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /lunch/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /lunch/i }));
    await user.click(screen.getByRole("button", { name: /^editar$/i }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText(/^pessoa$/i), "cliente");
    await user.click(within(dialog).getByRole("button", { name: /salvar altera/i }));

    expect(onUpdateCardPurchase).toHaveBeenCalledWith("purchase-1", {
      purchaseDate: "2026-03-02T12:00:00Z",
      amountInCents: 90_00,
      installmentsCount: 1,
      categoryId: "food",
      cardId: "card-1",
      description: "Lunch",
      personId: "cliente",
    });
  });

  it("voids a card purchase from the history drawer", async () => {
    const user = userEvent.setup();
    const onVoidCardPurchase = vi
      .fn<(purchaseId: string) => Promise<void>>()
      .mockResolvedValue();

    vi.mocked(api.fetchMovements).mockResolvedValue({
      items: [
        {
          movement_id: "purchase-1:1",
          kind: "expense",
          origin_type: "card_purchase",
          title: "Notebook",
          description: "Notebook",
          amount: 900_00,
          posted_at: "2026-03-20T00:00:00Z",
          competence_month: "2026-03",
          account_id: "acc-1",
          card_id: "card-1",
          payment_method: "CREDIT_CASH",
          category_id: "electronics",
          counterparty: null,
          lifecycle_status: "pending",
          edit_policy: "locked",
          parent_id: "purchase-1",
          group_id: null,
          transfer_direction: null,
          installment_number: null,
          installment_total: null,
          source_event_type: "CardPurchaseCreated",
        },
      ],
      total: 1,
      page: 1,
      page_size: 50,
      pages: 1,
    });

    render(
      <HistoryPage
        surface="desktop"
        accounts={accounts}
        cards={cards}
        month="2026-03"
        onVoidCardPurchase={onVoidCardPurchase}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /notebook/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /notebook/i }));
    await user.click(screen.getByRole("button", { name: /estornar/i }));

    expect(onVoidCardPurchase).toHaveBeenCalledWith("purchase-1");
  });
});
