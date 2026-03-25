from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Protocol

from finance_app.domain.events import NewEvent

INVESTMENT_VIEWS = ("daily", "weekly", "monthly", "bimonthly", "quarterly", "yearly")
INVESTMENT_MOVEMENT_TYPES = ("contribution", "withdrawal")


class InvestmentServiceError(Exception):
    pass


class InvalidInvestmentDateError(InvestmentServiceError):
    pass


class InvalidInvestmentTypeError(InvestmentServiceError):
    pass


class InvestmentMovementAlreadyExistsError(InvestmentServiceError):
    pass


class InvalidInvestmentAccountError(InvestmentServiceError):
    pass


class InvalidInvestmentViewError(InvestmentServiceError):
    pass


class InvalidInvestmentRangeError(InvestmentServiceError):
    pass


class InvestmentEventStore(Protocol):
    def create_schema(self) -> None: ...
    def append(self, event: NewEvent) -> int: ...


class InvestmentProjector(Protocol):
    def run(self) -> int: ...
    def list_investment_movements(
        self,
        *,
        occurred_from: str | None = None,
        occurred_to: str | None = None,
    ) -> list[dict[str, str | int | None]]: ...
    def get_investment_overview(
        self,
        *,
        view: Literal["daily", "weekly", "monthly", "bimonthly", "quarterly", "yearly"],
        occurred_from: str,
        occurred_to: str,
        goal_percent: int,
    ) -> dict[str, object]: ...


class AccountReader(Protocol):
    def get_account(self, account_id: str) -> dict[str, str | int | bool]: ...


