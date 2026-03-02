# Issue 11 SQLite Event Store Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first version of `events.db` as an append-only SQLite event store with schema version support.

**Architecture:** Add an event-store-specific infrastructure module that owns the `events` table model and append path, while the application layer exposes a single append use case for future business commands. Use Alembic for the initial `events` table revision so the schema starts with migration history instead of ad-hoc bootstrap logic.

**Tech Stack:** uv, SQLAlchemy, Alembic, SQLite, pytest

---

### Task 1: Write failing event store tests

**Files:**
- Create: `packages/backend/tests/test_event_store.py`

**Step 1: Write tests for the target behavior**

Cover:
- stable default `events.db` path
- append-only event writes with auto-incremented IDs
- WAL mode on the events database
- atomic failure on invalid payload serialization

**Step 2: Run tests to verify failure**

Run: `uv --directory packages/backend run pytest tests/test_event_store.py`
Expected: FAIL because the event store code does not exist yet

### Task 2: Implement the event store

**Files:**
- Modify: `packages/backend/src/finance_app/infrastructure/db.py`
- Create: `packages/backend/src/finance_app/domain/events.py`
- Create: `packages/backend/src/finance_app/application/event_store.py`
- Create: `packages/backend/src/finance_app/infrastructure/event_store.py`
- Modify: `packages/backend/alembic/env.py`
- Modify: `packages/backend/README.md`

**Step 1: Add event database helpers and append path**

Implement the minimal repository and use case needed to append versioned events safely.

**Step 2: Re-run tests**

Run: `uv --directory packages/backend run pytest tests/test_event_store.py`
Expected: PASS

### Task 3: Generate the initial migration

**Files:**
- Create: `packages/backend/alembic/versions/<revision>_create_events_table.py`

**Step 1: Create the Alembic revision**

Run: `uv --directory packages/backend run alembic revision -m "create events table"`
Expected: a new revision file is created

**Step 2: Fill the revision**

Implement `upgrade()` and `downgrade()` for the `events` table schema defined by the PRD.

### Task 4: Final verification and commit

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
git commit -m "feat: implement sqlite event store"
```

Expected: commit created successfully
