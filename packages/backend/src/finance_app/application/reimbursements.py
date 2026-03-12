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


class ReimbursementAlreadyCanceledError(ReimbursementServiceError):
    pass


class InvalidReimbursementDateError(ReimbursementServiceError):
    pass


class InvalidPartialAmountError(ReimbursementServiceError):
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
        month: str | None = None,
    ) -> list[dict[str, str | int | None]]: ...
    def reimbursement_summary(
        self,
        *,
        month: str | None = None,
    ) -> dict[str, int]: ...
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

    # ------------------------------------------------------------------
    # Mark received (full or partial payment)
    # ------------------------------------------------------------------

    def mark_received(
        self,
        transaction_id: str,
        *,
        received_at: str,
        account_id: str | None = None,
        amount: int | None = None,
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
        if reimbursement["status"] == "canceled":
            raise ReimbursementAlreadyCanceledError(
                f"Reimbursement for transaction '{transaction_id}' was canceled."
            )

        self._validate_received_at(received_at)
        destination_account_id = account_id or str(reimbursement["account_id"])
        self._account_reader.get_account(destination_account_id)

        total_amount = int(reimbursement["amount"])  # type: ignore[arg-type]
        already_received = int(reimbursement.get("amount_received") or 0)  # type: ignore[arg-type]
        outstanding = total_amount - already_received

        # Determine payment amount
        if amount is not None:
            if amount <= 0:
                raise InvalidPartialAmountError("amount must be greater than zero.")
            if amount > outstanding:
                raise InvalidPartialAmountError(
                    f"amount ({amount}) exceeds outstanding balance ({outstanding})."
                )
            payment_amount = amount
        else:
            payment_amount = outstanding

        person_id = str(reimbursement["person_id"])
        is_full_payment = (already_received + payment_amount) >= total_amount

        # Unique receipt transaction ID per payment
        # Use already_received as a stable sequencing key
        if already_received == 0 and is_full_payment:
            receipt_transaction_id = f"{transaction_id}:reimbursement-receipt"
        else:
            # Encode the cumulative total after this payment for uniqueness
            new_total = already_received + payment_amount
            receipt_transaction_id = (
                f"{transaction_id}:reimbursement-receipt-{new_total}"
            )

        if self._find_transaction(receipt_transaction_id) is not None:
            raise ReimbursementAlreadyReceivedError(
                f"Reimbursement receipt '{receipt_transaction_id}' already exists."
            )

        timestamp = self._utc_now()
        self._event_store.create_schema()
        self._event_store.append_batch(
            [
                NewEvent(
                    type="ReimbursementPaymentReceived",
                    timestamp=timestamp,
                    payload={
                        "transaction_id": transaction_id,
                        "person_id": person_id,
                        "payment_amount": payment_amount,
                        "total_amount": total_amount,
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
                        "amount": payment_amount,
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

    # ------------------------------------------------------------------
    # Update expected_at / notes
    # ------------------------------------------------------------------

    def update_reimbursement(
        self,
        transaction_id: str,
        *,
        expected_at: str | None = None,
        notes: str | None = None,
    ) -> dict[str, str | int | None]:
        self._sync_projections()
        reimbursement = self._find_reimbursement(transaction_id)
        if reimbursement is None:
            raise ReimbursementNotFoundError(
                f"Reimbursement for transaction '{transaction_id}' was not found."
            )
        if reimbursement["status"] == "canceled":
            raise ReimbursementAlreadyCanceledError(
                f"Reimbursement for transaction '{transaction_id}' was canceled."
            )

        if expected_at is not None:
            self._validate_date_only(expected_at)

        payload: dict[str, str | None] = {"transaction_id": transaction_id}
        if expected_at is not None:
            payload["expected_at"] = expected_at
        if notes is not None:
            payload["notes"] = notes

        timestamp = self._utc_now()
        self._event_store.create_schema()
        self._event_store.append(
            NewEvent(
                type="ReimbursementUpdated",
                timestamp=timestamp,
                payload=payload,
                version=1,
            )
        )
        self._projector.run()

        updated = self._find_reimbursement(transaction_id)
        assert updated is not None
        return updated

    # ------------------------------------------------------------------
    # Cancel
    # ------------------------------------------------------------------

    def cancel_reimbursement(
        self,
        transaction_id: str,
    ) -> dict[str, str | int | None]:
        self._sync_projections()
        reimbursement = self._find_reimbursement(transaction_id)
        if reimbursement is None:
            raise ReimbursementNotFoundError(
                f"Reimbursement for transaction '{transaction_id}' was not found."
            )
        if reimbursement["status"] == "received":
            raise ReimbursementAlreadyReceivedError(
                f"Reimbursement for transaction '{transaction_id}' is already fully received."
            )
        if reimbursement["status"] == "canceled":
            raise ReimbursementAlreadyCanceledError(
                f"Reimbursement for transaction '{transaction_id}' is already canceled."
            )

        timestamp = self._utc_now()
        self._event_store.create_schema()
        self._event_store.append(
            NewEvent(
                type="ReimbursementCanceled",
                timestamp=timestamp,
                payload={"transaction_id": transaction_id},
                version=1,
            )
        )
        self._projector.run()

        updated = self._find_reimbursement(transaction_id)
        assert updated is not None
        return updated

    # ------------------------------------------------------------------
    # Query helpers
    # ------------------------------------------------------------------

    def list_reimbursements(
        self,
        *,
        status: str | None = None,
        person_id: str | None = None,
        month: str | None = None,
    ) -> list[dict[str, str | int | None]]:
        self._sync_projections()
        return self._projector.list_reimbursements(
            status=status,
            person_id=person_id,
            month=month,
        )

    def get_summary(
        self,
        *,
        month: str | None = None,
    ) -> dict[str, int]:
        self._sync_projections()
        return self._projector.reimbursement_summary(month=month)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _validate_received_at(self, received_at: str) -> None:
        try:
            parse_utc_timestamp(received_at)
        except ValueError as exc:
            raise InvalidReimbursementDateError(
                "received_at must be a UTC ISO 8601 timestamp."
            ) from exc

    def _validate_date_only(self, date_str: str) -> None:
        import re

        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_str):
            raise InvalidReimbursementDateError(
                "expected_at must be a date in YYYY-MM-DD format."
            )

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
