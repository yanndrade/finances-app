from finance_app.domain.cards import allocate_invoice_cycle
from finance_app.domain.cards import allocate_purchase_installments


def test_allocate_invoice_cycle_rolls_due_date_into_following_month_when_due_day_precedes_closing_day() -> None:
    allocation = allocate_invoice_cycle(
        purchase_date="2026-03-20T12:00:00Z",
        closing_day=20,
        due_day=5,
    )

    assert allocation.reference_month == "2026-03"
    assert allocation.closing_date == "2026-03-20"
    assert allocation.due_date == "2026-04-05"


def test_allocate_purchase_installments_spreads_remainder_into_last_invoice() -> None:
    allocations = allocate_purchase_installments(
        purchase_date="2026-03-15T12:00:00Z",
        total_amount=100_00,
        installments_count=3,
        closing_day=10,
        due_day=20,
    )

    assert [allocation.installment_number for allocation in allocations] == [1, 2, 3]
    assert [allocation.amount for allocation in allocations] == [33_33, 33_33, 33_34]
    assert [allocation.reference_month for allocation in allocations] == [
        "2026-04",
        "2026-05",
        "2026-06",
    ]
    assert [allocation.closing_date for allocation in allocations] == [
        "2026-04-10",
        "2026-05-10",
        "2026-06-10",
    ]
    assert [allocation.due_date for allocation in allocations] == [
        "2026-04-20",
        "2026-05-20",
        "2026-06-20",
    ]
