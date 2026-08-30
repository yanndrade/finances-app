"""Account discovery and pairing.

A sync must never write to the event store: entries only get there through the
review inbox, so syncing against a database that already has months of manual
history cannot duplicate or overwrite anything.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from finance_app.application.pluggy import (
    PluggyAccountNotFoundError,
    PluggyLinkError,
    PluggyService,
)
from finance_app.infrastructure.pluggy_store import PluggyStore
from finance_app.interfaces.http.bootstrap import AppServices, build_services

ITEM_ID = "11111111-1111-1111-1111-111111111111"
BANK_ID = "22222222-2222-2222-2222-222222222222"
CARD_ID = "33333333-3333-3333-3333-333333333333"


def _sync(
    tmp_path: Path,
    accounts: list[dict],
) -> tuple[PluggyService, AppServices]:
    class SnapshotGateway:
        def create_connect_token(self, *, client_user_id, item_id=None) -> str:
            return "token"

        def fetch_snapshot(self, *, item_id: str):
            return {
                "item": {
                    "id": item_id,
                    "status": "UPDATED",
                    "executionStatus": "SUCCESS",
                    "connector": {"name": "MeuPluggy"},
                },
                "accounts": accounts,
                "transactions": {},
                "investments": [],
            }

    database_url = f"sqlite:///{(tmp_path / 'app.db').as_posix()}"
    services = build_services(
        database_url=database_url,
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    pluggy = PluggyService(
        SnapshotGateway(),
        store=PluggyStore(database_url),
        account_service=services.account_service,
        card_service=services.card_service,
        card_purchase_service=services.card_purchase_service,
        transaction_service=services.transaction_service,
        investment_service=services.investment_service,
    )
    pluggy.register_item(item_id=ITEM_ID, client_user_id="meucofri-owner")
    pluggy.sync_item(ITEM_ID)
    return pluggy, services


def _seed_card(services: AppServices) -> None:
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


def test_sync_discovers_accounts_without_importing_anything(tmp_path: Path) -> None:
    pluggy, services = _sync(
        tmp_path,
        [
            {
                "id": BANK_ID,
                "type": "BANK",
                "subtype": "CHECKING_ACCOUNT",
                "name": "Conta corrente",
                "number": "1234-5",
                "balance": 125.50,
            },
            {
                "id": CARD_ID,
                "type": "CREDIT",
                "subtype": "CREDIT_CARD",
                "name": "Cartão",
                "number": "4321",
                "balance": 30,
                "creditData": {
                    "creditLimit": 1000,
                    "brand": "Visa",
                    "holderType": "ADDITIONAL",
                    "status": "ACTIVE",
                },
            },
            {
                "id": "99999999-9999-9999-9999-999999999999",
                "type": "LOAN",
                "name": "Empréstimo",
            },
        ],
    )

    result = pluggy.sync_item(ITEM_ID)

    # LOAN is not a type the app models, so it is skipped.
    assert result["accounts_discovered"] == 2
    assert result["accounts_pending"] == 2
    assert result["accounts_linked"] == 0

    assert services.account_service.list_accounts() == []
    assert services.card_service.list_cards() == []
    assert services.transaction_service.list_transactions() == []
    assert services.card_purchase_service.list_card_purchases() == []
    assert services.investment_service.list_assets() == []

    discovered = {
        account["pluggy_account_id"]: account
        for account in pluggy.list_accounts()["accounts"]
    }
    assert discovered[CARD_ID]["kind"] == "credit"
    assert discovered[CARD_ID]["number"] == "4321"
    assert discovered[CARD_ID]["brand"] == "Visa"
    assert discovered[CARD_ID]["holder_type"] == "ADDITIONAL"
    assert discovered[BANK_ID]["kind"] == "bank"


def test_sync_is_idempotent(tmp_path: Path) -> None:
    pluggy, _ = _sync(
        tmp_path,
        [{"id": BANK_ID, "type": "BANK", "name": "Conta corrente"}],
    )

    first = pluggy.sync_item(ITEM_ID)
    second = pluggy.sync_item(ITEM_ID)

    assert first == second
    assert len(pluggy.list_accounts()["accounts"]) == 1


def test_suggests_the_holder_whose_last_four_matches_the_card(tmp_path: Path) -> None:
    pluggy, services = _sync(
        tmp_path,
        [
            {
                "id": CARD_ID,
                "type": "CREDIT",
                "name": "Cartão qualquer",
                "number": "4321",
                "creditData": {"holderType": "ADDITIONAL"},
            }
        ],
    )
    _seed_card(services)
    services.card_service.upsert_holder(
        card_id="card-bradesco",
        holder_id="holder-duda",
        name="Duda",
        last_four="4321",
    )

    suggestion = pluggy.list_accounts()["accounts"][0]["suggestion"]

    assert suggestion == {
        "kind": "holder",
        "id": "holder-duda",
        "card_id": "card-bradesco",
        "label": "Duda",
        "reason": "last_four",
    }


def test_suggests_a_card_by_name_when_no_holder_matches(tmp_path: Path) -> None:
    pluggy, services = _sync(
        tmp_path,
        [{"id": CARD_ID, "type": "CREDIT", "name": "Bradesco Visa Infinite"}],
    )
    _seed_card(services)

    suggestion = pluggy.list_accounts()["accounts"][0]["suggestion"]

    assert suggestion["kind"] == "card"
    assert suggestion["id"] == "card-bradesco"
    assert suggestion["reason"] == "name"


def test_suggests_a_bank_account_by_name(tmp_path: Path) -> None:
    pluggy, services = _sync(
        tmp_path,
        [{"id": BANK_ID, "type": "BANK", "name": "Nubank"}],
    )
    services.account_service.create_account(
        account_id="acc-nubank",
        name="Nubank",
        account_type="checking",
        initial_balance=0,
    )

    suggestion = pluggy.list_accounts()["accounts"][0]["suggestion"]

    assert suggestion["kind"] == "account"
    assert suggestion["id"] == "acc-nubank"
    assert suggestion["reason"] == "name"


def test_no_suggestion_when_nothing_resembles_the_account(tmp_path: Path) -> None:
    pluggy, services = _sync(
        tmp_path,
        [{"id": BANK_ID, "type": "BANK", "name": "Banco Desconhecido"}],
    )
    services.account_service.create_account(
        account_id="acc-nubank",
        name="Nubank",
        account_type="checking",
        initial_balance=0,
    )

    assert pluggy.list_accounts()["accounts"][0]["suggestion"] is None


def test_linking_a_holder_also_records_its_card(tmp_path: Path) -> None:
    pluggy, services = _sync(
        tmp_path,
        [{"id": CARD_ID, "type": "CREDIT", "name": "Cartão", "number": "4321"}],
    )
    _seed_card(services)
    services.card_service.upsert_holder(
        card_id="card-bradesco",
        holder_id="holder-duda",
        name="Duda",
    )

    linked = pluggy.link_account(
        pluggy_account_id=CARD_ID,
        local_holder_id="holder-duda",
        import_since="2026-08-01",
    )

    assert linked["local_holder_id"] == "holder-duda"
    assert linked["local_card_id"] == "card-bradesco"
    assert linked["is_linked"] is True
    assert linked["import_since"] == "2026-08-01"


def test_a_link_survives_the_next_sync(tmp_path: Path) -> None:
    pluggy, services = _sync(
        tmp_path,
        [{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
    )
    services.account_service.create_account(
        account_id="acc-nubank",
        name="Nubank",
        account_type="checking",
        initial_balance=0,
    )
    pluggy.link_account(pluggy_account_id=BANK_ID, local_account_id="acc-nubank")

    pluggy.sync_item(ITEM_ID)

    account = pluggy.list_accounts()["accounts"][0]
    assert account["local_account_id"] == "acc-nubank"
    assert account["is_linked"] is True


def test_link_rejects_more_than_one_destination(tmp_path: Path) -> None:
    pluggy, _ = _sync(tmp_path, [{"id": BANK_ID, "type": "BANK", "name": "Conta"}])

    with pytest.raises(PluggyLinkError):
        pluggy.link_account(
            pluggy_account_id=BANK_ID,
            local_account_id="acc-nubank",
            local_card_id="card-bradesco",
        )


def test_link_rejects_ignoring_and_linking_at_once(tmp_path: Path) -> None:
    pluggy, _ = _sync(tmp_path, [{"id": BANK_ID, "type": "BANK", "name": "Conta"}])

    with pytest.raises(PluggyLinkError):
        pluggy.link_account(
            pluggy_account_id=BANK_ID,
            local_account_id="acc-nubank",
            ignored=True,
        )


def test_link_rejects_a_malformed_import_since(tmp_path: Path) -> None:
    pluggy, services = _sync(
        tmp_path,
        [{"id": BANK_ID, "type": "BANK", "name": "Conta"}],
    )
    services.account_service.create_account(
        account_id="acc-nubank",
        name="Nubank",
        account_type="checking",
        initial_balance=0,
    )

    with pytest.raises(PluggyLinkError):
        pluggy.link_account(
            pluggy_account_id=BANK_ID,
            local_account_id="acc-nubank",
            import_since="01/08/2026",
        )


def test_link_rejects_an_account_that_was_never_discovered(tmp_path: Path) -> None:
    pluggy, _ = _sync(tmp_path, [])

    with pytest.raises(PluggyAccountNotFoundError):
        pluggy.link_account(
            pluggy_account_id="unknown",
            local_account_id="acc-nubank",
        )


def test_ignoring_an_account_keeps_it_out_of_the_pending_count(tmp_path: Path) -> None:
    pluggy, _ = _sync(tmp_path, [{"id": BANK_ID, "type": "BANK", "name": "Conta"}])

    pluggy.link_account(pluggy_account_id=BANK_ID, ignored=True)
    result = pluggy.sync_item(ITEM_ID)

    assert result["accounts_pending"] == 0
    assert result["accounts_linked"] == 0


SECOND_BANK_ID = "44444444-4444-4444-4444-444444444444"


def test_two_pluggy_accounts_cannot_feed_the_same_local_account(
    tmp_path: Path,
) -> None:
    """A bank exposing the same movements twice would double every entry."""
    pluggy, services = _sync(
        tmp_path,
        [
            {
                "id": BANK_ID,
                "type": "BANK",
                "name": "Banco Bradesco",
                "number": "00028549-8",
                "subtype": "CHECKING_ACCOUNT",
            },
            {
                "id": SECOND_BANK_ID,
                "type": "BANK",
                "name": "Banco Bradesco",
                "number": "00028549-8",
                "subtype": "SAVINGS_ACCOUNT",
            },
        ],
    )
    _seed_card(services)
    pluggy.link_account(
        pluggy_account_id=BANK_ID,
        local_account_id="acc-nubank",
    )

    with pytest.raises(PluggyLinkError) as error:
        pluggy.link_account(
            pluggy_account_id=SECOND_BANK_ID,
            local_account_id="acc-nubank",
        )

    assert "duas vezes" in str(error.value).lower()


def test_the_subtype_tells_two_look_alike_accounts_apart(tmp_path: Path) -> None:
    pluggy, _ = _sync(
        tmp_path,
        [
            {
                "id": BANK_ID,
                "type": "BANK",
                "name": "Banco Bradesco",
                "number": "00028549-8",
                "subtype": "CHECKING_ACCOUNT",
                "balance": 1234.56,
            },
            {
                "id": SECOND_BANK_ID,
                "type": "BANK",
                "name": "Banco Bradesco",
                "number": "00028549-8",
                "subtype": "SAVINGS_ACCOUNT",
                "balance": 7.89,
            },
        ],
    )

    by_id = {
        account["pluggy_account_id"]: account
        for account in pluggy.list_accounts()["accounts"]
    }

    assert by_id[BANK_ID]["subtype"] == "CHECKING_ACCOUNT"
    assert by_id[BANK_ID]["balance"] == 1_234_56
    assert by_id[SECOND_BANK_ID]["subtype"] == "SAVINGS_ACCOUNT"
    assert by_id[SECOND_BANK_ID]["balance"] == 789


def test_the_name_suggestion_prefers_the_titular_over_an_additional(
    tmp_path: Path,
) -> None:
    """"VISA INFINITE" is inside both names; the closest one is meant."""
    pluggy, services = _sync(
        tmp_path,
        [
            {
                "id": CARD_ID,
                "type": "CREDIT",
                "name": "VISA INFINITE",
                "number": "8715",
            }
        ],
    )
    _seed_card(services)
    # Created after the titular so that returning the first match would fail.
    services.card_service.create_card(
        card_id="card-bradesco-valeria",
        name="Bradesco Visa Infinite - Valéria Mello",
        limit_amount=300_000,
        closing_day=24,
        due_day=5,
        payment_account_id="acc-nubank",
    )

    suggestion = pluggy.list_accounts()["accounts"][0]["suggestion"]

    assert suggestion["id"] == "card-bradesco"
    assert suggestion["label"] == "Bradesco Visa Infinite"


def test_a_column_added_later_reaches_a_database_that_already_exists(
    tmp_path: Path,
) -> None:
    """`create_all` only creates missing tables, never missing columns.

    Every install that connected before a column existed would otherwise break
    on the next read.
    """
    import sqlite3

    from finance_app.infrastructure.pluggy_store import PluggyStore

    database_path = tmp_path / "app.db"
    database_url = f"sqlite:///{database_path.as_posix()}"
    PluggyStore(database_url).list_account_links()

    connection = sqlite3.connect(database_path)
    connection.execute("ALTER TABLE pluggy_account_links DROP COLUMN subtype")
    connection.commit()
    columns = {
        row[1]
        for row in connection.execute("PRAGMA table_info(pluggy_account_links)")
    }
    assert "subtype" not in columns
    connection.close()

    PluggyStore(database_url).list_account_links()

    connection = sqlite3.connect(database_path)
    columns = {
        row[1]
        for row in connection.execute("PRAGMA table_info(pluggy_account_links)")
    }
    connection.close()
    assert "subtype" in columns
