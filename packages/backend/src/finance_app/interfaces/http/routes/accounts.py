from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from finance_app.application.accounts import (
    AccountAlreadyExistsError,
    AccountNotFoundError,
    AccountService,
    InvalidAccountTypeError,
    LastActiveAccountError,
)

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


def build_accounts_router(account_service: AccountService) -> APIRouter:
    router = APIRouter()

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
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
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
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    return router
