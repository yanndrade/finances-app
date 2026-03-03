# Issue 15 Cash Transactions Design

**Context**

Issue `#15` adds the first day-to-day cash movement flow required by the PRD: non-card income and expense transactions using PIX, cash, or other payment methods. This is the core user path for recording real cash movement quickly while preserving auditability.

**Decision**

Extend the event-sourced backend with transaction-specific events and a materialized `transactions` projection. Keep `category_id` and `person_id` as plain string references for now, because categories and people do not have dedicated CRUD flows yet and the app is currently focused on a single personal user.

**Scope**

- Create income and expense transactions with UTC timestamps
- Edit existing transactions through audit-friendly update events
- Void transactions without deleting history
- Project transactions into `app.db` with query filters
- Keep `balance_state` synchronized per account
- Validate only current PRD constraints: account exists, category is required, payment method is allowed

**Validation**

Use pytest to verify projection replay, account balance updates, API create/edit/void/list flows, and filtering by date, category, account, method, person, and description text.
