import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as api from "../../lib/api";
import { ReimbursementsView } from "./reimbursements-view";

function installDialogEnvironment() {
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })),
  );
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: vi.fn(() => false),
  });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
}

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
    name: "Bradesco Visa Platinum - Duda",
    limit: 0,
    closing_day: 10,
    due_day: 20,
    payment_account_id: "acc-1",
    is_active: true,
    future_installment_total: 0,
  },
];

const reimbursements: api.PendingReimbursementSummary[] = [
  {
    transaction_id: "tx-1",
    person_id: "Joao",
    amount: 12_000,
    amount_received: 0,
    status: "pending",
    account_id: "acc-1",
    occurred_at: "2026-03-10T10:00:00Z",
    expected_at: "2026-03-15",
    received_at: null,
    receipt_transaction_id: null,
    notes: null,
    source_transaction_id: "purchase-1",
    source_title: "CASA PIO (total 3 parcelas)",
    source_description: "CASA PIO (total 3 parcelas)",
    source_card_id: "card-1",
    source_purchase_date: "2026-03-01T09:00:00Z",
    source_installment_number: 1,
    source_installment_total: 3,
  },
];

describe("ReimbursementsView", () => {
  beforeEach(() => {
    installDialogEnvironment();
    vi.spyOn(api, "listReimbursements").mockResolvedValue(reimbursements);
    vi.spyOn(api, "getReimbursementsSummary").mockResolvedValue({
      total_outstanding: 12_000,
      received_in_month: 0,
      expiring_soon_count: 1,
      expiring_soon_total: 12_000,
      overdue_count: 0,
      overdue_total: 0,
    });
    vi.spyOn(api, "markReimbursementReceived").mockResolvedValue({
      ...reimbursements[0],
      status: "received",
      amount_received: 12_000,
      received_at: "2026-03-12T12:00:00Z",
      receipt_transaction_id: "tx-receipt-1",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders mobile essential flow: list + receive action without edit/cancel actions", async () => {
    const user = userEvent.setup();

    render(
      <ReimbursementsView
        surface="mobile"
        accounts={accounts}
        cards={cards}
        month="2026-03"
      />,
    );

    expect(await screen.findByText("Joao")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /joao/i }));

    expect(await screen.findByRole("button", { name: /registrar recebimento/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^cancelar$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /registrar recebimento/i }));
    expect(await screen.findByRole("heading", { name: /registrar recebimento/i })).toBeInTheDocument();
  });

  it("keeps edit and cancel actions on desktop surface", async () => {
    const user = userEvent.setup();

    render(
      <ReimbursementsView
        surface="desktop"
        accounts={accounts}
        cards={cards}
        month="2026-03"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Joao")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /joao/i }));

    expect(await screen.findByRole("button", { name: /^editar$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancelar$/i })).toBeInTheDocument();
  });

  it("shows related purchase details inside the reimbursement drawer", async () => {
    const user = userEvent.setup();

    render(
      <ReimbursementsView
        surface="desktop"
        accounts={accounts}
        cards={cards}
        month="2026-03"
      />,
    );

    expect(await screen.findByText("Joao")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /joao/i }));

    expect(await screen.findByText(/compra relacionada/i)).toBeInTheDocument();
    expect(screen.getByText(/casa pio/i)).toBeInTheDocument();
    expect(screen.getByText(/bradesco visa platinum - duda/i)).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getByText(/01\/03\/2026/i)).toBeInTheDocument();
  });

  it("opens the history filtered to the related purchase", async () => {
    const user = userEvent.setup();
    const onOpenLedgerFiltered = vi.fn();

    render(
      <ReimbursementsView
        surface="desktop"
        accounts={accounts}
        cards={cards}
        month="2026-04"
        onOpenLedgerFiltered={onOpenLedgerFiltered}
      />,
    );

    expect(await screen.findByText("Joao")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /joao/i }));
    await user.click(screen.getByRole("button", { name: /abrir no historico/i }));

    expect(onOpenLedgerFiltered).toHaveBeenCalledWith(
      {
        period: "month",
        text: "purchase-1",
        card: "card-1",
      },
      "2026-03",
    );
  });
});
