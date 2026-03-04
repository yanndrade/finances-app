# UX Frontend First Cycle Design

**Date:** 2026-03-04

**Goal:** Improve the app's day-to-day finance UX in the frontend only, without changing backend contracts, domain events, or read-model semantics.

## Scope

This cycle is intentionally limited to UI and UX refinement in `packages/frontend`.

The work includes:

- removing the redundant `Movimentar` destination from the main sidebar
- making the global `+ Lancamento` action the primary manual-entry path
- replacing free-text category entry in the quick-add modal with controlled selection
- rebalancing the dashboard so visual weight matches the importance of each metric
- removing decorative dashboard metrics that are not backed by real domain data
- adding clearer card-limit feedback in the `Cartoes` surface
- improving labels and microcopy around invoice payment so the flow reads as settling card debt, not creating a new expense

The work intentionally excludes:

- backend API changes
- new event types or projector changes
- transaction scheduling or true `pending` transaction support
- changes to how invoice payments are stored in the backend
- full category CRUD

## Recommended Approach

Use a surgical frontend pass.

Keep the current data model and API calls, but tighten the navigation, visual hierarchy, and form controls so the UX better matches actual finance workflows. This delivers the highest visible value with the lowest regression risk.

## Approaches Considered

### 1. Recommended: Surgical UX pass

- Fix the most confusing interaction and presentation issues directly in the existing frontend structure.
- Keep current views, callbacks, and API contracts stable.

Why this is the best fit:

- Fastest path to visible improvement.
- Low risk because it avoids domain-model churn.
- Matches the user request to improve confusing UX without reopening accounting logic yet.

### 2. Medium refactor: Shared entry architecture

- Do the UX pass and also unify the quick-add modal and `MovementsPanel` around one shared form system.

Why it was not chosen first:

- Better long-term, but larger refactor surface.
- Adds risk while the product direction is still being validated.

### 3. Aggressive redesign

- Redo navigation and multiple main screens in one broader pass.

Why it was rejected:

- Too much scope for a first corrective cycle.
- Blurs the line between UX cleanup and product redesign.

## Information Architecture

### Navigation

- Main navigation becomes:
  - `Visao geral`
  - `Transacoes`
  - `Contas`
  - `Cartoes`
  - `Configuracoes`
- `Movimentar` is removed from the sidebar.
- The global `+ Lancamento` button remains the single primary entry point for manual registration.
- Existing keyboard affordances such as `Ctrl+N` should keep opening the same quick-add modal if already implemented by the shell.

### Entry Model

- Manual entry is treated as a global action, not a dedicated page.
- The quick-add modal stays available from anywhere so the user does not lose context when recording something quickly.

## Screen Design

### Quick Add Modal

The modal remains the central entry surface for:

- `Despesa`
- `Receita`
- `Transferencia`
- `Cartao`
- `Pagamento de fatura`

Changes:

- Rename the `Fatura` tab label to `Pagamento de fatura` or `Quitar fatura`.
- Add helper copy that makes the action read as settling the card balance, not recording a new spend.
- Replace the free-text `Categoria` input with a controlled selector.

#### Category Model In The UI

- The selector uses a predefined frontend taxonomy mapped to backend-safe ids.
- Initial categories:
  - `food`
  - `transport`
  - `housing`
  - `health`
  - `education`
  - `entertainment`
  - `utilities`
  - `salary`
  - `freelance`
  - `other`
- The visible labels remain in pt-BR.
- Existing values outside this list must still render safely when editing or reading legacy data.

This cycle does not introduce full category management. The goal is consistency, not category administration.

### Dashboard

The dashboard keeps using current backend summary data but changes presentation.

Changes:

- The investment-goal block becomes smaller and stops dominating the layout.
- The category composition chart gains more prominence using real `spending_by_category` data.
- The existing proportional expense bars remain proportional to real total expense.
- Remove artificial summary cards such as `Fixos`, `Variaveis`, and `Parcelas` when they are only derived from hardcoded percentages.

The rule is simple: if the metric is not grounded in real data, it should not be presented as a finance fact.

### Transactions

- Keep the current backend status values (`active`, `voided`) unchanged.
- Change the visible label for `active` from `Ativa` to `Efetivada`.
- Do not introduce a visible `Pendente` state yet because the backend has no real support for it.

This is a copy correction, not a domain change.

### Cards

The card surface keeps the current overview and payment flows, but the top-level limit readout becomes more actionable.

Add:

- `Limite total`
- `Limite comprometido`
- `Limite disponivel`
- a clear progress bar showing used vs available credit

For the aggregate view:

- `Limite comprometido` is derived from the sum of `remaining_amount` for visible open invoices.
- `Limite disponivel` is `totalLimit - totalOpenAmount`, clamped at zero if needed.

For the card-specific view:

- Use the selected card's `limit` with its current invoice open amount when the scope is a single card.

No backend changes are required because this is pure presentation math.

## Data And State Strategy

- Keep all current API contracts unchanged.
- Centralize the frontend category definitions in a shared constant so the same source can be reused by:
  - quick-add modal
  - transaction edit flows
  - future entry surfaces
- Reuse `dashboard.spending_by_category` for both chart composition and top-category summaries.
- Reuse current card and invoice arrays already fetched in `App.tsx` to derive credit-limit usage.

## Error Handling And UX Safety

- Removing `Movimentar` must not reduce discoverability:
  - the global `+ Lancamento` action stays visually prominent
  - keyboard open behavior stays intact
- The invoice-payment tab must use explicit labels so the user understands they are paying a card bill.
- Controlled category selection prevents accidental report fragmentation from label drift like `iFood`, `Comida`, and `Alimentacao`.

## Testing Strategy

Frontend coverage should verify:

- sidebar no longer renders `Movimentar`
- global quick-add remains available
- quick-add uses controlled category selection instead of free text
- dashboard no longer renders decorative fake metrics
- dashboard renders category-composition visualization from real category data
- card overview shows committed and available limit values
- transaction status renders `Efetivada` for active records

## Delivery Constraints

- Keep all visible product copy in pt-BR.
- Do not change backend contracts in this cycle.
- Do not change accounting semantics yet.
- Focus on clarity and consistency first; deeper domain changes happen in a later cycle.
