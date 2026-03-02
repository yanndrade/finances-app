from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy import event as sqlalchemy_event
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    """Base metadata for SQLAlchemy models and Alembic autogeneration."""


PROJECT_ROOT = Path(__file__).resolve().parents[3]


def get_default_database_url() -> str:
    return _build_sqlite_url(PROJECT_ROOT / "app.db")


def get_default_events_database_url() -> str:
    return _build_sqlite_url(PROJECT_ROOT / "events.db")


def get_database_url() -> str:
    return os.getenv("FINANCE_APP_DATABASE_URL", get_default_database_url())


def get_events_database_url() -> str:
    return os.getenv("FINANCE_APP_EVENTS_DATABASE_URL", get_default_events_database_url())


def escape_alembic_config_value(value: str) -> str:
    return value.replace("%", "%%")


def get_engine():
    return create_engine(get_database_url(), future=True)


def get_events_engine(database_url: str | None = None):
    engine = create_engine(database_url or get_events_database_url(), future=True)

    if engine.dialect.name == "sqlite":
        @sqlalchemy_event.listens_for(engine, "connect")
        def _configure_sqlite(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.close()

    return engine


def get_session_factory() -> sessionmaker:
    return sessionmaker(bind=get_engine(), autoflush=False, autocommit=False)


def _build_sqlite_url(path: Path) -> str:
    return f"sqlite:///{path.as_posix()}"
