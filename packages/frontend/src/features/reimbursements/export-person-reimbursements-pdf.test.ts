import type { Mock } from "vitest";

import type { CardSummary, PendingReimbursementSummary } from "../../lib/api";
import type { ReimbursementPersonGroup } from "./person-grouping";

const pdfMock = vi.hoisted(() => {
  const doc = {
    addPage: vi.fn(),
    line: vi.fn(),
    rect: vi.fn(),
    roundedRect: vi.fn(),
    save: vi.fn(),
    setDrawColor: vi.fn(),
    setFillColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    splitTextToSize: vi.fn((value: string) => [value]),
    text: vi.fn(),
  };

  return {
    doc,
    jsPDF: vi.fn(() => doc),
  };
});

vi.mock("jspdf", () => ({
  jsPDF: pdfMock.jsPDF,
}));

import {
  buildReimbursementsPdfFileName,
  exportPersonReimbursementsPdf,
} from "./export-person-reimbursements-pdf";

const cards: CardSummary[] = [
  {
    card_id: "card-1",
    name: "Bradesco Visa Platinum",
    limit: 0,
    closing_day: 10,
    due_day: 20,
    payment_account_id: "acc-1",
    is_active: true,
    future_installment_total: 0,
  },
];

describe("exportPersonReimbursementsPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a safe PDF filename", () => {
    expect(buildReimbursementsPdfFileName("Valeria Mello", "2026-05")).toBe(
      "reembolsos-valeria-mello-2026-05.pdf",
    );
  });

  it("writes summary totals and all reimbursement statuses to the PDF", async () => {
    const savePdf = vi.fn();
    const group = buildGroup([
      reimbursement({
        transaction_id: "pending-1",
        amount: 10_000,
        amount_received: 0,
        status: "pending",
        source_title: "Mercado",
        source_card_id: "card-1",
        source_installment_number: 1,
        source_installment_total: 2,
      }),
      reimbursement({
        transaction_id: "partial-1",
        amount: 8_000,
        amount_received: 3_000,
        status: "partial",
        source_title: "Farmacia",
      }),
      reimbursement({
        transaction_id: "received-1",
        amount: 7_000,
        amount_received: 7_000,
        status: "received",
        source_title: "Cinema",
      }),
      reimbursement({
        transaction_id: "canceled-1",
        amount: 5_000,
        amount_received: 0,
        status: "canceled",
        source_title: "Taxi",
      }),
    ]);

    const result = await exportPersonReimbursementsPdf({
      group,
      month: "2026-05",
      cards,
      generatedAt: new Date("2026-05-04T12:00:00Z"),
      savePdf,
    });

    const textValues = (pdfMock.doc.text as Mock).mock.calls.flatMap((call) => (
      Array.isArray(call[0]) ? call[0] : [call[0]]
    ));
    expect(result).toEqual({
      fileName: "reembolsos-valeria-mello-2026-05.pdf",
      reusedExisting: false,
    });
    expect(savePdf).toHaveBeenCalledWith(pdfMock.doc, result.fileName);
    expect(textValues).toContain("Reembolsos - Valeria Mello");
    expect(textValues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Total ainda devido: R\$\s*150,00/),
        expect.stringMatching(/Total listado no mes: R\$\s*300,00/),
      ]),
    );
    expect(textValues).toContain("Mercado");
    expect(textValues).toContain("Bradesco Visa Platinum");
    expect(textValues).toContain("1/2");
    expect(textValues).toContain("Pendente");
    expect(textValues).toContain("Parcial");
    expect(textValues).toContain("OK Recebido");
    expect(textValues).toContain("Cancelado");
    expect(pdfMock.doc.setFillColor).toHaveBeenCalledWith(255, 251, 235);
    expect(pdfMock.doc.setFillColor).toHaveBeenCalledWith(236, 253, 245);
    expect(pdfMock.doc.setFillColor).toHaveBeenCalledWith(248, 250, 252);
    expect(pdfMock.doc.roundedRect).toHaveBeenCalled();
  });
});

function buildGroup(items: PendingReimbursementSummary[]): ReimbursementPersonGroup {
  return {
    group_id: "person:valeria-mello",
    canonical_name: "Valeria Mello",
    canonical_normalized_name: "valeria mello",
    aliases: [],
    alias_details: [],
    items,
    outstanding_total: 15_000,
    item_count: items.length,
    status_counts: {
      pending: 1,
      partial: 1,
      received: 1,
      canceled: 1,
    },
    latest_occurred_at: "2026-05-04T10:00:00Z",
  };
}

function reimbursement(
  overrides: Partial<PendingReimbursementSummary>,
): PendingReimbursementSummary {
  return {
    transaction_id: overrides.transaction_id ?? "tx-1",
    person_id: "Valeria Mello",
    amount: overrides.amount ?? 10_000,
    amount_received: overrides.amount_received ?? 0,
    status: overrides.status ?? "pending",
    account_id: "acc-1",
    occurred_at: "2026-05-04T10:00:00Z",
    expected_at: null,
    received_at: null,
    receipt_transaction_id: null,
    notes: null,
    source_transaction_id: overrides.source_transaction_id ?? null,
    source_title: overrides.source_title ?? null,
    source_description: overrides.source_description ?? null,
    source_card_id: overrides.source_card_id ?? null,
    source_posted_at: overrides.source_posted_at ?? null,
    source_purchase_date: overrides.source_purchase_date ?? "2026-05-03T10:00:00Z",
    source_installment_number: overrides.source_installment_number ?? null,
    source_installment_total: overrides.source_installment_total ?? null,
  };
}
