# UX Frontend Second Cycle Design

**Date:** 2026-03-04

**Goal:** Reduce launch-flow ambiguity in the frontend by turning quick add into one canonical `Lancar` flow, cleaning up top-level IA copy, and hiding secondary transaction filters behind progressive disclosure.

## Scope

This cycle is limited to UX and frontend behavior refinement in `packages/frontend`.

The work includes:

- replacing the current quick-add tab model with one canonical entry flow
- treating card purchases and invoice payments as conditional variants of the same launch surface
- renaming top-level shell copy so the app emphasizes actions, not ambiguous entities
- reducing visible filter density in `Transacoes` with a collapsed advanced-filter section

The work intentionally excludes:

- dashboard redesign beyond copy cleanup
- budgets, recurring bills, pending queues, or inbox workflows
- new keyboard shortcuts
- deep backend/domain refactors
- changes to accounting semantics in the PRD

## Recommended Approach

Use a UX-first unification pass without changing domain contracts.

The PRD explicitly separates cash transactions, card commitments, transfers, and invoice payments as different business events. This cycle should preserve that internal distinction while removing the user's need to understand it at entry time. The frontend becomes simpler; the backend stays semantically correct.

## Approaches Considered

### 1. Recommended: Unify within the existing modal

- Keep the current quick-add modal as the primary global entry point.
- Replace specialized tabs with one form that changes based on the selected intent.
- Reuse the existing mutation handlers (`createCashTransaction`, `createCardPurchase`, `createTransfer`, `payInvoice`).

Why this is the best fit:

- Lowest regression risk.
- Fastest way to remove ambiguity.
- Preserves the PRD's domain boundaries while fixing the UX.

### 2. New dedicated `Lancar` page plus modal shortcut

- Build a full page for manual entry and make the modal a shortcut into the same form.

Why it was not chosen first:

- Bigger IA and routing change.
- More surface area than needed for the first habit-focused correction.

### 3. Backend normalization plus new unified write model

- Introduce a new backend command model so all entry paths post to one endpoint.

Why it was rejected for this cycle:

- Conflicts with the current PRD separation between cash, card commitments, transfers, and invoice settlement.
- Turns a UX cleanup into a domain refactor.

## Information Architecture

### Navigation And Shell Copy

- Keep the current navigation structure.
- Do not reintroduce `Movimentar`.
- Change the dashboard shell title from `Visao geral do caixa` to `Visao geral`.
- Update the dashboard shell subtitle so it references monthly control instead of only cash.
- Rename the global CTA from `+ Lancamento` to `+ Lancar`.

### Entry Model

- Manual entry remains a global action, not a page.
- The modal becomes the single canonical write surface for:
  - cash expenses
  - income
  - transfers between accounts
  - card purchases
  - invoice payments

The user sees one entry flow; the implementation still maps to the correct domain-specific mutation.

## Quick Add Interaction Design

### Primary Form

The modal opens as `Lancar` and starts with the essential fields:

- `Valor`
- `Tipo` (`Despesa`, `Receita`, `Transferencia`)
- `Conta`
- `Data`
- `Descricao`
- `Categoria` (required for expense and income)

This is the stable base of the form.

### Progressive Disclosure

The form adds a collapsed `Detalhes opcionais` section.

This section reveals only what the current selection needs:

- For `Despesa`:
  - payment mode selector
  - if payment mode is `Cartao`, show `Cartao` and `Parcelas`
- For `Transferencia`:
  - `Conta destino`
  - an explicit mode selector that can switch from internal transfer to `Quitar fatura`
  - if `Quitar fatura` is selected, reveal `Fatura`
- For `Receita`:
  - no extra fields in this cycle

The interface goal is to keep the initial form small while still supporting the existing domain operations.

### Internal Mapping

- `Despesa` or `Receita` with a non-card payment method -> `createCashTransaction`
- `Despesa` with payment mode `Cartao` -> `createCardPurchase`
- `Transferencia` with internal transfer mode -> `createTransfer`
- `Transferencia` with `Quitar fatura` mode -> `payInvoice`

No API contract changes are required.

## Transactions Screen

- Keep `Transacoes` as the historical/audit surface.
- Show these filters by default:
  - `Buscar`
  - period (`De` and `Ate`)
  - `Conta`
- Move these into a collapsed `Filtros avancados` block:
  - `Metodo`
  - `Categoria`
  - `Pessoa`
- The advanced section starts collapsed and preserves the same filter payload shape used today.

This reduces visual noise without changing how filtering works.

## Data And State Strategy

- Keep all current API contracts and payloads.
- Expand only frontend-local UI state in the quick-add modal:
  - selected transaction type
  - selected expense payment mode
  - selected transfer mode
  - advanced-details expansion state
- Reuse existing account, card, and invoice collections already loaded in `App.tsx`.
- Keep the shared category catalog introduced in the first cycle.

## Error Handling And UX Safety

- Hidden conditional fields must reset when the controlling mode changes, so stale ids are not submitted accidentally.
- The canonical form must never show both internal transfer and invoice-payment inputs at the same time.
- Validation should remain minimal and explicit:
  - no zero value
  - invoice payment requires an invoice
  - transfer requires different accounts
- If a conditional path fails, the existing parent toast flow continues to surface the error.

## Testing Strategy

Frontend coverage should verify:

- quick add opens as `Lancar`
- quick add no longer exposes standalone `Cartao` and `Pagamento de fatura` tabs
- selecting `Despesa` + card payment reveals `Cartao` and `Parcelas`
- selecting `Transferencia` reveals `Conta destino`
- selecting transfer mode `Quitar fatura` reveals `Fatura` and uses the invoice-payment branch
- the shell header renders `Visao geral`
- `Transacoes` starts with advanced filters collapsed
- expanding advanced filters reveals `Metodo`, `Categoria`, and `Pessoa`

## Delivery Constraints

- Keep visible copy in pt-BR.
- Respect the PRD distinction between cash, card commitments, transfers, and invoice settlement.
- Keep this cycle focused on ambiguity reduction and launch speed.
- Defer dashboard restructuring, budgets, and productivity enhancements to later phases.
