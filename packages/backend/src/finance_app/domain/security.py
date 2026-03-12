from dataclasses import dataclass


@dataclass(frozen=True)
class SecurityState:
    password_hash: str | None
    inactivity_lock_seconds: int | None
    is_locked: bool


@dataclass(frozen=True)
class LanSecurityState:
    enabled: bool
    pair_token_ttl_seconds: int


@dataclass(frozen=True)
class PairToken:
    token: str
    expires_at: str


@dataclass(frozen=True)
class AuthorizedDevice:
    device_id: str
    name: str
    created_at: str
    last_seen_at: str | None
    last_seen_ip: str | None
    revoked_at: str | None


@dataclass(frozen=True)
class DevicePairingResult:
    device_id: str
    device_token: str
    created_at: str


@dataclass(frozen=True)
class LanNetworkInfo:
    local_ip: str
    subnet_cidr: str
