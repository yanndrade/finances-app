# Issue 15 Cash Transactions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build auditable cash income and expense transactions with filtering and per-account balance updates.

**Architecture:** Reuse the existing event store and projector. Add a `transactions` projection table in `app.db`, introduce transaction application services that append transaction events, and make the projector derive both transaction rows and balance deltas from those events. Keep FastAPI routes thin and delegate validation/business rules to the application layer.

**Tech Stack:** uv, FastAPI, SQLAlchemy, SQLite, pytest

---

### Task 1: Write failing transaction tests

**Files:**
- Modify: `packages/backend/tests/test_projector.py`
- Modify: `packages/backend/tests/test_app.py`

**Step 1: Add tests for target behavior**

Cover:
- `IncomeCreated` and `ExpenseCreated` create transaction rows and update balances
- `TransactionUpdated` and `TransactionVoided` preserve history while changing projections
- transaction list filtering supports the issue filter set
- API endpoints create, edit, void, and list transactions end-to-end

**Step 2: Run focused tests to verify failure**

Run:
- `uv --directory packages/backend run pytest tests/test_projector.py`
- `uv --directory packages/backend run pytest tests/test_app.py`

Expected: FAIL because transaction projections and endpoints do not exist yet

### Task 2: Implement transaction projections and application flow

**Files:**
- Add: `packages/backend/src/finance_app/application/transactions.py`
- Modify: `packages/backend/src/finance_app/domain/projections.py`
- Modify: `packages/backend/src/finance_app/infrastructure/projector.py`
- Modify: `packages/backend/src/finance_app/interfaces/http/app.py`

**Step 1: Add transaction create/edit/void/list support**

Implement:
- transaction event append flows
- projector support for `IncomeCreated`, `ExpenseCreated`, `TransactionUpdated`, `TransactionVoided`
- transaction query filters
- balance delta updates tied to transaction state

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
- tests + implementation for transaction flow
- any follow-up fix from verification or review feedback
