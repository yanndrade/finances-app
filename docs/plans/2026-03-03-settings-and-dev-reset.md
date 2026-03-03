# Settings And Dev Reset Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `Configurações` view with a development-only action that wipes all persisted app data and returns the application to a first-run state.

**Architecture:** Extend the frontend navigation with a dedicated settings view and wire a simple reset UI to a new backend endpoint. Implement the destructive reset in the backend persistence layer so both SQLite stores are cleared consistently, then refresh the frontend state from scratch.

**Tech Stack:** Git, FastAPI, Python, pytest, React, TypeScript, Vite, Vitest, Testing Library

---

### Task 1: Persist the approved design

**Files:**
- Create: `docs/plans/2026-03-03-settings-and-dev-reset-design.md`

**Step 1: Review the saved design**

Run: `Get-Content -Raw docs/plans/2026-03-03-settings-and-dev-reset-design.md`
Expected: the file describes the approved scope, navigation, backend reset flow, UX, and test strategy

### Task 2: Add failing backend tests for the reset endpoint

**Files:**
- Modify: `packages/backend/tests/test_app.py`

**Step 1: Write the failing test**

Add coverage that:

- creates baseline data
- calls `POST /api/dev/reset`
- verifies the response indicates success
- verifies `GET /api/accounts` returns an empty list
- verifies `GET /api/transactions` returns an empty list
- verifies `GET /api/dashboard?month=YYYY-MM` returns zeroed summary data

**Step 2: Run test to verify it fails**

Run: `uv --directory packages/backend run pytest tests/test_app.py -k reset`
Expected: FAIL because the reset endpoint does not exist yet

### Task 3: Implement the backend reset endpoint

**Files:**
- Modify: `packages/backend/src/finance_app/interfaces/http/app.py`
- Create or Modify: `packages/backend/src/finance_app/infrastructure/reset.py`

**Step 1: Write minimal implementation**

Implement:

- a reset helper that wipes both configured SQLite databases
- safe recreation of empty database files after deletion
- `POST /api/dev/reset` returning a simple success payload
- recreation of service objects used by the app after reset so future requests operate against fresh stores

**Step 2: Run test to verify it passes**

Run: `uv --directory packages/backend run pytest tests/test_app.py -k reset`
Expected: PASS

### Task 4: Add failing frontend tests for settings navigation and reset

**Files:**
- Modify: `packages/frontend/src/App.test.tsx`
- Optionally modify: `packages/frontend/src/components/sidebar.tsx` tests if split later

**Step 1: Write the failing test**

Add coverage that:

- the sidebar shows a `Configurações` button in the footer
- clicking it renders the settings screen
- confirming reset calls `POST /api/dev/reset`
- after reset, the app shows empty-state baseline data

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend test -- --run src/App.test.tsx`
Expected: FAIL because the settings view and reset API integration do not exist yet

### Task 5: Implement the frontend settings view and reset flow

**Files:**
- Modify: `packages/frontend/src/components/sidebar.tsx`
- Modify: `packages/frontend/src/components/app-shell.tsx` if needed
- Modify: `packages/frontend/src/App.tsx`
- Modify: `packages/frontend/src/lib/api.ts`
- Create: `packages/frontend/src/features/settings/settings-view.tsx`

**Step 1: Write minimal implementation**

Implement:

- new `settings` app view
- sidebar footer action for `Configurações`
- settings page card with development warning copy
- reset API client
- confirmation flow
- disable button while submitting
- navigate back to `dashboard` and refresh state after success

**Step 2: Run test to verify it passes**

Run: `npm --prefix packages/frontend test -- --run src/App.test.tsx`
Expected: PASS

### Task 6: Add styling for the settings screen and footer action

**Files:**
- Modify: `packages/frontend/src/styles.css`

**Step 1: Add minimal styling**

Implement:

- sidebar footer placement for `Configurações`
- settings card layout
- destructive action styling
- desktop-first spacing consistent with the rest of the app

**Step 2: Run verification**

Run:
- `npm --prefix packages/frontend test -- --run`
- `npm --prefix packages/frontend run build`

Expected: PASS

### Task 7: Full verification

**Files:**
- Modify: repository index

**Step 1: Run backend tests**

Run: `uv --directory packages/backend run pytest tests/test_app.py`
Expected: PASS

**Step 2: Run frontend tests**

Run: `npm --prefix packages/frontend test -- --run`
Expected: PASS

**Step 3: Run frontend build**

Run: `npm --prefix packages/frontend run build`
Expected: PASS
