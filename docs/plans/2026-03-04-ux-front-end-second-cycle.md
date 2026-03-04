# UX Frontend Second Cycle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate ambiguity in the frontend launch flow by turning quick add into one canonical `Lancar` experience, aligning shell copy with that model, and hiding non-essential transaction filters behind progressive disclosure.

**Architecture:** Keep backend contracts and domain semantics unchanged. Concentrate the work in `packages/frontend`, reuse the current modal and existing API mutation handlers, and express the new behavior entirely through frontend state, conditional rendering, and test updates. Preserve the PRD distinction between cash transactions, card commitments, transfers, and invoice settlement while hiding that complexity from the user.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, existing frontend UI primitives.

---

### Task 1: Align Shell Copy With The New Canonical Entry Model

**Files:**
- Modify: `packages/frontend/src/App.tsx`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Update the app shell/navigation test so it expects the new copy:

```tsx
expect(await screen.findByRole("heading", { level: 1, name: /visao geral/i })).toBeInTheDocument();
expect(screen.getByRole("button", { name: /\+ lancar/i })).toBeInTheDocument();
expect(screen.queryByRole("button", { name: /\+ lancamento/i })).not.toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx -t "navigates between desktop views"`
Expected: FAIL because the shell still renders `Visao geral do caixa` and `+ Lancamento`.

**Step 3: Write minimal implementation**

- In `VIEW_META.dashboard`, change the title to `Visao geral`.
- Adjust the dashboard description so it reads as monthly control, not only cash.
- Rename the global action label from `+ Lancamento` to `+ Lancar`.

```ts
dashboard: {
  title: "Visao geral",
  description: "Resumo mensal e pontos de atencao.",
}
```

**Step 4: Run test to verify it passes**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx -t "navigates between desktop views"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/App.tsx packages/frontend/src/App.test.tsx
git commit -m "refactor: align shell copy with canonical launch flow"
```

### Task 2: Replace Quick Add Tabs With One Canonical `Lancar` Flow

**Files:**
- Modify: `packages/frontend/src/components/quick-add-composer.tsx`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Add or update quick-add coverage so the modal behaves as one flow:

```tsx
await userEvent.click(screen.getByRole("button", { name: /\+ lancar/i }));

expect(await screen.findByRole("dialog")).toBeInTheDocument();
expect(screen.getByText(/lancar/i)).toBeInTheDocument();
expect(screen.queryByRole("tab", { name: /cartao/i })).not.toBeInTheDocument();
expect(screen.queryByRole("tab", { name: /pagamento de fatura/i })).not.toBeInTheDocument();
```

Add focused interaction assertions for conditional fields:

```tsx
await userEvent.selectOptions(screen.getByLabelText(/tipo/i), "expense");
await userEvent.selectOptions(screen.getByLabelText(/modo de pagamento/i), "card");
expect(screen.getByLabelText(/cartao/i)).toBeInTheDocument();
expect(screen.getByLabelText(/parcelas/i)).toBeInTheDocument();
```

```tsx
await userEvent.selectOptions(screen.getByLabelText(/tipo/i), "transfer");
expect(screen.getByLabelText(/conta destino/i)).toBeInTheDocument();
await userEvent.selectOptions(screen.getByLabelText(/modo da transferencia/i), "invoice_payment");
expect(screen.getByLabelText(/fatura/i)).toBeInTheDocument();
```

**Step 2: Run tests to verify they fail**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx -t "opens quick add with controlled category selection"`
Expected: FAIL because the modal still uses multiple tabs and does not render the new conditional controls.

**Step 3: Write minimal implementation**

- Remove the `Tabs`-driven quick-add mode split.
- Add a single top-level `Tipo` control with values:
  - `expense`
  - `income`
  - `transfer`
- Add frontend-only state for:
  - expense payment mode (`PIX`, `CASH`, `OTHER`, `CARD`)
  - transfer mode (`internal`, `invoice_payment`)
  - optional-details expansion
