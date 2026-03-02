# Issue 12 Projector Design

**Context**

Issue `#12` needs the first projection pipeline that reads from `events.db` and materializes `app.db`. The PRD requires `app.db` to be rebuildable from the event store and to track the last applied event with `event_cursor`.

**Decision**

Implement a minimal projector focused on replay safety and rebuildability. Use `accounts` as the first concrete read model because `AccountCreated` already exists in the event catalog and proves the end-to-end flow without pulling in more financial behavior.

**Scope**

- Bootstrap `app.db` with `event_cursor` and `accounts`
- Read events from `events.db` in `event_id` order
- Apply `AccountCreated` into `accounts`
- Track the last applied `event_id` in `event_cursor`
- Support safe reruns and full rebuilds from the event log

**Validation**

Use pytest to cover bootstrap, projection replay, cursor tracking, idempotent reruns, and full rebuilds from existing event history.
