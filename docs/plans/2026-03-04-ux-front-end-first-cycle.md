# UX Frontend First Cycle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the most confusing finance UX issues in the frontend by simplifying navigation, controlling category input, making dashboard visuals reflect real data, and exposing clearer card-limit feedback without changing backend contracts.

**Architecture:** Keep all backend APIs and domain semantics unchanged. Concentrate the work in `packages/frontend`, treat quick entry as a global action instead of a dedicated navigation destination, centralize category definitions in a shared frontend module, and derive new dashboard/card visuals from data already fetched in `App.tsx`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, existing shared UI primitives in `packages/frontend/src/components/ui`.

---

### Task 1: Remove `Movimentar` From Navigation And Make Quick Add The Only Primary Entry

**Files:**
- Modify: `packages/frontend/src/App.tsx`
- Modify: `packages/frontend/src/components/sidebar.tsx`
- Modify: `packages/frontend/src/features/dashboard/dashboard-view.tsx`
- Modify: `packages/frontend/src/features/dashboard/dashboard-bento.tsx`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Update the app navigation test so it no longer expects a `Movimentar` sidebar destination and instead verifies the global entry action remains available.

```tsx
render(<App />);

expect(await screen.findByRole("button", { name: /\+ lancamento/i })).toBeInTheDocument();
expect(screen.queryByRole("button", { name: /^movimentar$/i })).not.toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx -t "navigates between desktop views"`
Expected: FAIL because the sidebar still renders `Movimentar`.

**Step 3: Write minimal implementation**

- Remove `"movements"` from `AppView` in `sidebar.tsx`.
- Remove the `Movimentar` nav item from `NAV_ITEMS`.
- In `App.tsx`, stop routing `activeView === "movements"` to `MovementsPanel`.
- Keep the quick-add modal and global launcher intact.
- Replace dashboard CTA behavior so it opens quick add instead of navigating to a removed route.

```tsx
<DashboardView
  ...
  onOpenQuickAdd={() => setIsQuickAddOpen(true)}
/>
```

**Step 4: Run test to verify it passes**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx -t "navigates between desktop views"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/App.tsx packages/frontend/src/components/sidebar.tsx packages/frontend/src/features/dashboard/dashboard-view.tsx packages/frontend/src/features/dashboard/dashboard-bento.tsx packages/frontend/src/App.test.tsx
git commit -m "refactor: remove movements from primary navigation"
```

### Task 2: Replace Free-Text Categories With A Controlled Frontend Taxonomy

**Files:**
- Create: `packages/frontend/src/lib/categories.ts`
- Modify: `packages/frontend/src/components/quick-add-composer.tsx`
- Modify: `packages/frontend/src/features/transactions/transactions-view.tsx`
- Test: `packages/frontend/src/App.test.tsx`
- Test: `packages/frontend/src/features/transactions/transactions-view.copy.test.tsx`

**Step 1: Write the failing test**

Add coverage that quick add uses a selectable category control and exposes known category labels.

```tsx
await userEvent.click(screen.getByRole("button", { name: /\+ lancamento/i }));

expect(await screen.findByRole("combobox", { name: /categoria/i })).toBeInTheDocument();
expect(screen.getByRole("option", { name: /alimentacao/i })).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx -t "opens quick add with controlled category selection"`
Expected: FAIL because category is still rendered as a free-text input.

**Step 3: Write minimal implementation**

- Create a shared category catalog with stable ids and pt-BR labels.
- Replace the quick-add `Categoria` text input with the existing `Select` component.
- Update the transaction edit form so it uses the same category source instead of raw free text.
- Preserve unknown legacy category ids by rendering them as fallback options when needed.

```ts
export const CATEGORY_OPTIONS = [
  { value: "food", label: "Alimentacao" },
  { value: "transport", label: "Transporte" },
  ...
];
```

**Step 4: Run tests to verify they pass**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx src/features/transactions/transactions-view.copy.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/lib/categories.ts packages/frontend/src/components/quick-add-composer.tsx packages/frontend/src/features/transactions/transactions-view.tsx packages/frontend/src/App.test.tsx packages/frontend/src/features/transactions/transactions-view.copy.test.tsx
git commit -m "feat: control category selection in entry flows"
```

