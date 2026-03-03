# Quick Entry Refactor Design

**Date:** 2026-03-03

**Issue:** Refactor the "Entrada rapida de caixa" screen to reduce form friction and improve desktop-first data entry speed.

## Scope

Refactor the existing quick-entry screen in `packages/frontend` without changing routes or backend API contracts.

The work includes:

- replacing the current two-column simultaneous forms with a single desktop-first quick-entry flow
- adding a mode switch for `Entrada`, `Saida`, and `Transferencia`
- prioritizing the amount field and reducing visible fields through progressive disclosure
- adding keyboard-first shortcuts, inline validation, and safer transfer guardrails
- persisting practical defaults in `localStorage`
- improving feedback states while staying within current backend capabilities

The work intentionally excludes:

- new backend endpoints for category CRUD or undo support
- route changes
- changes to existing transaction or transfer payload shapes

## Recommended Approach

Keep the route and top-level component contract stable, but split the current `MovementsPanel` into a single shell with mode-specific form sections. Use one shared transaction form for `Entrada` and `Saida`, and a dedicated transfer form for `Transferencia`.

This preserves integration simplicity in `App.tsx`, while making the UI meaningfully faster and easier to extend than the current side-by-side form layout.

## Architecture

### Component Structure

- `MovementsPanel` remains the page-level entry point for the `movements` view.
- The panel owns the active mode state: `income`, `expense`, or `transfer`.
- The panel renders only the currently active form.
- Shared helpers handle:
  - BRL currency masking and conversion to cents
  - local date defaults
  - `localStorage` persistence for defaults
  - category suggestions derived from loaded transactions or recent success context

### Data Contracts

The refactor keeps the current callback props:

- `onSubmitTransaction(payload: CashTransactionPayload)`
- `onSubmitTransfer(payload: TransferPayload)`

No route or backend contract changes are required. The UI adapts existing fields to the new flow and only sends data already supported by the API.

## User Experience

The screen is optimized first for desktop/Tauri use, per `PRD.md` and `FRONTEND-GUIDELINES.md`.

### Layout

- a single contained column instead of two active columns
- a segmented control at the top: `Entrada | Saida | Transferencia`
- one visible form at a time
- denser, keyboard-friendly flow for desktop
- graceful stacking on smaller widths without changing the desktop-first hierarchy

### Transaction Flow (`Entrada` / `Saida`)

Field order:

1. `Valor` (primary field, large, prefixed `R$`, autofocus, BRL mask)
2. `Descricao` (optional)
3. `Categoria` (combobox-like input with suggestions and free entry)
4. `Conta` (required)
5. `Data` (defaults to today)
6. `Detalhes (opcional)` collapsible section:
   - `Metodo`
   - `Pessoa relacionada`

Additional control:

- `Salvar e adicionar outra` toggle

### Transfer Flow (`Transferencia`)

Field order:

1. `Valor`
2. `Data`
3. `Conta de origem`
4. `Conta de destino`
5. `Descricao` (optional)

Additional controls:

- `Inverter contas`
- inline preview of balance impact, for example: `Itau ↓ R$ 120,00 | Bradesco ↑ R$ 120,00`

## Defaults and Automation

- `Data` defaults to the current local date.
- `Conta` defaults to the last used account stored in `localStorage`, with fallback to the first available account.
- `Metodo` defaults to the last used payment method.
- `Salvar e adicionar outra` is persisted as a user preference.
- Category suggestions are built from known category ids already visible in frontend state and still allow free typing.

On successful save:

- with `Salvar e adicionar outra` enabled, clear only variable fields and keep sticky defaults
- otherwise, reset to a clean state while preserving persisted defaults

## Keyboard and Accessibility

- `Tab` follows the primary field order
- `Enter` submits the active form
- `Ctrl+Enter` submits and prepares another entry
- `Esc` clears the current form
- visible focus states remain prominent
- labels, helper text, and inline validation stay in pt-BR

## Error Handling and Feedback

- transfer blocks `Conta de origem == Conta de destino`
- inline validation messages appear next to the relevant controls
- submit buttons disable during request execution
- empty or loading account states show local skeleton/placeholder UI
- success feedback is presented near the form like a toast/banner
- `Desfazer` is shown as unavailable until backend undo exists, avoiding fake behavior

## Testing Strategy

Add frontend coverage for:

- mode switching and one-form-at-a-time rendering
- async account hydration with persisted defaults
- BRL masking and cents conversion
- localStorage persistence behavior
- keyboard shortcuts
- transfer guardrails and account inversion
- submit reset behavior for standard save and `Salvar e adicionar outra`

## Delivery Constraints

- keep all visible copy in pt-BR
- do not break existing routes
- preserve current backend API contracts
- avoid reverting unrelated local changes in the working tree
