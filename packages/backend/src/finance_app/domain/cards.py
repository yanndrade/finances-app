from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime, timezone


@dataclass(frozen=True)
class InvoiceCycleAllocation:
    reference_month: str
    closing_date: str
    due_date: str


@dataclass(frozen=True)
class PurchaseInstallmentAllocation:
    installment_number: int
    amount: int
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
    return _allocate_invoice_cycle_for_datetime(
        purchase_dt=purchase_dt,
        closing_day=closing_day,
        due_day=due_day,
    )


def allocate_purchase_installments(
    *,
    purchase_date: str,
    total_amount: int,
    installments_count: int,
    closing_day: int,
    due_day: int,
) -> list[PurchaseInstallmentAllocation]:
    if installments_count < 1:
        raise ValueError("installments_count must be at least 1.")

    purchase_dt = parse_utc_timestamp(purchase_date)
    base_amount = total_amount // installments_count
    remainder = total_amount % installments_count
    allocations: list[PurchaseInstallmentAllocation] = []

    for installment_index in range(installments_count):
        shifted_purchase_dt = _shift_datetime_month(purchase_dt, installment_index)
        invoice_cycle = _allocate_invoice_cycle_for_datetime(
            purchase_dt=shifted_purchase_dt,
            closing_day=closing_day,
            due_day=due_day,
        )
        amount = base_amount
        if installment_index == installments_count - 1:
            amount += remainder

        allocations.append(
            PurchaseInstallmentAllocation(
                installment_number=installment_index + 1,
                amount=amount,
                reference_month=invoice_cycle.reference_month,
                closing_date=invoice_cycle.closing_date,
                due_date=invoice_cycle.due_date,
            )
        )

    return allocations


def _allocate_invoice_cycle_for_datetime(
    *,
    purchase_dt: datetime,
    closing_day: int,
    due_day: int,
) -> InvoiceCycleAllocation:
    target_year = purchase_dt.year
    target_month = purchase_dt.month

    if purchase_dt.day > closing_day:
        target_year, target_month = _shift_month(target_year, target_month, 1)

    closing = date(target_year, target_month, closing_day)
    due_year = target_year
    due_month = target_month
    if due_day < closing_day:
        due_year, due_month = _shift_month(due_year, due_month, 1)
    due = date(due_year, due_month, due_day)

    return InvoiceCycleAllocation(
        reference_month=f"{target_year}-{target_month:02d}",
        closing_date=closing.isoformat(),
        due_date=due.isoformat(),
    )


def _shift_datetime_month(value: datetime, delta: int) -> datetime:
    target_year, target_month = _shift_month(value.year, value.month, delta)
    last_day = calendar.monthrange(target_year, target_month)[1]
    target_day = min(value.day, last_day)

    return value.replace(year=target_year, month=target_month, day=target_day)


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    total_months = year * 12 + (month - 1) + delta
    target_year = total_months // 12
    target_month = total_months % 12 + 1
    return target_year, target_month
