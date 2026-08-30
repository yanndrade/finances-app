"""Match a proposal against entries that already exist locally.

Importing into a database with months of manual history would otherwise
duplicate everything the user already typed. A proposal that lines up with an
existing entry is offered as "this already exists, just link it" instead of as
something to create.

The rule is deliberately strict — same destination, exact amount, a few days
apart — because a false positive silently hides a real expense, which is worse
than asking the user about one extra line.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

DATE_TOLERANCE_DAYS = 3


def find_duplicates(
    proposals: list[Any],
    *,
    local_transactions: list[dict[str, Any]],
    local_purchases: list[dict[str, Any]],
    already_linked_ids: set[str] | None = None,
) -> dict[str, str]:
    """Return ``external_id -> local id`` for the proposals that already exist.

    A local entry is claimed by at most one proposal, so two identical charges
    on the same day do not both match the single entry that was typed by hand.
    """
    taken = set(already_linked_ids or set())
    matches: dict[str, str] = {}

    transactions_by_account = _group(local_transactions, "account_id")
    purchases_by_card = _group(local_purchases, "card_id")

    for proposal in sorted(proposals, key=lambda item: item.occurred_at):
        if proposal.kind == "bank_transaction":
            account_id = proposal.payload.get("account_id")
            candidate = _find(
                transactions_by_account.get(str(account_id), []),
                amount=proposal.amount,
                occurred_at=proposal.occurred_at,
                id_key="transaction_id",
                date_key="occurred_at",
                taken=taken,
                extra=lambda row: row.get("status") != "voided",
            )
        elif proposal.kind == "invoice_payment":
            # A settled bill shows up locally as the expense InvoicePaid writes
            # on the paying account.
            candidate = _find(
                transactions_by_account.get(
                    str(proposal.payload.get("account_id")), []
                ),
                amount=proposal.amount,
                occurred_at=proposal.occurred_at,
                id_key="transaction_id",
                date_key="occurred_at",
                taken=taken,
                extra=lambda row: row.get("category_id") == "invoice_payment",
            )
        elif proposal.kind == "transfer":
            candidate = _find(
                transactions_by_account.get(
                    str(proposal.payload.get("from_account_id")), []
                ),
                amount=proposal.amount,
                occurred_at=proposal.occurred_at,
                id_key="transaction_id",
                date_key="occurred_at",
                taken=taken,
                extra=lambda row: bool(row.get("transfer_id")),
            )
        elif proposal.kind == "card_purchase":
            card_id = proposal.payload.get("card_id")
            candidate = _find(
                purchases_by_card.get(str(card_id), []),
                amount=proposal.amount,
                occurred_at=proposal.occurred_at,
                id_key="purchase_id",
                date_key="purchase_date",
                taken=taken,
                extra=lambda row: int(row.get("installments_count") or 1)
                == int(proposal.payload.get("installments_count") or 1),
            )
        else:
            continue

        if candidate is not None:
            matches[proposal.external_id] = candidate
            taken.add(candidate)

    return matches


def _group(rows: list[dict[str, Any]], key: str) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(str(row.get(key)), []).append(row)
    return grouped


def _find(
    candidates: list[dict[str, Any]],
    *,
    amount: int,
    occurred_at: str,
    id_key: str,
    date_key: str,
    taken: set[str],
    extra: Any,
) -> str | None:
    reference = _parse(occurred_at)
    if reference is None:
        return None

    best: tuple[int, str] | None = None
    for row in candidates:
        row_id = str(row.get(id_key))
        if row_id in taken:
            continue
        if int(row.get("amount") or 0) != amount:
            continue
        if not extra(row):
            continue
        row_date = _parse(str(row.get(date_key)))
        if row_date is None:
            continue
        distance = abs((row_date - reference).days)
        if distance > DATE_TOLERANCE_DAYS:
            continue
        if best is None or distance < best[0]:
            best = (distance, row_id)

    return best[1] if best is not None else None


def _parse(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    # Both sides are UTC in practice; dropping the offset keeps the comparison
    # naive, and a few hours of skew is irrelevant against a tolerance in days.
    return parsed.replace(tzinfo=None)
