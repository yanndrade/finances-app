from __future__ import annotations

from finance_app.application.transactions import (
    AccountReader,
    TransactionAlreadyExistsError,
    TransactionEventStore,
    TransactionProjector,
    TransactionService,
    TransactionServiceError,
)
from finance_app.domain.events import NewEvent


class InvalidTransferAccountsError(TransactionServiceError):
    pass


class TransferService:
    def __init__(
        self,
        event_store: TransactionEventStore,
        projector: TransactionProjector,
        account_reader: AccountReader,
    ) -> None:
        self._event_store = event_store
        self._projector = projector
        self._account_reader = account_reader
        self._transaction_service = TransactionService(
            event_store=event_store,
            projector=projector,
            account_reader=account_reader,
        )

    def create_transfer(
        self,
        *,
        transfer_id: str,
        occurred_at: str,
        from_account_id: str,
        to_account_id: str,
        amount: int,
        description: str | None = None,
    ) -> list[dict[str, str | int | None]]:
        self._sync_projections()

        if self._find_transfer(transfer_id):
            raise TransactionAlreadyExistsError(
                f"Transaction '{transfer_id}' already exists."
            )
        self._ensure_transfer_ids_are_available(transfer_id)

        if from_account_id == to_account_id:
            raise InvalidTransferAccountsError(
                "from_account_id and to_account_id must be different."
            )

        self._transaction_service._validate_utc_timestamp(occurred_at)
        self._transaction_service._validate_amount(amount)
        self._transaction_service._validate_required_text(from_account_id, "from_account_id")
        self._transaction_service._validate_required_text(to_account_id, "to_account_id")
        self._account_reader.get_account(from_account_id)
        self._account_reader.get_account(to_account_id)

        self._event_store.create_schema()
        self._event_store.append(
            NewEvent(
                type="TransferCreated",
                timestamp=self._transaction_service._utc_now(),
                payload={
                    "id": transfer_id,
                    "occurred_at": occurred_at,
                    "from_account_id": from_account_id,
                    "to_account_id": to_account_id,
                    "amount": amount,
                    "description": description,
                },
                version=1,
            )
        )
        self._projector.run()
        return self._find_transfer(transfer_id)

    def _find_transfer(self, transfer_id: str) -> list[dict[str, str | int | None]]:
        return [
            row
            for row in self._projector.list_transactions()
            if row.get("transfer_id") == transfer_id
        ]

    def _ensure_transfer_ids_are_available(self, transfer_id: str) -> None:
        conflicting_ids = {
            transfer_id,
            f"{transfer_id}:debit",
            f"{transfer_id}:credit",
        }
        for row in self._projector.list_transactions():
            if str(row["transaction_id"]) in conflicting_ids:
                raise TransactionAlreadyExistsError(
                    f"Transaction '{str(row['transaction_id'])}' already exists."
                )

    def _sync_projections(self) -> None:
        self._event_store.create_schema()
        self._projector.run()
