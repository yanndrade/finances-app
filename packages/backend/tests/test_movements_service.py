from finance_app.application.movements import MovementService


class StubMovementProjector:
    def __init__(self) -> None:
        self.run_calls = 0
        self.list_calls: list[dict[str, object | None]] = []
        self.summary_calls: list[str] = []

    def run(self) -> int:
        self.run_calls += 1
        return 0

    def list_unified_movements(
        self,
        *,
        competence_month: str | None = None,
        kind: str | None = None,
        origin_type: str | None = None,
        lifecycle_status: str | None = None,
        account_id: str | None = None,
        card_id: str | None = None,
        category_id: str | None = None,
        payment_method: str | None = None,
        counterparty: str | None = None,
        text: str | None = None,
        scope: str | None = None,
        needs_review: bool | None = None,
        sort_by: str = "posted_at",
        sort_dir: str = "desc",
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, object]:
        self.list_calls.append(
            {
                "competence_month": competence_month,
                "kind": kind,
                "origin_type": origin_type,
                "lifecycle_status": lifecycle_status,
                "account_id": account_id,
                "card_id": card_id,
                "category_id": category_id,
                "payment_method": payment_method,
                "counterparty": counterparty,
                "text": text,
                "scope": scope,
                "needs_review": needs_review,
                "sort_by": sort_by,
                "sort_dir": sort_dir,
                "page": page,
                "page_size": page_size,
            }
        )
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "pages": 0}

    def get_movements_summary(
        self,
        *,
        competence_month: str,
    ) -> dict[str, object]:
        self.summary_calls.append(competence_month)
        return {"competence_month": competence_month, "counts": {"all": 0}}


def test_movement_service_syncs_projection_before_listing() -> None:
    projector = StubMovementProjector()
    service = MovementService(projector=projector)

    result = service.list_movements(
        competence_month="2026-03",
        scope="variable",
        page=2,
        page_size=25,
    )

    assert projector.run_calls == 1
    assert projector.list_calls == [
        {
            "competence_month": "2026-03",
            "kind": None,
            "origin_type": None,
            "lifecycle_status": None,
            "account_id": None,
            "card_id": None,
            "category_id": None,
            "payment_method": None,
            "counterparty": None,
            "text": None,
            "scope": "variable",
            "needs_review": None,
            "sort_by": "posted_at",
            "sort_dir": "desc",
            "page": 2,
            "page_size": 25,
        }
    ]
    assert result == {
        "items": [],
        "total": 0,
        "page": 2,
        "page_size": 25,
        "pages": 0,
    }


def test_movement_service_syncs_projection_before_summary() -> None:
    projector = StubMovementProjector()
    service = MovementService(projector=projector)

    result = service.get_summary(competence_month="2026-03")

    assert projector.run_calls == 1
    assert projector.summary_calls == ["2026-03"]
    assert result == {"competence_month": "2026-03", "counts": {"all": 0}}
