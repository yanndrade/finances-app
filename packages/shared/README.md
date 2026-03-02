# Shared

Shared contracts consumed by multiple packages.

- `schemas/`: serialized payload definitions and validation schemas
- `types/`: shared type declarations and transport-facing models

Keep this package framework-agnostic so backend, frontend, and desktop can depend on it safely.
