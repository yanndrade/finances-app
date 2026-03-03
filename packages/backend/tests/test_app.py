from fastapi import FastAPI
from fastapi.testclient import TestClient

from finance_app.application.health import HealthCheckUseCase
from finance_app.cli import main
from finance_app.interfaces.http.app import create_app


def test_create_app_returns_fastapi_instance() -> None:
    app = create_app()

    assert isinstance(app, FastAPI)


def test_health_endpoint_uses_application_layer() -> None:
    app = create_app()
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "source": "application"}


def test_health_use_case_returns_expected_payload() -> None:
    use_case = HealthCheckUseCase()

    assert use_case.execute() == {"status": "ok", "source": "application"}


def test_cli_entrypoint_lives_in_finance_app_package(capsys) -> None:
    main()

    captured = capsys.readouterr()

    assert "finance_app.interfaces.http.create_app()" in captured.out


def test_accounts_endpoints_support_create_list_and_update(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)

    create_response = client.post(
        "/api/accounts",
        json={
            "id": "acc-1",
            "name": "Main Wallet",
            "type": "wallet",
            "initial_balance": 125_00,
        },
    )

    assert create_response.status_code == 201
    assert create_response.json() == {
        "account_id": "acc-1",
        "name": "Main Wallet",
        "type": "wallet",
        "initial_balance": 125_00,
        "is_active": True,
        "current_balance": 125_00,
    }

    list_response = client.get("/api/accounts")

    assert list_response.status_code == 200
    assert list_response.json() == [
        {
            "account_id": "acc-1",
            "name": "Main Wallet",
            "type": "wallet",
            "initial_balance": 125_00,
            "is_active": True,
            "current_balance": 125_00,
        }
    ]

    update_response = client.patch(
        "/api/accounts/acc-1",
        json={
            "name": "Emergency Fund",
            "type": "savings",
            "initial_balance": 300_00,
        },
    )

    assert update_response.status_code == 200
    assert update_response.json() == {
        "account_id": "acc-1",
        "name": "Emergency Fund",
        "type": "savings",
        "initial_balance": 300_00,
        "is_active": True,
        "current_balance": 300_00,
    }


def test_accounts_endpoints_reject_deactivating_last_active_account(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)

    client.post(
        "/api/accounts",
        json={
            "id": "acc-1",
            "name": "Main Wallet",
            "type": "wallet",
            "initial_balance": 125_00,
        },
    )

    response = client.patch(
        "/api/accounts/acc-1",
        json={"is_active": False},
    )

    assert response.status_code == 409
    assert response.json() == {
        "detail": "At least one active account must remain.",
    }


def test_accounts_endpoints_validate_prd_account_types(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)

    response = client.post(
        "/api/accounts",
        json={
            "id": "acc-1",
            "name": "Brokerage Cash",
            "type": "cash",
            "initial_balance": 0,
        },
    )

    assert response.status_code == 422


