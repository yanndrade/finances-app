# Issue 20 Installment Scheduling Design

**Context**

Issue 20 extends the existing card purchase flow so one purchase can generate a deterministic installment plan across current and future invoice cycles. The current system only stores one projected card purchase row and one invoice increment per purchase, so monthly budget and future invoice visibility are both still based on the full purchase amount.

**Decision**

Keep `CardPurchaseCreated` as a single source event and add `installments_count` to its payload. The event store remains append-only and compact, while the projector becomes responsible for materializing derived installment rows, invoice totals, and monthly budget impact.

**Backend Design**

- `CardPurchaseService.create_card_purchase()` accepts `installments_count` with default `1`.
- Validation requires `installments_count >= 1`.
- `card_purchases` remains the purchase-level projection, but it now stores:
  - `total_amount`
  - `installments_count`
  - the first invoice allocation metadata for the purchase
- A new `card_purchase_installments` projection stores one row per installment:
  - `installment_id`
  - `purchase_id`
  - `card_id`
  - `installment_number`
  - `installments_count`
  - `amount`
  - `invoice_id`
  - `reference_month`
  - `closing_date`
  - `due_date`
  - `purchase_date`
  - `category_id`
- The projector calculates installment amounts deterministically:
  - `base_amount = total_amount // installments_count`
  - `remainder = total_amount % installments_count`
  - installments `1..n-1` use `base_amount`
  - installment `n` uses `base_amount + remainder`
- Each installment is allocated by shifting the purchase month by `installment_number - 1` before applying the existing card cycle rules.
- `invoices.total_amount` becomes the sum of installment amounts in that cycle; `purchase_count` becomes the count of invoice items (installments) in that cycle.
- Dashboard spending includes installment rows whose `reference_month` matches the selected month, so monthly expense reflects the monthly installment amount instead of the full purchase total.

**API Contract**

- `POST /api/card-purchases` accepts optional `installments_count`.
- `CardPurchaseSummary` returns `total_amount` and `installments_count`.
- A new frontend-facing installment summary endpoint is not necessary for this issue; the invoice list can expose installment counts and totals through the existing `/api/invoices` response.

**Frontend Design**

- Extend the existing `Cards` screen instead of creating a new page.
- Add a numeric `Parcelas` field to the card purchase form, default `1`, minimum `1`.
- Keep the current quick-entry flow: card, date, amount, category, description, installments, submit.
- Update the invoice cards to show:
  - total amount of the invoice
  - total projected invoice items for that cycle
  - whether the value includes future installments from prior purchases
- Preserve the current responsive layout and the low-friction form flow from `FRONTEND-GUIDELINES.md`.

**Schema Migration Strategy**

The projector schema changes. Existing projection rebuild logic should detect the new columns/table and trigger a rebuild automatically so `app.db` can be reconstructed from `events.db` without migrations.

**Testing Strategy**

- Domain tests for deterministic installment splitting and shifted invoice allocation.
- Projector tests for one purchase generating multiple future installment rows and invoice totals.
- HTTP tests for accepting `installments_count` and returning correct invoice projections.
- Frontend tests for API payload normalization and the cards UI flow creating a multi-installment purchase.
