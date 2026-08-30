from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field

from finance_app.application.pluggy_inbox import (
    EntryAlreadyDecidedError,
    MissingCategoryError,
    MissingDestinationError,
    PluggyInboxError,
    PluggyInboxService,
    StagedEntryNotFoundError,
    UnresolvedInvoiceError,
    UnsupportedEntryKindError,
)
from finance_app.application.pluggy import (
    PluggyAccountNotFoundError,
    PluggyAuthenticationError,
    PluggyLinkError,
    PluggyItemNotFoundError,
    PluggyItemNotReadyError,
    PluggyNotConfiguredError,
    PluggyService,
    PluggyUnavailableError,
)


class CreateConnectTokenRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    client_user_id: str | None = Field(
        default=None,
        alias="clientUserId",
        min_length=1,
        max_length=200,
    )
    item_id: str | None = Field(
        default=None,
        alias="itemId",
        min_length=1,
        max_length=200,
    )


class ConnectTokenResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    access_token: str = Field(alias="accessToken")


class RegisterPluggyItemRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    item_id: str = Field(alias="itemId", min_length=1, max_length=200)
    client_user_id: str = Field(
        default="meucofri-owner",
        alias="clientUserId",
        min_length=1,
        max_length=200,
    )
    item: dict[str, Any] | None = None
    error_message: str | None = Field(default=None, alias="errorMessage", max_length=500)


class RecoverPluggyItemsRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    client_user_id: str = Field(
        default="meucofri-owner",
        alias="clientUserId",
        min_length=1,
        max_length=200,
    )


class LinkPluggyItemRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    item_id: str = Field(alias="itemId", min_length=1, max_length=200)
    client_user_id: str = Field(
        default="meucofri-owner",
        alias="clientUserId",
        min_length=1,
        max_length=200,
    )


class LinkPluggyAccountRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    local_account_id: str | None = Field(
        default=None, alias="localAccountId", max_length=200
    )
    local_card_id: str | None = Field(default=None, alias="localCardId", max_length=200)
    local_holder_id: str | None = Field(
        default=None, alias="localHolderId", max_length=200
    )
    ignored: bool = False
    import_since: str | None = Field(
        default=None, alias="importSince", min_length=10, max_length=10
    )


class AcceptEntryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    overrides: dict[str, Any] | None = None
    # Teach what this description always means. It only ever pre-fills the next
    # one; acceptance stays a click.
    remember: bool = False


class SaveImportRuleRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    match_value: str | None = Field(default=None, alias="matchValue")
    label: str | None = None
    set_category_id: str | None = Field(default=None, alias="setCategoryId")
    set_person_id: str | None = Field(default=None, alias="setPersonId")
    set_card_id: str | None = Field(default=None, alias="setCardId")
    set_holder_id: str | None = Field(default=None, alias="setHolderId")
    set_account_id: str | None = Field(default=None, alias="setAccountId")


class LinkExistingEntryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    local_id: str = Field(alias="localId", min_length=1, max_length=200)


class AcceptEntryBatchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    entry_ids: list[str] = Field(alias="entryIds", min_length=1, max_length=500)


class SyncPluggyRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    item_id: str | None = Field(default=None, alias="itemId", min_length=1, max_length=200)


