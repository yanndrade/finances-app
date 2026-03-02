# Issue 8 Monorepo Scaffold Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the initial monorepo directory structure and explanatory placeholder documentation for issue `#8`.

**Architecture:** Keep the implementation documentation-first and mirror the PRD directory layout closely. Add one verification script that checks for the expected tree so the scaffold can be validated repeatably without introducing package-specific build systems.

**Tech Stack:** Git, PowerShell, Markdown

---

### Task 1: Add structural verification

**Files:**
- Create: `scripts/check-monorepo-structure.ps1`

**Step 1: Write the failing verification**

Add a PowerShell script that asserts the required files and directories exist for the target monorepo shape.

**Step 2: Run it before scaffolding**

Run: `powershell -ExecutionPolicy Bypass -File scripts/check-monorepo-structure.ps1`
Expected: FAIL because the scaffold does not exist yet

### Task 2: Create the monorepo scaffold

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `.gitignore`
- Create: `.gitattributes`
- Create: `.editorconfig`
- Create: `docs/prd.md`
- Create: `docs/frontend-guidelines.md`
- Create: `docs/README.md`
- Create: `docs/architecture.md`
- Create: `docs/adr/README.md`
- Create: `scripts/README.md`
- Create: `infra/README.md`
- Create: `infra/installers/README.md`
- Create: `infra/icons/README.md`
- Create: `packages/README.md`
- Create: `packages/shared/README.md`
- Create: `packages/backend/README.md`
- Create: `packages/frontend/README.md`
- Create: `packages/desktop/README.md`
- Create required placeholder directories under `packages/`

**Step 1: Add the directories and documentation**

Mirror the PRD structure and explain the package boundaries in the package READMEs.

**Step 2: Re-run verification**

Run: `powershell -ExecutionPolicy Bypass -File scripts/check-monorepo-structure.ps1`
Expected: PASS

### Task 3: Finalize branch

**Files:**
- Modify: repository index

**Step 1: Review changes**

Run: `git status --short`
Expected: only the scaffold and plan/design files are staged or modified

**Step 2: Commit**

Run:

```bash
git add .
git commit -m "feat: scaffold monorepo structure"
```

Expected: commit created successfully
