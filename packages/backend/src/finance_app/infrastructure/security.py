from __future__ import annotations

import hashlib
import ipaddress
import os
import re
import secrets
import socket
import subprocess
import time
from datetime import UTC
from datetime import datetime
from datetime import timedelta
from threading import Lock

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from argon2.low_level import Type
from sqlalchemy import Boolean
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import sessionmaker

from finance_app.domain.security import AuthorizedDevice
from finance_app.domain.security import DevicePairingResult
from finance_app.domain.security import LanNetworkInfo
from finance_app.domain.security import LanSecurityState
from finance_app.domain.security import PairToken
from finance_app.domain.security import SecurityState
from finance_app.infrastructure.db import get_engine

DEFAULT_PAIR_TOKEN_TTL_SECONDS = 300
NETWORK_CACHE_TTL_SECONDS = 15.0


class SecurityBase(DeclarativeBase):
    """Metadata for local security state stored in app.db."""


class SecuritySettingsRecord(SecurityBase):
    __tablename__ = "app_security"

    singleton_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    inactivity_lock_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)


class LockStateRecord(SecurityBase):
    __tablename__ = "app_lock_state"

    singleton_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class LanSecuritySettingsRecord(SecurityBase):
    __tablename__ = "lan_security_settings"

    singleton_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pair_token_ttl_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=DEFAULT_PAIR_TOKEN_TTL_SECONDS,
    )


class LanPairTokenRecord(SecurityBase):
    __tablename__ = "lan_pair_tokens"

    pair_token_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[str] = mapped_column(String, nullable=False)
    consumed_at: Mapped[str | None] = mapped_column(String, nullable=True)


class AuthorizedDeviceRecord(SecurityBase):
    __tablename__ = "authorized_devices"

    device_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    last_seen_at: Mapped[str | None] = mapped_column(String, nullable=True)
    last_seen_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    revoked_at: Mapped[str | None] = mapped_column(String, nullable=True)


