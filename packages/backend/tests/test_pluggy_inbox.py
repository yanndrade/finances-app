"""Staging, translation, dedup and acceptance.

The invariant under test everywhere here: a sync never writes to the event
store. Only an explicit accept does, and it goes through the same domain
services a manual entry uses.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from finance_app.application.pluggy import PluggyService
from finance_app.application.pluggy_inbox import (
    EntryAlreadyDecidedError,
    MissingCategoryError,
    PluggyInboxService,
    StagedEntryNotFoundError,
    UnresolvedInvoiceError,
)
from finance_app.infrastructure.pluggy_store import PluggyStore
from finance_app.interfaces.http.bootstrap import AppServices, build_services

ITEM_ID = "11111111-1111-1111-1111-111111111111"
BANK_ID = "22222222-2222-2222-2222-222222222222"
CARD_ID = "33333333-3333-3333-3333-333333333333"
SECOND_BANK_ID = "44444444-4444-4444-4444-444444444444"


def _bank_transaction(**overrides: Any) -> dict[str, Any]:
    return {
        "id": "tx-1",
        "status": "POSTED",
        "type": "DEBIT",
        "amount": 125.50,
        "date": "2026-08-20T12:00:00Z",
        "description": "Padaria",
        "category": "Supermercado",
        **overrides,
    }


def _card_transaction(**overrides: Any) -> dict[str, Any]:
    return {
        "id": "card-tx-1",
        "status": "POSTED",
        "type": "DEBIT",
        "amount": 200.00,
        "date": "2026-08-21T12:00:00Z",
        "description": "Loja",
        **overrides,
    }


def _installment(number: int, *, total: int = 3, amount: float = 100.0) -> dict[str, Any]:
    return {
        "id": f"parcela-{number}",
        "status": "POSTED",
        "type": "DEBIT",
        "amount": amount,
        "date": f"2026-{7 + number:02d}-15T12:00:00Z",
        "description": "Notebook",
        "creditCardMetadata": {
            "installmentNumber": number,
            "totalInstallments": total,
            "totalAmount": amount * total,
            "purchaseDate": "2026-07-10",
            "cardNumber": "4321",
        },
    }


class _Gateway:
    def __init__(self, snapshot: dict[str, Any]) -> None:
        self._snapshot = snapshot

    def create_connect_token(self, *, client_user_id, item_id=None) -> str:
        return "token"

    def fetch_snapshot(self, *, item_id: str) -> dict[str, Any]:
        return self._snapshot


def _setup(
    tmp_path: Path,
    *,
    accounts: list[dict[str, Any]],
    transactions: dict[str, list[dict[str, Any]]],
) -> tuple[PluggyService, PluggyInboxService, AppServices]:
    snapshot = {
        "item": {
            "id": ITEM_ID,
            "status": "UPDATED",
            "executionStatus": "SUCCESS",
            "connector": {"name": "MeuPluggy"},
        },
        "accounts": accounts,
        "transactions": transactions,
        "investments": [],
    }
    database_url = f"sqlite:///{(tmp_path / 'app.db').as_posix()}"
    services = build_services(
        database_url=database_url,
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    store = PluggyStore(database_url)
    inbox = PluggyInboxService(
        store=store,
        account_service=services.account_service,
        card_service=services.card_service,
        card_purchase_service=services.card_purchase_service,
        transaction_service=services.transaction_service,
        invoice_payment_service=services.invoice_payment_service,
        transfer_service=services.transfer_service,
        investment_service=services.investment_service,
        recurring_service=services.recurring_service,
    )
    pluggy = PluggyService(
        _Gateway(snapshot),
        store=store,
        account_service=services.account_service,
        card_service=services.card_service,
        card_purchase_service=services.card_purchase_service,
        transaction_service=services.transaction_service,
        investment_service=services.investment_service,
        inbox_service=inbox,
    )
    pluggy.register_item(item_id=ITEM_ID, client_user_id="meucofri-owner")

    services.account_service.create_account(
        account_id="acc-nubank",
        name="Nubank",
        account_type="checking",
        initial_balance=0,
    )
    services.card_service.create_card(
        card_id="card-bradesco",
        name="Bradesco Visa Infinite",
        limit_amount=600_000,
        closing_day=24,
        due_day=5,
        payment_account_id="acc-nubank",
    )
    return pluggy, inbox, services


def _link_all(pluggy: PluggyService, *, import_since: str | None = None) -> None:
    for account in pluggy.list_accounts()["accounts"]:
        if account["kind"] == "bank":
            pluggy.link_account(
                pluggy_account_id=account["pluggy_account_id"],
                local_account_id="acc-nubank",
                import_since=import_since,
            )
        else:
            pluggy.link_account(
                pluggy_account_id=account["pluggy_account_id"],
                local_card_id="card-bradesco",
                import_since=import_since,
            )


def _link_two_banks(pluggy: PluggyService) -> None:
    """Send each bank account to a different local account, so a movement
    between them is a transfer rather than a round trip."""
    local_by_pluggy = {BANK_ID: "acc-nubank", SECOND_BANK_ID: "acc-poupanca"}
    for account in pluggy.list_accounts()["accounts"]:
        pluggy.link_account(
            pluggy_account_id=account["pluggy_account_id"],
            local_account_id=local_by_pluggy[account["pluggy_account_id"]],
        )


def _pending(inbox: PluggyInboxService) -> list[dict[str, Any]]:
    return inbox.list_entries()["entries"]


def test_first_sync_stages_nothing_until_accounts_are_linked(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction()]},
    )

    result = pluggy.sync_item(ITEM_ID)

    assert result["entries_staged"] == 0
    assert _pending(inbox) == []
    assert services.transaction_service.list_transactions() == []


def test_sync_stages_a_bank_expense_without_writing_events(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction()]},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)

    result = pluggy.sync_item(ITEM_ID)

    assert result["entries_pending"] == 1
    assert services.transaction_service.list_transactions() == []

    entry = _pending(inbox)[0]
    assert entry["kind"] == "bank_transaction"
    assert entry["amount"] == 12_550
    assert entry["title"] == "Padaria"
    assert entry["proposal"]["payload"]["transaction_type"] == "expense"
    assert entry["proposal"]["payload"]["account_id"] == "acc-nubank"
    # Pluggy's taxonomy only pre-selects a local category; it never becomes one.
    assert entry["proposal"]["payload"]["category_id"] == "supermercado"


def test_credit_transaction_becomes_income(tmp_path: Path) -> None:
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction(type="CREDIT", description="Salário")]},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    payload = _pending(inbox)[0]["proposal"]["payload"]

    assert payload["transaction_type"] == "income"


def test_pending_transactions_are_not_staged(tmp_path: Path) -> None:
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction(status="PENDING")]},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    assert _pending(inbox) == []


def test_import_since_cuts_off_older_transactions(tmp_path: Path) -> None:
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={
            BANK_ID: [
                _bank_transaction(id="old", date="2026-07-20T12:00:00Z"),
                _bank_transaction(id="new", date="2026-08-20T12:00:00Z"),
            ]
        },
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy, import_since="2026-08-01")
    pluggy.sync_item(ITEM_ID)

    assert [entry["external_id"] for entry in _pending(inbox)] == ["new"]


def test_an_ignored_account_stages_nothing(tmp_path: Path) -> None:
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction()]},
    )
    pluggy.sync_item(ITEM_ID)
    pluggy.link_account(pluggy_account_id=BANK_ID, ignored=True)
    pluggy.sync_item(ITEM_ID)

    assert _pending(inbox) == []


def test_installments_rebuild_a_single_purchase(tmp_path: Path) -> None:
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão", "number": "4321"}],
        transactions={CARD_ID: [_installment(1), _installment(2), _installment(3)]},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    entries = _pending(inbox)

    # One purchase for the whole thing; the siblings are hidden.
    assert len(entries) == 1
    payload = entries[0]["proposal"]["payload"]
    assert payload["installments_count"] == 3
    assert payload["amount"] == 30_000
    assert payload["purchase_date"].startswith("2026-07-10")

    covered = [
        entry
        for entry in inbox.list_entries(include_covered=True)["entries"]
        if entry["match_kind"] == "covered_by_group"
    ]
    assert len(covered) == 2
    assert {entry["group_key"] for entry in covered} == {entries[0]["group_key"]}


def test_installments_are_rebuilt_even_when_the_issuer_omits_the_total(
    tmp_path: Path,
) -> None:
    """The real shape: purchaseDate and totalInstallments, but no totalAmount.

    Each instalment also carries its own counter in the description, so the
    grouping has to ignore it or every instalment becomes its own purchase.
    """
    partial = []
    for number in (5, 6, 7):
        transaction = _installment(number, total=12, amount=19.90)
        transaction["creditCardMetadata"]["totalAmount"] = None
        transaction["description"] = f"Vindi  *Investidor10 {number}/12"
        partial.append(transaction)

    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão", "number": "4321"}],
        transactions={CARD_ID: partial},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    entries = _pending(inbox)

    assert len(entries) == 1
    entry = entries[0]
    # The whole purchase and how many instalments, the way it would be typed.
    assert entry["amount"] == 238_80
    assert entry["proposal"]["payload"]["installments_count"] == 12
    # Dated by the purchase, not by whichever instalment came in the window.
    assert entry["proposal"]["payload"]["purchase_date"].startswith("2026-07-10")
    # And named as the purchase, not as one instalment of it.
    assert entry["title"] == "Vindi  *Investidor10"


def test_a_purchase_abroad_is_staged_in_reais(tmp_path: Path) -> None:
    """The real shape of a card charge in dollars.

    ``amount`` is the dollar figure; the issuer bills
    ``amountInAccountCurrency``. Staging the former would post a fifth of the
    charge.
    """
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão", "number": "6186"}],
        transactions={
            CARD_ID: [
                _card_transaction(
                    description="Spaceship.Com* Xzusfs",
                    currencyCode="USD",
                    amount=8.48,
                    amountInAccountCurrency=45.51,
                )
            ]
        },
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    entry = _pending(inbox)[0]
    assert entry["amount"] == 45_51
    payload = entry["proposal"]["payload"]
    assert payload["amount"] == 45_51
    # And what it was before conversion, so the review can show both.
    assert payload["original_currency"] == "USD"
    assert payload["original_amount"] == 8_48


def test_a_domestic_purchase_carries_no_original_currency(tmp_path: Path) -> None:
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão", "number": "4321"}],
        transactions={CARD_ID: [_card_transaction(currencyCode="BRL")]},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    payload = _pending(inbox)[0]["proposal"]["payload"]
    assert payload["amount"] == 200_00
    assert "original_currency" not in payload


def test_a_foreign_amount_without_a_conversion_stays_as_reported(
    tmp_path: Path,
) -> None:
    """Nothing to convert with, so nothing is invented.

    Making up a rate would put a number in the ledger that no statement backs.
    """
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão", "number": "4321"}],
        transactions={
            CARD_ID: [
                _card_transaction(
                    currencyCode="USD",
                    amount=8.48,
                    amountInAccountCurrency=None,
                )
            ]
        },
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    payload = _pending(inbox)[0]["proposal"]["payload"]
    assert payload["amount"] == 8_48
    assert "original_currency" not in payload


def test_a_bill_payment_abroad_keeps_its_direction(tmp_path: Path) -> None:
    """The converted figure is unsigned, so the sign still comes from amount."""
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão", "number": "4321"}],
        transactions={
            CARD_ID: [
                _card_transaction(
                    description="Estorno",
                    currencyCode="USD",
                    amount=-8.48,
                    amountInAccountCurrency=45.51,
                )
            ]
        },
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    entry = _pending(inbox)[0]
    assert entry["kind"] == "invoice_payment"
    assert entry["amount"] == 45_51


def test_installments_abroad_total_the_converted_instalments(tmp_path: Path) -> None:
    """``totalAmount`` is in dollars, so only the converted legs can be summed."""
    parcels = []
    for number in (1, 2):
        transaction = _installment(number, total=2, amount=10.00)
        transaction["currencyCode"] = "USD"
        transaction["amountInAccountCurrency"] = 53.67
        parcels.append(transaction)

    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão", "number": "4321"}],
        transactions={CARD_ID: parcels},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    entries = _pending(inbox)
    assert len(entries) == 1
    assert entries[0]["amount"] == 107_34


def test_a_new_conversion_rate_reopens_an_accepted_purchase(tmp_path: Path) -> None:
    """The issuer settles at the rate of the day the bill closes."""
    gateway_transactions = [
        _card_transaction(
            currencyCode="USD",
            amount=8.48,
            amountInAccountCurrency=45.51,
        )
    ]
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão", "number": "4321"}],
        transactions={CARD_ID: gateway_transactions},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    entry = _pending(inbox)[0]
    inbox.accept(entry["entry_id"], overrides={"category_id": "outros"})
    assert _pending(inbox) == []

    gateway_transactions[0]["amountInAccountCurrency"] = 46.10
    pluggy.sync_item(ITEM_ID)

    reopened = _pending(inbox)
    assert len(reopened) == 1
    assert reopened[0]["revised"] is True
    assert reopened[0]["amount"] == 46_10


def test_card_number_attributes_the_purchase_to_a_holder(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão", "number": "1111"}],
        transactions={
            CARD_ID: [
                _card_transaction(creditCardMetadata={"cardNumber": "4321"}),
            ]
        },
    )
    services.card_service.upsert_holder(
        card_id="card-bradesco",
        holder_id="holder-duda",
        name="Duda",
        last_four="4321",
        reimbursable_person_id="Duda",
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    payload = _pending(inbox)[0]["proposal"]["payload"]

    assert payload["holder_id"] == "holder-duda"
    assert payload["card_id"] == "card-bradesco"
    # The holder is configured as reimbursable, so it arrives ready to become one.
    assert payload["person_id"] == "Duda"


def test_a_matching_manual_entry_is_flagged_as_duplicate(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction()]},
    )
    services.transaction_service.create_expense(
        transaction_id="manual-1",
        occurred_at="2026-08-19T12:00:00Z",
        amount=12_550,
        account_id="acc-nubank",
        payment_method="PIX",
        category_id="supermercado",
        description="Padaria da esquina",
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    entry = _pending(inbox)[0]

    assert entry["match_kind"] == "duplicate_of_local"
    assert entry["matched_local_id"] == "manual-1"


def test_a_manual_entry_too_far_away_is_not_a_duplicate(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction()]},
    )
    services.transaction_service.create_expense(
        transaction_id="manual-1",
        occurred_at="2026-08-10T12:00:00Z",
        amount=12_550,
        account_id="acc-nubank",
        payment_method="PIX",
        category_id="supermercado",
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    assert _pending(inbox)[0]["match_kind"] == "new"


def test_one_manual_entry_matches_only_one_proposal(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={
            BANK_ID: [
                _bank_transaction(id="tx-1"),
                _bank_transaction(id="tx-2"),
            ]
        },
    )
    services.transaction_service.create_expense(
        transaction_id="manual-1",
        occurred_at="2026-08-20T12:00:00Z",
        amount=12_550,
        account_id="acc-nubank",
        payment_method="PIX",
        category_id="supermercado",
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    matched = [
        entry for entry in _pending(inbox) if entry["match_kind"] == "duplicate_of_local"
    ]
    assert len(matched) == 1


def test_accepting_creates_the_local_entry(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction()]},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)
    entry = _pending(inbox)[0]

    accepted = inbox.accept(entry["entry_id"])

    assert accepted["decision"] == "accepted"
    transactions = services.transaction_service.list_transactions()
    assert len(transactions) == 1
    assert transactions[0]["amount"] == 12_550
    assert transactions[0]["transaction_id"] == accepted["created_local_id"]
    assert _pending(inbox) == []


def test_accepting_a_card_purchase_lands_on_the_invoice(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão", "number": "4321"}],
        transactions={CARD_ID: [_installment(1), _installment(2), _installment(3)]},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)
    entry = _pending(inbox)[0]

    inbox.accept(entry["entry_id"], overrides={"category_id": "compras-online"})

    purchases = services.card_purchase_service.list_card_purchases()
    assert len(purchases) == 1
    assert purchases[0]["amount"] == 30_000
    assert purchases[0]["installments_count"] == 3
    installments = services.card_purchase_service.list_card_installments()
    assert len(installments) == 3


def test_accept_requires_a_category(tmp_path: Path) -> None:
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction(category=None)]},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)
    entry = _pending(inbox)[0]

    with pytest.raises(MissingCategoryError):
        inbox.accept(entry["entry_id"])


def test_overrides_win_over_the_proposal(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction()]},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)
    entry = _pending(inbox)[0]

    inbox.accept(
        entry["entry_id"],
        overrides={"category_id": "presentes", "person_id": "Duda"},
    )

    transaction = services.transaction_service.list_transactions()[0]
    assert transaction["category_id"] == "presentes"
    # person_id is what turns an expense into a pending reimbursement.
    assert transaction["person_id"] == "Duda"
    assert services.reimbursement_service.list_reimbursements()


def test_a_decided_entry_cannot_be_decided_again(tmp_path: Path) -> None:
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction()]},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)
    entry_id = _pending(inbox)[0]["entry_id"]
    inbox.accept(entry_id)

    with pytest.raises(EntryAlreadyDecidedError):
        inbox.accept(entry_id)


def test_a_decided_entry_stays_decided_across_syncs(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction()]},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)
    inbox.ignore(_pending(inbox)[0]["entry_id"])

    pluggy.sync_item(ITEM_ID)

    assert _pending(inbox) == []
    assert services.transaction_service.list_transactions() == []


def test_a_revision_at_pluggy_reopens_the_entry(tmp_path: Path) -> None:
    transaction = _bank_transaction()
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [transaction]},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)
    inbox.ignore(_pending(inbox)[0]["entry_id"])

    # The institution corrected the amount after the fact.
    transaction["amount"] = 130.00
    pluggy.sync_item(ITEM_ID)

    reopened = _pending(inbox)
    assert len(reopened) == 1
    assert reopened[0]["revised"] is True
    assert reopened[0]["amount"] == 13_000


def test_an_accepted_entry_is_not_offered_as_its_own_duplicate(
    tmp_path: Path,
) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction()]},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)
    inbox.accept(_pending(inbox)[0]["entry_id"])

    pluggy.sync_item(ITEM_ID)

    assert _pending(inbox) == []
    assert len(services.transaction_service.list_transactions()) == 1


def test_linking_an_existing_entry_creates_nothing(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction()]},
    )
    services.transaction_service.create_expense(
        transaction_id="manual-1",
        occurred_at="2026-08-20T12:00:00Z",
        amount=12_550,
        account_id="acc-nubank",
        payment_method="PIX",
        category_id="supermercado",
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)
    entry = _pending(inbox)[0]

    linked = inbox.link_existing(entry["entry_id"], local_id="manual-1")

    assert linked["decision"] == "duplicate"
    assert len(services.transaction_service.list_transactions()) == 1


def _open_an_invoice(services: AppServices, *, amount: int = 500_00) -> dict[str, Any]:
    """Put a purchase on the card so there is an invoice to pay."""
    services.card_purchase_service.create_card_purchase(
        purchase_id="compra-local",
        purchase_date="2026-08-10T12:00:00Z",
        amount=amount,
        installments_count=1,
        category_id="vestuario",
        card_id="card-bradesco",
        description="Loja",
    )
    invoices = services.invoice_payment_service.list_invoices("card-bradesco")
    assert len(invoices) == 1
    return invoices[0]


def test_paying_the_bill_settles_the_invoice_and_debits_the_account_once(
    tmp_path: Path,
) -> None:
    """The bank leg must not survive as its own expense.

    ``InvoicePaid`` already writes the expense and moves the balance, so
    accepting both legs would charge the payment twice.
    """
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[
            {"id": CARD_ID, "type": "CREDIT", "name": "Cartão"},
            {"id": BANK_ID, "type": "BANK", "name": "Conta"},
        ],
        transactions={
            CARD_ID: [
                _card_transaction(
                    id="pay-1",
                    type="CREDIT",
                    amount=-500.00,
                    date="2026-09-05T12:00:00Z",
                    description="Pagamento recebido",
                )
            ],
            BANK_ID: [
                _bank_transaction(
                    id="debito-fatura",
                    amount=500.00,
                    date="2026-09-05T12:00:00Z",
                    description="PAGTO CARTAO BRADESCO",
                )
            ],
        },
    )
    invoice = _open_an_invoice(services)
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    pending = _pending(inbox)
    assert [entry["kind"] for entry in pending] == ["invoice_payment"]
    entry = pending[0]
    assert entry["proposal"]["payload"]["account_id"] == "acc-nubank"
    assert entry["proposal"]["payload"]["invoice_id"] == invoice["invoice_id"]

    inbox.accept(entry["entry_id"])

    settled = services.invoice_payment_service.get_invoice(str(invoice["invoice_id"]))
    assert settled["paid_amount"] == 500_00
    assert settled["remaining_amount"] == 0
    # One expense for the payment, and nothing left over from the bank leg.
    assert len(services.transaction_service.list_transactions()) == 1


def test_the_bank_leg_of_a_bill_payment_is_hidden_but_kept(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[
            {"id": CARD_ID, "type": "CREDIT", "name": "Cartão"},
            {"id": BANK_ID, "type": "BANK", "name": "Conta"},
        ],
        transactions={
            CARD_ID: [
                _card_transaction(
                    id="pay-1",
                    type="CREDIT",
                    amount=-500.00,
                    date="2026-09-05T12:00:00Z",
                )
            ],
            BANK_ID: [
                _bank_transaction(
                    id="debito-fatura",
                    amount=500.00,
                    date="2026-09-05T12:00:00Z",
                )
            ],
        },
    )
    _open_an_invoice(services)
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    covered = [
        entry
        for entry in inbox.list_entries(include_covered=True)["entries"]
        if entry["kind"] == "invoice_payment_covered"
    ]

    assert [entry["external_id"] for entry in covered] == ["debito-fatura"]
    assert covered[0]["match_kind"] == "covered_by_group"


def test_an_ambiguous_bank_leg_is_left_visible(tmp_path: Path) -> None:
    """Two candidates mean we cannot tell which one paid the bill.

    Hiding the wrong expense loses a real transaction, so nothing is hidden and
    the payment falls back to the card's own paying account.
    """
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[
            {"id": CARD_ID, "type": "CREDIT", "name": "Cartão"},
            {"id": BANK_ID, "type": "BANK", "name": "Conta"},
        ],
        transactions={
            CARD_ID: [
                _card_transaction(
                    id="pay-1",
                    type="CREDIT",
                    amount=-500.00,
                    date="2026-09-05T12:00:00Z",
                )
            ],
            BANK_ID: [
                _bank_transaction(
                    id="debito-a",
                    amount=500.00,
                    date="2026-09-05T12:00:00Z",
                ),
                _bank_transaction(
                    id="debito-b",
                    amount=500.00,
                    date="2026-09-06T12:00:00Z",
                ),
            ],
        },
    )
    _open_an_invoice(services)
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    kinds = sorted(entry["kind"] for entry in _pending(inbox))

    assert kinds == ["bank_transaction", "bank_transaction", "invoice_payment"]


def test_a_bill_paid_from_an_unconnected_account_uses_the_cards_own_account(
    tmp_path: Path,
) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão"}],
        transactions={
            CARD_ID: [
                _card_transaction(
                    id="pay-1",
                    type="CREDIT",
                    amount=-500.00,
                    date="2026-09-05T12:00:00Z",
                )
            ]
        },
    )
    _open_an_invoice(services)
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    entry = _pending(inbox)[0]

    assert entry["kind"] == "invoice_payment"
    assert entry["proposal"]["payload"]["account_id"] == "acc-nubank"


def test_a_payment_with_no_invoice_in_range_asks_for_one(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão"}],
        transactions={
            CARD_ID: [
                _card_transaction(
                    id="pay-1",
                    type="CREDIT",
                    amount=-500.00,
                    # Months away from the only invoice's due date.
                    date="2026-12-20T12:00:00Z",
                )
            ]
        },
    )
    _open_an_invoice(services)
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    entry = _pending(inbox)[0]

    assert entry["proposal"]["payload"]["invoice_id"] is None
    with pytest.raises(UnresolvedInvoiceError):
        inbox.accept(entry["entry_id"])


def test_a_transfer_between_own_accounts_becomes_one_entry(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[
            {"id": BANK_ID, "type": "BANK", "name": "Conta"},
            {"id": SECOND_BANK_ID, "type": "BANK", "name": "Poupança"},
        ],
        transactions={
            BANK_ID: [
                _bank_transaction(
                    id="saida",
                    amount=300.00,
                    description="Transferência enviada",
                    paymentData={"paymentMethod": "PIX", "authenticationCode": "E123"},
                )
            ],
            SECOND_BANK_ID: [
                _bank_transaction(
                    id="entrada",
                    type="CREDIT",
                    amount=300.00,
                    description="Transferência recebida",
                    paymentData={"paymentMethod": "PIX", "authenticationCode": "E123"},
                )
            ],
        },
    )
    services.account_service.create_account(
        account_id="acc-poupanca",
        name="Poupança",
        account_type="savings",
        initial_balance=0,
    )
    pluggy.sync_item(ITEM_ID)
    _link_two_banks(pluggy)
    pluggy.sync_item(ITEM_ID)

    pending = _pending(inbox)
    assert [entry["kind"] for entry in pending] == ["transfer"]
    payload = pending[0]["proposal"]["payload"]
    assert payload["from_account_id"] == "acc-nubank"
    assert payload["to_account_id"] == "acc-poupanca"

    inbox.accept(pending[0]["entry_id"])

    transactions = services.transaction_service.list_transactions()
    assert len(transactions) == 2
    assert {row["account_id"] for row in transactions} == {
        "acc-nubank",
        "acc-poupanca",
    }
    assert all(row["transfer_id"] for row in transactions)


def test_legs_with_different_authentication_codes_are_not_a_transfer(
    tmp_path: Path,
) -> None:
    """Same amount, same day, unrelated movements.

    The code is what proves the two legs are the same money; when both sides
    carry one and they disagree, the amount coinciding means nothing.
    """
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[
            {"id": BANK_ID, "type": "BANK", "name": "Conta"},
            {"id": SECOND_BANK_ID, "type": "BANK", "name": "Poupança"},
        ],
        transactions={
            BANK_ID: [
                _bank_transaction(
                    id="saida",
                    amount=300.00,
                    paymentData={"authenticationCode": "E123"},
                )
            ],
            SECOND_BANK_ID: [
                _bank_transaction(
                    id="entrada",
                    type="CREDIT",
                    amount=300.00,
                    paymentData={"authenticationCode": "OUTRO"},
                )
            ],
        },
    )
    services.account_service.create_account(
        account_id="acc-poupanca",
        name="Poupança",
        account_type="savings",
        initial_balance=0,
    )
    pluggy.sync_item(ITEM_ID)
    _link_two_banks(pluggy)
    pluggy.sync_item(ITEM_ID)

    kinds = sorted(entry["kind"] for entry in _pending(inbox))

    assert kinds == ["bank_transaction", "bank_transaction"]


def test_accept_batch_reports_what_failed(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={
            BANK_ID: [
                _bank_transaction(id="tx-ok"),
                _bank_transaction(id="tx-sem-categoria", category=None, amount=99.0),
            ]
        },
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)
    entry_ids = [entry["entry_id"] for entry in _pending(inbox)]

    result = inbox.accept_batch(entry_ids)

    assert len(result["accepted"]) == 1
    assert len(result["failed"]) == 1
    assert "categoria" in result["failed"][0]["detail"]
    assert len(services.transaction_service.list_transactions()) == 1


def test_accepting_an_unknown_entry_fails(tmp_path: Path) -> None:
    _, inbox, _ = _setup(tmp_path, accounts=[], transactions={})

    with pytest.raises(StagedEntryNotFoundError):
        inbox.accept("nao-existe")


SECOND_ITEM_ID = "55555555-5555-5555-5555-555555555555"


class _MultiItemGateway:
    def __init__(self, snapshots: dict[str, dict[str, Any]]) -> None:
        self._snapshots = snapshots

    def create_connect_token(self, *, client_user_id, item_id=None) -> str:
        return "token"

    def fetch_snapshot(self, *, item_id: str) -> dict[str, Any]:
        return self._snapshots[item_id]


def _snapshot(item_id: str, accounts: list, transactions: dict) -> dict[str, Any]:
    return {
        "item": {
            "id": item_id,
            "status": "UPDATED",
            "executionStatus": "SUCCESS",
            "connector": {"name": "MeuPluggy"},
        },
        "accounts": accounts,
        "transactions": transactions,
        "investments": [],
    }


def test_a_bill_paid_from_another_connection_is_still_paired(tmp_path: Path) -> None:
    """The card and the account that pays it can sit in different connections.

    A snapshot only covers one, so the pair is only visible once both have been
    staged — which is what the reconciliation pass is for.
    """
    database_url = f"sqlite:///{(tmp_path / 'app.db').as_posix()}"
    services = build_services(
        database_url=database_url,
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    store = PluggyStore(database_url)
    inbox = PluggyInboxService(
        store=store,
        account_service=services.account_service,
        card_service=services.card_service,
        card_purchase_service=services.card_purchase_service,
        transaction_service=services.transaction_service,
        invoice_payment_service=services.invoice_payment_service,
        transfer_service=services.transfer_service,
    )
    gateway = _MultiItemGateway(
        {
            ITEM_ID: _snapshot(
                ITEM_ID,
                [{"id": CARD_ID, "type": "CREDIT", "name": "Cartão"}],
                {
                    CARD_ID: [
                        _card_transaction(
                            id="pay-1",
                            type="CREDIT",
                            amount=-500.00,
                            date="2026-09-05T12:00:00Z",
                        )
                    ]
                },
            ),
            SECOND_ITEM_ID: _snapshot(
                SECOND_ITEM_ID,
                [{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
                {
                    BANK_ID: [
                        _bank_transaction(
                            id="debito-fatura",
                            amount=500.00,
                            date="2026-09-05T12:00:00Z",
                        )
                    ]
                },
            ),
        }
    )
    pluggy = PluggyService(
        gateway,
        store=store,
        account_service=services.account_service,
        card_service=services.card_service,
        card_purchase_service=services.card_purchase_service,
        transaction_service=services.transaction_service,
        investment_service=services.investment_service,
        inbox_service=inbox,
    )
    for item_id in (ITEM_ID, SECOND_ITEM_ID):
        pluggy.register_item(item_id=item_id, client_user_id="meucofri-owner")

    for account_id, name in (("acc-nubank", "Nubank"), ("acc-outra", "Outra")):
        services.account_service.create_account(
            account_id=account_id,
            name=name,
            account_type="checking",
            initial_balance=0,
        )
    # The card's own paying account is deliberately NOT the connected one, so
    # the account on the proposal proves the legs were paired.
    services.card_service.create_card(
        card_id="card-bradesco",
        name="Bradesco Visa Infinite",
        limit_amount=600_000,
        closing_day=24,
        due_day=5,
        payment_account_id="acc-outra",
    )
    services.card_purchase_service.create_card_purchase(
        purchase_id="compra-local",
        purchase_date="2026-08-10T12:00:00Z",
        amount=500_00,
        installments_count=1,
        category_id="vestuario",
        card_id="card-bradesco",
        description="Loja",
    )

    pluggy.sync_item(ITEM_ID)
    pluggy.sync_item(SECOND_ITEM_ID)
    pluggy.link_account(
        pluggy_account_id=CARD_ID,
        local_card_id="card-bradesco",
    )
    pluggy.link_account(
        pluggy_account_id=BANK_ID,
        local_account_id="acc-nubank",
    )
    pluggy.sync_item(ITEM_ID)

    # Only the card's connection has synced since linking: nothing to pair with.
    pending = _pending(inbox)
    assert [entry["kind"] for entry in pending] == ["invoice_payment"]
    assert pending[0]["proposal"]["payload"]["account_id"] == "acc-outra"

    pluggy.sync_item(SECOND_ITEM_ID)

    pending = _pending(inbox)
    assert [entry["kind"] for entry in pending] == ["invoice_payment"]
    assert pending[0]["proposal"]["payload"]["account_id"] == "acc-nubank"

    covered = [
        entry
        for entry in inbox.list_entries(include_covered=True)["entries"]
        if entry["kind"] == "invoice_payment_covered"
    ]
    assert [entry["external_id"] for entry in covered] == ["debito-fatura"]


INVESTMENT_ID = "66666666-6666-6666-6666-666666666666"


def _investment_setup(
    tmp_path: Path,
    *,
    transactions: list[dict[str, Any]],
) -> tuple[PluggyService, PluggyInboxService, AppServices]:
    database_url = f"sqlite:///{(tmp_path / 'app.db').as_posix()}"
    services = build_services(
        database_url=database_url,
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    store = PluggyStore(database_url)
    inbox = PluggyInboxService(
        store=store,
        account_service=services.account_service,
        card_service=services.card_service,
        card_purchase_service=services.card_purchase_service,
        transaction_service=services.transaction_service,
        invoice_payment_service=services.invoice_payment_service,
        transfer_service=services.transfer_service,
        investment_service=services.investment_service,
    )
    snapshot = _snapshot(ITEM_ID, [], {})
    snapshot["investments"] = [
        {
            "id": INVESTMENT_ID,
            "name": "Tesouro Selic 2029",
            "code": "SELIC2029",
            "type": "FIXED_INCOME",
        }
    ]
    snapshot["investment_transactions"] = {INVESTMENT_ID: transactions}

    pluggy = PluggyService(
        _Gateway(snapshot),
        store=store,
        account_service=services.account_service,
        card_service=services.card_service,
        card_purchase_service=services.card_purchase_service,
        transaction_service=services.transaction_service,
        investment_service=services.investment_service,
        inbox_service=inbox,
    )
    pluggy.register_item(item_id=ITEM_ID, client_user_id="meucofri-owner")
    services.account_service.create_account(
        account_id="acc-nubank",
        name="Nubank",
        account_type="checking",
        initial_balance=1_000_00,
    )
    return pluggy, inbox, services


def _investment_transaction(**overrides: Any) -> dict[str, Any]:
    return {
        "id": "inv-tx-1",
        "type": "BUY",
        "tradeDate": "2026-08-14T00:00:00Z",
        "date": "2026-08-15T00:00:00Z",
        "quantity": 10,
        "value": 50.0,
        "amount": 500.0,
        "description": "Aplicação Tesouro Selic",
        **overrides,
    }


def test_an_investment_is_discovered_so_it_can_be_pointed_at_an_account(
    tmp_path: Path,
) -> None:
    pluggy, inbox, _ = _investment_setup(
        tmp_path,
        transactions=[_investment_transaction()],
    )

    pluggy.sync_item(ITEM_ID)

    discovered = pluggy.list_accounts()["accounts"]
    assert [item["kind"] for item in discovered] == ["investment"]
    assert discovered[0]["display_name"] == "Tesouro Selic 2029"
    # Nothing is staged until the user says where the money comes from.
    assert _pending(inbox) == []


def test_a_buy_becomes_a_purchase_movement_on_the_chosen_account(
    tmp_path: Path,
) -> None:
    pluggy, inbox, services = _investment_setup(
        tmp_path,
        transactions=[_investment_transaction()],
    )
    pluggy.sync_item(ITEM_ID)
    pluggy.link_account(
        pluggy_account_id=INVESTMENT_ID,
        local_account_id="acc-nubank",
    )
    pluggy.sync_item(ITEM_ID)

    entry = _pending(inbox)[0]
    assert entry["kind"] == "investment_movement"
    assert entry["amount"] == 500_00
    payload = entry["proposal"]["payload"]
    assert payload["movement_type"] == "compra"
    assert payload["asset_ticker"] == "SELIC2029"
    # The trade date is what the user remembers, not the settlement date.
    assert payload["occurred_at"].startswith("2026-08-14")
    # Pluggy's own taxonomy must not become a local asset class.
    assert payload["asset_class"] is None

    inbox.accept(entry["entry_id"])

    movements = services.investment_service.list_movements()
    assert len(movements) == 1
    assert movements[0]["type"] == "compra"
    assert movements[0]["asset_ticker"] == "SELIC2029"


def test_a_sell_becomes_a_sale_movement(tmp_path: Path) -> None:
    pluggy, inbox, services = _investment_setup(
        tmp_path,
        transactions=[
            _investment_transaction(id="inv-tx-2", type="SELL", amount=200.0)
        ],
    )
    pluggy.sync_item(ITEM_ID)
    pluggy.link_account(
        pluggy_account_id=INVESTMENT_ID,
        local_account_id="acc-nubank",
    )
    pluggy.sync_item(ITEM_ID)

    entry = _pending(inbox)[0]
    inbox.accept(entry["entry_id"])

    movements = services.investment_service.list_movements()
    assert [movement["type"] for movement in movements] == ["venda"]


def test_transaction_types_that_are_not_a_buy_or_a_sell_are_left_alone(
    tmp_path: Path,
) -> None:
    """Custody transfers and amortisations move no money of the user's."""
    pluggy, inbox, _ = _investment_setup(
        tmp_path,
        transactions=[
            _investment_transaction(id="inv-tx-3", type="TRANSFER"),
            _investment_transaction(id="inv-tx-4", type="AMORTIZATION"),
        ],
    )
    pluggy.sync_item(ITEM_ID)
    pluggy.link_account(
        pluggy_account_id=INVESTMENT_ID,
        local_account_id="acc-nubank",
    )
    pluggy.sync_item(ITEM_ID)

    assert _pending(inbox) == []


