from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, Field

from finance_app.application.budgets import (
    BudgetService,
    BudgetServiceError,
    InvalidBudgetMonthError,
)


class CreateBudgetRequest(BaseModel):
    category_id: str = Field(min_length=1)
    month: str
    limit: int = Field(gt=0)


def build_budgets_router(budget_service: BudgetService) -> APIRouter:
    router = APIRouter()

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

    return router
