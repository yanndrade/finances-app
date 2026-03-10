from fastapi import FastAPI
from fastapi.testclient import TestClient

from finance_app.application.health import HealthCheckUseCase
from finance_app.cli import main
import finance_app.interfaces.http.app as http_app
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


def test_http_app_module_does_not_import_infrastructure_directly() -> None:
    source = open(http_app.__file__, encoding="utf-8").read()
    assert "from finance_app.infrastructure" not in source


def test_http_routes_are_built_from_bootstrap_services(tmp_path) -> None:
    from finance_app.interfaces.http.app import build_router
    from finance_app.interfaces.http.bootstrap import build_services

    services = build_services(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    router = build_router(services)

    assert router is not None
    assert len(router.routes) > 0


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


def test_cash_transaction_list_supports_ledger_projection_mode(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_account(client, "acc-2", "Savings", "savings", 50_00)

    income_response = client.post(
        "/api/incomes",
        json={
            "id": "tx-income",
            "occurred_at": "2026-03-02T08:01:00Z",
            "amount": 30_00,
            "account_id": "acc-1",
            "payment_method": "PIX",
            "category_id": "salary",
            "description": "Salario",
        },
    )
    assert income_response.status_code == 201

    expense_response = client.post(
        "/api/expenses",
        json={
            "id": "tx-expense",
            "occurred_at": "2026-03-02T08:02:00Z",
            "amount": 15_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Cafe",
        },
    )
    assert expense_response.status_code == 201

    transfer_response = client.post(
        "/api/transfers",
        json={
            "id": "trf-1",
            "occurred_at": "2026-03-02T08:03:00Z",
            "from_account_id": "acc-1",
            "to_account_id": "acc-2",
            "amount": 10_00,
            "description": "Reserva",
        },
    )
    assert transfer_response.status_code == 201

    response = client.get("/api/transactions", params={"ledger": "true"})
    assert response.status_code == 200

    by_id = {item["transaction_id"]: item for item in response.json()}

    assert by_id["tx-income"]["ledger_event_type"] == "income"
    assert by_id["tx-income"]["ledger_source"] == "category:salary"
    assert by_id["tx-income"]["ledger_destination"] == "account:acc-1"

    assert by_id["tx-expense"]["ledger_event_type"] == "expense"
    assert by_id["tx-expense"]["ledger_source"] == "account:acc-1"
    assert by_id["tx-expense"]["ledger_destination"] == "category:food"

    assert by_id["trf-1:debit"]["ledger_event_type"] == "transfer_out"
    assert by_id["trf-1:debit"]["ledger_source"] == "account:acc-1"
    assert by_id["trf-1:debit"]["ledger_destination"] == "transfer:trf-1"

    assert by_id["trf-1:credit"]["ledger_event_type"] == "transfer_in"
    assert by_id["trf-1:credit"]["ledger_source"] == "transfer:trf-1"
    assert by_id["trf-1:credit"]["ledger_destination"] == "account:acc-2"


def test_transactions_ledger_mode_aggregates_card_purchases_and_investment_movements(
    tmp_path,
) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 200_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Blue Card",
            "limit": 500_00,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )
    _create_card_purchase(
        client,
        {
            "id": "purchase-1",
            "purchase_date": "2026-03-02T10:00:00Z",
            "amount": 90_00,
            "installments_count": 3,
            "category_id": "electronics",
            "card_id": "card-1",
            "description": "Headphones",
        },
    )

    investment_contribution_response = client.post(
        "/api/investments/movements",
        json={
            "id": "inv-1",
            "occurred_at": "2026-03-02T12:00:00Z",
            "type": "contribution",
            "account_id": "acc-1",
            "description": "Aporte mensal",
            "contribution_amount": 40_00,
            "dividend_amount": 5_00,
        },
    )
    assert investment_contribution_response.status_code == 201

    investment_withdrawal_response = client.post(
        "/api/investments/movements",
        json={
            "id": "inv-2",
            "occurred_at": "2026-03-03T09:30:00Z",
            "type": "withdrawal",
            "account_id": "acc-1",
            "description": "Resgate parcial",
            "cash_amount": 15_00,
            "invested_amount": 15_00,
        },
    )
    assert investment_withdrawal_response.status_code == 201

    response = client.get("/api/transactions", params={"ledger": "true"})
    assert response.status_code == 200

    by_id = {item["transaction_id"]: item for item in response.json()}

    assert by_id["purchase-1:card-purchase"] == {
        "transaction_id": "purchase-1:card-purchase",
        "occurred_at": "2026-03-02T10:00:00Z",
        "type": "expense",
        "amount": 90_00,
        "account_id": "acc-1",
        "payment_method": "OTHER",
        "category_id": "electronics",
        "description": "Headphones",
        "person_id": None,
        "status": "readonly",
        "ledger_event_type": "card_purchase",
        "ledger_source": "card_liability:card-1",
        "ledger_destination": "category:electronics",
    }

    assert by_id["inv-1:investment"] == {
        "transaction_id": "inv-1:investment",
        "occurred_at": "2026-03-02T12:00:00Z",
        "type": "investment",
        "amount": 40_00,
        "account_id": "acc-1",
        "payment_method": "OTHER",
        "category_id": "investment_contribution",
        "description": "Aporte mensal",
        "person_id": None,
        "status": "readonly",
        "ledger_event_type": "investment_contribution",
        "ledger_source": "account:acc-1",
        "ledger_destination": "investment_asset:acc-1",
    }

    assert by_id["inv-2:investment"] == {
        "transaction_id": "inv-2:investment",
        "occurred_at": "2026-03-03T09:30:00Z",
        "type": "investment",
        "amount": 15_00,
        "account_id": "acc-1",
        "payment_method": "OTHER",
        "category_id": "investment_withdrawal",
        "description": "Resgate parcial",
        "person_id": None,
        "status": "readonly",
        "ledger_event_type": "investment_withdrawal",
        "ledger_source": "investment_asset:acc-1",
        "ledger_destination": "account:acc-1",
    }

    investment_only_response = client.get(
        "/api/transactions",
        params={"ledger": "true", "type": "investment"},
    )
    assert investment_only_response.status_code == 200
    assert {
        item["transaction_id"] for item in investment_only_response.json()
    } == {"inv-1:investment", "inv-2:investment"}


def test_transactions_endpoint_exposes_ledger_projection_contract_in_openapi(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)

    openapi_response = client.get("/openapi.json")
    assert openapi_response.status_code == 200
    openapi_payload = openapi_response.json()

    transactions_get = openapi_payload["paths"]["/api/transactions"]["get"]
    parameter_map = {
        parameter["name"]: parameter for parameter in transactions_get["parameters"]
    }
    assert "ledger" in parameter_map
    assert parameter_map["ledger"]["schema"]["type"] == "boolean"
    assert "type" in parameter_map

    response_schema = transactions_get["responses"]["200"]["content"]["application/json"][
        "schema"
    ]
    assert response_schema["type"] == "array"

    item_ref = response_schema["items"]["$ref"]
    item_schema_name = item_ref.split("/")[-1]
    item_schema = openapi_payload["components"]["schemas"][item_schema_name]
    item_properties = item_schema["properties"]

    assert "ledger_event_type" in item_properties
    assert "ledger_source" in item_properties
    assert "ledger_destination" in item_properties


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
        "fixed_expenses_total": 0,
        "installment_total": 0,
        "variable_expenses_total": 20_00,
        "invoices_due_total": 0,
        "free_to_spend": 30_00,
        "pending_reimbursements_total": 0,
        "pending_reimbursements": [],
        "monthly_commitments": [],
        "monthly_fixed_expenses": [],
        "monthly_installments": [],
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
        "category_budgets": [],
        "budget_alerts": [],
    }