def test_an_ignored_investment_stages_nothing(tmp_path: Path) -> None:
    pluggy, inbox, _ = _investment_setup(
        tmp_path,
        transactions=[_investment_transaction()],
    )
    pluggy.sync_item(ITEM_ID)
    pluggy.link_account(pluggy_account_id=INVESTMENT_ID, ignored=True)
    pluggy.sync_item(ITEM_ID)

    assert _pending(inbox) == []


def test_import_since_cuts_older_investment_trades(tmp_path: Path) -> None:
    pluggy, inbox, _ = _investment_setup(
        tmp_path,
        transactions=[
            _investment_transaction(id="antiga", tradeDate="2026-01-10T00:00:00Z"),
            _investment_transaction(id="nova", tradeDate="2026-08-14T00:00:00Z"),
        ],
    )
    pluggy.sync_item(ITEM_ID)
    pluggy.link_account(
        pluggy_account_id=INVESTMENT_ID,
        local_account_id="acc-nubank",
        import_since="2026-08-01",
    )
    pluggy.sync_item(ITEM_ID)

    assert [entry["external_id"] for entry in _pending(inbox)] == ["nova"]


def test_the_physical_cards_that_spent_are_read_back_from_what_was_staged(
    tmp_path: Path,
) -> None:
    """An issuer bills one account for a card and all of its additionals.

    Only creditCardMetadata.cardNumber says which plastic paid, so the numbers
    have to be recovered from the transactions to be mapped to a holder.
    """
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "VISA INFINITE"}],
        transactions={
            CARD_ID: [
                _card_transaction(
                    id="titular-1",
                    amount=100.0,
                    description="Mercado",
                    creditCardMetadata={"cardNumber": "8715"},
                ),
                _card_transaction(
                    id="adicional-1",
                    amount=50.0,
                    description="Farmácia",
                    creditCardMetadata={"cardNumber": "1234"},
                ),
                _card_transaction(
                    id="adicional-2",
                    amount=25.0,
                    description="Padaria",
                    creditCardMetadata={"cardNumber": "1234"},
                ),
            ]
        },
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)
    services.card_service.upsert_holder(
        card_id="card-bradesco",
        holder_id="holder-duda",
        name="Duda",
        last_four="1234",
    )

    result = inbox.list_card_numbers(CARD_ID)

    assert result["local_card_id"] == "card-bradesco"
    numbers = result["card_numbers"]
    # Busiest first, so the plastic that spends most is the easiest to map.
    assert [item["last_four"] for item in numbers] == ["1234", "8715"]
    assert numbers[0]["purchase_count"] == 2
    assert numbers[0]["total_amount"] == 75_00
    assert numbers[0]["holder_id"] == "holder-duda"
    assert numbers[0]["holder_name"] == "Duda"
    # The titular's own plastic has no holder of its own yet.
    assert numbers[1]["holder_id"] is None


