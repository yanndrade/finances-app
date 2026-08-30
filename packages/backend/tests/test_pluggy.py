from __future__ import annotations

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from finance_app.application.pluggy import (
    PluggyAuthenticationError,
    PluggyItemListUnavailableError,
    PluggyNotConfiguredError,
    PluggyService,
    PluggyUnavailableError,
)
from finance_app.domain.security import LanNetworkInfo
from finance_app.infrastructure.pluggy import PluggyHttpGateway, get_connector_ids
from finance_app.infrastructure.pluggy_store import PluggyStore
from finance_app.interfaces.http.app import create_app
from finance_app.interfaces.http.bootstrap import build_services
from finance_app.application.pluggy_inbox import PluggyInboxService
from finance_app.interfaces.http.routes.pluggy import build_pluggy_router


def test_http_gateway_authenticates_and_creates_connect_token() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/auth":
            return httpx.Response(200, json={"apiKey": "api-key"})
        return httpx.Response(200, json={"accessToken": "connect-token"})

    gateway = PluggyHttpGateway(
        client_id="client-id",
        client_secret="client-secret",
        transport=httpx.MockTransport(handler),
    )

    token = gateway.create_connect_token(client_user_id="meucofri-owner")

    assert token == "connect-token"
    assert len(requests) == 2
    assert requests[0].url.path == "/auth"
    assert requests[0].content == (
        b'{"clientId":"client-id","clientSecret":"client-secret"}'
    )
    assert requests[1].url.path == "/connect_token"
    assert requests[1].headers["X-API-KEY"] == "api-key"
    assert requests[1].content == (
        b'{"options":{"avoidDuplicates":true,"clientUserId":"meucofri-owner"}}'
    )


def test_http_gateway_creates_connect_token_in_update_mode_for_existing_item() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/auth":
            return httpx.Response(200, json={"apiKey": "api-key"})
        return httpx.Response(200, json={"accessToken": "connect-token"})

    gateway = PluggyHttpGateway(
        client_id="client-id",
        client_secret="client-secret",
        transport=httpx.MockTransport(handler),
    )

    token = gateway.create_connect_token(
        client_user_id="meucofri-owner",
        item_id="item-123",
    )

    assert token == "connect-token"
    assert requests[1].content == (
        b'{"options":{"avoidDuplicates":true,"clientUserId":"meucofri-owner"},'
        b'"itemId":"item-123"}'
    )


def test_recover_items_adopts_connections_created_outside_this_install(
    tmp_path,
) -> None:
    class ListGateway:
        def create_connect_token(
            self,
            *,
            client_user_id: str | None,
            item_id: str | None = None,
        ) -> str:
            return "token"

        def fetch_item(self, *, item_id: str):  # pragma: no cover - unused
            raise AssertionError("recover_items should not fetch a single item")

        def list_items(self):
            return [
                {
                    "id": "item-123",
                    "status": "UPDATED",
                    "executionStatus": "SUCCESS",
                    "connector": {"name": "Meu Pluggy"},
                }
            ]

        def fetch_snapshot(self, *, item_id: str):  # pragma: no cover - unused
            raise AssertionError("recover_items should not fetch a full snapshot")

    database_url = f"sqlite:///{(tmp_path / 'app.db').as_posix()}"
    pluggy = PluggyService(ListGateway(), store=PluggyStore(database_url))

    recovery = pluggy.recover_items(client_user_id="meucofri-owner")

    assert recovery["available"] is True
    assert [item["item_id"] for item in recovery["items"]] == ["item-123"]
    assert pluggy.get_status()["connected"] is True


def test_recover_items_degrades_when_pluggy_does_not_allow_listing(tmp_path) -> None:
    class DisabledListGateway:
        def create_connect_token(
            self,
            *,
            client_user_id: str | None,
            item_id: str | None = None,
        ) -> str:
            return "token"

        def fetch_item(self, *, item_id: str):  # pragma: no cover - unused
            raise AssertionError("recover_items should not fetch a single item")

        def list_items(self):
            raise PluggyItemListUnavailableError("listing disabled")

        def fetch_snapshot(self, *, item_id: str):  # pragma: no cover - unused
            raise AssertionError("recover_items should not fetch a full snapshot")

    database_url = f"sqlite:///{(tmp_path / 'app.db').as_posix()}"
    pluggy = PluggyService(DisabledListGateway(), store=PluggyStore(database_url))

    recovery = pluggy.recover_items(client_user_id="meucofri-owner")

    assert recovery == {
        "available": False,
        "items": [],
        "reason": "listing disabled",
    }
    assert pluggy.get_status()["connected"] is False


def test_connector_ids_default_to_the_meu_pluggy_proxy_and_follow_the_env(
    monkeypatch,
) -> None:
    monkeypatch.delenv("PLUGGY_CONNECTOR_IDS", raising=False)
    assert get_connector_ids() == [200]

    monkeypatch.setenv("PLUGGY_CONNECTOR_IDS", "201, 202")
    assert get_connector_ids() == [201, 202]

    monkeypatch.setenv("PLUGGY_CONNECTOR_IDS", "")
    assert get_connector_ids() == []


