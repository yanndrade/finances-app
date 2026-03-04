# Issue 24 Recurring Rules and Monthly Pendings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add recurring expense rules that generate monthly confirmable pendings, keeping obligations non-financial until explicit confirmation.

**Architecture:** Persist recurring rule intent as events, generate month pendings locally and idempotently in projections, and emit confirmation plus real expense events only on confirm action.

**Tech Stack:** Python, FastAPI, SQLAlchemy, SQLite, pytest

---

### Task 1: Add failing backend tests for recurring rules and pendings

**Files:**
- Modify: `packages/backend/tests/test_app.py`
- Modify: `packages/backend/tests/test_projector.py`

**Step 1: Write failing tests**

- API test for creating a recurring rule and listing monthly pendings.
- API test proving pendings do not affect balances before confirmation.
- API test proving confirmation creates expense transaction at due date.
- Projector test for recurring rule + pending confirmation projection behavior.

**Step 2: Run tests to verify failures**

Run: `uv run pytest tests/test_app.py tests/test_projector.py -k "recurring or pending" -v`

Expected: FAIL because recurring endpoints/service/projection do not exist yet.

### Task 2: Implement recurring rule service and HTTP endpoints

**Files:**
- Create: `packages/backend/src/finance_app/application/recurring.py`
- Modify: `packages/backend/src/finance_app/interfaces/http/app.py`

**Step 1: Implement service and route wiring**

- Add recurring service with create/list/confirm use cases.
- Add request models and handlers for recurring rule creation, pending listing, and pending confirmation.
- Validate due day, month format, account activeness, and payment method.

**Step 2: Run focused tests**

Run: `uv run pytest tests/test_app.py -k "recurring or pending" -v`

Expected: partial progress; projector support still missing.

### Task 3: Extend projections for recurring rules and pendings

**Files:**
- Modify: `packages/backend/src/finance_app/domain/projections.py`
- Modify: `packages/backend/src/finance_app/infrastructure/projector.py`

**Step 1: Add projection records and event handlers**

- Add `recurring_rules` and `pendings` tables.
- Handle `RecurringRuleCreated` and `PendingConfirmed` in projector.
- Add idempotent monthly pending generation and list methods.
- Update schema rebuild detection for new tables/columns.

**Step 2: Run backend tests**

Run: `uv run pytest tests/test_projector.py tests/test_app.py -v`

Expected: PASS.

### Task 4: Final verification and PR

**Files:**
- Modify: `docs/plans/2026-03-04-issue-24-recurring-rules-design.md`
- Modify: `docs/plans/2026-03-04-issue-24-recurring-rules-plan.md`

**Step 1: Run full backend verification**

Run: `uv run pytest tests -v`

Expected: PASS.

**Step 2: Open PR**

- Commit with issue-focused message.
- Push branch `codex/issue-24-recurring-pendings`.
- Open PR against `main` with summary and test evidence.
