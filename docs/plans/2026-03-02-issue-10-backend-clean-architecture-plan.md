# Issue 10 Backend Clean Architecture Skeleton Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a minimal but executable backend skeleton that enforces the clean architecture boundaries defined in the PRD.

**Architecture:** Start from a CLI-generated Python project in `packages/backend`, then layer in a thin FastAPI app factory, framework-free application placeholders, and infrastructure database wiring. Use Alembic CLI to generate migrations scaffolding so future database work can build on a canonical migration layout.

**Tech Stack:** uv, FastAPI, SQLAlchemy, Alembic, pytest

---

### Task 1: Scaffold the backend project with CLI tools

**Files:**
- Create: `packages/backend/pyproject.toml`
- Create: `packages/backend/.python-version`
- Create: `packages/backend/alembic.ini`
- Create: `packages/backend/alembic/env.py`

**Step 1: Initialize the backend package**

Run: `uv init --package --app --vcs none --build-backend uv --no-readme packages/backend`
Expected: project metadata and Python package files are created

**Step 2: Add dependencies**

Run:

```bash
uv add --directory packages/backend fastapi sqlalchemy alembic
uv add --directory packages/backend --dev pytest httpx
```

Expected: dependencies added to `pyproject.toml` and lockfile updated

**Step 3: Initialize Alembic**

Run: `uv run --directory packages/backend alembic init alembic`
Expected: `alembic/` and `alembic.ini` are generated

### Task 2: Add failing tests first

**Files:**
- Modify: `packages/backend/tests/`

**Step 1: Write failing smoke tests**

Add tests that expect:
- an app factory returning a FastAPI app
- a health route wired through the interfaces layer
- a placeholder application service callable from the route layer

**Step 2: Run the tests to verify failure**

Run: `uv run --directory packages/backend pytest`
Expected: FAIL because the generated project has not been wired to the target architecture yet

### Task 3: Implement the minimal Python skeleton

**Files:**
- Modify: backend Python modules under `packages/backend/src/finance_app/`
- Modify: Alembic Python modules only as needed

**Step 1: Wire the clean architecture modules**

Create the minimum Python code needed so interfaces import application services, and infrastructure exposes database helpers without leaking into the domain layer.

**Step 2: Re-run tests**

Run: `uv run --directory packages/backend pytest`
Expected: PASS

### Task 4: Finalize the branch

**Files:**
- Modify: repository index

**Step 1: Review changes**

Run: `git status --short`
Expected: backend scaffold, Python modules, and planning docs only

**Step 2: Commit**

Run:

```bash
git add .
git commit -m "feat: create backend clean architecture skeleton"
```

Expected: commit created successfully
