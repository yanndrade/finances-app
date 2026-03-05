# Clean Architecture Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce architecture debt in backend and frontend by extracting responsibilities from monolithic files while preserving all current behavior covered by tests.

**Architecture:** Apply a strangler-style refactor: first add characterization tests, then extract pure policy/coordination modules, and finally delegate old entry points to new modules. Keep `Domain` pure, make `Application` orchestrate explicit use cases, keep `Infrastructure` focused on adapters, and make `Interfaces` thin composition plus transport mapping. Preserve existing endpoints and payload contracts unless explicitly updated in frontend API tests.

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy, Pytest, React 19, TypeScript, Vitest, Testing Library.

---

Execution skills during implementation: `@using-git-worktrees`, `@test-driven-development`, `@verification-before-completion`, `@requesting-code-review`.

### Task 1: Extract Business Policies Out of `Projector`

**Files:**
- Create: `packages/backend/src/finance_app/domain/policies.py`
- Modify: `packages/backend/src/finance_app/infrastructure/projector.py`
- Test: `packages/backend/tests/test_domain_policies.py`
- Test: `packages/backend/tests/test_projector.py`

**Step 1: Write the failing test**

Create `test_domain_policies.py` with explicit policy expectations:

```python
from finance_app.domain.policies import budget_status, investment_goal_target, requires_review


def test_investment_goal_target_uses_ten_percent_rule() -> None:
    assert investment_goal_target(monthly_income_total=125_000) == 12_500


def test_budget_status_respects_warning_and_exceeded_thresholds() -> None:
    assert budget_status(spent=7_999, limit=10_000) == "ok"
    assert budget_status(spent=8_000, limit=10_000) == "warning"
    assert budget_status(spent=10_001, limit=10_000) == "exceeded"


def test_requires_review_when_description_is_empty() -> None:
    assert requires_review(description=None) is True
    assert requires_review(description="") is True
    assert requires_review(description="Internet") is False
```

**Step 2: Run test to verify it fails**

Run: `uv run --project packages/backend pytest packages/backend/tests/test_domain_policies.py -v`
Expected: FAIL with `ModuleNotFoundError` for `finance_app.domain.policies`.

**Step 3: Write minimal implementation**

Implement pure policy helpers and wire `Projector` to call them instead of inlined rules.

```python
# packages/backend/src/finance_app/domain/policies.py

def investment_goal_target(*, monthly_income_total: int) -> int:
    return int(round(monthly_income_total * 0.1))


def budget_status(*, spent: int, limit: int) -> str:
    if spent > limit:
        return "exceeded"
    if spent * 100 >= limit * 80:
        return "warning"
    return "ok"


def requires_review(*, description: str | None) -> bool:
    return description is None or description.strip() == ""
```

**Step 4: Run test to verify it passes**

Run: `uv run --project packages/backend pytest packages/backend/tests/test_domain_policies.py packages/backend/tests/test_projector.py -k "investment_overview or dashboard" -v`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/finance_app/domain/policies.py packages/backend/src/finance_app/infrastructure/projector.py packages/backend/tests/test_domain_policies.py packages/backend/tests/test_projector.py
git commit -m "refactor: move dashboard and budget policies out of projector"
```

### Task 2: Make Pending Queries Read-Only (No Hidden Writes)

**Files:**
- Modify: `packages/backend/src/finance_app/infrastructure/projector.py`
- Modify: `packages/backend/src/finance_app/application/recurring.py`
- Test: `packages/backend/tests/test_projector.py`
- Test: `packages/backend/tests/test_app.py`

**Step 1: Write the failing test**

Add explicit guard tests to ensure `list_pendings` and `get_pending` do not call generation logic:

```python
def test_projector_list_pendings_does_not_materialize_implicitly(projector, monkeypatch) -> None:
    def _should_not_be_called(*args, **kwargs):
        raise AssertionError("read path must not materialize pendings")

    monkeypatch.setattr(projector, "_ensure_month_pendings", _should_not_be_called)
    projector.list_pendings(month="2026-03")


