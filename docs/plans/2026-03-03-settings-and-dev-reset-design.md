# Settings And Dev Reset Design

**Date:** 2026-03-03

**Issue:** Add a desktop-first settings entry point and a development-only action to wipe all persisted application data.

## Scope

Add a new `Configurações` view to the desktop navigation and expose a development tool that resets the application to a first-run state.

The work includes:

- adding a dedicated `Configurações` button in the left sidebar footer
- creating a settings screen in the frontend
- adding a development-only reset action in that screen
- exposing a backend endpoint to clear both SQLite databases (`app.db` and `events.db`)
- refreshing the frontend state after reset so the app returns to an empty baseline

The work intentionally excludes:

- a full settings module with multiple preferences
- granular cleanup options
- Tauri-specific file deletion commands
- production-grade role-based protection for this reset action

## Recommended Approach

Add a new frontend view named `settings` and a backend endpoint `POST /api/dev/reset`.

The frontend remains the orchestrator for user confirmation and refresh, while the backend remains the source of truth for the destructive operation itself. This keeps the shared React app compatible across desktop and local browser usage without coupling the feature to Tauri internals.

## Architecture

### Frontend

- Extend `AppView` with `settings`.
- Keep the current main nav items unchanged.
- Add a separate footer action in the sidebar for `Configurações`.
- Create a simple settings screen with a single card: `Ferramentas de desenvolvimento`.
- Add a button `Apagar todos os dados` with destructive styling and explicit helper copy.
- Before calling the API, require confirmation through a browser confirmation dialog.
- After success:
  - navigate to `dashboard`
  - refetch all app data
  - show a success notice in pt-BR

### Backend

- Add a dedicated endpoint `POST /api/dev/reset`.
- The endpoint clears both the projection database and the event store database.
- The reset is a true hard reset:
  - no accounts
  - no transactions
  - no transfer history
  - no dashboard data beyond zero-value summaries

The implementation should avoid relying on row-by-row deletion through existing services. It should reset storage at the persistence layer so the app returns to the same baseline as a first execution.

## User Experience

- `Configurações` sits at the bottom of the left sidebar, visually separated from day-to-day sections.
- The settings page is desktop-first and intentionally minimal.
- The destructive action is clearly labeled as a development tool.
- The warning text explains that the action wipes all data and restarts the app as if it were the first run.
- The reset button disables while the request is in flight.
- Errors stay visible in context if the reset fails.

## Error Handling

- If the backend reset fails, show an inline error in the settings card.
- If the frontend confirmation is canceled, do nothing.
- If the app refresh after reset fails, preserve the error notice and keep the user informed.

## Testing Strategy

Backend:

- add endpoint coverage for `POST /api/dev/reset`
- verify that after reset, `GET /api/accounts`, `GET /api/transactions`, and `GET /api/dashboard` return an empty baseline

Frontend:

- verify the sidebar renders the `Configurações` button in the footer
- verify navigating to `Configurações` renders the new settings screen
- verify confirming the reset triggers the backend call and returns the app to an empty state
- verify canceling confirmation does not trigger the request

## Delivery Constraints

- keep all visible copy in pt-BR
- keep the app desktop-first
- do not break existing routes or current workflows
- keep the reset clearly framed as a development-only tool
