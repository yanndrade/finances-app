# Issue 8 Monorepo Scaffold Design

**Context**

Issue `#8` asks for the initial monorepo directory layout described in section 19.2 of `PRD.md`. The repository currently contains only the source planning docs, so the goal is to establish the canonical folder boundaries without prematurely introducing package tooling.

**Decision**

Implement the monorepo shape from the PRD with documentation-first placeholders. Create the directory tree for `docs`, `scripts`, `infra`, and `packages`, then add package-level `README.md` files that explain ownership and intended contents for backend, frontend, desktop, and shared code.

**Scope**

- Preserve the PRD and frontend guidelines as initial source material under `docs/`
- Create the top-level support folders and package roots from the PRD layout
- Create placeholder files only where documentation clarifies structure
- Do not add toolchain manifests such as `pyproject.toml`, `package.json`, or `tauri.conf.json` in this issue

**Validation**

Use a structure verification script that asserts the expected directories and placeholder documentation exist. Run it before implementation to confirm it fails on the current repository, then run it again after scaffolding to confirm the layout is present.
