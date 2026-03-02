from pathlib import Path

from sqlalchemy import text

from finance_app.application.event_store import AppendEventUseCase
from finance_app.application.projector import ProjectEventsUseCase, RebuildProjectionsUseCase
from finance_app.domain.events import NewEvent
from finance_app.infrastructure.db import get_engine
from finance_app.infrastructure.event_store import EventStore
from finance_app.infrastructure.projector import Projector


def test_projector_bootstraps_app_db_with_zero_cursor(tmp_path: Path) -> None:
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    projector.bootstrap()

    assert projector.get_last_applied_event_id() == 0
    assert projector.list_accounts() == []


def test_projector_materializes_accounts_and_advances_cursor(tmp_path: Path) -> None:
    event_store = EventStore(
        database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    event_store.create_schema()
    append_event = AppendEventUseCase(event_store)
    append_event.execute(
        NewEvent(
            type="AccountCreated",
            timestamp="2026-03-02T12:00:00Z",
            payload={
                "id": "acc-1",
                "name": "Main Wallet",
                "type": "wallet",
                "initial_balance": 100_00,
                "is_active": True,
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    project_events = ProjectEventsUseCase(projector)

    applied = project_events.execute()

    assert applied == 1
    assert projector.get_last_applied_event_id() == 1
    assert projector.list_accounts() == [
        {
            "account_id": "acc-1",
            "name": "Main Wallet",
            "type": "wallet",
            "initial_balance": 100_00,
            "is_active": True,
        }
    ]
    assert projector.list_balance_states() == [
        {
            "account_id": "acc-1",
            "current_balance": 100_00,
        }
    ]


def test_projector_rerun_without_new_events_is_idempotent(tmp_path: Path) -> None:
    event_store = EventStore(
        database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    event_store.create_schema()
    append_event = AppendEventUseCase(event_store)
    append_event.execute(
        NewEvent(
            type="AccountCreated",
            timestamp="2026-03-02T12:00:00Z",
            payload={
                "id": "acc-1",
                "name": "Main Wallet",
                "type": "wallet",
                "initial_balance": 100_00,
                "is_active": True,
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    project_events = ProjectEventsUseCase(projector)

    first = project_events.execute()
    second = project_events.execute()

    assert first == 1
    assert second == 0
    assert projector.get_last_applied_event_id() == 1
    assert len(projector.list_accounts()) == 1


def test_projector_rebuild_replays_history_into_fresh_projection(tmp_path: Path) -> None:
    event_store = EventStore(
        database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    event_store.create_schema()
    append_event = AppendEventUseCase(event_store)
    append_event.execute(
        NewEvent(
            type="AccountCreated",
            timestamp="2026-03-02T12:00:00Z",
            payload={
                "id": "acc-1",
                "name": "Main Wallet",
                "type": "wallet",
                "initial_balance": 100_00,
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="AccountCreated",
            timestamp="2026-03-02T12:01:00Z",
            payload={
                "id": "acc-2",
                "name": "Savings",
                "type": "checking",
                "initial_balance": 250_00,
                "is_active": True,
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    rebuild = RebuildProjectionsUseCase(projector)

    applied = rebuild.execute()

    assert applied == 2
    assert projector.get_last_applied_event_id() == 2
    assert projector.list_accounts() == [
        {
            "account_id": "acc-1",
            "name": "Main Wallet",
            "type": "wallet",
            "initial_balance": 100_00,
            "is_active": True,
        },
        {
            "account_id": "acc-2",
            "name": "Savings",
            "type": "checking",
            "initial_balance": 250_00,
            "is_active": True,
        },
    ]
    assert projector.list_balance_states() == [
        {
            "account_id": "acc-1",
            "current_balance": 100_00,
        },
        {
            "account_id": "acc-2",
            "current_balance": 250_00,
        },
    ]


def test_projector_updates_accounts_and_balance_state(tmp_path: Path) -> None:
    event_store = EventStore(
        database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    event_store.create_schema()
    append_event = AppendEventUseCase(event_store)
    append_event.execute(
        NewEvent(
            type="AccountCreated",
            timestamp="2026-03-02T12:00:00Z",
            payload={
                "id": "acc-1",
                "name": "Main Wallet",
                "type": "wallet",
                "initial_balance": 100_00,
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="AccountUpdated",
            timestamp="2026-03-02T12:01:00Z",
            payload={
                "id": "acc-1",
                "name": "Emergency Fund",
                "type": "savings",
                "initial_balance": 300_00,
                "is_active": False,
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    applied = projector.run()

    assert applied == 2
    assert projector.list_accounts() == [
        {
            "account_id": "acc-1",
            "name": "Emergency Fund",
            "type": "savings",
            "initial_balance": 300_00,
            "is_active": False,
        }
    ]
    assert projector.list_balance_states() == [
        {
            "account_id": "acc-1",
            "current_balance": 300_00,
        }
    ]


def test_projector_rebuilds_legacy_projection_schema_on_upgrade(tmp_path: Path) -> None:
    event_store = EventStore(
        database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    event_store.create_schema()
    append_event = AppendEventUseCase(event_store)
    append_event.execute(
        NewEvent(
            type="AccountCreated",
            timestamp="2026-03-02T12:00:00Z",
            payload={
                "id": "acc-1",
                "name": "Main Wallet",
                "type": "wallet",
                "initial_balance": 100_00,
                "is_active": True,
            },
            version=1,
        )
    )

    legacy_projection_url = f"sqlite:///{(tmp_path / 'app.db').as_posix()}"
    legacy_engine = get_engine(legacy_projection_url)
    with legacy_engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE accounts (
                    account_id VARCHAR PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    type VARCHAR NOT NULL,
                    initial_balance INTEGER NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO accounts (account_id, name, type, initial_balance)
                VALUES ('acc-1', 'Main Wallet', 'wallet', 10000)
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE event_cursor (
                    singleton_id INTEGER PRIMARY KEY,
                    last_applied_event_id INTEGER NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO event_cursor (singleton_id, last_applied_event_id)
                VALUES (1, 1)
                """
            )
        )

    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=legacy_projection_url,
    )

    applied = projector.run()

    assert applied == 1
    assert projector.get_last_applied_event_id() == 1
    assert projector.list_accounts() == [
        {
            "account_id": "acc-1",
            "name": "Main Wallet",
            "type": "wallet",
            "initial_balance": 100_00,
            "is_active": True,
        }
    ]
    assert projector.list_balance_states() == [
        {
            "account_id": "acc-1",
            "current_balance": 100_00,
        }
    ]
