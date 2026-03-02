from __future__ import annotations

from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Boolean
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import Session
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import sessionmaker

from finance_app.domain.events import StoredEvent
from finance_app.domain.projections import AccountProjection, BalanceStateProjection
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

    def _apply_event(self, session: Session, event: StoredEvent) -> None:
        if event.type == "AccountCreated":
            self._apply_account_created(session, event.payload)
            return

        if event.type == "AccountUpdated":
            self._apply_account_updated(session, event.payload)

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