def test_projector_get_pending_does_not_materialize_implicitly(projector, monkeypatch) -> None:
    def _should_not_be_called(*args, **kwargs):
        raise AssertionError("read path must not materialize pendings")

    monkeypatch.setattr(projector, "_ensure_month_pendings", _should_not_be_called)
    assert projector.get_pending("pending:2026-03:rule-1") is None
```

**Step 2: Run test to verify it fails**

Run: `uv run --project packages/backend pytest packages/backend/tests/test_projector.py -k "does_not_materialize_implicitly" -v`
Expected: FAIL with `AssertionError` because reads still call `_ensure_month_pendings`.

**Step 3: Write minimal implementation**

Add explicit command-style materialization and keep reads pure.

```python
# projector.py

def materialize_month_pendings(self, *, month: str) -> None:
    with self._lock:
        self.bootstrap()
        with self._session_factory.begin() as session:
            self._ensure_month_pendings(session, month=month)
            session.flush()


def list_pendings(self, *, month: str) -> list[dict[str, str | int | None]]:
    with self._lock:
        self.bootstrap()
        with self._session_factory() as session:
            rows = (
                session.query(PendingProjectionRecord)
                .filter(PendingProjectionRecord.month == month)
                .order_by(PendingProjectionRecord.due_date.asc(), PendingProjectionRecord.pending_id.asc())
                .all()
            )
            return [self._pending_to_dict(row) for row in rows]
```

Update recurring use case to call `materialize_month_pendings(month=month)` explicitly before reading.

**Step 4: Run test to verify it passes**

Run: `uv run --project packages/backend pytest packages/backend/tests/test_projector.py -k "pendings" -v`
Expected: PASS

Run: `uv run --project packages/backend pytest packages/backend/tests/test_app.py -k "recurring_rules_generate_monthly_pendings or confirm_pending" -v`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/finance_app/infrastructure/projector.py packages/backend/src/finance_app/application/recurring.py packages/backend/tests/test_projector.py packages/backend/tests/test_app.py
git commit -m "refactor: separate pending materialization from read queries"
```

### Task 3: Add Atomic Event Batch Append and Use It in Multi-Event Use Cases

**Files:**
- Modify: `packages/backend/src/finance_app/application/event_store.py`
- Modify: `packages/backend/src/finance_app/infrastructure/event_store.py`
- Modify: `packages/backend/src/finance_app/application/recurring.py`
- Modify: `packages/backend/src/finance_app/application/reimbursements.py`
- Test: `packages/backend/tests/test_event_store.py`
- Test: `packages/backend/tests/test_app.py`

**Step 1: Write the failing test**

Add a batch atomicity test:

```python
def test_append_batch_is_atomic_when_one_event_is_invalid(tmp_path: Path) -> None:
    database_url = f"sqlite:///{(tmp_path / 'events.db').as_posix()}"
    store = EventStore(database_url=database_url)
    store.create_schema()

    with pytest.raises(EventStoreError):
        store.append_batch(
            [
                NewEvent(type="A", timestamp="2026-03-05T10:00:00Z", payload={"id": "ok"}, version=1),
                NewEvent(type="B", timestamp="2026-03-05T10:00:01Z", payload={"bad": {1, 2}}, version=1),
            ]
        )

    assert store.list_events() == []
```

**Step 2: Run test to verify it fails**

Run: `uv run --project packages/backend pytest packages/backend/tests/test_event_store.py -k "append_batch_is_atomic" -v`
Expected: FAIL with missing `append_batch`.

**Step 3: Write minimal implementation**

Extend protocol and infrastructure adapter, then switch multi-event flows to batch append.

```python
# application/event_store.py
class EventWriter(Protocol):
    def append(self, event: NewEvent) -> int: ...
    def append_batch(self, events: list[NewEvent]) -> list[int]: ...

# infrastructure/event_store.py

def append_batch(self, events: list[NewEvent]) -> list[int]:
    records: list[EventRecord] = []
    with self._session_factory.begin() as session:
        for event in events:
            payload = json.dumps(event.payload, sort_keys=True, separators=(",", ":"))
            record = EventRecord(type=event.type, timestamp=event.timestamp, payload=payload, version=event.version)
            session.add(record)
            records.append(record)
        session.flush()
    return [record.event_id for record in records]
```

