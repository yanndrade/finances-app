# AGENTS.md - Coding Agent Guidelines

## Project Overview

Personal finance app. Monorepo with three packages:

- **`packages/frontend`** - React 19 + Vite SPA (TypeScript). Runs inside Tauri desktop shell and as a mobile-friendly LAN webapp.
- **`packages/backend`** - Python 3.13 FastAPI server. Event-sourced architecture (SQLAlchemy + Alembic). Package manager: **uv**.
- **`packages/desktop`** - Tauri v2 shell wrapping the frontend.
- **`packages/shared`** - Contracts, schemas, and shared types between frontend and backend.

## Build / Dev / Test Commands

### Frontend (`packages/frontend`)

```bash
# Dev server
npm run dev

# Type-check + production build
npm run build          # runs: tsc -b && vite build

# Run all tests
npm test               # runs: vitest

# Run a single test file
npx vitest run src/features/dashboard/dashboard-view.test.tsx

# Run tests matching a name pattern
npx vitest run -t "loads the monthly summary"

# Run tests in watch mode for a file
npx vitest src/features/cards/cards-view.test.tsx
```

### Backend (`packages/backend`)

```bash
# All commands assume you are in packages/backend

# Run server
uv run backend --host 127.0.0.1 --port 8000

# Run all tests
uv run pytest

# Run a single test file
uv run pytest tests/test_app.py

# Run a single test function
uv run pytest tests/test_app.py::test_health_endpoint_uses_application_layer

# Run tests with output
uv run pytest -v -s
```

### Desktop (`packages/desktop`)

```bash
npm run dev             # tauri dev (starts backend + frontend + Tauri shell)
npm run build           # tauri build
```

## Frontend Code Style

### Formatting & Indentation

- 2-space indent for TS/TSX/JS/JSON/YAML. LF line endings.
- No ESLint or Prettier config exists -- follow existing patterns precisely.
- Use `"double quotes"` for strings in TypeScript (matches codebase convention).

### Imports

- CSS import first (`import "./styles.css"`), then a blank line.
- React/library imports next, grouped.
- Internal imports after a blank line, using the `@/` path alias (maps to `src/`).
- Use `type` keyword for type-only imports: `import type { Foo } from "./bar"` or inline `import { type Foo, bar } from "./baz"`.
- Named exports are strongly preferred. Lazy-loaded views use `{ default: module.ExportName }` wrappers.

### Components

- Functional components only. Use `export function ComponentName(...)` (named export, function declaration).
- Props defined as a `type` (not `interface`) directly above the component: `type FooProps = { ... }`.
- shadcn/ui primitives live in `src/components/ui/`. These follow shadcn conventions (forwardRef, `cn()` utility, cva variants).
- Custom app components live in `src/components/`. Feature-specific components live in `src/features/<feature>/`.
- Use `cn()` from `@/lib/utils` to merge Tailwind classes conditionally.

### Naming Conventions

- **Files**: `kebab-case.tsx` for components and views, `kebab-case.ts` for utilities. Tests: `<name>.test.ts(x)`.
- **Components/Types**: `PascalCase`. Props types: `<ComponentName>Props`.
- **Functions/Variables**: `camelCase`. Constants: `UPPER_SNAKE_CASE`.
- **Feature directories**: `src/features/<feature-name>/` with a main view file like `<feature>-view.tsx`.

### Types

- Strict TypeScript (`"strict": true`). No `any` -- use `unknown` and narrow.
- Prefer `type` aliases over `interface` for props and domain types.
- API response types use `snake_case` field names (matching the Python backend JSON).
- Frontend-only types use `camelCase` fields.
- Amounts are integers in cents (`number`), never floats.

### State Management

- App-level state uses React `useState`/`useEffect` in `App.tsx` with prop drilling.
- Data fetching orchestrated through `useAppDataOrchestrator` hook.
- No external state library (no Redux/Zustand currently).
- Forms use React Hook Form + Zod validation.

### Error Handling

- API calls throw `ApiError(status, detail)`. Callers catch and show toasts via `showToast("error", message)`.
- Mutations follow the `runMutation` pattern: wrap `action()` in try/catch, call `refreshData()` on success, show toast on error.
- Use `getErrorMessage(error: unknown): string` to safely extract messages.
- Empty `catch {}` blocks are acceptable only for non-critical failures (e.g., localStorage persistence).

### Styling

