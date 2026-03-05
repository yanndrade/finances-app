from finance_app.domain.policies import (
    budget_status,
    investment_goal_target,
    requires_review,
)


def test_investment_goal_target_uses_ten_percent_rule() -> None:
    assert investment_goal_target(monthly_income_total=125_000) == 12_500


def test_budget_status_respects_warning_and_exceeded_thresholds() -> None:
    assert budget_status(spent=7_999, limit=10_000) == "ok"
    assert budget_status(spent=8_000, limit=10_000) == "warning"
    assert budget_status(spent=10_001, limit=10_000) == "exceeded"


def test_requires_review_when_description_is_empty() -> None:
    assert requires_review(description=None) is True
    assert requires_review(description="") is True
    assert requires_review(description="Internet") is False
