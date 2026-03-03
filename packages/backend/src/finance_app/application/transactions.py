from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

from finance_app.domain.events import NewEvent

PAYMENT_METHODS = ("PIX", "CASH", "OTHER")
TRANSACTION_TYPES = ("income", "expense")
TRANSACTION_STATUSES = ("active", "voided")
UNSET = object()


class TransactionServiceError(Exception):
    pass


class TransactionNotFoundError(TransactionServiceError):
    pass


class TransactionAlreadyExistsError(TransactionServiceError):
    pass


class InvalidTransactionDateError(TransactionServiceError):
    pass


class InvalidPaymentMethodError(TransactionServiceError):
    pass


class InvalidTransactionTypeError(TransactionServiceError):
    pass


class InvalidTransactionStatusError(TransactionServiceError):
    pass


class InvalidTransactionAmountError(TransactionServiceError):
    pass


class TransactionEventStore(Protocol):
    def create_schema(self) -> None: ...
    def append(self, event: NewEvent) -> int: ...


class TransactionProjector(Protocol):
    def run(self) -> int: ...
    def list_transactions(
        self,
        *,
        occurred_from: str | None = None,
        occurred_to: str | None = None,
        category_id: str | None = None,
        account_id: str | None = None,
        payment_method: str | None = None,
        person_id: str | None = None,
        text: str | None = None,
    ) -> list[dict[str, str | int | None]]: ...


class AccountReader(Protocol):
    def get_account(self, account_id: str) -> dict[str, str | int | bool]: ...


