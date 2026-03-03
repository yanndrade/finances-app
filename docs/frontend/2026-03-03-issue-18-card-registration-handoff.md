# Issue 18 Frontend Handoff: Card Registration

## Objective

Document the current backend baseline, clarify what is still missing for issue 18, and define the frontend changes required to add card registration and editing without expanding into purchase or invoice flows yet.

## Reference Sources

- `PRD.md`
- `FRONTEND-GUIDELINES.md`
- `packages/backend/src/finance_app/interfaces/http/app.py`
- `packages/backend/src/finance_app/application/accounts.py`
- `packages/backend/tests/test_app.py`
- `packages/frontend/src/App.tsx`
- `packages/frontend/src/components/sidebar.tsx`
- `packages/frontend/src/features/accounts/accounts-view.tsx`
- `packages/frontend/src/features/movements/movements-panel.tsx`
- `packages/frontend/src/lib/api.ts`

## Current Backend Baseline

The backend is already structured around FastAPI plus an event-store/projector flow. Today it supports:

- account creation, listing, and editing
- cash income and expense creation
- transaction filtering, editing, and voiding
- internal transfers
- monthly dashboard summary
- development reset endpoint

This is relevant for issue 18 because the card flow must plug into an application that already treats accounts as the source of cash balance and keeps transaction state audit-friendly.

### What Already Exists and Can Be Reused

- Accounts already have stable identifiers and an active/inactive lifecycle.
- The frontend already loads `accounts` globally in `App.tsx`, so the card form can reuse this data to select the default payment account.
- The existing UI already has reusable patterns for this kind of management screen:
  - `StatCard` for top summaries
  - `panel-card` sections for main content blocks
  - `Modal` for create/edit forms
  - toast-based success/error feedback in `App.tsx`

### What Does Not Exist Yet

There is currently no card domain in the backend:

- no `CardCreated` or `CardUpdated` event
- no `CardService`
- no `/api/cards` endpoints
- no card projection table or card-specific read model
- no frontend types or API client functions for cards
- no dedicated "Cards" screen in navigation

For issue 18, the backend still needs to add card persistence and validation before the frontend can become functional.

## Backend Contract Required for Issue 18

Issue 18 is intentionally narrow. The backend scope should stop at card setup and editing.

### Fields

Each card record needs:

- `card_id`
- `name`
- `limit`
- `closing_day`
- `due_day`
- `payment_account_id`
- `is_active` (recommended now, to avoid future shape churn when cards are archived)

### Validation Rules

The backend must reject invalid cycle dates:

- `closing_day` must be between `1` and `28`
- `due_day` must be between `1` and `28`
- `payment_account_id` must reference an existing account

Recommended response behavior:

- `422` for invalid `closing_day` or `due_day`
- `404` when the selected payment account does not exist
- `409` when trying to create a duplicated card id

### Minimum Endpoints

- `GET /api/cards`
- `POST /api/cards`
- `PATCH /api/cards/{card_id}`

Recommended payloads:

```json
{
  "id": "card-1",
  "name": "Nubank Ultravioleta",
  "limit": 150000,
  "closing_day": 10,
  "due_day": 20,
  "payment_account_id": "acc-1"
}
```

```json
{
  "name": "Nubank",
  "limit": 180000,
  "closing_day": 8,
  "due_day": 18,
  "payment_account_id": "acc-2",
  "is_active": true
}
```

Recommended response shape:

```json
{
  "card_id": "card-1",
  "name": "Nubank Ultravioleta",
  "limit": 150000,
  "closing_day": 10,
  "due_day": 20,
  "payment_account_id": "acc-1",
  "is_active": true
}
```

## Frontend Scope for Issue 18

The frontend should add a card management flow that feels consistent with the existing desktop shell and stays inside the current issue boundary.

### What Should Be Added

- A new top-level view: `cards`
- A new management page for list/create/edit of cards
- API client methods and TypeScript types for cards
- Form validation for cycle-day constraints before submission
- Account selector bound to the existing account list

### What Should Not Be Added Yet

To keep the milestone incremental and avoid mixing issue 18 with later work:

- no invoice charts
- no invoice list
- no purchase-entry flow for `CARD:<id>`
- no installment UI
- no dashboard card utilization widgets yet
- no removal of existing screens

For this issue, "cards" means registration and editing only.

## UI Integration Plan

### Navigation

Add `cards` as a first-class route in the desktop sidebar.

Recommended placement:

- `Dashboard`
- `Transactions`
- `Accounts`
- `Cards`
- `Movements`
- `Settings`

Reasoning:

