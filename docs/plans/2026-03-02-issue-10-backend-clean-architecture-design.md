# Issue 10 Backend Clean Architecture Skeleton Design

**Context**

Issue `#10` requires the backend package to reflect the four clean architecture layers from the PRD: `domain`, `application`, `infrastructure`, and `interfaces`. The user also fixed the stack choices for this issue: `uv` as Python package manager, FastAPI for the HTTP API, SQLAlchemy for database access, and Alembic for migrations.

**Decision**

Use `uv` CLI to initialize `packages/backend` as an application package, then install FastAPI, SQLAlchemy, Alembic, and test dependencies through `uv add`. Use `uv run alembic init alembic` to generate the migration scaffold, and only hand-edit Python modules to wire a minimal clean architecture skeleton on top of the generated project files.

**Scope**

- Keep the backend skeleton executable but minimal
- Provide a FastAPI entrypoint, a framework-free application placeholder, and infrastructure database helpers
- Preserve clean boundaries so interfaces call application code instead of embedding business logic
- Add smoke tests that assert the app factory and routing work

**Validation**

Use pytest for behavior checks and `alembic` CLI generation for the migration skeleton. Verify the backend tests pass after the manual Python wiring is complete.
