# Issue 26 Investment Movements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement dedicated investment movements (contribution/withdrawal), advanced investment reporting, and a full investments UI without breaking category budget semantics.

**Architecture:** Add a dedicated investment event + projection (`investment_movements`) and expose read/write APIs for movement recording and aggregated overview by period. Keep budget logic unchanged by excluding investment from the transaction budget pipeline. Extend frontend with a dedicated investments view and integrate investment data into dashboard and quick-add flows.

**Tech Stack:** FastAPI, SQLAlchemy projector/event-store, React + TypeScript, Recharts, Vitest, Pytest.

---

### Task 1: Add backend failing tests for investment movement endpoints and overview

**Files:**
- Modify: `packages/backend/tests/test_app.py`

**Step 1: Write the failing test**

Add tests for:
- `POST /api/investments/movements` with contribution (`contribution_amount + dividend_amount`)
- `POST /api/investments/movements` with withdrawal (`cash_amount + invested_reduction_amount`)
- `GET /api/investments/overview` with `view=monthly`
- assertion that budgets remain unchanged after investment movements

**Step 2: Run test to verify it fails**

Run: `python -m pytest packages/backend/tests/test_app.py -k investment -q`
Expected: FAIL with missing route/service behavior.

**Step 3: Write minimal implementation**

Do not implement yet beyond test scaffolding for this task.

**Step 4: Run test to verify it still fails for expected reason**

Run: `python -m pytest packages/backend/tests/test_app.py -k investment -q`
Expected: FAIL due to unimplemented endpoints.

**Step 5: Commit**

```bash
git add packages/backend/tests/test_app.py
git commit -m "test: add failing app tests for investment movements"
```

### Task 2: Add backend failing projector tests for investment projection and aggregation

**Files:**
- Modify: `packages/backend/tests/test_projector.py`

**Step 1: Write the failing test**

Add tests for:
- applying `InvestmentMovementRecorded` updates projection rows
- cash balance delta is applied to target account
- overview aggregation returns expected series buckets

**Step 2: Run test to verify it fails**

Run: `python -m pytest packages/backend/tests/test_projector.py -k investment -q`
Expected: FAIL with missing projector table/event handlers/overview methods.

**Step 3: Write minimal implementation**

Do not implement yet beyond test scaffolding for this task.

**Step 4: Run test to verify it still fails for expected reason**

Run: `python -m pytest packages/backend/tests/test_projector.py -k investment -q`
Expected: FAIL due to unimplemented backend behavior.

**Step 5: Commit**

```bash
git add packages/backend/tests/test_projector.py
git commit -m "test: add failing projector tests for investments"
```

### Task 3: Implement backend domain/application + projector support

**Files:**
- Create: `packages/backend/src/finance_app/application/investments.py`
- Modify: `packages/backend/src/finance_app/interfaces/http/app.py`
- Modify: `packages/backend/src/finance_app/infrastructure/projector.py`
- Modify: `packages/backend/src/finance_app/domain/projections.py`

**Step 1: Write minimal implementation**

Implement:
- `InvestmentService` with input validation and event append
- router models and endpoints:
  - `POST /api/investments/movements`
  - `GET /api/investments/movements`
  - `GET /api/investments/overview`
- projector:
  - investment table schema
  - event handler for `InvestmentMovementRecorded`
  - cash delta application on balance state
  - movement listing and overview aggregation by selected period

**Step 2: Run targeted tests**

Run: `python -m pytest packages/backend/tests/test_app.py -k investment -q`
Expected: PASS

**Step 3: Run projector tests**

Run: `python -m pytest packages/backend/tests/test_projector.py -k investment -q`
Expected: PASS

**Step 4: Run related non-regression backend tests**

Run: `python -m pytest packages/backend/tests/test_app.py -k "budget or dashboard" -q`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/finance_app/application/investments.py packages/backend/src/finance_app/interfaces/http/app.py packages/backend/src/finance_app/infrastructure/projector.py packages/backend/src/finance_app/domain/projections.py
git commit -m "feat: add dedicated investment movements backend"
```

### Task 4: Add frontend failing tests for investments API and UI integration

**Files:**
- Modify: `packages/frontend/src/lib/api.test.ts`
- Modify: `packages/frontend/src/App.test.tsx`
- Create: `packages/frontend/src/features/investments/investments-view.test.tsx`

**Step 1: Write failing tests**

Cover:
- new API calls and payload mapping
- app fetch pipeline includes investment overview/movements
- investments view renders KPIs and chart toggles

**Step 2: Run tests to verify fail**

Run: `npm --prefix packages/frontend test -- --run src/lib/api.test.ts src/App.test.tsx src/features/investments/investments-view.test.tsx`
Expected: FAIL due to missing types/components/endpoints.

**Step 3: Commit**

```bash
git add packages/frontend/src/lib/api.test.ts packages/frontend/src/App.test.tsx packages/frontend/src/features/investments/investments-view.test.tsx
git commit -m "test: add failing frontend tests for investments flow"
```

### Task 5: Implement frontend investments feature and dashboard integration

**Files:**
- Modify: `packages/frontend/src/lib/api.ts`
- Modify: `packages/frontend/src/components/sidebar.tsx`
- Modify: `packages/frontend/src/App.tsx`
- Modify: `packages/frontend/src/features/dashboard/dashboard-view.tsx`
- Modify: `packages/frontend/src/features/dashboard/dashboard-bento.tsx`
- Modify: `packages/frontend/src/components/quick-add-composer.tsx`
- Create: `packages/frontend/src/features/investments/investments-view.tsx`

**Step 1: Implement types and API clients**

Add:
- movement payload/summary types
- overview response types
- fetch/create helpers for investments endpoints

**Step 2: Implement investments page**

Add:
- KPI cards
- period selector
- contribution/dividend dual-line chart with toggles
- wealth evolution chart
- contribution and withdrawal forms
- movement list table

**Step 3: Integrate app routing and dashboard card**

- add `investments` view to sidebar and app routing
- wire dashboard investment goal card to dedicated investment summary
- keep quick-add contribution/resgate flows

**Step 4: Run targeted frontend tests**

Run: `npm --prefix packages/frontend test -- --run src/features/investments/investments-view.test.tsx src/App.test.tsx src/lib/api.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/lib/api.ts packages/frontend/src/components/sidebar.tsx packages/frontend/src/App.tsx packages/frontend/src/features/dashboard/dashboard-view.tsx packages/frontend/src/features/dashboard/dashboard-bento.tsx packages/frontend/src/components/quick-add-composer.tsx packages/frontend/src/features/investments/investments-view.tsx
git commit -m "feat: add investments ui, analytics, and dashboard integration"
```

### Task 6: Full verification and PR preparation

**Files:**
- Modify: `packages/backend/tests/test_app.py` (only if expectation updates needed)
- Modify: `packages/backend/tests/test_projector.py` (only if expectation updates needed)
- Modify: `packages/frontend/src/features/dashboard/dashboard-view.test.tsx` (if startup fetch count changed)

**Step 1: Run backend test suite**

Run: `python -m pytest packages/backend/tests -q`
Expected: PASS

**Step 2: Run frontend test suite**

Run: `npm --prefix packages/frontend test -- --run`
Expected: PASS

**Step 3: Run frontend build**

Run: `npm --prefix packages/frontend run build`
Expected: success

**Step 4: Inspect git diff/status**

Run: `git status --short`
Expected: only intended files changed.

**Step 5: Commit final adjustments**

```bash
git add -A
git commit -m "chore: finalize issue 26 investment movements milestone delivery"
```

