from pathlib import Path

from finance_app.application.security import (
    CreatePasswordUseCase,
    LockAppUseCase,
    UnlockAppUseCase,
    VerifyPasswordUseCase,
)
from finance_app.infrastructure.security import SecurityStore


def test_password_setup_stores_only_hash_and_starts_locked(tmp_path: Path) -> None:
    store = SecurityStore(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    create_password = CreatePasswordUseCase(store)

    create_password.execute("s3cr3t-password", inactivity_lock_seconds=300)

    security_state = store.read_security_state()

    assert security_state.password_hash
    assert security_state.password_hash != "s3cr3t-password"
    assert "s3cr3t-password" not in store.dump_raw_security_values()
    assert security_state.inactivity_lock_seconds == 300
    assert store.is_locked() is True
    assert store.requires_lock_on_startup() is True


def test_password_verification_accepts_correct_password_only(tmp_path: Path) -> None:
    store = SecurityStore(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    create_password = CreatePasswordUseCase(store)
    verify_password = VerifyPasswordUseCase(store)

    create_password.execute("s3cr3t-password")

    assert verify_password.execute("s3cr3t-password") is True
    assert verify_password.execute("wrong-password") is False


def test_unlock_requires_valid_password_and_lock_can_be_restored(tmp_path: Path) -> None:
    store = SecurityStore(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    create_password = CreatePasswordUseCase(store)
    unlock_app = UnlockAppUseCase(store)
    lock_app = LockAppUseCase(store)

    create_password.execute("s3cr3t-password")

    assert unlock_app.execute("wrong-password") is False
    assert store.is_locked() is True

    assert unlock_app.execute("s3cr3t-password") is True
    assert store.is_locked() is False

    lock_app.execute()
    assert store.is_locked() is True


def test_lock_without_password_does_not_require_startup_lock(tmp_path: Path) -> None:
    store = SecurityStore(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    store.bootstrap()

    assert store.requires_lock_on_startup() is False
    assert store.is_locked() is False
