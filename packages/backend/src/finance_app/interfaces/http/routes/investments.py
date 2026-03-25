from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from finance_app.application.accounts import AccountNotFoundError
from finance_app.application.investments import (
    InvalidInvestmentDateError,
    InvalidInvestmentRangeError,
    InvalidInvestmentTypeError,
    InvalidInvestmentViewError,
    InvestmentMovementAlreadyExistsError,
    InvestmentService,
    InvestmentServiceError,
)


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


def build_investments_router(investment_service: InvestmentService) -> APIRouter:
    router = APIRouter()

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
        goal_percent: int = Query(default=10, ge=0, le=100),
    ) -> dict[str, object]:
        try:
            return investment_service.get_overview(
                view=view,
                occurred_from=occurred_from,
                occurred_to=occurred_to,
                goal_percent=goal_percent,
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

    return router
