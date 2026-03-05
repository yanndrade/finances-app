def investment_goal_target(*, monthly_income_total: int) -> int:
    return int(round(monthly_income_total * 0.1))


def budget_status(*, spent: int, limit: int) -> str:
    if spent > limit:
        return "exceeded"
    if spent * 100 >= limit * 80:
        return "warning"
    return "ok"


def requires_review(*, description: str | None) -> bool:
    return description is None or description.strip() == ""
