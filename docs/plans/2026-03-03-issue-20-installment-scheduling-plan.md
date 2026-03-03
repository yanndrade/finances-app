# Issue 20 Installment Scheduling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add installment-aware card purchases so one purchase can generate deterministic monthly installments across future invoices and the dashboard can read monthly installment impact.

**Architecture:** Extend the existing `CardPurchaseCreated` event payload with `installments_count`, keep the event store unchanged in shape, and move all installment expansion into the projector. The frontend continues to use the existing cards screen, adding only the extra form field and updated invoice presentation.

**Tech Stack:** Python, FastAPI, SQLAlchemy, SQLite, React, TypeScript, Vitest, Testing Library

---

### Task 1: Add failing backend tests for installment domain and projector behavior

**Files:**
- Modify: `packages/backend/tests/test_cards_domain.py`
- Modify: `packages/backend/tests/test_projector.py`
- Modify: `packages/backend/tests/test_app.py`

**Step 1: Write the failing tests**

- Add a domain test for deterministic remainder handling (last installment gets extra cents).
- Add a projector test proving one purchase with `installments_count=3` creates three installment rows and spreads invoice totals into current and future cycles.
- Add an API test proving `POST /api/card-purchases` accepts `installments_count` and invoice listing reflects split totals.

**Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/test_cards_domain.py tests/test_projector.py tests/test_app.py -k "installment or installments" -v`

Expected: FAIL because the current service and projector do not know `installments_count` or installment projections.

**Step 3: Commit**

```bash
git add packages/backend/tests/test_cards_domain.py packages/backend/tests/test_projector.py packages/backend/tests/test_app.py
git commit -m "test: cover installment scheduling projections"
```

### Task 2: Implement backend installment scheduling

**Files:**
- Modify: `packages/backend/src/finance_app/domain/cards.py`
- Modify: `packages/backend/src/finance_app/application/card_purchases.py`
- Modify: `packages/backend/src/finance_app/domain/projections.py`
- Modify: `packages/backend/src/finance_app/infrastructure/projector.py`
- Modify: `packages/backend/src/finance_app/interfaces/http/app.py`

**Step 1: Write minimal implementation**

- Add a domain helper that splits total cents into deterministic installments and shifts invoice allocation by month.
- Accept and validate `installments_count` in the service and HTTP schema.
- Add projection records and serialization for installment rows.
- Update invoice aggregation and dashboard summary to use installment materialization.
- Extend schema rebuild detection for the new table/columns.

**Step 2: Run backend tests**

Run: `uv run pytest tests/test_cards_domain.py tests/test_projector.py tests/test_app.py -v`

Expected: PASS

**Step 3: Commit**

```bash
git add packages/backend/src/finance_app/domain/cards.py packages/backend/src/finance_app/application/card_purchases.py packages/backend/src/finance_app/domain/projections.py packages/backend/src/finance_app/infrastructure/projector.py packages/backend/src/finance_app/interfaces/http/app.py packages/backend/tests/test_cards_domain.py packages/backend/tests/test_projector.py packages/backend/tests/test_app.py
git commit -m "feat: add installment scheduling for card purchases"
```

### Task 3: Add failing frontend tests for installment purchase flow

**Files:**
- Modify: `packages/frontend/src/lib/api.ts`
- Create or Modify: `packages/frontend/src/lib/api.test.ts`
- Modify: `packages/frontend/src/App.test.tsx`
- Modify: `packages/frontend/src/features/cards/cards-view.tsx`

**Step 1: Write the failing tests**

- Add a client test asserting `createCardPurchase()` sends `installments_count`.
- Add an app/cards UI test asserting the purchase form accepts installments and the invoice summary reflects the split invoice value for the first cycle.

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/lib/api.test.ts src/App.test.tsx`

Expected: FAIL because the payload and UI do not include installment handling yet.

**Step 3: Commit**

```bash
git add packages/frontend/src/lib/api.test.ts packages/frontend/src/App.test.tsx
git commit -m "test: cover installment purchase ui flow"
```

### Task 4: Implement frontend installment input and invoice display updates

**Files:**
- Modify: `packages/frontend/src/lib/api.ts`
- Modify: `packages/frontend/src/features/cards/cards-view.tsx`
- Modify: `packages/frontend/src/App.tsx`
- Modify: `packages/frontend/src/App.test.tsx`
- Modify: `packages/frontend/src/lib/api.test.ts`

**Step 1: Write minimal implementation**

- Extend types with `installments_count` and updated card purchase summary fields.
- Send `installments_count` from the client API.
- Add the new field and validation to the cards purchase form.
- Update copy and invoice cards to reflect installment-derived invoice item counts.

**Step 2: Run frontend tests**

Run: `npm test -- --run src/lib/api.test.ts src/App.test.tsx`

Expected: PASS

**Step 3: Commit**

```bash
git add packages/frontend/src/lib/api.ts packages/frontend/src/features/cards/cards-view.tsx packages/frontend/src/App.tsx packages/frontend/src/App.test.tsx packages/frontend/src/lib/api.test.ts
git commit -m "feat: add installment fields to card purchase ui"
```

### Task 5: Run full verification and open PR

**Files:**
- No code changes required unless failures appear

**Step 1: Run full verification**

Run: `uv run pytest tests -v`
Run: `npm test -- --run`
Run: `npm run build`

Expected: All passing; frontend build may emit the existing Vite chunk-size warning only.

**Step 2: Review git status**

Run: `git status --short`

Expected: Only intended source and doc changes are staged/committed; transient SQLite and tsbuild files remain unstaged if they still appear.

**Step 3: Open PR**

```bash
gh pr create --base main --head feature/issue-20-installment-scheduling --title "feat: implement installment scheduling for card purchases" --body "## Summary\n- add installment-aware card purchase projections\n- distribute installments into future invoice cycles\n- update cards ui for installment purchases\n\n## Testing\n- uv run pytest tests -v\n- npm test -- --run\n- npm run build"
```
