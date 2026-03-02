# Backend

Backend package root.

- `src/finance_app/domain`: domain entities and business rules
- `src/finance_app/application`: use cases and orchestration
- `src/finance_app/infrastructure`: persistence and external integrations
- `src/finance_app/interfaces`: HTTP, CLI, or adapter-facing entry points
- `tests/`: automated tests for backend behavior

## Event Store

The source of truth is a dedicated SQLite database at `events.db`, separate from the projection database.

- event writes happen through an append-only path in the application and infrastructure layers
- the `events` table stores `event_id`, `type`, `timestamp`, `payload`, and `version`
- SQLite `WAL` mode is enabled for the event store so readers do not block appends
- throughput assumptions follow the PRD: serialized writes under SQLite locking are sufficient for fewer than `100` events per day

## Projector

`app.db` is the materialized projection database used for fast reads.

- `event_cursor` tracks the last `event_id` applied from `events.db`
- the first concrete projection is `accounts`, materialized from `AccountCreated`
- the projector can rerun safely and rebuild `app.db` from event history
