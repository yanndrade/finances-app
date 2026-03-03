# Issue 17 Desktop Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the first runnable desktop application for the existing cash-flow features, including a monthly dashboard backed by projections.

**Architecture:** Extend the FastAPI backend with a projection-backed dashboard read model, then build a React/Vite desktop-first frontend that consumes the current local HTTP API. Wrap the frontend in a minimal Tauri shell so the app can run as a desktop host without introducing new business logic into the desktop layer.

**Tech Stack:** Git, FastAPI, pytest, React, Vite, TypeScript, Vitest, Tauri, npm

---

### Task 1: Persist the approved design

**Files:**
- Create: `docs/plans/2026-03-03-issue-17-desktop-dashboard-design.md`

**Step 1: Review the saved design**

Run: `Get-Content -Raw docs/plans/2026-03-03-issue-17-desktop-dashboard-design.md`
Expected: the file describes the approved scope, architecture, screens, data flow, and testing strategy

**Step 2: Commit the design doc**

Run:

```bash
git add docs/plans/2026-03-03-issue-17-desktop-dashboard-design.md
git commit -m "docs: add issue 17 desktop dashboard design"
```

Expected: commit created successfully

### Task 2: Add failing backend tests for the dashboard summary

**Files:**
- Modify: `packages/backend/tests/test_projector.py`
- Modify: `packages/backend/tests/test_app.py`

**Step 1: Write the failing test**

Add coverage for:
- monthly inflow and outflow derived from projected transactions
- transfers excluded from inflow and outflow totals
- current balance derived from projected account balances
- `GET /api/dashboard?month=YYYY-MM` end-to-end behavior

**Step 2: Run test to verify it fails**

Run:
- `uv --directory packages/backend run pytest tests/test_projector.py -k dashboard`
- `uv --directory packages/backend run pytest tests/test_app.py -k dashboard`

Expected: FAIL because dashboard query support and endpoint do not exist yet

### Task 3: Implement the backend dashboard endpoint

**Files:**
- Modify: `packages/backend/src/finance_app/infrastructure/projector.py`
- Modify: `packages/backend/src/finance_app/interfaces/http/app.py`
- Optionally modify: `packages/backend/src/finance_app/application/transactions.py`

**Step 1: Write minimal implementation**

Implement:
- a projection-backed query in the projector that returns monthly inflow, outflow, net movement, recent transactions, and current total balance
- a thin FastAPI `GET /api/dashboard` endpoint with `month=YYYY-MM`
- strict month validation that returns `422` for invalid values

**Step 2: Run test to verify it passes**

Run:
- `uv --directory packages/backend run pytest tests/test_projector.py -k dashboard`
- `uv --directory packages/backend run pytest tests/test_app.py -k dashboard`

Expected: PASS

### Task 4: Scaffold the frontend toolchain with failing tests

**Files:**
- Create: `packages/frontend/package.json`
- Create: `packages/frontend/tsconfig.json`
- Create: `packages/frontend/tsconfig.node.json`
- Create: `packages/frontend/vite.config.ts`
- Create: `packages/frontend/vitest.config.ts`
- Create: `packages/frontend/index.html`
- Create: `packages/frontend/src/main.tsx`
- Create: `packages/frontend/src/App.tsx`
- Create: `packages/frontend/src/test/setup.ts`
- Create: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Add a frontend test that expects the app shell to render:
- sidebar navigation
- dashboard heading
- a loading or empty state before data resolves

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend test -- --run`
Expected: FAIL because the frontend toolchain and app shell do not exist yet

### Task 5: Implement the frontend foundation and app shell

**Files:**
- Modify: `packages/frontend/src/App.tsx`
- Modify: `packages/frontend/src/main.tsx`
- Add: `packages/frontend/src/lib/api.ts`
- Add: `packages/frontend/src/lib/format.ts`
- Add: `packages/frontend/src/components/app-shell.tsx`
- Add: `packages/frontend/src/components/sidebar.tsx`

**Step 1: Write minimal implementation**

Implement:
- Vite React entrypoint
- desktop-first app shell with sidebar and primary content area
- shared API client pointing to the local backend
- base theme/styles aligned with the frontend guidelines

**Step 2: Run test to verify it passes**

Run: `npm --prefix packages/frontend test -- --run`
Expected: PASS

### Task 6: Add failing tests for dashboard and movement flows

**Files:**
- Create: `packages/frontend/src/features/dashboard/dashboard-view.test.tsx`
- Create: `packages/frontend/src/features/movements/movements-panel.test.tsx`

**Step 1: Write the failing test**

Cover:
- dashboard cards render API values
- recent transactions preview renders
- income/expense form submits and refreshes data
- transfer form submits and refreshes data
- server validation errors are visible

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend test -- --run`
Expected: FAIL because the feature views do not exist yet

### Task 7: Implement dashboard, accounts, transactions, and forms

**Files:**
- Add: `packages/frontend/src/features/dashboard/dashboard-view.tsx`
- Add: `packages/frontend/src/features/accounts/accounts-view.tsx`
- Add: `packages/frontend/src/features/transactions/transactions-view.tsx`
- Add: `packages/frontend/src/features/movements/movements-panel.tsx`
- Add: `packages/frontend/src/components/stat-card.tsx`
- Add: `packages/frontend/src/components/data-table.tsx`
- Modify: `packages/frontend/src/App.tsx`

**Step 1: Write minimal implementation**

Implement:
- current-month dashboard screen
- accounts balance view
- transaction list with practical filters
- income/expense and transfer forms
- refetch strategy after successful mutations

**Step 2: Run test to verify it passes**

Run: `npm --prefix packages/frontend test -- --run`
Expected: PASS

### Task 8: Add the minimal desktop shell

**Files:**
- Create: `packages/desktop/package.json`
- Create: `packages/desktop/src-tauri/Cargo.toml`
- Create: `packages/desktop/src-tauri/tauri.conf.json`
- Create: `packages/desktop/src-tauri/src/main.rs`

**Step 1: Add the failing verification**

Attempt to run the desktop shell before configuration exists.

Run: `npm --prefix packages/desktop run tauri -- dev`
Expected: FAIL because the Tauri manifest and package scripts do not exist yet

**Step 2: Write minimal implementation**

Implement:
- Tauri manifest targeting the frontend dev server during development
- minimal Rust entrypoint
- desktop package scripts to launch the shell

**Step 3: Run verification**

Run: `npm --prefix packages/desktop run tauri -- dev`
Expected: the desktop host starts and opens the frontend

### Task 9: Verify the full stack and commit in small units

**Files:**
- Modify: repository index

**Step 1: Run backend verification**

Run: `uv --directory packages/backend run pytest`
Expected: PASS

**Step 2: Run frontend verification**

Run:
- `npm --prefix packages/frontend test -- --run`
- `npm --prefix packages/frontend run build`

Expected: PASS

**Step 3: Run manual app verification**

Run:
- backend locally
- frontend locally
- desktop shell locally

Expected: dashboard loads, accounts render, transactions list renders, and movement forms submit successfully

**Step 4: Commit in small logical units**

Use separate commits for:
- design and planning docs
- backend dashboard tests and implementation
- frontend scaffold
- frontend feature UI
- desktop shell

### Task 10: Open the pull request

**Files:**
- Modify: git branch metadata on remote

**Step 1: Push the branch**

Run: `git push -u origin feature/issue-17-desktop-dashboard`
Expected: branch pushed successfully

**Step 2: Open the PR**

Run:

```bash
gh pr create --fill
```

Expected: PR created and linked to the branch
