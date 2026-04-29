# MeuCofri

Personal finance monorepo for a Windows-first desktop app with optional mobile access over the local network.

The current repo centers on a Tauri desktop shell, a FastAPI backend, and a shared React frontend. It also includes a lightweight shared-contract scaffold and a small Remotion package for tutorial videos.

## Packages

- `packages/frontend`: React 19 + Vite + TypeScript SPA used by both desktop and LAN/mobile access.
- `packages/backend`: Python 3.13 FastAPI backend with event sourcing, SQLite projections, and LAN security rules.
- `packages/desktop`: Tauri v2 shell branded as `MeuCofri`, with tray, autostart, updater, and backend lifecycle management.
- `packages/shared`: Shared contract scaffold. Today it mainly contains `version.txt` and placeholder docs for future shared schemas/types/contracts.
- `packages/video`: Remotion compositions for tutorial/demo video output.

## Architecture

### Frontend

- React 19 + Vite
- Tailwind CSS 3 + custom CSS variable theme system
- React Hook Form + Zod
- Recharts for financial visualization
- App-level state is currently managed with React state and custom hooks, not Zustand

### Backend

- FastAPI + Uvicorn
- SQLAlchemy + Alembic
- Event-sourced write model in `events.db`
- Projected read model in `app.db`
- LAN security middleware for origin, subnet, and device-token enforcement
- Optional self-signed HTTPS support for local/mobile flows

### Desktop

- Tauri v2
- Rust host runtime manages backend startup/shutdown
- Tray menu, close-to-tray behavior, autostart, and updater support
- Windows MSI packaging with optional code signing

## Repository Layout

```text
finance/
|-- docs/
|-- infra/
|-- scripts/
|-- packages/
|   |-- backend/
|   |-- desktop/
|   |-- frontend/
|   |-- shared/
|   `-- video/
|-- AGENTS.md
|-- FRONTEND-GUIDELINES.md
|-- PRD.md
`-- README.md
```

## Prerequisites

- Node.js 20+ recommended
- Python 3.13+
- `uv`
- Rust toolchain
- Windows is the primary supported release target

## Setup

Install dependencies package-by-package:

```powershell
cd packages/frontend
npm install

cd ../backend
uv sync

cd ../desktop
npm install

cd ../video
npm install
```

## Development

### Full Desktop Dev Flow

From the repo root:

```powershell
./scripts/dev.ps1
```

This script:

- kills stale frontend/Tauri processes
- starts the frontend on `127.0.0.1:43173`
- waits for the dev server to be ready
- starts `tauri dev` from `packages/desktop`

### Isolated Frontend

```powershell
cd packages/frontend
npm run dev
```

### Isolated Backend

```powershell
cd packages/backend
uv run backend --host 127.0.0.1 --port 27654
```

Useful backend variants:

```powershell
uv run backend --https
uv run backend --host 0.0.0.0 --port 27654
```

### Isolated Desktop

The desktop package expects the frontend dev server to already be running.

```powershell
cd packages/desktop
npm run dev
```

### Video Package

```powershell
cd packages/video
npm run dev
npm run bundle
npm run render
```

## Testing

### Frontend

```powershell
cd packages/frontend
npm run test
npx vitest run src/features/dashboard/dashboard-view.test.tsx
```

Vitest uses `jsdom`, globals, and `src/test/setup.ts`.

### Backend

```powershell
cd packages/backend
uv run pytest
uv run pytest tests/test_app.py
uv run pytest tests/test_app.py::test_health_endpoint_uses_application_layer
```

The backend suite is mostly integration-oriented and uses FastAPI `TestClient`.

## Release Build

The canonical Windows release path is:

```powershell
./scripts/build-release-windows.ps1
```

That script can:

- run `npm ci` / `uv sync`
- build frontend assets
- build the backend sidecar with PyInstaller
- build the Tauri MSI bundle
- optionally sign the sidecar, desktop executable, and MSI with `signtool`
- sync desktop version metadata before packaging

Related scripts:

- `./scripts/build-backend-sidecar.ps1`
- `./scripts/prepare-updater-release.ps1`
- `./scripts/set-desktop-version.ps1`

## GitHub Releases

The only workflow currently present is:

- `.github/workflows/windows-release.yml`

It is a manual `workflow_dispatch` workflow. It:

- resolves the next `v2.0.x` release version unless overridden
- builds the Windows release
- prepares updater artifacts
- uploads MSI artifacts
- creates and pushes the release tag
- publishes the GitHub release

It does **not** currently run on `push`, `pull_request`, or tag events.

## Data Storage

### Event Store

`events.db` is the append-only source of truth.

- immutable events
- SQLite WAL mode
- update/delete protection at the database layer

### Projections

`app.db` stores read models used by the API and UI.

Projected data includes accounts, cards, invoices, transactions, recurring items, and unified movements.

In desktop release builds, runtime data is stored under the app local data directory rather than the installation directory.

## Security

- Desktop password protection uses Argon2-based hashing.
- LAN mode is gated by subnet checks, origin validation, and `X-Finance-Token` device tokens.
- Some security and pairing endpoints remain localhost-only.
- Self-signed certificates can be generated for HTTPS local access.

## Current Notes

- `packages/shared` is still a scaffold, not a fully populated shared-code package.
- The frontend `src/pages/` directory is currently unused; most UI lives under `src/features/` and `src/components/`.
- The backend can serve the built frontend SPA when `frontend/dist` is available.

## Additional Documentation

- [AGENTS.md](AGENTS.md)
- [PRD.md](PRD.md)
- [FRONTEND-GUIDELINES.md](FRONTEND-GUIDELINES.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/LEDGER-DOMAIN.md](docs/LEDGER-DOMAIN.md)
- [packages/backend/README.md](packages/backend/README.md)
- [packages/frontend/README.md](packages/frontend/README.md)
- [packages/desktop/README.md](packages/desktop/README.md)
- [packages/shared/README.md](packages/shared/README.md)