### Task 3: Fix Transaction Status Copy Without Changing The Backend Model

**Files:**
- Modify: `packages/frontend/src/lib/format.ts`
- Test: `packages/frontend/src/features/transactions/transactions-view.copy.test.tsx`

**Step 1: Write the failing test**

Extend the existing copy test so an active transaction is shown as `Efetivada`.

```tsx
expect(screen.getByText("Efetivada")).toBeInTheDocument();
expect(screen.queryByText("Ativa")).not.toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend run test -- --run src/features/transactions/transactions-view.copy.test.tsx`
Expected: FAIL because `formatTransactionStatus("active")` still returns `Ativa`.

**Step 3: Write minimal implementation**

Change only the display copy in `format.ts`.

```ts
const labels: Record<string, string> = {
  active: "Efetivada",
  voided: "Estornada",
};
```

**Step 4: Run test to verify it passes**

Run: `npm --prefix packages/frontend run test -- --run src/features/transactions/transactions-view.copy.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/lib/format.ts packages/frontend/src/features/transactions/transactions-view.copy.test.tsx
git commit -m "fix: relabel active transactions as efetivada"
```

### Task 4: Rebalance The Dashboard Around Real Data

**Files:**
- Modify: `packages/frontend/src/features/dashboard/dashboard-bento.tsx`
- Test: `packages/frontend/src/features/dashboard/dashboard-view.test.tsx`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Add assertions that the dashboard no longer renders the decorative split metrics and that category-composition data is visible.

```tsx
expect(screen.queryByText("Fixos")).not.toBeInTheDocument();
expect(screen.queryByText("Variaveis")).not.toBeInTheDocument();
expect(screen.queryByText("Parcelas")).not.toBeInTheDocument();
expect(screen.getByText(/raio-x de despesas/i)).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend run test -- --run src/features/dashboard/dashboard-view.test.tsx`
Expected: FAIL because the hardcoded summary cards are still present.

**Step 3: Write minimal implementation**

- Shrink the investment-goal card footprint so it no longer dominates the grid.
- Remove `Fixos`, `Variaveis`, and `Parcelas`.
- Use `dashboard.spending_by_category` to show a composition chart or chart legend with real category totals.
- Keep the existing top-category progress bars proportional to `total_expense`.

```tsx
const chartData = dashboard.spending_by_category.slice(0, 5);
```

**Step 4: Run tests to verify they pass**

Run: `npm --prefix packages/frontend run test -- --run src/features/dashboard/dashboard-view.test.tsx src/App.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/features/dashboard/dashboard-bento.tsx packages/frontend/src/features/dashboard/dashboard-view.test.tsx packages/frontend/src/App.test.tsx
git commit -m "refactor: ground dashboard visuals in real spending data"
```

### Task 5: Add Clear Card Limit Usage And Availability Feedback

**Files:**
- Modify: `packages/frontend/src/features/cards/cards-view.tsx`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Add coverage that the aggregate cards summary shows committed and available credit.

```tsx
await userEvent.click(screen.getByRole("button", { name: /^cards$/i }));

expect(await screen.findByText(/limite comprometido/i)).toBeInTheDocument();
expect(screen.getByText(/limite disponivel/i)).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx -t "shows card limit availability"`
Expected: FAIL because `CardsView` only shows `Limite total`.

**Step 3: Write minimal implementation**

- In aggregate scope, derive:
  - `committedLimit = totalOpenAmount`
  - `availableLimit = Math.max(totalLimit - committedLimit, 0)`
- Render both values alongside `Limite total`.
- Add a progress bar to visualize used vs available credit.
- In card-scoped detail, show the same usage pattern for the selected card when an invoice is loaded.

