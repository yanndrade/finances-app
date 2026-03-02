# Project Setup Design

**Context**

The product ground truth is defined by `PRD.md` and `FRONTEND-GUIDELINES.md`. The user wants the full product described there, with execution tracked in GitHub from day one.

**Decision**

Use a single private GitHub repository named `finances-app` as the product monorepo. Treat the local folder as the initial source of truth and bootstrap Git tracking here. Convert the product documents into an operational backlog rather than mirroring document sections mechanically.

**Backlog Model**

- Create milestone-level tracking that maps to the PRD roadmap (`M0` through `M5`) plus `v1.0.0`.
- Create implementation issues by capability:
  - architecture and persistence foundations
  - backend domain features
  - frontend foundation and UX system
  - desktop shell
  - security and LAN/mobile
  - verification and release hardening
- Keep frontend guideline work as cross-cutting issues that support multiple feature issues.

**Release Model**

- Create GitHub releases as roadmap checkpoints:
  - `v0.1.0` foundation
  - `v0.2.0` accounts and cash transactions
  - `v0.3.0` cards, invoices, invoice payments
  - `v0.4.0` installments, reimbursements, recurring expenses
  - `v0.5.0` budgets and reports
  - `v0.6.0` secure mobile LAN
  - `v1.0.0` full PRD v1 scope

**Execution Notes**

- Create labels first so issues can be consistently categorized.
- Create milestones before issues so every issue is assigned immediately.
- Push an initial commit before creating releases, since GitHub releases need tags.
- Release entries will be planning releases tied to tags that represent roadmap checkpoints.