def test_a_card_purchase_enters_even_while_the_invoice_is_open(
    tmp_path: Path,
) -> None:
    """Waiting for the bill to close means a month of blindness.

    The purchase is real the moment it is made, so it is proposed right away
    and carries the status it came with.
    """
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão"}],
        transactions={
            CARD_ID: [
                _card_transaction(id="aberta-1", status="PENDING"),
                _card_transaction(id="aberta-2", status="PENDING", amount=40.0),
                _card_transaction(id="fechada-1", status="POSTED", amount=25.0),
            ]
        },
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)

    result = pluggy.sync_item(ITEM_ID)

    assert result["entries_skipped"] == {}
    assert sorted(entry["external_id"] for entry in _pending(inbox)) == [
        "aberta-1",
        "aberta-2",
        "fechada-1",
    ]
    by_id = {entry["external_id"]: entry for entry in _pending(inbox)}
    assert by_id["aberta-1"]["proposal"]["source_status"] == "PENDING"
    assert by_id["fechada-1"]["proposal"]["source_status"] == "POSTED"


def test_a_pending_bank_transaction_still_waits(tmp_path: Path) -> None:
    """It has not moved the balance, so importing it would post money that
    has not left the account."""
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction(status="PENDING")]},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)

    result = pluggy.sync_item(ITEM_ID)

    assert result["entries_skipped"] == {"not_posted": 1}
    assert _pending(inbox) == []


