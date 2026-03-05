# Relatorio Unificado UX/UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Executar P0/P1 inicial para tornar `+ Lancar` o unico padrao de entrada, remover painel contextual fixo e iniciar a migracao para Historico Unificado.

**Architecture:** Faseamos mudancas em fatias verticais no frontend com TDD, preservando contratos atuais da API e sem big-bang. Primeiro consolidamos shell/navegacao/entrypoint, depois reestruturamos telas especializadas para usar presets do mesmo modal universal.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Tailwind CSS, FastAPI backend existente.

---

### Task 1: Remover Painel Contextual Fixo do Shell (P0)

**Files:**
- Modify: `packages/frontend/src/App.tsx`
- Modify: `packages/frontend/src/components/app-shell-responsive.test.tsx`
- Modify: `packages/frontend/src/components/app-shell.tsx`

**Step 1: Write the failing test**

Adicionar teste que garanta que a aplicacao desktop nao renderiza coluna contextual fixa por padrao.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/app-shell-responsive.test.tsx --run`
Expected: FAIL em assercoes de comportamento de contexto fixo.

**Step 3: Write minimal implementation**

- Remover `contextPanel` do uso em `App.tsx`
- Manter `AppShell` sem dependencia obrigatoria de coluna lateral
- Ajustar teste para validar sidebar + conteudo principal sem painel fixo

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/app-shell-responsive.test.tsx --run`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/App.tsx packages/frontend/src/components/app-shell.tsx packages/frontend/src/components/app-shell-responsive.test.tsx
git commit -m "feat(frontend): remove fixed contextual panel from desktop shell"
```

### Task 2: Consolidar Taxonomia de Navegacao para Historico Unificado (P0)

**Files:**
- Modify: `packages/frontend/src/components/sidebar.tsx`
- Modify: `packages/frontend/src/App.tsx`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Adicionar expectativa de labels atualizadas na navegacao desktop:
- `Historico unificado`
- `Patrimonio & investimentos`
- `Analises & relatorios`

**Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx --run`
Expected: FAIL por labels antigas.

**Step 3: Write minimal implementation**

Atualizar metadados de navegacao e copy em `VIEW_META` e `DESKTOP_NAV_ITEMS`.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx --run`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/components/sidebar.tsx packages/frontend/src/App.tsx packages/frontend/src/App.test.tsx
git commit -m "feat(frontend): align desktop navigation taxonomy with unified report"
```

### Task 3: Introduzir Presets no Modal Universal (+ Lancar) (P0)

**Files:**
- Modify: `packages/frontend/src/components/quick-add-composer.tsx`
- Modify: `packages/frontend/src/components/quick-add/use-quick-add-reducer.ts`
- Test: `packages/frontend/src/components/quick-add-composer.test.tsx`
- Modify: `packages/frontend/src/App.tsx`

**Step 1: Write the failing test**

Criar testes para abrir `QuickAddComposer` com preset inicial:
- `expense`
- `transfer_invoice_payment`
- `investment_contribution`

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/quick-add-composer.test.tsx --run`
Expected: FAIL por ausencia de suporte a preset.

**Step 3: Write minimal implementation**

- Adicionar prop `preset` ao `QuickAddComposer`
- No abrir do modal, aplicar estado inicial coerente ao preset
- Em `App.tsx`, controlar preset ao abrir modal global

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/quick-add-composer.test.tsx --run`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/components/quick-add-composer.tsx packages/frontend/src/components/quick-add/use-quick-add-reducer.ts packages/frontend/src/components/quick-add-composer.test.tsx packages/frontend/src/App.tsx
git commit -m "feat(frontend): add quick add presets for unified entrypoint"
```

### Task 4: Remover Formularios Embutidos de Investimentos e Usar Presets (P0)

**Files:**
- Modify: `packages/frontend/src/features/investments/investments-view.tsx`
- Modify: `packages/frontend/src/App.tsx`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Adicionar teste que valida:
- ausencia de formulario embutido de aporte/resgate
- existencia de CTA(s) que abrem modal global com preset de investimento

**Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx --run`
Expected: FAIL pois view atual ainda tem formularios locais.

**Step 3: Write minimal implementation**

- Trocar formularios por blocos de acao com CTA
- Disparar `onOpenQuickAdd` com preset `investment_contribution` ou `investment_withdrawal`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx --run`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/features/investments/investments-view.tsx packages/frontend/src/App.tsx packages/frontend/src/App.test.tsx
git commit -m "feat(frontend): route investment actions to global quick add presets"
```

### Task 5: Preparar Historico Unificado com Barra de Filtros e KPI de Recorte (P1 inicial)

**Files:**
- Modify: `packages/frontend/src/features/transactions/transactions-view.tsx`
- Modify: `packages/frontend/src/styles.css`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Write the failing test**

Adicionar testes para verificar:
- cabecalho de Historico Unificado
- KPIs de recorte (Entradas, Saidas, Resultado)
- filtros principais visiveis no topo

**Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx --run`
Expected: FAIL sem estrutura nova.

**Step 3: Write minimal implementation**

- Reorganizar `TransactionsView` para layout de ledger
- Calcular KPIs com base no recorte filtrado
- Manter edicao/estorno existente sem regressao

**Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx --run`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/frontend/src/features/transactions/transactions-view.tsx packages/frontend/src/styles.css packages/frontend/src/App.test.tsx
git commit -m "feat(frontend): start unified ledger layout with filter KPIs"
```

### Task 6: Verificacao Integrada da Fase Atual

**Files:**
- Test: `packages/frontend/src/components/app-shell-responsive.test.tsx`
- Test: `packages/frontend/src/components/quick-add-composer.test.tsx`
- Test: `packages/frontend/src/App.test.tsx`

**Step 1: Run focused suites**

Run: `npm test -- src/components/app-shell-responsive.test.tsx src/components/quick-add-composer.test.tsx src/App.test.tsx --run`
Expected: PASS

**Step 2: Run full frontend suite**

Run: `npm test -- --run`
Expected: PASS

**Step 3: Document residual risks**

Registrar no PR/notas:
- pendencias de P1 backend para agregacao total de ledger
- command palette (Ctrl+K) ainda sem semantica de busca de acoes

**Step 4: Commit verification updates (if needed)**

```bash
git add .
git commit -m "test(frontend): verify p0 unified entrypoint and shell migration"
```
