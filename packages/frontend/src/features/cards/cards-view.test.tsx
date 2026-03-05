import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as api from "../../lib/api";
import { CardsView } from "./cards-view";

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

describe("CardsView", () => {
  beforeEach(() => {
    installDialogEnvironment();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows invoice item loading errors instead of silently hiding them", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "fetchInvoiceItems").mockRejectedValue(new Error("network"));

    render(
      <CardsView
        accounts={[
          {
            account_id: "acc-1",
            name: "Conta principal",
            type: "checking",
            initial_balance: 0,
            is_active: true,
            current_balance: 0,
          },
        ]}
        cards={[
          {
            card_id: "card-1",
            name: "Cartao Azul",
            limit: 100_000,
            closing_day: 10,
            due_day: 20,
            payment_account_id: "acc-1",
            is_active: true,
          },
        ]}
        invoices={[
          {
            invoice_id: "card-1:2026-03",
            card_id: "card-1",
            reference_month: "2026-03",
            closing_date: "2026-03-10",
            due_date: "2026-03-20",
            total_amount: 90_00,
            paid_amount: 20_00,
            remaining_amount: 70_00,
            purchase_count: 3,
            status: "open",
          },
        ]}
        isSubmitting={false}
        onCreateCard={vi.fn(() => Promise.resolve())}
        onCreateCardPurchase={vi.fn(() => Promise.resolve())}
        onPayInvoice={vi.fn(() => Promise.resolve())}
        onUpdateCard={vi.fn(() => Promise.resolve())}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/escopo dos cartoes/i), "card-1");
    await user.click(screen.getByRole("button", { name: /ver itens/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/nao foi possivel carregar os itens da fatura/i),
      ).toBeInTheDocument();
    });
  });
});
