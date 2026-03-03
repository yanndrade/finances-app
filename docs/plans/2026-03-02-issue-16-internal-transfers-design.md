# Issue 16 Internal Transfers Design

**Context**

Issue `#16` adds internal transfers between accounts. The PRD explicitly requires transfers to move money between accounts without being treated as income or expense, while preserving an auditable linked record of both sides of the movement.

**Decision**

Model each transfer as one `TransferCreated` event that projects into two linked transaction rows: a debit entry on the origin account and a credit entry on the destination account. Both rows share the same `transfer_id`, are tagged as `type="transfer"`, and update `balance_state` symmetrically.

**Scope**

- Add a `POST /api/transfers` endpoint
- Validate origin/destination accounts, UTC timestamp, and positive amount
- Project one debit and one credit transaction record per transfer
- Keep transfer rows queryable in `GET /api/transactions`
- Ensure transfers do not count as income or expense by storing them as `type="transfer"`

**Validation**

Use pytest to verify transfer projection replay, per-account balance movement, linked `transfer_id` records, upgrade behavior for the expanded `transactions` schema, and the transfer API flow.
