from __future__ import annotations

import re
from dataclasses import asdict
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from collections.abc import Callable
from typing import Any, Protocol

# Pluggy exposes many account types; only these two map onto the app's model.
_ACCOUNT_KINDS = {"BANK": "bank", "CREDIT": "credit"}


class PluggyIntegrationError(Exception):
    pass


class PluggyNotConfiguredError(PluggyIntegrationError):
    pass


class PluggyAuthenticationError(PluggyIntegrationError):
    pass


class PluggyUnavailableError(PluggyIntegrationError):
    pass


class PluggyItemNotFoundError(PluggyIntegrationError):
    pass


class PluggyItemNotReadyError(PluggyIntegrationError):
    pass


class PluggyAccountNotFoundError(PluggyIntegrationError):
    pass


class PluggyLinkError(PluggyIntegrationError):
    pass


class PluggyItemListUnavailableError(PluggyIntegrationError):
    """Raised when Pluggy will not list the application's items.

    Listing is opt-in per team (LIST_ITEMS_FEATURE_NOT_ENABLED), so recovering
    an orphaned connection automatically is best-effort.
    """


class PluggyGateway(Protocol):
    def create_connect_token(
        self,
        *,
        client_user_id: str | None,
        item_id: str | None = None,
    ) -> str: ...
    def fetch_item(self, *, item_id: str) -> dict[str, Any]: ...
    def list_items(self) -> list[dict[str, Any]]: ...
    def fetch_snapshot(self, *, item_id: str) -> dict[str, Any]: ...


class PluggyItemStore(Protocol):
    def upsert_item(self, **values: Any) -> Any: ...
    def mark_synced(self, item_id: str) -> Any: ...
    def get_item(self, item_id: str) -> Any | None: ...
    def list_items(self) -> list[Any]: ...
    def upsert_discovered_account(self, **values: Any) -> Any: ...
    def set_account_link(self, **values: Any) -> Any: ...
    def get_account_link(self, pluggy_account_id: str) -> Any | None: ...
    def list_account_links(self, *, item_id: str | None = None) -> list[Any]: ...