def test_reimbursements_are_pending_until_marked_received(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)

    expense_response = client.post(
        "/api/expenses",
        json={
            "id": "tx-1",
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

    pending_dashboard = client.get("/api/dashboard", params={"month": "2026-03"})
    assert pending_dashboard.status_code == 200
    assert pending_dashboard.json()["pending_reimbursements_total"] == 20_00
    assert pending_dashboard.json()["pending_reimbursements"] == [
        {
            "transaction_id": "tx-1",
            "person_id": "friend",
            "amount": 20_00,
            "status": "pending",
            "account_id": "acc-1",
            "occurred_at": "2026-03-02T12:02:00Z",
            "received_at": None,
            "receipt_transaction_id": None,
        }
    ]

    received_response = client.post(
        "/api/reimbursements/tx-1/mark-received",
        json={"received_at": "2026-03-05T10:00:00Z"},
    )
    assert received_response.status_code == 201
    assert received_response.json() == {
        "transaction_id": "tx-1",
        "person_id": "friend",
        "amount": 20_00,
        "status": "received",
        "account_id": "acc-1",
        "occurred_at": "2026-03-02T12:02:00Z",
        "received_at": "2026-03-05T10:00:00Z",
        "receipt_transaction_id": "tx-1:reimbursement-receipt",
    }

    accounts_response = client.get("/api/accounts")
    assert accounts_response.status_code == 200
    assert accounts_response.json()[0]["current_balance"] == 100_00

    transactions_response = client.get("/api/transactions", params={"account": "acc-1"})
    assert transactions_response.status_code == 200
    assert any(
        transaction["transaction_id"] == "tx-1:reimbursement-receipt"
        and transaction["type"] == "income"
        and transaction["payment_method"] == "PIX"
        and transaction["category_id"] == "reimbursement"
        and transaction["person_id"] == "friend"
        for transaction in transactions_response.json()
    )

    received_dashboard = client.get("/api/dashboard", params={"month": "2026-03"})
    assert received_dashboard.status_code == 200
    assert received_dashboard.json()["pending_reimbursements_total"] == 0
    assert received_dashboard.json()["pending_reimbursements"] == []


def test_card_purchases_can_generate_pending_reimbursements(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )

    purchase_response = client.post(
        "/api/card-purchases",
        json={
            "id": "purchase-1",
            "purchase_date": "2026-03-02T12:02:00Z",
            "amount": 90_00,
            "installments_count": 3,
            "category_id": "food",
            "card_id": "card-1",
            "description": "Lunch",
            "person_id": "friend",
        },
    )
    assert purchase_response.status_code == 201

    pending_dashboard = client.get("/api/dashboard", params={"month": "2026-03"})
    assert pending_dashboard.status_code == 200
    assert pending_dashboard.json()["pending_reimbursements_total"] == 30_00
    assert pending_dashboard.json()["pending_reimbursements"] == [
        {
            "transaction_id": "purchase-1:1",
            "person_id": "friend",
            "amount": 30_00,
            "status": "pending",
            "account_id": "acc-1",
            "occurred_at": "2026-03-10T00:00:00Z",
            "received_at": None,
            "receipt_transaction_id": None,
        }
    ]

    received_response = client.post(
        "/api/reimbursements/purchase-1:1/mark-received",
        json={"received_at": "2026-03-05T10:00:00Z"},
    )
    assert received_response.status_code == 201
    assert received_response.json()["status"] == "received"
    assert received_response.json()["receipt_transaction_id"] == "purchase-1:1:reimbursement-receipt"

    accounts_response = client.get("/api/accounts")
    assert accounts_response.status_code == 200
    assert accounts_response.json()[0]["current_balance"] == 130_00

    march_received_dashboard = client.get("/api/dashboard", params={"month": "2026-03"})
    assert march_received_dashboard.status_code == 200
    assert march_received_dashboard.json()["pending_reimbursements_total"] == 0
    assert march_received_dashboard.json()["pending_reimbursements"] == []

    april_pending_dashboard = client.get("/api/dashboard", params={"month": "2026-04"})
    assert april_pending_dashboard.status_code == 200
    assert april_pending_dashboard.json()["pending_reimbursements_total"] == 30_00
    assert april_pending_dashboard.json()["pending_reimbursements"] == [
        {
            "transaction_id": "purchase-1:2",
            "person_id": "friend",
            "amount": 30_00,
            "status": "pending",
            "account_id": "acc-1",
            "occurred_at": "2026-04-10T00:00:00Z",
            "received_at": None,
            "receipt_transaction_id": None,
        }
    ]


def test_card_purchase_reimbursement_stays_in_reference_month_when_due_date_is_next_month(
    tmp_path,
) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 1,
            "payment_account_id": "acc-1",
        },
    )

    purchase_response = client.post(
        "/api/card-purchases",
        json={
            "id": "purchase-1",
            "purchase_date": "2026-03-02T12:02:00Z",
            "amount": 90_00,
            "installments_count": 3,
            "category_id": "food",
            "card_id": "card-1",
            "description": "Lunch",
            "person_id": "friend",
        },
    )
    assert purchase_response.status_code == 201

    march_dashboard = client.get("/api/dashboard", params={"month": "2026-03"})
    assert march_dashboard.status_code == 200
    assert march_dashboard.json()["pending_reimbursements_total"] == 30_00
    assert march_dashboard.json()["pending_reimbursements"] == [
        {
            "transaction_id": "purchase-1:1",
            "person_id": "friend",
            "amount": 30_00,
            "status": "pending",
            "account_id": "acc-1",
            "occurred_at": "2026-03-10T00:00:00Z",
            "received_at": None,
            "receipt_transaction_id": None,
        }
    ]

    april_dashboard = client.get("/api/dashboard", params={"month": "2026-04"})
    assert april_dashboard.status_code == 200
    assert april_dashboard.json()["pending_reimbursements_total"] == 30_00


def test_mark_reimbursement_received_returns_404_when_destination_account_is_missing(
    tmp_path,
) -> None:
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
            "occurred_at": "2026-03-02T12:02:00Z",
            "amount": 20_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Lunch",
            "person_id": "friend",
        },
    )

    response = client.post(
        "/api/reimbursements/tx-1/mark-received",
        json={
            "received_at": "2026-03-05T10:00:00Z",
            "account_id": "missing-account",
        },
    )

    assert response.status_code == 404


