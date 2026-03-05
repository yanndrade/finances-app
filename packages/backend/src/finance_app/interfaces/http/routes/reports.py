from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status

from finance_app.application.transactions import (
    InvalidReportRangeError,
    InvalidTransactionDateError,
    TransactionService,
    TransactionServiceError,
)

PaymentMethod = Literal["PIX", "CASH", "OTHER"]


def build_reports_router(transaction_service: TransactionService) -> APIRouter:
    router = APIRouter()

    @router.get("/api/reports/summary")
    def get_report_summary(
        period: Literal["day", "week", "month", "custom"] = Query(default="month"),
        reference_date: str | None = Query(default=None, alias="reference"),
        occurred_from: str | None = Query(default=None, alias="from"),
        occurred_to: str | None = Query(default=None, alias="to"),
        category_id: str | None = Query(default=None, alias="category"),
        account_id: str | None = Query(default=None, alias="account"),
        card_id: str | None = Query(default=None, alias="card"),
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
                card_id=card_id,
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

    return router
