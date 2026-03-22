from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from finance_app.application.accounts import AccountNotFoundError
from finance_app.application.card_purchases import (
    CardPurchaseAlreadyExistsError,
    CardPurchaseNotFoundError,
    CardPurchaseService,
    CardPurchaseServiceError,
    InvoiceNotFoundError as CardInvoiceNotFoundError,
)
from finance_app.application.cards import (
    CardAlreadyExistsError,
    CardNotFoundError,
    CardService,
    CardServiceError,
)
from finance_app.application.invoice_payments import (
    InvoiceNotFoundError,
    InvoicePaymentAlreadyExistsError,
    InvoicePaymentService,
    InvoicePaymentServiceError,
)

AccountType = Literal["checking", "savings", "wallet", "investment", "other"]


class CreateCardRequest(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    limit: int = Field(gt=0)
    closing_day: int = Field(ge=1, le=28)
    due_day: int = Field(ge=1, le=28)
    payment_account_id: str | None = None


class UpdateCardRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    limit: int | None = Field(default=None, gt=0)
    closing_day: int | None = Field(default=None, ge=1, le=28)
    due_day: int | None = Field(default=None, ge=1, le=28)
    payment_account_id: str | None = None
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


class UpdateCardPurchaseRequest(BaseModel):
    purchase_date: str | None = None
    amount: int | None = Field(default=None, gt=0)
    installments_count: int | None = Field(default=None, ge=1)
    category_id: str | None = Field(default=None, min_length=1)
    card_id: str | None = Field(default=None, min_length=1)
    description: str | None = None
    person_id: str | None = None


class CreateInvoicePaymentRequest(BaseModel):
    id: str = Field(min_length=1)
    amount: int = Field(gt=0)
    account_id: str = Field(min_length=1)
    paid_at: str


def build_cards_router(
    *,
    card_service: CardService,
    card_purchase_service: CardPurchaseService,
    invoice_payment_service: InvoicePaymentService,
) -> APIRouter:
    router = APIRouter()

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

    @router.patch("/api/card-purchases/{purchase_id}")
    def update_card_purchase(
        purchase_id: str,
        payload: UpdateCardPurchaseRequest,
    ) -> dict[str, str | int | None]:
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No fields provided to update.",
            )
        try:
            return card_purchase_service.update_card_purchase(
                purchase_id,
                **updates,
            )
        except (AccountNotFoundError, CardNotFoundError) as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except CardPurchaseNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except CardPurchaseServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.post("/api/card-purchases/{purchase_id}/void", status_code=status.HTTP_204_NO_CONTENT)
    def void_card_purchase(purchase_id: str) -> None:
        try:
            card_purchase_service.void_card_purchase(purchase_id)
        except CardPurchaseNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except CardPurchaseServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.get("/api/card-purchases")
    def list_card_purchases(
        card_id: str | None = Query(default=None, alias="card"),
    ) -> list[dict[str, str | int | None]]:
        try:
            return card_purchase_service.list_card_purchases(card_id=card_id)
        except CardPurchaseServiceError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.get("/api/card-installments")
    def list_card_installments(
        card_id: str | None = Query(default=None, alias="card"),
        reference_month_from: str | None = Query(default=None, alias="from_month"),
    ) -> list[dict[str, str | int | None]]:
        try:
            return card_purchase_service.list_card_installments(
                card_id=card_id,
                reference_month_from=reference_month_from,
            )
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

    return router