- Render the base fields once.
- Render conditional fields only when required:
  - `Despesa` + `CARD` -> `Cartao` and `Parcelas`
  - `Transferencia` + `internal` -> `Conta destino`
  - `Transferencia` + `invoice_payment` -> `Fatura`
- In submit handling, map to the existing mutation handlers:
  - non-card expense/income -> `onSubmitTransaction`
  - card expense -> `onSubmitCardPurchase`
  - internal transfer -> `onSubmitTransfer`
  - invoice-payment transfer -> `onSubmitInvoicePayment`
- Reset hidden conditional state when the controlling mode changes.

```ts
if (entryType === "expense" && expensePaymentMode === "CARD") {
  await onSubmitCardPurchase(...);
}
```

**Step 4: Run tests to verify they pass**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx`
Expected: PASS for the updated quick-add scenarios.

**Step 5: Commit**

```bash
git add packages/frontend/src/components/quick-add-composer.tsx packages/frontend/src/App.test.tsx
git commit -m "refactor: unify quick add into one launch flow"
```

### Task 3: Collapse Secondary Transaction Filters Behind Progressive Disclosure

**Files:**
- Modify: `packages/frontend/src/features/transactions/transactions-view.tsx`
- Modify: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Add coverage that advanced filters start hidden and can be expanded:

```tsx
await userEvent.click(screen.getByRole("button", { name: /^trans/i }));

expect(screen.queryByLabelText(/metodo do filtro/i)).not.toBeInTheDocument();
await userEvent.click(screen.getByRole("button", { name: /filtros avancados/i }));
expect(screen.getByLabelText(/metodo do filtro/i)).toBeInTheDocument();
expect(screen.getByLabelText(/categoria do filtro/i)).toBeInTheDocument();
expect(screen.getByLabelText(/pessoa do filtro/i)).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx -t "updates and voids a transaction from the transactions view"`
Expected: FAIL because all filters are always visible and there is no toggle.

**Step 3: Write minimal implementation**

- Add local UI state for advanced-filter expansion in `TransactionsView`.
- Keep `Buscar`, `De`, `Ate`, and `Conta` always visible.
- Move `Metodo`, `Categoria`, and `Pessoa` into a conditional block.
- Add a toggle button labeled `Filtros avancados`.
- Preserve the same `filterForm` structure and submit behavior.

```tsx
{showAdvancedFilters ? (
  <>
    <label>Metodo do filtro ...</label>
    <label>Categoria do filtro ...</label>
    <label>Pessoa do filtro ...</label>
  </>
) : null}
```

**Step 4: Run test to verify it passes**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx -t "updates and voids a transaction from the transactions view"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/features/transactions/transactions-view.tsx packages/frontend/src/App.test.tsx
git commit -m "refactor: collapse advanced transaction filters"
```

### Task 4: Full Verification For The Second UX Cycle

**Files:**
- Verify: `packages/frontend/src/App.test.tsx`
- Verify: `packages/frontend/src/features/transactions/transactions-view.copy.test.tsx`
- Verify: `packages/frontend/src/features/dashboard/dashboard-view.test.tsx`

**Step 1: Run the focused regression suite**

Run: `npm --prefix packages/frontend run test -- --run src/App.test.tsx src/features/transactions/transactions-view.copy.test.tsx src/features/dashboard/dashboard-view.test.tsx`
Expected: PASS

**Step 2: Run the production build**

Run: `npm --prefix packages/frontend run build`
Expected: PASS

**Step 3: Manually smoke-check the launch flow**

Run the app and verify:

- `+ Lancar` opens the modal
- `Despesa` can switch to card payment and show card-specific fields
- `Transferencia` can switch between internal transfer and invoice payment
- `Transacoes` opens with advanced filters collapsed

**Step 4: Commit the cycle**

```bash
git add packages/frontend/src/App.tsx packages/frontend/src/components/quick-add-composer.tsx packages/frontend/src/features/transactions/transactions-view.tsx packages/frontend/src/App.test.tsx docs/plans/2026-03-04-ux-front-end-second-cycle-design.md docs/plans/2026-03-04-ux-front-end-second-cycle.md
git commit -m "refactor: simplify canonical launch flow"
```
