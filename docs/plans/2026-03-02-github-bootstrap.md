# GitHub Bootstrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the private GitHub repository, initialize the local git repository, and publish a milestone-driven issue and release structure derived from the PRD and frontend guidelines.

**Architecture:** Use the current workspace as the source for the initial commit, then create a private remote repository named `finances-app`. Organize work in GitHub with labels, milestones, issues, and roadmap releases aligned to the PRD milestones and cross-cutting frontend requirements.

**Tech Stack:** Git, GitHub CLI (`gh`), Markdown docs, GitHub Issues, GitHub Releases

---

### Task 1: Persist the planning docs

**Files:**
- Create: `docs/plans/2026-03-02-project-setup-design.md`
- Create: `docs/plans/2026-03-02-github-bootstrap.md`

**Step 1: Verify docs exist**

Run: `Get-ChildItem docs\\plans`
Expected: both planning files are present

**Step 2: Commit planning docs**

Run:

```bash
git add docs/plans
git commit -m "docs: add project setup design and github bootstrap plan"
```

Expected: commit created successfully

### Task 2: Initialize local git repository

**Files:**
- Create: `.gitignore`

**Step 1: Add minimal ignore rules**

Include:

```gitignore
.env
dist/
target/
node_modules/
*.db
*.sqlite
__pycache__/
```

**Step 2: Initialize git**

Run: `git init -b main`
Expected: repository initialized on `main`

**Step 3: Commit base docs**

Run:

```bash
git add .
git commit -m "chore: bootstrap repository planning docs"
```

Expected: initial commit exists

### Task 3: Create the private GitHub repository

**Files:**
- Modify: `.git/config`

**Step 1: Verify `gh` authentication**

Run: `gh auth status`
Expected: authenticated account shown

**Step 2: Create remote repository**

Run: `gh repo create finances-app --private --source . --remote origin --push`
Expected: private repo created and `main` pushed

### Task 4: Create labels and milestones

**Files:**
- None

**Step 1: Create labels**

Run `gh label create ...` for repository taxonomy such as `epic`, `backend`, `frontend`, `desktop`, `security`, `infra`, `docs`, `qa`, `ux`, `priority:high`, `priority:medium`.

Expected: labels exist without duplicates

**Step 2: Create milestones**

Run `gh api` against `repos/{owner}/finances-app/milestones` to create:
- `v0.1.0 - Foundation`
- `v0.2.0 - Cash Flow`
- `v0.3.0 - Cards and Invoices`
- `v0.4.0 - Commitments`
- `v0.5.0 - Budgets and Reports`
- `v0.6.0 - Mobile LAN`
- `v1.0.0 - PRD Complete`

Expected: milestones listed in GitHub

### Task 5: Create tracked backlog issues

**Files:**
- None

**Step 1: Create milestone epics**

Run `gh issue create` for milestone overview issues that summarize scope and dependencies.

**Step 2: Create implementation issues**

Run `gh issue create` for specific backlog items covering:
- repo and monorepo scaffolding
- backend architecture
- event store and projector
- auth and security base
- accounts, cash transactions, transfers
- cards, invoices, installments, invoice payment
- reimbursements, recurring rules, budgets, investments
- dashboard, reports, filters
- frontend design system and layout
- Tauri shell, tray, autostart
- LAN pairing and HTTPS
- backup, restore, verification

Expected: each issue has a clear title, body, labels, and milestone assignment

### Task 6: Publish roadmap releases

**Files:**
- None

**Step 1: Create roadmap tags**

Run `git tag` for:
- `v0.1.0`
- `v0.2.0`
- `v0.3.0`
- `v0.4.0`
- `v0.5.0`
- `v0.6.0`
- `v1.0.0`

Push tags with `git push origin --tags`.

**Step 2: Create GitHub releases**

Run `gh release create` for each tag with planning notes describing the intended scope of that release.

Expected: roadmap releases visible in GitHub
