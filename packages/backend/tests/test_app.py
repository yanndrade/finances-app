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