def test_a_revised_open_invoice_purchase_reopens_for_review(tmp_path: Path) -> None:
    """An issuer can still change an amount before the bill closes."""
    snapshot_transactions = {
        CARD_ID: [_card_transaction(id="aberta-1", status="PENDING", amount=30.0)]
    }
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão"}],
        transactions=snapshot_transactions,
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    entry = _pending(inbox)[0]
    inbox.ignore(entry["entry_id"])
    assert _pending(inbox) == []

    # The issuer settles it at a different amount.
    snapshot_transactions[CARD_ID][0]["amount"] = 34.5
    snapshot_transactions[CARD_ID][0]["status"] = "POSTED"
    pluggy.sync_item(ITEM_ID)

    reopened = _pending(inbox)
    assert [item["external_id"] for item in reopened] == ["aberta-1"]
    assert reopened[0]["revised"] is True
    assert reopened[0]["amount"] == 34_50


def test_a_transaction_before_the_cut_off_is_reported_as_such(tmp_path: Path) -> None:
    pluggy, _, _ = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={
            BANK_ID: [
                _bank_transaction(id="antiga", date="2026-01-05T12:00:00Z"),
                _bank_transaction(id="nova", date="2026-08-20T12:00:00Z"),
            ]
        },
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy, import_since="2026-08-01")

    result = pluggy.sync_item(ITEM_ID)

    assert result["entries_skipped"] == {"before_import_since": 1}
    assert result["entries_pending"] == 1


