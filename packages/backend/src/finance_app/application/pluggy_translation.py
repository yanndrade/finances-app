"""Turn a Pluggy snapshot into proposals for the review inbox.

Pure functions only: no I/O and no persistence, so the whole translation can be
exercised against fixtures and replayed over stored raw payloads whenever a rule
changes.

Two mismatches with the app's model shape most of what happens here:

* Pluggy reports an installment purchase as N independent transactions, one per
  invoice, while the app models a single purchase that projects its own future
  installments. The first installment of a group therefore rebuilds the whole
  purchase and the siblings are recorded only so a re-sync stays idempotent.
* Pluggy's ``PENDING`` covers both an open invoice and a future installment.
  Neither has hit the balance yet, so neither becomes a proposal.
* A purchase abroad is reported twice over: ``amount`` in the currency it was
  made in and ``amountInAccountCurrency`` in the currency the issuer bills. The
  app keeps a single ledger in the account's currency, so the converted figure
  is the one that becomes the entry and the original is carried alongside it.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

# Only a hint for the inbox: the user confirms the category, and a saved rule
# overrides this. Keyed by Pluggy's Portuguese category labels.
PLUGGY_CATEGORY_HINTS: dict[str, str] = {
    "supermercado": "supermercado",
    "supermarket": "supermercado",
    "groceries": "supermercado",
    "alimentacao": "alimentacao",
    "restaurantes": "alimentacao",
    "food and drinks": "alimentacao",
    "combustivel": "combustivel",
    "gas station": "combustivel",
    "farmacia": "farmacia-saude",
    "saude": "farmacia-saude",
    "healthcare": "farmacia-saude",
    "vestuario": "vestuario",
    "clothing": "vestuario",
    "moradia": "moradia",
    "aluguel": "moradia",
    "housing": "moradia",
    "shopping": "lazer-shopping",
    "lazer": "lazer-shopping",
    "entertainment": "lazer-shopping",
    "compras online": "compras-online",
    "online shopping": "compras-online",
    "automovel": "automovel-manutencao",
    "transporte": "automovel-manutencao",
    "presentes": "presentes",
    "gifts": "presentes",
}

_PAYMENT_METHODS = {"PIX": "PIX", "TED": "OTHER", "DOC": "OTHER", "BOLETO": "OTHER"}

# The currency every local account and card is kept in. A transaction reported
# in anything else is a purchase abroad and has to be converted before it can
# join the ledger.
ACCOUNT_CURRENCY = "BRL"

# Pluggy reports other investment transaction types (transfers between
# custodians, amortisations); only the two that move money are imported.
_INVESTMENT_MOVEMENT_TYPES = {"BUY": "compra", "SELL": "venda"}

# A card bill is often debited a day or two off the date the issuer reports.
INVOICE_PAYMENT_TOLERANCE_DAYS = 3
# Both legs of a transfer settle together, so they are far tighter.
TRANSFER_TOLERANCE_DAYS = 1


@dataclass(frozen=True)
class StagedProposal:
    external_id: str
    pluggy_account_id: str
    kind: str
    occurred_at: str
    amount: int
    title: str | None
    raw: dict[str, Any]
    payload: dict[str, Any]
    content_hash: str
    group_key: str | None = None
    match_kind: str = "new"
    skip_reason: str | None = None
    # Pluggy's own status. A card purchase read from a bill that has not closed
    # is PENDING and the issuer can still revise or drop it.
    source_status: str | None = None


@dataclass
class TranslationResult:
    """What the snapshot produced, and what it did not.

    A transaction that is filtered out leaves no trace anywhere else, so
    "where are my card purchases?" would otherwise be unanswerable without
    re-reading the raw payload by hand.
    """

    proposals: list[StagedProposal] = field(default_factory=list)
    skipped: dict[str, int] = field(default_factory=dict)

    def skip(self, reason: str) -> None:
        self.skipped[reason] = self.skipped.get(reason, 0) + 1


@dataclass
class AccountLink:
    """The subset of a stored link the translation needs."""

    pluggy_account_id: str
    kind: str
    local_account_id: str | None = None
    local_card_id: str | None = None
    local_holder_id: str | None = None
    ignored: bool = False
    import_since: str | None = None
    holder_reimbursable_person_id: str | None = None
    holders_by_last_four: dict[str, dict[str, Any]] = field(default_factory=dict)
    # For a credit link: the account the card is normally paid from, used when
    # the paying account is not itself connected to Pluggy.
    payment_account_id: str | None = None


def translate_snapshot(
    snapshot: dict[str, Any],
    *,
    links: dict[str, AccountLink],
) -> TranslationResult:
    result = TranslationResult()
    transactions_by_account = snapshot.get("transactions") or {}
    proposals: list[StagedProposal] = []

    for account in snapshot.get("accounts") or []:
        account_id = _text(account.get("id"))
        if account_id is None:
            continue
        link = links.get(account_id)
        # An account nobody paired has nowhere to land, and an ignored one was
        # explicitly opted out.
        if link is None or link.ignored or not _is_linked(link):
            continue

        transactions = []
        for transaction in transactions_by_account.get(account_id) or []:
            reason = _skip_reason_for(transaction, link)
            if reason is None:
                transactions.append(transaction)
            else:
                result.skip(reason)

        if link.kind == "bank":
            proposals.extend(_translate_bank(transactions, link))
        elif link.kind == "credit":
            proposals.extend(_translate_credit(transactions, link))

    proposals.extend(_translate_investments(snapshot, links=links))
    result.proposals = pair_across_accounts(proposals)
    return result


def _translate_investments(
    snapshot: dict[str, Any],
    *,
    links: dict[str, AccountLink],
) -> list[StagedProposal]:
    """Buys and sells of an investment the user chose to import.

    The position itself is never translated: quantity and average price are
    the user's own record, and overwriting them from a broker's view is the
    kind of silent correction this whole queue exists to prevent.
    """
    proposals: list[StagedProposal] = []
    transactions_by_investment = snapshot.get("investment_transactions") or {}

    for investment in snapshot.get("investments") or []:
        investment_id = _text(investment.get("id"))
        if investment_id is None:
            continue
        link = links.get(investment_id)
        if link is None or link.kind != "investment" or link.ignored:
            continue
        if not _is_linked(link):
            continue

        for transaction in transactions_by_investment.get(investment_id) or []:
            proposal = _investment_movement(transaction, investment, link)
            if proposal is not None:
                proposals.append(proposal)

    return proposals


def _investment_movement(
    transaction: dict[str, Any],
    investment: dict[str, Any],
    link: AccountLink,
) -> StagedProposal | None:
    movement_type = _INVESTMENT_MOVEMENT_TYPES.get(
        str(transaction.get("type") or "").upper()
    )
    if movement_type is None:
        return None
    if _text(transaction.get("id")) is None:
        return None

    # tradeDate is when the order executed; date is when it settled. The trade
    # is what the user remembers making.
    occurred_on = _date_only(transaction.get("tradeDate")) or _date_only(
        transaction.get("date")
    )
    if link.import_since is not None and occurred_on is not None:
        if occurred_on < link.import_since:
            return None

    amount = _local_abs_cents(transaction)
    if amount <= 0:
        return None

    ticker = (
        _text(investment.get("code"))
        or _text(investment.get("isin"))
        or _text(investment.get("name"))
    )
    description = _text(transaction.get("description")) or _text(
        investment.get("name")
    )
    payload = {
        "movement_type": movement_type,
        "occurred_at": _utc(transaction.get("tradeDate") or transaction.get("date")),
        "amount": amount,
        "account_id": link.local_account_id,
        "asset_ticker": ticker,
        # Pluggy's investment type is its own taxonomy. Adopting it would create
        # asset classes that do not line up with the user's allocation targets,
        # so the class is left for the user the same way a category is.
        "asset_class": None,
        "description": description,
        **_foreign_fields(transaction),
    }
    return _build(
        transaction,
        link,
        kind="investment_movement",
        amount=amount,
        title=description,
        payload=payload,
    )


def pair_across_accounts(proposals: list[StagedProposal]) -> list[StagedProposal]:
    """Resolve everything that needs two accounts to make sense.

    Kept separate from the translation so it can run a second time over the
    whole queue: a card in one Pluggy connection is often paid from an account
    in another, and a snapshot only ever covers one connection.

    Invoice payments go first — a bank leg one of them claims must not also be
    read as a transfer.
    """
    return _pair_transfers(_pair_invoice_payments(proposals))


def _is_linked(link: AccountLink) -> bool:
    return any(
        (link.local_account_id, link.local_card_id, link.local_holder_id)
    )


def _skip_reason_for(
    transaction: dict[str, Any],
    link: AccountLink,
) -> str | None:
    """Why this transaction produces no proposal, or None if it does.

    On a credit account PENDING means the invoice has not closed yet, which is
    the usual reason a card looks like it imported nothing at all.
    """
    status = str(transaction.get("status") or "").upper()
    if status != "POSTED" and link.kind != "credit":
        # On a bank account a pending transaction has not moved the balance
        # yet, so importing it would post money that has not left.
        return "not_posted"
    if _text(transaction.get("id")) is None:
        return "no_id"
    if link.import_since is not None:
        occurred_on = _date_only(transaction.get("date"))
        if occurred_on is not None and occurred_on < link.import_since:
            return "before_import_since"
    return None


def _translate_bank(
    transactions: list[dict[str, Any]],
    link: AccountLink,
) -> list[StagedProposal]:
    proposals: list[StagedProposal] = []
    for transaction in transactions:
        amount = _local_abs_cents(transaction)
        if amount <= 0:
            continue
        is_credit = str(transaction.get("type") or "").upper() == "CREDIT"
        description = _text(transaction.get("description")) or _text(
            transaction.get("descriptionRaw")
        )
        payload = {
            "transaction_type": "income" if is_credit else "expense",
            "occurred_at": _utc(transaction.get("date")),
            "amount": amount,
            "account_id": link.local_account_id,
            "payment_method": _payment_method(transaction),
            "category_id": _category_hint(transaction),
            "description": description,
            "person_id": None,
            **_foreign_fields(transaction),
        }
        proposals.append(
            _build(
                transaction,
                link,
                kind="bank_transaction",
                amount=amount,
                title=description,
                payload=payload,
            )
        )
    return proposals


def _translate_credit(
    transactions: list[dict[str, Any]],
    link: AccountLink,
) -> list[StagedProposal]:
    proposals: list[StagedProposal] = []
    groups: dict[str, list[dict[str, Any]]] = {}

    for transaction in transactions:
        # On a credit account a negative amount reduces what is owed, so it is a
        # bill payment rather than a purchase.
        if _local_signed_cents(transaction) < 0:
            amount = _local_abs_cents(transaction)
            proposals.append(
                _build(
                    transaction,
                    link,
                    kind="invoice_payment",
                    amount=amount,
                    title=_text(transaction.get("description")),
                    payload={
                        "card_id": link.local_card_id,
                        "amount": amount,
                        "paid_at": _utc(transaction.get("date")),
                        # Refined by _pair_invoice_payments when the paying
                        # account is connected too.
                        "account_id": link.payment_account_id,
                        "invoice_id": None,
                    },
                )
            )
            continue

        group_key = _installment_group_key(transaction)
        if group_key is None:
            proposals.append(_card_purchase(transaction, link, installments=1))
            continue
        groups.setdefault(group_key, []).append(transaction)

    for group_key, installments in groups.items():
        ordered = sorted(
            installments,
            key=lambda item: _installment_number(item) or 0,
        )
        first = ordered[0]
        metadata = _credit_metadata(first)
        total_installments = _installment_total(first) or len(ordered)
        total_amount = _installment_total_amount(first, total_installments)
        if total_amount <= 0:
            proposals.extend(
                _card_purchase(item, link, installments=1) for item in ordered
            )
            continue

        proposals.append(
            _card_purchase(
                first,
                link,
                installments=total_installments,
                amount_override=total_amount,
                purchase_date=metadata.get("purchaseDate") or first.get("date"),
                group_key=group_key,
            )
        )
        # Siblings are staged only so a re-sync recognises them; they are hidden
        # from the inbox because the rebuilt purchase already covers them.
        for sibling in ordered[1:]:
            proposals.append(
                _build(
                    sibling,
                    link,
                    kind="card_installment_covered",
                    amount=_local_abs_cents(sibling),
                    title=_text(sibling.get("description")),
                    payload={},
                    group_key=group_key,
                    match_kind="covered_by_group",
                )
            )

    return proposals


def _pair_invoice_payments(proposals: list[StagedProposal]) -> list[StagedProposal]:
    """Fold the bank debit that paid a card bill into the payment itself.

    ``InvoicePaid`` already writes the expense and debits the account, so
    leaving the bank leg as its own proposal would charge the payment twice.
    An ambiguous match is left alone: hiding the wrong expense is worse than
    showing one extra line.
    """
    result = list(proposals)
    claimed: set[int] = set()
    legs = [
        (index, proposal)
        for index, proposal in enumerate(proposals)
        if proposal.kind == "bank_transaction"
        and proposal.group_key is None
        and proposal.payload.get("transaction_type") == "expense"
    ]

    for index, proposal in enumerate(proposals):
        # An already paired payment keeps the leg it has: its partner is no
        # longer a candidate, so re-running would hunt for a different one.
        if proposal.kind != "invoice_payment" or proposal.group_key is not None:
            continue

        candidates = [
            candidate
            for candidate in legs
            if candidate[0] not in claimed
            and candidate[1].amount == proposal.amount
            and _within(
                candidate[1].occurred_at,
                proposal.occurred_at,
                INVOICE_PAYMENT_TOLERANCE_DAYS,
            )
        ]
        if len(candidates) != 1:
            continue

        leg_index, leg = candidates[0]
        claimed.add(leg_index)
        group_key = _pair_key(proposal, leg)
        result[index] = _regroup(
            proposal,
            group_key=group_key,
            payload={
                **proposal.payload,
                "account_id": leg.payload.get("account_id"),
            },
        )
        result[leg_index] = _regroup(
            leg,
            group_key=group_key,
            kind="invoice_payment_covered",
            match_kind="covered_by_group",
            payload={},
        )

    return result


def _pair_transfers(proposals: list[StagedProposal]) -> list[StagedProposal]:
    """Turn the two legs of a transfer between own accounts into one proposal.

    Accepted separately the legs read as an expense plus unrelated income, and
    the app would show money leaving and arriving instead of moving.
    """
    result = list(proposals)
    claimed: set[int] = set()
    debits: list[tuple[int, StagedProposal]] = []
    credits: list[tuple[int, StagedProposal]] = []

    for index, proposal in enumerate(proposals):
        if proposal.kind != "bank_transaction" or proposal.group_key is not None:
            continue
        if proposal.payload.get("transaction_type") == "expense":
            debits.append((index, proposal))
        else:
            credits.append((index, proposal))

    for debit_index, debit in debits:
        candidates = [
            candidate
            for candidate in credits
            if candidate[0] not in claimed
            and candidate[1].amount == debit.amount
            and candidate[1].payload.get("account_id")
            != debit.payload.get("account_id")
            and _is_same_movement(debit, candidate[1])
        ]
        if len(candidates) != 1:
            continue

        credit_index, credit = candidates[0]
        claimed.add(credit_index)
        group_key = _pair_key(debit, credit)
        result[debit_index] = _regroup(
            debit,
            group_key=group_key,
            kind="transfer",
            payload={
                "occurred_at": debit.payload.get("occurred_at"),
                "amount": debit.amount,
                "from_account_id": debit.payload.get("account_id"),
                "to_account_id": credit.payload.get("account_id"),
                "description": debit.payload.get("description"),
            },
        )
        result[credit_index] = _regroup(
            credit,
            group_key=group_key,
            kind="transfer_covered",
            match_kind="covered_by_group",
            payload={},
        )

    return result


def _is_same_movement(debit: StagedProposal, credit: StagedProposal) -> bool:
    """Whether two legs are the same money moving.

    An authentication code identifies the movement exactly. Without one on both
    sides there is only the amount, which is already equal by the time we get
    here, and how far apart the legs settled.
    """
    debit_code = _authentication_code(debit.raw)
    credit_code = _authentication_code(credit.raw)
    if debit_code is not None and credit_code is not None:
        return debit_code == credit_code
    return _within(debit.occurred_at, credit.occurred_at, TRANSFER_TOLERANCE_DAYS)


def _regroup(
    proposal: StagedProposal,
    *,
    group_key: str,
    payload: dict[str, Any],
    kind: str | None = None,
    match_kind: str | None = None,
) -> StagedProposal:
    """Re-emit a proposal as part of a pair.

    The hash folds in the group so that a pairing which only appears once the
    other account is linked reopens the entry for review instead of passing as
    unchanged.
    """
    return replace(
        proposal,
        kind=kind or proposal.kind,
        match_kind=match_kind or proposal.match_kind,
        group_key=group_key,
        payload=payload,
        content_hash=hashlib.sha1(
            f"{proposal.content_hash}|{group_key}".encode("utf-8")
        ).hexdigest(),
    )


def _pair_key(left: StagedProposal, right: StagedProposal) -> str:
    return hashlib.sha1(
        f"{left.external_id}|{right.external_id}".encode("utf-8")
    ).hexdigest()


def _authentication_code(transaction: dict[str, Any]) -> str | None:
    payment_data = transaction.get("paymentData")
    if not isinstance(payment_data, dict):
        return None
    return _text(payment_data.get("authenticationCode"))


def _within(left: str, right: str, days: int) -> bool:
    left_moment = _parse_utc(left)
    right_moment = _parse_utc(right)
    if left_moment is None or right_moment is None:
        return False
    return abs((left_moment - right_moment).total_seconds()) <= days * 86400


def _parse_utc(value: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)


def _card_purchase(
    transaction: dict[str, Any],
    link: AccountLink,
    *,
    installments: int,
    amount_override: int | None = None,
    purchase_date: Any = None,
    group_key: str | None = None,
) -> StagedProposal:
    amount = amount_override or _local_abs_cents(transaction)
    description = _text(transaction.get("description")) or _text(
        transaction.get("descriptionRaw")
    )
    if installments > 1:
        # The rebuilt entry is the whole purchase, so naming it "Loja 7/12"
        # would describe one instalment of it.
        description = _strip_installment_marker(description)
    holder = _resolve_holder(transaction, link)
    payload = {
        "purchase_date": _utc(purchase_date or transaction.get("date")),
        "amount": amount,
        "installments_count": max(installments, 1),
        "card_id": holder.get("card_id") or link.local_card_id,
        "holder_id": holder.get("holder_id") or link.local_holder_id,
        "category_id": _category_hint(transaction),
        "description": description,
        "person_id": holder.get("reimbursable_person_id")
        or link.holder_reimbursable_person_id,
        **_foreign_fields(transaction),
    }
    return _build(
        transaction,
        link,
        kind="card_purchase",
        amount=amount,
        title=description,
        payload=payload,
        group_key=group_key,
        source_status=_text(transaction.get("status")),
        # A rebuilt installment purchase happened on its purchase date, not on
        # the date of whichever invoice the first instalment landed in. The
        # entry is dated by the purchase so it lines up with a manual one.
        occurred_at=payload["purchase_date"],
    )


def _resolve_holder(
    transaction: dict[str, Any],
    link: AccountLink,
) -> dict[str, Any]:
    """Attribute the spend to the physical card that made it.

    ``creditCardMetadata.cardNumber`` differs from the account's own number on
    additional and virtual cards, which is what lets an additional's spend land
    on the right holder.
    """
    card_number = _text(_credit_metadata(transaction).get("cardNumber"))
    if card_number is None:
        return {}
    holder = link.holders_by_last_four.get(card_number[-4:])
    return holder or {}


def _build(
    transaction: dict[str, Any],
    link: AccountLink,
    *,
    kind: str,
    amount: int,
    title: str | None,
    payload: dict[str, Any],
    group_key: str | None = None,
    match_kind: str = "new",
    skip_reason: str | None = None,
    source_status: str | None = None,
    occurred_at: str | None = None,
) -> StagedProposal:
    external_id = _text(transaction.get("id"))
    assert external_id is not None
    return StagedProposal(
        external_id=external_id,
        pluggy_account_id=link.pluggy_account_id,
        kind=kind,
        occurred_at=occurred_at or _utc(transaction.get("date")),
        amount=amount,
        title=title,
        raw=transaction,
        payload=payload,
        content_hash=_content_hash(transaction, amount=amount, kind=kind),
        group_key=group_key,
        match_kind=match_kind,
        skip_reason=skip_reason,
        source_status=source_status,
    )


def _content_hash(transaction: dict[str, Any], *, amount: int, kind: str) -> str:
    """Fingerprint of what would change the proposal if Pluggy revised it."""
    metadata = _credit_metadata(transaction)
    parts = [
        kind,
        str(amount),
        # An issuer settles a purchase abroad at the rate of the day the bill
        # closes, so the converted value moves between PENDING and POSTED. The
        # original pair is what says the revision is a new rate and not a new
        # charge.
        str(_foreign_currency(transaction) or ""),
        str(_abs_cents(transaction.get("amount"))),
        str(transaction.get("status") or ""),
        str(_date_only(transaction.get("date"))),
        _normalize(_text(transaction.get("description"))),
        str(_installment_number(transaction) or ""),
        str(_installment_total(transaction) or ""),
        str(_abs_cents(metadata.get("totalAmount")) or ""),
    ]
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()


def _installment_group_key(transaction: dict[str, Any]) -> str | None:
    """Group the installments of one purchase.

    Non-Open-Finance connectors expose no purchase id, so the group is built
    from the fields that together identify a purchase: the physical card, the
    original purchase date, the total, the installment count and the merchant
    text.
    """
    total_installments = _installment_total(transaction)
    if total_installments is None or total_installments < 2:
        return None
    metadata = _credit_metadata(transaction)
    parts = [
        _text(metadata.get("cardNumber")) or "",
        str(_date_only(metadata.get("purchaseDate")) or ""),
        str(total_installments),
        # The counter has to come out first: "Loja 3/12" and "Loja 4/12" are
        # the same purchase, and leaving it in gives every instalment a group
        # of its own.
        _normalize(_strip_installment_marker(_text(transaction.get("description")))),
    ]
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()


_INSTALLMENT_MARKER = re.compile(r"\s*\d{1,2}\s*/\s*\d{1,2}\s*$")


def _strip_installment_marker(value: str | None) -> str | None:
    """Drop the trailing "3/12" an issuer appends to each instalment."""
    if value is None:
        return None
    return _INSTALLMENT_MARKER.sub("", value).strip() or value


def _credit_metadata(transaction: dict[str, Any]) -> dict[str, Any]:
    metadata = transaction.get("creditCardMetadata")
    return metadata if isinstance(metadata, dict) else {}


def _installment_total_amount(transaction: dict[str, Any], count: int) -> int:
    """The whole purchase, from an installment of it.

    Most connectors omit ``totalAmount``, so the total is the instalment times
    the count. It is also skipped on a purchase abroad, where it is denominated
    in the original currency and the converted instalments are the only figures
    in the account's. Instalments can differ by a cent either way, which is why
    the amount is still editable before the entry is accepted.
    """
    if _foreign_currency(transaction) is None:
        declared = _abs_cents(_credit_metadata(transaction).get("totalAmount"))
        if declared > 0:
            return declared
    return _local_abs_cents(transaction) * count


def _installment_number(transaction: dict[str, Any]) -> int | None:
    return _int(_credit_metadata(transaction).get("installmentNumber"))


def _installment_total(transaction: dict[str, Any]) -> int | None:
    return _int(_credit_metadata(transaction).get("totalInstallments"))


def _payment_method(transaction: dict[str, Any]) -> str:
    payment_data = transaction.get("paymentData")
    if not isinstance(payment_data, dict):
        return "OTHER"
    return _PAYMENT_METHODS.get(
        str(payment_data.get("paymentMethod") or "").upper(),
        "OTHER",
    )


def _category_hint(transaction: dict[str, Any]) -> str | None:
    label = _text(transaction.get("category"))
    if label is None:
        return None
    return PLUGGY_CATEGORY_HINTS.get(_strip_accents(label.lower().strip()))


def _strip_accents(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def _normalize(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]", "", _strip_accents((value or "").lower()))


# What varies between two occurrences of the same recurring charge: the
# instalment counter, the bank's document number, and any other digits.
_RULE_NOISE = (
    re.compile(r"\bdocto:?\s*\d+", re.IGNORECASE),
    re.compile(r"\b\d{1,2}\s*/\s*\d{1,2}\b"),
)


def rule_key(description: str | None) -> str:
    """Stable key for "this charge is always the same thing".

    Two occurrences of one recurring charge differ only in noise — the
    instalment counter and the document number — so those come out before the
    text is compared. Returns "" when nothing identifying is left, which is
    what stops a rule from matching everything.
    """
    text = _strip_accents((description or "").lower())
    for pattern in _RULE_NOISE:
        text = pattern.sub(" ", text)
    text = re.sub(r"[^a-z]+", " ", text).strip()
    return re.sub(r"\s+", " ", text)


def _int(value: Any) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed or None


def _text(value: Any) -> str | None:
    if not isinstance(value, (str, int, float)):
        return None
    text = str(value).strip()
    return text or None


def _foreign_currency(transaction: dict[str, Any]) -> str | None:
    """The currency a purchase was made in, when it is not the account's.

    ``None`` for the ordinary domestic case, including a transaction that names
    a foreign currency but carries no conversion: without the converted figure
    there is nothing to import but the original, and guessing a rate would put
    an invented number in the ledger.
    """
    code = _text(transaction.get("currencyCode"))
    if code is None or code.upper() == ACCOUNT_CURRENCY:
        return None
    if _abs_cents(transaction.get("amountInAccountCurrency")) <= 0:
        return None
    return code.upper()


def _local_signed_cents(transaction: dict[str, Any]) -> int:
    """What the transaction is worth in the account's own currency.

    ``amount`` is denominated in ``currencyCode``, so on a purchase abroad it is
    the dollar figure — importing it would post roughly a fifth of what the
    issuer will actually bill. Only the magnitude comes from the converted
    field: the sign is what separates a purchase from a bill payment, and
    ``amount`` is the field that always carries it.
    """
    signed = _signed_cents(transaction.get("amount"))
    if _foreign_currency(transaction) is None:
        return signed
    converted = _abs_cents(transaction.get("amountInAccountCurrency"))
    return -converted if signed < 0 else converted


def _local_abs_cents(transaction: dict[str, Any]) -> int:
    return abs(_local_signed_cents(transaction))


def _foreign_fields(transaction: dict[str, Any]) -> dict[str, Any]:
    """What the purchase looked like before conversion.

    Carried on the proposal so the review can show "US$ 8,48" next to the
    reais: the description alone rarely says a charge came from abroad, and the
    converted value is the only thing that would otherwise reach the ledger.
    """
    currency = _foreign_currency(transaction)
    if currency is None:
        return {}
    return {
        "original_currency": currency,
        "original_amount": _abs_cents(transaction.get("amount")),
    }


def _signed_cents(value: Any) -> int:
    try:
        return int(
            (Decimal(str(value or 0)) * 100).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        )
    except Exception:
        return 0


def _abs_cents(value: Any) -> int:
    return abs(_signed_cents(value))


def _date_only(value: Any) -> str | None:
    text = _text(value)
    return text[:10] if text else None


def _utc(value: Any) -> str:
    text = _text(value)
    if text is None:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    if text.endswith("Z") and "T" in text:
        return text
    candidate = text if "T" in text else f"{text}T12:00:00+00:00"
    try:
        parsed = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
