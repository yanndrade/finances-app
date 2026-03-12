from __future__ import annotations

import argparse
import os
from typing import Sequence

import uvicorn

from finance_app.interfaces.http.app import create_app

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
DATABASE_URL_ENV = "FINANCE_APP_DATABASE_URL"
EVENT_DATABASE_URL_ENV = "FINANCE_APP_EVENT_DATABASE_URL"
DATABASE_PATH_ENV = "FINANCE_APP_DATABASE_PATH"
EVENT_DATABASE_PATH_ENV = "FINANCE_APP_EVENT_DATABASE_PATH"


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run the finance app backend.")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args(argv)

    database_url = _read_database_url(DATABASE_URL_ENV, DATABASE_PATH_ENV)
    event_database_url = _read_database_url(
        EVENT_DATABASE_URL_ENV,
        EVENT_DATABASE_PATH_ENV,
    )

    app = create_app(
        database_url=database_url,
        event_database_url=event_database_url,
    )

    uvicorn.run(app, host=args.host, port=args.port)


def _read_database_url(url_env: str, path_env: str) -> str | None:
    raw_url = os.getenv(url_env)
    if raw_url:
        return raw_url

    raw_path = os.getenv(path_env)
    if raw_path:
        normalized = raw_path.replace("\\", "/")
        return f"sqlite:///{normalized}"

    return None
