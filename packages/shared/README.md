# Shared

Shared contracts consumed by multiple packages.

- `schemas/`: serialized payload definitions and validation schemas
- `types/`: shared type declarations and transport-facing models
- `contracts/`: endpoint-facing DTO and validation artifact index
- `version.txt`: source of truth for the shared UI/API contract version

Keep this package framework-agnostic so backend, frontend, and desktop can depend on it safely.

## Contract Versioning

`version.txt` is the canonical contract version used to coordinate frontend and backend changes.

Increment the contract version whenever a shared integration surface changes, including:

- adding, removing, or renaming fields in shared payloads
- changing a field type, validation rule, or serialized meaning
- adding, removing, or reshaping an endpoint contract that both UI and API must understand

Do not increment it for internal refactors that do not change shared payloads or endpoint behavior.
