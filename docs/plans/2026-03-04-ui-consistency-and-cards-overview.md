# UI Consistency And Cards Overview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the visual hierarchy across the main frontend screens, remove redundant in-view headers, and make `Cartoes` open in a portfolio-level invoice overview before drilling into a specific card.

**Architecture:** Keep `AppShell` as the single semantic page header, refactor each feature view to start with a functional toolbar or first content block, and restructure `CardsView` around a scope-aware overview/detail flow. Reuse existing `cards` and `invoices` data in the frontend for aggregation so the first pass stays UI-only.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, existing shared UI components in `packages/frontend/src/components` and `packages/frontend/src/components/ui`.

---

### Task 1: Lock In The Header Hierarchy

**Files:**
- Modify: `packages/frontend/src/App.tsx`
- Modify: `packages/frontend/src/components/app-shell.tsx`
- Test: `packages/frontend/src/app-startup-performance.test.tsx`

**Step 1: Write the failing test**

Update the startup test so it asserts the shell owns the page title and the support copy is short.

```tsx
render(<App />);

expect(screen.getByRole("heading", { level: 1, name: /visao geral do caixa/i })).toBeInTheDocument();
expect(screen.getByText("Resumo do mes e alertas.")).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app-startup-performance.test.tsx`
Expected: FAIL because the old shell copy is still present.

**Step 3: Write minimal implementation**

- Shorten the `VIEW_META` descriptions in `App.tsx`.
- Keep `AppShell` as the only page-level title/description.
- Do not add new in-view headings.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/app-startup-performance.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/App.tsx packages/frontend/src/components/app-shell.tsx packages/frontend/src/app-startup-performance.test.tsx
git commit -m "refactor: tighten shell header copy"
```

### Task 2: Remove Duplicate In-View Headers From Main Screens

**Files:**
- Modify: `packages/frontend/src/features/dashboard/dashboard-view.tsx`
- Modify: `packages/frontend/src/features/accounts/accounts-view.tsx`
- Modify: `packages/frontend/src/features/transactions/transactions-view.tsx`
- Modify: `packages/frontend/src/features/movements/movements-panel.tsx`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Replace assertions that depend on removed duplicate headings with assertions on the actual first functional blocks.

```tsx
render(<App />);

expect(await screen.findByDisplayValue(/\d{4}-\d{2}/)).toBeInTheDocument(); // month input on dashboard
await userEvent.click(screen.getByRole("button", { name: /^contas$/i }));
expect(await screen.findByRole("button", { name: /\+ adicionar conta/i })).toBeInTheDocument();
await userEvent.click(screen.getByRole("button", { name: /^transacoes$/i }));
expect(await screen.findByRole("button", { name: /aplicar filtros/i })).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL because the test suite still expects the removed introductory headings.

**Step 3: Write minimal implementation**

- In `dashboard-view.tsx`, remove the internal title block and keep only the month control plus content.
- In `accounts-view.tsx`, remove the intro copy and make the section begin with actions/stats.
- In `transactions-view.tsx`, remove the explanatory heading wrapper and let filters lead.
- In `movements-panel.tsx`, remove repeated headings and keep mode + form first.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/features/dashboard/dashboard-view.tsx packages/frontend/src/features/accounts/accounts-view.tsx packages/frontend/src/features/transactions/transactions-view.tsx packages/frontend/src/features/movements/movements-panel.tsx packages/frontend/src/App.test.tsx
git commit -m "refactor: remove redundant in-view headers"
```

### Task 3: Introduce A Shared In-View Toolbar Pattern

**Files:**
- Modify: `packages/frontend/src/features/accounts/accounts-view.tsx`
- Modify: `packages/frontend/src/features/transactions/transactions-view.tsx`
- Modify: `packages/frontend/src/features/movements/movements-panel.tsx`
- Modify: `packages/frontend/src/styles.css`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Add resilient assertions that each screen exposes its primary controls without relying on descriptive copy.

```tsx
await userEvent.click(screen.getByRole("button", { name: /^movimentar$/i }));
expect(await screen.findByRole("tablist", { name: /modo de lancamento/i })).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL if labels or control layout are not yet stable.

**Step 3: Write minimal implementation**

- Normalize top spacing and control grouping in the main views.
- Use a shared visual rhythm: action row first, then content.
- Keep helper copy only where it directly changes a user decision.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/features/accounts/accounts-view.tsx packages/frontend/src/features/transactions/transactions-view.tsx packages/frontend/src/features/movements/movements-panel.tsx packages/frontend/src/styles.css packages/frontend/src/App.test.tsx
git commit -m "style: unify in-view toolbar patterns"
```

### Task 4: Add Aggregate Scope To Cards

**Files:**
- Modify: `packages/frontend/src/features/cards/cards-view.tsx`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Add a new cards test that asserts the default view opens in aggregate mode.

```tsx
render(<App />);

