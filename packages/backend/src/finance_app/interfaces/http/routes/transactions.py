import re
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from finance_app.application.accounts import AccountNotFoundError
from finance_app.application.reimbursements import (
    InvalidPartialAmountError,
    InvalidReimbursementDateError,
    ReimbursementAlreadyCanceledError,
    ReimbursementAlreadyReceivedError,
    ReimbursementNotFoundError,
    ReimbursementService,
    ReimbursementServiceError,
)
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

PaymentMethod = Literal["PIX", "CASH", "OTHER"]
TransactionType = Literal["income", "expense"]
TransactionListType = Literal["income", "expense", "transfer", "investment"]
TransferDirection = Literal["debit", "credit"]


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
    amount: int | None = Field(default=None, gt=0)


class UpdateReimbursementRequest(BaseModel):
    expected_at: str | None = None
    notes: str | None = None


class CreateTransferRequest(BaseModel):
    id: str = Field(min_length=1)
    occurred_at: str
    from_account_id: str = Field(min_length=1)
    to_account_id: str = Field(min_length=1)
    amount: int = Field(gt=0)
    description: str | None = None


class TransactionListItem(BaseModel):
    transaction_id: str
    occurred_at: str
    type: TransactionListType
    amount: int
    account_id: str
    payment_method: PaymentMethod
    category_id: str
    description: str | None = None
    person_id: str | None = None
    status: str
    transfer_id: str | None = None
    direction: TransferDirection | None = None
    ledger_event_type: str | None = None
    ledger_source: str | None = None
    ledger_destination: str | None = None


def build_transactions_router(
    *,
    transaction_service: TransactionService,
    transfer_service: TransferService,
    reimbursement_service: ReimbursementService,
) -> APIRouter:
    router = APIRouter()

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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc
        except TransactionAlreadyExistsError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=str(exc)
            ) from exc
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc
        except TransactionAlreadyExistsError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=str(exc)
            ) from exc
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

    @router.get(
        "/api/transactions",
        responses={200: {"model": list[TransactionListItem]}},
    )
    def list_transactions(
        occurred_from: str | None = Query(default=None, alias="from"),
        occurred_to: str | None = Query(default=None, alias="to"),
        transaction_type: TransactionListType | None = Query(
            default=None, alias="type"
        ),
        category_id: str | None = Query(default=None, alias="category"),
        account_id: str | None = Query(default=None, alias="account"),
        card_id: str | None = Query(default=None, alias="card"),
        payment_method: PaymentMethod | None = Query(default=None, alias="method"),
        person_id: str | None = Query(default=None, alias="person"),
        text: str | None = Query(default=None, alias="text"),
        ledger: bool = Query(default=False),
    ) -> list[dict[str, str | int | None]]:
        try:
            return transaction_service.list_transactions(
                occurred_from=occurred_from,
                occurred_to=occurred_to,
                transaction_type=transaction_type,
                category_id=category_id,
                account_id=account_id,
                card_id=card_id,
                payment_method=payment_method,
                person_id=person_id,
                text=text,
                include_ledger=ledger,
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc
        except TransactionNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc

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
                amount=payload.amount,
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
        except (
            ReimbursementAlreadyReceivedError,
            ReimbursementAlreadyCanceledError,
        ) as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        except (InvalidReimbursementDateError, InvalidPartialAmountError) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc
        except ReimbursementServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc

    @router.get("/api/reimbursements")
    def list_reimbursements(
        reimbursement_status: str | None = Query(default=None, alias="status"),
        person_id: str | None = Query(default=None, alias="person"),
        month: str | None = Query(default=None, alias="month"),
    ) -> list[dict[str, str | int | None]]:
        if month is not None and re.fullmatch(r"\d{4}-\d{2}", month) is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="month must use YYYY-MM format.",
            )
        return reimbursement_service.list_reimbursements(
            status=reimbursement_status,
            person_id=person_id,
            month=month,
        )

    @router.get("/api/reimbursements/summary")
    def get_reimbursements_summary(
        month: str | None = Query(default=None, alias="month"),
    ) -> dict[str, int]:
        if month is not None and re.fullmatch(r"\d{4}-\d{2}", month) is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="month must use YYYY-MM format.",
            )
        return reimbursement_service.get_summary(month=month)

    @router.patch("/api/reimbursements/{transaction_id}")
    def update_reimbursement(
        transaction_id: str,
        payload: UpdateReimbursementRequest,
    ) -> dict[str, str | int | None]:
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No fields provided to update.",
            )
        try:
            return reimbursement_service.update_reimbursement(
                transaction_id,
                **updates,
            )
        except ReimbursementNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc
        except (ReimbursementAlreadyCanceledError,) as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=str(exc)
            ) from exc
        except InvalidReimbursementDateError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc
        except ReimbursementServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc

    @router.post("/api/reimbursements/{transaction_id}/cancel")
    def cancel_reimbursement(
        transaction_id: str,
    ) -> dict[str, str | int | None]:
        try:
            return reimbursement_service.cancel_reimbursement(transaction_id)
        except ReimbursementNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc
        except (
            ReimbursementAlreadyReceivedError,
            ReimbursementAlreadyCanceledError,
        ) as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=str(exc)
            ) from exc
        except ReimbursementServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            ) from exc
        except TransactionAlreadyExistsError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=str(exc)
            ) from exc
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
