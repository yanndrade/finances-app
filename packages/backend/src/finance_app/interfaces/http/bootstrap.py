from __future__ import annotations

from dataclasses import dataclass

from finance_app.application.accounts import AccountService
from finance_app.application.budgets import BudgetService
from finance_app.application.card_purchases import CardPurchaseService
from finance_app.application.cards import CardService
from finance_app.application.investments import InvestmentService
from finance_app.application.invoice_payments import InvoicePaymentService
from finance_app.application.movements import MovementService
from finance_app.application.recurring import RecurringService
from finance_app.application.reimbursements import ReimbursementService
from finance_app.application.transactions import TransactionService
from finance_app.application.transfers import TransferService
from finance_app.infrastructure.event_store import EventStore
from finance_app.infrastructure.projector import Projector


@dataclass(frozen=True)
class AppServices:
    account_service: AccountService
    card_service: CardService
    card_purchase_service: CardPurchaseService
    invoice_payment_service: InvoicePaymentService
    reimbursement_service: ReimbursementService
    recurring_service: RecurringService
    budget_service: BudgetService
    investment_service: InvestmentService
    transaction_service: TransactionService
    transfer_service: TransferService
    movement_service: MovementService
    event_store: EventStore
    projector: Projector


def build_services(
    *,
    database_url: str | None = None,
    event_database_url: str | None = None,
) -> AppServices:
    event_store = EventStore(database_url=event_database_url)
    projector = Projector(
        event_database_url=event_database_url,
        projection_database_url=database_url,
    )
    movement_service = MovementService(projector=projector)
    account_service = AccountService(event_store=event_store, projector=projector)
    card_service = CardService(
        event_store=event_store,
        projector=projector,
        account_reader=account_service,
    )
    card_purchase_service = CardPurchaseService(
        event_store=event_store,
        projector=projector,
        card_reader=card_service,
    )
    invoice_payment_service = InvoicePaymentService(
        event_store=event_store,
        projector=projector,
        account_reader=account_service,
    )
    reimbursement_service = ReimbursementService(
        event_store=event_store,
        projector=projector,
        account_reader=account_service,
    )
    recurring_service = RecurringService(
        event_store=event_store,
        projector=projector,
        account_reader=account_service,
        card_reader=card_service,
    )
    budget_service = BudgetService(
        event_store=event_store,
        projector=projector,
    )
    investment_service = InvestmentService(
        event_store=event_store,
        projector=projector,
        account_reader=account_service,
    )
    transaction_service = TransactionService(
        event_store=event_store,
        projector=projector,
        account_reader=account_service,
    )
    transfer_service = TransferService(
        event_store=event_store,
        projector=projector,
        account_reader=account_service,
    )
    return AppServices(
        account_service=account_service,
        card_service=card_service,
        card_purchase_service=card_purchase_service,
        invoice_payment_service=invoice_payment_service,
        reimbursement_service=reimbursement_service,
        recurring_service=recurring_service,
        budget_service=budget_service,
        investment_service=investment_service,
        transaction_service=transaction_service,
        transfer_service=transfer_service,
        movement_service=movement_service,
        event_store=event_store,
        projector=projector,
    )
