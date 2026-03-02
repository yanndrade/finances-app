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
