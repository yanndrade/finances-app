# Issue 16 Internal Transfers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build linked internal transfers that move balance across accounts without polluting income or expense reporting.

**Architecture:** Reuse the event store and transaction projection introduced in issue 15. Add a transfer application service that appends one `TransferCreated` event, then extend the projector to materialize two `transactions` rows with a shared `transfer_id` and opposing `direction` values while adjusting `balance_state` for both accounts.

**Tech Stack:** uv, FastAPI, SQLAlchemy, SQLite, pytest

---

### Task 1: Write failing transfer tests

**Files:**
- Modify: `packages/backend/tests/test_projector.py`
- Modify: `packages/backend/tests/test_app.py`

**Step 1: Add tests for target behavior**

Cover:
- `TransferCreated` creates linked debit/credit transaction rows
- balances move correctly between accounts
- transfer rows share the same `transfer_id`
- `POST /api/transfers` works end-to-end and rejects invalid account combinations
- upgrading from the issue 15 schema rebuilds the derived projection safely

**Step 2: Run focused tests to verify failure**

Run:
- `uv --directory packages/backend run pytest tests/test_projector.py`
- `uv --directory packages/backend run pytest tests/test_app.py`

Expected: FAIL because transfer projection and endpoint support do not exist yet

### Task 2: Implement transfer support

**Files:**
- Add: `packages/backend/src/finance_app/application/transfers.py`
- Modify: `packages/backend/src/finance_app/domain/projections.py`
- Modify: `packages/backend/src/finance_app/infrastructure/projector.py`
- Modify: `packages/backend/src/finance_app/interfaces/http/app.py`

**Step 1: Add transfer creation flow**

Implement:
- transfer validation and event append logic
- projector support for `TransferCreated`
- `transactions` schema expansion for `transfer_id` and `direction`
- `POST /api/transfers`

**Step 2: Re-run focused tests**

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

**Step 2: Commit in small logical units**

Use separate commits for:
- docs
- transfer tests + implementation
- any follow-up fix from verification or review feedback
