from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

from finance_app.domain.events import NewEvent

PAYMENT_METHODS = ("PIX", "CASH", "OTHER", "CARD")
UNSET = object()


class RecurringServiceError(Exception):
    pass


class RecurringRuleAlreadyExistsError(RecurringServiceError):
    pass


class PendingNotFoundError(RecurringServiceError):
    pass


class PendingAlreadyConfirmedError(RecurringServiceError):
    pass


class RecurringRuleNotFoundError(RecurringServiceError):
    pass


class InvalidRecurringMonthError(RecurringServiceError):
    pass


class RecurringEventStore(Protocol):
    def create_schema(self) -> None: ...
    def append(self, event: NewEvent) -> int: ...
    def append_batch(self, events: list[NewEvent]) -> list[int]: ...


class RecurringProjector(Protocol):
    def run(self) -> int: ...
    def materialize_month_pendings(self, *, month: str) -> None: ...
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


class CardReader(Protocol):
    def get_card(self, card_id: str) -> dict[str, str | int | bool]: ...


class RecurringService:
    def __init__(
        self,
        *,
        event_store: RecurringEventStore,
        projector: RecurringProjector,
        account_reader: AccountReader,
        card_reader: CardReader,
    ) -> None:
        self._event_store = event_store
        self._projector = projector
        self._account_reader = account_reader
        self._card_reader = card_reader

    def create_rule(
        self,
        *,
        rule_id: str,
        name: str,
        amount: int,
        due_day: int,
        account_id: str | None,
        card_id: str | None,
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
            card_id=card_id,
            payment_method=payment_method,
            category_id=category_id,
        )

        normalized_account_id = self._normalize_optional_text(account_id)
        normalized_card_id = self._normalize_optional_text(card_id)
        self._validate_payment_target(
            account_id=normalized_account_id,
            card_id=normalized_card_id,
            payment_method=payment_method,
        )

        self._append_event(
            "RecurringRuleCreated",
            {
                "id": rule_id,
                "name": name,
                "amount": amount,
                "due_day": due_day,
                "account_id": normalized_account_id,
                "card_id": normalized_card_id,
                "payment_method": payment_method,
                "category_id": category_id,
                "description": description,
                "is_active": True,
            },
        )

        created = self._find_rule(rule_id)
        assert created is not None
        return created

    def list_rules(
        self,
        *,
        is_active: bool | None = None,
    ) -> list[dict[str, str | int | bool | None]]:
        self._sync_projections()
        return self._projector.list_recurring_rules(is_active=is_active)

    def update_rule(
        self,
        rule_id: str,
        *,
        name: str | None | object = UNSET,
        amount: int | None | object = UNSET,
        due_day: int | None | object = UNSET,
        account_id: str | None | object = UNSET,
        card_id: str | None | object = UNSET,
        payment_method: str | None | object = UNSET,
        category_id: str | None | object = UNSET,
        description: str | None | object = UNSET,
        is_active: bool | None | object = UNSET,
    ) -> dict[str, str | int | bool | None]:
        self._sync_projections()
        existing = self._find_rule(rule_id)
        if existing is None:
            raise RecurringRuleNotFoundError(f"Recurring rule '{rule_id}' was not found.")

        merged = {
            "id": rule_id,
            "name": name if name is not UNSET else str(existing["name"]),
            "amount": amount if amount is not UNSET else int(existing["amount"]),
            "due_day": due_day if due_day is not UNSET else int(existing["due_day"]),
            "account_id": (
                account_id if account_id is not UNSET else existing["account_id"]
            ),
            "card_id": card_id if card_id is not UNSET else existing.get("card_id"),
            "payment_method": (
                payment_method
                if payment_method is not UNSET
                else str(existing["payment_method"])
            ),
            "category_id": (
                category_id
                if category_id is not UNSET
                else str(existing["category_id"])
            ),
            "description": (
                description if description is not UNSET else existing["description"]
            ),
            "is_active": is_active if is_active is not UNSET else bool(existing["is_active"]),
        }

        self._validate_rule_payload(
            name=str(merged["name"]),
            amount=int(merged["amount"]),
            due_day=int(merged["due_day"]),
            account_id=merged["account_id"],
            card_id=merged["card_id"],
            payment_method=str(merged["payment_method"]),
            category_id=str(merged["category_id"]),
        )

        normalized_account_id = self._normalize_optional_text(merged["account_id"])
        normalized_card_id = self._normalize_optional_text(merged["card_id"])
        self._validate_payment_target(
            account_id=normalized_account_id,
            card_id=normalized_card_id,
            payment_method=str(merged["payment_method"]),
        )

        comparable = {
            "name": merged["name"],
            "amount": merged["amount"],
            "due_day": merged["due_day"],
            "account_id": normalized_account_id,
            "card_id": normalized_card_id,
            "payment_method": merged["payment_method"],
            "category_id": merged["category_id"],
            "description": merged["description"],
            "is_active": merged["is_active"],
        }
        existing_comparable = {
            "name": existing["name"],
            "amount": existing["amount"],
            "due_day": existing["due_day"],
            "account_id": existing["account_id"],
            "card_id": existing.get("card_id"),
            "payment_method": existing["payment_method"],
            "category_id": existing["category_id"],
            "description": existing["description"],
            "is_active": existing["is_active"],
        }
        if all(existing_comparable[key] == value for key, value in comparable.items()):
            return existing

        self._append_event(
            "RecurringRuleUpdated",
            {
                "id": rule_id,
                "name": str(merged["name"]),
                "amount": int(merged["amount"]),
                "due_day": int(merged["due_day"]),
                "account_id": normalized_account_id,
                "card_id": normalized_card_id,
                "payment_method": str(merged["payment_method"]),
                "category_id": str(merged["category_id"]),
                "description": self._normalize_optional_text(merged["description"]),
                "is_active": bool(merged["is_active"]),
            },
        )
        updated = self._find_rule(rule_id)
        assert updated is not None
        return updated

    def list_pendings(self, *, month: str) -> list[dict[str, str | int | None]]:
        self._sync_projections()
        self._validate_month(month)
        self._projector.materialize_month_pendings(month=month)
        return self._projector.list_pendings(month=month)

    def confirm_pending(self, pending_id: str) -> dict[str, str | int | None]:
        self._sync_projections()
        pending_month = self._month_from_pending_id(pending_id)
        if pending_month is not None:
            self._validate_month(pending_month)
            self._projector.materialize_month_pendings(month=pending_month)
        pending = self._projector.get_pending(pending_id)

        if pending is None:
            raise PendingNotFoundError(f"Pending '{pending_id}' was not found.")

        if str(pending["status"]) == "confirmed":
            raise PendingAlreadyConfirmedError(f"Pending '{pending_id}' was already confirmed.")

        payment_method = str(pending["payment_method"])
        account_id = self._normalize_optional_text(pending.get("account_id"))
        card_id = self._normalize_optional_text(pending.get("card_id"))
        self._validate_payment_target(
            account_id=account_id,
            card_id=card_id,
            payment_method=payment_method,
        )

        transaction_id = (
            f"{pending_id}:purchase" if payment_method == "CARD" else f"{pending_id}:expense"
        )
        occurred_at = self._due_date_to_timestamp(str(pending["due_date"]))

        timestamp = self._utc_now()
        transaction_event_type = (
            "CardPurchaseCreated" if payment_method == "CARD" else "ExpenseCreated"
        )
        transaction_payload: dict[str, str | int | None] = {
            "id": transaction_id,
            "amount": int(pending["amount"]),
            "category_id": str(pending["category_id"]),
            "description": pending["description"],
        }
        if payment_method == "CARD":
            transaction_payload.update(
                {
                    "purchase_date": occurred_at,
                    "installments_count": 1,
                    "card_id": card_id,
                    "person_id": None,
                }
            )
        else:
            transaction_payload.update(
                {
                    "occurred_at": occurred_at,
                    "type": "expense",
                    "account_id": account_id,
                    "payment_method": payment_method,
                    "person_id": None,
                    "status": "active",
                }
            )

        self._event_store.create_schema()
        self._event_store.append_batch(
            [
                NewEvent(
                    type="PendingConfirmed",
                    timestamp=timestamp,
                    payload={
                        "pending_id": pending_id,
                        "transaction_id": transaction_id,
                        "confirmed_at": timestamp,
                    },
                    version=1,
                ),
                NewEvent(
                    type=transaction_event_type,
                    timestamp=timestamp,
                    payload=transaction_payload,
                    version=1,
                ),
            ]
        )
        self._projector.run()

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
        account_id: str | None,
        card_id: str | None,
        payment_method: str,
        category_id: str,
    ) -> None:
        if not name.strip():
            raise RecurringServiceError("name is required.")
        if amount <= 0:
            raise RecurringServiceError("amount must be greater than zero.")
        if due_day < 1 or due_day > 28:
            raise RecurringServiceError("due_day must be between 1 and 28.")
        if payment_method not in PAYMENT_METHODS:
            raise RecurringServiceError(f"Unsupported payment method '{payment_method}'.")
        if not category_id.strip():
            raise RecurringServiceError("category_id is required.")
        normalized_account_id = self._normalize_optional_text(account_id)
        normalized_card_id = self._normalize_optional_text(card_id)
        if payment_method == "CARD":
            if normalized_card_id is None:
                raise RecurringServiceError("card_id is required when payment_method is CARD.")
            if normalized_account_id is not None:
                raise RecurringServiceError(
                    "account_id must be empty when payment_method is CARD."
                )
            return

        if normalized_account_id is None:
            raise RecurringServiceError("account_id is required for non-card recurring rules.")
        if normalized_card_id is not None:
            raise RecurringServiceError("card_id must be empty for non-card recurring rules.")

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

    @staticmethod
    def _month_from_pending_id(pending_id: str) -> str | None:
        parts = pending_id.split(":")
        if len(parts) < 2:
            return None
        return parts[-1]

    def _validate_payment_target(
        self,
        *,
        account_id: str | None,
        card_id: str | None,
        payment_method: str,
    ) -> None:
        if payment_method == "CARD":
            assert card_id is not None
            card = self._card_reader.get_card(card_id)
            if not bool(card["is_active"]):
                raise RecurringServiceError("card_id must reference an active card.")
            return

        assert account_id is not None
        account = self._account_reader.get_account(account_id)
        if not bool(account["is_active"]):
            raise RecurringServiceError("account_id must reference an active account.")

    @staticmethod
    def _normalize_optional_text(value: object | None) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    def _utc_now(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