class TransactionService:
    def __init__(
        self,
        event_store: TransactionEventStore,
        projector: TransactionProjector,
        account_reader: AccountReader,
    ) -> None:
        self._event_store = event_store
        self._projector = projector
        self._account_reader = account_reader

    def list_transactions(
        self,
        *,
        occurred_from: str | None = None,
        occurred_to: str | None = None,
        category_id: str | None = None,
        account_id: str | None = None,
        payment_method: str | None = None,
        person_id: str | None = None,
        text: str | None = None,
    ) -> list[dict[str, str | int | None]]:
        self._sync_projections()

        if occurred_from is not None:
            self._validate_utc_timestamp(occurred_from)
        if occurred_to is not None:
            self._validate_utc_timestamp(occurred_to)
        if payment_method is not None:
            self._validate_payment_method(payment_method)

        return self._projector.list_transactions(
            occurred_from=occurred_from,
            occurred_to=occurred_to,
            category_id=category_id,
            account_id=account_id,
            payment_method=payment_method,
            person_id=person_id,
            text=text,
        )

    def create_income(
        self,
        *,
        transaction_id: str,
        occurred_at: str,
        amount: int,
        account_id: str,
        payment_method: str,
        category_id: str,
        description: str | None = None,
        person_id: str | None = None,
    ) -> dict[str, str | int | None]:
        return self._create_transaction(
            event_type="IncomeCreated",
            transaction_type="income",
            transaction_id=transaction_id,
            occurred_at=occurred_at,
            amount=amount,
            account_id=account_id,
            payment_method=payment_method,
            category_id=category_id,
            description=description,
            person_id=person_id,
        )

    def create_expense(
        self,
        *,
        transaction_id: str,
        occurred_at: str,
        amount: int,
        account_id: str,
        payment_method: str,
        category_id: str,
        description: str | None = None,
        person_id: str | None = None,
    ) -> dict[str, str | int | None]:
        return self._create_transaction(
            event_type="ExpenseCreated",
            transaction_type="expense",
            transaction_id=transaction_id,
            occurred_at=occurred_at,
            amount=amount,
            account_id=account_id,
            payment_method=payment_method,
            category_id=category_id,
            description=description,
            person_id=person_id,
        )

    def update_transaction(
        self,
        transaction_id: str,
        *,
        occurred_at: str | None | object = UNSET,
        transaction_type: str | None | object = UNSET,
        amount: int | None | object = UNSET,
        account_id: str | None | object = UNSET,
        payment_method: str | None | object = UNSET,
        category_id: str | None | object = UNSET,
        description: str | None | object = UNSET,
        person_id: str | None | object = UNSET,
    ) -> dict[str, str | int | None]:
        self._sync_projections()
        existing = self._find_transaction(transaction_id)

        if existing is None:
            raise TransactionNotFoundError(
                f"Transaction '{transaction_id}' was not found."
            )

        merged = {
            "id": transaction_id,
            "occurred_at": (
                occurred_at if occurred_at is not UNSET else str(existing["occurred_at"])
            ),
            "type": (
                transaction_type
                if transaction_type is not UNSET
                else str(existing["type"])
            ),
            "amount": amount if amount is not UNSET else int(existing["amount"]),
            "account_id": (
                account_id if account_id is not UNSET else str(existing["account_id"])
            ),
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
                description
                if description is not UNSET
                else existing["description"]
            ),
            "person_id": person_id if person_id is not UNSET else existing["person_id"],
            "status": str(existing["status"]),
        }

        self._validate_transaction_payload(merged)
        self._account_reader.get_account(str(merged["account_id"]))

        comparable = {
            "occurred_at": merged["occurred_at"],
            "type": merged["type"],
            "amount": merged["amount"],
            "account_id": merged["account_id"],
            "payment_method": merged["payment_method"],
            "category_id": merged["category_id"],
            "description": merged["description"],
            "person_id": merged["person_id"],
            "status": merged["status"],
        }
        if all(existing[key] == value for key, value in comparable.items()):
            return self.get_transaction(transaction_id)

        self._append_event("TransactionUpdated", merged)
        return self.get_transaction(transaction_id)

    def void_transaction(
        self,
        transaction_id: str,
        *,
        reason: str | None = None,
    ) -> dict[str, str | int | None]:
        self._sync_projections()
        existing = self._find_transaction(transaction_id)

        if existing is None:
            raise TransactionNotFoundError(
                f"Transaction '{transaction_id}' was not found."
            )

        if existing["status"] == "voided":
            return dict(existing)

        self._append_event(
            "TransactionVoided",
            {
                "id": transaction_id,
                "reason": reason,
            },
        )
        return self.get_transaction(transaction_id)

    def get_transaction(self, transaction_id: str) -> dict[str, str | int | None]:
        self._sync_projections()
        transaction = self._find_transaction(transaction_id)

        if transaction is None:
            raise TransactionNotFoundError(
                f"Transaction '{transaction_id}' was not found."
            )

        return transaction

    def _create_transaction(
        self,
        *,
        event_type: str,
        transaction_type: str,
        transaction_id: str,
        occurred_at: str,
        amount: int,
        account_id: str,
        payment_method: str,
        category_id: str,
        description: str | None,
        person_id: str | None,
    ) -> dict[str, str | int | None]:
        self._sync_projections()
        if self._find_transaction(transaction_id) is not None:
            raise TransactionAlreadyExistsError(
                f"Transaction '{transaction_id}' already exists."
            )

        payload = {
            "id": transaction_id,
            "occurred_at": occurred_at,
            "type": transaction_type,
            "amount": amount,
            "account_id": account_id,
            "payment_method": payment_method,
            "category_id": category_id,
            "description": description,
            "person_id": person_id,
            "status": "active",
        }

        self._validate_transaction_payload(payload)
        self._account_reader.get_account(account_id)

        self._append_event(event_type, payload)
        return self.get_transaction(transaction_id)

    def _append_event(
        self,
        event_type: str,
        payload: dict[str, str | int | None],
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

    def _find_transaction(
        self,
        transaction_id: str,
    ) -> dict[str, str | int | None] | None:
        for transaction in self._projector.list_transactions():
            if transaction["transaction_id"] == transaction_id:
                return transaction

        return None

    def _validate_transaction_payload(
        self,
        payload: dict[str, str | int | None],
    ) -> None:
        self._validate_utc_timestamp(str(payload["occurred_at"]))
        self._validate_transaction_type(str(payload["type"]))
        self._validate_amount(int(payload["amount"]))
        self._validate_payment_method(str(payload["payment_method"]))
        self._validate_required_text(str(payload["account_id"]), "account_id")
        self._validate_required_text(str(payload["category_id"]), "category_id")
        self._validate_transaction_status(str(payload["status"]))

    def _validate_utc_timestamp(self, value: str) -> None:
        if not value.endswith("Z"):
            raise InvalidTransactionDateError(
                "occurred_at must be a UTC ISO 8601 timestamp."
            )

        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise InvalidTransactionDateError(
                "occurred_at must be a UTC ISO 8601 timestamp."
            ) from exc

        if parsed.tzinfo is None or parsed.utcoffset() != timezone.utc.utcoffset(parsed):
            raise InvalidTransactionDateError(
                "occurred_at must be a UTC ISO 8601 timestamp."
            )

    def _validate_transaction_type(self, value: str) -> None:
        if value not in TRANSACTION_TYPES:
            raise InvalidTransactionTypeError(f"Unsupported transaction type '{value}'.")

    def _validate_amount(self, value: int) -> None:
        if value <= 0:
            raise InvalidTransactionAmountError("amount must be greater than zero.")

    def _validate_payment_method(self, value: str) -> None:
        if value not in PAYMENT_METHODS:
            raise InvalidPaymentMethodError(f"Unsupported payment method '{value}'.")

    def _validate_required_text(self, value: str, field_name: str) -> None:
        if not value.strip():
            raise TransactionServiceError(f"{field_name} is required.")

    def _validate_transaction_status(self, value: str) -> None:
        if value not in TRANSACTION_STATUSES:
            raise InvalidTransactionStatusError(f"Unsupported transaction status '{value}'.")

    def _utc_now(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
