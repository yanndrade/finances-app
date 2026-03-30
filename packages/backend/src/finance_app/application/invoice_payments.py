from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

from finance_app.domain.cards import parse_utc_timestamp
from finance_app.domain.events import NewEvent, StoredEvent


class InvoicePaymentServiceError(Exception):
    pass


class InvoiceNotFoundError(InvoicePaymentServiceError):
    pass


class InvoicePaymentNotFoundError(InvoicePaymentServiceError):
    pass


class InvoicePaymentAlreadyExistsError(InvoicePaymentServiceError):
    pass


class InvoicePaymentEventStore(Protocol):
    def create_schema(self) -> None: ...
    def append(self, event: NewEvent) -> int: ...
    def list_events_after(self, event_id: int) -> list[StoredEvent]: ...


class InvoicePaymentProjector(Protocol):
    def run(self) -> int: ...
    def list_invoices(
        self,
        *,
        card_id: str | None = None,
    ) -> list[dict[str, str | int]]: ...
    def get_invoice_payment(
        self,
        payment_id: str,
    ) -> dict[str, str | int] | None: ...
    def list_invoice_payments(
        self,
        *,
        invoice_id: str,
    ) -> list[dict[str, str | int]]: ...


class AccountReader(Protocol):
    def get_account(self, account_id: str) -> dict[str, str | int | bool]: ...


class InvoicePaymentService:
    def __init__(
        self,
        *,
        event_store: InvoicePaymentEventStore,
        projector: InvoicePaymentProjector,
        account_reader: AccountReader,
    ) -> None:
        self._event_store = event_store
        self._projector = projector
        self._account_reader = account_reader

    def create_payment(
        self,
        *,
        payment_id: str,
        invoice_id: str,
        amount: int,
        account_id: str,
        paid_at: str,
    ) -> dict[str, str | int]:
        self._sync_projections()
        if self._payment_exists(payment_id):
            raise InvoicePaymentAlreadyExistsError(
                f"Invoice payment '{payment_id}' already exists."
            )

        invoice = self._find_invoice(invoice_id)
        if invoice is None:
            raise InvoiceNotFoundError(f"Invoice '{invoice_id}' was not found.")

        account = self._account_reader.get_account(account_id)
        self._validate_payload(
            amount=amount,
            account_id=account_id,
            paid_at=paid_at,
            invoice=invoice,
            account=account,
        )

        self._append_event(
            "InvoicePaid",
            {
                "id": payment_id,
                "invoice_id": invoice_id,
                "card_id": str(invoice["card_id"]),
                "amount": amount,
                "account_id": account_id,
                "paid_at": paid_at,
            },
        )
        return self.get_invoice(invoice_id)

    def get_invoice(self, invoice_id: str) -> dict[str, str | int]:
        self._sync_projections()
        invoice = self._find_invoice(invoice_id)
        if invoice is None:
            raise InvoiceNotFoundError(f"Invoice '{invoice_id}' was not found.")
        return invoice

    def list_payments(self, invoice_id: str) -> list[dict[str, str | int]]:
        self._sync_projections()
        invoice = self._find_invoice(invoice_id)
        if invoice is None:
            raise InvoiceNotFoundError(f"Invoice '{invoice_id}' was not found.")
        return self._projector.list_invoice_payments(invoice_id=invoice_id)

    def update_payment(
        self,
        *,
        payment_id: str,
        account_id: str,
    ) -> dict[str, str | int]:
        self._sync_projections()
        payment = self._projector.get_invoice_payment(payment_id)
        if payment is None:
            raise InvoicePaymentNotFoundError(
                f"Invoice payment '{payment_id}' was not found."
            )

        account = self._account_reader.get_account(account_id)
        self._validate_account(account_id=account_id, account=account)

        current_account_id = str(payment["account_id"])
        if current_account_id == account_id:
            return payment

        self._append_event(
            "InvoicePaymentUpdated",
            {
                "id": payment_id,
                "account_id": account_id,
            },
        )

        updated_payment = self._projector.get_invoice_payment(payment_id)
        if updated_payment is None:
            raise InvoicePaymentNotFoundError(
                f"Invoice payment '{payment_id}' was not found."
            )
        return updated_payment

    def _validate_payload(
        self,
        *,
        amount: int,
        account_id: str,
        paid_at: str,
        invoice: dict[str, str | int],
        account: dict[str, str | int | bool],
    ) -> None:
        if amount <= 0:
            raise InvoicePaymentServiceError("amount must be greater than zero.")
        if not account_id.strip():
            raise InvoicePaymentServiceError("account_id is required.")
        try:
            parse_utc_timestamp(paid_at)
        except ValueError as exc:
            raise InvoicePaymentServiceError(
                "paid_at must be a UTC ISO 8601 timestamp."
            ) from exc

        self._validate_account(account_id=account_id, account=account)

        remaining_amount = int(invoice["remaining_amount"])
        if remaining_amount <= 0:
            raise InvoicePaymentServiceError("Invoice is already paid.")

    def _validate_account(
        self,
        *,
        account_id: str,
        account: dict[str, str | int | bool],
    ) -> None:
        if not account_id.strip():
            raise InvoicePaymentServiceError("account_id is required.")
        if not bool(account["is_active"]):
            raise InvoicePaymentServiceError(
                "account_id must reference an active account."
            )

    def _payment_exists(self, payment_id: str) -> bool:
        for event in self._event_store.list_events_after(0):
            if event.type != "InvoicePaid":
                continue
            if str(event.payload.get("id")) == payment_id:
                return True
        return False

    def _find_invoice(self, invoice_id: str) -> dict[str, str | int] | None:
        for invoice in self._projector.list_invoices():
            if invoice["invoice_id"] == invoice_id:
                return invoice
        return None

    def _append_event(self, event_type: str, payload: dict[str, str | int]) -> None:
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

    def _utc_now(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
