import re
from typing import Literal

from fastapi import APIRouter, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from finance_app.application.accounts import (
    AccountAlreadyExistsError,
    AccountNotFoundError,
    AccountService,
    InvalidAccountTypeError,
    LastActiveAccountError,
)
from finance_app.application.card_purchases import (
    CardPurchaseAlreadyExistsError,
    CardPurchaseNotFoundError,
    InvoiceNotFoundError as CardInvoiceNotFoundError,
    CardPurchaseService,
    CardPurchaseServiceError,
)
from finance_app.application.cards import (
    CardAlreadyExistsError,
    CardNotFoundError,
    CardServiceError,
    CardService,
)
from finance_app.application.budgets import (
    BudgetService,
    BudgetServiceError,
    InvalidBudgetMonthError,
)
from finance_app.application.health import HealthCheckUseCase
from finance_app.application.investments import (
    InvalidInvestmentDateError,
    InvalidInvestmentRangeError,
    InvalidInvestmentTypeError,
    InvalidInvestmentViewError,
    InvestmentMovementAlreadyExistsError,
    InvestmentService,
    InvestmentServiceError,
)
from finance_app.application.invoice_payments import (
    InvoiceNotFoundError,
    InvoicePaymentAlreadyExistsError,
    InvoicePaymentService,
    InvoicePaymentServiceError,
)
from finance_app.application.reimbursements import (
    InvalidReimbursementDateError,
    ReimbursementAlreadyReceivedError,
    ReimbursementNotFoundError,
    ReimbursementService,
    ReimbursementServiceError,
)
from finance_app.application.recurring import (
    InvalidRecurringMonthError,
    PendingAlreadyConfirmedError,
    PendingNotFoundError,
    RecurringRuleAlreadyExistsError,
    RecurringService,
    RecurringServiceError,
)
from finance_app.application.transactions import (
    InvalidReportRangeError,
    InvalidTransactionDateError,
    TransactionAlreadyExistsError,
    TransactionNotFoundError,
    TransactionService,
    TransactionServiceError,
)
from finance_app.application.transfers import (
    InvalidTransferAccountsError,
    TransferService,
)
from finance_app.infrastructure.event_store import EventStore
from finance_app.infrastructure.projector import Projector

AccountType = Literal["checking", "savings", "wallet", "investment", "other"]
PaymentMethod = Literal["PIX", "CASH", "OTHER"]
TransactionType = Literal["income", "expense"]


