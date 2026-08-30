"""Review queue between Pluggy and the event store.

Every imported entry passes through here. Accepting one is what finally writes
to the event store, through the same domain services a manual entry uses — so
an imported expense is indistinguishable from a typed one, and nothing bypasses
the domain's validation.
"""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any

from finance_app.application.pluggy_matching import find_duplicates
from finance_app.application.pluggy_translation import (
    AccountLink,
    StagedProposal,
    pair_across_accounts,
    rule_key,
    translate_snapshot,
)

# Kinds the inbox can turn into a local entry today.
ACCEPTABLE_KINDS = {
    "bank_transaction",
    "card_purchase",
    "invoice_payment",
    "transfer",
    "investment_movement",
}

# A bill payment settles an invoice and a transfer only moves money between two
# accounts the user already picked; neither carries a category.
CATEGORY_REQUIRED_KINDS = {"bank_transaction", "card_purchase"}

# How far from an invoice's due date a payment may fall and still be read as
# settling it. Wide enough for a late payment, short enough not to reach the
# neighbouring month.
INVOICE_DUE_TOLERANCE_DAYS = 15


class PluggyInboxError(Exception):
    pass


class StagedEntryNotFoundError(PluggyInboxError):
    pass


class EntryAlreadyDecidedError(PluggyInboxError):
    pass


class UnsupportedEntryKindError(PluggyInboxError):
    pass


class MissingCategoryError(PluggyInboxError):
    pass


class MissingDestinationError(PluggyInboxError):
    pass


class UnresolvedInvoiceError(PluggyInboxError):
    pass