def test_cash_transaction_endpoints_support_create_edit_and_void(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)

    income_response = client.post(
        "/api/incomes",
        json={
            "id": "tx-1",
            "occurred_at": "2026-03-02T12:01:00Z",
            "amount": 50_00,
            "account_id": "acc-1",
            "payment_method": "PIX",
            "category_id": "salary",
            "description": "Salary",
        },
    )

    assert income_response.status_code == 201
    assert income_response.json()["status"] == "active"

    expense_response = client.post(
        "/api/expenses",
        json={
            "id": "tx-2",
            "occurred_at": "2026-03-02T12:02:00Z",
            "amount": 20_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Lunch",
            "person_id": "friend",
        },
    )

    assert expense_response.status_code == 201
    assert expense_response.json() == {
        "transaction_id": "tx-2",
        "occurred_at": "2026-03-02T12:02:00Z",
        "type": "expense",
        "amount": 20_00,
        "account_id": "acc-1",
        "payment_method": "CASH",
        "category_id": "food",
        "description": "Lunch",
        "person_id": "friend",
        "status": "active",
    }

    update_response = client.patch(
        "/api/transactions/tx-2",
        json={
            "amount": 25_00,
            "description": "Lunch with dessert",
            "payment_method": "OTHER",
        },
    )

    assert update_response.status_code == 200
    assert update_response.json()["amount"] == 25_00
    assert update_response.json()["description"] == "Lunch with dessert"
    assert update_response.json()["payment_method"] == "OTHER"

    void_response = client.post(
        "/api/transactions/tx-1/void",
        json={"reason": "Duplicate"},
    )

    assert void_response.status_code == 200
    assert void_response.json()["status"] == "voided"

    list_response = client.get("/api/transactions")

    assert list_response.status_code == 200
    assert list_response.json() == [
        {
            "transaction_id": "tx-2",
            "occurred_at": "2026-03-02T12:02:00Z",
            "type": "expense",
            "amount": 25_00,
            "account_id": "acc-1",
            "payment_method": "OTHER",
            "category_id": "food",
            "description": "Lunch with dessert",
            "person_id": "friend",
            "status": "active",
        },
        {
            "transaction_id": "tx-1",
            "occurred_at": "2026-03-02T12:01:00Z",
            "type": "income",
            "amount": 50_00,
            "account_id": "acc-1",
            "payment_method": "PIX",
            "category_id": "salary",
            "description": "Salary",
            "person_id": None,
            "status": "voided",
        },
    ]

    accounts_response = client.get("/api/accounts")

    assert accounts_response.status_code == 200
    assert accounts_response.json()[0]["current_balance"] == 75_00


def test_cash_transaction_list_supports_prd_filter_set(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_account(client, "acc-2", "Savings", "savings", 200_00)
    _create_expense(
        client,
        {
            "id": "tx-1",
            "occurred_at": "2026-03-02T08:00:00Z",
            "amount": 15_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Morning coffee",
            "person_id": "cafe",
        },
    )
    _create_expense(
        client,
        {
            "id": "tx-2",
            "occurred_at": "2026-03-03T08:00:00Z",
            "amount": 30_00,
            "account_id": "acc-2",
            "payment_method": "OTHER",
            "category_id": "travel",
            "description": "Bus ticket",
            "person_id": "station",
        },
    )

    response = client.get(
        "/api/transactions",
        params={
            "from": "2026-03-02T00:00:00Z",
            "to": "2026-03-02T23:59:59Z",
            "category": "food",
            "account": "acc-1",
            "method": "CASH",
            "person": "cafe",
            "text": "coffee",
        },
    )

    assert response.status_code == 200
    assert response.json() == [
        {
            "transaction_id": "tx-1",
            "occurred_at": "2026-03-02T08:00:00Z",
            "type": "expense",
            "amount": 15_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Morning coffee",
            "person_id": "cafe",
            "status": "active",
        }
    ]


def test_cash_transaction_endpoints_require_existing_account_and_utc_timestamp(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)

    missing_account_response = client.post(
        "/api/expenses",
        json={
            "id": "tx-1",
            "occurred_at": "2026-03-02T12:02:00Z",
            "amount": 20_00,
            "account_id": "missing",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Lunch",
        },
    )
    invalid_timestamp_response = client.post(
        "/api/expenses",
        json={
            "id": "tx-2",
            "occurred_at": "2026-03-02T12:02:00",
            "amount": 20_00,
            "account_id": "missing",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Lunch",
        },
    )

    assert missing_account_response.status_code == 404
    assert invalid_timestamp_response.status_code == 422


def test_cash_transaction_endpoints_return_422_for_whitespace_required_fields(
    tmp_path,
) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)

    response = client.post(
        "/api/expenses",
        json={
            "id": "tx-1",
            "occurred_at": "2026-03-02T12:02:00Z",
            "amount": 20_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "   ",
            "description": "Lunch",
        },
    )

    assert response.status_code == 422


