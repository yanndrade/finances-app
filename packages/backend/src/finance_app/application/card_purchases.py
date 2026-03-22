from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

from finance_app.domain.cards import parse_utc_timestamp
from finance_app.domain.events import NewEvent

_UNSET = object()


class CardPurchaseServiceError(Exception):
    pass


class CardPurchaseAlreadyExistsError(CardPurchaseServiceError):
    pass


class CardPurchaseNotFoundError(CardPurchaseServiceError):
    pass


class InvoiceNotFoundError(CardPurchaseServiceError):
    pass


class CardPurchaseEventStore(Protocol):
    def create_schema(self) -> None: ...
    def append(self, event: NewEvent) -> int: ...


class CardPurchaseProjector(Protocol):
    def run(self) -> int: ...
    def list_card_purchases(
        self,
        *,
        card_id: str | None = None,
    ) -> list[dict[str, str | int | None]]: ...
    def list_invoices(
        self,
        *,
        card_id: str | None = None,
    ) -> list[dict[str, str | int]]: ...
    def list_invoice_items(
        self,
        *,
        invoice_id: str,
    ) -> list[dict[str, str | int | None]]: ...
    def list_card_installments(
        self,
        *,
        card_id: str | None = None,
        reference_month_from: str | None = None,
    ) -> list[dict[str, str | int | None]]: ...

    def get_card_purchase_person_id(self, *, purchase_id: str) -> str | None: ...


class CardReader(Protocol):
    def get_card(self, card_id: str) -> dict[str, str | int | bool]: ...


