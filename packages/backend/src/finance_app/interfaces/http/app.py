from typing import Literal

from fastapi import APIRouter, FastAPI, HTTPException, status
from pydantic import BaseModel, Field

from finance_app.application.accounts import (
    AccountAlreadyExistsError,
    AccountNotFoundError,
    AccountService,
    InvalidAccountTypeError,
    LastActiveAccountError,
)
from finance_app.application.health import HealthCheckUseCase
from finance_app.infrastructure.event_store import EventStore
from finance_app.infrastructure.projector import Projector

AccountType = Literal["checking", "savings", "wallet", "investment", "other"]


class CreateAccountRequest(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    type: AccountType
    initial_balance: int


class UpdateAccountRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    type: AccountType | None = None
    initial_balance: int | None = None
    is_active: bool | None = None


def build_router(account_service: AccountService) -> APIRouter:
    router = APIRouter()

    @router.get("/health")
    def health() -> dict[str, str]:
        return HealthCheckUseCase().execute()

    @router.get("/api/accounts")
    def list_accounts() -> list[dict[str, str | int | bool]]:
        return account_service.list_accounts()

    @router.post("/api/accounts", status_code=status.HTTP_201_CREATED)
    def create_account(payload: CreateAccountRequest) -> dict[str, str | int | bool]:
        try:
            return account_service.create_account(
                account_id=payload.id,
                name=payload.name,
                account_type=payload.type,
                initial_balance=payload.initial_balance,
            )
        except AccountAlreadyExistsError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        except InvalidAccountTypeError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc

    @router.patch("/api/accounts/{account_id}")
    def update_account(
        account_id: str,
        payload: UpdateAccountRequest,
    ) -> dict[str, str | int | bool]:
        try:
            return account_service.update_account(
                account_id,
                name=payload.name,
                account_type=payload.type,
                initial_balance=payload.initial_balance,
                is_active=payload.is_active,
            )
        except AccountNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except LastActiveAccountError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        except InvalidAccountTypeError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc

    return router


def create_app(
    *,
    database_url: str | None = None,
    event_database_url: str | None = None,
) -> FastAPI:
    event_store = EventStore(database_url=event_database_url)
    projector = Projector(
        event_database_url=event_database_url,
        projection_database_url=database_url,
    )
    account_service = AccountService(event_store=event_store, projector=projector)
    app = FastAPI(title="finance-app backend")
    app.include_router(build_router(account_service))
    return app
