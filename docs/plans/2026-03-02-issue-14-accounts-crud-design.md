# Issue 14 Accounts CRUD And Balance State Design

**Context**

Issue `#14` starts the cash-flow domain by making accounts usable as first-class entities. The PRD requires multiple accounts, per-account balances, historical preservation for inactive accounts, and a balance projection row per account.

**Decision**

Extend the existing event-sourced backend with account lifecycle support through `AccountCreated` and `AccountUpdated` events, materialized into both `accounts` and `balance_state` projections. The application may start with zero accounts, but once at least one active account exists the system must reject deactivating the last active account.

**Scope**

- Add account creation, listing, and update flows
- Persist `type`, `initial_balance`, and `is_active`
- Materialize one `balance_state` row per account, initialized from `initial_balance`
- Preserve inactive accounts instead of deleting them
- Expose minimal HTTP endpoints for account CRUD

**Validation**

Use pytest to verify projection behavior, HTTP create/list/update flows, and the domain rule that the last active account cannot be deactivated.
