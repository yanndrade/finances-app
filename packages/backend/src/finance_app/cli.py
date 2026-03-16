from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Sequence

import uvicorn

from finance_app.infrastructure.https import ensure_self_signed_certificate
from finance_app.interfaces.http.app import create_app

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
DATABASE_URL_ENV = "FINANCE_APP_DATABASE_URL"
EVENT_DATABASE_URL_ENV = "FINANCE_APP_EVENT_DATABASE_URL"
DATABASE_PATH_ENV = "FINANCE_APP_DATABASE_PATH"
EVENT_DATABASE_PATH_ENV = "FINANCE_APP_EVENT_DATABASE_PATH"
CERT_DIR_ENV = "FINANCE_APP_CERT_DIR"


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run the finance app backend.")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--https", action="store_true")
    parser.add_argument("--dev-http", action="store_true")
    parser.add_argument("--cert-dir", default=None)
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
    if hasattr(app, "state"):
        app.state.public_port = args.port
        app.state.public_scheme = "http"

    ssl_certfile: str | None = None
    ssl_keyfile: str | None = None
    if args.https and not args.dev_http:
        cert_dir = _resolve_cert_dir(args.cert_dir)
        cert_path, key_path = ensure_self_signed_certificate(cert_dir)
        ssl_certfile = str(cert_path)
        ssl_keyfile = str(key_path)
        if hasattr(app, "state"):
            app.state.public_scheme = "https"

    uvicorn_kwargs: dict[str, str | int] = {
        "host": args.host,
        "port": args.port,
    }
    if ssl_certfile and ssl_keyfile:
        uvicorn_kwargs["ssl_certfile"] = ssl_certfile
        uvicorn_kwargs["ssl_keyfile"] = ssl_keyfile

    uvicorn.run(app, **uvicorn_kwargs)


def _read_database_url(url_env: str, path_env: str) -> str | None:
    raw_url = os.getenv(url_env)
    if raw_url:
        return raw_url

    raw_path = os.getenv(path_env)
    if raw_path:
        normalized = raw_path.replace("\\", "/")
        return f"sqlite:///{normalized}"

    return None


def _resolve_cert_dir(explicit_cert_dir: str | None) -> Path:
    if explicit_cert_dir:
        return Path(explicit_cert_dir)

    env_cert_dir = os.getenv(CERT_DIR_ENV)
    if env_cert_dir:
        return Path(env_cert_dir)

    return Path("finances-data") / "certs"


if __name__ == "__main__":
    main()
