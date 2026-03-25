from finance_app.domain.policies import (
    budget_status,
    investment_goal_target,
    requires_review,
)


def test_investment_goal_target_uses_ten_percent_rule() -> None:
    assert investment_goal_target(monthly_income_total=125_000) == 12_500


def test_investment_goal_target_supports_custom_percentages() -> None:
    assert investment_goal_target(monthly_income_total=125_000, goal_percent=15) == 18_750
    assert investment_goal_target(monthly_income_total=125_000, goal_percent=0) == 0


def test_budget_status_respects_warning_and_exceeded_thresholds() -> None:
    assert budget_status(spent=7_999, limit=10_000) == "ok"
    assert budget_status(spent=8_000, limit=10_000) == "warning"
    assert budget_status(spent=10_001, limit=10_000) == "exceeded"


def test_requires_review_is_disabled() -> None:
    assert requires_review(description=None, category_id="other") is False
    assert requires_review(description="", category_id="uncategorized") is False
    assert requires_review(description="Internet", category_id="internet") is False
    assert requires_review(description=None, category_id="food") is False
    assert requires_review(description="", category_id="food") is False
