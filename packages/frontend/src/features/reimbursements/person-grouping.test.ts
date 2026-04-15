import type { PendingReimbursementSummary } from "../../lib/api";

import { groupReimbursementsByPerson, normalizePersonName } from "./person-grouping";

function buildReimbursement(
  overrides: Partial<PendingReimbursementSummary> & {
    transaction_id: string;
    person_id: string;
  },
): PendingReimbursementSummary {
  return {
    transaction_id: overrides.transaction_id,
    person_id: overrides.person_id,
    amount: overrides.amount ?? 10_00,
    amount_received: overrides.amount_received ?? 0,
    status: overrides.status ?? "pending",
    account_id: overrides.account_id ?? "acc-1",
    occurred_at: overrides.occurred_at ?? "2026-03-10T10:00:00Z",
    expected_at: overrides.expected_at ?? null,
    received_at: overrides.received_at ?? null,
    receipt_transaction_id: overrides.receipt_transaction_id ?? null,
    notes: overrides.notes ?? null,
    source_transaction_id: overrides.source_transaction_id ?? null,
    source_title: overrides.source_title ?? null,
    source_description: overrides.source_description ?? null,
    source_card_id: overrides.source_card_id ?? null,
    source_posted_at: overrides.source_posted_at ?? null,
    source_purchase_date: overrides.source_purchase_date ?? null,
    source_installment_number: overrides.source_installment_number ?? null,
    source_installment_total: overrides.source_installment_total ?? null,
  };
}

describe("person grouping for reimbursements", () => {
  it("normalizes equivalent names with case and accent differences", () => {
    expect(normalizePersonName("Valéria Mello")).toBe(normalizePersonName("valeria mello"));
  });

  it("normalizes equivalent names with extra spaces", () => {
    expect(normalizePersonName("  Valéria   Mello ")).toBe(normalizePersonName("Valéria Mello"));
  });

  it("normalizes equivalent names when accents are removed", () => {
    expect(normalizePersonName("Valéria")).toBe(normalizePersonName("Valeria"));
  });

  it("keeps small surname variation separated when matching is uncertain", () => {
    const groups = groupReimbursementsByPerson([
      buildReimbursement({ transaction_id: "tx-1", person_id: "Valeria Melo" }),
      buildReimbursement({ transaction_id: "tx-2", person_id: "Valeria Mello" }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("merges single-token names when there is no ambiguity", () => {
    const groups = groupReimbursementsByPerson([
      buildReimbursement({ transaction_id: "tx-1", person_id: "Valéria" }),
      buildReimbursement({
        transaction_id: "tx-2",
        person_id: "Valéria Mello",
        occurred_at: "2026-03-11T09:00:00Z",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].canonical_name).toBe("Valéria Mello");
    expect(
      groups[0].alias_details.some(
        (alias) => alias.match_reason === "single_token_unique_match",
      ),
    ).toBe(true);
  });

  it("does not merge single-token names when there are multiple compatible people", () => {
    const groups = groupReimbursementsByPerson([
      buildReimbursement({ transaction_id: "tx-1", person_id: "Valéria" }),
      buildReimbursement({ transaction_id: "tx-2", person_id: "Valéria Mello" }),
      buildReimbursement({ transaction_id: "tx-3", person_id: "Valéria Souza" }),
    ]);

    expect(groups).toHaveLength(3);
  });

  it("keeps aggregated outstanding totals equal to the filtered rows", () => {
    const reimbursements = [
      buildReimbursement({
        transaction_id: "tx-1",
        person_id: "Ana",
        amount: 10_000,
        amount_received: 0,
        status: "pending",
      }),
      buildReimbursement({
        transaction_id: "tx-2",
        person_id: "Ana",
        amount: 8_000,
        amount_received: 3_000,
        status: "partial",
      }),
      buildReimbursement({
        transaction_id: "tx-3",
        person_id: "Ana",
        amount: 5_000,
        amount_received: 5_000,
        status: "received",
      }),
      buildReimbursement({
        transaction_id: "tx-4",
        person_id: "Ana",
        amount: 2_000,
        amount_received: 0,
        status: "canceled",
      }),
    ];

    const groups = groupReimbursementsByPerson(reimbursements);
    const groupedOutstanding = groups.reduce(
      (total, group) => total + group.outstanding_total,
      0,
    );

    expect(groupedOutstanding).toBe(15_000);
  });

  it("keeps the original person text in expanded items", () => {
    const groups = groupReimbursementsByPerson([
      buildReimbursement({
        transaction_id: "tx-1",
        person_id: "  Valéria   Mello ",
      }),
      buildReimbursement({
        transaction_id: "tx-2",
        person_id: "valeria mello",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((item) => item.person_id)).toEqual([
      "  Valéria   Mello ",
      "valeria mello",
    ]);
  });
});