def test_mark_reimbursement_received_updates_projection_account_when_custom_account_is_used(
    tmp_path,
) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_account(client, "acc-2", "Savings", "savings", 50_00)
    _create_expense(
        client,
        {
            "id": "tx-1",
            "occurred_at": "2026-03-02T12:02:00Z",
            "amount": 20_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Lunch",
            "person_id": "friend",
        },
    )

    response = client.post(
        "/api/reimbursements/tx-1/mark-received",
        json={
            "received_at": "2026-03-05T10:00:00Z",
            "account_id": "acc-2",
        },
    )

    assert response.status_code == 201
    assert response.json()["account_id"] == "acc-2"

    accounts_response = client.get("/api/accounts")
    assert accounts_response.status_code == 200
    balances = {
        account["account_id"]: account["current_balance"]
        for account in accounts_response.json()
    }
    assert balances["acc-1"] == 80_00
    assert balances["acc-2"] == 70_00

    receipt_transactions_response = client.get(
        "/api/transactions",
        params={"account": "acc-2"},
    )
    assert receipt_transactions_response.status_code == 200
    assert any(
        transaction["transaction_id"] == "tx-1:reimbursement-receipt"
        for transaction in receipt_transactions_response.json()
    )


def test_recurring_rules_generate_monthly_pendings_without_affecting_balance(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)

    create_rule_response = client.post(
        "/api/recurring-rules",
        json={
            "id": "rule-rent",
            "name": "Rent",
            "amount": 25_00,
            "due_day": 5,
            "account_id": "acc-1",
            "payment_method": "PIX",
            "category_id": "rent",
            "description": "Apartment rent",
        },
    )

    assert create_rule_response.status_code == 201
    assert create_rule_response.json() == {
        "rule_id": "rule-rent",
        "name": "Rent",
        "amount": 25_00,
        "due_day": 5,
        "account_id": "acc-1",
        "card_id": None,
        "payment_method": "PIX",
        "category_id": "rent",
        "description": "Apartment rent",
        "is_active": True,
    }

    pendings_response = client.get("/api/pendings", params={"month": "2026-03"})
    assert pendings_response.status_code == 200
    assert pendings_response.json() == [
        {
            "pending_id": "rule-rent:2026-03",
            "rule_id": "rule-rent",
            "month": "2026-03",
            "name": "Rent",
            "amount": 25_00,
            "due_date": "2026-03-05",
            "account_id": "acc-1",
            "card_id": None,
            "payment_method": "PIX",
            "category_id": "rent",
            "description": "Apartment rent",
            "status": "pending",
            "transaction_id": None,
        }
    ]

    second_pendings_response = client.get("/api/pendings", params={"month": "2026-03"})
    assert second_pendings_response.status_code == 200
    assert second_pendings_response.json() == pendings_response.json()

    accounts_response = client.get("/api/accounts")
    assert accounts_response.status_code == 200
    assert accounts_response.json()[0]["current_balance"] == 100_00

    dashboard_response = client.get("/api/dashboard", params={"month": "2026-03"})
    assert dashboard_response.status_code == 200
    assert dashboard_response.json()["total_expense"] == 0
    assert dashboard_response.json()["spending_by_category"] == []


