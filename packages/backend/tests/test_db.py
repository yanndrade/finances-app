from pathlib import Path

from finance_app.infrastructure.db import (
    escape_alembic_config_value,
    get_database_url,
    get_default_database_url,
)


def test_default_database_url_is_anchored_to_backend_project() -> None:
    project_root = Path(__file__).resolve().parents[1]
    expected = f"sqlite:///{(project_root / 'app.db').as_posix()}"

    assert get_default_database_url() == expected


def test_database_url_prefers_environment_override(monkeypatch) -> None:
    overridden = "postgresql://user:p%40ss@example.com/finance"
    monkeypatch.setenv("FINANCE_APP_DATABASE_URL", overridden)

    assert get_database_url() == overridden


def test_alembic_config_values_escape_percent_signs() -> None:
    value = "postgresql://user:p%40ss@example.com/finance?sslmode=require%2Fstrict"

    assert (
        escape_alembic_config_value(value)
        == "postgresql://user:p%%40ss@example.com/finance?sslmode=require%%2Fstrict"
    )