def build_pluggy_router(
    pluggy_service: PluggyService,
    inbox_service: PluggyInboxService,
) -> APIRouter:
    router = APIRouter()

    def _inbox_http_error(exc: PluggyInboxError) -> HTTPException:
        if isinstance(exc, StagedEntryNotFoundError):
            return HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
            )
        if isinstance(exc, EntryAlreadyDecidedError):
            return HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=str(exc)
            )
        if isinstance(
            exc,
            (
                MissingCategoryError,
                MissingDestinationError,
                UnresolvedInvoiceError,
                UnsupportedEntryKindError,
            ),
        ):
            return HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
            )
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )

    @router.get("/api/pluggy/inbox")
    def list_inbox(
        response: Response,
        decision: str | None = "pending",
        kind: str | None = None,
        account_id: str | None = None,
        include_covered: bool = False,
    ) -> dict[str, Any]:
        response.headers["Cache-Control"] = "no-store"
        return inbox_service.list_entries(
            decision=decision,
            kind=kind,
            pluggy_account_id=account_id,
            include_covered=include_covered,
        )

    @router.post("/api/pluggy/inbox/accept-batch")
    def accept_entry_batch(payload: AcceptEntryBatchRequest) -> dict[str, Any]:
        return inbox_service.accept_batch(payload.entry_ids)

    @router.post("/api/pluggy/inbox/{entry_id}/accept")
    def accept_entry(
        entry_id: str,
        payload: AcceptEntryRequest | None = None,
    ) -> dict[str, Any]:
        try:
            return inbox_service.accept(
                entry_id,
                overrides=payload.overrides if payload else None,
                remember=payload.remember if payload else False,
            )
        except PluggyInboxError as exc:
            raise _inbox_http_error(exc) from exc

    @router.get("/api/pluggy/rules")
    def list_rules(response: Response) -> dict[str, Any]:
        response.headers["Cache-Control"] = "no-store"
        return inbox_service.list_rules()

    @router.post("/api/pluggy/rules")
    def save_rule(payload: SaveImportRuleRequest) -> dict[str, Any]:
        try:
            return inbox_service.save_rule(payload.model_dump())
        except PluggyInboxError as exc:
            raise _inbox_http_error(exc) from exc

    @router.delete("/api/pluggy/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_rule(rule_id: str) -> Response:
        try:
            inbox_service.delete_rule(rule_id)
        except PluggyInboxError as exc:
            raise _inbox_http_error(exc) from exc
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @router.post("/api/pluggy/inbox/{entry_id}/ignore")
    def ignore_entry(entry_id: str) -> dict[str, Any]:
        try:
            return inbox_service.ignore(entry_id)
        except PluggyInboxError as exc:
            raise _inbox_http_error(exc) from exc

    @router.post("/api/pluggy/inbox/{entry_id}/link")
    def link_existing_entry(
        entry_id: str,
        payload: LinkExistingEntryRequest,
    ) -> dict[str, Any]:
        try:
            return inbox_service.link_existing(entry_id, local_id=payload.local_id)
        except PluggyInboxError as exc:
            raise _inbox_http_error(exc) from exc

    @router.post(
        "/api/pluggy/connect-token",
        response_model=ConnectTokenResponse,
    )
    def create_connect_token(
        payload: CreateConnectTokenRequest,
        response: Response,
    ) -> dict[str, str]:
        try:
            token = pluggy_service.create_connect_token(
                client_user_id=payload.client_user_id,
                item_id=payload.item_id,
            )
        except PluggyNotConfiguredError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from exc
        except PluggyAuthenticationError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            ) from exc
        except PluggyUnavailableError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            ) from exc

        response.headers["Cache-Control"] = "no-store"
        return token

    @router.post("/api/pluggy/items")
    def register_item(payload: RegisterPluggyItemRequest) -> dict[str, Any]:
        return pluggy_service.register_item(
            item_id=payload.item_id,
            client_user_id=payload.client_user_id,
            item=payload.item,
            error_message=payload.error_message,
        )

    @router.post("/api/pluggy/items/link")
    def link_item(payload: LinkPluggyItemRequest) -> dict[str, Any]:
        try:
            return pluggy_service.link_item(
                item_id=payload.item_id,
                client_user_id=payload.client_user_id,
            )
        except PluggyItemNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except PluggyNotConfiguredError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from exc
        except (PluggyAuthenticationError, PluggyUnavailableError) as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    @router.post("/api/pluggy/items/recover")
    def recover_items(payload: RecoverPluggyItemsRequest) -> dict[str, Any]:
        try:
            return pluggy_service.recover_items(client_user_id=payload.client_user_id)
        except PluggyNotConfiguredError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from exc
        except (PluggyAuthenticationError, PluggyUnavailableError) as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    @router.get("/api/pluggy/accounts")
    def list_accounts(response: Response) -> dict[str, Any]:
        response.headers["Cache-Control"] = "no-store"
        return pluggy_service.list_accounts()

    @router.get("/api/pluggy/accounts/{pluggy_account_id}/card-numbers")
    def list_card_numbers(
        pluggy_account_id: str,
        response: Response,
    ) -> dict[str, Any]:
        response.headers["Cache-Control"] = "no-store"
        return inbox_service.list_card_numbers(pluggy_account_id)

    @router.put("/api/pluggy/accounts/{pluggy_account_id}/link")
    def link_account(
        pluggy_account_id: str,
        payload: LinkPluggyAccountRequest,
    ) -> dict[str, Any]:
        try:
            return pluggy_service.link_account(
                pluggy_account_id=pluggy_account_id,
                local_account_id=payload.local_account_id,
                local_card_id=payload.local_card_id,
                local_holder_id=payload.local_holder_id,
                ignored=payload.ignored,
                import_since=payload.import_since,
            )
        except PluggyAccountNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except PluggyLinkError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.get("/api/pluggy/status")
    def get_status(response: Response) -> dict[str, Any]:
        response.headers["Cache-Control"] = "no-store"
        return pluggy_service.get_status()

    @router.post("/api/pluggy/sync")
    def sync(payload: SyncPluggyRequest) -> dict[str, Any]:
        try:
            if payload.item_id is not None:
                return pluggy_service.sync_item(payload.item_id)
            return pluggy_service.sync_all()
        except PluggyItemNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        except PluggyItemNotReadyError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
        except PluggyNotConfiguredError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from exc
        except (PluggyAuthenticationError, PluggyUnavailableError) as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return router