class SecurityStore:
    def __init__(self, database_url: str | None = None) -> None:
        self._engine = get_engine(database_url)
        self._session_factory = sessionmaker(
            bind=self._engine,
            autoflush=False,
            autocommit=False,
        )
        self._hasher = PasswordHasher(type=Type.ID)
        self._network_lock = Lock()
        self._cached_network: LanNetworkInfo | None = None
        self._cached_network_expires_at = 0.0

    def bootstrap(self) -> None:
        SecurityBase.metadata.create_all(self._engine)
        with self._session_factory.begin() as session:
            settings = session.get(SecuritySettingsRecord, 1)
            lock_state = session.get(LockStateRecord, 1)
            lan_settings = session.get(LanSecuritySettingsRecord, 1)

            if settings is None:
                session.add(
                    SecuritySettingsRecord(
                        singleton_id=1,
                        password_hash=None,
                        inactivity_lock_seconds=None,
                    )
                )

            if lock_state is None:
                session.add(LockStateRecord(singleton_id=1, is_locked=False))

            if lan_settings is None:
                session.add(
                    LanSecuritySettingsRecord(
                        singleton_id=1,
                        enabled=False,
                        pair_token_ttl_seconds=DEFAULT_PAIR_TOKEN_TTL_SECONDS,
                    )
                )

    def set_password(self, password: str, inactivity_lock_seconds: int | None = None) -> None:
        self.bootstrap()
        password_hash = self._hasher.hash(password)

        with self._session_factory.begin() as session:
            settings = session.get(SecuritySettingsRecord, 1)
            lock_state = session.get(LockStateRecord, 1)
            assert settings is not None
            assert lock_state is not None

            settings.password_hash = password_hash
            settings.inactivity_lock_seconds = inactivity_lock_seconds
            lock_state.is_locked = True

    def verify_password(self, password: str) -> bool:
        self.bootstrap()
        state = self.read_security_state()

        if not state.password_hash:
            return False

        try:
            return self._hasher.verify(state.password_hash, password)
        except VerifyMismatchError:
            return False

    def lock(self) -> None:
        self.bootstrap()
        with self._session_factory.begin() as session:
            settings = session.get(SecuritySettingsRecord, 1)
            lock_state = session.get(LockStateRecord, 1)
            assert settings is not None
            assert lock_state is not None

            if not settings.password_hash:
                lock_state.is_locked = False
                return

            lock_state.is_locked = True

    def unlock(self, password: str) -> bool:
        if not self.verify_password(password):
            return False

        with self._session_factory.begin() as session:
            lock_state = session.get(LockStateRecord, 1)
            assert lock_state is not None
            lock_state.is_locked = False

        return True

    def is_locked(self) -> bool:
        return self.read_security_state().is_locked

    def requires_lock_on_startup(self) -> bool:
        state = self.read_security_state()
        return bool(state.password_hash) and state.is_locked

    def read_security_state(self) -> SecurityState:
        self.bootstrap()
        with self._session_factory() as session:
            settings = session.get(SecuritySettingsRecord, 1)
            lock_state = session.get(LockStateRecord, 1)
            assert settings is not None
            assert lock_state is not None

            return SecurityState(
                password_hash=settings.password_hash,
                inactivity_lock_seconds=settings.inactivity_lock_seconds,
                is_locked=lock_state.is_locked,
            )

    def read_lan_security_state(self) -> LanSecurityState:
        self.bootstrap()
        with self._session_factory() as session:
            settings = session.get(LanSecuritySettingsRecord, 1)
            assert settings is not None
            return LanSecurityState(
                enabled=settings.enabled,
                pair_token_ttl_seconds=max(60, settings.pair_token_ttl_seconds),
            )

    def set_lan_enabled(self, enabled: bool) -> LanSecurityState:
        self.bootstrap()
        with self._session_factory.begin() as session:
            settings = session.get(LanSecuritySettingsRecord, 1)
            assert settings is not None
            settings.enabled = enabled
            pair_ttl = max(60, settings.pair_token_ttl_seconds)
            settings.pair_token_ttl_seconds = pair_ttl
            return LanSecurityState(enabled=enabled, pair_token_ttl_seconds=pair_ttl)

    def issue_pair_token(self) -> PairToken:
        self.bootstrap()
        lan_state = self.read_lan_security_state()
        now = _utc_now()
        expires_at = now + timedelta(seconds=lan_state.pair_token_ttl_seconds)
        raw_token = secrets.token_urlsafe(24)
        token_hash = _hash_token(raw_token)

        with self._session_factory.begin() as session:
            _delete_expired_pair_tokens(session=session, now=now)
            session.add(
                LanPairTokenRecord(
                    token_hash=token_hash,
                    created_at=_to_utc_iso(now),
                    expires_at=_to_utc_iso(expires_at),
                    consumed_at=None,
                )
            )

        return PairToken(token=raw_token, expires_at=_to_utc_iso(expires_at))

    def pair_device(
        self,
        pair_token: str,
        device_name: str | None = None,
    ) -> DevicePairingResult | None:
        self.bootstrap()
        token_hash = _hash_token(pair_token.strip())
        now = _utc_now()
        sanitized_name = (device_name or "").strip() or "Mobile device"
        sanitized_name = sanitized_name[:160]

        with self._session_factory.begin() as session:
            _delete_expired_pair_tokens(session=session, now=now)
            pair_record = (
                session.query(LanPairTokenRecord)
                .filter(LanPairTokenRecord.token_hash == token_hash)
                .first()
            )
            if pair_record is None:
                return None
            if pair_record.consumed_at is not None:
                return None
            if _from_utc_iso(pair_record.expires_at) <= now:
                return None

            pair_record.consumed_at = _to_utc_iso(now)

            raw_device_token = secrets.token_urlsafe(36)
            device_record = AuthorizedDeviceRecord(
                device_id=f"device-{secrets.token_hex(8)}",
                name=sanitized_name,
                token_hash=_hash_token(raw_device_token),
                created_at=_to_utc_iso(now),
                last_seen_at=None,
                last_seen_ip=None,
                revoked_at=None,
            )
            session.add(device_record)

            return DevicePairingResult(
                device_id=device_record.device_id,
                device_token=raw_device_token,
                created_at=device_record.created_at,
            )

    def list_authorized_devices(self) -> list[AuthorizedDevice]:
        self.bootstrap()
        with self._session_factory() as session:
            records = (
                session.query(AuthorizedDeviceRecord)
                .filter(AuthorizedDeviceRecord.revoked_at.is_(None))
                .order_by(AuthorizedDeviceRecord.created_at.desc())
                .all()
            )
            return [
                AuthorizedDevice(
                    device_id=record.device_id,
                    name=record.name,
                    created_at=record.created_at,
                    last_seen_at=record.last_seen_at,
                    last_seen_ip=record.last_seen_ip,
                    revoked_at=record.revoked_at,
                )
                for record in records
            ]

    def revoke_device(self, device_id: str) -> bool:
        self.bootstrap()
        now_iso = _to_utc_iso(_utc_now())
        with self._session_factory.begin() as session:
            record = session.get(AuthorizedDeviceRecord, device_id)
            if record is None:
                return False
            if record.revoked_at is not None:
                return False
            record.revoked_at = now_iso
            return True

    def verify_device_token(self, device_token: str, *, request_ip: str | None = None) -> bool:
        self.bootstrap()
        token_hash = _hash_token(device_token.strip())
        now_iso = _to_utc_iso(_utc_now())
        with self._session_factory.begin() as session:
            record = (
                session.query(AuthorizedDeviceRecord)
                .filter(AuthorizedDeviceRecord.token_hash == token_hash)
                .first()
            )
            if record is None:
                return False
            if record.revoked_at is not None:
                return False

            record.last_seen_at = now_iso
            if request_ip:
                record.last_seen_ip = request_ip[:64]
            return True

    def resolve_lan_network(self) -> LanNetworkInfo | None:
        self.bootstrap()
        now = time.monotonic()
        with self._network_lock:
            if now < self._cached_network_expires_at:
                return self._cached_network

        detected = _resolve_lan_network()
        with self._network_lock:
            self._cached_network = detected
            self._cached_network_expires_at = now + NETWORK_CACHE_TTL_SECONDS
        return detected

    def dump_raw_security_values(self) -> str:
        self.bootstrap()
        with self._session_factory() as session:
            settings = session.get(SecuritySettingsRecord, 1)
            assert settings is not None
            return settings.password_hash or ""


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _to_utc_iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _from_utc_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def _delete_expired_pair_tokens(*, session, now: datetime) -> None:
    now_iso = _to_utc_iso(now)
    session.query(LanPairTokenRecord).filter(
        LanPairTokenRecord.expires_at <= now_iso
    ).delete(synchronize_session=False)


