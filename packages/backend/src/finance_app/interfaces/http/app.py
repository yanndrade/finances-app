import ipaddress
import json
import logging
import os
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter
from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.responses import JSONResponse

from finance_app.interfaces.http.bootstrap import AppServices, build_services
from finance_app.interfaces.http.routes.accounts import build_accounts_router
from finance_app.interfaces.http.routes.backups import build_backups_router
from finance_app.interfaces.http.routes.budgets import build_budgets_router
from finance_app.interfaces.http.routes.cards import build_cards_router
from finance_app.interfaces.http.routes.dev import build_dev_router
from finance_app.interfaces.http.routes.health import build_health_router
from finance_app.interfaces.http.routes.investments import build_investments_router
from finance_app.interfaces.http.routes.movements import build_movements_router
from finance_app.interfaces.http.routes.recurring import build_recurring_router
from finance_app.interfaces.http.routes.reports import build_reports_router
from finance_app.interfaces.http.routes.security import build_security_router
from finance_app.interfaces.http.routes.transactions import build_transactions_router

LAN_PUBLIC_PATHS = {"/health", "/openapi.json", "/docs", "/redoc"}
LAN_PUBLIC_PREFIXES = ("/docs", "/redoc")
LAN_LOCAL_ONLY_PREFIXES = ("/api/security/lan", "/api/security/devices")
LAN_PAIR_ENDPOINT = "/api/security/pair"
LAN_SECURITY_TRACE_ENV = "FINANCE_APP_SECURITY_TRACE"

logger = logging.getLogger("finance_app.security.lan")


def build_router(services: AppServices) -> APIRouter:
    router = APIRouter()
    router.include_router(build_health_router())
    router.include_router(
        build_backups_router(
            account_service=services.account_service,
            card_service=services.card_service,
            card_purchase_service=services.card_purchase_service,
            investment_service=services.investment_service,
            transaction_service=services.transaction_service,
        )
    )
    router.include_router(build_accounts_router(services.account_service))
    router.include_router(
        build_cards_router(
            card_service=services.card_service,
            card_purchase_service=services.card_purchase_service,
            invoice_payment_service=services.invoice_payment_service,
        )
    )
    router.include_router(
        build_transactions_router(
            transaction_service=services.transaction_service,
            transfer_service=services.transfer_service,
            reimbursement_service=services.reimbursement_service,
        )
    )
    router.include_router(build_reports_router(services.transaction_service))
    router.include_router(build_recurring_router(services.recurring_service))
    router.include_router(build_budgets_router(services.budget_service))
    router.include_router(build_investments_router(services.investment_service))
    router.include_router(build_security_router(services.security_store))
    router.include_router(
        build_movements_router(movement_service=services.movement_service)
    )
    router.include_router(
        build_dev_router(
            reset_events=services.event_store.reset,
            reset_projections=services.projector.reset,
        )
    )
    return router


