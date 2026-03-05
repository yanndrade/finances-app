from pathlib import Path

import pytest

from finance_app.application.event_store import AppendEventUseCase
from finance_app.domain.events import NewEvent
from finance_app.infrastructure.db import get_default_events_database_url
from finance_app.infrastructure.event_store import EventStore, EventStoreError


def test_default_events_database_url_is_anchored_to_backend_project() -> None:
    project_root = Path(__file__).resolve().parents[1]
    expected = f"sqlite:///{(project_root / 'events.db').as_posix()}"

    assert get_default_events_database_url() == expected


def test_append_event_persists_versioned_payloads_in_order(tmp_path: Path) -> None:
    database_url = f"sqlite:///{(tmp_path / 'events.db').as_posix()}"
    store = EventStore(database_url=database_url)
    store.create_schema()
    append_event = AppendEventUseCase(store)

    first_id = append_event.execute(
        NewEvent(
            type="AccountCreated",
            timestamp="2026-03-02T12:00:00Z",
            payload={"id": "acc-1", "name": "Wallet"},
            version=1,
        )
    )
    second_id = append_event.execute(
        NewEvent(
            type="ExpenseCreated",
            timestamp="2026-03-02T12:01:00Z",
            payload={"id": "txn-1", "amount": 10_00},
            version=2,
        )
    )

    events = store.list_events()

    assert [first_id, second_id] == [1, 2]
    assert [event.event_id for event in events] == [1, 2]
    assert events[0].payload == {"id": "acc-1", "name": "Wallet"}
    assert events[1].version == 2


def test_event_store_enables_sqlite_wal_mode(tmp_path: Path) -> None:
    database_url = f"sqlite:///{(tmp_path / 'events.db').as_posix()}"
    store = EventStore(database_url=database_url)
    store.create_schema()

    assert store.get_journal_mode().lower() == "wal"


def test_append_event_is_atomic_when_payload_is_not_serializable(tmp_path: Path) -> None:
    database_url = f"sqlite:///{(tmp_path / 'events.db').as_posix()}"
    store = EventStore(database_url=database_url)
    store.create_schema()
    append_event = AppendEventUseCase(store)

    with pytest.raises(EventStoreError):
        append_event.execute(
            NewEvent(
                type="ExpenseCreated",
                timestamp="2026-03-02T12:01:00Z",
                payload={"invalid": {1, 2, 3}},
                version=1,
            )
        )

    assert store.list_events() == []


def test_append_batch_is_atomic_when_one_event_is_invalid(tmp_path: Path) -> None:
    database_url = f"sqlite:///{(tmp_path / 'events.db').as_posix()}"
    store = EventStore(database_url=database_url)
    store.create_schema()

    with pytest.raises(EventStoreError):
        store.append_batch(
            [
                NewEvent(
                    type="AccountCreated",
                    timestamp="2026-03-02T12:00:00Z",
                    payload={"id": "acc-1", "name": "Wallet"},
                    version=1,
                ),
                NewEvent(
                    type="ExpenseCreated",
                    timestamp="2026-03-02T12:01:00Z",
                    payload={"invalid": {1, 2, 3}},
                    version=1,
                ),
            ]
        )

    assert store.list_events() == []
