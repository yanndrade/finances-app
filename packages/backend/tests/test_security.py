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
    lock_app = LockAppUseCase(store)

    store.bootstrap()
    lock_app.execute()

    assert store.requires_lock_on_startup() is False
    assert store.is_locked() is False


def test_lan_pairing_generates_single_use_pair_tokens_and_device_token(
    tmp_path: Path,
) -> None:
    store = SecurityStore(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    store.set_lan_enabled(True)

    pair_token = store.issue_pair_token()
    first_pair = store.pair_device(pair_token.token, device_name="Pixel")
    second_pair = store.pair_device(pair_token.token, device_name="Pixel")

    assert first_pair is not None
    assert second_pair is None
    assert store.verify_device_token(
        first_pair.device_token,
        request_ip="192.168.1.50",
    )

    devices = store.list_authorized_devices()
    assert len(devices) == 1
    assert devices[0].name == "Pixel"
    assert devices[0].last_seen_ip == "192.168.1.50"


def test_lan_devices_can_be_revoked(tmp_path: Path) -> None:
    store = SecurityStore(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    store.set_lan_enabled(True)

    pair_token = store.issue_pair_token()
    paired = store.pair_device(pair_token.token, device_name="iPhone")
    assert paired is not None
    assert store.verify_device_token(paired.device_token)

    assert store.revoke_device(paired.device_id) is True
    assert store.revoke_device(paired.device_id) is False
    assert store.verify_device_token(paired.device_token) is False
    assert store.list_authorized_devices() == []
