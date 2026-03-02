from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

from finance_app.domain.events import NewEvent

ACCOUNT_TYPES = ("checking", "savings", "wallet", "investment", "other")


class AccountServiceError(Exception):
    pass


class AccountNotFoundError(AccountServiceError):
    pass


class AccountAlreadyExistsError(AccountServiceError):
    pass


class InvalidAccountTypeError(AccountServiceError):
    pass


class LastActiveAccountError(AccountServiceError):
    pass


class AccountEventStore(Protocol):
    def create_schema(self) -> None: ...
    def append(self, event: NewEvent) -> int: ...


class AccountProjector(Protocol):
    def run(self) -> int: ...
    def list_accounts(self) -> list[dict[str, str | int | bool]]: ...
    def list_balance_states(self) -> list[dict[str, str | int]]: ...


class AccountService:
    def __init__(self, event_store: AccountEventStore, projector: AccountProjector) -> None:
        self._event_store = event_store
        self._projector = projector

    def list_accounts(self) -> list[dict[str, str | int | bool]]:
        self._sync_projections()
        accounts = self._projector.list_accounts()
        balances = {
            str(row["account_id"]): int(row["current_balance"])
            for row in self._projector.list_balance_states()
        }

        return [
            {
                **account,
                "current_balance": balances.get(str(account["account_id"]), 0),
            }
            for account in accounts
        ]

    def create_account(
        self,
        *,
        account_id: str,
        name: str,
        account_type: str,
        initial_balance: int,
    ) -> dict[str, str | int | bool]:
        self._sync_projections()
        self._validate_account_type(account_type)

        if self._find_account(account_id) is not None:
            raise AccountAlreadyExistsError(f"Account '{account_id}' already exists.")

        self._append_event(
            event_type="AccountCreated",
            payload={
                "id": account_id,
                "name": name,
                "type": account_type,
                "initial_balance": initial_balance,
                "is_active": True,
            },
        )
        return self.get_account(account_id)

    def update_account(
        self,
        account_id: str,
        *,
        name: str | None = None,
        account_type: str | None = None,
        initial_balance: int | None = None,
        is_active: bool | None = None,
    ) -> dict[str, str | int | bool]:
        self._sync_projections()
        existing = self._find_account(account_id)

        if existing is None:
            raise AccountNotFoundError(f"Account '{account_id}' was not found.")

        merged_type = account_type if account_type is not None else str(existing["type"])
        self._validate_account_type(merged_type)

        merged = {
            "id": account_id,
            "name": name if name is not None else str(existing["name"]),
            "type": merged_type,
            "initial_balance": (
                initial_balance
                if initial_balance is not None
                else int(existing["initial_balance"])
            ),
            "is_active": is_active if is_active is not None else bool(existing["is_active"]),
        }

        if (
            bool(existing["is_active"])
            and not bool(merged["is_active"])
            and self._count_active_accounts() == 1
        ):
            raise LastActiveAccountError("At least one active account must remain.")

        if (
            merged["name"] == existing["name"]
            and merged["type"] == existing["type"]
            and merged["initial_balance"] == existing["initial_balance"]
            and merged["is_active"] == existing["is_active"]
        ):
            return self.get_account(account_id)

        self._append_event(event_type="AccountUpdated", payload=merged)
        return self.get_account(account_id)

    def get_account(self, account_id: str) -> dict[str, str | int | bool]:
        self._sync_projections()
        account = self._find_account(account_id)

        if account is None:
            raise AccountNotFoundError(f"Account '{account_id}' was not found.")

        return account

    def _append_event(self, *, event_type: str, payload: dict[str, str | int | bool]) -> None:
        self._event_store.create_schema()
        self._event_store.append(
            NewEvent(
                type=event_type,
                timestamp=self._utc_now(),
                payload=payload,
                version=1,
            )
        )
        self._projector.run()

    def _sync_projections(self) -> None:
        self._event_store.create_schema()
        self._projector.run()

    def _find_account(self, account_id: str) -> dict[str, str | int | bool] | None:
        for account in self.list_accounts():
            if account["account_id"] == account_id:
                return account

        return None

    def _count_active_accounts(self) -> int:
        return sum(1 for account in self.list_accounts() if bool(account["is_active"]))

    def _validate_account_type(self, account_type: str) -> None:
        if account_type not in ACCOUNT_TYPES:
            raise InvalidAccountTypeError(
                f"Unsupported account type '{account_type}'."
            )

    def _utc_now(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