def create_app(
    *,
    database_url: str | None = None,
    event_database_url: str | None = None,
) -> FastAPI:
    services = build_services(
        database_url=database_url,
        event_database_url=event_database_url,
    )
    app = FastAPI(title="finance-app backend")
    app.state.public_scheme = "http"
    app.state.public_port = 8000
    app.state.security_trace_enabled = _read_bool_env(LAN_SECURITY_TRACE_ENV)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "tauri://localhost",
            "http://tauri.localhost",
            "https://tauri.localhost",
        ],
        allow_origin_regex=(
            r"https?://("
            r"localhost|127\.0\.0\.1|"
            r"10(?:\.\d{1,3}){3}|"
            r"192\.168(?:\.\d{1,3}){2}|"
            r"172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}"
            r")(:\d+)?$"
        ),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def enforce_lan_security(request: Request, call_next):
        path = request.url.path
        request_ip = _resolve_request_ip(request)

        if _is_public_path(path):
            if request_ip is None or _is_local_client(request_ip):
                return await call_next(request)
            _log_lan_security_event(
                request,
                reason="public_path_localhost_only",
                detail="This endpoint is only available on localhost.",
                request_ip=request_ip,
                warning=True,
            )
            return _forbidden("This endpoint is only available on localhost.")

        if request_ip is None or _is_local_client(request_ip):
            return await call_next(request)

        lan_state = services.security_store.read_lan_security_state()
        if not lan_state.enabled:
            _log_lan_security_event(
                request,
                reason="lan_mode_disabled",
                detail="LAN mode is disabled.",
                request_ip=request_ip,
                warning=True,
            )
            return _forbidden("LAN mode is disabled.")

        network = services.security_store.resolve_lan_network()
        if network is None:
            _log_lan_security_event(
                request,
                reason="lan_network_not_detected",
                detail="No private LAN network detected.",
                request_ip=request_ip,
                warning=True,
            )
            return JSONResponse(
                status_code=503,
                content={"detail": "No private LAN network detected."},
            )

        if not _is_private_ip(request_ip):
            _log_lan_security_event(
                request,
                reason="remote_ip_not_private",
                detail="Only private network addresses are allowed.",
                request_ip=request_ip,
                warning=True,
                extra={"subnet_cidr": network.subnet_cidr},
            )
            return _forbidden("Only private network addresses are allowed.")
        if not _is_ip_in_subnet(request_ip, network.subnet_cidr):
            _log_lan_security_event(
                request,
                reason="remote_ip_outside_subnet",
                detail="Request origin is outside the authorized subnet.",
                request_ip=request_ip,
                warning=True,
                extra={"subnet_cidr": network.subnet_cidr},
            )
            return _forbidden("Request origin is outside the authorized subnet.")

        if path.startswith(LAN_LOCAL_ONLY_PREFIXES):
            _log_lan_security_event(
                request,
                reason="lan_configuration_desktop_only",
                detail="LAN configuration endpoints are desktop-only.",
                request_ip=request_ip,
                warning=True,
            )
            return _forbidden("LAN configuration endpoints are desktop-only.")

        if not path.startswith("/api/"):
            return await call_next(request)

        if request.method.upper() == "OPTIONS":
            return await call_next(request)

        if path == LAN_PAIR_ENDPOINT and request.method.upper() in {"GET", "POST"}:
            return await call_next(request)

        origin, origin_source = _read_request_origin_context(request)
        effective_public_host = _read_effective_public_host(request)
        allow_http_origin = (
            getattr(request.app.state, "public_scheme", "http") != "https"
        )
        origin_allowed, origin_reason = _evaluate_origin(
            origin=origin,
            expected_host=effective_public_host,
            allow_http=allow_http_origin,
        )
        if not origin_allowed:
            origin_diagnostics = _extract_origin_diagnostics(origin)
            _log_lan_security_event(
                request,
                reason="invalid_request_origin",
                detail="Invalid request origin.",
                request_ip=request_ip,
                warning=True,
                extra={
                    "origin_reason": origin_reason,
                    "origin_source": origin_source,
                    **origin_diagnostics,
                    "expected_host": effective_public_host,
                    "allow_http_origin": allow_http_origin,
                    "public_scheme": str(getattr(request.app.state, "public_scheme", "http")),
                    "public_port": int(getattr(request.app.state, "public_port", 8000)),
                    "subnet_cidr": network.subnet_cidr,
                },
            )
            return _forbidden("Invalid request origin.")

        device_token = request.headers.get("X-Finance-Token")
        if not device_token:
            _log_lan_security_event(
                request,
                reason="missing_device_token",
                detail="Missing X-Finance-Token header.",
                request_ip=request_ip,
                warning=True,
            )
            return _forbidden("Missing X-Finance-Token header.")

        if not services.security_store.verify_device_token(
            device_token,
            request_ip=request_ip,
        ):
            _log_lan_security_event(
                request,
                reason="invalid_or_revoked_device_token",
                detail="Invalid or revoked device token.",
                request_ip=request_ip,
                warning=True,
            )
            return _forbidden("Invalid or revoked device token.")

        _log_lan_security_event(
            request,
            reason="lan_request_allowed",
            detail="LAN request allowed.",
            request_ip=request_ip,
            warning=False,
            extra={
                "expected_host": effective_public_host,
                "origin_reason": origin_reason,
                "origin_source": origin_source,
            },
        )
        return await call_next(request)

    app.include_router(build_router(services))
    _register_frontend_routes(app)
    return app


def _forbidden(detail: str) -> JSONResponse:
    return JSONResponse(status_code=403, content={"detail": detail})


def _is_public_path(path: str) -> bool:
    return path in LAN_PUBLIC_PATHS or path.startswith(LAN_PUBLIC_PREFIXES)


def _resolve_request_ip(request: Request) -> str | None:
    direct_host = request.client.host if request.client is not None else None

    trusted_proxy_sources = {"127.0.0.1", "::1", "testclient"}
    if direct_host in trusted_proxy_sources:
        explicit_ip = request.headers.get("X-Finance-Client-IP")
        if explicit_ip:
            return explicit_ip.split(",")[0].strip()
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

    return direct_host


def _is_local_client(host: str) -> bool:
    if host in {"localhost", "testclient", "::1", "127.0.0.1"}:
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def _is_private_ip(host: str) -> bool:
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return ip.is_private and not ip.is_loopback and not ip.is_link_local


def _is_ip_in_subnet(host: str, subnet_cidr: str) -> bool:
    try:
        return ipaddress.ip_address(host) in ipaddress.ip_network(
            subnet_cidr, strict=False
        )
    except ValueError:
        return False


def _read_effective_public_host(request: Request) -> str | None:
    host_header = request.headers.get("host")
    if host_header:
        parsed_host = urlparse(f"//{host_header}")
        if parsed_host.hostname:
            return parsed_host.hostname
    return request.url.hostname


