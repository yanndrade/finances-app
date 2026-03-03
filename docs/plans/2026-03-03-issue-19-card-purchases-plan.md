# Issue 19 Card Purchases Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add card purchase creation with PRD-compliant invoice cycle allocation and a desktop UI flow for launching and reviewing card purchases.

**Architecture:** Persist purchases as events and materialize invoice rows as projections derived from purchase events. Extend the existing cards screen with a purchase form and invoice summary so the UI stays aligned with the current shell and avoids mixing card commitment data into cash transactions.

**Tech Stack:** FastAPI, SQLAlchemy, SQLite, React, Vite, Vitest

---

### Task 1: Backend Regression Tests

**Files:**
- Modify: `packages/backend/tests/test_app.py`
- Modify: `packages/backend/tests/test_projector.py`

**Step 1: Write the failing tests**

- Add API tests for:
  - creating a card purchase
  - verifying closing-day allocation
  - listing invoices with correct totals
- Add projector tests for:
  - invoice month derivation
  - no invoice rows when there are no purchases

**Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_app.py -k card_purchase -v`
Expected: FAIL because endpoints and projections do not exist yet

**Step 3: Write minimal implementation**

- Add the new service, projection records, and event handling required by the tests.

**Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_app.py -k card_purchase -v`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/tests/test_app.py packages/backend/tests/test_projector.py packages/backend/src/finance_app
git commit -m "feat: add card purchase backend"
```

### Task 2: Frontend Integration Tests

**Files:**
- Modify: `packages/frontend/src/App.test.tsx`
- Modify: `packages/frontend/src/features/cards/cards-view.tsx` (after test)

**Step 1: Write the failing test**

- Add an app-level test covering:
  - navigating to `Cards`
  - opening purchase form
  - submitting purchase
  - invoice summary refresh

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/App.test.tsx -t "creates a card purchase and refreshes invoices"`
Expected: FAIL because purchase APIs and UI controls do not exist yet

**Step 3: Write minimal implementation**

- Add frontend API methods and render the purchase flow in `CardsView`.

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/App.test.tsx -t "creates a card purchase and refreshes invoices"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/App.test.tsx packages/frontend/src/App.tsx packages/frontend/src/features/cards/cards-view.tsx packages/frontend/src/lib/api.ts
git commit -m "feat: add card purchase UI"
```

### Task 3: Full Verification

**Files:**
- Verify only

**Step 1: Run backend tests**

Run: `uv run pytest tests -v`
Expected: PASS

**Step 2: Run frontend tests**

Run: `npm test -- --run`
Expected: PASS

**Step 3: Run frontend build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit any final test-only adjustments**

```bash
git add .
git commit -m "test: align card purchase coverage"
```