class PluggyService:
    def __init__(
        self,
        gateway: PluggyGateway,
        *,
        store: PluggyItemStore | None = None,
        account_service: Any | None = None,
        card_service: Any | None = None,
        card_purchase_service: Any | None = None,
        transaction_service: Any | None = None,
        investment_service: Any | None = None,
        inbox_service: Any | None = None,
        connector_ids: Callable[[], list[int]] | None = None,
    ) -> None:
        self._gateway = gateway
        self._store = store
        self._account_service = account_service
        self._card_service = card_service
        self._card_purchase_service = card_purchase_service
        self._transaction_service = transaction_service
        self._investment_service = investment_service
        self._inbox_service = inbox_service
        self._connector_ids = connector_ids

    def create_connect_token(
        self,
        *,
        client_user_id: str | None,
        item_id: str | None = None,
    ) -> dict[str, str]:
        access_token = self._gateway.create_connect_token(
            client_user_id=client_user_id,
            item_id=item_id,
        )
        return {"accessToken": access_token}

    def register_item(
        self,
        *,
        item_id: str,
        client_user_id: str,
        item: dict[str, Any] | None = None,
        error_message: str | None = None,
    ) -> dict[str, Any]:
        store = self._require_store()
        item = item or {}
        error = item.get("error") if isinstance(item.get("error"), dict) else {}
        connector = (
            item.get("connector") if isinstance(item.get("connector"), dict) else {}
        )
        state = store.upsert_item(
            item_id=item_id,
            client_user_id=client_user_id,
            connector_name=_optional_text(connector.get("name")),
            status=_optional_text(item.get("status")),
            execution_status=_optional_text(item.get("executionStatus")),
            error_code=_optional_text(error.get("code")),
            error_message=error_message or _optional_text(error.get("message")),
            provider_message=_optional_text(error.get("providerMessage")),
        )
        return asdict(state)

    def link_item(self, *, item_id: str, client_user_id: str) -> dict[str, Any]:
        """Attach a connection that already exists at Pluggy to this install.

        Pluggy rejects a second item for the same credentials
        (ITEM_USER_ALREADY_EXISTS), so a connection created before the local
        database knew about it can only be recovered by its id.
        """
        self._require_store()
        item = self._gateway.fetch_item(item_id=item_id)
        return self.register_item(
            item_id=item_id,
            client_user_id=client_user_id,
            item=item,
        )

    def recover_items(self, *, client_user_id: str) -> dict[str, Any]:
        """Adopt connections that already exist at Pluggy but not locally.

        Pluggy rejects a second item for the same credentials
        (ITEM_USER_ALREADY_EXISTS), so a connection created before this install
        knew about it has to be adopted instead of recreated.
        """
        self._require_store()
        try:
            items = self._gateway.list_items()
        except PluggyItemListUnavailableError as exc:
            return {"available": False, "items": [], "reason": str(exc)}

        recovered = [
            self.register_item(
                item_id=str(item["id"]),
                client_user_id=client_user_id,
                item=item,
            )
            for item in items
            if item.get("id")
        ]
        return {"available": True, "items": recovered}

    def get_status(self) -> dict[str, Any]:
        store = self._require_store()
        items = [asdict(item) for item in store.list_items()]
        return {
            "connected": bool(items),
            "items": items,
            "connector_ids": self._connector_ids() if self._connector_ids else [],
            "last_synced_at": max(
                (item["last_synced_at"] for item in items if item["last_synced_at"]),
                default=None,
            ),
        }

    def sync_all(self) -> dict[str, Any]:
        store = self._require_store()
        results: list[dict[str, Any]] = []
        for item in store.list_items():
            try:
                results.append(self.sync_item(item.item_id))
            except PluggyIntegrationError as exc:
                results.append(
                    {
                        "item_id": item.item_id,
                        "status": "error",
                        "detail": str(exc),
                    }
                )
        return {
            "items": results,
            "synced": sum(result.get("status") == "success" for result in results),
            "failed": sum(result.get("status") == "error" for result in results),
        }

    def sync_item(self, item_id: str) -> dict[str, Any]:
        """Refresh the item and record which accounts it exposes.

        Nothing is imported here: entries only reach the event store through the
        review inbox, so a sync against a database that already has months of
        manual history cannot duplicate or overwrite anything.
        """
        store = self._require_store()
        stored = store.get_item(item_id)
        if stored is None:
            raise PluggyItemNotFoundError("A conexão da Pluggy não foi encontrada.")

        snapshot = self._gateway.fetch_snapshot(item_id=item_id)
        item = snapshot["item"]
        self.register_item(
            item_id=item_id,
            client_user_id=stored.client_user_id,
            item=item,
        )
        execution_status = str(item.get("executionStatus") or "").upper()
        if execution_status and execution_status not in {"SUCCESS", "PARTIAL_SUCCESS"}:
            error = item.get("error") if isinstance(item.get("error"), dict) else {}
            detail = _optional_text(error.get("providerMessage")) or _optional_text(
                error.get("message")
            )
            raise PluggyItemNotReadyError(
                detail or "A conexão ainda não terminou de sincronizar na Pluggy."
            )

        discovered = 0
        for account in snapshot.get("accounts", []):
            kind = _ACCOUNT_KINDS.get(str(account.get("type")))
            if kind is None:
                continue
            account_id = _optional_text(account.get("id"))
            if account_id is None:
                continue
            credit_data = (
                account.get("creditData")
                if isinstance(account.get("creditData"), dict)
                else {}
            )
            store.upsert_discovered_account(
                pluggy_account_id=account_id,
                item_id=item_id,
                kind=kind,
                display_name=_optional_text(account.get("name")),
                number=_optional_text(account.get("number")),
                brand=_optional_text(credit_data.get("brand")),
                holder_type=_optional_text(credit_data.get("holderType")),
                subtype=_optional_text(account.get("subtype")),
                balance=_cents(account.get("balance")),
                credit_limit=_cents(credit_data.get("creditLimit")),
            )
            discovered += 1

        # An investment is not a Pluggy account, but it needs the same decision
        # from the user — where do its buys and sells land, or ignore it — so it
        # is discovered through the same table and the same wizard.
        for investment in snapshot.get("investments", []):
            investment_id = _optional_text(investment.get("id"))
            if investment_id is None:
                continue
            store.upsert_discovered_account(
                pluggy_account_id=investment_id,
                item_id=item_id,
                kind="investment",
                display_name=_optional_text(investment.get("name")),
                number=_optional_text(investment.get("code"))
                or _optional_text(investment.get("isin")),
                brand=_optional_text(investment.get("type")),
                holder_type=None,
                subtype=_optional_text(investment.get("subtype")),
                balance=_cents(investment.get("balance")),
            )
            discovered += 1

        # Only the accounts already paired produce proposals, so a first sync
        # before the wizard simply discovers and stops.
        review = (
            self._inbox_service.refresh_from_snapshot(
                item_id=item_id,
                snapshot=snapshot,
            )
            if self._inbox_service is not None
            else {"staged": 0, "pending": 0, "duplicates": 0, "skipped": {}}
        )

        store.mark_synced(item_id)
        links = store.list_account_links(item_id=item_id)
        return {
            "item_id": item_id,
            "status": "success",
            "accounts_discovered": discovered,
            "accounts_linked": sum(1 for link in links if link.is_linked),
            "accounts_pending": sum(
                1 for link in links if not link.is_linked and not link.ignored
            ),
            "entries_staged": review["staged"],
            "entries_pending": review["pending"],
            "entries_duplicates": review["duplicates"],
            "entries_skipped": review.get("skipped", {}),
        }

    def list_accounts(self) -> dict[str, Any]:
        """List the discovered accounts with their link and a pairing hint."""
        store = self._require_store()
        links = store.list_account_links()
        cards = self._card_service.list_cards() if self._card_service else []
        accounts = (
            self._account_service.list_accounts() if self._account_service else []
        )
        holders = [
            holder
            for card in cards
            for holder in self._card_service.list_holders(str(card["card_id"]))
        ]
        return {
            "accounts": [
                {
                    "pluggy_account_id": link.pluggy_account_id,
                    "item_id": link.item_id,
                    "kind": link.kind,
                    "display_name": link.display_name,
                    "number": link.number,
                    "brand": link.brand,
                    "holder_type": link.holder_type,
                    "subtype": link.subtype,
                    "balance": link.balance,
                    "credit_limit": link.credit_limit,
                    "local_account_id": link.local_account_id,
                    "local_card_id": link.local_card_id,
                    "local_holder_id": link.local_holder_id,
                    "ignored": link.ignored,
                    "import_since": link.import_since,
                    "is_linked": link.is_linked,
                    "suggestion": _suggest_link(
                        link,
                        cards=cards,
                        accounts=accounts,
                        holders=holders,
                    ),
                }
                for link in links
            ]
        }

    def _reject_shared_destination(
        self,
        link: Any,
        *,
        local_account_id: str | None,
        local_card_id: str | None,
        local_holder_id: str | None,
    ) -> None:
        """Stop two Pluggy accounts from feeding the same local destination.

        A bank reports the same movements on each account it exposes for them,
        so two of them pointing at one local account would stage — and let the
        user accept — every transaction twice.

        Two credit accounts on one card are fine as long as they are different
        holders, which is how an issuer exposes an additional card. Investments
        are exempt: a dozen of them are normally funded from the same account.
        """
        if local_account_id is None and local_card_id is None:
            return
        if link.kind == "investment":
            return

        store = self._require_store()
        for other in store.list_account_links():
            if other.pluggy_account_id == link.pluggy_account_id:
                continue
            if other.ignored or not other.is_linked:
                continue

            if local_account_id and other.local_account_id == local_account_id:
                raise PluggyLinkError(
                    f"'{_describe_link(other)}' já usa esta conta. Duas contas da "
                    "Pluggy na mesma conta local trariam cada lançamento duas "
                    "vezes."
                )
            if (
                local_card_id
                and other.local_card_id == local_card_id
                and other.local_holder_id == local_holder_id
            ):
                raise PluggyLinkError(
                    f"'{_describe_link(other)}' já usa este destino. Escolha um "
                    "portador diferente se for um cartão adicional."
                )

    def link_account(
        self,
        *,
        pluggy_account_id: str,
        local_account_id: str | None = None,
        local_card_id: str | None = None,
        local_holder_id: str | None = None,
        ignored: bool = False,
        import_since: str | None = None,
    ) -> dict[str, Any]:
        store = self._require_store()
        link = store.get_account_link(pluggy_account_id)
        if link is None:
            raise PluggyAccountNotFoundError(
                "Esta conta da Pluggy ainda não foi descoberta. Sincronize antes."
            )

        targets = [local_account_id, local_card_id, local_holder_id]
        chosen = [target for target in targets if target]
        if ignored and chosen:
            raise PluggyLinkError(
                "Uma conta ignorada não pode ser vinculada ao mesmo tempo."
            )
        if len(chosen) > 1:
            raise PluggyLinkError(
                "Escolha apenas um destino: conta, cartão ou portador."
            )
        if import_since is not None:
            _validate_date(import_since)

        if local_account_id:
            self._account_service.get_account(local_account_id)
        if local_card_id:
            self._card_service.get_card(local_card_id)
        if local_holder_id:
            holder = self._card_service.get_holder(local_holder_id)
            # A holder implies its card, so the entries know where to land.
            local_card_id = str(holder["card_id"])

        self._reject_shared_destination(
            link,
            local_account_id=local_account_id,
            local_card_id=local_card_id,
            local_holder_id=local_holder_id,
        )

        updated = store.set_account_link(
            pluggy_account_id=pluggy_account_id,
            local_account_id=local_account_id or None,
            local_card_id=local_card_id or None,
            local_holder_id=local_holder_id or None,
            ignored=ignored,
            import_since=import_since,
        )
        return {
            "pluggy_account_id": updated.pluggy_account_id,
            "local_account_id": updated.local_account_id,
            "local_card_id": updated.local_card_id,
            "local_holder_id": updated.local_holder_id,
            "ignored": updated.ignored,
            "import_since": updated.import_since,
            "is_linked": updated.is_linked,
        }

    def _require_store(self) -> PluggyItemStore:
        if self._store is None:
            raise PluggyUnavailableError("O armazenamento local da Pluggy não está disponível.")
        return self._store


