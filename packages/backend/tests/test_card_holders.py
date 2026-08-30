from __future__ import annotations

from pathlib import Path

import pytest

from finance_app.application.card_purchases import (
    InvalidCardHolderError as PurchaseInvalidCardHolderError,
)
from finance_app.application.cards import (
    CardHolderNotFoundError,
    InvalidCardHolderError,
)
from finance_app.interfaces.http.bootstrap import AppServices, build_services


def _build(tmp_path: Path) -> AppServices:
    services = build_services(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    services.account_service.create_account(
        account_id="acc-main",
        name="Main",
        account_type="checking",
        initial_balance=0,
    )
    services.card_service.create_card(
        card_id="card-1",
        name="Bradesco Visa Infinite",
        limit_amount=600_000,
        closing_day=24,
        due_day=5,
        payment_account_id="acc-main",
    )
    return services


def test_upsert_holder_returns_holder_with_zero_spend(tmp_path: Path) -> None:
    services = _build(tmp_path)

    holder = services.card_service.upsert_holder(
        card_id="card-1",
        holder_id="holder-duda",
        name="Duda",
        last_four="4321",
        sub_limit=360_000,
    )

    assert holder["holder_id"] == "holder-duda"
    assert holder["card_id"] == "card-1"
    assert holder["last_four"] == "4321"
    assert holder["sub_limit"] == 360_000
    assert holder["is_primary"] is False
    assert holder["spent_open_invoice"] == 0
    assert holder["spent_future_installments"] == 0


def test_holder_rejects_sub_limit_above_the_shared_limit(tmp_path: Path) -> None:
    services = _build(tmp_path)

    with pytest.raises(InvalidCardHolderError):
        services.card_service.upsert_holder(
            card_id="card-1",
            holder_id="holder-duda",
            name="Duda",
            sub_limit=600_001,
        )


def test_holder_rejects_last_four_that_is_not_four_digits(tmp_path: Path) -> None:
    services = _build(tmp_path)

    with pytest.raises(InvalidCardHolderError):
        services.card_service.upsert_holder(
            card_id="card-1",
            holder_id="holder-duda",
            name="Duda",
            last_four="12a4",
        )


def test_holder_rejects_duplicated_last_four_on_the_same_card(tmp_path: Path) -> None:
    services = _build(tmp_path)
    services.card_service.upsert_holder(
        card_id="card-1",
        holder_id="holder-duda",
        name="Duda",
        last_four="4321",
    )

    with pytest.raises(InvalidCardHolderError):
        services.card_service.upsert_holder(
            card_id="card-1",
            holder_id="holder-sergio",
            name="Sérgio",
            last_four="4321",
        )


def test_holder_rejects_a_second_primary_on_the_same_card(tmp_path: Path) -> None:
    services = _build(tmp_path)
    services.card_service.upsert_holder(
        card_id="card-1",
        holder_id="holder-yann",
        name="Yann",
        is_primary=True,
    )

    with pytest.raises(InvalidCardHolderError):
        services.card_service.upsert_holder(
            card_id="card-1",
            holder_id="holder-duda",
            name="Duda",
            is_primary=True,
        )


def test_purchase_rejects_holder_from_another_card(tmp_path: Path) -> None:
    services = _build(tmp_path)
    services.card_service.create_card(
        card_id="card-2",
        name="Nubank",
        limit_amount=100_000,
        closing_day=28,
        due_day=5,
        payment_account_id="acc-main",
    )
    services.card_service.upsert_holder(
        card_id="card-2",
        holder_id="holder-other",
        name="Outro",
    )

    with pytest.raises(PurchaseInvalidCardHolderError):
        services.card_purchase_service.create_card_purchase(
            purchase_id="purchase-1",
            purchase_date="2026-08-10T12:00:00Z",
            amount=10_000,
            category_id="supermercado",
            card_id="card-1",
            holder_id="holder-other",
        )


def test_holder_purchase_lands_on_the_shared_card_invoice(tmp_path: Path) -> None:
    services = _build(tmp_path)
    services.card_service.upsert_holder(
        card_id="card-1",
        holder_id="holder-yann",
        name="Yann",
        is_primary=True,
    )
    services.card_service.upsert_holder(
        card_id="card-1",
        holder_id="holder-duda",
        name="Duda",
        last_four="4321",
        sub_limit=360_000,
    )

    titular = services.card_purchase_service.create_card_purchase(
        purchase_id="purchase-titular",
        purchase_date="2026-08-10T12:00:00Z",
        amount=30_000,
        category_id="supermercado",
        card_id="card-1",
    )
    additional = services.card_purchase_service.create_card_purchase(
        purchase_id="purchase-duda",
        purchase_date="2026-08-11T12:00:00Z",
        amount=20_000,
        category_id="vestuario",
        card_id="card-1",
        holder_id="holder-duda",
    )

    # One shared invoice: the additional card does not get an invoice of its own.
    assert titular["invoice_id"] == additional["invoice_id"]
    assert additional["holder_id"] == "holder-duda"

    invoices = services.card_purchase_service.list_invoices(card_id="card-1")
    open_invoice = next(
        invoice for invoice in invoices if invoice["invoice_id"] == titular["invoice_id"]
    )
    assert open_invoice["total_amount"] == 50_000
    assert open_invoice["purchase_count"] == 2

    holders = {
        holder["holder_id"]: holder
        for holder in services.card_service.list_holders("card-1")
    }
    assert holders["holder-yann"]["spent_open_invoice"] == 30_000
    assert holders["holder-duda"]["spent_open_invoice"] == 20_000


def test_purchase_without_holder_is_attributed_to_the_primary(tmp_path: Path) -> None:
    services = _build(tmp_path)
    # The purchase predates the holder, exactly like every pre-migration one.
    services.card_purchase_service.create_card_purchase(
        purchase_id="purchase-legacy",
        purchase_date="2026-08-10T12:00:00Z",
        amount=12_345,
        category_id="supermercado",
        card_id="card-1",
    )
    services.card_service.upsert_holder(
        card_id="card-1",
        holder_id="holder-yann",
        name="Yann",
        is_primary=True,
    )

    holders = services.card_service.list_holders("card-1")

    assert holders[0]["holder_id"] == "holder-yann"
    assert holders[0]["spent_open_invoice"] == 12_345


def test_installments_split_between_open_invoice_and_future(tmp_path: Path) -> None:
    services = _build(tmp_path)
    services.card_service.upsert_holder(
        card_id="card-1",
        holder_id="holder-duda",
        name="Duda",
    )
    services.card_purchase_service.create_card_purchase(
        purchase_id="purchase-parcelada",
        purchase_date="2026-08-10T12:00:00Z",
        amount=30_000,
        installments_count=3,
        category_id="vestuario",
        card_id="card-1",
        holder_id="holder-duda",
    )

    holder = services.card_service.list_holders("card-1")[0]

    assert holder["spent_open_invoice"] == 10_000
    assert holder["spent_future_installments"] == 20_000


def test_moving_a_purchase_to_a_holder_updates_attribution(tmp_path: Path) -> None:
    services = _build(tmp_path)
    services.card_service.upsert_holder(
        card_id="card-1",
        holder_id="holder-yann",
        name="Yann",
        is_primary=True,
    )
    services.card_service.upsert_holder(
        card_id="card-1",
        holder_id="holder-duda",
        name="Duda",
    )
    services.card_purchase_service.create_card_purchase(
        purchase_id="purchase-1",
        purchase_date="2026-08-10T12:00:00Z",
        amount=25_000,
        category_id="supermercado",
        card_id="card-1",
    )

    updated = services.card_purchase_service.update_card_purchase(
        "purchase-1",
        holder_id="holder-duda",
    )

    assert updated["holder_id"] == "holder-duda"
    holders = {
        holder["holder_id"]: holder
        for holder in services.card_service.list_holders("card-1")
    }
    assert holders["holder-yann"]["spent_open_invoice"] == 0
    assert holders["holder-duda"]["spent_open_invoice"] == 25_000


def test_removing_a_holder_keeps_the_purchase_history(tmp_path: Path) -> None:
    services = _build(tmp_path)
    services.card_service.upsert_holder(
        card_id="card-1",
        holder_id="holder-duda",
        name="Duda",
    )
    services.card_purchase_service.create_card_purchase(
        purchase_id="purchase-1",
        purchase_date="2026-08-10T12:00:00Z",
        amount=25_000,
        category_id="supermercado",
        card_id="card-1",
        holder_id="holder-duda",
    )

    services.card_service.remove_holder("holder-duda")

    assert services.card_service.list_holders("card-1") == []
    purchase = services.card_purchase_service.get_card_purchase("purchase-1")
    assert purchase["holder_id"] == "holder-duda"
    with pytest.raises(CardHolderNotFoundError):
        services.card_service.get_holder("holder-duda")
