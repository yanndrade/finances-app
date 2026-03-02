from __future__ import annotations

import json

from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import text
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import sessionmaker

from finance_app.domain.events import NewEvent, StoredEvent
from finance_app.infrastructure.db import Base, get_events_engine


class EventStoreError(Exception):
    pass


class EventRecord(Base):
    __tablename__ = "events"
    __table_args__ = {"sqlite_autoincrement": True}

    event_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    timestamp: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)


class EventStore:
    def __init__(self, database_url: str | None = None) -> None:
        self._engine = get_events_engine(database_url)
        self._session_factory = sessionmaker(
            bind=self._engine,
            autoflush=False,
            autocommit=False,
        )

    def create_schema(self) -> None:
        Base.metadata.create_all(self._engine, tables=[EventRecord.__table__])
        with self._engine.begin() as connection:
            connection.execute(
                text(
                    """
                    CREATE TRIGGER IF NOT EXISTS events_no_update
                    BEFORE UPDATE ON events
                    BEGIN
                        SELECT RAISE(ABORT, 'events table is append-only');
                    END;
                    """
                )
            )
            connection.execute(
                text(
                    """
                    CREATE TRIGGER IF NOT EXISTS events_no_delete
                    BEFORE DELETE ON events
                    BEGIN
                        SELECT RAISE(ABORT, 'events table is append-only');
                    END;
                    """
                )
            )

    def append(self, event: NewEvent) -> int:
        try:
            payload = json.dumps(event.payload, sort_keys=True, separators=(",", ":"))
        except (TypeError, ValueError) as exc:
            raise EventStoreError("Event payload must be JSON serializable.") from exc

        with self._session_factory.begin() as session:
            record = EventRecord(
                type=event.type,
                timestamp=event.timestamp,
                payload=payload,
                version=event.version,
            )
            session.add(record)
            session.flush()
            return record.event_id

    def list_events(self) -> list[StoredEvent]:
        with self._session_factory() as session:
            records = session.query(EventRecord).order_by(EventRecord.event_id.asc()).all()

        return [
            StoredEvent(
                event_id=record.event_id,
                type=record.type,
                timestamp=record.timestamp,
                payload=json.loads(record.payload),
                version=record.version,
            )
            for record in records
        ]

    def get_journal_mode(self) -> str:
        with self._engine.connect() as connection:
            return str(connection.execute(text("PRAGMA journal_mode;")).scalar_one())
