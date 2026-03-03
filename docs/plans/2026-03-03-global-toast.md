# Global Toast Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** substituir os banners inline por um toast global com auto-dismiss para todo feedback transitório do frontend.

**Architecture:** o `App` passa a concentrar o estado do feedback em um host global de toast, renderizado fora das views. As telas deixam de receber mensagens para exibição inline, e as mutações/erros chamam uma função única de publicação de toast com descarte automático.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, CSS global.

---

### Task 1: Cobrir o comportamento novo em teste

**Files:**
- Modify: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Adicionar um teste que:
- cria uma conta;
- verifica que o feedback aparece como toast global;
- navega para outra tela;
- garante que a view de destino não renderiza um banner inline antigo.

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend test -- --run packages/frontend/src/App.test.tsx`
Expected: FAIL porque a aplicação ainda usa banners inline e não renderiza o host de toast.

**Step 3: Write minimal implementation**

Implementar apenas o necessário para o teste encontrar um toast global e não encontrar banners inline nas views.

**Step 4: Run test to verify it passes**

Run: `npm --prefix packages/frontend test -- --run packages/frontend/src/App.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/App.test.tsx
git commit -m "test: cover global toast notifications"
```

### Task 2: Implementar o host global de toast

**Files:**
- Create: `packages/frontend/src/components/toast-viewport.tsx`
- Modify: `packages/frontend/src/App.tsx`
- Modify: `packages/frontend/src/styles.css`

**Step 1: Write the failing test**

Expandir o teste anterior para validar:
- botão de fechar no toast;
- auto-dismiss após o timeout.

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend test -- --run packages/frontend/src/App.test.tsx`
Expected: FAIL porque ainda não existe timer ou botão de fechar do toast.

**Step 3: Write minimal implementation**

Adicionar:
- componente de toast global;
- estado com `id`, `tone` e `message`;
- timer para descarte automático;
- botão de fechar.

**Step 4: Run test to verify it passes**

Run: `npm --prefix packages/frontend test -- --run packages/frontend/src/App.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/components/toast-viewport.tsx packages/frontend/src/App.tsx packages/frontend/src/styles.css packages/frontend/src/App.test.tsx
git commit -m "feat: add global toast notifications"
```

### Task 3: Remover banners inline das views

**Files:**
- Modify: `packages/frontend/src/features/accounts/accounts-view.tsx`
- Modify: `packages/frontend/src/features/transactions/transactions-view.tsx`
- Modify: `packages/frontend/src/features/movements/movements-panel.tsx`
- Modify: `packages/frontend/src/features/settings/settings-view.tsx`
- Modify: `packages/frontend/src/App.tsx`

**Step 1: Write the failing test**

Adicionar cobertura para garantir que:
- `AccountsView` e `TransactionsView` não dependem mais de `notice`;
- `MovementsPanel` e `SettingsView` não renderizam banners de erro/sucesso inline.

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend test -- --run`
Expected: FAIL com props antigas e renderização dos banners ainda existente.

**Step 3: Write minimal implementation**

Remover props e blocos JSX de banners, mantendo somente o toast global como feedback.

**Step 4: Run test to verify it passes**

Run: `npm --prefix packages/frontend test -- --run`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/features/accounts/accounts-view.tsx packages/frontend/src/features/transactions/transactions-view.tsx packages/frontend/src/features/movements/movements-panel.tsx packages/frontend/src/features/settings/settings-view.tsx packages/frontend/src/App.tsx
git commit -m "refactor: remove inline notification banners"
```

### Task 4: Verificação final

**Files:**
- Modify: `packages/frontend/src/App.test.tsx`

**Step 1: Run focused verification**

Run: `npm --prefix packages/frontend test -- --run packages/frontend/src/App.test.tsx`
Expected: PASS

**Step 2: Run frontend test suite**

Run: `npm --prefix packages/frontend test -- --run`
Expected: PASS

**Step 3: Run production build**

Run: `npm --prefix packages/frontend run build`
Expected: build concluído com sucesso.

**Step 4: Commit**

```bash
git add packages/frontend/src/App.test.tsx packages/frontend/src/App.tsx packages/frontend/src/components/toast-viewport.tsx packages/frontend/src/features/accounts/accounts-view.tsx packages/frontend/src/features/movements/movements-panel.tsx packages/frontend/src/features/settings/settings-view.tsx packages/frontend/src/features/transactions/transactions-view.tsx packages/frontend/src/styles.css docs/plans/2026-03-03-global-toast-design.md docs/plans/2026-03-03-global-toast.md
git commit -m "feat: replace inline notices with global toast"
```
