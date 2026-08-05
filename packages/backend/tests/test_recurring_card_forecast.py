from datetime import date as real_date

from fastapi.testclient import TestClient

from finance_app.interfaces.http.app import create_app
import finance_app.application.recurring as recurring_module


class FixedDate(real_date):
    current = real_date(2026, 3, 15)

    @classmethod
    def today(cls) -> "FixedDate":
        return cls.current


def _client(tmp_path, monkeypatch) -> TestClient:
    FixedDate.current = real_date(2026, 3, 15)
    monkeypatch.setattr(recurring_module, "date", FixedDate)
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    assert client.post(
        "/api/accounts",
        json={
            "id": "acc-1",
            "name": "Main",
            "type": "wallet",
            "initial_balance": 100_000,
        },
    ).status_code == 201
    assert client.post(
        "/api/cards",
        json={
            "id": "card-1",
            "name": "Nubank",
            "limit": 100_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    ).status_code == 201
    assert client.post(
        "/api/recurring-rules",
        json={
            "id": "rule-streaming",
            "name": "Streaming",
            "amount": 3_000,
            "due_day": 20,
            "card_id": "card-1",
            "payment_method": "CARD",
            "category_id": "streaming",
            "card_start_month": "2026-03",
        },
    ).status_code == 201
    return client


def test_card_recurring_rule_is_forecast_then_posted_on_charge_date(tmp_path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)

    forecast_response = client.get(
        "/api/invoices",
        params={"card": "card-1", "month": "2026-04"},
    )
    assert forecast_response.status_code == 200
    assert forecast_response.json() == [
        {
            "invoice_id": "card-1:2026-04",
            "card_id": "card-1",
            "reference_month": "2026-04",
            "closing_date": "2026-04-10",
            "due_date": "2026-04-20",
            "total_amount": 0,
            "paid_amount": 0,
            "remaining_amount": 0,
            "purchase_count": 0,
            "status": "forecast",
            "forecast_amount": 3_000,
            "forecast_count": 1,
            "expected_total_amount": 3_000,
            "expected_remaining_amount": 3_000,
        }
    ]
    assert client.get("/api/cards").json()[0]["future_installment_total"] == 0

    FixedDate.current = real_date(2026, 3, 20)
    sync_response = client.post("/api/recurring-card-charges/sync")
    assert sync_response.status_code == 200
    assert sync_response.json()["posted_count"] == 1

    invoices = client.get(
        "/api/invoices",
        params={"card": "card-1", "month": "2026-04"},
    ).json()
    assert invoices[0]["status"] == "open"
    assert invoices[0]["total_amount"] == 3_000
    assert invoices[0]["forecast_amount"] == 0
    assert client.get("/api/cards").json()[0]["future_installment_total"] == 0

    second_sync = client.post("/api/recurring-card-charges/sync")
    assert second_sync.json()["posted_count"] == 0
    assert len(client.get("/api/card-purchases", params={"card": "card-1"}).json()) == 1


def test_edit_and_pause_update_only_unposted_card_forecast(tmp_path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)
    forecast_url = "/api/invoices?card=card-1&month=2026-04"
    assert client.get(forecast_url).json()[0]["forecast_amount"] == 3_000

    update = client.patch(
        "/api/recurring-rules/rule-streaming",
        json={"amount": 4_500, "name": "Streaming Plus"},
    )
    assert update.status_code == 200
    assert client.get(forecast_url).json()[0]["forecast_amount"] == 4_500
    item = client.get("/api/invoices/card-1:2026-04/items").json()[0]
    assert item["lifecycle_status"] == "forecast"
    assert item["scheduled_date"] == "2026-03-20"

    pause = client.patch(
        "/api/recurring-rules/rule-streaming",
        json={"is_active": False},
    )
    assert pause.status_code == 200
    assert client.get(forecast_url).json() == []
