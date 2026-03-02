from __future__ import annotations

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

from finance_app.domain.security import SecurityState
from finance_app.infrastructure.db import get_engine


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


class SecurityStore:
    def __init__(self, database_url: str | None = None) -> None:
        self._engine = get_engine(database_url)
        self._session_factory = sessionmaker(
            bind=self._engine,
            autoflush=False,
            autocommit=False,
        )
        self._hasher = PasswordHasher(type=Type.ID)

    def bootstrap(self) -> None:
        SecurityBase.metadata.create_all(self._engine)
        with self._session_factory.begin() as session:
            settings = session.get(SecuritySettingsRecord, 1)
            lock_state = session.get(LockStateRecord, 1)

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

    def dump_raw_security_values(self) -> str:
        self.bootstrap()
        with self._session_factory() as session:
            settings = session.get(SecuritySettingsRecord, 1)
            assert settings is not None
            return settings.password_hash or ""
