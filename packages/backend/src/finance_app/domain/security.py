from dataclasses import dataclass


@dataclass(frozen=True)
class SecurityState:
    password_hash: str | None
    inactivity_lock_seconds: int | None
    is_locked: bool
