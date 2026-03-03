from finance_app.domain.cards import allocate_invoice_cycle


def test_allocate_invoice_cycle_rolls_due_date_into_following_month_when_due_day_precedes_closing_day() -> None:
    allocation = allocate_invoice_cycle(
        purchase_date="2026-03-20T12:00:00Z",
        closing_day=20,
        due_day=5,
    )

    assert allocation.reference_month == "2026-03"
    assert allocation.closing_date == "2026-03-20"
    assert allocation.due_date == "2026-04-05"
