"""Application service for the unified movement ledger."""

from __future__ import annotations

from typing import Protocol


class MovementProjector(Protocol):
    def run(self) -> int: ...

    def list_unified_movements(
        self,
        *,
        competence_month: str | None = None,
        kind: str | None = None,
        origin_type: str | None = None,
        lifecycle_status: str | None = None,
        account_id: str | None = None,
        card_id: str | None = None,
        category_id: str | None = None,
        payment_method: str | None = None,
        counterparty: str | None = None,
        text: str | None = None,
        scope: str | None = None,
        needs_review: bool | None = None,
        sort_by: str = "posted_at",
        sort_dir: str = "desc",
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, object]: ...

    def get_movements_summary(
        self,
        *,
        competence_month: str,
    ) -> dict[str, object]: ...


class MovementService:
    def __init__(self, *, projector: MovementProjector) -> None:
        self._projector = projector

    def list_movements(
        self,
        *,
        competence_month: str | None = None,
        kind: str | None = None,
        origin_type: str | None = None,
        lifecycle_status: str | None = None,
        account_id: str | None = None,
        card_id: str | None = None,
        category_id: str | None = None,
        payment_method: str | None = None,
        counterparty: str | None = None,
        text: str | None = None,
        scope: str | None = None,
        needs_review: bool | None = None,
        sort_by: str = "posted_at",
        sort_dir: str = "desc",
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, object]:
        self._sync_projections()
        return self._projector.list_unified_movements(
            competence_month=competence_month,
            kind=kind,
            origin_type=origin_type,
            lifecycle_status=lifecycle_status,
            account_id=account_id,
            card_id=card_id,
            category_id=category_id,
            payment_method=payment_method,
            counterparty=counterparty,
            text=text,
            scope=scope,
            needs_review=needs_review,
            sort_by=sort_by,
            sort_dir=sort_dir,
            page=page,
            page_size=page_size,
        )

    def get_summary(
        self,
        *,
        competence_month: str,
    ) -> dict[str, object]:
        self._sync_projections()
        return self._projector.get_movements_summary(
            competence_month=competence_month,
        )

    def _sync_projections(self) -> None:
        self._projector.run()
