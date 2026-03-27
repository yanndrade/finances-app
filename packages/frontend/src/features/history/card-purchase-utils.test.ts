import type { UnifiedMovement } from "../../lib/api";

import { formatHistoryMovementLifecycleStatus } from "./card-purchase-utils";

function buildMovement(
  overrides: Partial<UnifiedMovement> = {},
): UnifiedMovement {
  return {
    movement_id: "purchase-1:1",
    kind: "expense",
    origin_type: "card_purchase",
    title: "Mercado",
    description: "Mercado",
    amount: 90_00,
    posted_at: "2026-03-15T12:00:00Z",
    competence_month: "2026-04",
    account_id: "acc-1",
    card_id: "card-1",
    payment_method: "CREDIT_CASH",
    category_id: "food",
    counterparty: null,
    lifecycle_status: "cleared",
    edit_policy: "editable",
    parent_id: "purchase-1",
    group_id: null,
    transfer_direction: null,
    installment_number: null,
    installment_total: null,
    source_event_type: "CardPurchaseCreated",
    ...overrides,
  };
}

describe("formatHistoryMovementLifecycleStatus", () => {
  it("shows 'Fatura paga' for settled card purchases", () => {
    expect(formatHistoryMovementLifecycleStatus(buildMovement())).toBe(
      "Fatura paga",
    );
  });

  it("keeps the generic lifecycle label for non-card movements", () => {
    expect(
      formatHistoryMovementLifecycleStatus(
        buildMovement({
          origin_type: "manual",
          source_event_type: "ExpenseCreated",
          card_id: null,
          payment_method: "PIX",
        }),
      ),
    ).toBe("Compensada");
  });
});
