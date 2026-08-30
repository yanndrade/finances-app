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
uv run backend --host 127.0.0.1 --port 27654
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

## Pluggy Integration

The Pluggy Connect token endpoint is available only to localhost clients:

- `POST /api/pluggy/connect-token`

In the Windows desktop app, configure the Client ID and Client Secret under **Configurações > Open Finance**. The Tauri host protects them with Windows DPAPI for the current user and injects them only into the local backend process. They are not part of the installer or the GitHub Actions release.

For standalone backend development, set the application credentials in the process environment before starting it. Never expose or commit these values:

```powershell
$env:PLUGGY_CLIENT_ID="<your-client-id>"
$env:PLUGGY_CLIENT_SECRET="<your-client-secret>"
uv run backend --host 127.0.0.1 --port 27654
```

### Connectors

`PLUGGY_CONNECTOR_IDS` is a comma-separated allow-list of connectors offered by the
Connect widget. It defaults to `200`, the Meu Pluggy proxy connector, which is the
only one a free/development application can reach. Set it to an empty string to offer
every connector the application can reach once the Pluggy production request is
approved:

```powershell
$env:PLUGGY_CONNECTOR_IDS=""
```

### Recovering connections

Items created outside this install — the Meu Pluggy free flow creates them in the
Demo of the Pluggy dashboard, not through this app — are adopted by
`POST /api/pluggy/items/recover`, which lists the application's items. Pluggy keeps
that listing opt-in per team; when it is off the endpoint answers
`{"available": false, "reason": "..."}` and the connection has to be attached by id
through `POST /api/pluggy/items/link`.

### Importing

A sync never writes to the event store. `POST /api/pluggy/sync` only discovers what
a connection exposes and stages proposals; entries reach the ledger through
`POST /api/pluggy/inbox/{entryId}/accept`, which goes through the same domain
services a manual entry uses.

Accounts, cards and investments all become rows in `GET /api/pluggy/accounts` and
are pointed at a local destination with `PUT /api/pluggy/accounts/{id}/link`.
Nothing is staged for a destination the user has not chosen, so a first sync
against a database with months of manual history stages nothing at all.

Staged entry kinds:

| Kind | Becomes | Notes |
| --- | --- | --- |
| `bank_transaction` | income or expense | category is confirmed by the user |
| `card_purchase` | card purchase | installments are rebuilt into one purchase |
| `card_installment_covered` | nothing | sibling installments, kept for idempotency |
| `invoice_payment` | invoice payment | the bank debit is folded in, not imported twice |
| `invoice_payment_covered` | nothing | the folded bank leg |
| `transfer` | transfer | both legs become one entry |
| `transfer_covered` | nothing | the folded second leg |
| `investment_movement` | `compra` / `venda` | positions are never written |

Pluggy's categories and investment types are only hints: neither becomes a local
category or asset class without the user confirming it.

Nothing is ever accepted automatically. `accept` is reachable only from
`/api/pluggy/inbox/{entryId}/accept` and `/api/pluggy/inbox/accept-batch`, both
driven by a click; the background sync stages and updates the badge and nothing
else. A rule that learns a category or a person may pre-fill the review, never
decide it.
