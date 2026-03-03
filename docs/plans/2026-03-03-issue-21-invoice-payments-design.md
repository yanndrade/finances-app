# Issue 21 Invoice Payments Design

**Context**

The current card flow can register purchases, generate installments, and materialize invoices, but it cannot close the loop with actual invoice payments. The PRD requires invoice payment to affect both the cash side (account outflow) and the card side (invoice state), with support for partial payments and accurate sequential status transitions.

**Decision**

Model each payment as a single `InvoicePaid` event. The event store records the domain action once, and the projector derives both:
- invoice payment accumulation and status transitions
- a cash outflow transaction in the selected account

This keeps the event log compact and aligned with the existing architecture, where one business action is projected into multiple read models.

**Backend Design**

- Add an `InvoicePaymentService` use case dedicated to invoice payments.
- Add `POST /api/invoices/{invoice_id}/payments`.
- Request payload:
  - `id`
  - `amount`
  - `paid_at`
  - `account_id`
- Validation rules:
  - `amount > 0`
  - `paid_at` must be UTC ISO 8601
  - `invoice_id` must exist
  - `account_id` must exist and be active
- `InvoicePaid` event payload stores:
  - `id`
  - `invoice_id`
  - `card_id`
  - `amount`
  - `account_id`
  - `paid_at`
- The service allows partial and full payments in sequence.
- No interest/rotativo logic is added in v1.

**Projection and Status Rules**

- Extend the `invoices` projection with:
  - `paid_amount`
  - `remaining_amount`
- Status transitions implemented in this issue:
  - `open` when `paid_amount == 0`
  - `partial` when `0 < paid_amount < total_amount`
  - `paid` when `paid_amount >= total_amount`
- The `closed` value remains reserved in the model for later cycle-closing work, but this issue does not introduce date-driven auto-close logic.
- Each `InvoicePaid` event also materializes a derived `expense` transaction in `transactions`:
  - `transaction_id = <payment_id>:invoice-payment`
  - `type = "expense"`
  - `payment_method = "OTHER"`
  - `category_id = "invoice_payment"`
  - `description = "Pagamento de fatura <invoice_id>"`
- This derived transaction reduces the selected account balance through the already established transaction projection path.

**Frontend Design**

- Extend the existing `Cards` screen rather than creating a new page.
- Show payment action for invoices in status `open` or `partial`.
- Add a modal for paying an invoice with:
  - selected invoice summary
  - payment amount prefilled with the remaining amount
  - payment datetime prefilled with current local datetime
  - account selector listing active accounts only
  - default selected account = card `payment_account_id` if active, otherwise first active account
- After payment, the invoice card updates in place with:
  - status badge (`Aberta`, `Parcial`, `Paga`)
  - paid and remaining amount

**API/UI Contract**

- Add `payInvoice()` to the frontend API client.
- Extend `InvoiceSummary` with:
  - `paid_amount`
  - `remaining_amount`
- Keep `status` string-based for compatibility with the existing UI layer.

**Testing Strategy**

- Backend tests:
  - full payment marks invoice as `paid`
  - partial payment marks invoice as `partial`
  - sequential payments move `partial -> paid`
  - payment creates derived expense transaction and updates account balance
  - inactive or missing account is rejected
- Frontend tests:
  - API client sends the payment payload correctly
  - cards UI pays an invoice and updates the rendered invoice state

**Schema Migration Strategy**

The projector schema changes. Existing rebuild detection must recognize the new invoice columns so `app.db` can be rebuilt cleanly from the event store without manual migration steps.