- It sits next to `Accounts` because both are setup/structure entities.
- It should not live inside `Movements`, because card registration is configuration, not daily cash entry.

Files to update:

- `packages/frontend/src/components/sidebar.tsx`
- `packages/frontend/src/App.tsx`

### New View

Create a dedicated screen:

- `packages/frontend/src/features/cards/cards-view.tsx`

This screen should mirror the existing management pattern used by `AccountsView`:

- top summary strip with `StatCard`
- one main `panel-card` for card listing
- create button opening a modal
- edit action per row/card opening a modal

Recommended stat cards:

- `Cartoes cadastrados`
- `Limite total ativo`

Do not add graphs here yet. This issue is setup-only, and a chart would add visual weight without helping the task.

### List Layout

Use a card grid or compact rows, matching the current visual language already used by `AccountsView`.

Each listed card should show:

- card name
- total limit
- closing day
- due day
- linked payment account name
- active/inactive badge
- edit action

The account name should be resolved client-side from the existing `accounts` collection already loaded in `App.tsx`.

### Create/Edit Form

The form should reuse the current modal pattern instead of introducing a different interaction model.

Required fields:

- `Nome do cartao`
- `Limite`
- `Dia de fechamento`
- `Dia de vencimento`
- `Conta padrao para pagamento`

Recommended interactions:

- autofocus on the name field
- numeric inputs for `closing_day` and `due_day`
- inline helper text explaining the allowed range `1 a 28`
- disable submit while `isSubmitting` is true
- in edit mode, optionally include `Cartao ativo` checkbox if backend exposes `is_active`

Validation rules in the UI:

- block submit when `closing_day < 1 || closing_day > 28`
- block submit when `due_day < 1 || due_day > 28`
- block submit when no payment account is selected

The UI must validate before request, but backend validation remains the source of truth.

### Feedback and Error States

Reuse the current global toast flow in `App.tsx`:

- success toast after create
- success toast after edit
- error toast on backend validation failure

Inline messaging is still useful inside the form for immediate invalid day ranges, but request failures should continue to flow through the global toast pattern already established.

## Visual Direction

Follow `FRONTEND-GUIDELINES.md`, but preserve the current app language instead of starting a parallel design system.

### Keep

- generous whitespace
- dense but readable data presentation
- keyboard-friendly forms
- current desktop shell with left sidebar
- current modal interaction for setup flows

### Apply from the Guidelines

- treat numbers as primary content
- keep the layout clean and data-first
- maintain strong primary actions
- use finance semantics consistently:
  - neutral for metadata
  - positive only for successful state or healthy status
  - avoid red unless there is an actual validation problem

### Do Not Do in This Issue

- no full shadcn migration
- no redesign of dashboard
- no chart-heavy card page
- no mobile-specific custom route yet

The current repo already has an established custom CSS system. Issue 18 should extend it, not replace it.

## Frontend Data Layer Changes

Add the following to `packages/frontend/src/lib/api.ts`:

- `CardSummary` type
- `CardPayload` type
- `CardUpdatePayload` type
- `fetchCards()`
- `createCard()`
- `updateCard()`

Recommended shapes:

```ts
export type CardSummary = {
  card_id: string;
  name: string;
  limit: number;
  closing_day: number;
  due_day: number;
  payment_account_id: string;
  is_active: boolean;
};
```

```ts
export type CardPayload = {
  name: string;
  limitInCents: number;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string;
};
```

```ts
export type CardUpdatePayload = CardPayload & {
  isActive: boolean;
};
```

`App.tsx` will also need:

- `cards` state
- load cards during `refreshData()`
- create/update handlers wired into `runMutation()`
- route rendering for `CardsView`

## Suggested File Changes

### Create

- `docs/frontend/2026-03-03-issue-18-card-registration-handoff.md`
- `packages/frontend/src/features/cards/cards-view.tsx`

### Modify

- `packages/frontend/src/App.tsx`
- `packages/frontend/src/components/sidebar.tsx`
- `packages/frontend/src/lib/api.ts`
- `packages/frontend/src/styles.css`

## Testing Expectations

For the frontend implementation phase, the minimum useful coverage is:

- render the cards screen with empty state
- create-form validation rejects days outside `1..28`
- successful card creation calls the API and refreshes data
- edit flow preloads existing values

For the backend implementation phase, the minimum useful coverage is:

- create card accepts valid days
- create card rejects `0`, `29`, and missing payment account
- update card preserves payment account linkage
- list cards returns the stored relationship

## Delivery Notes

This document intentionally limits issue 18 to structural setup. The next milestone steps (purchases, invoice cycles, installments, and payment flows) should build on this card record rather than being partially mixed into this issue.