def test_an_imported_subscription_confirms_the_fixed_expense_instead_of_doubling_it(
    tmp_path: Path,
) -> None:
    """A fixed expense is already projected onto the invoice.

    The projector settles a pending by the purchase id, so an imported charge
    that keeps its own id would leave the forecast standing next to it and the
    month would count the subscription twice.
    """
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão"}],
        transactions={
            CARD_ID: [
                _card_transaction(
                    id="netflix-08",
                    amount=55.90,
                    date="2026-08-12T12:00:00Z",
                    description="NETFLIX.COM",
                )
            ]
        },
    )
    services.recurring_service.create_rule(
        rule_id="rule-netflix",
        name="Netflix",
        amount=55_90,
        due_day=12,
        account_id=None,
        card_id="card-bradesco",
        payment_method="CARD",
        category_id="lazer-shopping",
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    entry = _pending(inbox)[0]
    # The reviewer is told what accepting will settle.
    assert entry["proposal"]["settles_pending"] == "Netflix"

    inbox.accept(entry["entry_id"], overrides={"category_id": "lazer-shopping"})

    pendings = services.recurring_service.list_pendings(month="2026-08")
    netflix = next(item for item in pendings if item["name"] == "Netflix")
    assert netflix["status"] == "confirmed"
    # One charge on the invoice, not the forecast plus an imported twin.
    purchases = services.card_purchase_service.list_card_purchases()
    assert len(purchases) == 1


def test_a_bank_debit_can_be_reclassified_as_an_investment(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={
            BANK_ID: [
                _bank_transaction(
                    amount=6645.43,
                    description="Aplicação RDB",
                    category=None,
                )
            ]
        },
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    entry = _pending(inbox)[0]
    inbox.accept(
        entry["entry_id"],
        target_kind="investment_movement",
        overrides={
            "movement_type": "contribution",
            "account_id": "acc-nubank",
            "occurred_at": entry["occurred_at"],
            "amount": entry["amount"],
            "cash_amount": entry["amount"],
            "invested_amount": entry["amount"],
            "contribution_amount": entry["amount"],
        },
        remember=True,
    )

    assert services.transaction_service.list_transactions() == []
    movements = services.investment_service.list_movements()
    assert len(movements) == 1
    assert movements[0]["type"] == "contribution"
    assert movements[0]["invested_amount"] == 6645_43
    assert inbox.list_rules()["rules"][0]["set_kind"] == "investment_movement"


def test_a_bank_debit_can_confirm_a_selected_fixed_expense(tmp_path: Path) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={
            BANK_ID: [
                _bank_transaction(
                    amount=450.00,
                    date="2026-08-03T12:00:00Z",
                    description="CONDOMINIO EDIFICIO",
                    category=None,
                )
            ]
        },
    )
    services.recurring_service.create_rule(
        rule_id="rule-condo",
        name="Condomínio",
        amount=450_00,
        due_day=3,
        account_id="acc-nubank",
        card_id=None,
        payment_method="PIX",
        category_id="moradia",
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    entry = _pending(inbox)[0]
    accepted = inbox.accept(
        entry["entry_id"],
        overrides={"recurring_rule_id": "rule-condo"},
        remember=True,
        target_kind="bank_transaction",
    )

    assert accepted["created_local_id"] == "rule-condo:2026-08:expense"
    condo = services.recurring_service.list_pendings(month="2026-08")[0]
    assert condo["status"] == "confirmed"
    assert len(services.transaction_service.list_transactions()) == 1
    rule = inbox.list_rules()["rules"][0]
    assert rule["set_recurring_rule_id"] == "rule-condo"
    assert rule["set_kind"] == "bank_transaction"


def test_a_purchase_that_is_not_the_fixed_expense_keeps_its_own_id(
    tmp_path: Path,
) -> None:
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão"}],
        transactions={
            CARD_ID: [
                _card_transaction(
                    id="mercado-1",
                    amount=88.00,
                    date="2026-08-12T12:00:00Z",
                    description="Supermercado",
                )
            ]
        },
    )
    services.recurring_service.create_rule(
        rule_id="rule-netflix",
        name="Netflix",
        amount=55_90,
        due_day=12,
        account_id=None,
        card_id="card-bradesco",
        payment_method="CARD",
        category_id="lazer-shopping",
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    entry = _pending(inbox)[0]
    assert entry["proposal"]["settles_pending"] is None

    inbox.accept(entry["entry_id"], overrides={"category_id": "supermercado"})

    pendings = services.recurring_service.list_pendings(month="2026-08")
    netflix = next(item for item in pendings if item["name"] == "Netflix")
    assert netflix["status"] == "pending"


def test_two_fixed_expenses_of_the_same_amount_are_left_to_the_user(
    tmp_path: Path,
) -> None:
    """Settling the wrong subscription is worse than confirming it by hand."""
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão"}],
        transactions={
            CARD_ID: [
                _card_transaction(
                    id="assinatura",
                    amount=55.90,
                    date="2026-08-12T12:00:00Z",
                )
            ]
        },
    )
    for rule_id, name in (("rule-a", "Netflix"), ("rule-b", "Spotify Família")):
        services.recurring_service.create_rule(
            rule_id=rule_id,
            name=name,
            amount=55_90,
            due_day=12,
            account_id=None,
            card_id="card-bradesco",
            payment_method="CARD",
            category_id="lazer-shopping",
        )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    entry = _pending(inbox)[0]

    assert entry["proposal"]["settles_pending"] is None


def test_an_installment_purchase_already_typed_by_hand_is_offered_as_a_duplicate(
    tmp_path: Path,
) -> None:
    """The app stores one purchase; Pluggy sends one transaction per invoice.

    The rebuilt purchase carries the original date and the full total, which is
    exactly what the manual entry holds, so the two line up.
    """
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão"}],
        transactions={CARD_ID: [_installment(number) for number in (1, 2, 3)]},
    )
    services.card_purchase_service.create_card_purchase(
        purchase_id="notebook-manual",
        purchase_date="2026-07-10T12:00:00Z",
        amount=300_00,
        installments_count=3,
        category_id="compras-online",
        card_id="card-bradesco",
        description="Notebook",
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    pending = _pending(inbox)

    assert len(pending) == 1
    assert pending[0]["match_kind"] == "duplicate_of_local"
    assert pending[0]["matched_local_id"] == "notebook-manual"

    inbox.link_existing(pending[0]["entry_id"], local_id="notebook-manual")

    # Linking records the match without creating a second purchase.
    assert len(services.card_purchase_service.list_card_purchases()) == 1


def test_an_installment_purchase_typed_with_a_different_total_is_not_matched(
    tmp_path: Path,
) -> None:
    """A near miss must stay visible: hiding it would lose the purchase."""
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "Cartão"}],
        transactions={CARD_ID: [_installment(number) for number in (1, 2, 3)]},
    )
    services.card_purchase_service.create_card_purchase(
        purchase_id="notebook-manual",
        purchase_date="2026-07-10T12:00:00Z",
        amount=299_00,
        installments_count=3,
        category_id="compras-online",
        card_id="card-bradesco",
        description="Notebook",
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    assert _pending(inbox)[0]["match_kind"] == "new"


def test_an_additionals_purchase_names_its_holder_and_keeps_it_on_accept(
    tmp_path: Path,
) -> None:
    """The holder comes from the plastic that spent, not from the account.

    Accepting must not lose it: the whole point of holders is that an
    additional's spend lands on the additional.
    """
    pluggy, inbox, services = _setup(
        tmp_path,
        accounts=[{"id": CARD_ID, "type": "CREDIT", "name": "VISA INFINITE"}],
        transactions={
            CARD_ID: [
                _card_transaction(
                    id="da-duda",
                    creditCardMetadata={"cardNumber": "9873"},
                ),
                _card_transaction(
                    id="do-titular",
                    amount=70.0,
                    creditCardMetadata={"cardNumber": "9874"},
                ),
            ]
        },
    )
    services.card_service.upsert_holder(
        card_id="card-bradesco",
        holder_id="holder-duda",
        name="Duda",
        last_four="9873",
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    by_id = {entry["external_id"]: entry for entry in _pending(inbox)}
    assert by_id["da-duda"]["proposal"]["holder_name"] == "Duda"
    # The titular's own plastic has no holder, which is what marks it.
    assert by_id["do-titular"]["proposal"]["holder_name"] is None

    inbox.accept(
        by_id["da-duda"]["entry_id"],
        overrides={"category_id": "vestuario"},
    )

    purchase = services.card_purchase_service.list_card_purchases()[0]
    assert purchase["holder_id"] == "holder-duda"
    assert purchase["card_id"] == "card-bradesco"


def test_a_remembered_description_pre_fills_the_next_one(tmp_path: Path) -> None:
    """The rule fills the form; it never decides.

    The second charge still arrives pending — what changed is that the
    category is already there instead of blank.
    """
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={
            BANK_ID: [
                _bank_transaction(
                    id="cometa-1",
                    description="SUPERMERCADO COMETA LTDA - DOCTO: 8812",
                    category=None,
                )
            ]
        },
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    first = _pending(inbox)[0]
    assert first["proposal"]["payload"]["category_id"] is None

    inbox.accept(
        first["entry_id"],
        overrides={"category_id": "supermercado"},
        remember=True,
    )

    # The same shop next month, with a different document number.
    pluggy._gateway._snapshot["transactions"][BANK_ID] = [
        _bank_transaction(
            id="cometa-2",
            description="SUPERMERCADO COMETA LTDA - DOCTO: 9427",
            category=None,
            date="2026-08-27T12:00:00Z",
        )
    ]
    pluggy.sync_item(ITEM_ID)

    second = _pending(inbox)[0]
    assert second["external_id"] == "cometa-2"
    assert second["proposal"]["payload"]["category_id"] == "supermercado"
    # Still waiting for a click.
    assert second["decision"] == "pending"


def test_a_rule_is_listed_and_can_be_removed(tmp_path: Path) -> None:
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction()]},
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)
    inbox.accept(
        _pending(inbox)[0]["entry_id"],
        overrides={"category_id": "supermercado"},
        remember=True,
    )

    rules = inbox.list_rules()["rules"]
    assert len(rules) == 1
    assert rules[0]["set_category_id"] == "supermercado"
    assert rules[0]["label"] == "Padaria"

    inbox.delete_rule(rules[0]["rule_id"])

    assert inbox.list_rules()["rules"] == []