def test_confirm_pending_creates_expense_using_due_date(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_recurring_rule(
        client,
        {
            "id": "rule-rent",
            "name": "Rent",
            "amount": 25_00,
            "due_day": 5,
            "account_id": "acc-1",
            "payment_method": "PIX",
            "category_id": "rent",
            "description": "Apartment rent",
        },
    )

    list_response = client.get("/api/pendings", params={"month": "2026-03"})
    assert list_response.status_code == 200

    confirm_response = client.post("/api/pendings/rule-rent:2026-03/confirm")
    assert confirm_response.status_code == 201
    assert confirm_response.json() == {
        "pending_id": "rule-rent:2026-03",
        "rule_id": "rule-rent",
        "month": "2026-03",
        "name": "Rent",
        "amount": 25_00,
        "due_date": "2026-03-05",
        "account_id": "acc-1",
        "card_id": None,
        "payment_method": "PIX",
        "category_id": "rent",
        "description": "Apartment rent",
        "status": "confirmed",
        "transaction_id": "rule-rent:2026-03:expense",
    }

    duplicate_confirm_response = client.post("/api/pendings/rule-rent:2026-03/confirm")
    assert duplicate_confirm_response.status_code == 409

    transactions_response = client.get("/api/transactions", params={"account": "acc-1"})
    assert transactions_response.status_code == 200
    assert transactions_response.json() == [
        {
            "transaction_id": "rule-rent:2026-03:expense",
            "occurred_at": "2026-03-05T00:00:00Z",
            "type": "expense",
            "amount": 25_00,
            "account_id": "acc-1",
            "payment_method": "PIX",
            "category_id": "rent",
            "description": "Apartment rent",
            "person_id": None,
            "status": "active",
        }
    ]

    accounts_response = client.get("/api/accounts")
    assert accounts_response.status_code == 200
    assert accounts_response.json()[0]["current_balance"] == 75_00

    dashboard_response = client.get("/api/dashboard", params={"month": "2026-03"})
    assert dashboard_response.status_code == 200
    assert dashboard_response.json()["total_expense"] == 25_00
    assert dashboard_response.json()["spending_by_category"] == [
        {
            "category_id": "rent",
            "total": 25_00,
        }
    ]


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


def test_recurring_rules_can_be_listed_and_updated(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )
    _create_recurring_rule(
        client,
        {
            "id": "rule-rent",
            "name": "Rent",
            "amount": 25_00,
            "due_day": 5,
            "account_id": "acc-1",
            "payment_method": "PIX",
            "category_id": "rent",
            "description": "Apartment rent",
        },
    )

    list_response = client.get("/api/recurring-rules")
    assert list_response.status_code == 200
    assert list_response.json() == [
        {
            "rule_id": "rule-rent",
            "name": "Rent",
            "amount": 25_00,
            "due_day": 5,
            "account_id": "acc-1",
            "card_id": None,
            "payment_method": "PIX",
            "category_id": "rent",
            "description": "Apartment rent",
            "is_active": True,
        }
    ]

    update_response = client.patch(
        "/api/recurring-rules/rule-rent",
        json={
            "name": "Streaming Bundle",
            "amount": 45_00,
            "due_day": 8,
            "payment_method": "CARD",
            "account_id": None,
            "card_id": "card-1",
            "category_id": "streaming",
            "description": "Apps + music",
            "is_active": False,
        },
    )
    assert update_response.status_code == 200
    assert update_response.json() == {
        "rule_id": "rule-rent",
        "name": "Streaming Bundle",
        "amount": 45_00,
        "due_day": 8,
        "account_id": None,
        "card_id": "card-1",
        "payment_method": "CARD",
        "category_id": "streaming",
        "description": "Apps + music",
        "is_active": False,
    }

    active_response = client.get("/api/recurring-rules", params={"active": "true"})
    assert active_response.status_code == 200
    assert active_response.json() == []


def test_confirm_pending_for_card_recurring_rule_creates_card_purchase(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )
    _create_recurring_rule(
        client,
        {
            "id": "rule-streaming",
            "name": "Streaming",
            "amount": 30_00,
            "due_day": 9,
            "card_id": "card-1",
            "payment_method": "CARD",
            "category_id": "streaming",
            "description": "Monthly streaming",
        },
    )

    confirm_response = client.post("/api/pendings/rule-streaming:2026-03/confirm")
    assert confirm_response.status_code == 201
    assert confirm_response.json() == {
        "pending_id": "rule-streaming:2026-03",
        "rule_id": "rule-streaming",
        "month": "2026-03",
        "name": "Streaming",
        "amount": 30_00,
        "due_date": "2026-03-09",
        "account_id": None,
        "card_id": "card-1",
        "payment_method": "CARD",
        "category_id": "streaming",
        "description": "Monthly streaming",
        "status": "confirmed",
        "transaction_id": "rule-streaming:2026-03:purchase",
    }

    card_purchases_response = client.get("/api/card-purchases", params={"card": "card-1"})
    assert card_purchases_response.status_code == 200
    assert card_purchases_response.json() == [
        {
            "purchase_id": "rule-streaming:2026-03:purchase",
            "purchase_date": "2026-03-09T00:00:00Z",
            "amount": 30_00,
            "category_id": "streaming",
            "card_id": "card-1",
            "description": "Monthly streaming",
            "installments_count": 1,
            "invoice_id": "card-1:2026-03",
            "reference_month": "2026-03",
            "closing_date": "2026-03-10",
            "due_date": "2026-03-20",
        }
    ]

    dashboard_response = client.get("/api/dashboard", params={"month": "2026-03"})
    assert dashboard_response.status_code == 200
    assert dashboard_response.json()["total_expense"] == 30_00
    assert dashboard_response.json()["fixed_expenses_total"] == 30_00
    assert dashboard_response.json()["installment_total"] == 0
    assert dashboard_response.json()["monthly_fixed_expenses"] == [
        {
            "pending_id": "rule-streaming:2026-03",
            "rule_id": "rule-streaming",
            "title": "Streaming",
            "category_id": "streaming",
            "amount": 30_00,
            "due_date": "2026-03-09",
            "status": "confirmed",
            "account_id": None,
            "card_id": "card-1",
            "payment_method": "CARD",
            "transaction_id": "rule-streaming:2026-03:purchase",
        }
    ]


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


def test_dev_reset_endpoint_clears_accounts_transfers_and_card_purchases(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_account(client, "acc-2", "Savings", "savings", 50_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )
    _create_card_purchase(
        client,
        {
            "id": "purchase-1",
            "purchase_date": "2026-03-10T12:00:00Z",
            "amount": 40_00,
            "installments_count": 1,
            "category_id": "food",
            "card_id": "card-1",
            "description": "Almoco",
        },
    )
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
    transfer_response = client.post(
        "/api/transfers",
        json={
            "id": "trf-1",
            "occurred_at": "2026-03-02T12:02:00Z",
            "from_account_id": "acc-1",
            "to_account_id": "acc-2",
            "amount": 25_00,
            "description": "Transferencia teste",
        },
    )

    assert transfer_response.status_code == 201

    reset_response = client.post("/api/dev/reset")

    assert reset_response.status_code == 200
    assert reset_response.json() == {"status": "ok", "message": "Application data reset."}

    accounts_response = client.get("/api/accounts")
    cards_response = client.get("/api/cards")
    invoices_response = client.get("/api/invoices")
    transactions_response = client.get("/api/transactions")
    dashboard_response = client.get("/api/dashboard", params={"month": "2026-03"})

    assert accounts_response.status_code == 200
    assert accounts_response.json() == []
    assert cards_response.status_code == 200
    assert cards_response.json() == []
    assert invoices_response.status_code == 200
    assert invoices_response.json() == []

    assert transactions_response.status_code == 200
    assert transactions_response.json() == []

    assert dashboard_response.status_code == 200
    assert dashboard_response.json() == {
        "month": "2026-03",
        "total_income": 0,
        "total_expense": 0,
        "net_flow": 0,
        "current_balance": 0,
        "fixed_expenses_total": 0,
        "installment_total": 0,
        "variable_expenses_total": 0,
        "invoices_due_total": 0,
        "free_to_spend": 0,
        "pending_reimbursements_total": 0,
        "pending_reimbursements": [],
        "monthly_commitments": [],
        "monthly_fixed_expenses": [],
        "monthly_installments": [],
        "recent_transactions": [],
        "spending_by_category": [],
        "previous_month": {
            "total_income": 0,
            "total_expense": 0,
            "net_flow": 0,
        },
        "daily_balance_series": [],
        "review_queue": [],
        "category_budgets": [],
        "budget_alerts": [],
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
        "future_installment_total": 0,
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
            "future_installment_total": 0,
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
        "future_installment_total": 0,
    }


def test_cards_endpoints_validate_cycle_days_and_optional_payment_account(tmp_path) -> None:
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

    create_without_account_response = client.post(
        "/api/cards",
        json={
            "id": "card-4",
            "name": "Cartao sem conta",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
        },
    )

    assert create_without_account_response.status_code == 201
    assert create_without_account_response.json()["payment_account_id"] == ""


def test_cards_endpoints_return_422_for_card_domain_validation_errors(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app, raise_server_exceptions=False)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)

    create_response = client.post(
        "/api/cards",
        json={
            "id": "card-1",
            "name": "   ",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )

    _create_card(
        client,
        {
            "id": "card-2",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )
    update_response = client.patch(
        "/api/cards/card-2",
        json={
            "payment_account_id": "",
        },
    )

    assert create_response.status_code == 422
    assert update_response.status_code == 200
    assert update_response.json()["payment_account_id"] == ""


def test_card_purchase_endpoint_allocates_purchases_into_prd_invoice_cycles(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )

    closing_day_response = client.post(
        "/api/card-purchases",
        json={
            "id": "purchase-1",
            "purchase_date": "2026-03-10T12:00:00Z",
            "amount": 100_00,
            "category_id": "food",
            "card_id": "card-1",
            "description": "Groceries",
        },
    )
    next_cycle_response = client.post(
        "/api/card-purchases",
        json={
            "id": "purchase-2",
            "purchase_date": "2026-03-11T12:00:00Z",
            "amount": 50_00,
            "category_id": "transport",
            "card_id": "card-1",
            "description": "Taxi",
        },
    )

    assert closing_day_response.status_code == 201
    assert closing_day_response.json() == {
        "purchase_id": "purchase-1",
        "purchase_date": "2026-03-10T12:00:00Z",
        "amount": 100_00,
        "category_id": "food",
        "card_id": "card-1",
        "description": "Groceries",
        "installments_count": 1,
        "invoice_id": "card-1:2026-03",
        "reference_month": "2026-03",
        "closing_date": "2026-03-10",
        "due_date": "2026-03-20",
    }

    assert next_cycle_response.status_code == 201
    assert next_cycle_response.json()["invoice_id"] == "card-1:2026-04"
    assert next_cycle_response.json()["reference_month"] == "2026-04"
    assert next_cycle_response.json()["closing_date"] == "2026-04-10"
    assert next_cycle_response.json()["due_date"] == "2026-04-20"


def test_card_purchase_endpoint_can_reassign_purchase_to_another_card(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_account(client, "acc-2", "Reserve", "wallet", 100_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )
    _create_card(
        client,
        {
            "id": "card-2",
            "name": "Inter",
            "limit": 150_000,
            "closing_day": 15,
            "due_day": 25,
            "payment_account_id": "acc-2",
        },
    )
    _create_card_purchase(
        client,
        {
            "id": "purchase-1",
            "purchase_date": "2026-03-11T12:00:00Z",
            "amount": 90_00,
            "category_id": "food",
            "card_id": "card-1",
            "description": "Lunch",
        },
    )

    response = client.patch(
        "/api/card-purchases/purchase-1",
        json={
            "card_id": "card-2",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "purchase_id": "purchase-1",
        "purchase_date": "2026-03-11T12:00:00Z",
        "amount": 90_00,
        "category_id": "food",
        "card_id": "card-2",
        "description": "Lunch",
        "installments_count": 1,
        "invoice_id": "card-2:2026-03",
        "reference_month": "2026-03",
        "closing_date": "2026-03-15",
        "due_date": "2026-03-25",
    }

    assert client.get("/api/invoices", params={"card": "card-1"}).json() == []
    assert client.get("/api/invoices", params={"card": "card-2"}).json() == [
        {
            "invoice_id": "card-2:2026-03",
            "card_id": "card-2",
            "reference_month": "2026-03",
            "closing_date": "2026-03-15",
            "due_date": "2026-03-25",
            "total_amount": 90_00,
            "paid_amount": 0,
            "remaining_amount": 90_00,
            "purchase_count": 1,
            "status": "open",
        }
    ]
    assert client.get("/api/card-purchases", params={"card": "card-1"}).json() == []
    assert client.get("/api/card-purchases", params={"card": "card-2"}).json() == [
        {
            "purchase_id": "purchase-1",
            "purchase_date": "2026-03-11T12:00:00Z",
            "amount": 90_00,
            "category_id": "food",
            "card_id": "card-2",
            "description": "Lunch",
            "installments_count": 1,
            "invoice_id": "card-2:2026-03",
            "reference_month": "2026-03",
            "closing_date": "2026-03-15",
            "due_date": "2026-03-25",
        }
    ]


def test_invoice_list_aggregates_card_purchases_without_zero_value_rows(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )

    assert client.get("/api/invoices", params={"card": "card-1"}).json() == []

    _create_card_purchase(
        client,
        {
            "id": "purchase-1",
            "purchase_date": "2026-03-15T12:00:00Z",
            "amount": 30_00,
            "category_id": "food",
            "card_id": "card-1",
            "description": "Lunch",
        },
    )
    _create_card_purchase(
        client,
        {
            "id": "purchase-2",
            "purchase_date": "2026-03-20T12:00:00Z",
            "amount": 20_00,
            "category_id": "food",
            "card_id": "card-1",
            "description": "Snacks",
        },
    )

    response = client.get("/api/invoices", params={"card": "card-1"})

    assert response.status_code == 200
    assert response.json() == [
        {
            "invoice_id": "card-1:2026-04",
            "card_id": "card-1",
            "reference_month": "2026-04",
            "closing_date": "2026-04-10",
            "due_date": "2026-04-20",
            "total_amount": 50_00,
            "paid_amount": 0,
            "remaining_amount": 50_00,
            "purchase_count": 2,
            "status": "open",
        }
    ]


def test_card_purchase_endpoint_supports_installments_and_monthly_budget_projection(
    tmp_path,
) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )

    create_response = client.post(
        "/api/card-purchases",
        json={
            "id": "purchase-1",
            "purchase_date": "2026-03-15T12:00:00Z",
            "amount": 100_00,
            "category_id": "electronics",
            "card_id": "card-1",
            "description": "Headphones",
            "installments_count": 3,
        },
    )

    invoices_response = client.get("/api/invoices", params={"card": "card-1"})
    dashboard_response = client.get("/api/dashboard", params={"month": "2026-05"})

    assert create_response.status_code == 201
    assert create_response.json() == {
        "purchase_id": "purchase-1",
        "purchase_date": "2026-03-15T12:00:00Z",
        "amount": 100_00,
        "category_id": "electronics",
        "card_id": "card-1",
        "description": "Headphones",
        "installments_count": 3,
        "invoice_id": "card-1:2026-04",
        "reference_month": "2026-04",
        "closing_date": "2026-04-10",
        "due_date": "2026-04-20",
    }
    assert invoices_response.status_code == 200
    assert invoices_response.json() == [
        {
            "invoice_id": "card-1:2026-06",
            "card_id": "card-1",
            "reference_month": "2026-06",
            "closing_date": "2026-06-10",
            "due_date": "2026-06-20",
            "total_amount": 33_34,
            "paid_amount": 0,
            "remaining_amount": 33_34,
            "purchase_count": 1,
            "status": "open",
        },
        {
            "invoice_id": "card-1:2026-05",
            "card_id": "card-1",
            "reference_month": "2026-05",
            "closing_date": "2026-05-10",
            "due_date": "2026-05-20",
            "total_amount": 33_33,
            "paid_amount": 0,
            "remaining_amount": 33_33,
            "purchase_count": 1,
            "status": "open",
        },
        {
            "invoice_id": "card-1:2026-04",
            "card_id": "card-1",
            "reference_month": "2026-04",
            "closing_date": "2026-04-10",
            "due_date": "2026-04-20",
            "total_amount": 33_33,
            "paid_amount": 0,
            "remaining_amount": 33_33,
            "purchase_count": 1,
            "status": "open",
        },
    ]
    assert dashboard_response.status_code == 200
    assert dashboard_response.json()["total_expense"] == 33_33
    assert dashboard_response.json()["installment_total"] == 33_33
    assert dashboard_response.json()["invoices_due_total"] == 33_33
    assert dashboard_response.json()["spending_by_category"] == [
        {
            "category_id": "electronics",
            "total": 33_33,
        }
    ]
    assert dashboard_response.json()["monthly_installments"] == [
        {
            "installment_id": "purchase-1:2",
            "purchase_id": "purchase-1",
            "title": "Headphones",
            "category_id": "electronics",
            "amount": 33_33,
            "card_id": "card-1",
            "installment_number": 2,
            "installments_count": 3,
            "due_date": "2026-05-20",
            "reference_month": "2026-05",
        }
    ]


def test_budget_endpoints_support_create_update_and_alert_states(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_account(client, "acc-2", "Reserve", "savings", 100_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )

    create_budget_response = client.post(
        "/api/budgets",
        json={
            "category_id": "food",
            "month": "2026-03",
            "limit": 100_00,
        },
    )
    _create_expense(
        client,
        {
            "id": "tx-1",
            "occurred_at": "2026-03-05T12:00:00Z",
            "amount": 45_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Groceries",
        },
    )
    _create_card_purchase(
        client,
        {
            "id": "purchase-1",
            "purchase_date": "2026-03-15T12:00:00Z",
            "amount": 60_00,
            "installments_count": 2,
            "category_id": "food",
            "card_id": "card-1",
            "description": "Market",
        },
    )
    baseline_dashboard = client.get("/api/dashboard", params={"month": "2026-03"})

    _create_expense(
        client,
        {
            "id": "tx-2",
            "occurred_at": "2026-03-07T12:00:00Z",
            "amount": 5_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Snack",
        },
    )
    warning_dashboard = client.get("/api/dashboard", params={"month": "2026-03"})

    transfer_response = client.post(
        "/api/transfers",
        json={
            "id": "trf-1",
            "occurred_at": "2026-03-08T12:00:00Z",
            "from_account_id": "acc-1",
            "to_account_id": "acc-2",
            "amount": 50_00,
            "description": "Internal move",
        },
    )
    transfer_dashboard = client.get("/api/dashboard", params={"month": "2026-03"})

    _create_expense(
        client,
        {
            "id": "tx-3",
            "occurred_at": "2026-03-09T12:00:00Z",
            "amount": 30_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Dinner",
        },
    )
    exceeded_dashboard = client.get("/api/dashboard", params={"month": "2026-03"})
    update_budget_response = client.post(
        "/api/budgets",
        json={
            "category_id": "food",
            "month": "2026-03",
            "limit": 150_00,
        },
    )
    updated_budget_response = client.get("/api/budgets", params={"month": "2026-03"})
    updated_dashboard = client.get("/api/dashboard", params={"month": "2026-03"})

    assert create_budget_response.status_code == 201
    assert create_budget_response.json() == {
        "category_id": "food",
        "month": "2026-03",
        "limit": 100_00,
        "spent": 0,
        "usage_percent": 0,
        "status": "ok",
    }
    assert baseline_dashboard.status_code == 200
    assert baseline_dashboard.json()["category_budgets"] == [
        {
            "category_id": "food",
            "month": "2026-03",
            "limit": 100_00,
            "spent": 75_00,
            "usage_percent": 75,
            "status": "ok",
        }
    ]
    assert baseline_dashboard.json()["budget_alerts"] == []

    assert warning_dashboard.status_code == 200
    assert warning_dashboard.json()["category_budgets"] == [
        {
            "category_id": "food",
            "month": "2026-03",
            "limit": 100_00,
            "spent": 80_00,
            "usage_percent": 80,
            "status": "warning",
        }
    ]
    assert warning_dashboard.json()["budget_alerts"] == [
        {
            "category_id": "food",
            "month": "2026-03",
            "limit": 100_00,
            "spent": 80_00,
            "usage_percent": 80,
            "status": "warning",
        }
    ]

    assert transfer_response.status_code == 201
    assert transfer_dashboard.status_code == 200
    assert transfer_dashboard.json()["category_budgets"] == [
        {
            "category_id": "food",
            "month": "2026-03",
            "limit": 100_00,
            "spent": 80_00,
            "usage_percent": 80,
            "status": "warning",
        }
    ]

    assert exceeded_dashboard.status_code == 200
    assert exceeded_dashboard.json()["category_budgets"] == [
        {
            "category_id": "food",
            "month": "2026-03",
            "limit": 100_00,
            "spent": 110_00,
            "usage_percent": 110,
            "status": "exceeded",
        }
    ]
    assert exceeded_dashboard.json()["budget_alerts"] == [
        {
            "category_id": "food",
            "month": "2026-03",
            "limit": 100_00,
            "spent": 110_00,
            "usage_percent": 110,
            "status": "exceeded",
        }
    ]

    assert update_budget_response.status_code == 200
    assert update_budget_response.json() == {
        "category_id": "food",
        "month": "2026-03",
        "limit": 150_00,
        "spent": 110_00,
        "usage_percent": 73,
        "status": "ok",
    }
    assert updated_budget_response.status_code == 200
    assert updated_budget_response.json() == [
        {
            "category_id": "food",
            "month": "2026-03",
            "limit": 150_00,
            "spent": 110_00,
            "usage_percent": 73,
            "status": "ok",
        }
    ]
    assert updated_dashboard.status_code == 200
    assert updated_dashboard.json()["budget_alerts"] == []


def test_reports_endpoint_supports_period_category_weekly_and_future_commitments(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)

    _create_account(client, "acc-1", "Main Wallet", "wallet", 500_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Nubank",
            "limit": 200_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )

    income_response = client.post(
        "/api/incomes",
        json={
            "id": "inc-1",
            "occurred_at": "2026-04-01T09:00:00Z",
            "amount": 100_00,
            "account_id": "acc-1",
            "payment_method": "PIX",
            "category_id": "salary",
            "description": "Freelance",
        },
    )
    food_response = client.post(
        "/api/expenses",
        json={
            "id": "exp-1",
            "occurred_at": "2026-04-02T10:00:00Z",
            "amount": 25_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Dinner with Alice",
            "person_id": "alice",
        },
    )
    transport_response = client.post(
        "/api/expenses",
        json={
            "id": "exp-2",
            "occurred_at": "2026-04-10T10:00:00Z",
            "amount": 15_00,
            "account_id": "acc-1",
            "payment_method": "PIX",
            "category_id": "transport",
            "description": "Uber airport",
            "person_id": "driver",
        },
    )
    card_purchase_response = client.post(
        "/api/card-purchases",
        json={
            "id": "purchase-1",
            "purchase_date": "2026-03-15T12:00:00Z",
            "amount": 120_00,
            "installments_count": 3,
            "category_id": "electronics",
            "card_id": "card-1",
            "description": "Headphones",
            "person_id": "alice",
        },
    )
    report_response = client.get(
        "/api/reports/summary",
        params={
            "period": "month",
            "reference": "2026-04-15",
        },
    )

    assert income_response.status_code == 201
    assert food_response.status_code == 201
    assert transport_response.status_code == 201
    assert card_purchase_response.status_code == 201
    assert report_response.status_code == 200

    payload = report_response.json()
    assert payload["period"] == {
        "type": "month",
        "from": "2026-04-01T00:00:00Z",
        "to": "2026-04-30T23:59:59Z",
    }
    assert payload["totals"] == {
        "income_total": 100_00,
        "expense_total": 80_00,
        "net_total": 20_00,
    }
    assert payload["category_breakdown"] == [
        {"category_id": "electronics", "total": 40_00},
        {"category_id": "food", "total": 25_00},
        {"category_id": "transport", "total": 15_00},
    ]
    assert sum(point["income_total"] for point in payload["weekly_trend"]) == 100_00
    assert sum(point["expense_total"] for point in payload["weekly_trend"]) == 80_00
    assert payload["future_commitments"] == {
        "period_installment_impact_total": 40_00,
        "future_installment_total": 80_00,
        "future_installment_months": [
            {"month": "2026-05", "total": 40_00},
            {"month": "2026-06", "total": 40_00},
        ],
    }


def test_reports_endpoint_applies_same_filter_dimensions_as_transactions(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)

    _create_account(client, "acc-1", "Main Wallet", "wallet", 200_00)
    _create_account(client, "acc-2", "Savings", "savings", 100_00)
    _create_expense(
        client,
        {
            "id": "tx-1",
            "occurred_at": "2026-04-03T10:00:00Z",
            "amount": 20_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Dinner with Alice",
            "person_id": "alice",
        },
    )
    _create_expense(
        client,
        {
            "id": "tx-2",
            "occurred_at": "2026-04-03T11:00:00Z",
            "amount": 50_00,
            "account_id": "acc-2",
            "payment_method": "PIX",
            "category_id": "food",
            "description": "Dinner with Bob",
            "person_id": "bob",
        },
    )

    response = client.get(
        "/api/reports/summary",
        params={
            "period": "custom",
            "from": "2026-04-01T00:00:00Z",
            "to": "2026-04-30T23:59:59Z",
            "category": "food",
            "account": "acc-1",
            "method": "CASH",
            "person": "alice",
            "text": "Dinner",
        },
    )

    assert response.status_code == 200
    assert response.json()["totals"] == {
        "income_total": 0,
        "expense_total": 20_00,
        "net_total": -20_00,
    }
    assert response.json()["category_breakdown"] == [{"category_id": "food", "total": 20_00}]


def test_reports_endpoint_rejects_custom_period_without_range(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)

    response = client.get(
        "/api/reports/summary",
        params={
            "period": "custom",
            "reference": "2026-04-15",
        },
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "custom period requires from and to in UTC ISO 8601 format.",
    }


def test_reports_endpoint_accepts_custom_range_with_millisecond_precision(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)

    response = client.get(
        "/api/reports/summary",
        params={
            "period": "custom",
            "from": "2026-04-01T00:00:00Z",
            "to": "2026-04-01T00:00:00.500Z",
        },
    )

    assert response.status_code == 200
    assert response.json()["period"] == {
        "type": "custom",
        "from": "2026-04-01T00:00:00Z",
        "to": "2026-04-01T00:00:00.500Z",
    }


def test_reports_endpoint_respects_custom_subday_range_for_installments(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)

    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )
    _create_card_purchase(
        client,
        {
            "id": "purchase-1",
            "purchase_date": "2026-03-15T12:00:00Z",
            "amount": 90_00,
            "installments_count": 1,
            "category_id": "electronics",
            "card_id": "card-1",
            "description": "Headphones",
        },
    )

    response = client.get(
        "/api/reports/summary",
        params={
            "period": "custom",
            "from": "2026-04-20T00:00:00Z",
            "to": "2026-04-20T00:00:00.500Z",
        },
    )

    assert response.status_code == 200
    assert response.json()["future_commitments"] == {
        "period_installment_impact_total": 0,
        "future_installment_total": 90_00,
        "future_installment_months": [{"month": "2026-04", "total": 90_00}],
    }


def test_backup_export_endpoint_returns_full_unfiltered_snapshot(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)

    _create_account(client, "acc-1", "Main Wallet", "wallet", 500_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )
    _create_expense(
        client,
        {
            "id": "tx-1",
            "occurred_at": "2026-02-03T10:00:00Z",
            "amount": 20_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Lunch",
        },
    )
    _create_card_purchase(
        client,
        {
            "id": "purchase-1",
            "purchase_date": "2026-03-15T12:00:00Z",
            "amount": 120_00,
            "installments_count": 3,
            "category_id": "electronics",
            "card_id": "card-1",
            "description": "Headphones",
        },
    )
    movement_response = client.post(
        "/api/investments/movements",
        json={
            "id": "inv-1",
            "occurred_at": "2026-01-15T12:00:00Z",
            "type": "contribution",
            "account_id": "acc-1",
            "description": "Brokerage transfer",
            "contribution_amount": 50_00,
            "dividend_amount": 0,
            "cash_amount": 50_00,
            "invested_amount": 50_00,
        },
    )

    assert movement_response.status_code == 201

    response = client.get("/api/backups/export")

    assert response.status_code == 200
    payload = response.json()
    assert payload["accounts"] == client.get("/api/accounts").json()
    assert payload["cards"] == client.get("/api/cards").json()
    assert payload["invoices"] == client.get("/api/invoices").json()
    assert payload["investment_movements"] == client.get("/api/investments/movements").json()
    assert payload["transactions"] == client.get("/api/transactions").json()
    assert all("ledger_event_type" not in row for row in payload["transactions"])
    assert payload["report_summary"] is not None
    assert payload["report_summary"]["period"] == {
        "type": "custom",
        "from": "2026-02-03T10:00:00Z",
        "to": "2026-03-15T12:00:00Z",
    }


def test_investment_endpoints_record_movements_and_preserve_budget_semantics(
    tmp_path,
) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_budget(
        client,
        {
            "category_id": "food",
            "month": "2026-03",
            "limit": 100_00,
        },
    )
    _create_expense(
        client,
        {
            "id": "tx-1",
            "occurred_at": "2026-03-05T12:00:00Z",
            "amount": 20_00,
            "account_id": "acc-1",
            "payment_method": "CASH",
            "category_id": "food",
            "description": "Groceries",
        },
    )

    contribution_response = client.post(
        "/api/investments/movements",
        json={
            "id": "inv-1",
            "occurred_at": "2026-03-10T12:00:00Z",
            "type": "contribution",
            "account_id": "acc-1",
            "description": "Aporte mensal",
            "contribution_amount": 30_00,
            "dividend_amount": 5_00,
        },
    )
    withdrawal_response = client.post(
        "/api/investments/movements",
        json={
            "id": "inv-2",
            "occurred_at": "2026-03-20T12:00:00Z",
            "type": "withdrawal",
            "account_id": "acc-1",
            "description": "Resgate parcial",
            "cash_amount": 18_00,
            "invested_amount": 20_00,
        },
    )
    movements_response = client.get("/api/investments/movements")
    overview_response = client.get(
        "/api/investments/overview",
        params={
            "view": "monthly",
            "from": "2026-03-01T00:00:00Z",
            "to": "2026-03-31T23:59:59Z",
        },
    )
    dashboard_response = client.get("/api/dashboard", params={"month": "2026-03"})
    accounts_response = client.get("/api/accounts")

    assert contribution_response.status_code == 201
    assert contribution_response.json() == {
        "movement_id": "inv-1",
        "occurred_at": "2026-03-10T12:00:00Z",
        "type": "contribution",
        "account_id": "acc-1",
        "description": "Aporte mensal",
        "contribution_amount": 30_00,
        "dividend_amount": 5_00,
        "cash_amount": 30_00,
        "invested_amount": 35_00,
        "cash_delta": -30_00,
        "invested_delta": 35_00,
    }
    assert withdrawal_response.status_code == 201
    assert withdrawal_response.json() == {
        "movement_id": "inv-2",
        "occurred_at": "2026-03-20T12:00:00Z",
        "type": "withdrawal",
        "account_id": "acc-1",
        "description": "Resgate parcial",
        "contribution_amount": 0,
        "dividend_amount": 0,
        "cash_amount": 18_00,
        "invested_amount": 20_00,
        "cash_delta": 18_00,
        "invested_delta": -20_00,
    }
    assert movements_response.status_code == 200
    assert movements_response.json() == [
        {
            "movement_id": "inv-2",
            "occurred_at": "2026-03-20T12:00:00Z",
            "type": "withdrawal",
            "account_id": "acc-1",
            "description": "Resgate parcial",
            "contribution_amount": 0,
            "dividend_amount": 0,
            "cash_amount": 18_00,
            "invested_amount": 20_00,
            "cash_delta": 18_00,
            "invested_delta": -20_00,
        },
        {
            "movement_id": "inv-1",
            "occurred_at": "2026-03-10T12:00:00Z",
            "type": "contribution",
            "account_id": "acc-1",
            "description": "Aporte mensal",
            "contribution_amount": 30_00,
            "dividend_amount": 5_00,
            "cash_amount": 30_00,
            "invested_amount": 35_00,
            "cash_delta": -30_00,
            "invested_delta": 35_00,
        },
    ]
    assert overview_response.status_code == 200
    assert overview_response.json() == {
        "view": "monthly",
        "from": "2026-03-01T00:00:00Z",
        "to": "2026-03-31T23:59:59Z",
        "totals": {
            "contribution_total": 30_00,
            "dividend_total": 5_00,
            "withdrawal_total": 18_00,
            "invested_balance": 15_00,
            "cash_balance": 68_00,
            "wealth": 83_00,
            "dividends_accumulated": 5_00,
        },
        "goal": {
            "target": 0,
            "realized": 35_00,
            "remaining": 0,
            "progress_percent": 100,
        },
        "series": {
            "wealth_evolution": [
                {
                    "bucket": "2026-03",
                    "cash_balance": 68_00,
                    "invested_balance": 15_00,
                    "wealth": 83_00,
                }
            ],
            "contribution_dividend_trend": [
                {
                    "bucket": "2026-03",
                    "contribution_total": 30_00,
                    "dividend_total": 5_00,
                    "withdrawal_total": 18_00,
                }
            ],
        },
    }
    assert dashboard_response.status_code == 200
    assert dashboard_response.json()["category_budgets"] == [
        {
            "category_id": "food",
            "month": "2026-03",
            "limit": 100_00,
            "spent": 20_00,
            "usage_percent": 20,
            "status": "ok",
        }
    ]
    assert dashboard_response.json()["budget_alerts"] == []
    assert accounts_response.status_code == 200
    assert accounts_response.json()[0]["current_balance"] == 68_00


def test_investment_endpoints_reject_contribution_from_investment_account(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Broker", "investment", 100_00)

    response = client.post(
        "/api/investments/movements",
        json={
            "id": "inv-1",
            "occurred_at": "2026-03-10T12:00:00Z",
            "type": "contribution",
            "account_id": "acc-1",
            "contribution_amount": 30_00,
        },
    )

    assert response.status_code == 422


def test_invoice_payment_endpoint_supports_partial_and_full_payments(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_account(client, "acc-2", "Savings", "savings", 300_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )
    _create_card_purchase(
        client,
        {
            "id": "purchase-1",
            "purchase_date": "2026-03-15T12:00:00Z",
            "amount": 90_00,
            "category_id": "electronics",
            "card_id": "card-1",
            "description": "Headphones",
        },
    )

    partial_response = client.post(
        "/api/invoices/card-1:2026-04/payments",
        json={
            "id": "payment-1",
            "amount": 30_00,
            "account_id": "acc-2",
            "paid_at": "2026-03-20T12:00:00Z",
        },
    )
    final_response = client.post(
        "/api/invoices/card-1:2026-04/payments",
        json={
            "id": "payment-2",
            "amount": 60_00,
            "account_id": "acc-2",
            "paid_at": "2026-03-20T12:05:00Z",
        },
    )
    invoices_response = client.get("/api/invoices", params={"card": "card-1"})
    accounts_response = client.get("/api/accounts")
    transactions_response = client.get("/api/transactions", params={"account": "acc-2"})

    assert partial_response.status_code == 201
    assert partial_response.json() == {
        "invoice_id": "card-1:2026-04",
        "card_id": "card-1",
        "reference_month": "2026-04",
        "closing_date": "2026-04-10",
        "due_date": "2026-04-20",
        "total_amount": 90_00,
        "paid_amount": 30_00,
        "remaining_amount": 60_00,
        "purchase_count": 1,
        "status": "partial",
    }
    assert final_response.status_code == 201
    assert final_response.json()["status"] == "paid"
    assert final_response.json()["paid_amount"] == 90_00
    assert final_response.json()["remaining_amount"] == 0
    assert invoices_response.status_code == 200
    assert invoices_response.json() == [
        {
            "invoice_id": "card-1:2026-04",
            "card_id": "card-1",
            "reference_month": "2026-04",
            "closing_date": "2026-04-10",
            "due_date": "2026-04-20",
            "total_amount": 90_00,
            "paid_amount": 90_00,
            "remaining_amount": 0,
            "purchase_count": 1,
            "status": "paid",
        }
    ]
    assert accounts_response.status_code == 200
    assert next(
        account for account in accounts_response.json() if account["account_id"] == "acc-2"
    )["current_balance"] == 210_00
    assert transactions_response.status_code == 200
    assert transactions_response.json() == [
        {
            "transaction_id": "payment-2:invoice-payment",
            "occurred_at": "2026-03-20T12:05:00Z",
            "type": "expense",
            "amount": 60_00,
            "account_id": "acc-2",
            "payment_method": "OTHER",
            "category_id": "invoice_payment",
            "description": "Pagamento de fatura card-1:2026-04",
            "person_id": None,
            "status": "active",
        },
        {
            "transaction_id": "payment-1:invoice-payment",
            "occurred_at": "2026-03-20T12:00:00Z",
            "type": "expense",
            "amount": 30_00,
            "account_id": "acc-2",
            "payment_method": "OTHER",
            "category_id": "invoice_payment",
            "description": "Pagamento de fatura card-1:2026-04",
            "person_id": None,
            "status": "active",
        },
    ]


def test_invoice_items_endpoint_lists_only_requested_invoice_rows(tmp_path) -> None:
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    _create_account(client, "acc-1", "Main Wallet", "wallet", 100_00)
    _create_card(
        client,
        {
            "id": "card-1",
            "name": "Nubank",
            "limit": 150_000,
            "closing_day": 10,
            "due_day": 20,
            "payment_account_id": "acc-1",
        },
    )
    _create_card_purchase(
        client,
        {
            "id": "purchase-1",
            "purchase_date": "2026-03-15T12:00:00Z",
            "amount": 90_00,
            "category_id": "electronics",
            "card_id": "card-1",
            "description": "Headphones",
            "installments_count": 3,
        },
    )
    _create_card_purchase(
        client,
        {
            "id": "purchase-2",
            "purchase_date": "2026-03-10T12:00:00Z",
            "amount": 20_00,
            "category_id": "food",
            "card_id": "card-1",
            "description": "Lunch",
        },
    )

    response = client.get("/api/invoices/card-1:2026-04/items")
    missing_response = client.get("/api/invoices/card-1:2099-01/items")

    assert response.status_code == 200
    assert response.json() == [
        {
            "invoice_item_id": "purchase-1:1",
            "invoice_id": "card-1:2026-04",
            "purchase_id": "purchase-1",
            "card_id": "card-1",
            "purchase_date": "2026-03-15T12:00:00Z",
            "category_id": "electronics",
            "description": "Headphones",
            "installment_number": 1,
            "installments_count": 3,
            "amount": 30_00,
        }
    ]
    assert missing_response.status_code == 404


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


def _create_card(client: TestClient, payload: dict[str, str | int]) -> None:
    response = client.post("/api/cards", json=payload)

    assert response.status_code == 201


def _create_card_purchase(client: TestClient, payload: dict[str, str | int]) -> None:
    response = client.post("/api/card-purchases", json=payload)

    assert response.status_code == 201


def _create_expense(client: TestClient, payload: dict[str, str | int]) -> None:
    response = client.post("/api/expenses", json=payload)

    assert response.status_code == 201


def _create_recurring_rule(client: TestClient, payload: dict[str, str | int]) -> None:
    response = client.post("/api/recurring-rules", json=payload)

    assert response.status_code == 201


def _create_budget(client: TestClient, payload: dict[str, str | int]) -> None:
    response = client.post("/api/budgets", json=payload)

    assert response.status_code in (200, 201)
