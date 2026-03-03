# Issue 19 Card Purchases Design

## Goal

Implement card purchase creation and allocate each purchase into the correct invoice cycle, including a usable desktop UI flow for launching purchases from the cards area.

## Constraints

- Respect the PRD card cycle rule: invoice cycle is `(previous closing day, current closing day]`.
- A purchase on the closing day belongs to the current invoice.
- Do not create zero-value invoices.
- Keep cash accounts separate from card commitments.

## Backend Design

- Introduce a `CardPurchaseService` responsible for:
  - validating purchase payloads
  - verifying the target card exists
  - validating UTC purchase timestamp
  - appending a `CardPurchaseCreated` event
- Extend the projector with:
  - `card_purchases` projection table
  - `invoices` projection table
- Materialize invoice rows from `CardPurchaseCreated` events instead of persisting invoice events.
- Compute invoice identity from:
  - `card_id`
  - target invoice month derived from purchase date and `closing_day`
- Store enough invoice data for the next issues:
  - `invoice_id`
  - `card_id`
  - `reference_month`
  - `closing_date`
  - `due_date`
  - `total_amount`
  - `status` (start with `open`)

## Frontend Design

- Add purchase creation directly inside the existing `CardsView`.
- Reuse the current visual language:
  - `panel-card` sections
  - `Modal` for the purchase form
  - toast feedback from `App.tsx`
- Show a compact invoice summary for the selected card:
  - current invoices list
  - total value
  - cycle metadata
- Keep the issue narrow:
  - no installment scheduling yet
  - no invoice payment
  - no dashboard card analytics

## API Surface

- `POST /api/card-purchases`
- `GET /api/invoices`

This keeps the frontend simple while still allowing filtering by `card_id`.

## Testing Strategy

- Backend:
  - correct invoice month for purchases before, on, and after closing day
  - invoice totals aggregate correctly
  - zero-value invoices are not listed
- Frontend:
  - card purchase form submits successfully
  - invoice summary refreshes after purchase
  - closing-day scenario renders the expected reference month