```tsx
const committedLimit = totalOpenAmount;
const availableLimit = Math.max(totalLimit - committedLimit, 0);
const usage = totalLimit > 0 ? (committedLimit / totalLimit) * 100 : 0;
```

**Step 4: Run test to verify it passes**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx -t "shows card limit availability"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/features/cards/cards-view.tsx packages/frontend/src/App.test.tsx
git commit -m "feat: expose card limit usage and availability"
```

### Task 6: Tighten Invoice Payment Copy In Quick Add

**Files:**
- Modify: `packages/frontend/src/components/quick-add-composer.tsx`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Add coverage that the invoice-payment tab uses explicit payoff copy.

```tsx
await userEvent.click(screen.getByRole("button", { name: /\+ lancamento/i }));
await userEvent.click(screen.getByRole("tab", { name: /pagamento de fatura/i }));

expect(screen.getByText(/quitar saldo do cartao/i)).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx -t "uses explicit invoice payment copy"`
Expected: FAIL because the tab still reads only `Fatura` and lacks helper text.

**Step 3: Write minimal implementation**

- Rename the tab from `Fatura` to `Pagamento de fatura` or `Quitar fatura`.
- Add one short helper line that explains the action is settling the card balance.
- Keep the same `onSubmitInvoicePayment` callback and payload.

```tsx
<TabsTrigger value="invoice">Pagamento de fatura</TabsTrigger>
```

**Step 4: Run test to verify it passes**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx -t "uses explicit invoice payment copy"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/components/quick-add-composer.tsx packages/frontend/src/App.test.tsx
git commit -m "copy: clarify invoice payment quick-add flow"
```

### Task 7: Full Verification

**Files:**
- Verify: `packages/frontend/src/App.tsx`
- Verify: `packages/frontend/src/components/sidebar.tsx`
- Verify: `packages/frontend/src/components/quick-add-composer.tsx`
- Verify: `packages/frontend/src/lib/categories.ts`
- Verify: `packages/frontend/src/lib/format.ts`
- Verify: `packages/frontend/src/features/dashboard/dashboard-bento.tsx`
- Verify: `packages/frontend/src/features/cards/cards-view.tsx`
- Verify: `packages/frontend/src/features/transactions/transactions-view.tsx`
- Verify: `packages/frontend/src/App.test.tsx`
- Verify: `packages/frontend/src/features/dashboard/dashboard-view.test.tsx`
- Verify: `packages/frontend/src/features/transactions/transactions-view.copy.test.tsx`

**Step 1: Run the focused frontend suite**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx src/features/dashboard/dashboard-view.test.tsx src/features/transactions/transactions-view.copy.test.tsx`
Expected: PASS

**Step 2: Run the production build**

Run: `npm --prefix packages/frontend run build`
Expected: PASS

**Step 3: Review the final UX manually**

Run: `npm --prefix packages/frontend run dev -- --host 127.0.0.1 --port 5174`
Expected:
- no `Movimentar` in the sidebar
- quick add opens globally
- category input is controlled
- dashboard no longer shows fake summary splits
- cards show committed and available limit

**Step 4: Commit**

```bash
git add packages/frontend/src/App.tsx packages/frontend/src/components/sidebar.tsx packages/frontend/src/components/quick-add-composer.tsx packages/frontend/src/lib/categories.ts packages/frontend/src/lib/format.ts packages/frontend/src/features/dashboard/dashboard-view.tsx packages/frontend/src/features/dashboard/dashboard-bento.tsx packages/frontend/src/features/cards/cards-view.tsx packages/frontend/src/features/transactions/transactions-view.tsx packages/frontend/src/App.test.tsx packages/frontend/src/features/dashboard/dashboard-view.test.tsx packages/frontend/src/features/transactions/transactions-view.copy.test.tsx
git commit -m "feat: ship first-cycle frontend ux cleanup"
```
