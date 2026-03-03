# Issue 22 Card And Invoice Management UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add invoice item inspection to the main `Cards` flow so a user can understand what composes each invoice without leaving the screen.

**Architecture:** Add a read-only backend endpoint that exposes installment-level invoice items from the existing projection, then lazy-load and render those items in an inline expandable detail panel inside the `Cards` view. Keep all existing card setup, purchase entry, and invoice payment flows intact.

**Tech Stack:** FastAPI, SQLAlchemy projections, React, Vitest, Testing Library

---

### Task 1: Add backend coverage for invoice item reads

**Files:**
- Modify: `packages/backend/tests/test_projector.py`
- Modify: `packages/backend/tests/test_app.py`

**Step 1: Write the failing test**

Add a projector test that seeds:
- one card
- one multi-installment purchase
- one single-installment purchase

Then assert that a new read method returns only the rows for `card-1:2026-04`, including:

```python
{
    "invoice_item_id": "purchase-1:1",
    "invoice_id": "card-1:2026-04",
    "purchase_id": "purchase-1",
    "card_id": "card-1",
    "purchase_date": "2026-03-15T12:00:00Z",
    "category_id": "electronics",
    "description": "Headphones",
    "installment_number": 1,
    "installments_count": 3,
    "amount": 3333,
}
```

Add an app test that calls:

```python
client.get("/api/invoices/card-1:2026-04/items")
```

and expects `200` with only the matching invoice rows, plus a `404` test for a missing invoice.

**Step 2: Run test to verify it fails**

Run:

```bash
cd packages/backend
uv run pytest tests/test_projector.py tests/test_app.py -k "invoice items" -v
```

Expected: FAIL because the projector read method and HTTP route do not exist yet.

**Step 3: Commit**

```bash
git add packages/backend/tests/test_projector.py packages/backend/tests/test_app.py
git commit -m "test: cover invoice item reads"
```

### Task 2: Implement backend invoice item endpoint

**Files:**
- Modify: `packages/backend/src/finance_app/domain/projections.py`
- Modify: `packages/backend/src/finance_app/infrastructure/projector.py`
- Modify: `packages/backend/src/finance_app/application/card_purchases.py`
- Modify: `packages/backend/src/finance_app/interfaces/http/app.py`

**Step 1: Write minimal implementation**

Add a new read projection model:

```python
@dataclass(frozen=True)
class InvoiceItemProjection:
    invoice_item_id: str
    invoice_id: str
    purchase_id: str
    card_id: str
    purchase_date: str
    category_id: str
    description: str | None
    installment_number: int
    installments_count: int
    amount: int
```

Expose projector read support backed by `card_purchase_installments`, filtered by `invoice_id`, ordered by:
- `purchase_date` descending
- `installment_id` descending

Extend `CardPurchaseService` with:

```python
def list_invoice_items(self, *, invoice_id: str) -> list[dict[str, str | int | None]]:
```

and validate:
- non-empty `invoice_id`
- `404` when the invoice does not exist

Add route:

```python
@router.get("/api/invoices/{invoice_id}/items")
```

that maps:
- `CardPurchaseNotFoundError` or a new invoice-not-found error to `404`
- `CardPurchaseServiceError` to `422`

**Step 2: Run focused tests**

Run:

```bash
cd packages/backend
uv run pytest tests/test_projector.py tests/test_app.py -k "invoice items" -v
```

Expected: PASS

**Step 3: Run full backend verification**

Run:

```bash
cd packages/backend
uv run pytest tests -v
```

Expected: all backend tests pass.

**Step 4: Commit**

```bash
git add packages/backend/src/finance_app/domain/projections.py packages/backend/src/finance_app/infrastructure/projector.py packages/backend/src/finance_app/application/card_purchases.py packages/backend/src/finance_app/interfaces/http/app.py packages/backend/tests/test_projector.py packages/backend/tests/test_app.py
git commit -m "feat: add invoice item read endpoint"
```

### Task 3: Add frontend coverage for invoice detail loading

**Files:**
- Modify: `packages/frontend/src/lib/api.test.ts`
- Modify: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Add API coverage for:

```ts
await fetchInvoiceItems("card-1:2026-04");
```

and assert it requests:

```ts
"/api/invoices/card-1%3A2026-04/items"
```

Add an app test that:
- starts with one pending invoice
- clicks `Ver itens`
- waits for invoice rows to appear
- verifies description, category, installment label, and amount

**Step 2: Run test to verify it fails**

Run:

```bash
cd packages/frontend
npm test -- --run src/lib/api.test.ts src/App.test.tsx
```

Expected: FAIL because the API client and UI do not support invoice item loading yet.

**Step 3: Commit**

```bash
git add packages/frontend/src/lib/api.test.ts packages/frontend/src/App.test.tsx
git commit -m "test: cover invoice detail UI flow"
```

### Task 4: Implement frontend invoice detail flow

**Files:**
- Modify: `packages/frontend/src/lib/api.ts`
- Modify: `packages/frontend/src/App.tsx`
- Modify: `packages/frontend/src/features/cards/cards-view.tsx`
- Modify: `packages/frontend/src/styles.css`

**Step 1: Write minimal implementation**

Add frontend types and client:

```ts
export type InvoiceItemSummary = {
  invoice_item_id: string;
  invoice_id: string;
  purchase_id: string;
  card_id: string;
  purchase_date: string;
  category_id: string;
  description: string | null;
  installment_number: number;
  installments_count: number;
  amount: number;
};

export async function fetchInvoiceItems(invoiceId: string): Promise<InvoiceItemSummary[]> {
  return requestJson(`/api/invoices/${encodeURIComponent(invoiceId)}/items`);
}
```

In `App.tsx`, add:
- invoice-items cache keyed by `invoice_id`
- invoice-item loading state
- invoice-item error state
- callback for lazy loading on demand

In `CardsView`, add:
- `Ver itens` button on each invoice card
- single expanded invoice state
- inline detail panel
- loading and error messages in the detail panel
- rendered rows with description, category, purchase date, installment label, and amount

**Step 2: Run focused frontend tests**

Run:

```bash
cd packages/frontend
npm test -- --run src/lib/api.test.ts src/App.test.tsx
```

Expected: PASS

**Step 3: Run full frontend verification**

Run:

```bash
cd packages/frontend
npm test -- --run
npm run build
```

Expected: tests pass and the production build succeeds.

**Step 4: Commit**

```bash
git add packages/frontend/src/lib/api.ts packages/frontend/src/App.tsx packages/frontend/src/features/cards/cards-view.tsx packages/frontend/src/styles.css packages/frontend/src/lib/api.test.ts packages/frontend/src/App.test.tsx
git commit -m "feat: add invoice detail inspection to cards"
```

### Task 5: Final verification and PR

**Files:**
- No code changes required

**Step 1: Verify git state**

Run:

```bash
git status --short
```

Expected: only generated files remain unstaged (`events.db-shm`, `events.db-wal`, `tsconfig.tsbuildinfo`) or a clean tree.

**Step 2: Push branch**

Run:

```bash
git push -u origin feature/issue-22-card-invoice-management-ui
```

**Step 3: Open PR**

Run:

```bash
gh pr create --base main --head feature/issue-22-card-invoice-management-ui --title "feat: build card and invoice management UI flows" --body "<summary and verification>"
```

