"""HTTP routes for the unified movement ledger."""

from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status

from finance_app.application.movements import MovementService

MovementKind = Literal[
    "income", "expense", "transfer", "investment", "reimbursement", "adjustment"
]
MovementOriginType = Literal[
    "manual",
    "recurring",
    "installment",
    "card_purchase",
    "transfer",
    "investment",
    "reimbursement",
    "imported",
]
MovementLifecycleStatus = Literal[
    "forecast", "pending", "cleared", "cancelled", "voided"
]
MovementScope = Literal[
    "all",
    "fixed",
    "installments",
    "variable",
    "transfers",
    "investments",
    "reimbursements",
    "review",
]
MovementSortBy = Literal[
    "posted_at", "competence_month", "amount", "title", "category_id"
]
MovementSortDir = Literal["asc", "desc"]

_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")


def _validate_month(value: str, param_name: str = "competence_month") -> None:
    if not _MONTH_RE.match(value):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{param_name} must use YYYY-MM format.",
        )


def build_movements_router(*, movement_service: MovementService) -> APIRouter:
    router = APIRouter()

    @router.get("/api/movements")
    def list_movements(
        competence_month: str | None = Query(default=None),
        kind: MovementKind | None = Query(default=None),
        origin_type: MovementOriginType | None = Query(default=None),
        lifecycle_status: MovementLifecycleStatus | None = Query(default=None),
        account_id: str | None = Query(default=None),
        card_id: str | None = Query(default=None),
        category_id: str | None = Query(default=None),
        payment_method: str | None = Query(default=None),
        counterparty: str | None = Query(default=None),
        has_counterparty: bool | None = Query(default=None),
        text: str | None = Query(default=None),
        scope: MovementScope | None = Query(default=None),
        needs_review: bool | None = Query(default=None),
        sort_by: MovementSortBy = Query(default="posted_at"),
        sort_dir: MovementSortDir = Query(default="desc"),
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=50, ge=1, le=200),
    ) -> dict[str, object]:
        if competence_month is not None:
            _validate_month(competence_month)

        return movement_service.list_movements(
            competence_month=competence_month,
            kind=kind,
            origin_type=origin_type,
            lifecycle_status=lifecycle_status,
            account_id=account_id,
            card_id=card_id,
            category_id=category_id,
            payment_method=payment_method,
            counterparty=counterparty,
            has_counterparty=has_counterparty,
            text=text,
            scope=scope,
            needs_review=needs_review,
            sort_by=sort_by,
            sort_dir=sort_dir,
            page=page,
            page_size=page_size,
        )

    @router.get("/api/movements/summary")
    def get_movements_summary(
        competence_month: str = Query(...),
    ) -> dict[str, object]:
        _validate_month(competence_month)
        return movement_service.get_summary(competence_month=competence_month)

    return router
