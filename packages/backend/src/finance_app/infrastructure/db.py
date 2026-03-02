from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    """Base metadata for SQLAlchemy models and Alembic autogeneration."""


PROJECT_ROOT = Path(__file__).resolve().parents[3]


def get_default_database_url() -> str:
    database_path = (PROJECT_ROOT / "app.db").as_posix()
    return f"sqlite:///{database_path}"


def get_database_url() -> str:
    return os.getenv("FINANCE_APP_DATABASE_URL", get_default_database_url())


def escape_alembic_config_value(value: str) -> str:
    return value.replace("%", "%%")


def get_engine():
    return create_engine(get_database_url(), future=True)


def get_session_factory() -> sessionmaker:
    return sessionmaker(bind=get_engine(), autoflush=False, autocommit=False)
