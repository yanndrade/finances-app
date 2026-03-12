import ipaddress
from urllib.parse import urlparse

from fastapi import APIRouter
from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
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
            return _forbidden("This endpoint is only available on localhost.")

        if request_ip is None or _is_local_client(request_ip):
            return await call_next(request)

        lan_state = services.security_store.read_lan_security_state()
        if not lan_state.enabled:
            return _forbidden("LAN mode is disabled.")

        network = services.security_store.resolve_lan_network()
        if network is None:
            return JSONResponse(
                status_code=503,
                content={"detail": "No private LAN network detected."},
            )

        if not _is_private_ip(request_ip):
            return _forbidden("Only private network addresses are allowed.")
        if not _is_ip_in_subnet(request_ip, network.subnet_cidr):
            return _forbidden("Request origin is outside the authorized subnet.")

        if path.startswith(LAN_LOCAL_ONLY_PREFIXES):
            return _forbidden("LAN configuration endpoints are desktop-only.")

        if request.method.upper() == "OPTIONS":
            return await call_next(request)

        if path == LAN_PAIR_ENDPOINT and request.method.upper() in {"GET", "POST"}:
            return await call_next(request)

        origin = request.headers.get("origin")
        allow_http_origin = getattr(request.app.state, "public_scheme", "http") != "https"
        if not _is_origin_allowed(
            origin=origin,
            local_ip=network.local_ip,
            allow_http=allow_http_origin,
        ):
            return _forbidden("Invalid request origin.")

        device_token = request.headers.get("X-Finance-Token")
        if not device_token:
            return _forbidden("Missing X-Finance-Token header.")

        if not services.security_store.verify_device_token(
            device_token,
            request_ip=request_ip,
        ):
            return _forbidden("Invalid or revoked device token.")

        return await call_next(request)

    app.include_router(build_router(services))
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
        return ipaddress.ip_address(host) in ipaddress.ip_network(subnet_cidr, strict=False)
    except ValueError:
        return False


def _is_origin_allowed(*, origin: str | None, local_ip: str, allow_http: bool) -> bool:
    if not origin:
        return False

    parsed = urlparse(origin)
    if parsed.scheme not in {"http", "https"}:
        return False
    if parsed.hostname is None:
        return False

    if parsed.hostname in {"localhost", "127.0.0.1"}:
        return True

    if parsed.hostname != local_ip:
        return False

    if parsed.scheme == "https":
        return True

    return allow_http