def _read_request_origin_context(request: Request) -> tuple[str | None, str]:
    origin = request.headers.get("origin")
    if origin:
        return origin, "origin"

    finance_origin = request.headers.get("x-finance-origin")
    if finance_origin:
        return finance_origin, "x_finance_origin"

    referer = request.headers.get("referer")
    if referer:
        return referer, "referer"

    return None, "missing"


def _extract_origin_diagnostics(origin: str | None) -> dict[str, str | int | None]:
    if not origin:
        return {
            "origin_scheme": None,
            "origin_host": None,
            "origin_port": None,
        }

    parsed_origin = urlparse(origin)
    try:
        origin_host = parsed_origin.hostname
    except ValueError:
        origin_host = None

    try:
        origin_port = parsed_origin.port
    except ValueError:
        origin_port = None

    return {
        "origin_scheme": parsed_origin.scheme or None,
        "origin_host": origin_host,
        "origin_port": origin_port,
    }


def _is_origin_allowed(
    *,
    origin: str | None,
    expected_host: str | None,
    allow_http: bool,
) -> bool:
    allowed, _ = _evaluate_origin(
        origin=origin,
        expected_host=expected_host,
        allow_http=allow_http,
    )
    return allowed


def _evaluate_origin(
    *,
    origin: str | None,
    expected_host: str | None,
    allow_http: bool,
) -> tuple[bool, str]:
    if not origin or not expected_host:
        if not origin:
            return False, "missing_origin_header"
        return False, "missing_expected_host"

    parsed = urlparse(origin)
    if parsed.scheme not in {"http", "https"}:
        return False, "unsupported_origin_scheme"
    if parsed.hostname is None:
        return False, "missing_origin_hostname"

    if parsed.hostname.lower() != expected_host.lower():
        return False, "origin_host_mismatch"

    if parsed.scheme == "https":
        return True, "https_origin_allowed"

    if allow_http:
        return True, "http_origin_allowed"
    return False, "http_origin_disallowed"


def _read_bool_env(env_name: str) -> bool:
    raw = os.getenv(env_name)
    if raw is None:
        return False
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _log_lan_security_event(
    request: Request,
    *,
    reason: str,
    detail: str,
    request_ip: str | None,
    warning: bool,
    extra: dict[str, str | int | bool | None] | None = None,
) -> None:
    trace_enabled = bool(getattr(request.app.state, "security_trace_enabled", False))
    if not warning and not trace_enabled:
        return

    payload: dict[str, str | int | bool | None] = {
        "reason": reason,
        "detail": detail,
        "method": request.method.upper(),
        "path": request.url.path,
        "query": request.url.query or None,
        "request_url_host": request.url.hostname,
        "request_ip": request_ip,
        "direct_client_host": request.client.host if request.client else None,
        "host_header": request.headers.get("host"),
        "origin": request.headers.get("origin"),
        "referer": request.headers.get("referer"),
        "x_finance_origin": request.headers.get("x-finance-origin"),
        "x_forwarded_for": request.headers.get("x-forwarded-for"),
        "x_forwarded_host": request.headers.get("x-forwarded-host"),
        "x_forwarded_proto": request.headers.get("x-forwarded-proto"),
        "x_finance_client_ip": request.headers.get("x-finance-client-ip"),
        "has_device_token": request.headers.get("x-finance-token") is not None,
        "user_agent": request.headers.get("user-agent"),
    }
    if extra:
        payload.update(extra)

    serialized_payload = json.dumps(payload, ensure_ascii=True, sort_keys=True)
    if warning:
        logger.warning("lan_security %s", serialized_payload)
    else:
        logger.info("lan_security %s", serialized_payload)


def _register_frontend_routes(app: FastAPI) -> None:
    frontend_dist = _resolve_frontend_dist()
    if frontend_dist is None:
        return

    index_path = frontend_dist / "index.html"

    @app.get("/", include_in_schema=False)
    async def serve_frontend_root() -> FileResponse:
        return FileResponse(index_path)

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend_asset_or_spa(full_path: str) -> FileResponse:
        if full_path.startswith("api/") or full_path.startswith("health"):
            return JSONResponse(
                status_code=404,
                content={"detail": "Not found."},
            )

        requested = (frontend_dist / full_path).resolve()
        if requested.is_file() and str(requested).startswith(str(frontend_dist)):
            return FileResponse(requested)

        return FileResponse(index_path)


def _resolve_frontend_dist() -> Path | None:
    configured = os.getenv("FINANCE_APP_FRONTEND_DIST")
    candidates: list[Path] = []
    if configured:
        candidates.append(Path(configured))

    backend_cwd = Path.cwd()
    candidates.extend(
        [
            backend_cwd / "frontend" / "dist",
            backend_cwd.parent / "frontend" / "dist",
            backend_cwd / "dist",
            Path(__file__).resolve().parents[5] / "frontend" / "dist",
        ]
    )

    unique_candidates = list(dict.fromkeys(candidates))
    for candidate in unique_candidates:
        index_path = candidate / "index.html"
        if index_path.is_file():
            return candidate.resolve()

    return None
