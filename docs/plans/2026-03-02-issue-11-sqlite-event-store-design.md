# Issue 11 SQLite Event Store Design

**Context**

Issue `#11` introduces the core persistence contract for the product: `events.db` as the append-only source of truth. The PRD defines the `events` table shape, requires WAL mode, and states that future use cases must write through this event log instead of mutating projections directly.

**Decision**

Implement the first event store end-to-end: add a dedicated `events.db` path, a SQLAlchemy-backed event record model, an append-only repository that writes atomically, and an Alembic revision that creates the `events` table. Keep the public write path narrow so future application services can only append new events.

**Scope**

- Add stable database URL helpers for `events.db`
- Add an `EventStore` append path in the infrastructure layer
- Add an application-layer append use case as the public seam for future commands
- Generate a first Alembic revision for the `events` table
- Document append-only guarantees, WAL mode, and throughput assumptions

**Validation**

Use pytest to verify append behavior, versioned payload storage, WAL mode, and non-destructive write semantics. Run the backend test suite and build after the migration and repository are in place.
