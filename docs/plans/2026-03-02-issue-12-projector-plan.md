# Issue 12 Projector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first projector that materializes `app.db` from `events.db` with `event_cursor` tracking and an initial `accounts` read model.

**Architecture:** Add a projection-specific infrastructure module that owns `app.db` bootstrap, cursor persistence, and replay logic. Keep the public execution seam in the application layer so future interfaces can trigger projection runs or full rebuilds without importing infrastructure details directly.

**Tech Stack:** uv, SQLAlchemy, SQLite, pytest

---

### Task 1: Write failing projector tests

**Files:**
- Create: `packages/backend/tests/test_projector.py`

**Step 1: Write tests for projector behavior**

Cover:
- bootstrap creates `event_cursor`
- `AccountCreated` is projected into `accounts`
- reruns without new events are idempotent
- rebuild replays history into a fresh projection state

**Step 2: Run tests to verify failure**

Run: `uv --directory packages/backend run pytest tests/test_projector.py`
Expected: FAIL because the projector code does not exist yet

### Task 2: Implement the projector

**Files:**
- Create: `packages/backend/src/finance_app/application/projector.py`
- Create: `packages/backend/src/finance_app/domain/projections.py`
- Create: `packages/backend/src/finance_app/infrastructure/projector.py`
- Modify: `packages/backend/src/finance_app/infrastructure/event_store.py`
- Modify: `packages/backend/src/finance_app/infrastructure/db.py`
- Modify: `packages/backend/README.md`

**Step 1: Add bootstrap, cursor tracking, and replay logic**

Implement the minimal projector for `AccountCreated` events.

**Step 2: Re-run the focused tests**

Run: `uv --directory packages/backend run pytest tests/test_projector.py`
Expected: PASS

### Task 3: Final verification and commit

**Files:**
- Modify: repository index

**Step 1: Run verification**

Run:
- `uv --directory packages/backend run pytest`
- `uv --directory packages/backend build --wheel`

Expected: both commands pass

**Step 2: Commit**

Run:

```bash
git add .
git commit -m "feat: implement projector base"
```

Expected: commit created successfully
