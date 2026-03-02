from __future__ import annotations

from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import Session
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import sessionmaker

from finance_app.domain.events import StoredEvent
from finance_app.domain.projections import AccountProjection
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

    def list_accounts(self) -> list[dict[str, str | int]]:
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
            ).to_dict()
            for row in rows
        ]

    def _apply_event(self, session: Session, event: StoredEvent) -> None:
        if event.type != "AccountCreated":
            return

        payload = event.payload
        existing = session.get(AccountProjectionRecord, payload["id"])

        if existing is None:
            session.add(
                AccountProjectionRecord(
                    account_id=str(payload["id"]),
                    name=str(payload["name"]),
                    type=str(payload["type"]),
                    initial_balance=int(payload["initial_balance"]),
                )
            )