await userEvent.click(screen.getByRole("button", { name: /^cards$/i }));

expect(await screen.findByText(/todos os cartoes/i)).toBeInTheDocument();
expect(screen.getByText(/faturas abertas/i)).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx -t "opens cards in aggregate mode"`
Expected: FAIL because `CardsView` still defaults to the first active card.

**Step 3: Write minimal implementation**

- Replace the default selected scope with an aggregate `all` state.
- Make the scope selector include `Todos os cartoes` plus individual cards.
- Derive aggregate invoice metrics from `invoices`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx -t "opens cards in aggregate mode"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/features/cards/cards-view.tsx packages/frontend/src/App.test.tsx
git commit -m "feat: default cards to aggregate overview"
```

### Task 5: Restructure Cards Summary Into Overview Then Drill-Down

**Files:**
- Modify: `packages/frontend/src/features/cards/cards-view.tsx`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Add a test that covers scope switching from aggregate to a specific card.

```tsx
await userEvent.click(screen.getByRole("button", { name: /^cards$/i }));
expect(await screen.findByText(/faturas abertas/i)).toBeInTheDocument();

await userEvent.click(screen.getByRole("combobox"));
await userEvent.click(screen.getByRole("option", { name: /nubank/i }));

expect(await screen.findByText(/regra do agora/i)).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx -t "switches cards from aggregate to detail"`
Expected: FAIL because there is no aggregate/detail mode split yet.

**Step 3: Write minimal implementation**

- Create a `Resumo` default view that shows:
  - totals
  - open invoice count
  - upcoming due items
  - grouped invoice cards
- Render the existing rich card-detail layout only when a specific card is selected.
- Keep `Compras` and `Ajustes` tabs bound to the active scope.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx -t "switches cards from aggregate to detail"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/features/cards/cards-view.tsx packages/frontend/src/App.test.tsx
git commit -m "feat: add cards overview drill-down"
```

### Task 6: Align Cards Visual Hierarchy With The New Shared Pattern

**Files:**
- Modify: `packages/frontend/src/features/cards/cards-view.tsx`
- Modify: `packages/frontend/src/styles.css`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Update the cards tests so they no longer rely on the removed duplicate internal `h1`.

```tsx
await userEvent.click(screen.getByRole("button", { name: /^cards$/i }));
expect(await screen.findByRole("tab", { name: /resumo/i })).toBeInTheDocument();
expect(screen.queryByRole("heading", { level: 1, name: /cartoes e ciclos/i })).not.toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL until the old internal cards title block is removed.

**Step 3: Write minimal implementation**

- Remove the internal `Cartoes e Ciclos` heading block.
- Replace it with a compact toolbar for period, scope, and `Novo`.
- Preserve the stronger typography and emphasis in the content cards themselves.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/features/cards/cards-view.tsx packages/frontend/src/styles.css packages/frontend/src/App.test.tsx
git commit -m "style: align cards header hierarchy"
```

### Task 7: Full Verification

**Files:**
- Verify: `packages/frontend/src/App.tsx`
- Verify: `packages/frontend/src/features/dashboard/dashboard-view.tsx`
- Verify: `packages/frontend/src/features/accounts/accounts-view.tsx`
- Verify: `packages/frontend/src/features/transactions/transactions-view.tsx`
- Verify: `packages/frontend/src/features/movements/movements-panel.tsx`
- Verify: `packages/frontend/src/features/cards/cards-view.tsx`
- Verify: `packages/frontend/src/App.test.tsx`
- Verify: `packages/frontend/src/app-startup-performance.test.tsx`

**Step 1: Run the focused frontend suite**

Run: `npx vitest run src/App.test.tsx src/app-startup-performance.test.tsx`
Expected: PASS

**Step 2: Run production build**

Run: `npm run build`
Expected: PASS with split chunks preserved

**Step 3: Sanity-check the final UX**

Run: `npm run dev -- --host 127.0.0.1 --port 5174`
Expected: the shell owns the only page header, and `Cartoes` opens in aggregate overview mode

**Step 4: Commit**

```bash
git add packages/frontend/src/App.tsx packages/frontend/src/features/dashboard/dashboard-view.tsx packages/frontend/src/features/accounts/accounts-view.tsx packages/frontend/src/features/transactions/transactions-view.tsx packages/frontend/src/features/movements/movements-panel.tsx packages/frontend/src/features/cards/cards-view.tsx packages/frontend/src/App.test.tsx packages/frontend/src/app-startup-performance.test.tsx packages/frontend/src/styles.css
git commit -m "feat: unify screen hierarchy and cards overview"
```
