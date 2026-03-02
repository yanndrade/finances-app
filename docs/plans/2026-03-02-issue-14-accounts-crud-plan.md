# Issue 14 Accounts CRUD And Balance State Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build accounts CRUD with per-account balance state projection and preserve at least one active account once accounts exist.

**Architecture:** Reuse the existing event store and projector. Add account update events, expand the account projection schema, add a dedicated `balance_state` projection table, and expose FastAPI endpoints backed by application-layer services instead of embedding business rules in routes.

**Tech Stack:** uv, FastAPI, SQLAlchemy, SQLite, pytest

---

### Task 1: Write failing behavior tests

**Files:**
- Modify: `packages/backend/tests/test_projector.py`
- Modify: `packages/backend/tests/test_app.py`

**Step 1: Add focused tests**

Cover:
- `AccountCreated` creates an `accounts` row and a `balance_state` row
- `AccountUpdated` changes editable account fields in the projection
- `POST /api/accounts`, `GET /api/accounts`, and `PATCH /api/accounts/{id}` work end-to-end
- deactivating the last active account returns an error

**Step 2: Run the focused tests to verify failure**

Run:
- `uv --directory packages/backend run pytest tests/test_projector.py`
- `uv --directory packages/backend run pytest tests/test_app.py`

Expected: FAIL because the projection and HTTP account flows do not exist yet

### Task 2: Implement account application and projection support

**Files:**
- Modify: `packages/backend/src/finance_app/domain/projections.py`
- Modify: `packages/backend/src/finance_app/application/projector.py`
- Create: `packages/backend/src/finance_app/application/accounts.py`
- Modify: `packages/backend/src/finance_app/infrastructure/projector.py`

**Step 1: Add the account domain flow**

Implement account creation/list/update support, including the guard that prevents deactivating the last active account.

**Step 2: Re-run the focused tests**

Run:
- `uv --directory packages/backend run pytest tests/test_projector.py`
- `uv --directory packages/backend run pytest tests/test_app.py`

Expected: PASS

### Task 3: Final verification and delivery

**Files:**
- Modify: repository index

**Step 1: Run full backend verification**

Run:
- `uv --directory packages/backend run pytest`

Expected: all backend tests pass

**Step 2: Commit**

Run:

```bash
git add .
git commit -m "feat: add accounts CRUD and balance state"
```

Expected: commit created successfully
