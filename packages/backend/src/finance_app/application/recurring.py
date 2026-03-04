from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

from finance_app.domain.events import NewEvent

PAYMENT_METHODS = ("PIX", "CASH", "OTHER")


class RecurringServiceError(Exception):
    pass


class RecurringRuleAlreadyExistsError(RecurringServiceError):
    pass


class PendingNotFoundError(RecurringServiceError):
    pass


class PendingAlreadyConfirmedError(RecurringServiceError):
    pass


class InvalidRecurringMonthError(RecurringServiceError):
    pass


class RecurringEventStore(Protocol):
    def create_schema(self) -> None: ...
    def append(self, event: NewEvent) -> int: ...


class RecurringProjector(Protocol):
    def run(self) -> int: ...
    def list_recurring_rules(
        self,
        *,
        is_active: bool | None = None,
    ) -> list[dict[str, str | int | bool | None]]: ...
    def list_pendings(
        self,
        *,
        month: str,
    ) -> list[dict[str, str | int | None]]: ...
    def get_pending(self, pending_id: str) -> dict[str, str | int | None] | None: ...


class AccountReader(Protocol):
    def get_account(self, account_id: str) -> dict[str, str | int | bool]: ...


class RecurringService:
    def __init__(
        self,
        *,
        event_store: RecurringEventStore,
        projector: RecurringProjector,
        account_reader: AccountReader,
    ) -> None:
        self._event_store = event_store
        self._projector = projector
        self._account_reader = account_reader

    def create_rule(
        self,
        *,
        rule_id: str,
        name: str,
        amount: int,
        due_day: int,
        account_id: str,
        payment_method: str,
        category_id: str,
        description: str | None = None,
    ) -> dict[str, str | int | bool | None]:
        self._sync_projections()
        if self._find_rule(rule_id) is not None:
            raise RecurringRuleAlreadyExistsError(
                f"Recurring rule '{rule_id}' already exists."
            )

        self._validate_rule_payload(
            name=name,
            amount=amount,
            due_day=due_day,
            account_id=account_id,
            payment_method=payment_method,
            category_id=category_id,
        )

        account = self._account_reader.get_account(account_id)
        if not bool(account["is_active"]):
            raise RecurringServiceError("account_id must reference an active account.")

        self._append_event(
            "RecurringRuleCreated",
            {
                "id": rule_id,
                "name": name,
                "amount": amount,
                "due_day": due_day,
                "account_id": account_id,
                "payment_method": payment_method,
                "category_id": category_id,
                "description": description,
                "is_active": True,
            },
        )

        created = self._find_rule(rule_id)
        assert created is not None
        return created

    def list_pendings(self, *, month: str) -> list[dict[str, str | int | None]]:
        self._sync_projections()
        self._validate_month(month)
        return self._projector.list_pendings(month=month)

    def confirm_pending(self, pending_id: str) -> dict[str, str | int | None]:
        self._sync_projections()
        pending = self._projector.get_pending(pending_id)

        if pending is None:
            raise PendingNotFoundError(f"Pending '{pending_id}' was not found.")

        if str(pending["status"]) == "confirmed":
            raise PendingAlreadyConfirmedError(f"Pending '{pending_id}' was already confirmed.")

        account_id = str(pending["account_id"])
        account = self._account_reader.get_account(account_id)
        if not bool(account["is_active"]):
            raise RecurringServiceError("account_id must reference an active account.")

        transaction_id = f"{pending_id}:expense"
        occurred_at = self._due_date_to_timestamp(str(pending["due_date"]))

        self._append_event(
            "PendingConfirmed",
            {
                "pending_id": pending_id,
                "transaction_id": transaction_id,
                "confirmed_at": self._utc_now(),
            },
        )
        self._append_event(
            "ExpenseCreated",
            {
                "id": transaction_id,
                "occurred_at": occurred_at,
                "type": "expense",
                "amount": int(pending["amount"]),
                "account_id": account_id,
                "payment_method": str(pending["payment_method"]),
                "category_id": str(pending["category_id"]),
                "description": pending["description"],
                "person_id": None,
                "status": "active",
            },
        )

        confirmed = self._projector.get_pending(pending_id)
        assert confirmed is not None
        return confirmed

    def _sync_projections(self) -> None:
        self._event_store.create_schema()
        self._projector.run()

    def _append_event(
        self,
        event_type: str,
        payload: dict[str, str | int | bool | None],
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

    def _find_rule(self, rule_id: str) -> dict[str, str | int | bool | None] | None:
        for rule in self._projector.list_recurring_rules():
            if rule["rule_id"] == rule_id:
                return rule
        return None

    def _validate_rule_payload(
        self,
        *,
        name: str,
        amount: int,
        due_day: int,
        account_id: str,
        payment_method: str,
        category_id: str,
    ) -> None:
        if not name.strip():
            raise RecurringServiceError("name is required.")
        if amount <= 0:
            raise RecurringServiceError("amount must be greater than zero.")
        if due_day < 1 or due_day > 28:
            raise RecurringServiceError("due_day must be between 1 and 28.")
        if not account_id.strip():
            raise RecurringServiceError("account_id is required.")
        if payment_method not in PAYMENT_METHODS:
            raise RecurringServiceError(f"Unsupported payment method '{payment_method}'.")
        if not category_id.strip():
            raise RecurringServiceError("category_id is required.")

    def _validate_month(self, month: str) -> None:
        try:
            datetime.strptime(month, "%Y-%m")
        except ValueError as exc:
            raise InvalidRecurringMonthError("month must use YYYY-MM format.") from exc

    def _due_date_to_timestamp(self, due_date: str) -> str:
        try:
            datetime.strptime(due_date, "%Y-%m-%d")
        except ValueError as exc:
            raise RecurringServiceError("Pending due_date must use YYYY-MM-DD format.") from exc

        return f"{due_date}T00:00:00Z"

    def _utc_now(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