- Tailwind CSS 3 with CSS custom properties for theming (defined in `src/styles.css`).
- Semantic color tokens: `primary`, `success`, `warning`, `danger`, `finance-income`, `finance-expense`, `lifecycle-*`, etc.
- Use the design tokens from `tailwind.config.js` -- never hardcode hex colors.
- Dark mode via `class` strategy on `<html>`.

### Testing (Vitest + Testing Library)

- Globals enabled: `describe`, `it`, `expect`, `vi` are available without imports.
- Setup file: `src/test/setup.ts` (mocks `recharts` ResponsiveContainer and ResizeObserver).
- Test files co-located with source: `feature-name.test.tsx` next to `feature-name.tsx`.
- Mock API calls with `vi.spyOn(api, "fetchFoo").mockResolvedValue(...)` or `vi.fn()` on `globalThis.fetch`.
- Use `render()`, `screen`, `waitFor`, `userEvent` from Testing Library.
- Test names are descriptive English sentences.

## Backend Code Style

### Architecture

- Event-sourced: all state changes are appended as `NewEvent` to an event store, then projected.
- Layers: `domain/` (pure types, policies) -> `application/` (services, use cases) -> `interfaces/http/` (FastAPI routes) -> `infrastructure/` (DB, projector).
- Services are injected via constructor; routes are built by factory functions (`build_*_router`).

### Python Conventions

- Python 3.13. Type hints everywhere. Use `from __future__ import annotations` for forward refs.
- Domain errors are custom exception classes inheriting from a base service error (e.g., `TransactionServiceError`).
- Route handlers catch domain exceptions and raise `HTTPException` with proper status codes.
- Pydantic `BaseModel` for request/response schemas. Use `Field(...)` for validation.
- Use `Literal` types for constrained string values.
- `Protocol` classes for dependency injection boundaries.
- `frozen=True` dataclasses for immutable domain objects.

### Testing (pytest)

- Tests in `packages/backend/tests/`. Use `TestClient` from FastAPI for HTTP-level tests.
- Use `monkeypatch` for stubbing. No external mock libraries needed.
- Test function names: `test_<description_in_snake_case>`.

## Key Design Decisions

- All monetary values are stored and transmitted as **integer cents**. Format only at display time with `formatCurrency()`.
- Timestamps are ISO 8601 strings in UTC. Convert local datetimes with `normalizeTimestampForApi()`.
- The `@/` import alias maps to `packages/frontend/src/`.
- UI language is **Brazilian Portuguese (pt-BR)** for user-facing strings. Code (variable names, comments, commit messages) is in English.
- Views are lazy-loaded via `React.lazy()` with `Suspense` fallbacks.

## Design Context

### Users

- Primary user is one person managing personal finances, mostly on Windows desktop and occasionally on mobile browser over LAN.
- Core jobs: log a transaction in under 10 seconds, review monthly cashflow, track card invoices, confirm recurring expenses, and close reimbursements.
- Usage context includes frequent context switching, so the interface must stay fast, scannable, and low-friction.

### Brand Personality

- 3-word personality: trustworthy, efficient, calm.
- Voice and tone: direct, practical, and data-first; feedback should be clear without sounding alarmist.
- Emotional goal: make financial control feel stable and confident, not stressful.
- Anti-reference: playful/gamified banking UI, visual noise, or decorative effects that compete with numbers.

### Aesthetic Direction

- Product shape: one shared React UI with two surfaces:
  - Desktop: denser workspace with sidebar navigation, rich overviews, and keyboard shortcuts.
  - Mobile LAN: essential views only, large touch targets, and persistent quick-add action.
- Visual system: modern financial dashboard language with subtle acrylic/mica layers, rounded cards, restrained gradients, and semantic status colors.
- Theme model: support light and dark mode, preserve semantic finance colors, and allow controlled primary-brand color customization.
- Typography: Geist Sans / Inter / Segoe stack with tabular numerals for money and KPI alignment.
- Motion: short, purposeful transitions that reinforce state change and never slow down capture/review flows.

### Design Principles

1. Speed over ceremony: optimize high-frequency flows to complete in under 10 seconds.
2. Numbers first: balances, totals, due dates, and status always lead visual hierarchy.
3. Semantic consistency: the same color and state language must map to the same meaning everywhere.
4. Dense but readable: maximize information on desktop while preserving legibility and tap/keyboard ergonomics.
5. Calm reliability: show immediate, explicit feedback and error recovery paths without creating anxiety.
