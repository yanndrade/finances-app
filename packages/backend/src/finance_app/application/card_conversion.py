"""Fold a card that is really an additional one into its titular.

Before holders existed, the only way to track an additional card was to create
a separate ``Card`` for it. The issuer, though, bills a single invoice against a
single shared limit, so the app ended up with one invoice per person per month
and the payments split across them. This service migrates that shape: the
purchases move to the titular carrying a holder, the payments follow them onto
the merged invoice, and the old card is deactivated.
"""

from __future__ import annotations

from typing import Any

from finance_app.application.invoice_payments import InvoiceNotFoundError


class CardConversionError(Exception):
    pass


class IncompatibleCardCycleError(CardConversionError):
    pass


class SameCardConversionError(CardConversionError):
    pass


class CardConversionService:
    def __init__(
        self,
        *,
        card_service: Any,
        card_purchase_service: Any,
        invoice_payment_service: Any,
    ) -> None:
        self._card_service = card_service
        self._card_purchase_service = card_purchase_service
        self._invoice_payment_service = invoice_payment_service

    def preview(self, *, card_id: str, target_card_id: str) -> dict[str, Any]:
        """Describe what a conversion would move, without changing anything."""
        source, target = self._read_cards(card_id, target_card_id)
        purchases = self._card_purchase_service.list_card_purchases(card_id=card_id)
        payments = self._invoice_payment_service.list_payments_for_card(card_id)
        return {
            "card_id": card_id,
            "card_name": source["name"],
            "target_card_id": target_card_id,
            "target_card_name": target["name"],
            "purchase_count": len(purchases),
            "purchase_total": sum(int(purchase["amount"]) for purchase in purchases),
            "payment_count": len(payments),
            "payment_total": sum(int(payment["amount"]) for payment in payments),
            "cycle_matches": (
                int(source["closing_day"]) == int(target["closing_day"])
                and int(source["due_day"]) == int(target["due_day"])
            ),
        }

    def convert(
        self,
        *,
        card_id: str,
        target_card_id: str,
        holder_id: str,
        holder_name: str,
        last_four: str | None = None,
        sub_limit: int | None = None,
        reimbursable_person_id: str | None = None,
    ) -> dict[str, Any]:
        source, target = self._read_cards(card_id, target_card_id)
        if (
            int(source["closing_day"]) != int(target["closing_day"])
            or int(source["due_day"]) != int(target["due_day"])
        ):
            raise IncompatibleCardCycleError(
                "Both cards must share the same closing and due day to be merged."
            )

        self._card_service.upsert_holder(
            card_id=target_card_id,
            holder_id=holder_id,
            name=holder_name,
            last_four=last_four,
            sub_limit=sub_limit,
            reimbursable_person_id=reimbursable_person_id,
        )

        # Purchases first: the payments can only be reassigned once the target
        # invoice for that cycle exists.
        purchases = self._card_purchase_service.list_card_purchases(card_id=card_id)
        for purchase in purchases:
            self._card_purchase_service.update_card_purchase(
                str(purchase["purchase_id"]),
                card_id=target_card_id,
                holder_id=holder_id,
            )

        payments = self._invoice_payment_service.list_payments_for_card(card_id)
        reassigned = 0
        orphaned: list[str] = []
        for payment in payments:
            reference_month = str(payment["invoice_id"]).split(":", 1)[1]
            target_invoice_id = f"{target_card_id}:{reference_month}"
            try:
                self._invoice_payment_service.reassign_payment(
                    payment_id=str(payment["payment_id"]),
                    invoice_id=target_invoice_id,
                )
            except InvoiceNotFoundError:
                # The titular has no invoice for that cycle, so the payment has
                # nowhere to land. It stays on the deactivated card instead of
                # being silently dropped.
                orphaned.append(str(payment["payment_id"]))
                continue
            reassigned += 1

        self._card_service.update_card(card_id, is_active=False)

        return {
            "card_id": card_id,
            "target_card_id": target_card_id,
            "holder_id": holder_id,
            "purchases_moved": len(purchases),
            "payments_reassigned": reassigned,
            "payments_orphaned": orphaned,
        }

    def _read_cards(
        self,
        card_id: str,
        target_card_id: str,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        if card_id == target_card_id:
            raise SameCardConversionError(
                "A card cannot become a holder of itself."
            )
        source = self._card_service.get_card(card_id)
        target = self._card_service.get_card(target_card_id)
        return source, target
