# Issue 9 Shared Contract Package Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the shared contract package, define its version source, and document how future shared payload artifacts should evolve.

**Architecture:** Keep the implementation narrow and stable: create only the shared package subtree needed by issue `#9`, then anchor its evolution on `version.txt` and package-level documentation. Use a verification script as the repeatable proof that the package exists and the contract version source is defined.

**Tech Stack:** Git, PowerShell, Markdown

---

### Task 1: Add shared package verification

**Files:**
- Create: `scripts/check-shared-contract-package.ps1`

**Step 1: Write the failing verification**

Add a PowerShell script that asserts the shared package paths exist and that `packages/shared/version.txt` contains a non-empty version string.

**Step 2: Run it before implementation**

Run: `powershell -ExecutionPolicy Bypass -File scripts/check-shared-contract-package.ps1`
Expected: FAIL because the shared package is not present on `main`

### Task 2: Create the shared contract package

**Files:**
- Create: `packages/shared/README.md`
- Create: `packages/shared/version.txt`
- Create: `packages/shared/schemas/README.md`
- Create: `packages/shared/types/README.md`
- Create: `packages/shared/contracts/README.md`

**Step 1: Add the package files**

Document package responsibilities, future artifact locations, and contract version bump rules.

**Step 2: Re-run verification**

Run: `powershell -ExecutionPolicy Bypass -File scripts/check-shared-contract-package.ps1`
Expected: PASS

### Task 3: Finalize the branch

**Files:**
- Modify: repository index

**Step 1: Review changes**

Run: `git status --short`
Expected: only the issue `#9` docs, script, and shared package files are present

**Step 2: Commit**

Run:

```bash
git add .
git commit -m "feat: define shared contract package"
```

Expected: commit created successfully
