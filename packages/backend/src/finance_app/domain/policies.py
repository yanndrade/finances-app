def investment_goal_target(*, monthly_income_total: int, goal_percent: int = 10) -> int:
    return int(round(monthly_income_total * (goal_percent / 100)))


def budget_status(*, spent: int, limit: int) -> str:
    if spent > limit:
        return "exceeded"
    if spent * 100 >= limit * 80:
        return "warning"
    return "ok"


def requires_review(
    *, description: str | None, category_id: str | None = None
) -> bool:
    del description
    del category_id
    return False