Use `append_batch` in `RecurringService.confirm_pending` and `ReimbursementService.mark_received`.

**Step 4: Run test to verify it passes**

Run: `uv run --project packages/backend pytest packages/backend/tests/test_event_store.py packages/backend/tests/test_app.py -k "append_batch or recurring_rules_generate_monthly_pendings or reimbursement" -v`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/finance_app/application/event_store.py packages/backend/src/finance_app/infrastructure/event_store.py packages/backend/src/finance_app/application/recurring.py packages/backend/src/finance_app/application/reimbursements.py packages/backend/tests/test_event_store.py packages/backend/tests/test_app.py
git commit -m "refactor: add transactional event batch append for multi-event use cases"
```

### Task 4: Extract HTTP Composition Root and Split Routers by Context

**Files:**
- Create: `packages/backend/src/finance_app/interfaces/http/bootstrap.py`
- Create: `packages/backend/src/finance_app/interfaces/http/routes/health.py`
- Create: `packages/backend/src/finance_app/interfaces/http/routes/accounts.py`
- Create: `packages/backend/src/finance_app/interfaces/http/routes/transactions.py`
- Create: `packages/backend/src/finance_app/interfaces/http/routes/cards.py`
- Create: `packages/backend/src/finance_app/interfaces/http/routes/reports.py`
- Modify: `packages/backend/src/finance_app/interfaces/http/app.py`
- Test: `packages/backend/tests/test_app.py`

**Step 1: Write the failing test**

Add architecture guard to keep infrastructure imports out of transport module:

```python
from pathlib import Path
import finance_app.interfaces.http.app as http_app


def test_http_app_module_does_not_import_infrastructure_directly() -> None:
    source = Path(http_app.__file__).read_text(encoding="utf-8")
    assert "from finance_app.infrastructure" not in source
```

**Step 2: Run test to verify it fails**

Run: `uv run --project packages/backend pytest packages/backend/tests/test_app.py -k "does_not_import_infrastructure_directly" -v`
Expected: FAIL because `app.py` imports `EventStore` and `Projector` directly.

**Step 3: Write minimal implementation**

Move wiring to `bootstrap.py` and keep `app.py` focused on app creation and router inclusion.

```python
# bootstrap.py

def build_services() -> Services:
    event_store = EventStore()
    projector = Projector()
    return Services(
        account_service=AccountService(event_store=event_store, projector=projector),
        transaction_service=TransactionService(event_store=event_store, projector=projector, account_reader=projector),
        # ...remaining services
    )

# app.py

def build_router(services: Services) -> APIRouter:
    router = APIRouter()
    router.include_router(build_accounts_router(services.account_service))
    router.include_router(build_transactions_router(services.transaction_service))
    return router
```

**Step 4: Run test to verify it passes**

Run: `uv run --project packages/backend pytest packages/backend/tests/test_app.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/src/finance_app/interfaces/http/bootstrap.py packages/backend/src/finance_app/interfaces/http/routes packages/backend/src/finance_app/interfaces/http/app.py packages/backend/tests/test_app.py
git commit -m "refactor: split fastapi routes and move infra wiring to bootstrap"
```

### Task 5: Extract Frontend Data Orchestration and Add Race-Safe Refresh

**Files:**
- Create: `packages/frontend/src/features/app/use-app-data-orchestrator.ts`
- Create: `packages/frontend/src/lib/date-filters.ts`
- Modify: `packages/frontend/src/App.tsx`
- Test: `packages/frontend/src/App.test.tsx`
- Test: `packages/frontend/src/features/app/use-app-data-orchestrator.test.tsx`

**Step 1: Write the failing test**

Add a race-condition regression test that resolves stale request last and asserts stale payload is ignored:

```tsx
it("ignores stale month refresh responses when a newer refresh already completed", async () => {
  const first = deferred<Response>();
  const second = deferred<Response>();
  // first dashboard request waits, second resolves immediately for a different month
  // assert final UI reflects second month only
});
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx -t "ignores stale month refresh responses"`
Expected: FAIL because stale promise can still overwrite state.

**Step 3: Write minimal implementation**

Introduce request sequencing + abort in a dedicated hook.

```ts
const requestIdRef = useRef(0);

