# Issue 13 App Lock And Password Hashing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first local app lock and password hashing foundation using Argon2id with no plaintext password storage.

**Architecture:** Add a security-specific infrastructure module backed by `app.db`, with one table for persisted credential settings and one for mutable lock state. Keep the public API in the application layer so desktop startup and future inactivity policies can call use cases instead of raw persistence or hashing helpers.

**Tech Stack:** uv, argon2-cffi, SQLAlchemy, SQLite, pytest

---

### Task 1: Add the hashing dependency

**Files:**
- Modify: `packages/backend/pyproject.toml`
- Modify: `packages/backend/uv.lock`

**Step 1: Install Argon2**

Run: `uv --directory packages/backend add argon2-cffi`
Expected: dependency added to the backend project

### Task 2: Write failing security tests

**Files:**
- Create: `packages/backend/tests/test_security.py`

**Step 1: Write tests for the target behavior**

Cover:
- password setup stores only a strong hash
- correct password verifies and wrong password fails
- app can be locked and unlocked
- startup can detect that the app should be locked

**Step 2: Run the tests to verify failure**

Run: `uv --directory packages/backend run pytest tests/test_security.py`
Expected: FAIL because the security code does not exist yet

### Task 3: Implement the security foundation

**Files:**
- Create: `packages/backend/src/finance_app/domain/security.py`
- Create: `packages/backend/src/finance_app/application/security.py`
- Create: `packages/backend/src/finance_app/infrastructure/security.py`
- Modify: `packages/backend/README.md`

**Step 1: Add the persisted credential and lock flow**

Implement password setup, password verification, lock, unlock, and startup lock checks.

**Step 2: Re-run the focused tests**

Run: `uv --directory packages/backend run pytest tests/test_security.py`
Expected: PASS

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
git commit -m "feat: add app lock and password hashing foundation"
```

Expected: commit created successfully
