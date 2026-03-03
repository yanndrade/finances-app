# Issue 17 Desktop Dashboard Design

**Date:** 2026-03-03

**Issue:** `#17` - Create the first monthly dashboard summary for balances and cash movement

## Scope

Deliver the first functional desktop version of the application for the features that already exist in the codebase:

- monthly dashboard for current cash flow
- account balance overview
- cash income and expense creation
- internal transfer creation
- transaction listing

This design intentionally excludes future modules such as cards, recurring expenses, budgets, reimbursements, and LAN/mobile-specific flows because they do not exist yet in the backend.

## Recommended Approach

Use a React + Vite frontend in `packages/frontend` as the shared UI, and a minimal Tauri shell in `packages/desktop` to host that frontend as a desktop application. Keep the backend as the source of truth and extend it only where issue `#17` requires missing read functionality.

This approach delivers a real desktop app now, while avoiding premature complexity from full sidecar packaging and deep process orchestration in the same issue.

## Architecture

The solution is split into three layers:

1. `packages/backend`
Add a dashboard read endpoint backed by existing projections in `app.db`. The endpoint should compute monthly inflow and outflow from projected transactions, ignore transfers for income/expense reporting, and return the current consolidated cash balance from projected account balances.

2. `packages/frontend`
Implement the desktop-first UI for the currently available features: dashboard, accounts, transactions, and movement forms. The frontend talks to the backend over local HTTP and refreshes server state after each successful mutation.

3. `packages/desktop`
Implement a minimal Tauri host that loads the frontend app so the project can run as a desktop application during development and testing.

## User Experience

The interface follows `FRONTEND-GUIDELINES.md`:

- minimal, data-first layout with whitespace and subdued chrome
- deep purple as the primary visual identity
- dashboard cards highlighting balances and monthly movement
- fast forms with low-friction validation
- subtle route and panel motion, not heavy animation
- desktop-first layout with a left sidebar and contained main content width

## Screens

### Dashboard

The default screen shows:

- current total balance across active accounts
- monthly inflow
- monthly outflow
- net movement for the selected month
- recent transactions preview

The first version focuses on correctness and extensibility rather than dense analytics.

### Transactions

The transactions screen shows a filterable list using the existing transactions endpoint. It supports practical filtering for the available fields and surfaces transfer rows as neutral movements instead of income or expense.

### Accounts

The accounts screen shows the existing account projection data as balance cards with current balance, initial balance, and account type.

### Move Money

The movement area provides two forms:

- create income or expense
- create internal transfer

Both forms refresh dashboard, accounts, and transactions after success.

## Data Flow

- On startup, the frontend requests `accounts`, `transactions`, and the dashboard summary for the current month.
- Mutations are performed via `POST /api/incomes`, `POST /api/expenses`, and `POST /api/transfers`.
- After a successful mutation, the frontend re-fetches dependent datasets instead of maintaining complex client-side reconciliation.
- The dashboard endpoint reads from projections only, preserving the issue requirement of fast reads.

## Error Handling

- Forms validate required fields, positive amounts, and transfer account differences before submit.
- Server-side validation errors are shown inline or in the section header.
- Buttons lock while requests are in flight to prevent duplicate submissions.
- Empty states are explicit so the first run is still understandable without seed data.

## Testing Strategy

Backend:

- add TDD coverage for the new dashboard endpoint
- add projector/application-level coverage if a new dashboard query abstraction is introduced

Frontend:

- add tests for dashboard rendering
- add tests for income/expense submission
- add tests for transfer submission
- add tests for server error display and data refresh behavior

Desktop:

- verify the Tauri shell starts and points at the frontend correctly

## Delivery Constraints

- Work on a dedicated git branch
- Keep commits small and logical
- End the issue with the application runnable locally for manual testing
- Open a PR for review after verification