class InvestmentService:
    def __init__(
        self,
        *,
        event_store: InvestmentEventStore,
        projector: InvestmentProjector,
        account_reader: AccountReader,
    ) -> None:
        self._event_store = event_store
        self._projector = projector
        self._account_reader = account_reader

    def list_movements(
        self,
        *,
        occurred_from: str | None = None,
        occurred_to: str | None = None,
    ) -> list[dict[str, str | int | None]]:
        self._sync_projections()

        if occurred_from is not None:
            self._validate_utc_timestamp(occurred_from)
        if occurred_to is not None:
            self._validate_utc_timestamp(occurred_to)
        if occurred_from is not None and occurred_to is not None and occurred_from > occurred_to:
            raise InvalidInvestmentRangeError("from must be less than or equal to to.")

        return self._projector.list_investment_movements(
            occurred_from=occurred_from,
            occurred_to=occurred_to,
        )

    def get_overview(
        self,
        *,
        view: str,
        occurred_from: str,
        occurred_to: str,
        goal_percent: int = 10,
    ) -> dict[str, object]:
        self._sync_projections()
        self._validate_view(view)
        self._validate_utc_timestamp(occurred_from)
        self._validate_utc_timestamp(occurred_to)
        if occurred_from > occurred_to:
            raise InvalidInvestmentRangeError("from must be less than or equal to to.")

        return self._projector.get_investment_overview(
            view=view,  # type: ignore[arg-type]
            occurred_from=occurred_from,
            occurred_to=occurred_to,
            goal_percent=goal_percent,
        )

    def create_movement(
        self,
        *,
        movement_id: str,
        occurred_at: str,
        movement_type: str,
        account_id: str,
        description: str | None = None,
        contribution_amount: int | None = None,
        dividend_amount: int | None = None,
        cash_amount: int | None = None,
        invested_amount: int | None = None,
    ) -> dict[str, str | int | None]:
        self._sync_projections()

        if self._find_movement(movement_id) is not None:
            raise InvestmentMovementAlreadyExistsError(
                f"Investment movement '{movement_id}' already exists."
            )

        self._validate_required_text(movement_id, "id")
        self._validate_utc_timestamp(occurred_at)
        self._validate_movement_type(movement_type)

        account = self._account_reader.get_account(account_id)
        if str(account["type"]) == "investment":
            raise InvalidInvestmentAccountError(
                "account_id must reference a non-investment account."
            )

        payload = self._build_payload(
            movement_id=movement_id,
            occurred_at=occurred_at,
            movement_type=movement_type,
            account_id=account_id,
            description=description,
            contribution_amount=contribution_amount,
            dividend_amount=dividend_amount,
            cash_amount=cash_amount,
            invested_amount=invested_amount,
        )

        self._event_store.create_schema()
        self._event_store.append(
            NewEvent(
                type="InvestmentMovementRecorded",
                timestamp=self._utc_now(),
                payload=payload,
                version=1,
            )
        )
        self._projector.run()
        movement = self._find_movement(movement_id)
        assert movement is not None
        return movement

    def _build_payload(
        self,
        *,
        movement_id: str,
        occurred_at: str,
        movement_type: str,
        account_id: str,
        description: str | None,
        contribution_amount: int | None,
        dividend_amount: int | None,
        cash_amount: int | None,
        invested_amount: int | None,
    ) -> dict[str, str | int | None]:
        contribution = contribution_amount or 0
        dividend = dividend_amount or 0
        cash = cash_amount or 0
        invested = invested_amount or 0

        if movement_type == "contribution":
            if contribution <= 0:
                raise InvestmentServiceError(
                    "contribution_amount must be greater than zero for contributions."
                )
            if dividend < 0:
                raise InvestmentServiceError(
                    "dividend_amount cannot be negative."
                )
            cash = contribution
            invested = contribution + dividend
            cash_delta = -cash
            invested_delta = invested
            contribution_value = contribution
            dividend_value = dividend
        else:
            if cash <= 0:
                raise InvestmentServiceError(
                    "cash_amount must be greater than zero for withdrawals."
                )
            if invested <= 0:
                raise InvestmentServiceError(
                    "invested_amount must be greater than zero for withdrawals."
                )
            if contribution > 0 or dividend > 0:
                raise InvestmentServiceError(
                    "contribution_amount and dividend_amount are not allowed for withdrawals."
                )
            cash_delta = cash
            invested_delta = -invested
            contribution_value = 0
            dividend_value = 0

        return {
            "id": movement_id,
            "occurred_at": occurred_at,
            "type": movement_type,
            "account_id": account_id,
            "description": description,
            "contribution_amount": contribution_value,
            "dividend_amount": dividend_value,
            "cash_amount": cash,
            "invested_amount": invested,
            "cash_delta": cash_delta,
            "invested_delta": invested_delta,
        }

    def _find_movement(
        self,
        movement_id: str,
    ) -> dict[str, str | int | None] | None:
        for movement in self._projector.list_investment_movements():
            if movement["movement_id"] == movement_id:
                return movement
        return None

    def _validate_utc_timestamp(self, value: str) -> None:
        if not value.endswith("Z"):
            raise InvalidInvestmentDateError(
                "Timestamp must be a UTC ISO 8601 timestamp."
            )

        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise InvalidInvestmentDateError(
                "Timestamp must be a UTC ISO 8601 timestamp."
            ) from exc

        if parsed.tzinfo is None or parsed.utcoffset() != timezone.utc.utcoffset(parsed):
            raise InvalidInvestmentDateError(
                "Timestamp must be a UTC ISO 8601 timestamp."
            )

    def _validate_movement_type(self, value: str) -> None:
        if value not in INVESTMENT_MOVEMENT_TYPES:
            raise InvalidInvestmentTypeError(
                f"Unsupported investment movement type '{value}'."
            )

    def _validate_required_text(self, value: str, field_name: str) -> None:
        if not value.strip():
            raise InvestmentServiceError(f"{field_name} is required.")

    def _validate_view(self, value: str) -> None:
        if value not in INVESTMENT_VIEWS:
            raise InvalidInvestmentViewError(
                f"Unsupported investment view '{value}'."
            )

    def _sync_projections(self) -> None:
        self._event_store.create_schema()
        self._projector.run()

    def _utc_now(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