class CreateAccountRequest(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    type: AccountType
    initial_balance: int


class UpdateAccountRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    type: AccountType | None = None
    initial_balance: int | None = None
    is_active: bool | None = None


class CreateCardRequest(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    limit: int = Field(gt=0)
    closing_day: int = Field(ge=1, le=28)
    due_day: int = Field(ge=1, le=28)
    payment_account_id: str = Field(min_length=1)


class UpdateCardRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    limit: int | None = Field(default=None, gt=0)
    closing_day: int | None = Field(default=None, ge=1, le=28)
    due_day: int | None = Field(default=None, ge=1, le=28)
    payment_account_id: str | None = Field(default=None, min_length=1)
    is_active: bool | None = None


class CreateCardPurchaseRequest(BaseModel):
    id: str = Field(min_length=1)
    purchase_date: str
    amount: int = Field(gt=0)
    installments_count: int = Field(default=1, ge=1)
    category_id: str = Field(min_length=1)
    card_id: str = Field(min_length=1)
    description: str | None = None
    person_id: str | None = None


class CreateInvoicePaymentRequest(BaseModel):
    id: str = Field(min_length=1)
    amount: int = Field(gt=0)
    account_id: str = Field(min_length=1)
    paid_at: str


class CreateTransactionRequest(BaseModel):
    id: str = Field(min_length=1)
    occurred_at: str
    amount: int = Field(gt=0)
    account_id: str = Field(min_length=1)
    payment_method: PaymentMethod
    category_id: str = Field(min_length=1)
    description: str | None = None
    person_id: str | None = None


class UpdateTransactionRequest(BaseModel):
    occurred_at: str | None = None
    type: TransactionType | None = None
    amount: int | None = Field(default=None, gt=0)
    account_id: str | None = Field(default=None, min_length=1)
    payment_method: PaymentMethod | None = None
    category_id: str | None = Field(default=None, min_length=1)
    description: str | None = None
    person_id: str | None = None


class VoidTransactionRequest(BaseModel):
    reason: str | None = None


class MarkReimbursementReceivedRequest(BaseModel):
    received_at: str
    account_id: str | None = Field(default=None, min_length=1)


class CreateRecurringRuleRequest(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    amount: int = Field(gt=0)
    due_day: int = Field(ge=1, le=28)
    account_id: str = Field(min_length=1)
    payment_method: PaymentMethod
    category_id: str = Field(min_length=1)
    description: str | None = None


class CreateTransferRequest(BaseModel):
    id: str = Field(min_length=1)
    occurred_at: str
    from_account_id: str = Field(min_length=1)
    to_account_id: str = Field(min_length=1)
    amount: int = Field(gt=0)
    description: str | None = None


class CreateBudgetRequest(BaseModel):
    category_id: str = Field(min_length=1)
    month: str
    limit: int = Field(gt=0)


class CreateInvestmentMovementRequest(BaseModel):
    id: str = Field(min_length=1)
    occurred_at: str
    type: Literal["contribution", "withdrawal"]
    account_id: str = Field(min_length=1)
    description: str | None = None
    contribution_amount: int | None = Field(default=None, ge=0)
    dividend_amount: int | None = Field(default=None, ge=0)
    cash_amount: int | None = Field(default=None, ge=0)
    invested_amount: int | None = Field(default=None, ge=0)


def build_router(
    account_service: AccountService,
    card_service: CardService,
    card_purchase_service: CardPurchaseService,
    invoice_payment_service: InvoicePaymentService,
    reimbursement_service: ReimbursementService,
    recurring_service: RecurringService,
    budget_service: BudgetService,
    investment_service: InvestmentService,
    transaction_service: TransactionService,
    transfer_service: TransferService,
    event_store: EventStore,
    projector: Projector,
) -> APIRouter:
    router = APIRouter()

    @router.get("/health")
    def health() -> dict[str, str]:
        return HealthCheckUseCase().execute()

    @router.get("/api/accounts")
    def list_accounts() -> list[dict[str, str | int | bool]]:
        return account_service.list_accounts()

    @router.post("/api/accounts", status_code=status.HTTP_201_CREATED)
    def create_account(payload: CreateAccountRequest) -> dict[str, str | int | bool]:
        try:
            return account_service.create_account(
                account_id=payload.id,
                name=payload.name,
                account_type=payload.type,
                initial_balance=payload.initial_balance,
            )
        except AccountAlreadyExistsError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        except InvalidAccountTypeError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.patch("/api/accounts/{account_id}")
    def update_account(
        account_id: str,
        payload: UpdateAccountRequest,
    ) -> dict[str, str | int | bool]:
        try:
            return account_service.update_account(
                account_id,
                name=payload.name,
                account_type=payload.type,
                initial_balance=payload.initial_balance,
                is_active=payload.is_active,
            )
        except AccountNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except LastActiveAccountError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        except InvalidAccountTypeError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.get("/api/cards")
    def list_cards() -> list[dict[str, str | int | bool]]:
        return card_service.list_cards()

    @router.post("/api/cards", status_code=status.HTTP_201_CREATED)
    def create_card(payload: CreateCardRequest) -> dict[str, str | int | bool]:
        try:
            return card_service.create_card(
                card_id=payload.id,
                name=payload.name,
                limit_amount=payload.limit,
                closing_day=payload.closing_day,
                due_day=payload.due_day,
                payment_account_id=payload.payment_account_id,
            )
        except AccountNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except CardAlreadyExistsError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        except CardServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.patch("/api/cards/{card_id}")
    def update_card(
        card_id: str,
        payload: UpdateCardRequest,
    ) -> dict[str, str | int | bool]:
        try:
            return card_service.update_card(
                card_id,
                name=payload.name,
                limit_amount=payload.limit,
                closing_day=payload.closing_day,
                due_day=payload.due_day,
                payment_account_id=payload.payment_account_id,
                is_active=payload.is_active,
            )
        except AccountNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except CardNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except CardServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.post("/api/card-purchases", status_code=status.HTTP_201_CREATED)
    def create_card_purchase(
        payload: CreateCardPurchaseRequest,
    ) -> dict[str, str | int | None]:
        try:
            return card_purchase_service.create_card_purchase(
                purchase_id=payload.id,
                purchase_date=payload.purchase_date,
                amount=payload.amount,
                installments_count=payload.installments_count,
                category_id=payload.category_id,
                card_id=payload.card_id,
                description=payload.description,
                person_id=payload.person_id,
            )
        except (AccountNotFoundError, CardNotFoundError) as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except CardPurchaseAlreadyExistsError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        except CardPurchaseServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.get("/api/invoices")
    def list_invoices(
        card_id: str | None = Query(default=None, alias="card"),
    ) -> list[dict[str, str | int]]:
        try:
            return card_purchase_service.list_invoices(card_id=card_id)
        except CardPurchaseServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.get("/api/invoices/{invoice_id}/items")
    def list_invoice_items(
        invoice_id: str,
    ) -> list[dict[str, str | int | None]]:
        try:
            return card_purchase_service.list_invoice_items(invoice_id=invoice_id)
        except (CardPurchaseNotFoundError, CardInvoiceNotFoundError) as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except CardPurchaseServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.post("/api/invoices/{invoice_id}/payments", status_code=status.HTTP_201_CREATED)
    def create_invoice_payment(
        invoice_id: str,
        payload: CreateInvoicePaymentRequest,
    ) -> dict[str, str | int]:
        try:
            return invoice_payment_service.create_payment(
                payment_id=payload.id,
                invoice_id=invoice_id,
                amount=payload.amount,
                account_id=payload.account_id,
                paid_at=payload.paid_at,
            )
        except AccountNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except InvoiceNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except InvoicePaymentAlreadyExistsError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        except InvoicePaymentServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.post("/api/incomes", status_code=status.HTTP_201_CREATED)
    def create_income(
        payload: CreateTransactionRequest,
    ) -> list[dict[str, str | int | None]] | dict[str, str | int | None]:
        try:
            return transaction_service.create_income(
                transaction_id=payload.id,
                occurred_at=payload.occurred_at,
                amount=payload.amount,
                account_id=payload.account_id,
                payment_method=payload.payment_method,
                category_id=payload.category_id,
                description=payload.description,
                person_id=payload.person_id,
            )
        except AccountNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except TransactionAlreadyExistsError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
        except InvalidTransactionDateError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc
        except TransactionServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.post("/api/expenses", status_code=status.HTTP_201_CREATED)
    def create_expense(
        payload: CreateTransactionRequest,
    ) -> list[dict[str, str | int | None]] | dict[str, str | int | None]:
        try:
            return transaction_service.create_expense(
                transaction_id=payload.id,
                occurred_at=payload.occurred_at,
                amount=payload.amount,
                account_id=payload.account_id,
                payment_method=payload.payment_method,
                category_id=payload.category_id,
                description=payload.description,
                person_id=payload.person_id,
            )
        except AccountNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except TransactionAlreadyExistsError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
        except InvalidTransactionDateError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc
        except TransactionServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.get("/api/transactions")
    def list_transactions(
        occurred_from: str | None = Query(default=None, alias="from"),
        occurred_to: str | None = Query(default=None, alias="to"),
        category_id: str | None = Query(default=None, alias="category"),
        account_id: str | None = Query(default=None, alias="account"),
        payment_method: PaymentMethod | None = Query(default=None, alias="method"),
        person_id: str | None = Query(default=None, alias="person"),
        text: str | None = Query(default=None, alias="text"),
    ) -> list[dict[str, str | int | None]]:
        try:
            return transaction_service.list_transactions(
                occurred_from=occurred_from,
                occurred_to=occurred_to,
                category_id=category_id,
                account_id=account_id,
                payment_method=payment_method,
                person_id=person_id,
                text=text,
            )
        except InvalidTransactionDateError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc
        except TransactionServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.get("/api/dashboard")
    def get_dashboard(
        month: str = Query(...),
    ) -> dict[str, object]:
        if re.fullmatch(r"\d{4}-\d{2}", month) is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Month must use YYYY-MM format.",
            )

        return transaction_service.get_dashboard_summary(month=month)

    @router.get("/api/reports/summary")
    def get_report_summary(
        period: Literal["day", "week", "month", "custom"] = Query(default="month"),
        reference_date: str | None = Query(default=None, alias="reference"),
        occurred_from: str | None = Query(default=None, alias="from"),
        occurred_to: str | None = Query(default=None, alias="to"),
        category_id: str | None = Query(default=None, alias="category"),
        account_id: str | None = Query(default=None, alias="account"),
        payment_method: PaymentMethod | None = Query(default=None, alias="method"),
        person_id: str | None = Query(default=None, alias="person"),
        text: str | None = Query(default=None, alias="text"),
    ) -> dict[str, object]:
        try:
            return transaction_service.get_report_summary(
                period=period,
                reference_date=reference_date,
                occurred_from=occurred_from,
                occurred_to=occurred_to,
                category_id=category_id,
                account_id=account_id,
                payment_method=payment_method,
                person_id=person_id,
                text=text,
            )
        except (InvalidTransactionDateError, InvalidReportRangeError) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc
        except TransactionServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.patch("/api/transactions/{transaction_id}")
    def update_transaction(
        transaction_id: str,
        payload: UpdateTransactionRequest,
    ) -> list[dict[str, str | int | None]] | dict[str, str | int | None]:
        updates = payload.model_dump(exclude_unset=True)
        if "type" in updates:
            updates["transaction_type"] = updates.pop("type")

        try:
            return transaction_service.update_transaction(
                transaction_id,
                **updates,
            )
        except AccountNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except TransactionNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except InvalidTransactionDateError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc
        except TransactionServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.post("/api/transactions/{transaction_id}/void")
    def void_transaction(
        transaction_id: str,
        payload: VoidTransactionRequest,
    ) -> list[dict[str, str | int | None]] | dict[str, str | int | None]:
        try:
            return transaction_service.void_transaction(
                transaction_id,
                reason=payload.reason,
            )
        except TransactionNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    @router.post(
        "/api/reimbursements/{transaction_id}/mark-received",
        status_code=status.HTTP_201_CREATED,
    )
    def mark_reimbursement_received(
        transaction_id: str,
        payload: MarkReimbursementReceivedRequest,
    ) -> dict[str, str | int | None]:
        try:
            return reimbursement_service.mark_received(
                transaction_id,
                received_at=payload.received_at,
                account_id=payload.account_id,
            )
        except ReimbursementNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except AccountNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except ReimbursementAlreadyReceivedError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        except InvalidReimbursementDateError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc
        except ReimbursementServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.post("/api/recurring-rules", status_code=status.HTTP_201_CREATED)
    def create_recurring_rule(
        payload: CreateRecurringRuleRequest,
    ) -> dict[str, str | int | bool | None]:
        try:
            return recurring_service.create_rule(
                rule_id=payload.id,
                name=payload.name,
                amount=payload.amount,
                due_day=payload.due_day,
                account_id=payload.account_id,
                payment_method=payload.payment_method,
                category_id=payload.category_id,
                description=payload.description,
            )
        except AccountNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except RecurringRuleAlreadyExistsError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        except RecurringServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.get("/api/pendings")
    def list_pendings(
        month: str = Query(...),
    ) -> list[dict[str, str | int | None]]:
        try:
            return recurring_service.list_pendings(month=month)
        except InvalidRecurringMonthError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc
        except RecurringServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.post("/api/pendings/{pending_id}/confirm", status_code=status.HTTP_201_CREATED)
    def confirm_pending(
        pending_id: str,
    ) -> dict[str, str | int | None]:
        try:
            return recurring_service.confirm_pending(pending_id)
        except PendingNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except PendingAlreadyConfirmedError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        except AccountNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except RecurringServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.post("/api/budgets")
    def upsert_budget(
        payload: CreateBudgetRequest,
        response: Response,
    ) -> dict[str, str | int]:
        try:
            budget, created = budget_service.upsert_budget(
                category_id=payload.category_id,
                month=payload.month,
                limit=payload.limit,
            )
            response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
            return budget
        except InvalidBudgetMonthError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc
        except BudgetServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.get("/api/budgets")
    def list_budgets(
        month: str = Query(...),
    ) -> list[dict[str, str | int]]:
        try:
            return budget_service.list_budgets(month=month)
        except InvalidBudgetMonthError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc
        except BudgetServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.post("/api/investments/movements", status_code=status.HTTP_201_CREATED)
    def create_investment_movement(
        payload: CreateInvestmentMovementRequest,
    ) -> dict[str, str | int | None]:
        try:
            return investment_service.create_movement(
                movement_id=payload.id,
                occurred_at=payload.occurred_at,
                movement_type=payload.type,
                account_id=payload.account_id,
                description=payload.description,
                contribution_amount=payload.contribution_amount,
                dividend_amount=payload.dividend_amount,
                cash_amount=payload.cash_amount,
                invested_amount=payload.invested_amount,
            )
        except AccountNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except InvestmentMovementAlreadyExistsError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        except (
            InvalidInvestmentDateError,
            InvalidInvestmentTypeError,
            InvestmentServiceError,
        ) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.get("/api/investments/movements")
    def list_investment_movements(
        occurred_from: str | None = Query(default=None, alias="from"),
        occurred_to: str | None = Query(default=None, alias="to"),
    ) -> list[dict[str, str | int | None]]:
        try:
            return investment_service.list_movements(
                occurred_from=occurred_from,
                occurred_to=occurred_to,
            )
        except (
            InvalidInvestmentDateError,
            InvalidInvestmentRangeError,
            InvestmentServiceError,
        ) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.get("/api/investments/overview")
    def get_investment_overview(
        view: Literal["daily", "weekly", "monthly", "bimonthly", "quarterly", "yearly"] = Query(...),
        occurred_from: str = Query(..., alias="from"),
        occurred_to: str = Query(..., alias="to"),
    ) -> dict[str, object]:
        try:
            return investment_service.get_overview(
                view=view,
                occurred_from=occurred_from,
                occurred_to=occurred_to,
            )
        except (
            InvalidInvestmentDateError,
            InvalidInvestmentRangeError,
            InvalidInvestmentViewError,
            InvestmentServiceError,
        ) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.post("/api/transfers", status_code=status.HTTP_201_CREATED)
    def create_transfer(
        payload: CreateTransferRequest,
    ) -> list[dict[str, str | int | None]]:
        try:
            return transfer_service.create_transfer(
                transfer_id=payload.id,
                occurred_at=payload.occurred_at,
                from_account_id=payload.from_account_id,
                to_account_id=payload.to_account_id,
                amount=payload.amount,
                description=payload.description,
            )
        except AccountNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except TransactionAlreadyExistsError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
        except (InvalidTransactionDateError, InvalidTransferAccountsError) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc
        except TransactionServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.post("/api/dev/reset")
    def reset_application_data() -> dict[str, str]:
        event_store.reset()
        projector.reset()
        return {
            "status": "ok",
            "message": "Application data reset.",
        }

    return router


def create_app(
    *,
    database_url: str | None = None,
    event_database_url: str | None = None,
) -> FastAPI:
    event_store = EventStore(database_url=event_database_url)
    projector = Projector(
        event_database_url=event_database_url,
        projection_database_url=database_url,
    )
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
    app.include_router(
        build_router(
            account_service,
            card_service,
            card_purchase_service,
            invoice_payment_service,
            reimbursement_service,
            recurring_service,
            budget_service,
            investment_service,
            transaction_service,
            transfer_service,
            event_store,
            projector,
        )
    )
    return app
