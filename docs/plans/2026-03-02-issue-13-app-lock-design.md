# Issue 13 App Lock And Password Hashing Design

**Context**

Issue `#13` establishes the first local desktop security boundary. The PRD requires a lock screen on startup, optional inactivity locking, and strong password hashing with no plaintext storage.

**Decision**

Use Argon2id via `argon2-cffi` for password hashing and keep the first persisted security state in `app.db`. Implement a minimal `SecurityStore` that owns persisted credential and lock state records, then expose application-layer use cases for password setup, verification, lock, and unlock.

**Scope**

- Persist only Argon2id hashes, never plaintext passwords
- Store lock state separately from the password hash
- Prepare optional inactivity lock as persisted configuration data
- Keep the flow local-only; no HTTP session/token work in this issue

**Validation**

Use pytest to verify password creation, password verification, lock/unlock transitions, startup lock behavior, and that no plaintext password is written to disk.
