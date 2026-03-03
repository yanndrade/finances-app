import re
from typing import Literal

from fastapi import APIRouter, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from finance_app.application.accounts import (
    AccountAlreadyExistsError,
    AccountNotFoundError,
    AccountService,
    InvalidAccountTypeError,
    LastActiveAccountError,
)
from finance_app.application.health import HealthCheckUseCase
from finance_app.application.transactions import (
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


class CreateTransferRequest(BaseModel):
    id: str = Field(min_length=1)
    occurred_at: str
    from_account_id: str = Field(min_length=1)
    to_account_id: str = Field(min_length=1)
    amount: int = Field(gt=0)
    description: str | None = None


def build_router(
    account_service: AccountService,
    transaction_service: TransactionService,
    transfer_service: TransferService,
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
    app.include_router(build_router(account_service, transaction_service, transfer_service))
    return app
