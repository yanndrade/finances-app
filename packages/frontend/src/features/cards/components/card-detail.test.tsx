import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as api from "../../../lib/api";
import type {
  CardSummary,
  InvoiceItemSummary,
  InvoiceSummary,
} from "../../../lib/api";
import { CardDetail } from "./card-detail";

const card = {
  card_id: "card-bradesco",
  name: "Bradesco Visa Infinite",
  limit: 600_000,
  closing_day: 24,
  due_day: 5,
  payment_account_id: "acc-nubank",
  is_active: true,
  future_installment_total: 0,
} as CardSummary;

const invoice = {
  invoice_id: "card-bradesco:2026-08",
  card_id: "card-bradesco",
  reference_month: "2026-08",
  closing_date: "2026-08-24",
  due_date: "2026-09-05",
  total_amount: 30_000,
  paid_amount: 0,
  remaining_amount: 30_000,
  purchase_count: 2,
  status: "open",
} as InvoiceSummary;

function buildItem(overrides: Partial<InvoiceItemSummary>): InvoiceItemSummary {
  return {
    invoice_item_id: "item-1",
    invoice_id: invoice.invoice_id,
    purchase_id: "purchase-1",
    card_id: "card-bradesco",
    purchase_date: "2026-08-10T12:00:00Z",
    category_id: "supermercado",
    description: "Mercado",
    installment_number: null,
    installments_count: null,
    amount: 10_000,
    ...overrides,
  } as InvoiceItemSummary;
}

/** The item list is collapsed until asked for, and the chip lives inside it. */
async function openInvoiceItems() {
  await userEvent.click(
    await screen.findByRole("button", { name: /itens da fatura/i }),
  );
}

function renderDetail(invoiceItems: InvoiceItemSummary[]) {
  render(
    <CardDetail
      accounts={[]}
      card={card}
      invoice={invoice}
      previousInvoices={[]}
      futureInstallments={[]}
      installmentsLoadError={null}
      invoiceItems={invoiceItems}
      isLoadingItems={false}
      invoiceItemsError={null}
      invoicePayments={[]}
      isLoadingPayments={false}
      invoicePaymentsError={null}
      isSubmitting={false}
      onBack={vi.fn()}
      onLoadInvoiceItems={vi.fn(() => Promise.resolve())}
      onOpenLedgerFiltered={vi.fn()}
      onOpenQuickAdd={vi.fn()}
      onSelectInvoice={vi.fn()}
      onUpdateInvoicePayment={vi.fn(() => Promise.resolve())}
      onError={vi.fn()}
    />,
  );
}

describe("CardDetail invoice items", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "fetchCardHolders").mockResolvedValue([
      {
        holder_id: "holder-duda",
        card_id: "card-bradesco",
        name: "Duda",
        last_four: "9873",
        is_primary: false,
        sub_limit: null,
        reimbursable_person_id: null,
        is_active: true,
      } as never,
    ]);
  });

  it("chips an additional's purchase with the holder's name", async () => {
    renderDetail([
      buildItem({
        invoice_item_id: "item-duda",
        description: "Farmácia",
        holder_id: "holder-duda",
      }),
    ]);

    await openInvoiceItems();

    const line = (await screen.findByText("Farmácia")).closest("div")!;
    expect(within(line).getByText("Duda")).toBeInTheDocument();
  });

  it("leaves the titular's own purchase without a chip", async () => {
    renderDetail([
      buildItem({ invoice_item_id: "item-titular", description: "Mercado" }),
    ]);

    await waitFor(() => expect(api.fetchCardHolders).toHaveBeenCalled());
    await openInvoiceItems();

    const line = (await screen.findByText("Mercado")).closest("div")!;
    expect(within(line).queryByText("Duda")).not.toBeInTheDocument();
  });

  it("does not chip a holder the card no longer has", async () => {
    renderDetail([
      buildItem({
        invoice_item_id: "item-orfao",
        description: "Posto",
        holder_id: "holder-removido",
      }),
    ]);

    await waitFor(() => expect(api.fetchCardHolders).toHaveBeenCalled());
    await openInvoiceItems();

    const line = (await screen.findByText("Posto")).closest("div")!;
    expect(within(line).queryByText("holder-removido")).not.toBeInTheDocument();
    expect(within(line).queryByText("Duda")).not.toBeInTheDocument();
  });
});
