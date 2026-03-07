# Ledger Domain And Calculation Matrix

## Canonical Ledger Events

The application must treat these as the economic source of truth:

- `income`: money entering an account.
- `expense_cash`: immediate expense paid from an account.
- `card_purchase`: economic expense created by a credit-card purchase.
- `installment_due`: monthly economic portion of a parcelled card purchase.
- `invoice_payment`: settlement of card liability, not a new monthly expense.
- `transfer`: internal movement between accounts, neutral for income/expense totals.
- `investment_contribution`: money moved from account cash into invested assets.
- `investment_withdrawal`: money moved from invested assets back into account cash.
- `reimbursement_expected`: amount expected back from a third party.
- `reimbursement_received`: reimbursement actually received.
- `manual_adjustment`: explicit corrective entry when needed.

## Domain Rules

- Dashboard, History, Cards, Reports and Planning must all be explainable from ledger events plus deterministic projections.
- `invoice_payment` never increases monthly expense totals.
- Card purchases are economic expenses at purchase time; invoice payment only settles liability.
- Parcelled purchases must keep parent-child traceability: purchase -> installments -> invoice item -> invoice payment.
- Transfers are operational events and must not distort income or expense totals.
- Reimbursements must preserve person linkage and status.

## Credit Card Glossary

- `purchase`: the original credit-card buying event. It owns description, category, card and total amount.
- `installment`: one economic monthly slice derived from a parcelled purchase. It keeps the link to the parent purchase and target invoice.
- `invoice`: the operational billing cycle for a card in a reference month.
- `invoice item`: the installment row that composes a specific invoice.
- `invoice payment`: settlement of the card liability from an account. It reduces invoice balance and card liability, but does not create a new monthly expense.
- `committed limit`: current open invoice balance plus future installments already allocated to upcoming cycles.
- `available limit`: total card limit minus committed limit.

## Projection Matrix

| Source | Projection / Aggregate | Consumer |
| --- | --- | --- |
| `income` + `expense_cash` + `installment_due` | `transactions`, monthly totals | Dashboard, History, Planning |
| `card_purchase` + installment allocation | `card_purchases`, `card_purchase_installments`, `invoice_items` | Cards, History drill-down |
| `invoice_payment` | `invoices.remaining_amount`, ledger settlement rows | Cards, History |
| `recurring_rules` + `pendings` | monthly fixed-expense commitments | Dashboard, Planning |
| `reimbursement_expected` / `reimbursement_received` | `reimbursements` | Dashboard, History |
| `investment_contribution` / `investment_withdrawal` | investment overview + ledger rows | Investments, History |
| `budget limits` + monthly spending | `category_budgets`, alerts | Dashboard, Planning |

## Current Calculation Policy

- Monthly expense on Dashboard is `expense_cash (excluding invoice_payment) + installment_due`.
- `free_to_spend` is `monthly income - monthly economic expense - still-pending recurring commitments`.
- `invoices_due_total` is operational only; it informs payment pressure and must not be re-added to monthly expense.
- Category spending must include installment allocations for the current month.

## Implementation Anchor Points

- Backend projector aggregation: `packages/backend/src/finance_app/infrastructure/projector.py`
- Shared API contracts: `packages/frontend/src/lib/api.ts`
- Dashboard consumer: `packages/frontend/src/features/dashboard/dashboard-bento.tsx`
- Planning consumer: `packages/frontend/src/features/reports/reports-view.tsx`
- History consumer: `packages/frontend/src/features/transactions/transactions-view.tsx`