class CardPurchaseService:
    def __init__(
        self,
        *,
        event_store: CardPurchaseEventStore,
        projector: CardPurchaseProjector,
        card_reader: CardReader,
    ) -> None:
        self._event_store = event_store
        self._projector = projector
        self._card_reader = card_reader

    def create_card_purchase(
        self,
        *,
        purchase_id: str,
        purchase_date: str,
        amount: int,
        installments_count: int = 1,
        category_id: str,
        card_id: str,
        description: str | None = None,
        person_id: str | None = None,
    ) -> dict[str, str | int | None]:
        self._sync_projections()
        if self._find_card_purchase(purchase_id) is not None:
            raise CardPurchaseAlreadyExistsError(
                f"Card purchase '{purchase_id}' already exists."
            )

        self._card_reader.get_card(card_id)
        self._validate_payload(
            purchase_date=purchase_date,
            amount=amount,
            installments_count=installments_count,
            category_id=category_id,
            card_id=card_id,
        )

        payload = {
            "id": purchase_id,
            "purchase_date": purchase_date,
            "amount": amount,
            "installments_count": installments_count,
            "category_id": category_id,
            "card_id": card_id,
            "description": description,
            "person_id": person_id,
        }

        self._append_event("CardPurchaseCreated", payload)
        return self.get_card_purchase(purchase_id)

    def get_card_purchase(self, purchase_id: str) -> dict[str, str | int | None]:
        self._sync_projections()
        purchase = self._find_card_purchase(purchase_id)
        if purchase is None:
            raise CardPurchaseNotFoundError(
                f"Card purchase '{purchase_id}' was not found."
            )
        return purchase

    def update_card_purchase(
        self,
        purchase_id: str,
        *,
        purchase_date: object = _UNSET,
        amount: object = _UNSET,
        installments_count: object = _UNSET,
        category_id: object = _UNSET,
        card_id: object = _UNSET,
        description: object = _UNSET,
        person_id: object = _UNSET,
    ) -> dict[str, str | int | None]:
        self._sync_projections()
        existing = self._find_card_purchase(purchase_id)
        if existing is None:
            raise CardPurchaseNotFoundError(
                f"Card purchase '{purchase_id}' was not found."
            )

        current_person_id = self._projector.get_card_purchase_person_id(
            purchase_id=purchase_id
        )

        next_purchase_date = (
            str(purchase_date)
            if purchase_date is not _UNSET and purchase_date is not None
            else str(existing["purchase_date"])
        )
        next_amount = (
            int(amount) if amount is not _UNSET and amount is not None else int(existing["amount"])
        )
        next_installments_count = (
            int(installments_count)
            if installments_count is not _UNSET and installments_count is not None
            else int(existing["installments_count"])
        )
        next_category_id = (
            str(category_id).strip()
            if category_id is not _UNSET and category_id is not None
            else str(existing["category_id"])
        )
        next_card_id = (
            str(card_id).strip()
            if card_id is not _UNSET and card_id is not None
            else str(existing["card_id"])
        )
        next_description = (
            None
            if description is not _UNSET and description is None
            else str(description).strip() or None
            if description is not _UNSET
            else existing.get("description")
        )
        next_person_id = (
            None
            if person_id is not _UNSET and person_id is None
            else str(person_id).strip() or None
            if person_id is not _UNSET
            else current_person_id
        )

        self._validate_payload(
            purchase_date=next_purchase_date,
            amount=next_amount,
            installments_count=next_installments_count,
            category_id=next_category_id,
            card_id=next_card_id,
        )
        self._card_reader.get_card(next_card_id)

        if (
            next_purchase_date == str(existing["purchase_date"])
            and next_amount == int(existing["amount"])
            and next_installments_count == int(existing["installments_count"])
            and next_category_id == str(existing["category_id"])
            and next_card_id == str(existing["card_id"])
            and next_description == existing.get("description")
            and next_person_id == current_person_id
        ):
            return existing

        self._append_event(
            "CardPurchaseUpdated",
            {
                "id": purchase_id,
                "purchase_date": next_purchase_date,
                "amount": next_amount,
                "installments_count": next_installments_count,
                "category_id": next_category_id,
                "card_id": next_card_id,
                "description": next_description,
                "person_id": next_person_id,
            },
        )
        return self.get_card_purchase(purchase_id)

    def void_card_purchase(self, purchase_id: str) -> None:
        self._sync_projections()
        existing = self._find_card_purchase(purchase_id)
        if existing is None:
            raise CardPurchaseNotFoundError(
                f"Card purchase '{purchase_id}' was not found."
            )

        self._append_event(
            "CardPurchaseVoided",
            {
                "id": purchase_id,
            },
        )

    def list_card_purchases(
        self,
        *,
        card_id: str | None = None,
    ) -> list[dict[str, str | int | None]]:
        self._sync_projections()
        return self._projector.list_card_purchases(card_id=card_id)

    def list_invoices(
        self,
        *,
        card_id: str | None = None,
    ) -> list[dict[str, str | int]]:
        self._sync_projections()
        return self._projector.list_invoices(card_id=card_id)

    def list_invoice_items(
        self,
        *,
        invoice_id: str,
    ) -> list[dict[str, str | int | None]]:
        self._sync_projections()
        if not invoice_id.strip():
            raise CardPurchaseServiceError("invoice_id is required.")
        if self._find_invoice(invoice_id) is None:
            raise InvoiceNotFoundError(f"Invoice '{invoice_id}' was not found.")
        return self._projector.list_invoice_items(invoice_id=invoice_id)

    def list_card_installments(
        self,
        *,
        card_id: str | None = None,
        reference_month_from: str | None = None,
    ) -> list[dict[str, str | int | None]]:
        self._sync_projections()
        return self._projector.list_card_installments(
            card_id=card_id,
            reference_month_from=reference_month_from,
        )

    def _validate_payload(
        self,
        *,
        purchase_date: str,
        amount: int,
        installments_count: int,
        category_id: str,
        card_id: str,
    ) -> None:
        try:
            parse_utc_timestamp(purchase_date)
        except ValueError as exc:
            raise CardPurchaseServiceError(
                "purchase_date must be a UTC ISO 8601 timestamp."
            ) from exc

        if amount <= 0:
            raise CardPurchaseServiceError("amount must be greater than zero.")
        if installments_count <= 0:
            raise CardPurchaseServiceError("installments_count must be at least 1.")
        if not category_id.strip():
            raise CardPurchaseServiceError("category_id is required.")
        if not card_id.strip():
            raise CardPurchaseServiceError("card_id is required.")

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

    def _find_card_purchase(
        self,
        purchase_id: str,
    ) -> dict[str, str | int | None] | None:
        for purchase in self._projector.list_card_purchases():
            if purchase["purchase_id"] == purchase_id:
                return purchase
        return None

    def _find_invoice(
        self,
        invoice_id: str,
    ) -> dict[str, str | int] | None:
        for invoice in self._projector.list_invoices():
            if invoice["invoice_id"] == invoice_id:
                return invoice
        return None

    def _utc_now(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