def test_a_rule_written_by_hand_pre_fills_too(tmp_path: Path) -> None:
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={
            BANK_ID: [_bank_transaction(description="99 FOOD LTDA.", category=None)]
        },
    )
    inbox.save_rule(
        {"match_value": "99 FOOD LTDA.", "label": "99 Food", "set_category_id": "alimentacao"}
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    assert _pending(inbox)[0]["proposal"]["payload"]["category_id"] == "alimentacao"


def test_a_rule_never_moves_a_purchase_to_another_card(tmp_path: Path) -> None:
    """A rule fills blanks on the entry it matches, not the destination.

    The card a charge came from is a fact of the transaction; letting a
    remembered description override it would move real spend.
    """
    pluggy, inbox, _ = _setup(
        tmp_path,
        accounts=[{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
        transactions={BANK_ID: [_bank_transaction(category=None)]},
    )
    inbox.save_rule(
        {
            "match_value": "Padaria",
            "set_category_id": "supermercado",
            "set_card_id": "card-bradesco",
        }
    )
    pluggy.sync_item(ITEM_ID)
    _link_all(pluggy)
    pluggy.sync_item(ITEM_ID)

    payload = _pending(inbox)[0]["proposal"]["payload"]
    assert payload["category_id"] == "supermercado"
    # A bank transaction has no card_id to fill, so the rule adds none.
    assert "card_id" not in payload
    assert payload["account_id"] == "acc-nubank"