async function refresh(params: RefreshParams) {
  const requestId = ++requestIdRef.current;
  const controller = new AbortController();
  inFlightAbortRef.current?.abort();
  inFlightAbortRef.current = controller;

  const result = await loadAll(params, controller.signal);
  if (requestId !== requestIdRef.current) return;
  applyResult(result);
}
```

Move `toTransactionApiFilters` / `toReportApiFilters` normalization into `lib/date-filters.ts`.

**Step 4: Run test to verify it passes**

Run: `npm --prefix packages/frontend run test -- --run src/features/app/use-app-data-orchestrator.test.tsx src/App.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/features/app/use-app-data-orchestrator.ts packages/frontend/src/lib/date-filters.ts packages/frontend/src/App.tsx packages/frontend/src/features/app/use-app-data-orchestrator.test.tsx packages/frontend/src/App.test.tsx
git commit -m "refactor: extract app data orchestrator with stale-response protection"
```

### Task 6: Harden Frontend API Contracts and Remove Unsafe Casts

**Files:**
- Modify: `packages/frontend/src/lib/api.ts`
- Modify: `packages/frontend/src/App.tsx`
- Test: `packages/frontend/src/lib/api.test.ts`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Add type/contract tests for patch semantics and robust response handling:

```ts
it("sends only changed fields in updateTransaction patch payload", async () => {
  await updateTransaction("txn-1", { description: "Novo" });
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/api/transactions/txn-1"),
    expect.objectContaining({ method: "PUT", body: JSON.stringify({ description: "Novo" }) }),
  );
});

it("requestJson returns undefined for 204 responses", async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await expect(requestJson("/api/health")).resolves.toBeUndefined();
});
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend run test -- --run src/lib/api.test.ts -t "patch payload|204"`
Expected: FAIL because payload typing is coupled to full update type and `requestJson` assumes JSON body.

**Step 3: Write minimal implementation**

Define explicit payload types and remove unsafe cast in `App.tsx`.

```ts
export type TransactionPatchPayload = Partial<{
  occurredAt: string;
  description: string;
  categoryId: string;
  personId: string | null;
}>;

