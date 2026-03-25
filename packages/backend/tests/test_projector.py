import threading
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.exc import NoSuchTableError

from finance_app.application.event_store import AppendEventUseCase
from finance_app.application.projector import (
    ProjectEventsUseCase,
    RebuildProjectionsUseCase,
)
from finance_app.domain.events import NewEvent
from finance_app.infrastructure import projector as projector_module
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


def test_projector_rebuild_replays_history_into_fresh_projection(
    tmp_path: Path,
) -> None:
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


def test_projector_rebuilds_issue_14_projection_when_transactions_table_is_missing(
    tmp_path: Path,
) -> None:
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

    projection_url = f"sqlite:///{(tmp_path / 'app.db').as_posix()}"
    engine = get_engine(projection_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE accounts (
                    account_id VARCHAR PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    type VARCHAR NOT NULL,
                    initial_balance INTEGER NOT NULL,
                    is_active BOOLEAN NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO accounts (account_id, name, type, initial_balance, is_active)
                VALUES ('acc-1', 'Main Wallet', 'wallet', 10000, 1)
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE balance_state (
                    account_id VARCHAR PRIMARY KEY,
                    current_balance INTEGER NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO balance_state (account_id, current_balance)
                VALUES ('acc-1', 10000)
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
        projection_database_url=projection_url,
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
    assert projector.list_transactions() == []


def test_projector_materializes_cash_transactions_and_updates_balance(
    tmp_path: Path,
) -> None:
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
            type="IncomeCreated",
            timestamp="2026-03-02T12:01:00Z",
            payload={
                "id": "tx-1",
                "occurred_at": "2026-03-02T12:01:00Z",
                "type": "income",
                "amount": 50_00,
                "account_id": "acc-1",
                "payment_method": "PIX",
                "category_id": "salary",
                "description": "Salary",
                "person_id": None,
                "status": "active",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="ExpenseCreated",
            timestamp="2026-03-02T12:02:00Z",
            payload={
                "id": "tx-2",
                "occurred_at": "2026-03-02T12:02:00Z",
                "type": "expense",
                "amount": 20_00,
                "account_id": "acc-1",
                "payment_method": "CASH",
                "category_id": "food",
                "description": "Lunch",
                "person_id": "restaurant",
                "status": "active",
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    applied = projector.run()

    assert applied == 3
    assert projector.list_transactions() == [
        {
            "transaction_id": "tx-2",
            "occurred_at": "2026-03-02T12:02:00Z",
            "type": "expense",
            "amount": 20_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Lunch",
            "person_id": "restaurant",
            "status": "active",
        },
        {
            "transaction_id": "tx-1",
            "occurred_at": "2026-03-02T12:01:00Z",
            "type": "income",
            "amount": 50_00,
            "account_id": "acc-1",
            "payment_method": "PIX",
            "category_id": "salary",
            "description": "Salary",
            "person_id": None,
            "status": "active",
        },
    ]
    assert projector.list_balance_states() == [
        {
            "account_id": "acc-1",
            "current_balance": 130_00,
        }
    ]


def test_projector_bootstrap_serializes_concurrent_schema_creation(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    original_create_all = projector_module.ProjectionBase.metadata.create_all
    entered_first = threading.Event()
    allow_release = threading.Event()
    state_lock = threading.Lock()
    active_calls = 0
    saw_concurrent_create = False
    failures: list[Exception] = []

    monkeypatch.setattr(projector, "_projection_schema_requires_rebuild", lambda: False)

    def wrapped_create_all(*args: object, **kwargs: object) -> None:
        nonlocal active_calls, saw_concurrent_create
        is_first_call = False

        with state_lock:
            active_calls += 1
            if active_calls == 1:
                is_first_call = True
                entered_first.set()
            else:
                saw_concurrent_create = True
                allow_release.set()

        if is_first_call:
            allow_release.wait(timeout=0.25)

        try:
            original_create_all(*args, **kwargs)
        finally:
            with state_lock:
                active_calls -= 1

    monkeypatch.setattr(
        projector_module.ProjectionBase.metadata, "create_all", wrapped_create_all
    )

    def call_bootstrap() -> None:
        try:
            projector.bootstrap()
        except Exception as exc:  # pragma: no cover - captured for assertion
            failures.append(exc)

    first = threading.Thread(target=call_bootstrap)
    second = threading.Thread(target=call_bootstrap)

    first.start()
    assert entered_first.wait(timeout=1)
    second.start()
    first.join()
    second.join()

    assert failures == []
    assert saw_concurrent_create is False


def test_projector_rebuilds_when_account_table_disappears_during_introspection(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    class FlakyInspector:
        def get_table_names(self) -> list[str]:
            return ["accounts"]

        def get_columns(self, table_name: str) -> list[dict[str, str]]:
            raise NoSuchTableError(table_name)

    monkeypatch.setattr(projector_module, "inspect", lambda _engine: FlakyInspector())

    assert projector._projection_schema_requires_rebuild() is True


def test_projector_materializes_card_purchases_into_invoice_cycles(
    tmp_path: Path,
) -> None:
    event_store = EventStore(
        database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    event_store.create_schema()
    append_event = AppendEventUseCase(event_store)
    append_event.execute(
        NewEvent(
            type="CardCreated",
            timestamp="2026-03-02T12:00:00Z",
            payload={
                "id": "card-1",
                "name": "Nubank",
                "limit": 150_000,
                "closing_day": 10,
                "due_day": 20,
                "payment_account_id": "acc-1",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardPurchaseCreated",
            timestamp="2026-03-10T12:00:00Z",
            payload={
                "id": "purchase-1",
                "purchase_date": "2026-03-10T12:00:00Z",
                "amount": 100_00,
                "category_id": "food",
                "card_id": "card-1",
                "description": "Groceries",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardPurchaseCreated",
            timestamp="2026-03-11T12:00:00Z",
            payload={
                "id": "purchase-2",
                "purchase_date": "2026-03-11T12:00:00Z",
                "amount": 50_00,
                "category_id": "transport",
                "card_id": "card-1",
                "description": "Taxi",
            },
            version=1,
        )
    )

    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    applied = projector.run()

    assert applied == 3
    assert projector.list_invoices(card_id="card-1") == [
        {
            "invoice_id": "card-1:2026-04",
            "card_id": "card-1",
            "reference_month": "2026-04",
            "closing_date": "2026-04-10",
            "due_date": "2026-04-20",
            "total_amount": 50_00,
            "paid_amount": 0,
            "remaining_amount": 50_00,
            "purchase_count": 1,
            "status": "open",
        },
        {
            "invoice_id": "card-1:2026-03",
            "card_id": "card-1",
            "reference_month": "2026-03",
            "closing_date": "2026-03-10",
            "due_date": "2026-03-20",
            "total_amount": 100_00,
            "paid_amount": 0,
            "remaining_amount": 100_00,
            "purchase_count": 1,
            "status": "open",
        },
    ]


def test_projector_distributes_installments_into_future_invoice_cycles(
    tmp_path: Path,
) -> None:
    event_store = EventStore(
        database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    event_store.create_schema()
    append_event = AppendEventUseCase(event_store)
    append_event.execute(
        NewEvent(
            type="CardCreated",
            timestamp="2026-03-02T12:00:00Z",
            payload={
                "id": "card-1",
                "name": "Nubank",
                "limit": 150_000,
                "closing_day": 10,
                "due_day": 20,
                "payment_account_id": "acc-1",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardPurchaseCreated",
            timestamp="2026-03-15T12:00:00Z",
            payload={
                "id": "purchase-1",
                "purchase_date": "2026-03-15T12:00:00Z",
                "amount": 100_00,
                "category_id": "electronics",
                "card_id": "card-1",
                "description": "Headphones",
                "installments_count": 3,
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
    assert projector.list_card_purchases() == [
        {
            "purchase_id": "purchase-1",
            "purchase_date": "2026-03-15T12:00:00Z",
            "amount": 100_00,
            "category_id": "electronics",
            "card_id": "card-1",
            "description": "Headphones",
            "installments_count": 3,
            "invoice_id": "card-1:2026-04",
            "reference_month": "2026-04",
            "closing_date": "2026-04-10",
            "due_date": "2026-04-20",
        }
    ]
    assert projector.list_invoices(card_id="card-1") == [
        {
            "invoice_id": "card-1:2026-06",
            "card_id": "card-1",
            "reference_month": "2026-06",
            "closing_date": "2026-06-10",
            "due_date": "2026-06-20",
            "total_amount": 33_34,
            "paid_amount": 0,
            "remaining_amount": 33_34,
            "purchase_count": 1,
            "status": "open",
        },
        {
            "invoice_id": "card-1:2026-05",
            "card_id": "card-1",
            "reference_month": "2026-05",
            "closing_date": "2026-05-10",
            "due_date": "2026-05-20",
            "total_amount": 33_33,
            "paid_amount": 0,
            "remaining_amount": 33_33,
            "purchase_count": 1,
            "status": "open",
        },
        {
            "invoice_id": "card-1:2026-04",
            "card_id": "card-1",
            "reference_month": "2026-04",
            "closing_date": "2026-04-10",
            "due_date": "2026-04-20",
            "total_amount": 33_33,
            "paid_amount": 0,
            "remaining_amount": 33_33,
            "purchase_count": 1,
            "status": "open",
        },
    ]
    assert projector.get_dashboard_summary(month="2026-05")["spending_by_category"] == [
        {
            "category_id": "electronics",
            "total": 33_33,
        }
    ]


def test_projector_reprojects_card_purchase_update_without_duplicating_invoices(
    tmp_path: Path,
) -> None:
    event_store = EventStore(
        database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    event_store.create_schema()
    append_event = AppendEventUseCase(event_store)
    append_event.execute(
        NewEvent(
            type="CardCreated",
            timestamp="2026-03-02T12:00:00Z",
            payload={
                "id": "card-1",
                "name": "Nubank",
                "limit": 150_000,
                "closing_day": 10,
                "due_day": 20,
                "payment_account_id": "acc-1",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardCreated",
            timestamp="2026-03-02T12:01:00Z",
            payload={
                "id": "card-2",
                "name": "Inter",
                "limit": 150_000,
                "closing_day": 15,
                "due_day": 25,
                "payment_account_id": "acc-2",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardPurchaseCreated",
            timestamp="2026-03-11T12:00:00Z",
            payload={
                "id": "purchase-1",
                "purchase_date": "2026-03-11T12:00:00Z",
                "amount": 90_00,
                "installments_count": 3,
                "category_id": "food",
                "card_id": "card-1",
                "description": "Lunch",
                "person_id": "empresa",
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    projector.run()

    append_event.execute(
        NewEvent(
            type="CardPurchaseUpdated",
            timestamp="2026-03-12T12:00:00Z",
            payload={
                "id": "purchase-1",
                "purchase_date": "2026-03-08T10:30:00Z",
                "amount": 120_00,
                "installments_count": 4,
                "category_id": "transport",
                "card_id": "card-2",
                "description": "Taxi",
                "person_id": "cliente",
            },
            version=1,
        )
    )

    applied = projector.run()

    assert applied == 1
    assert projector.list_card_purchases(card_id="card-1") == []
    assert projector.list_card_purchases(card_id="card-2") == [
        {
            "purchase_id": "purchase-1",
            "purchase_date": "2026-03-08T10:30:00Z",
            "amount": 120_00,
            "category_id": "transport",
            "card_id": "card-2",
            "description": "Taxi",
            "installments_count": 4,
            "invoice_id": "card-2:2026-03",
            "reference_month": "2026-03",
            "closing_date": "2026-03-15",
            "due_date": "2026-03-25",
        }
    ]
    assert projector.list_invoices(card_id="card-1") == []
    assert projector.list_invoices(card_id="card-2") == [
        {
            "invoice_id": "card-2:2026-06",
            "card_id": "card-2",
            "reference_month": "2026-06",
            "closing_date": "2026-06-15",
            "due_date": "2026-06-25",
            "total_amount": 30_00,
            "paid_amount": 0,
            "remaining_amount": 30_00,
            "purchase_count": 1,
            "status": "open",
        },
        {
            "invoice_id": "card-2:2026-05",
            "card_id": "card-2",
            "reference_month": "2026-05",
            "closing_date": "2026-05-15",
            "due_date": "2026-05-25",
            "total_amount": 30_00,
            "paid_amount": 0,
            "remaining_amount": 30_00,
            "purchase_count": 1,
            "status": "open",
        },
        {
            "invoice_id": "card-2:2026-04",
            "card_id": "card-2",
            "reference_month": "2026-04",
            "closing_date": "2026-04-15",
            "due_date": "2026-04-25",
            "total_amount": 30_00,
            "paid_amount": 0,
            "remaining_amount": 30_00,
            "purchase_count": 1,
            "status": "open",
        },
        {
            "invoice_id": "card-2:2026-03",
            "card_id": "card-2",
            "reference_month": "2026-03",
            "closing_date": "2026-03-15",
            "due_date": "2026-03-25",
            "total_amount": 30_00,
            "paid_amount": 0,
            "remaining_amount": 30_00,
            "purchase_count": 1,
            "status": "open",
        }
    ]
    assert projector.list_reimbursements() == [
        {
            "transaction_id": "purchase-1:4",
            "person_id": "cliente",
            "amount": 30_00,
            "amount_received": 0,
            "status": "pending",
            "account_id": "acc-2",
            "occurred_at": "2026-06-15T00:00:00Z",
            "expected_at": None,
            "received_at": None,
            "receipt_transaction_id": None,
            "notes": None,
        },
        {
            "transaction_id": "purchase-1:3",
            "person_id": "cliente",
            "amount": 30_00,
            "amount_received": 0,
            "status": "pending",
            "account_id": "acc-2",
            "occurred_at": "2026-05-15T00:00:00Z",
            "expected_at": None,
            "received_at": None,
            "receipt_transaction_id": None,
            "notes": None,
        },
        {
            "transaction_id": "purchase-1:2",
            "person_id": "cliente",
            "amount": 30_00,
            "amount_received": 0,
            "status": "pending",
            "account_id": "acc-2",
            "occurred_at": "2026-04-15T00:00:00Z",
            "expected_at": None,
            "received_at": None,
            "receipt_transaction_id": None,
            "notes": None,
        },
        {
            "transaction_id": "purchase-1:1",
            "person_id": "cliente",
            "amount": 30_00,
            "amount_received": 0,
            "status": "pending",
            "account_id": "acc-2",
            "occurred_at": "2026-03-15T00:00:00Z",
            "expected_at": None,
            "received_at": None,
            "receipt_transaction_id": None,
            "notes": None,
        },
    ]


def test_projector_keeps_installment_history_on_purchase_day(
    tmp_path: Path,
) -> None:
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
            type="CardCreated",
            timestamp="2026-03-02T12:01:00Z",
            payload={
                "id": "card-1",
                "name": "Nubank",
                "limit": 150_000,
                "closing_day": 10,
                "due_day": 20,
                "payment_account_id": "acc-1",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardPurchaseCreated",
            timestamp="2026-03-15T12:00:00Z",
            payload={
                "id": "purchase-1",
                "purchase_date": "2026-03-15T12:00:00Z",
                "amount": 90_00,
                "installments_count": 3,
                "category_id": "electronics",
                "card_id": "card-1",
                "description": "Notebook",
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    projector.run()

    april_installments = projector.list_unified_movements(
        competence_month="2026-04",
        scope="installments",
    )

    assert april_installments["items"][0]["movement_id"] == "purchase-1:1"
    assert april_installments["items"][0]["posted_at"] == "2026-03-15T12:00:00Z"
    assert april_installments["items"][0]["competence_month"] == "2026-04"


def test_projector_voids_card_purchase_and_removes_open_projections(
    tmp_path: Path,
) -> None:
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
            type="CardCreated",
            timestamp="2026-03-02T12:01:00Z",
            payload={
                "id": "card-1",
                "name": "Nubank",
                "limit": 150_000,
                "closing_day": 10,
                "due_day": 20,
                "payment_account_id": "acc-1",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardPurchaseCreated",
            timestamp="2026-03-11T12:00:00Z",
            payload={
                "id": "purchase-1",
                "purchase_date": "2026-03-11T12:00:00Z",
                "amount": 90_00,
                "category_id": "food",
                "card_id": "card-1",
                "description": "Lunch",
                "person_id": "friend",
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    projector.run()

    append_event.execute(
        NewEvent(
            type="CardPurchaseVoided",
            timestamp="2026-03-12T12:00:00Z",
            payload={
                "id": "purchase-1",
            },
            version=1,
        )
    )

    applied = projector.run()

    assert applied == 1
    assert projector.list_card_purchases() == []
    assert projector.list_invoices() == []
    assert projector.list_unified_movements(competence_month="2026-03")["items"] == []
    assert projector.list_reimbursements() == []


def test_projector_tracks_card_purchase_reimbursements_by_installment_month(
    tmp_path: Path,
) -> None:
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
            type="CardCreated",
            timestamp="2026-03-02T12:00:01Z",
            payload={
                "id": "card-1",
                "name": "Nubank",
                "limit": 150_000,
                "closing_day": 10,
                "due_day": 20,
                "payment_account_id": "acc-1",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardPurchaseCreated",
            timestamp="2026-03-02T12:00:02Z",
            payload={
                "id": "purchase-1",
                "purchase_date": "2026-03-02T12:02:00Z",
                "amount": 90_00,
                "installments_count": 3,
                "category_id": "food",
                "card_id": "card-1",
                "description": "Lunch",
                "person_id": "friend",
            },
            version=1,
        )
    )

    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    projector.run()

    march_dashboard = projector.get_dashboard_summary(month="2026-03")
    assert march_dashboard["pending_reimbursements_total"] == 30_00
    assert march_dashboard["pending_reimbursements"] == [
        {
            "transaction_id": "purchase-1:1",
            "person_id": "friend",
            "amount": 30_00,
            "amount_received": 0,
            "status": "pending",
            "account_id": "acc-1",
            "occurred_at": "2026-03-10T00:00:00Z",
            "expected_at": None,
            "received_at": None,
            "receipt_transaction_id": None,
            "notes": None,
        }
    ]

    april_dashboard = projector.get_dashboard_summary(month="2026-04")
    assert april_dashboard["pending_reimbursements_total"] == 30_00
    assert april_dashboard["pending_reimbursements"] == [
        {
            "transaction_id": "purchase-1:2",
            "person_id": "friend",
            "amount": 30_00,
            "amount_received": 0,
            "status": "pending",
            "account_id": "acc-1",
            "occurred_at": "2026-04-10T00:00:00Z",
            "expected_at": None,
            "received_at": None,
            "receipt_transaction_id": None,
            "notes": None,
        }
    ]


def test_projector_anchors_card_reimbursement_to_reference_month_not_due_month(
    tmp_path: Path,
) -> None:
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
            type="CardCreated",
            timestamp="2026-03-02T12:00:01Z",
            payload={
                "id": "card-1",
                "name": "Nubank",
                "limit": 150_000,
                "closing_day": 10,
                "due_day": 1,
                "payment_account_id": "acc-1",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardPurchaseCreated",
            timestamp="2026-03-02T12:00:02Z",
            payload={
                "id": "purchase-1",
                "purchase_date": "2026-03-02T12:02:00Z",
                "amount": 90_00,
                "installments_count": 3,
                "category_id": "food",
                "card_id": "card-1",
                "description": "Lunch",
                "person_id": "friend",
            },
            version=1,
        )
    )

    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    projector.run()

    march_dashboard = projector.get_dashboard_summary(month="2026-03")
    assert march_dashboard["pending_reimbursements_total"] == 30_00
    assert march_dashboard["pending_reimbursements"] == [
        {
            "transaction_id": "purchase-1:1",
            "person_id": "friend",
            "amount": 30_00,
            "amount_received": 0,
            "status": "pending",
            "account_id": "acc-1",
            "occurred_at": "2026-03-10T00:00:00Z",
            "expected_at": None,
            "received_at": None,
            "receipt_transaction_id": None,
            "notes": None,
        }
    ]


def test_projector_applies_invoice_payments_to_invoice_status_and_cash_balance(
    tmp_path: Path,
) -> None:
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
            type="CardCreated",
            timestamp="2026-03-02T12:00:01Z",
            payload={
                "id": "card-1",
                "name": "Nubank",
                "limit": 150_000,
                "closing_day": 10,
                "due_day": 20,
                "payment_account_id": "acc-1",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardPurchaseCreated",
            timestamp="2026-03-15T12:00:00Z",
            payload={
                "id": "purchase-1",
                "purchase_date": "2026-03-15T12:00:00Z",
                "amount": 100_00,
                "category_id": "electronics",
                "card_id": "card-1",
                "description": "Headphones",
                "installments_count": 1,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="InvoicePaid",
            timestamp="2026-03-20T12:00:00Z",
            payload={
                "id": "payment-1",
                "invoice_id": "card-1:2026-04",
                "card_id": "card-1",
                "amount": 40_00,
                "account_id": "acc-1",
                "paid_at": "2026-03-20T12:00:00Z",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="InvoicePaid",
            timestamp="2026-03-20T12:05:00Z",
            payload={
                "id": "payment-2",
                "invoice_id": "card-1:2026-04",
                "card_id": "card-1",
                "amount": 60_00,
                "account_id": "acc-1",
                "paid_at": "2026-03-20T12:05:00Z",
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    applied = projector.run()

    assert applied == 5
    assert projector.list_invoices(card_id="card-1") == [
        {
            "invoice_id": "card-1:2026-04",
            "card_id": "card-1",
            "reference_month": "2026-04",
            "closing_date": "2026-04-10",
            "due_date": "2026-04-20",
            "total_amount": 100_00,
            "paid_amount": 100_00,
            "remaining_amount": 0,
            "purchase_count": 1,
            "status": "paid",
        }
    ]
    assert projector.list_transactions(account_id="acc-1") == [
        {
            "transaction_id": "payment-2:invoice-payment",
            "occurred_at": "2026-03-20T12:05:00Z",
            "type": "expense",
            "amount": 60_00,
            "account_id": "acc-1",
            "payment_method": "OTHER",
            "category_id": "invoice_payment",
            "description": "Pagamento de fatura card-1:2026-04",
            "person_id": None,
            "status": "active",
        },
        {
            "transaction_id": "payment-1:invoice-payment",
            "occurred_at": "2026-03-20T12:00:00Z",
            "type": "expense",
            "amount": 40_00,
            "account_id": "acc-1",
            "payment_method": "OTHER",
            "category_id": "invoice_payment",
            "description": "Pagamento de fatura card-1:2026-04",
            "person_id": None,
            "status": "active",
        },
    ]
    assert projector.list_balance_states() == [
        {
            "account_id": "acc-1",
            "current_balance": 0,
        }
    ]


def test_projector_lists_invoice_items_for_a_single_invoice(tmp_path: Path) -> None:
    event_store = EventStore(
        database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    event_store.create_schema()
    append_event = AppendEventUseCase(event_store)
    append_event.execute(
        NewEvent(
            type="CardCreated",
            timestamp="2026-03-02T12:00:00Z",
            payload={
                "id": "card-1",
                "name": "Nubank",
                "limit": 150_000,
                "closing_day": 10,
                "due_day": 20,
                "payment_account_id": "acc-1",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardPurchaseCreated",
            timestamp="2026-03-15T12:00:00Z",
            payload={
                "id": "purchase-1",
                "purchase_date": "2026-03-15T12:00:00Z",
                "amount": 100_00,
                "category_id": "electronics",
                "card_id": "card-1",
                "description": "Headphones",
                "installments_count": 3,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardPurchaseCreated",
            timestamp="2026-03-10T12:00:00Z",
            payload={
                "id": "purchase-2",
                "purchase_date": "2026-03-10T12:00:00Z",
                "amount": 20_00,
                "category_id": "food",
                "card_id": "card-1",
                "description": "Lunch",
                "installments_count": 1,
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    applied = projector.run()

    assert applied == 3
    assert projector.list_invoice_items(invoice_id="card-1:2026-04") == [
        {
            "invoice_item_id": "purchase-1:1",
            "invoice_id": "card-1:2026-04",
            "purchase_id": "purchase-1",
            "card_id": "card-1",
            "purchase_date": "2026-03-15T12:00:00Z",
            "category_id": "electronics",
            "title": "Headphones",
            "description": "Headphones",
            "origin_type": "installment",
            "group_id": None,
            "installment_number": 1,
            "installments_count": 3,
            "amount": 33_33,
        }
    ]


def test_projector_classifies_single_card_purchase_as_variable_in_unified_history(
    tmp_path: Path,
) -> None:
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
            type="CardCreated",
            timestamp="2026-03-02T12:00:01Z",
            payload={
                "id": "card-1",
                "name": "Nubank",
                "limit": 150_000,
                "closing_day": 10,
                "due_day": 20,
                "payment_account_id": "acc-1",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardPurchaseCreated",
            timestamp="2026-03-15T12:00:00Z",
            payload={
                "id": "purchase-1",
                "purchase_date": "2026-03-15T12:00:00Z",
                "amount": 100_00,
                "category_id": "food",
                "card_id": "card-1",
                "description": "Sorvete",
                "installments_count": 1,
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    projector.run()

    variable_page = projector.list_unified_movements(
        competence_month="2026-03",
        scope="variable",
    )
    installments_page = projector.list_unified_movements(
        competence_month="2026-03",
        scope="installments",
    )
    summary = projector.get_movements_summary(competence_month="2026-03")

    assert variable_page["items"] == [
        {
            "movement_id": "purchase-1:1",
            "kind": "expense",
            "origin_type": "card_purchase",
            "title": "Sorvete",
            "description": "Sorvete",
            "amount": 100_00,
            "posted_at": "2026-03-15T12:00:00Z",
            "competence_month": "2026-03",
            "account_id": "acc-1",
            "card_id": "card-1",
            "payment_method": "CREDIT_CASH",
            "category_id": "food",
            "counterparty": None,
            "lifecycle_status": "pending",
            "edit_policy": "editable",
            "parent_id": "purchase-1",
            "group_id": None,
            "transfer_direction": None,
            "installment_number": None,
            "installment_total": None,
            "source_event_type": "CardPurchaseCreated",
            "needs_review": False,
        }
    ]
    assert installments_page["items"] == []
    assert summary["total_variable"] == 100_00
    assert summary["total_installments"] == 0
    assert summary["counts"]["variable"] == 1
    assert summary["counts"]["installments"] == 0


def test_projector_keeps_single_card_purchase_out_of_dashboard_installments(
    tmp_path: Path,
) -> None:
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
            type="CardCreated",
            timestamp="2026-03-02T12:00:01Z",
            payload={
                "id": "card-1",
                "name": "Nubank",
                "limit": 150_000,
                "closing_day": 10,
                "due_day": 20,
                "payment_account_id": "acc-1",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="ExpenseCreated",
            timestamp="2026-04-04T12:00:00Z",
            payload={
                "id": "tx-1",
                "occurred_at": "2026-04-04T12:00:00Z",
                "amount": 15_00,
                "account_id": "acc-1",
                "payment_method": "PIX",
                "category_id": "food",
                "description": "Almoco",
                "person_id": None,
                "type": "expense",
                "status": "active",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardPurchaseCreated",
            timestamp="2026-03-15T12:00:00Z",
            payload={
                "id": "purchase-1",
                "purchase_date": "2026-03-15T12:00:00Z",
                "amount": 100_00,
                "category_id": "food",
                "card_id": "card-1",
                "description": "Sorvete",
                "installments_count": 1,
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    projector.run()

    dashboard = projector.get_dashboard_summary(month="2026-04")

    assert dashboard["total_expense"] == 115_00
    assert dashboard["installment_total"] == 0
    assert dashboard["variable_expenses_total"] == 115_00
    assert dashboard["monthly_installments"] == []


def test_projector_repairs_stale_single_card_purchase_history_classification(
    tmp_path: Path,
) -> None:
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
            type="CardCreated",
            timestamp="2026-03-02T12:00:01Z",
            payload={
                "id": "card-1",
                "name": "Nubank",
                "limit": 150_000,
                "closing_day": 10,
                "due_day": 20,
                "payment_account_id": "acc-1",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardPurchaseCreated",
            timestamp="2026-03-15T12:00:00Z",
            payload={
                "id": "purchase-1",
                "purchase_date": "2026-03-15T12:00:00Z",
                "amount": 100_00,
                "category_id": "food",
                "card_id": "card-1",
                "description": "Sorvete",
                "installments_count": 1,
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    projector.run()

    with projector._session_factory.begin() as session:
        movement = session.get(
            projector_module.UnifiedMovementRecord,
            "purchase-1:1",
        )
        assert movement is not None
        movement.origin_type = "installment"
        movement.payment_method = "CREDIT_CASH"
        movement.posted_at = "2026-04-20T00:00:00Z"
        movement.competence_month = "2026-04"
        movement.installment_number = 1
        movement.installment_total = 1

    repaired_projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    variable_page = repaired_projector.list_unified_movements(
        competence_month="2026-03",
        scope="variable",
    )
    installments_page = repaired_projector.list_unified_movements(
        competence_month="2026-03",
        scope="installments",
    )

    assert [item["movement_id"] for item in variable_page["items"]] == ["purchase-1:1"]
    assert variable_page["items"][0]["posted_at"] == "2026-03-15T12:00:00Z"
    assert variable_page["items"][0]["competence_month"] == "2026-03"
    assert variable_page["items"][0]["edit_policy"] == "editable"
    assert installments_page["items"] == []


def test_projector_updates_voids_and_filters_transactions(tmp_path: Path) -> None:
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
            type="IncomeCreated",
            timestamp="2026-03-02T12:01:00Z",
            payload={
                "id": "tx-1",
                "occurred_at": "2026-03-02T12:01:00Z",
                "type": "income",
                "amount": 50_00,
                "account_id": "acc-1",
                "payment_method": "PIX",
                "category_id": "salary",
                "description": "Salary",
                "person_id": None,
                "status": "active",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="ExpenseCreated",
            timestamp="2026-03-02T12:02:00Z",
            payload={
                "id": "tx-2",
                "occurred_at": "2026-03-02T12:02:00Z",
                "type": "expense",
                "amount": 20_00,
                "account_id": "acc-1",
                "payment_method": "OTHER",
                "category_id": "groceries",
                "description": "Market run",
                "person_id": "mom",
                "status": "active",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="TransactionUpdated",
            timestamp="2026-03-02T12:03:00Z",
            payload={
                "id": "tx-2",
                "occurred_at": "2026-03-02T12:03:00Z",
                "type": "expense",
                "amount": 25_00,
                "account_id": "acc-1",
                "payment_method": "CASH",
                "category_id": "groceries",
                "description": "Market groceries",
                "person_id": "mom",
                "status": "active",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="TransactionVoided",
            timestamp="2026-03-02T12:04:00Z",
            payload={
                "id": "tx-1",
                "reason": "Duplicate",
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    applied = projector.run()

    assert applied == 5
    assert projector.list_transactions() == [
        {
            "transaction_id": "tx-2",
            "occurred_at": "2026-03-02T12:03:00Z",
            "type": "expense",
            "amount": 25_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "groceries",
            "description": "Market groceries",
            "person_id": "mom",
            "status": "active",
        },
        {
            "transaction_id": "tx-1",
            "occurred_at": "2026-03-02T12:01:00Z",
            "type": "income",
            "amount": 50_00,
            "account_id": "acc-1",
            "payment_method": "PIX",
            "category_id": "salary",
            "description": "Salary",
            "person_id": None,
            "status": "voided",
        },
    ]
    assert projector.list_transactions(
        category_id="groceries",
        account_id="acc-1",
        payment_method="CASH",
        person_id="mom",
        text="groc",
        occurred_from="2026-03-02T12:00:00Z",
        occurred_to="2026-03-02T12:05:00Z",
    ) == [
        {
            "transaction_id": "tx-2",
            "occurred_at": "2026-03-02T12:03:00Z",
            "type": "expense",
            "amount": 25_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "groceries",
            "description": "Market groceries",
            "person_id": "mom",
            "status": "active",
        }
    ]
    assert projector.list_balance_states() == [
        {
            "account_id": "acc-1",
            "current_balance": 75_00,
        }
    ]


def test_projector_rebuilds_issue_15_projection_when_transfer_columns_are_missing(
    tmp_path: Path,
) -> None:
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

    projection_url = f"sqlite:///{(tmp_path / 'app.db').as_posix()}"
    engine = get_engine(projection_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE accounts (
                    account_id VARCHAR PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    type VARCHAR NOT NULL,
                    initial_balance INTEGER NOT NULL,
                    is_active BOOLEAN NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE balance_state (
                    account_id VARCHAR PRIMARY KEY,
                    current_balance INTEGER NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE transactions (
                    transaction_id VARCHAR PRIMARY KEY,
                    occurred_at VARCHAR NOT NULL,
                    type VARCHAR NOT NULL,
                    amount INTEGER NOT NULL,
                    account_id VARCHAR NOT NULL,
                    payment_method VARCHAR NOT NULL,
                    category_id VARCHAR NOT NULL,
                    description VARCHAR NULL,
                    person_id VARCHAR NULL,
                    status VARCHAR NOT NULL
                )
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
        projection_database_url=projection_url,
    )

    applied = projector.run()

    assert applied == 1
    assert projector.list_transactions() == []


def test_projector_materializes_internal_transfers_and_moves_balances(
    tmp_path: Path,
) -> None:
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
            timestamp="2026-03-02T12:00:01Z",
            payload={
                "id": "acc-2",
                "name": "Broker",
                "type": "investment",
                "initial_balance": 300_00,
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="TransferCreated",
            timestamp="2026-03-02T12:02:00Z",
            payload={
                "id": "trf-1",
                "occurred_at": "2026-03-02T12:02:00Z",
                "from_account_id": "acc-1",
                "to_account_id": "acc-2",
                "amount": 25_00,
                "description": "Broker top-up",
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    applied = projector.run()

    assert applied == 3
    assert projector.list_transactions() == [
        {
            "transaction_id": "trf-1:debit",
            "occurred_at": "2026-03-02T12:02:00Z",
            "type": "transfer",
            "amount": 25_00,
            "account_id": "acc-1",
            "payment_method": "OTHER",
            "category_id": "transfer",
            "description": "Broker top-up",
            "person_id": None,
            "status": "active",
            "transfer_id": "trf-1",
            "direction": "debit",
        },
        {
            "transaction_id": "trf-1:credit",
            "occurred_at": "2026-03-02T12:02:00Z",
            "type": "transfer",
            "amount": 25_00,
            "account_id": "acc-2",
            "payment_method": "OTHER",
            "category_id": "transfer",
            "description": "Broker top-up",
            "person_id": None,
            "status": "active",
            "transfer_id": "trf-1",
            "direction": "credit",
        },
    ]
    assert projector.list_transactions(account_id="acc-1") == [
        {
            "transaction_id": "trf-1:debit",
            "occurred_at": "2026-03-02T12:02:00Z",
            "type": "transfer",
            "amount": 25_00,
            "account_id": "acc-1",
            "payment_method": "OTHER",
            "category_id": "transfer",
            "description": "Broker top-up",
            "person_id": None,
            "status": "active",
            "transfer_id": "trf-1",
            "direction": "debit",
        }
    ]
    assert projector.list_balance_states() == [
        {
            "account_id": "acc-1",
            "current_balance": 75_00,
        },
        {
            "account_id": "acc-2",
            "current_balance": 325_00,
        },
    ]


def test_projector_summarizes_dashboard_month_from_projections(tmp_path: Path) -> None:
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
            timestamp="2026-03-02T12:00:01Z",
            payload={
                "id": "acc-2",
                "name": "Savings",
                "type": "savings",
                "initial_balance": 50_00,
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="IncomeCreated",
            timestamp="2026-03-02T12:01:00Z",
            payload={
                "id": "tx-1",
                "occurred_at": "2026-03-02T12:01:00Z",
                "type": "income",
                "amount": 40_00,
                "account_id": "acc-1",
                "payment_method": "PIX",
                "category_id": "salary",
                "description": "Side job",
                "person_id": None,
                "status": "active",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="ExpenseCreated",
            timestamp="2026-03-02T12:02:00Z",
            payload={
                "id": "tx-2",
                "occurred_at": "2026-03-02T12:02:00Z",
                "type": "expense",
                "amount": 15_00,
                "account_id": "acc-1",
                "payment_method": "CASH",
                "category_id": "food",
                "description": "Lunch",
                "person_id": None,
                "status": "active",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="TransferCreated",
            timestamp="2026-03-02T12:03:00Z",
            payload={
                "id": "trf-1",
                "occurred_at": "2026-03-02T12:03:00Z",
                "from_account_id": "acc-1",
                "to_account_id": "acc-2",
                "amount": 10_00,
                "description": "Move to savings",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="ExpenseCreated",
            timestamp="2026-03-02T12:04:00Z",
            payload={
                "id": "tx-3",
                "occurred_at": "2026-02-28T23:00:00Z",
                "type": "expense",
                "amount": 99_00,
                "account_id": "acc-1",
                "payment_method": "OTHER",
                "category_id": "ignored",
                "description": "Previous month",
                "person_id": None,
                "status": "active",
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    applied = projector.run()

    assert applied == 6
    assert projector.get_dashboard_summary(month="2026-03") == {
        "month": "2026-03",
        "total_income": 40_00,
        "total_expense": 15_00,
        "net_flow": 25_00,
        "current_balance": 76_00,
        "fixed_expenses_total": 0,
        "installment_total": 0,
        "variable_expenses_total": 15_00,
        "invoices_due_total": 0,
        "free_to_spend": 25_00,
        "pending_reimbursements_total": 0,
        "pending_reimbursements": [],
        "monthly_commitments": [],
        "monthly_fixed_expenses": [],
        "monthly_installments": [],
        "recent_transactions": [
            {
                "transaction_id": "trf-1:debit",
                "occurred_at": "2026-03-02T12:03:00Z",
                "type": "transfer",
                "amount": 10_00,
                "account_id": "acc-1",
                "payment_method": "OTHER",
                "category_id": "transfer",
                "description": "Move to savings",
                "person_id": None,
                "status": "active",
                "transfer_id": "trf-1",
                "direction": "debit",
            },
            {
                "transaction_id": "trf-1:credit",
                "occurred_at": "2026-03-02T12:03:00Z",
                "type": "transfer",
                "amount": 10_00,
                "account_id": "acc-2",
                "payment_method": "OTHER",
                "category_id": "transfer",
                "description": "Move to savings",
                "person_id": None,
                "status": "active",
                "transfer_id": "trf-1",
                "direction": "credit",
            },
            {
                "transaction_id": "tx-2",
                "occurred_at": "2026-03-02T12:02:00Z",
                "type": "expense",
                "amount": 15_00,
                "account_id": "acc-1",
                "payment_method": "CASH",
                "category_id": "food",
                "description": "Lunch",
                "person_id": None,
                "status": "active",
            },
            {
                "transaction_id": "tx-1",
                "occurred_at": "2026-03-02T12:01:00Z",
                "type": "income",
                "amount": 40_00,
                "account_id": "acc-1",
                "payment_method": "PIX",
                "category_id": "salary",
                "description": "Side job",
                "person_id": None,
                "status": "active",
            },
        ],
        "spending_by_category": [
            {
                "category_id": "food",
                "total": 15_00,
            }
        ],
        "previous_month": {
            "total_income": 0,
            "total_expense": 99_00,
            "net_flow": -99_00,
        },
        "daily_balance_series": [
            {
                "date": "2026-03-02",
                "balance": 25_00,
            }
        ],
        "review_queue": [],
        "category_budgets": [],
        "budget_alerts": [],
    }


def test_projector_generates_monthly_pendings_and_confirms_them_from_events(
    tmp_path: Path,
) -> None:
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
            type="RecurringRuleCreated",
            timestamp="2026-03-02T12:01:00Z",
            payload={
                "id": "rule-rent",
                "name": "Rent",
                "amount": 25_00,
                "due_day": 5,
                "account_id": "acc-1",
                "payment_method": "PIX",
                "category_id": "rent",
                "description": "Apartment rent",
                "is_active": True,
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    applied_before_confirmation = projector.run()
    projector.materialize_month_pendings(month="2026-03")
    march_pendings = projector.list_pendings(month="2026-03")
    march_pendings_second_read = projector.list_pendings(month="2026-03")

    assert applied_before_confirmation == 2
    assert march_pendings == [
        {
            "pending_id": "rule-rent:2026-03",
            "rule_id": "rule-rent",
            "month": "2026-03",
            "name": "Rent",
            "amount": 25_00,
            "due_date": "2026-03-05",
            "account_id": "acc-1",
            "card_id": None,
            "payment_method": "PIX",
            "category_id": "rent",
            "description": "Apartment rent",
            "status": "pending",
            "transaction_id": None,
        }
    ]
    assert march_pendings_second_read == march_pendings

    append_event.execute(
        NewEvent(
            type="PendingConfirmed",
            timestamp="2026-03-02T12:02:00Z",
            payload={
                "pending_id": "rule-rent:2026-03",
                "transaction_id": "rule-rent:2026-03:expense",
                "confirmed_at": "2026-03-02T12:02:00Z",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="ExpenseCreated",
            timestamp="2026-03-02T12:02:00Z",
            payload={
                "id": "rule-rent:2026-03:expense",
                "occurred_at": "2026-03-05T00:00:00Z",
                "type": "expense",
                "amount": 25_00,
                "account_id": "acc-1",
                "payment_method": "PIX",
                "category_id": "rent",
                "description": "Apartment rent",
                "person_id": None,
                "status": "active",
            },
            version=1,
        )
    )

    applied_after_confirmation = projector.run()

    assert applied_after_confirmation == 2
    assert projector.list_pendings(month="2026-03") == [
        {
            "pending_id": "rule-rent:2026-03",
            "rule_id": "rule-rent",
            "month": "2026-03",
            "name": "Rent",
            "amount": 25_00,
            "due_date": "2026-03-05",
            "account_id": "acc-1",
            "card_id": None,
            "payment_method": "PIX",
            "category_id": "rent",
            "description": "Apartment rent",
            "status": "confirmed",
            "transaction_id": "rule-rent:2026-03:expense",
        }
    ]
    assert projector.list_transactions(account_id="acc-1") == [
        {
            "transaction_id": "rule-rent:2026-03:expense",
            "occurred_at": "2026-03-05T00:00:00Z",
            "type": "expense",
            "amount": 25_00,
            "account_id": "acc-1",
            "payment_method": "PIX",
            "category_id": "rent",
            "description": "Apartment rent",
            "person_id": None,
            "status": "active",
        }
    ]

    append_event.execute(
        NewEvent(
            type="TransactionVoided",
            timestamp="2026-03-06T10:00:00Z",
            payload={
                "id": "rule-rent:2026-03:expense",
                "reason": "Payment entered by mistake",
            },
            version=1,
        )
    )

    applied_after_void = projector.run()

    assert applied_after_void == 1
    assert projector.list_pendings(month="2026-03") == [
        {
            "pending_id": "rule-rent:2026-03",
            "rule_id": "rule-rent",
            "month": "2026-03",
            "name": "Rent",
            "amount": 25_00,
            "due_date": "2026-03-05",
            "account_id": "acc-1",
            "card_id": None,
            "payment_method": "PIX",
            "category_id": "rent",
            "description": "Apartment rent",
            "status": "pending",
            "transaction_id": None,
        }
    ]


def test_projector_list_pendings_does_not_materialize_implicitly(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
            type="RecurringRuleCreated",
            timestamp="2026-03-02T12:01:00Z",
            payload={
                "id": "rule-rent",
                "name": "Rent",
                "amount": 25_00,
                "due_day": 5,
                "account_id": "acc-1",
                "payment_method": "PIX",
                "category_id": "rent",
                "description": "Apartment rent",
                "is_active": True,
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    projector.run()

    def _should_not_be_called(*args: object, **kwargs: object) -> None:
        raise AssertionError("read path must not materialize pendings")

    monkeypatch.setattr(projector, "_ensure_month_pendings", _should_not_be_called)

    assert projector.list_pendings(month="2026-03") == []


def test_projector_get_pending_does_not_materialize_implicitly(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
            type="RecurringRuleCreated",
            timestamp="2026-03-02T12:01:00Z",
            payload={
                "id": "rule-rent",
                "name": "Rent",
                "amount": 25_00,
                "due_day": 5,
                "account_id": "acc-1",
                "payment_method": "PIX",
                "category_id": "rent",
                "description": "Apartment rent",
                "is_active": True,
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    projector.run()

    def _should_not_be_called(*args: object, **kwargs: object) -> None:
        raise AssertionError("read path must not materialize pendings")

    monkeypatch.setattr(projector, "_ensure_month_pendings", _should_not_be_called)

    assert projector.get_pending("rule-rent:2026-03") is None


def test_projector_keeps_confirmed_recurring_wallet_payment_as_single_fixed_movement(
    tmp_path: Path,
) -> None:
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
            type="RecurringRuleCreated",
            timestamp="2026-03-02T12:01:00Z",
            payload={
                "id": "rule-rent",
                "name": "Rent",
                "amount": 25_00,
                "due_day": 5,
                "account_id": "acc-1",
                "payment_method": "PIX",
                "category_id": "rent",
                "description": "Apartment rent",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="PendingConfirmed",
            timestamp="2026-03-02T12:02:00Z",
            payload={
                "pending_id": "rule-rent:2026-03",
                "transaction_id": "rule-rent:2026-03:expense",
                "confirmed_at": "2026-03-02T12:02:00Z",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="ExpenseCreated",
            timestamp="2026-03-02T12:02:00Z",
            payload={
                "id": "rule-rent:2026-03:expense",
                "occurred_at": "2026-03-05T00:00:00Z",
                "type": "expense",
                "amount": 25_00,
                "account_id": "acc-1",
                "payment_method": "PIX",
                "category_id": "rent",
                "description": "Apartment rent",
                "person_id": None,
                "status": "active",
            },
            version=1,
        )
    )

    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    projector.run()

    fixed_page = projector.list_unified_movements(
        competence_month="2026-03",
        scope="fixed",
    )
    all_page = projector.list_unified_movements(competence_month="2026-03")
    summary = projector.get_movements_summary(competence_month="2026-03")

    assert fixed_page["items"] == [
        {
            "movement_id": "rule-rent:2026-03:expense",
            "kind": "expense",
            "origin_type": "recurring",
            "title": "Rent",
            "description": "Apartment rent",
            "amount": 25_00,
            "posted_at": "2026-03-05T00:00:00Z",
            "competence_month": "2026-03",
            "account_id": "acc-1",
            "card_id": None,
            "payment_method": "PIX",
            "category_id": "rent",
            "counterparty": None,
            "lifecycle_status": "cleared",
            "edit_policy": "inherited",
            "parent_id": None,
            "group_id": "rule-rent",
            "transfer_direction": None,
            "installment_number": None,
            "installment_total": None,
            "source_event_type": "ExpenseCreated",
            "needs_review": False,
        }
    ]
    assert [item["movement_id"] for item in all_page["items"]] == [
        "rule-rent:2026-03:expense"
    ]
    assert summary["total_expenses"] == 25_00
    assert summary["total_fixed"] == 25_00
    assert summary["total_variable"] == 0
    assert summary["counts"]["all"] == 1
    assert summary["counts"]["fixed"] == 1
    assert summary["counts"]["variable"] == 0

    append_event.execute(
        NewEvent(
            type="TransactionVoided",
            timestamp="2026-03-06T10:00:00Z",
            payload={
                "id": "rule-rent:2026-03:expense",
                "reason": "Payment entered by mistake",
            },
            version=1,
        )
    )

    projector.run()

    fixed_page_after_void = projector.list_unified_movements(
        competence_month="2026-03",
        scope="fixed",
    )

    assert [item["movement_id"] for item in fixed_page_after_void["items"]] == [
        "rule-rent:2026-03"
    ]
    assert fixed_page_after_void["items"][0]["lifecycle_status"] == "forecast"


def test_projector_repairs_legacy_confirmed_recurring_wallet_projection_on_bootstrap(
    tmp_path: Path,
) -> None:
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
            type="RecurringRuleCreated",
            timestamp="2026-03-02T12:01:00Z",
            payload={
                "id": "rule-rent",
                "name": "Rent",
                "amount": 25_00,
                "due_day": 5,
                "account_id": "acc-1",
                "payment_method": "PIX",
                "category_id": "rent",
                "description": "Apartment rent",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="PendingConfirmed",
            timestamp="2026-03-02T12:02:00Z",
            payload={
                "pending_id": "rule-rent:2026-03",
                "transaction_id": "rule-rent:2026-03:expense",
                "confirmed_at": "2026-03-02T12:02:00Z",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="ExpenseCreated",
            timestamp="2026-03-02T12:02:00Z",
            payload={
                "id": "rule-rent:2026-03:expense",
                "occurred_at": "2026-03-05T00:00:00Z",
                "type": "expense",
                "amount": 25_00,
                "account_id": "acc-1",
                "payment_method": "PIX",
                "category_id": "rent",
                "description": "Apartment rent",
                "person_id": None,
                "status": "active",
            },
            version=1,
        )
    )

    legacy_projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    legacy_projector.run()

    with legacy_projector._session_factory.begin() as session:
        pending = session.get(projector_module.PendingProjectionRecord, "rule-rent:2026-03")
        assert pending is not None
        legacy_projector._upsert_pending_unified_movement(session, pending=pending)
        movement = session.get(
            projector_module.UnifiedMovementRecord,
            "rule-rent:2026-03:expense",
        )
        assert movement is not None
        movement.origin_type = "manual"
        movement.title = "Apartment rent"
        movement.group_id = None
        movement.edit_policy = "editable"

    repaired_projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    fixed_page = repaired_projector.list_unified_movements(
        competence_month="2026-03",
        scope="fixed",
    )

    assert [item["movement_id"] for item in fixed_page["items"]] == [
        "rule-rent:2026-03:expense"
    ]
    assert fixed_page["items"][0]["origin_type"] == "recurring"
    assert fixed_page["items"][0]["group_id"] == "rule-rent"
    assert fixed_page["items"][0]["edit_policy"] == "inherited"


def test_projector_repairs_legacy_confirmed_recurring_card_projection_on_bootstrap(
    tmp_path: Path,
) -> None:
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
            type="CardCreated",
            timestamp="2026-03-02T12:00:30Z",
            payload={
                "id": "card-1",
                "name": "Nubank",
                "limit": 150_000,
                "closing_day": 10,
                "due_day": 20,
                "payment_account_id": "acc-1",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="RecurringRuleCreated",
            timestamp="2026-03-02T12:01:00Z",
            payload={
                "id": "rule-streaming",
                "name": "Streaming",
                "amount": 30_00,
                "due_day": 9,
                "card_id": "card-1",
                "payment_method": "CARD",
                "category_id": "streaming",
                "description": "Monthly streaming",
                "is_active": True,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="PendingConfirmed",
            timestamp="2026-03-02T12:02:00Z",
            payload={
                "pending_id": "rule-streaming:2026-03",
                "transaction_id": "rule-streaming:2026-03:purchase",
                "confirmed_at": "2026-03-02T12:02:00Z",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="CardPurchaseCreated",
            timestamp="2026-03-02T12:02:00Z",
            payload={
                "id": "rule-streaming:2026-03:purchase",
                "purchase_date": "2026-03-09T00:00:00Z",
                "amount": 30_00,
                "category_id": "streaming",
                "card_id": "card-1",
                "description": "Monthly streaming",
            },
            version=1,
        )
    )

    legacy_projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    legacy_projector.run()

    with legacy_projector._session_factory.begin() as session:
        pending = session.get(
            projector_module.PendingProjectionRecord,
            "rule-streaming:2026-03",
        )
        assert pending is not None
        legacy_projector._upsert_pending_unified_movement(session, pending=pending)
        movement = session.get(
            projector_module.UnifiedMovementRecord,
            "rule-streaming:2026-03:purchase:1",
        )
        assert movement is not None
        movement.origin_type = "card_purchase"
        movement.title = "Monthly streaming"
        movement.group_id = None
        movement.edit_policy = "editable"

    repaired_projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    fixed_page = repaired_projector.list_unified_movements(
        competence_month="2026-03",
        scope="fixed",
    )

    assert [item["movement_id"] for item in fixed_page["items"]] == [
        "rule-streaming:2026-03:purchase:1"
    ]
    assert fixed_page["items"][0]["origin_type"] == "recurring"
    assert fixed_page["items"][0]["title"] == "Streaming"
    assert fixed_page["items"][0]["group_id"] == "rule-streaming"
    assert fixed_page["items"][0]["edit_policy"] == "inherited"


def test_projector_keeps_dashboard_totals_unbounded_when_preview_is_limited(
    tmp_path: Path,
) -> None:
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
                "initial_balance": 0,
                "is_active": True,
            },
            version=1,
        )
    )

    for index in range(12):
        append_event.execute(
            NewEvent(
                type="IncomeCreated",
                timestamp=f"2026-03-02T12:{index:02d}:00Z",
                payload={
                    "id": f"tx-{index}",
                    "occurred_at": f"2026-03-02T12:{index:02d}:00Z",
                    "type": "income",
                    "amount": 1_00,
                    "account_id": "acc-1",
                    "payment_method": "PIX",
                    "category_id": "salary",
                    "description": f"Income {index}",
                    "person_id": None,
                    "status": "active",
                },
                version=1,
            )
        )

    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    projector.run()
    summary = projector.get_dashboard_summary(month="2026-03")

    assert summary["total_income"] == 12_00
    assert summary["net_flow"] == 12_00
    assert len(summary["recent_transactions"]) == 10


def test_projector_materializes_investment_movements_and_monthly_overview(
    tmp_path: Path,
) -> None:
    event_store = EventStore(
        database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    event_store.create_schema()
    append_event = AppendEventUseCase(event_store)
    append_event.execute(
        NewEvent(
            type="AccountCreated",
            timestamp="2026-03-01T12:00:00Z",
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
            type="ExpenseCreated",
            timestamp="2026-03-05T12:00:00Z",
            payload={
                "id": "tx-1",
                "occurred_at": "2026-03-05T12:00:00Z",
                "type": "expense",
                "amount": 20_00,
                "account_id": "acc-1",
                "payment_method": "CASH",
                "category_id": "food",
                "description": "Groceries",
                "person_id": None,
                "status": "active",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="InvestmentMovementRecorded",
            timestamp="2026-03-10T12:00:00Z",
            payload={
                "id": "inv-1",
                "occurred_at": "2026-03-10T12:00:00Z",
                "type": "contribution",
                "account_id": "acc-1",
                "description": "Aporte mensal",
                "contribution_amount": 30_00,
                "dividend_amount": 5_00,
                "cash_amount": 30_00,
                "invested_amount": 35_00,
                "cash_delta": -30_00,
                "invested_delta": 35_00,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="InvestmentMovementRecorded",
            timestamp="2026-03-20T12:00:00Z",
            payload={
                "id": "inv-2",
                "occurred_at": "2026-03-20T12:00:00Z",
                "type": "withdrawal",
                "account_id": "acc-1",
                "description": "Resgate parcial",
                "contribution_amount": 0,
                "dividend_amount": 0,
                "cash_amount": 18_00,
                "invested_amount": 20_00,
                "cash_delta": 18_00,
                "invested_delta": -20_00,
            },
            version=1,
        )
    )
    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )

    applied = projector.run()
    movements = projector.list_investment_movements()
    overview = projector.get_investment_overview(
        view="monthly",
        occurred_from="2026-03-01T00:00:00Z",
        occurred_to="2026-03-31T23:59:59Z",
    )

    assert applied == 4
    assert movements == [
        {
            "movement_id": "inv-2",
            "occurred_at": "2026-03-20T12:00:00Z",
            "type": "withdrawal",
            "account_id": "acc-1",
            "description": "Resgate parcial",
            "contribution_amount": 0,
            "dividend_amount": 0,
            "cash_amount": 18_00,
            "invested_amount": 20_00,
            "cash_delta": 18_00,
            "invested_delta": -20_00,
        },
        {
            "movement_id": "inv-1",
            "occurred_at": "2026-03-10T12:00:00Z",
            "type": "contribution",
            "account_id": "acc-1",
            "description": "Aporte mensal",
            "contribution_amount": 30_00,
            "dividend_amount": 5_00,
            "cash_amount": 30_00,
            "invested_amount": 35_00,
            "cash_delta": -30_00,
            "invested_delta": 35_00,
        },
    ]
    assert projector.list_balance_states() == [
        {
            "account_id": "acc-1",
            "current_balance": 68_00,
        }
    ]
    assert overview == {
        "view": "monthly",
        "from": "2026-03-01T00:00:00Z",
        "to": "2026-03-31T23:59:59Z",
        "totals": {
            "contribution_total": 30_00,
            "dividend_total": 5_00,
            "withdrawal_total": 18_00,
            "invested_balance": 15_00,
            "cash_balance": 68_00,
            "wealth": 83_00,
            "dividends_accumulated": 5_00,
        },
        "goal": {
            "target": 0,
            "realized": 35_00,
            "remaining": 0,
            "progress_percent": 100,
        },
        "series": {
            "wealth_evolution": [
                {
                    "bucket": "2026-03",
                    "cash_balance": 68_00,
                    "invested_balance": 15_00,
                    "wealth": 83_00,
                }
            ],
            "contribution_dividend_trend": [
                {
                    "bucket": "2026-03",
                    "contribution_total": 30_00,
                    "dividend_total": 5_00,
                    "withdrawal_total": 18_00,
                }
            ],
        },
    }


def test_projector_investment_overview_uses_from_boundary_once_and_returns_range_end_totals(
    tmp_path: Path,
) -> None:
    event_store = EventStore(
        database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    event_store.create_schema()
    append_event = AppendEventUseCase(event_store)
    append_event.execute(
        NewEvent(
            type="AccountCreated",
            timestamp="2026-03-01T12:00:00Z",
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
            type="InvestmentMovementRecorded",
            timestamp="2026-03-10T00:00:00Z",
            payload={
                "id": "inv-1",
                "occurred_at": "2026-03-10T00:00:00Z",
                "type": "contribution",
                "account_id": "acc-1",
                "description": "Aporte na fronteira",
                "contribution_amount": 10_00,
                "dividend_amount": 0,
                "cash_amount": 10_00,
                "invested_amount": 10_00,
                "cash_delta": -10_00,
                "invested_delta": 10_00,
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="ExpenseCreated",
            timestamp="2026-03-20T12:00:00Z",
            payload={
                "id": "tx-1",
                "occurred_at": "2026-03-20T12:00:00Z",
                "type": "expense",
                "amount": 5_00,
                "account_id": "acc-1",
                "payment_method": "CASH",
                "category_id": "food",
                "description": "Outside requested range",
                "person_id": None,
                "status": "active",
            },
            version=1,
        )
    )
    append_event.execute(
        NewEvent(
            type="InvestmentMovementRecorded",
            timestamp="2026-03-25T12:00:00Z",
            payload={
                "id": "inv-2",
                "occurred_at": "2026-03-25T12:00:00Z",
                "type": "withdrawal",
                "account_id": "acc-1",
                "description": "Outside requested range",
                "contribution_amount": 0,
                "dividend_amount": 0,
                "cash_amount": 4_00,
                "invested_amount": 4_00,
                "cash_delta": 4_00,
                "invested_delta": -4_00,
            },
            version=1,
        )
    )

    projector = Projector(
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
        projection_database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
    )
    projector.run()

    overview = projector.get_investment_overview(
        view="monthly",
        occurred_from="2026-03-10T00:00:00Z",
        occurred_to="2026-03-15T23:59:59Z",
    )

    assert overview["totals"]["cash_balance"] == 90_00
    assert overview["totals"]["invested_balance"] == 10_00
    assert overview["totals"]["wealth"] == 100_00
    assert overview["series"]["wealth_evolution"] == [
        {
            "bucket": "2026-03",
            "cash_balance": 90_00,
            "invested_balance": 10_00,
            "wealth": 100_00,
        }
    ]
