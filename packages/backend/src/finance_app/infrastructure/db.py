from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    """Base metadata for SQLAlchemy models and Alembic autogeneration."""


DATABASE_URL = os.getenv("FINANCE_APP_DATABASE_URL", "sqlite:///./app.db")


def get_engine():
    return create_engine(DATABASE_URL, future=True)


def get_session_factory() -> sessionmaker:
    return sessionmaker(bind=get_engine(), autoflush=False, autocommit=False)