def _describe_link(link: Any) -> str:
    parts = [part for part in (link.display_name, link.number) if part]
    return " ".join(parts) or link.pluggy_account_id


def _optional_text(value: Any) -> str | None:
    if not isinstance(value, (str, int, float)):
        return None
    text = str(value).strip()
    return text or None


def _cents(value: Any) -> int | None:
    """Balances are cached only to tell two similar accounts apart."""
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(
            (Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        )
    except (ArithmeticError, TypeError, ValueError):
        return None


def _validate_date(value: str) -> None:
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise PluggyLinkError("import_since deve usar o formato AAAA-MM-DD.") from exc


def _normalize(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())


def _suggest_link(
    link: Any,
    *,
    cards: list[dict[str, Any]],
    accounts: list[dict[str, Any]],
    holders: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Best guess for what a Pluggy account maps to locally.

    Only a hint for the pairing wizard: the digits Pluggy reports for a credit
    account are the card's last four, which is the one identifier strong enough
    to match on its own. Names are a weaker fallback.
    """
    if link.kind == "credit":
        if link.number:
            for holder in holders:
                if holder.get("last_four") == link.number:
                    return {
                        "kind": "holder",
                        "id": str(holder["holder_id"]),
                        "card_id": str(holder["card_id"]),
                        "label": str(holder["name"]),
                        "reason": "last_four",
                    }
        match = _match_by_name(link.display_name, cards, "card_id", "name")
        if match is not None:
            return {**match, "kind": "card"}
        return None

    if link.kind == "investment":
        # The name here is the asset's, so matching it against account names
        # would only ever be a coincidence. The funding account is picked by
        # hand.
        return None

    match = _match_by_name(link.display_name, accounts, "account_id", "name")
    if match is not None:
        return {**match, "kind": "account"}
    return None


def _match_by_name(
    display_name: str | None,
    candidates: list[dict[str, Any]],
    id_key: str,
    name_key: str,
) -> dict[str, Any] | None:
    """Closest name, not the first one that happens to overlap.

    "VISA INFINITE" is contained in both "Bradesco Visa Infinite" and
    "Bradesco Visa Infinite - Valéria Mello". The titular is the one meant, and
    it is the one whose name is closest in length.
    """
    target = _normalize(display_name)
    if not target:
        return None

    best: tuple[int, dict[str, Any]] | None = None
    for candidate in candidates:
        if not candidate.get("is_active", True):
            continue
        name = _normalize(str(candidate.get(name_key)))
        if not name:
            continue
        if name == target:
            distance = 0
        elif name in target or target in name:
            distance = abs(len(name) - len(target))
        else:
            continue
        if best is None or distance < best[0]:
            best = (
                distance,
                {
                    "id": str(candidate[id_key]),
                    "label": str(candidate[name_key]),
                    "reason": "name",
                },
            )
    return best[1] if best is not None else None