export async function updateTransaction(transactionId: string, payload: TransactionPatchPayload) {
  return requestJson<TransactionSummary>(`/api/transactions/${transactionId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
```

Also make `requestJson` handle empty body/204 safely and return a structured `ApiError`.

**Step 4: Run test to verify it passes**

Run: `npm --prefix packages/frontend run test -- --run src/lib/api.test.ts src/App.test.tsx -t "update|204|updates and voids a transaction"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/lib/api.ts packages/frontend/src/App.tsx packages/frontend/src/lib/api.test.ts packages/frontend/src/App.test.tsx
git commit -m "refactor: tighten frontend api contracts and remove unsafe transaction update casts"
```

### Task 7: Decouple Heavy UI Components with Focused Hooks/Reducers

**Files:**
- Create: `packages/frontend/src/features/cards/use-invoice-items.ts`
- Create: `packages/frontend/src/features/movements/use-quick-entry-defaults.ts`
- Create: `packages/frontend/src/components/quick-add/use-quick-add-reducer.ts`
- Modify: `packages/frontend/src/features/cards/cards-view.tsx`
- Modify: `packages/frontend/src/features/movements/movements-panel.tsx`
- Modify: `packages/frontend/src/components/quick-add-composer.tsx`
- Test: `packages/frontend/src/features/cards/cards-view.test.tsx`
- Test: `packages/frontend/src/features/movements/movements-panel.test.tsx`
- Test: `packages/frontend/src/components/quick-add-composer.test.tsx`

**Step 1: Write the failing test**

Add targeted tests that validate component behavior via props/hook outputs rather than inline side effects:

```tsx
it("cards view surfaces invoice item loading errors via hook state", async () => {
  // mock hook return { error: new Error("network") }
  // assert UI shows fallback message instead of silently emptying state
});

it("movements panel reads persisted defaults once at startup", () => {
  const getItem = vi.spyOn(window.localStorage, "getItem");
  render(<MovementsPanel ... />);
  expect(getItem).toHaveBeenCalledTimes(1);
});
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend run test -- --run src/features/cards/cards-view.test.tsx src/features/movements/movements-panel.test.tsx src/components/quick-add-composer.test.tsx`
Expected: FAIL because components currently own direct API/storage logic and monolithic state transitions.

**Step 3: Write minimal implementation**

Extract focused state/control modules and delegate from components.

```ts
// use-quick-entry-defaults.ts
export function useQuickEntryDefaults(storage: Pick<Storage, "getItem" | "setItem">) {
  const [defaults, setDefaults] = useState<PersistedDefaults>(() => readDefaults(storage));
  const saveDefaults = (next: PersistedDefaults) => {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    setDefaults(next);
  };
  return { defaults, saveDefaults };
}
```

```ts
// use-quick-add-reducer.ts
export function quickAddReducer(state: QuickAddState, action: QuickAddAction): QuickAddState {
  switch (action.type) {
    case "entryTypeChanged":
      return resetDependentFields(state, action.entryType);
    default:
      return state;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm --prefix packages/frontend run test -- --run src/features/cards/cards-view.test.tsx src/features/movements/movements-panel.test.tsx src/components/quick-add-composer.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/features/cards/use-invoice-items.ts packages/frontend/src/features/movements/use-quick-entry-defaults.ts packages/frontend/src/components/quick-add/use-quick-add-reducer.ts packages/frontend/src/features/cards/cards-view.tsx packages/frontend/src/features/movements/movements-panel.tsx packages/frontend/src/components/quick-add-composer.tsx packages/frontend/src/features/cards/cards-view.test.tsx packages/frontend/src/features/movements/movements-panel.test.tsx packages/frontend/src/components/quick-add-composer.test.tsx
git commit -m "refactor: decouple cards, movements, and quick-add state orchestration"
```

### Task 8: Full Verification + Documentation Sync

**Files:**
- Modify: `docs/prd.md`
- Create: `docs/architecture/2026-03-05-clean-architecture-remediation.md`

**Step 1: Write the failing test**

Add/adjust one architecture assertion in backend tests to enforce interfaces-only wiring:

```python
def test_http_routes_are_built_from_bootstrap_services() -> None:
    from finance_app.interfaces.http.bootstrap import build_services
    services = build_services()
    assert services is not None
```

**Step 2: Run test to verify it fails**

Run: `uv run --project packages/backend pytest packages/backend/tests/test_app.py -k "bootstrap_services" -v`
Expected: FAIL until docs and imports match final wiring.

**Step 3: Write minimal implementation**

Document final layering decisions and update PRD architecture notes to match implemented folder/module boundaries.

```markdown
- Interfaces layer owns request/response translation only.
- Application layer owns orchestration and explicit command/query use cases.
- Infrastructure layer contains adapters (event store, projector read models, DB wiring).
```

**Step 4: Run test suite and build checks**

Run: `uv run --project packages/backend pytest packages/backend/tests -v`
Expected: PASS

Run: `npm --prefix packages/frontend run test -- --run`
Expected: PASS

Run: `npm --prefix packages/frontend run build`
Expected: PASS

**Step 5: Commit**

```bash
git add docs/prd.md docs/architecture/2026-03-05-clean-architecture-remediation.md packages/backend/tests/test_app.py
git commit -m "docs: align architecture documentation with refactored boundaries"
```