def _resolve_lan_network() -> LanNetworkInfo | None:
    local_ip = _discover_private_ipv4()
    if local_ip is None:
        return None

    subnet = _discover_subnet_for_ip(local_ip)
    if subnet is None:
        subnet = str(ipaddress.ip_network(f"{local_ip}/24", strict=False))

    return LanNetworkInfo(local_ip=local_ip, subnet_cidr=subnet)


def _discover_private_ipv4() -> str | None:
    candidates: list[str] = []

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("10.255.255.255", 1))
            candidates.append(probe.getsockname()[0])
    except OSError:
        pass

    try:
        hostname = socket.gethostname()
        for family, _, _, _, sockaddr in socket.getaddrinfo(hostname, None):
            if family != socket.AF_INET:
                continue
            candidates.append(sockaddr[0])
    except OSError:
        pass

    seen: set[str] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        try:
            ip = ipaddress.ip_address(candidate)
        except ValueError:
            continue
        if (
            ip.version == 4
            and ip.is_private
            and not ip.is_loopback
            and not ip.is_link_local
            and not ip.is_multicast
        ):
            return candidate

    return None


def _discover_subnet_for_ip(local_ip: str) -> str | None:
    windows_subnet = _discover_windows_subnet(local_ip)
    if windows_subnet is not None:
        return windows_subnet

    unix_subnet = _discover_unix_subnet(local_ip)
    if unix_subnet is not None:
        return unix_subnet

    return None


def _discover_windows_subnet(local_ip: str) -> str | None:
    if os.name != "nt":
        return None

    try:
        output = subprocess.run(
            ["ipconfig"],
            capture_output=True,
            text=True,
            check=False,
            timeout=2,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return None

    sections = re.split(r"\r?\n\r?\n", output)
    for section in sections:
        if local_ip not in section:
            continue
        mask_match = re.search(
            r"Subnet Mask[ .]*:\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)",
            section,
            flags=re.IGNORECASE,
        )
        if mask_match is None:
            continue
        try:
            network = ipaddress.ip_interface(
                f"{local_ip}/{mask_match.group(1)}"
            ).network
        except ValueError:
            continue
        return str(network)

    return None


def _discover_unix_subnet(local_ip: str) -> str | None:
    try:
        output = subprocess.run(
            ["ip", "-o", "-f", "inet", "addr", "show"],
            capture_output=True,
            text=True,
            check=False,
            timeout=2,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return None

    prefix_match = re.search(
        rf"\binet\s+{re.escape(local_ip)}/(\d{{1,2}})\b",
        output,
    )
    if prefix_match is None:
        return None

    try:
        prefix = int(prefix_match.group(1))
        network = ipaddress.ip_interface(f"{local_ip}/{prefix}").network
    except ValueError:
        return None

    return str(network)
