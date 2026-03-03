# Quick Entry Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the existing quick-entry screen into a desktop-first, low-friction flow with mode switching, sticky defaults, BRL currency input, and safer transfer UX.

**Architecture:** Keep `MovementsPanel` as the route-level entry point, but convert it into a single-shell quick-entry screen that renders one active form at a time. Implement the new behavior entirely in the frontend using existing API contracts, with local UI state, `localStorage`, and focused Vitest coverage.

**Tech Stack:** Git, React, TypeScript, Vite, Vitest, Testing Library, localStorage

---

### Task 1: Persist the approved design

**Files:**
- Create: `docs/plans/2026-03-03-quick-entry-design.md`

**Step 1: Review the saved design**

Run: `Get-Content -Raw docs/plans/2026-03-03-quick-entry-design.md`
Expected: the file describes the approved scope, component structure, desktop-first UX, validation, and testing strategy

**Step 2: Commit the design doc**

Run:

```bash
git add docs/plans/2026-03-03-quick-entry-design.md
git commit -m "docs: add quick entry refactor design"
```

Expected: commit created successfully

### Task 2: Add failing tests for the new quick-entry behavior

**Files:**
- Modify: `packages/frontend/src/features/movements/movements-panel.test.tsx`

**Step 1: Write the failing test**

Add coverage for:

- only one form mode is visible at a time
- the transaction form defaults to a desktop-first quick-entry flow
- BRL currency input converts correctly to cents
- sticky defaults are restored from `localStorage`
- `Ctrl+Enter` keeps sticky fields and clears variable fields
- `Esc` clears the current form
- transfer blocks identical origin and destination accounts

**Step 2: Run test to verify it fails**

Run: `npm --prefix packages/frontend test -- --run src/features/movements/movements-panel.test.tsx`
Expected: FAIL because the current screen still renders the old dual-form layout and missing behaviors

### Task 3: Implement the quick-entry refactor in the movements screen

**Files:**
- Modify: `packages/frontend/src/features/movements/movements-panel.tsx`

**Step 1: Write minimal implementation**

Implement:

- active mode switch for `Entrada`, `Saida`, and `Transferencia`
- one visible form at a time
- desktop-first field order with a prominent BRL `Valor` field
- sticky defaults backed by `localStorage`
- inline transfer guardrails, account inversion, and impact preview
- keyboard shortcuts for submit and clear
- category suggestion input that still allows free typing

**Step 2: Run test to verify it passes**

Run: `npm --prefix packages/frontend test -- --run src/features/movements/movements-panel.test.tsx`
Expected: PASS

### Task 4: Update shared app integration if needed

**Files:**
- Modify: `packages/frontend/src/App.tsx`

**Step 1: Add failing verification**

Confirm the existing app-level movement flow test still reflects the new labels and interactions.

Run: `npm --prefix packages/frontend test -- --run src/features/movements/movements-panel.test.tsx src/App.test.tsx`
Expected: FAIL if app-level selectors or success messages no longer match the refactored UI

**Step 2: Write minimal implementation**

Adjust app-level notices or movement wiring only if needed to support:

- pt-BR labels
- contextual success feedback
- unchanged route and submit contracts

**Step 3: Run verification**

Run: `npm --prefix packages/frontend test -- --run src/features/movements/movements-panel.test.tsx src/App.test.tsx`
Expected: PASS

### Task 5: Add desktop-first visual styling for the new flow

**Files:**
- Modify: `packages/frontend/src/styles.css`

**Step 1: Add failing verification**

Run the frontend tests after introducing new structural classes in the component.

Run: `npm --prefix packages/frontend test -- --run src/features/movements/movements-panel.test.tsx`
Expected: PASS functionally, but the UI is still missing the intended desktop-first presentation

**Step 2: Write minimal implementation**

Implement styles for:

- segmented mode switch
- contained single-column quick-entry layout
- prominent currency input
- details accordion section
- inline helper and validation text
- local toast/banner presentation
- responsive fallback that preserves desktop-first hierarchy

**Step 3: Run verification**

Run:
- `npm --prefix packages/frontend test -- --run src/features/movements/movements-panel.test.tsx`
- `npm --prefix packages/frontend run build`

Expected: PASS

### Task 6: Run full frontend verification

**Files:**
- Modify: repository index

**Step 1: Run focused test suite**

Run: `npm --prefix packages/frontend test -- --run`
Expected: PASS

**Step 2: Run build verification**

Run: `npm --prefix packages/frontend run build`
Expected: PASS

**Step 3: Review git diff**

Run: `git diff -- docs/plans/2026-03-03-quick-entry-design.md docs/plans/2026-03-03-quick-entry-refactor.md packages/frontend/src/features/movements/movements-panel.tsx packages/frontend/src/features/movements/movements-panel.test.tsx packages/frontend/src/App.tsx packages/frontend/src/styles.css`
Expected: only the intended quick-entry refactor changes are present
