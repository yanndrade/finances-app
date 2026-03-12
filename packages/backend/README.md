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

## Security Foundation

The first local desktop security layer is stored in `app.db`.

- passwords are hashed with Argon2id and never persisted in plaintext
- lock state is persisted separately from the password hash
- startup can require the lock screen when credentials exist and the app is marked locked
- inactivity lock is prepared as persisted configuration (`inactivity_lock_seconds`)

## CLI Runtime

The backend package now exposes a runnable CLI entrypoint:

```powershell
uv run backend --host 127.0.0.1 --port 8000
```

Optional environment variables:

- `FINANCE_APP_DATABASE_URL`
- `FINANCE_APP_EVENT_DATABASE_URL`
- `FINANCE_APP_DATABASE_PATH`
- `FINANCE_APP_EVENT_DATABASE_PATH`
- `FINANCE_APP_CERT_DIR`

Security routes exposed for the desktop shell:

- `GET /api/security/state`
- `POST /api/security/password`
- `POST /api/security/lock`
- `POST /api/security/unlock`
