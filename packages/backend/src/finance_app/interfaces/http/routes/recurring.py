from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from finance_app.application.accounts import AccountNotFoundError
from finance_app.application.recurring import (
    InvalidRecurringMonthError,
    PendingAlreadyConfirmedError,
    PendingNotFoundError,
    RecurringRuleAlreadyExistsError,
    RecurringService,
    RecurringServiceError,
)

PaymentMethod = Literal["PIX", "CASH", "OTHER"]


class CreateRecurringRuleRequest(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    amount: int = Field(gt=0)
    due_day: int = Field(ge=1, le=28)
    account_id: str = Field(min_length=1)
    payment_method: PaymentMethod
    category_id: str = Field(min_length=1)
    description: str | None = None


def build_recurring_router(recurring_service: RecurringService) -> APIRouter:
    router = APIRouter()

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

    return router
