import threading
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.exc import NoSuchTableError

from finance_app.application.event_store import AppendEventUseCase
from finance_app.application.projector import ProjectEventsUseCase, RebuildProjectionsUseCase
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


def test_projector_materializes_cash_transactions_and_updates_balance(tmp_path: Path) -> None:
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

    monkeypatch.setattr(projector_module.ProjectionBase.metadata, "create_all", wrapped_create_all)

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


def test_projector_materializes_card_purchases_into_invoice_cycles(tmp_path: Path) -> None:
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


def test_projector_distributes_installments_into_future_invoice_cycles(tmp_path: Path) -> None:
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
    }


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