class PluggyInboxService:
    def __init__(
        self,
        *,
        store: Any,
        account_service: Any,
        card_service: Any,
        card_purchase_service: Any,
        transaction_service: Any,
        invoice_payment_service: Any = None,
        transfer_service: Any = None,
        investment_service: Any = None,
        recurring_service: Any = None,
    ) -> None:
        self._store = store
        self._account_service = account_service
        self._card_service = card_service
        self._card_purchase_service = card_purchase_service
        self._transaction_service = transaction_service
        self._invoice_payment_service = invoice_payment_service
        self._transfer_service = transfer_service
        self._investment_service = investment_service
        self._recurring_service = recurring_service

    def refresh_from_snapshot(
        self,
        *,
        item_id: str,
        snapshot: dict[str, Any],
    ) -> dict[str, int]:
        links = self._build_links(item_id)
        translation = translate_snapshot(snapshot, links=links)
        proposals = translation.proposals

        actionable = [
            proposal
            for proposal in proposals
            if proposal.kind in ACCEPTABLE_KINDS and proposal.match_kind == "new"
        ]
        duplicates = find_duplicates(
            actionable,
            local_transactions=self._transaction_service.list_transactions(),
            local_purchases=self._card_purchase_service.list_card_purchases(),
            already_linked_ids=self._already_linked_ids(),
        )

        staged = 0
        for proposal in proposals:
            matched_local_id = duplicates.get(proposal.external_id)
            self._store.stage_entry(
                entry_id=_entry_id(item_id, proposal.external_id),
                item_id=item_id,
                pluggy_account_id=proposal.pluggy_account_id,
                external_id=proposal.external_id,
                kind=proposal.kind,
                group_key=proposal.group_key,
                occurred_at=proposal.occurred_at,
                amount=proposal.amount,
                title=proposal.title,
                raw=proposal.raw,
                proposal=self._proposal_body(proposal),
                content_hash=proposal.content_hash,
                match_kind=(
                    "duplicate_of_local"
                    if matched_local_id
                    else proposal.match_kind
                ),
                matched_local_id=matched_local_id,
            )
            staged += 1

        self._reconcile_pairs()

        pending = self._store.list_entries(decision="pending")
        return {
            "staged": staged,
            "pending": len(pending),
            "duplicates": sum(
                1 for entry in pending if entry.match_kind == "duplicate_of_local"
            ),
            # Why the rest produced nothing, so an account that looks like it
            # imported none of its transactions can say what happened.
            "skipped": translation.skipped,
        }

    def list_entries(
        self,
        *,
        decision: str | None = "pending",
        kind: str | None = None,
        pluggy_account_id: str | None = None,
        include_covered: bool = False,
    ) -> dict[str, Any]:
        entries = self._store.list_entries(
            decision=decision,
            kind=kind,
            pluggy_account_id=pluggy_account_id,
            include_covered=include_covered,
        )
        links = {
            link.pluggy_account_id: link
            for link in self._store.list_account_links()
        }
        return {
            "entries": [
                {
                    **entry.to_dict(),
                    "account_label": (
                        links[entry.pluggy_account_id].display_name
                        if entry.pluggy_account_id in links
                        else None
                    ),
                }
                for entry in entries
            ],
            "pending_total": self._store.count_pending_entries(),
        }

    def list_card_numbers(self, pluggy_account_id: str) -> dict[str, Any]:
        """The physical cards that actually spent on one credit account.

        An issuer reports a single account for a card and all of its
        additionals, and only ``creditCardMetadata.cardNumber`` on each
        transaction says which plastic made the purchase. Reading it back from
        what was already staged is what lets an additional be mapped to a
        holder without hunting for the number on a statement.
        """
        link = self._store.get_account_link(pluggy_account_id)
        holders_by_last_four: dict[str, dict[str, Any]] = {}
        if link is not None and link.local_card_id:
            for holder in self._card_service.list_holders(str(link.local_card_id)):
                last_four = holder.get("last_four")
                if last_four:
                    holders_by_last_four[str(last_four)] = holder

        seen: dict[str, dict[str, Any]] = {}
        for entry in self._store.list_entries(
            pluggy_account_id=pluggy_account_id,
            include_covered=True,
        ):
            metadata = entry.raw.get("creditCardMetadata")
            if not isinstance(metadata, dict):
                continue
            number = metadata.get("cardNumber")
            if number is None or not str(number).strip():
                continue

            last_four = str(number).strip()[-4:]
            bucket = seen.setdefault(
                last_four,
                {
                    "last_four": last_four,
                    "purchase_count": 0,
                    "total_amount": 0,
                    "last_seen_at": entry.occurred_at,
                    "sample_description": entry.title,
                    "holder_id": None,
                    "holder_name": None,
                },
            )
            bucket["purchase_count"] += 1
            bucket["total_amount"] += entry.amount
            if entry.occurred_at > str(bucket["last_seen_at"]):
                bucket["last_seen_at"] = entry.occurred_at
                bucket["sample_description"] = entry.title

            holder = holders_by_last_four.get(last_four)
            if holder is not None:
                bucket["holder_id"] = str(holder["holder_id"])
                bucket["holder_name"] = str(holder["name"])

        return {
            "card_numbers": sorted(
                seen.values(),
                key=lambda item: (-int(item["purchase_count"]), item["last_four"]),
            ),
            "local_card_id": str(link.local_card_id) if link and link.local_card_id else None,
        }

    def accept(
        self,
        entry_id: str,
        *,
        overrides: dict[str, Any] | None = None,
        remember: bool = False,
    ) -> dict[str, Any]:
        entry = self._require_pending(entry_id)
        if entry.kind not in ACCEPTABLE_KINDS:
            raise UnsupportedEntryKindError(
                f"Lançamentos do tipo '{entry.kind}' ainda não podem ser aceitos."
            )

        payload = {**entry.proposal.get("payload", {}), **(overrides or {})}
        if entry.kind in CATEGORY_REQUIRED_KINDS and not payload.get("category_id"):
            raise MissingCategoryError("Escolha uma categoria antes de aceitar.")

        local_id = _local_id(entry_id)
        if entry.kind == "card_purchase":
            # A fixed expense already projected on this invoice is settled by
            # the id, not by matching later, so the purchase has to be created
            # under the pending's own id or the invoice shows both.
            pending = self._match_pending(payload)
            if pending is not None:
                local_id = f"{pending['pending_id']}:purchase"

        if entry.kind == "bank_transaction":
            self._create_transaction(local_id, payload)
        elif entry.kind == "card_purchase":
            self._create_card_purchase(local_id, payload)
        elif entry.kind == "invoice_payment":
            payload = self._create_invoice_payment(local_id, payload)
        elif entry.kind == "investment_movement":
            self._create_investment_movement(local_id, payload)
        else:
            self._create_transfer(local_id, payload)

        if remember:
            self.remember_rule(description=entry.title, payload=payload)

        updated = self._store.decide_entry(
            entry_id=entry_id,
            decision="accepted",
            created_local_id=local_id,
            proposal={**entry.proposal, "payload": payload},
        )
        return updated.to_dict()

    def ignore(self, entry_id: str) -> dict[str, Any]:
        self._require_pending(entry_id)
        return self._store.decide_entry(
            entry_id=entry_id,
            decision="ignored",
        ).to_dict()

    def link_existing(self, entry_id: str, *, local_id: str) -> dict[str, Any]:
        """Mark the entry as already present locally, without creating anything."""
        self._require_pending(entry_id)
        return self._store.decide_entry(
            entry_id=entry_id,
            decision="duplicate",
            created_local_id=local_id,
        ).to_dict()

    def accept_batch(self, entry_ids: list[str]) -> dict[str, Any]:
        accepted: list[str] = []
        failed: list[dict[str, str]] = []
        for entry_id in entry_ids:
            try:
                self.accept(entry_id)
            except PluggyInboxError as exc:
                failed.append({"entry_id": entry_id, "detail": str(exc)})
                continue
            accepted.append(entry_id)
        return {"accepted": accepted, "failed": failed}

    def _create_transaction(self, local_id: str, payload: dict[str, Any]) -> None:
        creator = (
            self._transaction_service.create_income
            if payload.get("transaction_type") == "income"
            else self._transaction_service.create_expense
        )
        creator(
            transaction_id=local_id,
            occurred_at=str(payload["occurred_at"]),
            amount=int(payload["amount"]),
            account_id=str(payload["account_id"]),
            payment_method=str(payload.get("payment_method") or "OTHER"),
            category_id=str(payload["category_id"]),
            description=payload.get("description"),
            person_id=payload.get("person_id"),
        )

    def _create_card_purchase(self, local_id: str, payload: dict[str, Any]) -> None:
        self._card_purchase_service.create_card_purchase(
            purchase_id=local_id,
            purchase_date=str(payload["purchase_date"]),
            amount=int(payload["amount"]),
            installments_count=int(payload.get("installments_count") or 1),
            category_id=str(payload["category_id"]),
            card_id=str(payload["card_id"]),
            description=payload.get("description"),
            person_id=payload.get("person_id"),
            holder_id=payload.get("holder_id"),
        )

    def _reconcile_pairs(self) -> None:
        """Pair legs that live in different Pluggy connections.

        ``sync_item`` only ever sees one connection's snapshot, so a card in one
        and the account that pays it in another never meet during translation.
        Replaying the same rules over everything still pending catches the pair
        whichever connection synced last, and an entry that is already grouped
        is left alone, so this stays idempotent.
        """
        entries = self._store.list_entries(decision="pending", include_covered=True)
        if not entries:
            return

        before = [_proposal_from_entry(entry) for entry in entries]
        after = pair_across_accounts(before)

        for entry, original, paired in zip(entries, before, after):
            if (
                paired.kind == original.kind
                and paired.group_key == original.group_key
            ):
                continue
            self._store.stage_entry(
                entry_id=entry.entry_id,
                item_id=entry.item_id,
                pluggy_account_id=entry.pluggy_account_id,
                external_id=entry.external_id,
                kind=paired.kind,
                group_key=paired.group_key,
                occurred_at=paired.occurred_at,
                amount=paired.amount,
                title=paired.title,
                raw=paired.raw,
                proposal=self._proposal_body(paired),
                content_hash=paired.content_hash,
                match_kind=paired.match_kind,
                matched_local_id=entry.matched_local_id,
            )

    def _proposal_body(self, proposal: StagedProposal) -> dict[str, Any]:
        payload = proposal.payload
        # Resolved here as well as on accept, so the inbox can name the invoice
        # the payment would settle instead of just the card.
        if (
            proposal.kind == "invoice_payment"
            and payload.get("card_id")
            and not payload.get("invoice_id")
        ):
            payload = {
                **payload,
                "invoice_id": self._resolve_invoice_id(
                    str(payload["card_id"]),
                    str(payload.get("paid_at")),
                ),
            }
        payload = self._apply_rule(proposal, payload)
        settles: str | None = None
        holder_name: str | None = None
        if proposal.kind == "card_purchase":
            pending = self._match_pending(payload)
            if pending is not None:
                settles = str(pending.get("name") or "")
            holder_name = self._holder_name(payload)

        return {
            "payload": payload,
            "skip_reason": proposal.skip_reason,
            "source_status": proposal.source_status,
            # Named so the reviewer can see it will confirm a fixed expense
            # instead of adding a second charge next to the forecast.
            "settles_pending": settles,
            # Whose card made the purchase, so an additional's spend is
            # recognisable before it is accepted.
            "holder_name": holder_name,
        }

    def _create_invoice_payment(
        self,
        local_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        card_id = payload.get("card_id")
        if not card_id:
            raise MissingDestinationError("Escolha o cartão da fatura antes de aceitar.")

        account_id = payload.get("account_id")
        if not account_id:
            raise MissingDestinationError(
                "Escolha a conta que pagou a fatura antes de aceitar."
            )

        paid_at = str(payload["paid_at"])
        invoice_id = payload.get("invoice_id") or self._resolve_invoice_id(
            str(card_id),
            paid_at,
        )
        if not invoice_id:
            raise UnresolvedInvoiceError(
                "Não encontrei a fatura correspondente a esse pagamento. "
                "Escolha a fatura antes de aceitar."
            )

        self._invoice_payment_service.create_payment(
            payment_id=local_id,
            invoice_id=str(invoice_id),
            amount=int(payload["amount"]),
            account_id=str(account_id),
            paid_at=paid_at,
        )
        # Store what was actually settled, not what was merely proposed.
        return {**payload, "invoice_id": str(invoice_id), "account_id": str(account_id)}

    def _create_transfer(self, local_id: str, payload: dict[str, Any]) -> None:
        from_account_id = payload.get("from_account_id")
        to_account_id = payload.get("to_account_id")
        if not from_account_id or not to_account_id:
            raise MissingDestinationError(
                "Escolha as contas de origem e destino antes de aceitar."
            )

        self._transfer_service.create_transfer(
            transfer_id=local_id,
            occurred_at=str(payload["occurred_at"]),
            from_account_id=str(from_account_id),
            to_account_id=str(to_account_id),
            amount=int(payload["amount"]),
            description=payload.get("description"),
        )

    def _create_investment_movement(
        self,
        local_id: str,
        payload: dict[str, Any],
    ) -> None:
        account_id = payload.get("account_id")
        if not account_id:
            raise MissingDestinationError(
                "Escolha a conta que movimentou o investimento antes de aceitar."
            )

        amount = int(payload["amount"])
        self._investment_service.create_movement(
            movement_id=local_id,
            occurred_at=str(payload["occurred_at"]),
            movement_type=str(payload["movement_type"]),
            account_id=str(account_id),
            description=payload.get("description"),
            # A buy and a sell derive their direction from the type, so the
            # value that moved is all the service needs. The review can retype
            # the movement as a dividend or a contribution, which splits that
            # value across different fields — so anything it sent explicitly
            # wins over the single figure Pluggy reported.
            cash_amount=_amount_field(payload, "cash_amount", amount),
            invested_amount=_amount_field(payload, "invested_amount", amount),
            contribution_amount=_amount_field(payload, "contribution_amount"),
            dividend_amount=_amount_field(payload, "dividend_amount"),
            reinvested_dividend_amount=_amount_field(
                payload,
                "reinvested_dividend_amount",
            ),
            asset_ticker=payload.get("asset_ticker"),
            asset_class=payload.get("asset_class"),
        )

    def _apply_rule(
        self,
        proposal: StagedProposal,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Pre-fill from what the user has already taught, and nothing more.

        A rule beats Pluggy's category hint, because the user said so and the
        hint is only a guess. It never decides: the entry still waits for a
        click, and every field stays editable.
        """
        key = rule_key(proposal.title)
        if not key:
            return payload
        rule = self._store.get_import_rule(key)
        if rule is None:
            return payload

        fields = {
            "category_id": rule.set_category_id,
            "person_id": rule.set_person_id,
            "card_id": rule.set_card_id,
            "holder_id": rule.set_holder_id,
            "account_id": rule.set_account_id,
        }
        applied = dict(payload)
        for field, value in fields.items():
            # Only where the proposal has a destination to fill: a rule must
            # not move a purchase onto a card the transaction did not come from.
            if value and field in applied:
                applied[field] = value
        if applied != payload:
            self._store.count_import_rule_hit(rule.rule_id)
        return applied

    def remember_rule(
        self,
        *,
        description: str | None,
        payload: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Teach what this description always means, from an accepted entry."""
        key = rule_key(description)
        if not key:
            return None
        rule = self._store.upsert_import_rule(
            match_value=key,
            label=description,
            set_category_id=payload.get("category_id"),
            set_person_id=payload.get("person_id"),
            set_card_id=payload.get("card_id"),
            set_holder_id=payload.get("holder_id"),
            set_account_id=payload.get("account_id"),
        )
        return rule.to_dict()

    def list_rules(self) -> dict[str, Any]:
        return {"rules": [rule.to_dict() for rule in self._store.list_import_rules()]}

    def save_rule(self, payload: dict[str, Any]) -> dict[str, Any]:
        key = rule_key(payload.get("match_value") or payload.get("label"))
        if not key:
            raise MissingDestinationError(
                "A regra precisa de um texto que identifique o lançamento."
            )
        return self._store.upsert_import_rule(
            match_value=key,
            label=payload.get("label"),
            set_category_id=payload.get("set_category_id"),
            set_person_id=payload.get("set_person_id"),
            set_card_id=payload.get("set_card_id"),
            set_holder_id=payload.get("set_holder_id"),
            set_account_id=payload.get("set_account_id"),
        ).to_dict()

    def delete_rule(self, rule_id: str) -> None:
        if not self._store.delete_import_rule(rule_id):
            raise StagedEntryNotFoundError(f"A regra '{rule_id}' não existe.")

    def _holder_name(self, payload: dict[str, Any]) -> str | None:
        holder_id = payload.get("holder_id")
        card_id = payload.get("card_id")
        if not holder_id or not card_id:
            return None
        for holder in self._card_service.list_holders(str(card_id)):
            if str(holder["holder_id"]) == str(holder_id):
                return str(holder["name"])
        return None

    def _match_pending(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        """The fixed expense this purchase is, if it is one.

        A subscription is billed at the same amount on the same card every
        month, which is a strong enough signal on its own. Two candidates mean
        we cannot tell which, and settling the wrong one is worse than leaving
        the user to confirm it by hand.
        """
        if self._recurring_service is None:
            return None
        card_id = payload.get("card_id")
        month = str(payload.get("purchase_date") or "")[:7]
        if not card_id or len(month) != 7:
            return None
        # An installment purchase spans invoices; a subscription never does.
        if int(payload.get("installments_count") or 1) > 1:
            return None

        try:
            pendings = self._recurring_service.list_pendings(month=month)
        except Exception:
            return None

        candidates = [
            pending
            for pending in pendings
            if str(pending.get("card_id") or "") == str(card_id)
            and str(pending.get("status")) == "pending"
            and int(pending.get("amount") or 0) == int(payload["amount"])
        ]
        return candidates[0] if len(candidates) == 1 else None

    def _resolve_invoice_id(self, card_id: str, paid_at: str) -> str | None:
        """Pick the invoice a payment on this date settles.

        A bill is paid on or around its due date, so the nearest due date wins.
        An invoice that still owes something is preferred over one another
        payment already settled, which is what makes a second payment on the
        same card land on the right month.
        """
        reference = _parse_moment(paid_at)
        if reference is None or self._invoice_payment_service is None:
            return None

        best: tuple[tuple[bool, float], str] | None = None
        for invoice in self._invoice_payment_service.list_invoices(card_id):
            due = _parse_moment(str(invoice.get("due_date")))
            if due is None:
                continue
            distance = abs((due - reference).total_seconds())
            if distance > INVOICE_DUE_TOLERANCE_DAYS * 86400:
                continue
            rank = (int(invoice.get("remaining_amount") or 0) <= 0, distance)
            if best is None or rank < best[0]:
                best = (rank, str(invoice["invoice_id"]))

        return best[1] if best is not None else None

    def _require_pending(self, entry_id: str) -> Any:
        entry = self._store.get_entry(entry_id)
        if entry is None:
            raise StagedEntryNotFoundError(
                f"O lançamento '{entry_id}' não está na fila de revisão."
            )
        if entry.decision != "pending":
            raise EntryAlreadyDecidedError(
                f"O lançamento '{entry_id}' já foi decidido."
            )
        return entry

    def _already_linked_ids(self) -> set[str]:
        """Local entries a previous review already claimed.

        Without this, a second sync would offer the same manual entry as a
        duplicate match for a different proposal.
        """
        return {
            entry.created_local_id
            for entry in self._store.list_entries(include_covered=True)
            if entry.created_local_id and entry.decision in {"accepted", "duplicate"}
        }

    def _build_links(self, item_id: str) -> dict[str, AccountLink]:
        holders_by_card: dict[str, list[dict[str, Any]]] = {}
        payment_account_by_card: dict[str, str | None] = {}
        for card in self._card_service.list_cards():
            card_id = str(card["card_id"])
            holders_by_card[card_id] = self._card_service.list_holders(card_id)
            payment_account = card.get("payment_account_id")
            payment_account_by_card[card_id] = (
                str(payment_account) if payment_account else None
            )

        links: dict[str, AccountLink] = {}
        for stored in self._store.list_account_links(item_id=item_id):
            holder_person: str | None = None
            holders_by_last_four: dict[str, dict[str, Any]] = {}
            if stored.local_card_id:
                for holder in holders_by_card.get(str(stored.local_card_id), []):
                    last_four = holder.get("last_four")
                    if last_four:
                        holders_by_last_four[str(last_four)] = {
                            "holder_id": str(holder["holder_id"]),
                            "card_id": str(holder["card_id"]),
                            "reimbursable_person_id": holder.get(
                                "reimbursable_person_id"
                            ),
                        }
                    if holder["holder_id"] == stored.local_holder_id:
                        holder_person = holder.get("reimbursable_person_id")

            links[stored.pluggy_account_id] = AccountLink(
                pluggy_account_id=stored.pluggy_account_id,
                kind=stored.kind,
                local_account_id=stored.local_account_id,
                local_card_id=stored.local_card_id,
                local_holder_id=stored.local_holder_id,
                ignored=stored.ignored,
                import_since=stored.import_since,
                holder_reimbursable_person_id=holder_person,
                holders_by_last_four=holders_by_last_four,
                payment_account_id=payment_account_by_card.get(
                    str(stored.local_card_id)
                ),
            )
        return links


def _proposal_from_entry(entry: Any) -> StagedProposal:
    """Rebuild the proposal a stored entry came from.

    The raw payload is kept precisely so the rules can be replayed without
    calling Pluggy again.
    """
    return StagedProposal(
        external_id=entry.external_id,
        pluggy_account_id=entry.pluggy_account_id,
        kind=entry.kind,
        occurred_at=entry.occurred_at,
        amount=entry.amount,
        title=entry.title,
        raw=entry.raw,
        payload=entry.proposal.get("payload", {}),
        content_hash=entry.content_hash,
        group_key=entry.group_key,
        match_kind=entry.match_kind,
        skip_reason=entry.proposal.get("skip_reason"),
    )


def _amount_field(
    payload: dict[str, Any],
    key: str,
    default: int | None = None,
) -> int | None:
    """One of the movement's value fields, as the review left it."""
    value = payload.get(key)
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_moment(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=None)


def _entry_id(item_id: str, external_id: str) -> str:
    """Deterministic, so re-syncing updates an entry instead of adding one."""
    return hashlib.sha1(f"{item_id}|{external_id}".encode("utf-8")).hexdigest()


def _local_id(entry_id: str) -> str:
    """Deterministic too, so a retried accept cannot create a second entry."""
    return f"pluggy-{entry_id[:24]}"
