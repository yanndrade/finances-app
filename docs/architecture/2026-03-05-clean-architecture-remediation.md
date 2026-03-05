# Clean Architecture Remediation (2026-03-05)

## Context
- This remediation was executed to reduce architectural coupling identified in backend (`projector.py`, `app.py`) and frontend (`App.tsx`, component-level orchestration).
- Strategy used: incremental strangler refactor with characterization tests first, then module extraction, then delegation from old entry points.

## Implemented Decisions

### 1. Backend Domain/Application/Infrastructure Boundaries
- Extracted pure policy rules to `packages/backend/src/finance_app/domain/policies.py`.
- Removed hidden write side effects from read paths in projector pending queries.
  - `list_pendings` and `get_pending` are now read-only.
  - Explicit command `materialize_month_pendings` was introduced for generation.
- Introduced transactional event batch append (`append_batch`) in event store contract and infra adapter.
  - Multi-event use cases now append atomically.

### 2. Backend HTTP Interface Decoupling
- Introduced composition root in `packages/backend/src/finance_app/interfaces/http/bootstrap.py`.
- Kept `packages/backend/src/finance_app/interfaces/http/app.py` thin.
- Split transport layer by context under `interfaces/http/routes/`:
  - `health`, `accounts`, `cards`, `transactions`, `reports`, `recurring`, `budgets`, `investments`, `dev`.
- Added architecture guard tests to keep direct infrastructure imports out of `app.py`.

### 3. Frontend Orchestration and Contracts
- Extracted app data coordination to `packages/frontend/src/features/app/use-app-data-orchestrator.ts`.
  - Added stale-response/race protection by request sequencing.
- Centralized date filter normalization in `packages/frontend/src/lib/date-filters.ts`.
- Hardened API client contracts in `packages/frontend/src/lib/api.ts`:
  - explicit patch payload type for transaction updates
  - structured `ApiError`
  - safe handling for `204`/empty response bodies

### 4. Frontend Heavy Component Decoupling
- Cards:
  - Added `packages/frontend/src/features/cards/use-invoice-items.ts`.
  - `cards-view.tsx` now delegates invoice item loading and exposes explicit load error state.
- Movements:
  - Added `packages/frontend/src/features/movements/use-quick-entry-defaults.ts`.
  - `movements-panel.tsx` no longer reads `localStorage` on every render.
- Quick Add:
  - Added `packages/frontend/src/components/quick-add/use-quick-add-reducer.ts`.
  - `quick-add-composer.tsx` now delegates state transitions to reducer actions (not ad-hoc effect chains).

## Architectural Rules (Current)
- Interfaces translate transport concerns only and call application services.
- Application coordinates use cases and transaction boundaries explicitly.
- Domain keeps framework-free, pure policy logic.
- Infrastructure adapters provide persistence/projection mechanics without owning business policy.
- Frontend containers/hooks orchestrate IO; UI components render state and dispatch actions.

## Verification Summary
- Backend architecture and app tests pass with router/bootstrap guard coverage.
- Frontend tests cover stale-response protection, API contract behavior, and extracted hooks/reducer behavior.
- Frontend production build passes.
