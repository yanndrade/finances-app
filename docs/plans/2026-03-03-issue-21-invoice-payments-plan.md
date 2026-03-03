# Issue 21 Invoice Payments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full and partial invoice payment flows so invoice payments update invoice state and create real cash outflows from active accounts.

**Architecture:** Introduce a dedicated invoice payment use case that emits `InvoicePaid`, then project that event into invoice payment totals/status and a derived expense transaction. Extend the existing cards UI with a payment modal wired to the new endpoint.

**Tech Stack:** Python, FastAPI, SQLAlchemy, SQLite, React, TypeScript, Vitest, Testing Library

---

### Task 1: Add failing backend tests for invoice payments

**Files:**
- Modify: `packages/backend/tests/test_projector.py`
- Modify: `packages/backend/tests/test_app.py`

**Step 1: Write the failing tests**

- Add a projector test for `InvoicePaid` updating `paid_amount`, `remaining_amount`, and invoice `status`.
- Add a projector or app-level test proving account balance drops through the derived expense transaction.
- Add an API test for partial payment followed by final payment, ending in `paid`.

**Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_projector.py tests/test_app.py -k "invoice_paid or invoice payment" -v`

Expected: FAIL because no payment endpoint, event handling, or invoice payment projection exists yet.

**Step 3: Commit**

```bash
git add packages/backend/tests/test_projector.py packages/backend/tests/test_app.py
git commit -m "test: cover invoice payment flow"
```

### Task 2: Implement backend invoice payment flow

**Files:**
- Create: `packages/backend/src/finance_app/application/invoice_payments.py`
- Modify: `packages/backend/src/finance_app/domain/projections.py`
- Modify: `packages/backend/src/finance_app/infrastructure/projector.py`
- Modify: `packages/backend/src/finance_app/interfaces/http/app.py`

**Step 1: Write minimal implementation**

- Create the invoice payment service with validation for invoice existence, active account, UTC timestamp, and positive amount.
- Add the `InvoicePaid` endpoint and request model.
- Extend invoice projections with paid/remaining totals.
- Project `InvoicePaid` into:
  - invoice totals/status
  - a derived expense transaction + balance impact
- Extend schema rebuild detection for the new invoice columns.

**Step 2: Run backend verification**

Run: `uv run pytest tests/test_projector.py tests/test_app.py -v`

Expected: PASS

**Step 3: Commit**

```bash
git add packages/backend/src/finance_app/application/invoice_payments.py packages/backend/src/finance_app/domain/projections.py packages/backend/src/finance_app/infrastructure/projector.py packages/backend/src/finance_app/interfaces/http/app.py packages/backend/tests/test_projector.py packages/backend/tests/test_app.py
git commit -m "feat: add invoice payment backend flow"
```

### Task 3: Add failing frontend tests for invoice payment UI

**Files:**
- Modify: `packages/frontend/src/lib/api.test.ts`
- Modify: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing tests**

- Add an API test for `payInvoice()` payload shape.
- Add an app/cards test that pays an open invoice and expects status/remaining amount to update.

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/api.test.ts src/App.test.tsx`

Expected: FAIL because there is no payment client or UI flow yet.

**Step 3: Commit**

```bash
git add packages/frontend/src/lib/api.test.ts packages/frontend/src/App.test.tsx
git commit -m "test: cover invoice payment ui flow"
```

### Task 4: Implement frontend invoice payment flow

**Files:**
- Modify: `packages/frontend/src/lib/api.ts`
- Modify: `packages/frontend/src/features/cards/cards-view.tsx`
- Modify: `packages/frontend/src/App.tsx`
- Modify: `packages/frontend/src/App.test.tsx`
- Modify: `packages/frontend/src/lib/api.test.ts`

**Step 1: Write minimal implementation**

- Add `payInvoice()` and invoice payment payload types.
- Extend `InvoiceSummary` with `paid_amount` and `remaining_amount`.
- Add a payment modal to the cards UI for open/partial invoices.
- List active accounts only and default to the card payment account when available.
- Refresh invoice presentation to show status and paid/remaining amounts.

**Step 2: Run frontend verification**

Run: `npm test -- --run src/lib/api.test.ts src/App.test.tsx`

Expected: PASS

**Step 3: Commit**

```bash
git add packages/frontend/src/lib/api.ts packages/frontend/src/features/cards/cards-view.tsx packages/frontend/src/App.tsx packages/frontend/src/App.test.tsx packages/frontend/src/lib/api.test.ts
git commit -m "feat: add invoice payment ui flow"
```

### Task 5: Run full verification and open PR

**Files:**
- No code changes required unless failures appear

**Step 1: Run full verification**

Run: `uv run pytest tests -v`
Run: `npm test -- --run`
Run: `npm run build`

Expected: All passing; frontend build may emit only the known Vite chunk-size warning.

**Step 2: Review git status**

Run: `git status --short`

Expected: Only intended source/doc changes are committed; generated SQLite/tsbuild files remain unstaged if present.

**Step 3: Open PR**

```bash
gh pr create --base main --head feature/issue-21-invoice-payments --title "feat: implement invoice payment flow" --body "## Summary\n- add invoice payment events and status transitions\n- project invoice payments into cash outflows\n- add cards ui flow for paying invoices\n\n## Testing\n- uv run pytest tests -v\n- npm test -- --run\n- npm run build"
```
