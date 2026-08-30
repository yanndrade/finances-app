from __future__ import annotations

import os
from typing import Any

import httpx

from finance_app.application.pluggy import (
    PluggyAuthenticationError,
    PluggyItemListUnavailableError,
    PluggyItemNotFoundError,
    PluggyNotConfiguredError,
    PluggyUnavailableError,
)

PLUGGY_API_URL = "https://api.pluggy.ai"
PLUGGY_CLIENT_ID_ENV = "PLUGGY_CLIENT_ID"
PLUGGY_CLIENT_SECRET_ENV = "PLUGGY_CLIENT_SECRET"
PLUGGY_CONNECTOR_IDS_ENV = "PLUGGY_CONNECTOR_IDS"
# 200 is the Meu Pluggy proxy connector, the only one a free/development
# application can reach. Production access widens this through the env var.
DEFAULT_PLUGGY_CONNECTOR_IDS = (200,)


def get_connector_ids() -> list[int]:
    raw = os.getenv(PLUGGY_CONNECTOR_IDS_ENV)
    if raw is None:
        return list(DEFAULT_PLUGGY_CONNECTOR_IDS)
    if not raw.strip():
        return []
    ids: list[int] = []
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            ids.append(int(chunk))
        except ValueError:
            continue
    return ids


class PluggyHttpGateway:
    def __init__(
        self,
        *,
        client_id: str | None = None,
        client_secret: str | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._transport = transport

    @classmethod
    def from_environment(cls) -> PluggyHttpGateway:
        return cls(
            client_id=os.getenv(PLUGGY_CLIENT_ID_ENV),
            client_secret=os.getenv(PLUGGY_CLIENT_SECRET_ENV),
        )

    def create_connect_token(
        self,
        *,
        client_user_id: str | None,
        item_id: str | None = None,
    ) -> str:
        if not self._client_id or not self._client_secret:
            raise PluggyNotConfiguredError("Pluggy integration is not configured.")

        try:
            with httpx.Client(
                base_url=PLUGGY_API_URL,
                timeout=10.0,
                transport=self._transport,
            ) as client:
                api_key = self._authenticate(client)
                options: dict[str, str | bool] = {"avoidDuplicates": True}
                if client_user_id is not None:
                    options["clientUserId"] = client_user_id
                payload: dict[str, Any] = {"options": options}
                if item_id is not None:
                    # Update mode: Pluggy refuses to create a second item for the
                    # same credentials (ITEM_USER_ALREADY_EXISTS), so an existing
                    # connection must be refreshed instead of recreated.
                    payload["itemId"] = item_id
                response = client.post(
                    "/connect_token",
                    headers={"X-API-KEY": api_key},
                    json=payload,
                )
        except httpx.HTTPError as exc:
            raise PluggyUnavailableError("Pluggy is currently unavailable.") from exc

        if response.status_code == 403:
            raise PluggyAuthenticationError("Pluggy authentication failed.")
        if not response.is_success:
            raise PluggyUnavailableError("Pluggy is currently unavailable.")
        return _read_required_string(response, "accessToken")

    def fetch_item(self, *, item_id: str) -> dict[str, Any]:
        self._require_configuration()
        try:
            with httpx.Client(
                base_url=PLUGGY_API_URL,
                timeout=10.0,
                transport=self._transport,
            ) as client:
                api_key = self._authenticate(client)
                response = client.get(
                    f"/items/{item_id}",
                    headers={"X-API-KEY": api_key},
                )
        except httpx.HTTPError as exc:
            raise PluggyUnavailableError("Pluggy is currently unavailable.") from exc

        if response.status_code == 404:
            raise PluggyItemNotFoundError("A conexão da Pluggy não foi encontrada.")
        if response.status_code in {401, 403}:
            raise PluggyAuthenticationError("Pluggy authentication failed.")
        if not response.is_success:
            raise PluggyUnavailableError("Pluggy is currently unavailable.")
        try:
            payload = response.json()
        except ValueError as exc:
            raise PluggyUnavailableError("Pluggy returned an invalid response.") from exc
        if not isinstance(payload, dict):
            raise PluggyUnavailableError("Pluggy returned an invalid response.")
        return payload

    def list_items(self) -> list[dict[str, Any]]:
        """List every item of the application, newest first.

        Pluggy keeps this endpoint opt-in per team, so a 403 means the feature
        is off rather than a credential problem.
        """
        self._require_configuration()
        try:
            with httpx.Client(
                base_url=PLUGGY_API_URL,
                timeout=15.0,
                transport=self._transport,
            ) as client:
                api_key = self._authenticate(client)
                headers = {"X-API-KEY": api_key}
                response = client.get("/v2/items", headers=headers)
                if response.status_code == 403:
                    raise PluggyItemListUnavailableError(_read_error_detail(response))
                if response.status_code == 401:
                    raise PluggyAuthenticationError("Pluggy authentication failed.")
                if not response.is_success:
                    raise PluggyUnavailableError("Pluggy is currently unavailable.")
                return self._read_cursor_page(client, response, headers=headers)
        except httpx.HTTPError as exc:
            raise PluggyUnavailableError("Pluggy is currently unavailable.") from exc

    def _read_cursor_page(
        self,
        client: httpx.Client,
        response: httpx.Response,
        *,
        headers: dict[str, str],
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for _ in range(100):
            try:
                payload = response.json()
            except ValueError as exc:
                raise PluggyUnavailableError(
                    "Pluggy returned an invalid response."
                ) from exc
            page_results = payload.get("results") if isinstance(payload, dict) else None
            if not isinstance(page_results, list):
                raise PluggyUnavailableError("Pluggy returned an invalid response.")
            results.extend(item for item in page_results if isinstance(item, dict))
            next_query = payload.get("next")
            if not isinstance(next_query, str) or not next_query.startswith("?"):
                return results
            response = client.get(f"/v2/items{next_query}", headers=headers)
            if not response.is_success:
                raise PluggyUnavailableError("Pluggy is currently unavailable.")
        raise PluggyUnavailableError("Pluggy returned too many item pages.")

    def fetch_snapshot(self, *, item_id: str) -> dict[str, Any]:
        self._require_configuration()
        try:
            with httpx.Client(
                base_url=PLUGGY_API_URL,
                timeout=30.0,
                transport=self._transport,
            ) as client:
                api_key = self._authenticate(client)
                headers = {"X-API-KEY": api_key}
                item = self._get_json(client, f"/items/{item_id}", headers=headers)
                accounts = self._get_page_results(
                    client,
                    "/accounts",
                    headers=headers,
                    params={"itemId": item_id},
                )
                transactions = {
                    str(account["id"]): self._get_cursor_results(
                        client,
                        "/v2/transactions",
                        headers=headers,
                        params={"accountId": str(account["id"])},
                    )
                    for account in accounts
                    if account.get("id")
                }
                investments = self._get_page_results(
                    client,
                    "/investments",
                    headers=headers,
                    params={"itemId": item_id, "pageSize": 500},
                )
                investment_transactions = {
                    str(investment["id"]): self._get_investment_transactions(
                        client,
                        investment,
                        headers=headers,
                    )
                    for investment in investments
                    if investment.get("id")
                }
        except httpx.HTTPError as exc:
            raise PluggyUnavailableError("Pluggy is currently unavailable.") from exc

        return {
            "item": item,
            "accounts": accounts,
            "transactions": transactions,
            "investments": investments,
            "investment_transactions": investment_transactions,
        }

    def _get_investment_transactions(
        self,
        client: httpx.Client,
        investment: dict,
        *,
        headers: dict,
    ) -> list:
        """Buys and sells for one investment.

        The dedicated endpoint is the supported source, but the position itself
        still carries an embedded ``transactions`` array on several connectors.
        Falling back to it means a connector that does not serve the endpoint
        degrades to whatever it does expose instead of importing nothing.
        """
        try:
            return self._get_page_results(
                client,
                f"/investments/{investment['id']}/transactions",
                headers=headers,
                params={"pageSize": 500},
            )
        except (httpx.HTTPError, PluggyUnavailableError):
            # Not an outage: the rest of the snapshot has already come back by
            # now, so this is a connector that does not serve the endpoint.
            # Authentication errors are deliberately not caught.
            embedded = investment.get("transactions")
            return embedded if isinstance(embedded, list) else []

    def _authenticate(self, client: httpx.Client) -> str:
        response = client.post(
            "/auth",
            json={
                "clientId": self._client_id,
                "clientSecret": self._client_secret,
            },
        )
        if response.status_code == 401:
            raise PluggyAuthenticationError("Pluggy authentication failed.")
        if not response.is_success:
            raise PluggyUnavailableError("Pluggy is currently unavailable.")
        return _read_required_string(response, "apiKey")

    def _require_configuration(self) -> None:
        if not self._client_id or not self._client_secret:
            raise PluggyNotConfiguredError("Pluggy integration is not configured.")

    def _get_json(
        self,
        client: httpx.Client,
        path: str,
        *,
        headers: dict[str, str],
        params: dict[str, str | int] | None = None,
    ) -> dict[str, Any]:
        response = client.get(path, headers=headers, params=params)
        if response.status_code in {401, 403}:
            raise PluggyAuthenticationError("Pluggy authentication failed.")
        if not response.is_success:
            raise PluggyUnavailableError("Pluggy is currently unavailable.")
        try:
            payload = response.json()
        except ValueError as exc:
            raise PluggyUnavailableError("Pluggy returned an invalid response.") from exc
        if not isinstance(payload, dict):
            raise PluggyUnavailableError("Pluggy returned an invalid response.")
        return payload

    def _get_page_results(
        self,
        client: httpx.Client,
        path: str,
        *,
        headers: dict[str, str],
        params: dict[str, str | int],
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        page = 1
        while True:
            payload = self._get_json(
                client,
                path,
                headers=headers,
                params={**params, "page": page},
            )
            page_results = payload.get("results")
            if not isinstance(page_results, list):
                raise PluggyUnavailableError("Pluggy returned an invalid response.")
            results.extend(item for item in page_results if isinstance(item, dict))
            total_pages = int(payload.get("totalPages") or 1)
            if page >= total_pages:
                return results
            page += 1

    def _get_cursor_results(
        self,
        client: httpx.Client,
        path: str,
        *,
        headers: dict[str, str],
        params: dict[str, str],
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        next_path: str | None = path
        next_params: dict[str, str] | None = params
        for _ in range(100):
            assert next_path is not None
            payload = self._get_json(
                client,
                next_path,
                headers=headers,
                params=next_params,
            )
            page_results = payload.get("results")
            if not isinstance(page_results, list):
                raise PluggyUnavailableError("Pluggy returned an invalid response.")
            results.extend(item for item in page_results if isinstance(item, dict))
            next_query = payload.get("next")
            if not isinstance(next_query, str) or not next_query:
                return results
            if not next_query.startswith("?"):
                raise PluggyUnavailableError("Pluggy returned an invalid response.")
            next_path = f"{path}{next_query}"
            next_params = None
        raise PluggyUnavailableError("Pluggy returned too many transaction pages.")


def _read_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return "Pluggy is not enabled to list this application's items."
    if not isinstance(payload, dict):
        return "Pluggy is not enabled to list this application's items."
    detail = payload.get("codeDescription") or payload.get("message")
    if not isinstance(detail, str) or not detail:
        return "Pluggy is not enabled to list this application's items."
    return detail


def _read_required_string(response: httpx.Response, field_name: str) -> str:
    try:
        value = response.json()[field_name]
    except (KeyError, TypeError, ValueError) as exc:
        raise PluggyUnavailableError("Pluggy returned an invalid response.") from exc
    if not isinstance(value, str) or not value:
        raise PluggyUnavailableError("Pluggy returned an invalid response.")
    return value
