from fastapi import APIRouter

from finance_app.application.accounts import AccountService
from finance_app.application.card_purchases import CardPurchaseService
from finance_app.application.cards import CardService
from finance_app.application.investments import InvestmentService
from finance_app.application.transactions import TransactionService


def build_backups_router(
    *,
    account_service: AccountService,
    card_service: CardService,
    card_purchase_service: CardPurchaseService,
    investment_service: InvestmentService,
    transaction_service: TransactionService,
) -> APIRouter:
    router = APIRouter()

    @router.get("/api/backups/export")
    def export_backup() -> dict[str, object]:
        accounts = account_service.list_accounts()
        cards = card_service.list_cards()
        invoices = card_purchase_service.list_invoices()
        transactions = transaction_service.list_transactions()
        investment_movements = investment_service.list_movements()

        report_summary: dict[str, object] | None = None
        if transactions:
            occurred_at_values = [str(row["occurred_at"]) for row in transactions]
            report_summary = transaction_service.get_report_summary(
                period="custom",
                occurred_from=min(occurred_at_values),
                occurred_to=max(occurred_at_values),
            )

        return {
            "accounts": accounts,
            "cards": cards,
            "invoices": invoices,
            "transactions": transactions,
            "investment_movements": investment_movements,
            "report_summary": report_summary,
        }

    return router
