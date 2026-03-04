# Issue 22 Card And Invoice Management UI Design

## Goal

Close the remaining usability gap in the `Cards` surface so the user can manage the full card loop from one place: register cards, launch purchases, inspect the current invoice composition, and trigger invoice payments without leaving the main flow.

## Current Baseline

- `main` already supports:
  - card CRUD in the `Cards` view
  - card purchase entry
  - invoice payment from the same view
  - invoice summaries with totals, paid amount, remaining amount, and status
- The missing acceptance gap for issue 22 is invoice inspection:
  - the UI shows invoice totals, but it does not expose the invoice items
  - the backend exposes invoice aggregates, but not a dedicated invoice-items read model for the frontend

## Approaches Considered

### 1. Recommended: Inline expandable invoice detail

- Keep invoice cards as the primary overview.
- Add a `Ver itens` action on each invoice card.
- Expand an inline detail panel under the selected invoice card.
- Show the line items for that invoice in the same screen.

Why this is the best fit:

- Preserves the quick-entry flow from the PRD.
- Keeps card and invoice operations in one visible workspace.
- Minimizes navigation cost while still giving auditable detail.

### 2. Secondary: Modal or side panel for invoice detail

- Cleaner overview state, but adds modal context switching and more clicks.
- Better only if invoice content becomes much denser later.

### 3. Reject: Keep aggregate-only invoice cards

- Too weak for actual financial organization.
- Forces the user to guess what is composing the invoice total.

## Approved Design

### UX Structure

- Keep the existing `Cards` page as the single card workspace.
- Preserve the current three major blocks:
  - card management
  - purchase entry
  - pending invoices
- Upgrade the invoice block so each invoice card can reveal its line items inline.

### Invoice Detail Interaction

- Each payable invoice card gets a `Ver itens` toggle.
- Only one invoice detail panel is open at a time.
- Re-clicking the same invoice collapses it.
- The detail opens directly under the selected invoice card to keep spatial continuity.

### Detail Content

- Each item row should show:
  - description
  - category
  - purchase date
  - installment label (`1/3`, `2/3`, etc.) when applicable
  - item amount
- The panel header should reinforce:
  - invoice reference month
  - card name
  - invoice total / paid / remaining values

### Data Contract

- Add a backend read endpoint dedicated to invoice items:
  - `GET /api/invoices/{invoice_id}/items`
- Return installment-level rows already aligned to the selected invoice.
- Reuse the existing `card_purchase_installments` projection as the source of truth.

Recommended response shape:

- `invoice_item_id`
- `invoice_id`
- `purchase_id`
- `card_id`
- `purchase_date`
- `category_id`
- `description`
- `installment_number`
- `installments_count`
- `amount`

### Error Handling

- If the invoice does not exist: backend returns `404`.
- If the invoice has no items: backend returns `200` with an empty list.
- Frontend:
  - lazy-load invoice items on first expand
  - show lightweight loading state inside the expanded panel
  - show inline error copy if item loading fails

### Testing

- Backend:
  - endpoint returns only the items for the requested invoice
  - installment rows are correctly grouped by invoice
  - missing invoice returns `404`
- Frontend:
  - `Cards` view expands invoice details
  - items render with the expected fields
  - failed fetch keeps the page stable and shows inline feedback

## Scope Boundaries

Not in issue 22:

- separate invoice page
- invoice editing
- deleting purchases
- filters/search inside invoice items
- paid invoice history redesign

