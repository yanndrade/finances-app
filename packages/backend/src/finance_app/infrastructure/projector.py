from __future__ import annotations

from sqlalchemy import Boolean
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import inspect
from sqlalchemy import or_
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import Session
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import sessionmaker

from finance_app.domain.events import StoredEvent
from finance_app.domain.projections import (
    AccountProjection,
    BalanceStateProjection,
    TransactionProjection,
)
from finance_app.infrastructure.db import get_engine
from finance_app.infrastructure.event_store import EventStore


class ProjectionBase(DeclarativeBase):
    """Metadata for app.db materialized projections."""


class EventCursorRecord(ProjectionBase):
    __tablename__ = "event_cursor"

    singleton_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    last_applied_event_id: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class AccountProjectionRecord(ProjectionBase):
    __tablename__ = "accounts"

    account_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    initial_balance: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class BalanceStateRecord(ProjectionBase):
    __tablename__ = "balance_state"

    account_id: Mapped[str] = mapped_column(String, primary_key=True)
    current_balance: Mapped[int] = mapped_column(Integer, nullable=False)


class TransactionProjectionRecord(ProjectionBase):
    __tablename__ = "transactions"

    transaction_id: Mapped[str] = mapped_column(String, primary_key=True)
    occurred_at: Mapped[str] = mapped_column(String, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    account_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    payment_method: Mapped[str] = mapped_column(String, nullable=False, index=True)
    category_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    person_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    transfer_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    direction: Mapped[str | None] = mapped_column(String, nullable=True)


class Projector:
    def __init__(
        self,
        event_database_url: str | None = None,
        projection_database_url: str | None = None,
    ) -> None:
        self._event_store = EventStore(database_url=event_database_url)
        self._engine = get_engine(projection_database_url)
        self._session_factory = sessionmaker(
            bind=self._engine,
            autoflush=False,
            autocommit=False,
        )

    def bootstrap(self) -> None:
        if self._projection_schema_requires_rebuild():
            ProjectionBase.metadata.drop_all(self._engine)

        ProjectionBase.metadata.create_all(self._engine)
        with self._session_factory.begin() as session:
            cursor = session.get(EventCursorRecord, 1)
            if cursor is None:
                session.add(EventCursorRecord(singleton_id=1, last_applied_event_id=0))

    def run(self) -> int:
        self.bootstrap()
        last_applied_event_id = self.get_last_applied_event_id()
        events = self._event_store.list_events_after(last_applied_event_id)

        if not events:
            return 0

        with self._session_factory.begin() as session:
            cursor = session.get(EventCursorRecord, 1)
            assert cursor is not None

            for event in events:
                self._apply_event(session, event)
                session.flush()
                cursor.last_applied_event_id = event.event_id

        return len(events)

    def rebuild(self) -> int:
        ProjectionBase.metadata.drop_all(self._engine)
        self.bootstrap()
        return self.run()

    def get_last_applied_event_id(self) -> int:
        self.bootstrap()
        with self._session_factory() as session:
            cursor = session.get(EventCursorRecord, 1)
            assert cursor is not None
            return cursor.last_applied_event_id

    def list_accounts(self) -> list[dict[str, str | int | bool]]:
        self.bootstrap()
        with self._session_factory() as session:
            rows = (
                session.query(AccountProjectionRecord)
                .order_by(AccountProjectionRecord.account_id.asc())
                .all()
            )

        return [
            AccountProjection(
                account_id=row.account_id,
                name=row.name,
                type=row.type,
                initial_balance=row.initial_balance,
                is_active=row.is_active,
            ).to_dict()
            for row in rows
        ]

    def list_balance_states(self) -> list[dict[str, str | int]]:
        self.bootstrap()
        with self._session_factory() as session:
            rows = (
                session.query(BalanceStateRecord)
                .order_by(BalanceStateRecord.account_id.asc())
                .all()
            )

        return [
            BalanceStateProjection(
                account_id=row.account_id,
                current_balance=row.current_balance,
            ).to_dict()
            for row in rows
        ]

    def list_transactions(
        self,
        *,
        occurred_from: str | None = None,
        occurred_to: str | None = None,
        category_id: str | None = None,
        account_id: str | None = None,
        payment_method: str | None = None,
        person_id: str | None = None,
        text: str | None = None,
    ) -> list[dict[str, str | int | None]]:
        self.bootstrap()
        with self._session_factory() as session:
            query = session.query(TransactionProjectionRecord)

            if occurred_from is not None:
                query = query.filter(TransactionProjectionRecord.occurred_at >= occurred_from)
            if occurred_to is not None:
                query = query.filter(TransactionProjectionRecord.occurred_at <= occurred_to)
            if category_id is not None:
                query = query.filter(TransactionProjectionRecord.category_id == category_id)
            if account_id is not None:
                query = query.filter(TransactionProjectionRecord.account_id == account_id)
            if payment_method is not None:
                query = query.filter(
                    TransactionProjectionRecord.payment_method == payment_method
                )
            if person_id is not None:
                query = query.filter(TransactionProjectionRecord.person_id == person_id)
            if text is not None:
                search = f"%{text}%"
                query = query.filter(
                    or_(
                        TransactionProjectionRecord.description.ilike(search),
                        TransactionProjectionRecord.category_id.ilike(search),
                    )
                )

            rows = (
                query.order_by(
                    TransactionProjectionRecord.occurred_at.desc(),
                    TransactionProjectionRecord.transaction_id.desc(),
                )
                .all()
            )

        return [
            TransactionProjection(
                transaction_id=row.transaction_id,
                occurred_at=row.occurred_at,
                type=row.type,
                amount=row.amount,
                account_id=row.account_id,
                payment_method=row.payment_method,
                category_id=row.category_id,
                description=row.description,
                person_id=row.person_id,
                status=row.status,
                transfer_id=row.transfer_id,
                direction=row.direction,
            ).to_dict()
            for row in rows
        ]

    def _apply_event(self, session: Session, event: StoredEvent) -> None:
        if event.type == "AccountCreated":
            self._apply_account_created(session, event.payload)
            return

        if event.type == "AccountUpdated":
            self._apply_account_updated(session, event.payload)
            return

        if event.type in {"IncomeCreated", "ExpenseCreated"}:
            self._apply_transaction_created(session, event.payload)
            return

        if event.type == "TransactionUpdated":
            self._apply_transaction_updated(session, event.payload)
            return

        if event.type == "TransactionVoided":
            self._apply_transaction_voided(session, event.payload)
            return

        if event.type == "TransferCreated":
            self._apply_transfer_created(session, event.payload)

    def _apply_account_created(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        account_id = str(payload["id"])
        existing = session.get(AccountProjectionRecord, account_id)

        if existing is None:
            session.add(
                AccountProjectionRecord(
                    account_id=account_id,
                    name=str(payload["name"]),
                    type=str(payload["type"]),
                    initial_balance=int(payload["initial_balance"]),
                    is_active=bool(payload.get("is_active", True)),
                )
            )

        balance = session.get(BalanceStateRecord, account_id)
        if balance is None:
            session.add(
                BalanceStateRecord(
                    account_id=account_id,
                    current_balance=int(payload["initial_balance"]),
                )
            )

    def _apply_account_updated(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        account_id = str(payload["id"])
        existing = session.get(AccountProjectionRecord, account_id)

        if existing is None:
            return

        existing.name = str(payload["name"])
        existing.type = str(payload["type"])
        existing.initial_balance = int(payload["initial_balance"])
        existing.is_active = bool(payload.get("is_active", True))

        balance = session.get(BalanceStateRecord, account_id)
        if balance is None:
            session.add(
                BalanceStateRecord(
                    account_id=account_id,
                    current_balance=int(payload["initial_balance"]),
                )
            )
            return

        balance.current_balance = int(payload["initial_balance"])

    def _apply_transaction_created(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        transaction_id = str(payload["id"])
        existing = session.get(TransactionProjectionRecord, transaction_id)

        if existing is not None:
            return

        session.add(
            TransactionProjectionRecord(
                transaction_id=transaction_id,
                occurred_at=str(payload["occurred_at"]),
                type=str(payload["type"]),
                amount=int(payload["amount"]),
                account_id=str(payload["account_id"]),
                payment_method=str(payload["payment_method"]),
                category_id=str(payload["category_id"]),
                description=_optional_string(payload.get("description")),
                person_id=_optional_string(payload.get("person_id")),
                status=str(payload.get("status", "active")),
                transfer_id=_optional_string(payload.get("transfer_id")),
                direction=_optional_string(payload.get("direction")),
            )
        )
        self._apply_balance_delta(
            session,
            account_id=str(payload["account_id"]),
            delta=self._signed_amount(
                transaction_type=str(payload["type"]),
                amount=int(payload["amount"]),
                status=str(payload.get("status", "active")),
            ),
        )

    def _apply_transaction_updated(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        transaction_id = str(payload["id"])
        existing = session.get(TransactionProjectionRecord, transaction_id)

        if existing is None:
            return

        previous_account_id = existing.account_id
        previous_delta = self._transaction_balance_impact(existing)

        new_account_id = str(payload["account_id"])
        new_type = str(payload["type"])
        new_amount = int(payload["amount"])
        new_status = str(payload.get("status", existing.status))
        new_delta = self._signed_amount(
            transaction_type=new_type,
            amount=new_amount,
            status=new_status,
            direction=_optional_string(payload.get("direction")),
        )

        if previous_account_id == new_account_id:
            self._apply_balance_delta(
                session,
                account_id=new_account_id,
                delta=new_delta - previous_delta,
            )
        else:
            self._apply_balance_delta(
                session,
                account_id=previous_account_id,
                delta=-previous_delta,
            )
            self._apply_balance_delta(
                session,
                account_id=new_account_id,
                delta=new_delta,
            )

        existing.occurred_at = str(payload["occurred_at"])
        existing.type = new_type
        existing.amount = new_amount
        existing.account_id = new_account_id
        existing.payment_method = str(payload["payment_method"])
        existing.category_id = str(payload["category_id"])
        existing.description = _optional_string(payload.get("description"))
        existing.person_id = _optional_string(payload.get("person_id"))
        existing.status = new_status
        existing.transfer_id = _optional_string(payload.get("transfer_id"))
        existing.direction = _optional_string(payload.get("direction"))

    def _apply_transaction_voided(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        transaction_id = str(payload["id"])
        existing = session.get(TransactionProjectionRecord, transaction_id)

        if existing is None or existing.status == "voided":
            return

        self._apply_balance_delta(
            session,
            account_id=existing.account_id,
            delta=-self._transaction_balance_impact(existing),
        )
        existing.status = "voided"

    def _apply_transfer_created(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        transfer_id = str(payload["id"])
        occurred_at = str(payload["occurred_at"])
        amount = int(payload["amount"])
        description = _optional_string(payload.get("description"))

        debit_id = f"{transfer_id}:debit"
        if session.get(TransactionProjectionRecord, debit_id) is None:
            session.add(
                TransactionProjectionRecord(
                    transaction_id=debit_id,
                    occurred_at=occurred_at,
                    type="transfer",
                    amount=amount,
                    account_id=str(payload["from_account_id"]),
                    payment_method="OTHER",
                    category_id="transfer",
                    description=description,
                    person_id=None,
                    status="active",
                    transfer_id=transfer_id,
                    direction="debit",
                )
            )
            self._apply_balance_delta(
                session,
                account_id=str(payload["from_account_id"]),
                delta=-amount,
            )

        credit_id = f"{transfer_id}:credit"
        if session.get(TransactionProjectionRecord, credit_id) is None:
            session.add(
                TransactionProjectionRecord(
                    transaction_id=credit_id,
                    occurred_at=occurred_at,
                    type="transfer",
                    amount=amount,
                    account_id=str(payload["to_account_id"]),
                    payment_method="OTHER",
                    category_id="transfer",
                    description=description,
                    person_id=None,
                    status="active",
                    transfer_id=transfer_id,
                    direction="credit",
                )
            )
            self._apply_balance_delta(
                session,
                account_id=str(payload["to_account_id"]),
                delta=amount,
            )

    def _projection_schema_requires_rebuild(self) -> bool:
        inspector = inspect(self._engine)
        table_names = set(inspector.get_table_names())

        if "accounts" not in table_names:
            return False

        account_columns = {
            column["name"] for column in inspector.get_columns("accounts")
        }
        if "is_active" not in account_columns:
            return True

        if "balance_state" not in table_names:
            return True

        if "transactions" not in table_names:
            return True

        transaction_columns = {
            column["name"] for column in inspector.get_columns("transactions")
        }
        expected_transaction_columns = {
            "transaction_id",
            "occurred_at",
            "type",
            "amount",
            "account_id",
            "payment_method",
            "category_id",
            "description",
            "person_id",
            "status",
            "transfer_id",
            "direction",
        }
        if transaction_columns != expected_transaction_columns:
            return True

        return False

    def _apply_balance_delta(
        self,
        session: Session,
        *,
        account_id: str,
        delta: int,
    ) -> None:
        if delta == 0:
            return

        balance = session.get(BalanceStateRecord, account_id)
        if balance is None:
            session.add(
                BalanceStateRecord(
                    account_id=account_id,
                    current_balance=delta,
                )
            )
            return

        balance.current_balance += delta

    def _signed_amount(
        self,
        *,
        transaction_type: str,
        amount: int,
        status: str,
        direction: str | None = None,
    ) -> int:
        if status != "active":
            return 0

        if transaction_type == "transfer":
            return amount if direction == "credit" else -amount

        return amount if transaction_type == "income" else -amount

    def _transaction_balance_impact(self, row: TransactionProjectionRecord) -> int:
        return self._signed_amount(
            transaction_type=row.type,
            amount=row.amount,
            status=row.status,
            direction=row.direction,
        )


def _optional_string(value: object | None) -> str | None:
    if value is None:
        return None

    return str(value)