def test_http_gateway_reports_listing_as_unavailable_when_feature_is_off() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/auth":
            return httpx.Response(200, json={"apiKey": "api-key"})
        return httpx.Response(
            403,
            json={"codeDescription": "LIST_ITEMS_FEATURE_NOT_ENABLED"},
        )

    gateway = PluggyHttpGateway(
        client_id="client-id",
        client_secret="client-secret",
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(PluggyItemListUnavailableError):
        gateway.list_items()


def test_link_item_registers_a_connection_that_already_exists_at_pluggy(
    tmp_path,
) -> None:
    class LinkGateway:
        def create_connect_token(
            self,
            *,
            client_user_id: str | None,
            item_id: str | None = None,
        ) -> str:
            return "token"

        def fetch_item(self, *, item_id: str):
            assert item_id == "item-123"
            return {
                "id": "item-123",
                "status": "UPDATED",
                "executionStatus": "SUCCESS",
                "connector": {"name": "Meu Pluggy"},
            }

        def fetch_snapshot(self, *, item_id: str):  # pragma: no cover - unused
            raise AssertionError("link_item should not fetch a full snapshot")

    database_url = f"sqlite:///{(tmp_path / 'app.db').as_posix()}"
    pluggy = PluggyService(LinkGateway(), store=PluggyStore(database_url))

    state = pluggy.link_item(item_id="item-123", client_user_id="meucofri-owner")

    assert state["item_id"] == "item-123"
    assert state["connector_name"] == "Meu Pluggy"
    assert pluggy.get_status()["connected"] is True


def test_http_gateway_rejects_missing_configuration_without_requesting_pluggy() -> None:
    gateway = PluggyHttpGateway(
        transport=httpx.MockTransport(
            lambda _request: pytest.fail("Pluggy should not be called")
        )
    )

    with pytest.raises(PluggyNotConfiguredError):
        gateway.create_connect_token(client_user_id=None)


def test_http_gateway_translates_invalid_credentials() -> None:
    gateway = PluggyHttpGateway(
        client_id="invalid-client",
        client_secret="invalid-secret",
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(401, json={"message": "invalid"})
        ),
    )

    with pytest.raises(PluggyAuthenticationError):
        gateway.create_connect_token(client_user_id=None)


def test_http_gateway_rejects_invalid_pluggy_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/auth":
            return httpx.Response(200, json={"apiKey": "api-key"})
        return httpx.Response(200, json={})

    gateway = PluggyHttpGateway(
        client_id="client-id",
        client_secret="client-secret",
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(PluggyUnavailableError):
        gateway.create_connect_token(client_user_id=None)


def test_connect_token_endpoint_returns_client_safe_token_without_caching() -> None:
    class FakeGateway:
        def create_connect_token(
            self,
            *,
            client_user_id: str | None,
            item_id: str | None = None,
        ) -> str:
            assert client_user_id == "meucofri-owner"
            assert item_id is None
            return "connect-token"

    app = FastAPI()
    # The inbox is not exercised here; it only has to exist for the routes to
    # be registered.
    inbox = PluggyInboxService(
        store=None,
        account_service=None,
        card_service=None,
        card_purchase_service=None,
        transaction_service=None,
    )
    app.include_router(build_pluggy_router(PluggyService(FakeGateway()), inbox))
    client = TestClient(app)

    response = client.post(
        "/api/pluggy/connect-token",
        json={"clientUserId": "meucofri-owner"},
    )

    assert response.status_code == 200
    assert response.json() == {"accessToken": "connect-token"}
    assert response.headers["Cache-Control"] == "no-store"


def test_connect_token_endpoint_reports_missing_server_configuration(
    tmp_path,
    monkeypatch,
) -> None:
    monkeypatch.delenv("PLUGGY_CLIENT_ID", raising=False)
    monkeypatch.delenv("PLUGGY_CLIENT_SECRET", raising=False)
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)

    response = client.post("/api/pluggy/connect-token", json={})

    assert response.status_code == 503
    assert response.json() == {"detail": "Pluggy integration is not configured."}


def test_connect_token_endpoint_is_desktop_only(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "finance_app.infrastructure.security._resolve_lan_network",
        lambda: LanNetworkInfo(
            local_ip="192.168.50.2",
            subnet_cidr="192.168.50.0/24",
        ),
    )
    app = create_app(
        database_url=f"sqlite:///{(tmp_path / 'app.db').as_posix()}",
        event_database_url=f"sqlite:///{(tmp_path / 'events.db').as_posix()}",
    )
    client = TestClient(app)
    client.post("/api/security/lan", json={"enabled": True})

    response = client.post(
        "/api/pluggy/connect-token",
        json={},
        headers={
            "X-Finance-Client-IP": "192.168.50.20",
            "Host": "192.168.50.2:27654",
        },
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "This endpoint is desktop-only."}
