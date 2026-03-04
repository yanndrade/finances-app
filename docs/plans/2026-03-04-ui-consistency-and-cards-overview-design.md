# UI Consistency And Cards Overview Design

## Context

The frontend currently mixes two visual systems:

- `cards-view.tsx` uses a stronger editorial hierarchy, heavier typography, and denser card-based layout.
- `accounts-view.tsx`, `transactions-view.tsx`, `dashboard-view.tsx`, and `movements-panel.tsx` still use a more utilitarian structure with repeated headings and longer explanatory copy.

This creates two user-facing issues:

- The pages feel inconsistent in visual tone and spacing.
- The top of many screens repeats the same information twice: once in `AppShell`, then again inside the feature view.

The approved direction is to make the shell header the single semantic page header, reduce redundant copy, and make `Cartoes` open in a consolidated overview before drilling into a specific card.

## Goals

- Use `AppShell` as the only page-level header across the app.
- Remove duplicate `h1` and supporting copy inside feature views.
- Shorten top-level microcopy so the interface feels cleaner.
- Align `Contas`, `Transacoes`, `Visao geral`, and `Movimentar` with the stronger visual language introduced by `Cartoes`.
- Change `Cartoes` so the default state is a portfolio-level invoice overview, with an optional drill-down by card.

## Non-Goals

- No backend API changes are required for the first pass.
- No major domain-model change is required for cards or invoices.
- No new navigation sections are being introduced.

## Information Hierarchy

### Global Header

`AppShell` remains the single page header and owns:

- version eyebrow
- page title
- one short support sentence
- global primary action (`Lancamento`)

The shell copy should be tightened to short, functional descriptions:

- `Visao geral`: "Resumo do mes e alertas."
- `Transacoes`: "Filtro, ajuste e historico."
- `Contas`: "Saldos e estrutura da carteira."
- `Cartoes`: "Faturas, ciclos e compras."
- `Movimentar`: "Registrar entradas, saidas e transferencias."
- `Configuracoes`: "Ferramentas e preferencias."

### View-Level Content

Feature views should start directly with:

- a functional toolbar, or
- KPI cards / content blocks

They should not repeat page titles or explanatory paragraphs already covered by the shell.

## Shared UI Pattern

All primary screens should converge on the same pattern:

1. Shell header
2. Compact in-view toolbar or first KPI row
3. Main content blocks

The style reference is the stronger hierarchy from `Cartoes`, but applied with restraint:

- no duplicate headings
- tighter copy
- stronger labels and numeric emphasis
- clear cards and control bars

## Screen-by-Screen Changes

### Visao geral

- Remove the internal "Resumo financeiro" heading block.
- Keep only the month selector as the in-view toolbar.
- Let the first visible content after the shell be the selector and KPI area.

### Contas

- Remove the `Carteira / Mapa de contas / Gerencie...` intro block.
- Keep the stats row.
- Keep search, sort, and `Adicionar conta`.
- Restyle the filter/action row to feel closer to `Cartoes`: clearer grouping, cleaner spacing, stronger type.

### Transacoes

- Remove the `Transacoes / Historico e filtros` intro block.
- Start directly with the filter form.
- Keep editing and list sections, but visually tighten labels and spacing.

### Movimentar

- Remove repeated heading blocks.
- Start directly with the mode selector and active form.
- Keep the existing quick-entry focus, but reduce explanatory copy.

### Cartoes

- Remove the internal `Cartoes e Ciclos` title block.
- Replace it with a compact toolbar that controls period, scope, and the primary local action.
- Make the default scope `Todos os cartoes`.

## New Cards Experience

### Default State

When the user enters `Cartoes`, the default state is:

- tab: `Resumo`
- scope: `Todos os cartoes`
- period: current month

### Cards Toolbar

The top control row inside `Cartoes` should include:

- period selector / month navigation
- scope selector:
  - `Todos os cartoes`
  - each active card
- local primary action (`Novo`)

This is a functional toolbar, not a second page header.

### Resumo Tab

The `Resumo` tab becomes the new default landing experience and shows:

- total em aberto
- total pago no periodo
- quantidade de faturas abertas
- proximos vencimentos

Below that, show a portfolio-level invoice list/grid:

- card name
- invoice reference month
- open/partial/paid status
- remaining amount
- due date

This gives the user an immediate cross-card snapshot.

### Drill-Down By Card

When the scope selector changes to a specific card:

- the same screen switches from aggregate view to card-specific detail
- the richer visual treatment already present in `cards-view.tsx` becomes the detail mode

This preserves the existing premium card-detail UI, but only after the user intentionally narrows the scope.

### Compras And Ajustes Tabs

Tabs keep the same labels:

- `Resumo`
- `Compras`
- `Ajustes`

They should respect the selected scope:

- `Todos os cartoes`: aggregated or cross-card content
- specific card: card-scoped content

## Data Approach

The first implementation should keep data aggregation in the frontend:

- use the already-fetched `cards` and `invoices` arrays
- derive grouped invoice summaries in `cards-view.tsx`
- keep scope and selected period as local UI state

This avoids introducing backend work before the UX is validated.

## Testing Strategy

The implementation should update tests to match the new hierarchy:

- stop relying on removed duplicate headings
- assert the shell header remains the main visible title
- add tests for `Cartoes`:
  - opens in aggregate mode
  - shows portfolio invoice summary by default
  - switches to a specific card scope
  - keeps tabs aligned with the selected scope

## Implementation Notes

- Start with structure and tests, not visual polish.
- Reuse the strongest parts of the current `Cartoes` language, but avoid turning every screen into a duplicate of that page.
- Keep copy minimal; only retain helper text that changes user decisions.
