from __future__ import annotations

from pathlib import Path

import pytest

from finance_app.application.card_conversion import (
    IncompatibleCardCycleError,
    SameCardConversionError,
)
from finance_app.interfaces.http.bootstrap import AppServices, build_services

TITULAR = "card-bradesco"
ADDITIONAL = "card-bradesco-duda"


def _build(tmp_path: Path) -> AppServices:
    services = build_services(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    services.account_service.create_account(
        account_id="acc-nubank",
        name="Nubank",
        account_type="checking",
        initial_balance=1_000_000,
    )
    # Same cycle on both cards, exactly like an issuer's additional card.
    for card_id, name, limit in (
        (TITULAR, "Bradesco Visa Infinite", 600_000),
        (ADDITIONAL, "Bradesco Visa Infinite - Duda", 360_000),
    ):
        services.card_service.create_card(
            card_id=card_id,
            name=name,
            limit_amount=limit,
            closing_day=24,
            due_day=5,
            payment_account_id="acc-nubank",
        )
    return services


def _invoice(services: AppServices, invoice_id: str) -> dict[str, object] | None:
    for invoice in services.card_purchase_service.list_invoices():
        if invoice["invoice_id"] == invoice_id:
            return invoice
    return None


def test_preview_reports_what_would_move(tmp_path: Path) -> None:
    services = _build(tmp_path)
    services.card_purchase_service.create_card_purchase(
        purchase_id="purchase-duda-1",
        purchase_date="2026-03-10T12:00:00Z",
        amount=72_882,
        category_id="supermercado",
        card_id=ADDITIONAL,
    )
    services.invoice_payment_service.create_payment(
        payment_id="payment-duda-1",
        invoice_id=f"{ADDITIONAL}:2026-03",
        amount=72_882,
        account_id="acc-nubank",
        paid_at="2026-03-27T12:00:00Z",
    )

    preview = services.card_conversion_service.preview(
        card_id=ADDITIONAL,
        target_card_id=TITULAR,
    )

    assert preview["purchase_count"] == 1
    assert preview["purchase_total"] == 72_882
    assert preview["payment_count"] == 1
    assert preview["payment_total"] == 72_882
    assert preview["cycle_matches"] is True
    # A preview changes nothing.
    assert _invoice(services, f"{ADDITIONAL}:2026-03") is not None


def test_conversion_merges_invoices_and_payments(tmp_path: Path) -> None:
    services = _build(tmp_path)
    services.card_purchase_service.create_card_purchase(
        purchase_id="purchase-titular-1",
        purchase_date="2026-03-05T12:00:00Z",
        amount=208_275,
        category_id="supermercado",
        card_id=TITULAR,
    )
    services.card_purchase_service.create_card_purchase(
        purchase_id="purchase-duda-1",
        purchase_date="2026-03-10T12:00:00Z",
        amount=72_882,
        category_id="vestuario",
        card_id=ADDITIONAL,
    )
    services.invoice_payment_service.create_payment(
        payment_id="payment-titular-1",
        invoice_id=f"{TITULAR}:2026-03",
        amount=208_275,
        account_id="acc-nubank",
        paid_at="2026-03-27T12:00:00Z",
    )
    services.invoice_payment_service.create_payment(
        payment_id="payment-duda-1",
        invoice_id=f"{ADDITIONAL}:2026-03",
        amount=72_882,
        account_id="acc-nubank",
        paid_at="2026-03-27T12:00:00Z",
    )
    balance_before = services.account_service.get_account("acc-nubank")

    result = services.card_conversion_service.convert(
        card_id=ADDITIONAL,
        target_card_id=TITULAR,
        holder_id="holder-duda",
        holder_name="Duda",
        last_four="4321",
        sub_limit=360_000,
    )

    assert result["purchases_moved"] == 1
    assert result["payments_reassigned"] == 1
    assert result["payments_orphaned"] == []

    merged = _invoice(services, f"{TITULAR}:2026-03")
    assert merged is not None
    assert merged["total_amount"] == 281_157
    assert merged["paid_amount"] == 281_157
    assert merged["remaining_amount"] == 0
    assert merged["status"] == "paid"
    assert merged["purchase_count"] == 2

    # Nothing is left behind on the old card's invoice.
    leftover = _invoice(services, f"{ADDITIONAL}:2026-03")
    assert leftover is None or leftover["total_amount"] == 0

    # Merging must not touch the account: the money already left it.
    assert (
        services.account_service.get_account("acc-nubank")["current_balance"]
        == balance_before["current_balance"]
    )

    holders = {
        holder["holder_id"]: holder
        for holder in services.card_service.list_holders(TITULAR)
    }
    assert holders["holder-duda"]["last_four"] == "4321"
    moved = services.card_purchase_service.get_card_purchase("purchase-duda-1")
    assert moved["card_id"] == TITULAR
    assert moved["holder_id"] == "holder-duda"
    assert moved["invoice_id"] == f"{TITULAR}:2026-03"

    assert services.card_service.get_card(ADDITIONAL)["is_active"] is False


def test_conversion_keeps_a_partially_paid_invoice_partial(tmp_path: Path) -> None:
    services = _build(tmp_path)
    services.card_purchase_service.create_card_purchase(
        purchase_id="purchase-titular-1",
        purchase_date="2026-03-05T12:00:00Z",
        amount=156_538,
        category_id="supermercado",
        card_id=TITULAR,
    )
    services.card_purchase_service.create_card_purchase(
        purchase_id="purchase-duda-1",
        purchase_date="2026-03-10T12:00:00Z",
        amount=39_133,
        category_id="vestuario",
        card_id=ADDITIONAL,
    )
    services.invoice_payment_service.create_payment(
        payment_id="payment-titular-1",
        invoice_id=f"{TITULAR}:2026-03",
        amount=144_548,
        account_id="acc-nubank",
        paid_at="2026-03-26T12:00:00Z",
    )
    services.invoice_payment_service.create_payment(
        payment_id="payment-duda-1",
        invoice_id=f"{ADDITIONAL}:2026-03",
        amount=15_888,
        account_id="acc-nubank",
        paid_at="2026-03-26T12:00:00Z",
    )

    services.card_conversion_service.convert(
        card_id=ADDITIONAL,
        target_card_id=TITULAR,
        holder_id="holder-duda",
        holder_name="Duda",
    )

    merged = _invoice(services, f"{TITULAR}:2026-03")
    assert merged is not None
    assert merged["total_amount"] == 195_671
    assert merged["paid_amount"] == 160_436
    assert merged["remaining_amount"] == 35_235
    assert merged["status"] == "partial"


def test_conversion_clamps_an_overpaid_merged_invoice(tmp_path: Path) -> None:
    """Rounding on installment splits can make the payments exceed the total."""
    services = _build(tmp_path)
    services.card_purchase_service.create_card_purchase(
        purchase_id="purchase-duda-1",
        purchase_date="2026-03-10T12:00:00Z",
        amount=56_581,
        category_id="vestuario",
        card_id=ADDITIONAL,
    )
    services.card_purchase_service.create_card_purchase(
        purchase_id="purchase-titular-1",
        purchase_date="2026-03-05T12:00:00Z",
        amount=117_611,
        category_id="supermercado",
        card_id=TITULAR,
    )
    services.invoice_payment_service.create_payment(
        payment_id="payment-titular-1",
        invoice_id=f"{TITULAR}:2026-03",
        amount=117_611,
        account_id="acc-nubank",
        paid_at="2026-03-28T12:00:00Z",
    )
    # Two cents more than the invoice, exactly like the production data.
    services.invoice_payment_service.create_payment(
        payment_id="payment-duda-1",
        invoice_id=f"{ADDITIONAL}:2026-03",
        amount=56_583,
        account_id="acc-nubank",
        paid_at="2026-03-28T12:00:00Z",
    )

    services.card_conversion_service.convert(
        card_id=ADDITIONAL,
        target_card_id=TITULAR,
        holder_id="holder-duda",
        holder_name="Duda",
    )

    merged = _invoice(services, f"{TITULAR}:2026-03")
    assert merged is not None
    assert merged["total_amount"] == 174_192
    assert merged["paid_amount"] == 174_192
    assert merged["remaining_amount"] == 0
    assert merged["status"] == "paid"


def test_conversion_moves_installments_to_the_merged_invoices(tmp_path: Path) -> None:
    services = _build(tmp_path)
    services.card_purchase_service.create_card_purchase(
        purchase_id="purchase-duda-parcelada",
        purchase_date="2026-03-10T12:00:00Z",
        amount=30_000,
        installments_count=3,
        category_id="vestuario",
        card_id=ADDITIONAL,
    )

    services.card_conversion_service.convert(
        card_id=ADDITIONAL,
        target_card_id=TITULAR,
        holder_id="holder-duda",
        holder_name="Duda",
    )

    installments = services.card_purchase_service.list_card_installments(
        card_id=TITULAR,
    )
    assert len(installments) == 3
    assert {item["holder_id"] for item in installments} == {"holder-duda"}
    assert all(
        str(item["invoice_id"]).startswith(f"{TITULAR}:") for item in installments
    )
    assert services.card_purchase_service.list_card_installments(
        card_id=ADDITIONAL,
    ) == []


def test_conversion_carries_a_holder_reimbursement_person(tmp_path: Path) -> None:
    services = _build(tmp_path)

    services.card_conversion_service.convert(
        card_id=ADDITIONAL,
        target_card_id=TITULAR,
        holder_id="holder-duda",
        holder_name="Duda",
        reimbursable_person_id="Duda",
    )

    holder = services.card_service.get_holder("holder-duda")
    assert holder["reimbursable_person_id"] == "Duda"


def test_conversion_rejects_cards_with_different_cycles(tmp_path: Path) -> None:
    services = _build(tmp_path)
    services.card_service.create_card(
        card_id="card-nubank",
        name="Nubank",
        limit_amount=530_000,
        closing_day=28,
        due_day=5,
        payment_account_id="acc-nubank",
    )

    with pytest.raises(IncompatibleCardCycleError):
        services.card_conversion_service.convert(
            card_id="card-nubank",
            target_card_id=TITULAR,
            holder_id="holder-x",
            holder_name="X",
        )


def test_conversion_rejects_converting_a_card_into_itself(tmp_path: Path) -> None:
    services = _build(tmp_path)

    with pytest.raises(SameCardConversionError):
        services.card_conversion_service.convert(
            card_id=TITULAR,
            target_card_id=TITULAR,
            holder_id="holder-x",
            holder_name="X",
        )