def test_cash_transaction_update_can_clear_nullable_fields(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_expense(
        client,
        {
            "id": "tx-1",
            "occurred_at": "2026-03-02T08:00:00Z",
            "amount": 15_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Morning coffee",
            "person_id": "cafe",
        },
    )

    response = client.patch(
        "/api/transactions/tx-1",
        json={
            "description": None,
            "person_id": None,
        },
    )

    assert response.status_code == 200
    assert response.json()["description"] is None
    assert response.json()["person_id"] is None


def test_transfer_endpoint_creates_linked_internal_movements(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_account(client, "acc-2", "Broker", "investment", 300_00)

    response = client.post(
        "/api/transfers",
        json={
            "id": "trf-1",
            "occurred_at": "2026-03-02T12:02:00Z",
            "from_account_id": "acc-1",
            "to_account_id": "acc-2",
            "amount": 25_00,
            "description": "Broker top-up",
        },
    )

    assert response.status_code == 201
    assert response.json() == [
        {
            "transaction_id": "trf-1:debit",
            "occurred_at": "2026-03-02T12:02:00Z",
            "type": "transfer",
            "amount": 25_00,
            "account_id": "acc-1",
            "payment_method": "OTHER",
            "category_id": "transfer",
            "description": "Broker top-up",
            "person_id": None,
            "status": "active",
            "transfer_id": "trf-1",
            "direction": "debit",
        },
        {
            "transaction_id": "trf-1:credit",
            "occurred_at": "2026-03-02T12:02:00Z",
            "type": "transfer",
            "amount": 25_00,
            "account_id": "acc-2",
            "payment_method": "OTHER",
            "category_id": "transfer",
            "description": "Broker top-up",
            "person_id": None,
            "status": "active",
            "transfer_id": "trf-1",
            "direction": "credit",
        },
    ]

    accounts_response = client.get("/api/accounts")

    assert accounts_response.status_code == 200
    assert accounts_response.json() == [
        {
            "account_id": "acc-1",
            "name": "Main Wallet",
            "type": "wallet",
            "initial_balance": 100_00,
            "is_active": True,
            "current_balance": 75_00,
        },
        {
            "account_id": "acc-2",
            "name": "Broker",
            "type": "investment",
            "initial_balance": 300_00,
            "is_active": True,
            "current_balance": 325_00,
        },
    ]


def test_transfer_endpoint_rejects_same_origin_and_destination(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)

    response = client.post(
        "/api/transfers",
        json={
            "id": "trf-1",
            "occurred_at": "2026-03-02T12:02:00Z",
            "from_account_id": "acc-1",
            "to_account_id": "acc-1",
            "amount": 25_00,
            "description": "Invalid self-transfer",
        },
    )

    assert response.status_code == 422


def test_voiding_transfer_credit_reverses_destination_balance_correctly(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_account(client, "acc-2", "Broker", "investment", 300_00)

    transfer_response = client.post(
        "/api/transfers",
        json={
            "id": "trf-1",
            "occurred_at": "2026-03-02T12:02:00Z",
            "from_account_id": "acc-1",
            "to_account_id": "acc-2",
            "amount": 25_00,
            "description": "Broker top-up",
        },
    )
    assert transfer_response.status_code == 201

    void_response = client.post(
        "/api/transactions/trf-1:credit/void",
        json={"reason": "Undo transfer"},
    )

    assert void_response.status_code == 200

    accounts_response = client.get("/api/accounts")

    assert accounts_response.status_code == 200
    assert accounts_response.json() == [
        {
            "account_id": "acc-1",
            "name": "Main Wallet",
            "type": "wallet",
            "initial_balance": 100_00,
            "is_active": True,
            "current_balance": 75_00,
        },
        {
            "account_id": "acc-2",
            "name": "Broker",
            "type": "investment",
            "initial_balance": 300_00,
            "is_active": True,
            "current_balance": 300_00,
        },
    ]


def test_transfer_endpoint_rejects_collisions_with_derived_leg_ids(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_account(client, "acc-2", "Broker", "investment", 300_00)
    _create_expense(
        client,
        {
            "id": "trf-1:debit",
            "occurred_at": "2026-03-02T08:00:00Z",
            "amount": 15_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Existing transaction",
            "person_id": None,
        },
    )

    response = client.post(
        "/api/transfers",
        json={
            "id": "trf-1",
            "occurred_at": "2026-03-02T12:02:00Z",
            "from_account_id": "acc-1",
            "to_account_id": "acc-2",
            "amount": 25_00,
            "description": "Broker top-up",
        },
    )

    assert response.status_code == 409


def test_dashboard_endpoint_returns_monthly_summary_from_projections(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_account(client, "acc-2", "Savings", "savings", 25_00)

    income_response = client.post(
        "/api/incomes",
        json={
            "id": "tx-1",
            "occurred_at": "2026-03-02T12:01:00Z",
            "amount": 50_00,
            "account_id": "acc-1",
            "payment_method": "PIX",
            "category_id": "salary",
            "description": "Salary",
        },
    )
    assert income_response.status_code == 201

    expense_response = client.post(
        "/api/expenses",
        json={
            "id": "tx-2",
            "occurred_at": "2026-03-02T12:02:00Z",
            "amount": 20_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Lunch",
        },
    )
    assert expense_response.status_code == 201

    transfer_response = client.post(
        "/api/transfers",
        json={
            "id": "trf-1",
            "occurred_at": "2026-03-02T12:03:00Z",
            "from_account_id": "acc-1",
            "to_account_id": "acc-2",
            "amount": 10_00,
            "description": "Move to savings",
        },
    )
    assert transfer_response.status_code == 201

    response = client.get(
        "/api/dashboard",
        params={"month": "2026-03"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "month": "2026-03",
        "total_income": 50_00,
        "total_expense": 20_00,
        "net_flow": 30_00,
        "current_balance": 155_00,
        "recent_transactions": [
            {
                "transaction_id": "trf-1:debit",
                "occurred_at": "2026-03-02T12:03:00Z",
                "type": "transfer",
                "amount": 10_00,
                "account_id": "acc-1",
                "payment_method": "OTHER",
                "category_id": "transfer",
                "description": "Move to savings",
                "person_id": None,
                "status": "active",
                "transfer_id": "trf-1",
                "direction": "debit",
            },
            {
                "transaction_id": "trf-1:credit",
                "occurred_at": "2026-03-02T12:03:00Z",
                "type": "transfer",
                "amount": 10_00,
                "account_id": "acc-2",
                "payment_method": "OTHER",
                "category_id": "transfer",
                "description": "Move to savings",
                "person_id": None,
                "status": "active",
                "transfer_id": "trf-1",
                "direction": "credit",
            },
            {
                "transaction_id": "tx-2",
                "occurred_at": "2026-03-02T12:02:00Z",
                "type": "expense",
                "amount": 20_00,
                "account_id": "acc-1",
                "payment_method": "CASH",
                "category_id": "food",
                "description": "Lunch",
                "person_id": None,
                "status": "active",
            },
            {
                "transaction_id": "tx-1",
                "occurred_at": "2026-03-02T12:01:00Z",
                "type": "income",
                "amount": 50_00,
                "account_id": "acc-1",
                "payment_method": "PIX",
                "category_id": "salary",
                "description": "Salary",
                "person_id": None,
                "status": "active",
            },
        ],
        "spending_by_category": [
            {
                "category_id": "food",
                "total": 20_00,
            }
        ],
        "previous_month": {
            "total_income": 0,
            "total_expense": 0,
            "net_flow": 0,
        },
        "daily_balance_series": [
            {
                "date": "2026-03-02",
                "balance": 30_00,
            }
        ],
        "review_queue": [],
    }


def test_dashboard_endpoint_rejects_invalid_month_format(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)

    response = client.get(
        "/api/dashboard",
        params={"month": "2026-3"},
    )

    assert response.status_code == 422


def test_backend_allows_cors_for_local_frontend_origins(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)

    response = client.options(
        "/api/dashboard",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


def test_dev_reset_endpoint_clears_projection_and_event_data(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_expense(
        client,
        {
            "id": "tx-1",
            "occurred_at": "2026-03-02T08:00:00Z",
            "amount": 15_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Morning coffee",
            "person_id": None,
        },
    )

    reset_response = client.post("/api/dev/reset")

    assert reset_response.status_code == 200
    assert reset_response.json() == {"status": "ok", "message": "Application data reset."}

    accounts_response = client.get("/api/accounts")
    transactions_response = client.get("/api/transactions")
    dashboard_response = client.get("/api/dashboard", params={"month": "2026-03"})

    assert accounts_response.status_code == 200
    assert accounts_response.json() == []

    assert transactions_response.status_code == 200
    assert transactions_response.json() == []

    assert dashboard_response.status_code == 200
    assert dashboard_response.json() == {
        "month": "2026-03",
        "total_income": 0,
        "total_expense": 0,
        "net_flow": 0,
        "current_balance": 0,
        "recent_transactions": [],
        "spending_by_category": [],
        "previous_month": {
            "total_income": 0,
            "total_expense": 0,
            "net_flow": 0,
        },
        "daily_balance_series": [],
        "review_queue": [],
    }


def test_cards_endpoints_support_create_list_and_update(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_account(client, "acc-2", "Checking", "checking", 500_00)

    create_response = client.post(
        "/api/cards",
        json={
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )

    assert create_response.status_code == 201
    assert create_response.json() == {
        "card_id": "card-1",
        "name": "Nubank",
        "limit": 150_000,
        "closing_day": 10,
        "due_day": 20,
        "payment_account_id": "acc-1",
        "is_active": True,
    }

    list_response = client.get("/api/cards")

    assert list_response.status_code == 200
    assert list_response.json() == [
        {
            "card_id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
            "is_active": True,
        }
    ]

    update_response = client.patch(
        "/api/cards/card-1",
        json={
            "name": "Nubank Platinum",
            "limit": 200_000,
            "closing_day": 8,
            "due_day": 18,
            "payment_account_id": "acc-2",
            "is_active": False,
        },
    )

    assert update_response.status_code == 200
    assert update_response.json() == {
        "card_id": "card-1",
        "name": "Nubank Platinum",
        "limit": 200_000,
        "closing_day": 8,
        "due_day": 18,
        "payment_account_id": "acc-2",
        "is_active": False,
    }


def test_cards_endpoints_validate_cycle_days_and_payment_account(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)

    invalid_closing_response = client.post(
        "/api/cards",
        json={
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 0,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )
    invalid_due_response = client.post(
        "/api/cards",
        json={
            "id": "card-2",
            "name": "Visa",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 29,
            "payment_account_id": "acc-1",
        },
    )
    missing_account_response = client.post(
        "/api/cards",
        json={
            "id": "card-3",
            "name": "Mastercard",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "missing",
        },
    )

    assert invalid_closing_response.status_code == 422
    assert invalid_due_response.status_code == 422
    assert missing_account_response.status_code == 404


def _create_account(client: TestClient, account_id: str, name: str, account_type: str, initial_balance: int) -> None:
    response = client.post(
        "/api/accounts",
        json={
            "id": account_id,
            "name": name,
            "type": account_type,
            "initial_balance": initial_balance,
        },
    )

    assert response.status_code == 201


def _create_expense(client: TestClient, payload: dict[str, str | int]) -> None:
    response = client.post("/api/expenses", json=payload)

    assert response.status_code == 201
