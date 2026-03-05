# Issue 26 - Investment Movements Design

## Context

Issue `#26` requires explicit support for investment entries and exits without corrupting budget semantics.  
The milestone and product requirements also need an advanced investment experience:

- investment goal card based on `10%` of monthly incomes
- contribution registration with two inputs: contribution and optional dividends
- withdrawal registration with independent cash and invested reduction amounts
- wealth evolution and contribution/dividend trend views
- period aggregations for daily, weekly, monthly, bimonthly, quarterly, and yearly views

This design keeps investment logic separate from category budget calculations by introducing a dedicated investment movement model and read APIs.

## Goals

- Record investment contribution and withdrawal movements with business-safe semantics.
- Keep category budgets and budget alerts stable and unaffected by investment flows.
- Expose investment reporting data for monthly and cumulative totals.
- Support advanced investment UX with range granularity and trend charts.
- Preserve existing transaction, reimbursement, recurring, and budget flows.

## Non-goals

- market quote integration
- portfolio by ticker
- IR/tax calculators
- automatic brokerage synchronization

## Approach Options Considered

### Option A - Reuse regular transactions only

Record investments as `income/expense` transactions with special categories.

- Pros: smallest code diff
- Cons: high risk of polluting dashboard totals and budget spending semantics

### Option B - Extend transaction type union

Add `investment_contribution` and `investment_withdrawal` to transaction `type`.

- Pros: single projection table
- Cons: many conditionals in existing flows and higher regression risk

### Option C (chosen) - Dedicated investment movement model

Add dedicated event and projection for investments and read from dedicated endpoints.

- Pros: clean semantics, budget isolation by design, explicit support for contribution/dividend/withdrawal data
- Cons: larger initial implementation

## Chosen Architecture

### Domain Event

New event type: `InvestmentMovementRecorded`

Payload:

- `id`
- `occurred_at`
- `type`: `contribution | withdrawal`
- `account_id`
- `description`
- `contribution_amount`
- `dividend_amount`
- `cash_amount`
- `invested_amount`
- `cash_delta`
- `invested_delta`

### Projection

New projection table: `investment_movements`

Columns:

- `movement_id` (pk)
- `occurred_at` (indexed)
- `type` (indexed)
- `account_id` (indexed)
- `description`
- `contribution_amount`
- `dividend_amount`
- `cash_amount`
- `invested_amount`
- `cash_delta`
- `invested_delta`

### Service Layer

New application service: `InvestmentService`

Use cases:

- record contribution
- record withdrawal
- list movements
- get investment overview

### HTTP API

- `POST /api/investments/movements`
- `GET /api/investments/movements`
- `GET /api/investments/overview`

`overview` query params:

- `view`: `daily | weekly | monthly | bimonthly | quarterly | yearly`
- `from` (UTC ISO)
- `to` (UTC ISO)

## Business Rules

### Contribution

- `contribution_amount > 0`
- `dividend_amount >= 0`
- `cash_delta = -contribution_amount`
- `invested_delta = contribution_amount + dividend_amount`

Effect:

- cash decreases from selected account
- invested balance increases by contribution + reinvested dividends

### Withdrawal

- `cash_amount > 0`
- `invested_amount > 0`
- `cash_delta = +cash_amount`
- `invested_delta = -invested_amount`

Effect:

- cash increases in selected account
- invested balance decreases by invested amount
- allows net differences due to tax/valuation effects

### Wealth Semantics

- `wealth = cash + invested`
- `cash` is sum of balances from non-`investment` accounts
- `invested` is cumulative sum of `invested_delta`

## Reporting and Aggregation

Overview returns:

- `totals`
  - `contribution_total`
  - `dividend_total`
  - `withdrawal_total`
  - `invested_balance`
  - `cash_balance`
  - `wealth`
  - `dividends_accumulated`
- `goal`
  - target = `monthly_income_total * 0.1`
  - realized = `contribution_total + dividend_total` (for current month window)
  - remaining and progress percent
- `series`
  - `wealth_evolution`
  - `contribution_dividend_trend`

Period bucket keys:

- daily: `YYYY-MM-DD`
- weekly: `YYYY-Www`
- monthly: `YYYY-MM`
- bimonthly: `YYYY-B1..B6`
- quarterly: `YYYY-Q1..Q4`
- yearly: `YYYY`

## Frontend Design

### New Investments View

Add sidebar route `investments` and dedicated screen with:

- KPI cards: wealth, invested, dividends accumulated, goal progress
- granularity selector
- date range selector
- line chart for wealth evolution
- line chart for contributions and dividends with visibility toggles
- movement history table
- contribution and withdrawal forms

### Dashboard Bento Integration

- investment goal card uses dedicated investment data instead of category spending fallback
- keep CTA "Registrar aporte agora"
- add navigation to full investments view

### Quick Add Integration

Extend quick composer with `Investment` entry mode:

- submode `Aporte` with contribution + optional dividends
- submode `Resgate` with cash amount + invested reduction

## Error Handling

- invalid UTC timestamps => `422`
- invalid type => `422`
- missing/zero monetary fields => `422`
- unknown account => `404`
- contribution/withdrawal invalid combinations => `422`

## Testing Strategy

Backend:

- endpoint tests for contribution and withdrawal
- overview aggregation tests across all period views
- projector tests for event application and balance impacts
- budget non-regression tests proving investment flows do not affect category budgets

Frontend:

- API client tests for new endpoints
- dashboard rendering test with investment summary data
- investments view tests for:
  - period switch
  - dual-line toggle behavior
  - submit contribution/withdrawal payload mapping

## Migration and Compatibility

- projector schema check extended to include `investment_movements`
- existing endpoints unchanged
- no changes to existing transaction type behavior
- no change to budget formulas except explicit exclusion by dedicated model

## Risks and Mitigations

- Risk: wealth time-series drift due to boundary handling
  - Mitigation: tests for inclusive/exclusive range edges and UTC boundaries
- Risk: double-counting between cash and invested
  - Mitigation: enforce cash excludes account type `investment` in wealth calculation
- Risk: frontend regressions due to extra network calls
  - Mitigation: lazy load investments view and focused tests on startup fetch behavior

