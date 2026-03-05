from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from finance_app.interfaces.http.bootstrap import AppServices, build_services
from finance_app.interfaces.http.routes.accounts import build_accounts_router
from finance_app.interfaces.http.routes.backups import build_backups_router
from finance_app.interfaces.http.routes.budgets import build_budgets_router
from finance_app.interfaces.http.routes.cards import build_cards_router
from finance_app.interfaces.http.routes.dev import build_dev_router
from finance_app.interfaces.http.routes.health import build_health_router
from finance_app.interfaces.http.routes.investments import build_investments_router
from finance_app.interfaces.http.routes.recurring import build_recurring_router
from finance_app.interfaces.http.routes.reports import build_reports_router
from finance_app.interfaces.http.routes.transactions import build_transactions_router


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
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "tauri://localhost",
            "http://tauri.localhost",
            "https://tauri.localhost",
        ],
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(build_router(services))
    return app
