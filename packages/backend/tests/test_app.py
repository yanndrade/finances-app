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
