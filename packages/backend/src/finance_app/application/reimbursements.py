from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

from finance_app.domain.cards import parse_utc_timestamp
from finance_app.domain.events import NewEvent


class ReimbursementServiceError(Exception):
    pass


class ReimbursementNotFoundError(ReimbursementServiceError):
    pass


class ReimbursementAlreadyReceivedError(ReimbursementServiceError):
    pass


class InvalidReimbursementDateError(ReimbursementServiceError):
    pass


class ReimbursementEventStore(Protocol):
    def create_schema(self) -> None: ...
    def append(self, event: NewEvent) -> int: ...
    def append_batch(self, events: list[NewEvent]) -> list[int]: ...


class ReimbursementProjector(Protocol):
    def run(self) -> int: ...
    def list_reimbursements(
        self,
        *,
        status: str | None = None,
        person_id: str | None = None,
    ) -> list[dict[str, str | int | None]]: ...
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


class ReimbursementService:
    def __init__(
        self,
        *,
        event_store: ReimbursementEventStore,
        projector: ReimbursementProjector,
        account_reader: AccountReader,
    ) -> None:
        self._event_store = event_store
        self._projector = projector
        self._account_reader = account_reader

    def mark_received(
        self,
        transaction_id: str,
        *,
        received_at: str,
        account_id: str | None = None,
    ) -> dict[str, str | int | None]:
        self._sync_projections()
        reimbursement = self._find_reimbursement(transaction_id)
        if reimbursement is None:
            raise ReimbursementNotFoundError(
                f"Reimbursement for transaction '{transaction_id}' was not found."
            )
        if reimbursement["status"] == "received":
            raise ReimbursementAlreadyReceivedError(
                f"Reimbursement for transaction '{transaction_id}' was already received."
            )

        self._validate_received_at(received_at)
        destination_account_id = account_id or str(reimbursement["account_id"])
        self._account_reader.get_account(destination_account_id)

        receipt_transaction_id = f"{transaction_id}:reimbursement-receipt"
        if self._find_transaction(receipt_transaction_id) is not None:
            raise ReimbursementAlreadyReceivedError(
                f"Reimbursement for transaction '{transaction_id}' was already received."
            )

        amount = int(reimbursement["amount"])
        person_id = str(reimbursement["person_id"])

        timestamp = self._utc_now()
        self._event_store.create_schema()
        self._event_store.append_batch(
            [
                NewEvent(
                    type="ReimbursementReceived",
                    timestamp=timestamp,
                    payload={
                        "transaction_id": transaction_id,
                        "person_id": person_id,
                        "amount": amount,
                        "account_id": destination_account_id,
                        "received_at": received_at,
                        "receipt_transaction_id": receipt_transaction_id,
                    },
                    version=1,
                ),
                NewEvent(
                    type="IncomeCreated",
                    timestamp=timestamp,
                    payload={
                        "id": receipt_transaction_id,
                        "occurred_at": received_at,
                        "type": "income",
                        "amount": amount,
                        "account_id": destination_account_id,
                        "payment_method": "PIX",
                        "category_id": "reimbursement",
                        "description": f"Reembolso recebido de {person_id}",
                        "person_id": person_id,
                        "status": "active",
                    },
                    version=1,
                ),
            ]
        )
        self._projector.run()

        updated = self._find_reimbursement(transaction_id)
        assert updated is not None
        return updated

    def _validate_received_at(self, received_at: str) -> None:
        try:
            parse_utc_timestamp(received_at)
        except ValueError as exc:
            raise InvalidReimbursementDateError(
                "received_at must be a UTC ISO 8601 timestamp."
            ) from exc

    def _find_reimbursement(
        self,
        transaction_id: str,
    ) -> dict[str, str | int | None] | None:
        for reimbursement in self._projector.list_reimbursements():
            if reimbursement["transaction_id"] == transaction_id:
                return reimbursement
        return None

    def _find_transaction(
        self,
        transaction_id: str,
    ) -> dict[str, str | int | None] | None:
        for transaction in self._projector.list_transactions():
            if transaction["transaction_id"] == transaction_id:
                return transaction
        return None

    def _sync_projections(self) -> None:
        self._event_store.create_schema()
        self._projector.run()

    def _utc_now(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
