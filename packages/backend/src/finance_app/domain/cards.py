from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone


@dataclass(frozen=True)
class InvoiceCycleAllocation:
    reference_month: str
    closing_date: str
    due_date: str


def parse_utc_timestamp(value: str) -> datetime:
    if not value.endswith("Z"):
        raise ValueError("Timestamp must be a UTC ISO 8601 value.")

    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None or parsed.utcoffset() != timezone.utc.utcoffset(parsed):
        raise ValueError("Timestamp must be a UTC ISO 8601 value.")

    return parsed


def allocate_invoice_cycle(
    *,
    purchase_date: str,
    closing_day: int,
    due_day: int,
) -> InvoiceCycleAllocation:
    purchase_dt = parse_utc_timestamp(purchase_date)
    target_year = purchase_dt.year
    target_month = purchase_dt.month

    if purchase_dt.day > closing_day:
        target_year, target_month = _shift_month(target_year, target_month, 1)

    closing = date(target_year, target_month, closing_day)
    due = date(target_year, target_month, due_day)

    return InvoiceCycleAllocation(
        reference_month=f"{target_year}-{target_month:02d}",
        closing_date=closing.isoformat(),
        due_date=due.isoformat(),
    )


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    total_months = year * 12 + (month - 1) + delta
    target_year = total_months // 12
    target_month = total_months % 12 + 1
    return target_year, target_month
