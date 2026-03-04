from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

from finance_app.domain.events import NewEvent


class BudgetServiceError(Exception):
    pass


class InvalidBudgetMonthError(BudgetServiceError):
    pass


class BudgetEventStore(Protocol):
    def create_schema(self) -> None: ...
    def append(self, event: NewEvent) -> int: ...


class BudgetProjector(Protocol):
    def run(self) -> int: ...
    def list_category_budgets(
        self,
        *,
        month: str,
    ) -> list[dict[str, str | int]]: ...


class BudgetService:
    def __init__(
        self,
        *,
        event_store: BudgetEventStore,
        projector: BudgetProjector,
    ) -> None:
        self._event_store = event_store
        self._projector = projector

    def list_budgets(self, *, month: str) -> list[dict[str, str | int]]:
        self._sync_projections()
        self._validate_month(month)
        return self._projector.list_category_budgets(month=month)

    def upsert_budget(
        self,
        *,
        category_id: str,
        month: str,
        limit: int,
    ) -> tuple[dict[str, str | int], bool]:
        self._sync_projections()
        self._validate_month(month)
        self._validate_payload(category_id=category_id, limit=limit)

        existing = self._find_budget(category_id=category_id, month=month)
        created = existing is None

        self._append_event(
            "BudgetUpdated",
            {
                "category_id": category_id,
                "month": month,
                "limit": limit,
            },
        )

        saved = self._find_budget(category_id=category_id, month=month)
        assert saved is not None
        return saved, created

    def _find_budget(
        self,
        *,
        category_id: str,
        month: str,
    ) -> dict[str, str | int] | None:
        for budget in self._projector.list_category_budgets(month=month):
            if budget["category_id"] == category_id:
                return budget

        return None

    def _append_event(
        self,
        event_type: str,
        payload: dict[str, str | int],
    ) -> None:
        self._event_store.create_schema()
        self._event_store.append(
            NewEvent(
                type=event_type,
                timestamp=self._utc_now(),
                payload=payload,
                version=1,
            )
        )
        self._projector.run()

    def _sync_projections(self) -> None:
        self._event_store.create_schema()
        self._projector.run()

    def _validate_month(self, month: str) -> None:
        try:
            datetime.strptime(month, "%Y-%m")
        except ValueError as exc:
            raise InvalidBudgetMonthError("month must use YYYY-MM format.") from exc

    def _validate_payload(self, *, category_id: str, limit: int) -> None:
        if not category_id.strip():
            raise BudgetServiceError("category_id is required.")
        if limit <= 0:
            raise BudgetServiceError("limit must be greater than zero.")

    def _utc_now(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
