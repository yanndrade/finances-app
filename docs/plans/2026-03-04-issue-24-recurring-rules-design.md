# Issue 24 Recurring Rules and Monthly Pendings Design

**Context**

Milestone `v0.4.0` introduces deferred obligations. This issue requires recurring fixed-expense rules that generate monthly confirmable pendings without auto-posting financial transactions.

**Decision**

Use event-sourced rules plus projection-local pending generation:
- `RecurringRuleCreated` persists recurring rule intent.
- monthly pendings are generated locally in `app.db` when querying a month (idempotent).
- `PendingConfirmed` and `ExpenseCreated` are appended only when user confirms.

This preserves explicit confirmation while keeping generated pendings non-financial until confirmation.

**Backend Design**

- New application service: `RecurringService`.
- New endpoints:
  - `POST /api/recurring-rules`
  - `GET /api/pendings?month=YYYY-MM`
  - `POST /api/pendings/{id}/confirm`
- New projections:
  - `recurring_rules`
  - `pendings`

**Recurring Rule Model**

Each rule stores:
- `rule_id`
- `name`
- `amount`
- `due_day` (1..28)
- payment metadata: `account_id`, `payment_method`, `category_id`, optional `description`
- `is_active`

**Pending Generation Model**

For a requested month (`YYYY-MM`), each active recurring rule yields a deterministic pending id:
- `pending_id = "<rule_id>:<YYYY-MM>"`

Generated pending fields:
- rule metadata snapshot (`name`, `amount`, account/category/payment/description)
- `month`
- `due_date` (`YYYY-MM-DD` from `due_day`)
- `status = "pending"`
- `transaction_id = null` until confirmation

Generation is idempotent and does not create transactions.

**Confirmation Rules**

- `POST /api/pendings/{id}/confirm` confirms only once.
- Confirmation appends:
  - `PendingConfirmed`
  - `ExpenseCreated`
- The expense uses pending due date as accounting timestamp (`occurred_at = <due_date>T00:00:00Z`).
- Balance and dashboard expense totals change only after this confirmation transaction is projected.

**Validation and Error Handling**

- `month` must match `YYYY-MM`.
- `due_day` must be in `1..28`.
- `amount > 0`.
- payment method in PRD set (`PIX`, `CASH`, `OTHER`).
- referenced account must exist and be active.
- confirm returns conflict when already confirmed.

**Assumption**

Confirmation does not allow metadata override; it always uses the rule/pending metadata snapshot.

**Testing Strategy**

- API tests for:
  - recurring rule creation
  - automatic monthly pending generation
  - no balance impact before confirmation
  - confirmation creating real expense at due date
  - idempotency/conflict behavior
- projector tests for:
  - event projection of recurring rules and pending confirmations
  - monthly pending generation idempotency
  - schema rebuild detection with new tables
