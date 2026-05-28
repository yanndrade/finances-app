from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Protocol

from finance_app.domain.events import NewEvent

INVESTMENT_VIEWS = ("daily", "weekly", "monthly", "bimonthly", "quarterly", "yearly")
INVESTMENT_MOVEMENT_TYPES = (
    "contribution",
    "withdrawal",
    "aporte",
    "resgate",
    "compra",
    "venda",
    "provento",
    "reinvestimento",
    "rendimento",
    "taxa",
    "ajuste",
    "transferencia",
)


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
    ) -> list[dict[str, str | int | bool | None]]: ...
    def get_investment_overview(
        self,
        *,
        view: Literal["daily", "weekly", "monthly", "bimonthly", "quarterly", "yearly"],
        occurred_from: str,
        occurred_to: str,
        goal_percent: int,
    ) -> dict[str, object]: ...
    def get_current_investments(self) -> dict[str, object]: ...
    def list_investment_snapshots(self) -> list[dict[str, str | int | None]]: ...
    def get_investment_snapshot_by_period(
        self,
        period: str,
    ) -> dict[str, str | int | None] | None: ...
    def list_investment_assets(self) -> list[dict[str, str | int | None]]: ...
    def list_allocation_targets(self) -> list[dict[str, str | int]]: ...
    def list_monthly_income_records(
        self,
        *,
        month_from: str | None = None,
        month_to: str | None = None,
    ) -> list[dict[str, str | int | None]]: ...


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
    ) -> list[dict[str, str | int | bool | None]]:
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

    def get_current(self) -> dict[str, object]:
        self._sync_projections()
        return self._projector.get_current_investments()

    def list_snapshots(self) -> list[dict[str, str | int | None]]:
        self._sync_projections()
        return self._projector.list_investment_snapshots()

    def get_snapshot_by_period(self, period: str) -> dict[str, str | int | None] | None:
        self._sync_projections()
        return self._projector.get_investment_snapshot_by_period(period)

    def list_assets(self) -> list[dict[str, str | int | None]]:
        self._sync_projections()
        return self._projector.list_investment_assets()

    def list_allocation_targets(self) -> list[dict[str, str | int]]:
        self._sync_projections()
        return self._projector.list_allocation_targets()

    def list_income_records(
        self,
        *,
        month_from: str | None = None,
        month_to: str | None = None,
    ) -> list[dict[str, str | int | None]]:
        self._sync_projections()
        return self._projector.list_monthly_income_records(
            month_from=month_from,
            month_to=month_to,
        )

    def save_snapshot(self, payload: dict[str, object]) -> dict[str, str | int | None]:
        self._append_upsert_event("InvestmentSnapshotSaved", payload)
        snapshots = self._projector.list_investment_snapshots()
        return next(item for item in snapshots if item["id"] == payload["id"])

    def save_asset(self, payload: dict[str, object]) -> dict[str, str | int | None]:
        self._append_upsert_event("InvestmentAssetSaved", payload)
        assets = self._projector.list_investment_assets()
        return next(item for item in assets if item["id"] == payload["id"])

    def save_allocation_target(self, payload: dict[str, object]) -> dict[str, str | int]:
        self._append_upsert_event("AllocationTargetSaved", payload)
        targets = self._projector.list_allocation_targets()
        return next(item for item in targets if item["id"] == payload["id"])

    def save_income_record(self, payload: dict[str, object]) -> dict[str, str | int | None]:
        self._append_upsert_event("MonthlyIncomeRecordSaved", payload)
        records = self._projector.list_monthly_income_records()
        return next(item for item in records if item["id"] == payload["id"])

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
        reinvested_dividend_amount: int | None = None,
        cash_amount: int | None = None,
        invested_amount: int | None = None,
        asset_ticker: str | None = None,
        asset_class: str | None = None,
        category: str | None = None,
        origin_account_id: str | None = None,
        destination_account_id: str | None = None,
        affects_cash: bool | None = None,
        affects_invested_capital: bool | None = None,
        affects_income: bool | None = None,
    ) -> dict[str, str | int | bool | None]:
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
            reinvested_dividend_amount=reinvested_dividend_amount,
            cash_amount=cash_amount,
            invested_amount=invested_amount,
            asset_ticker=asset_ticker,
            asset_class=asset_class,
            category=category,
            origin_account_id=origin_account_id,
            destination_account_id=destination_account_id,
            affects_cash=affects_cash,
            affects_invested_capital=affects_invested_capital,
            affects_income=affects_income,
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
        reinvested_dividend_amount: int | None,
        cash_amount: int | None,
        invested_amount: int | None,
        asset_ticker: str | None,
        asset_class: str | None,
        category: str | None,
        origin_account_id: str | None,
        destination_account_id: str | None,
        affects_cash: bool | None,
        affects_invested_capital: bool | None,
        affects_income: bool | None,
    ) -> dict[str, str | int | bool | None]:
        contribution = contribution_amount or 0
        dividend = dividend_amount or 0
        reinvested_dividend = reinvested_dividend_amount or 0
        cash = cash_amount or 0
        invested = invested_amount or 0

        normalized_type = self._normalize_movement_type(movement_type)

        if normalized_type in {"aporte", "contribution"}:
            amount = contribution + reinvested_dividend
            if amount <= 0:
                raise InvestmentServiceError(
                    "contribution_amount or reinvested_dividend_amount must be greater than zero for contributions."
                )
            if dividend > 0:
                raise InvestmentServiceError(
                    "dividend_amount is only allowed for received dividends."
                )
            cash = contribution
            invested = amount
            cash_delta = -cash
            invested_delta = invested
            contribution_value = contribution
            dividend_value = 0
            reinvested_dividend_value = reinvested_dividend
        elif normalized_type in {"resgate", "withdrawal"}:
            if cash <= 0:
                raise InvestmentServiceError(
                    "cash_amount must be greater than zero for withdrawals."
                )
            if invested <= 0:
                raise InvestmentServiceError(
                    "invested_amount must be greater than zero for withdrawals."
                )
            if contribution > 0 or dividend > 0 or reinvested_dividend > 0:
                raise InvestmentServiceError(
                    "contribution_amount, dividend_amount, and reinvested_dividend_amount are not allowed for withdrawals."
                )
            cash_delta = cash
            invested_delta = -invested
            contribution_value = 0
            dividend_value = 0
            reinvested_dividend_value = 0
        elif normalized_type in {"provento", "rendimento"}:
            amount = dividend or cash or invested or contribution
            if amount <= 0:
                raise InvestmentServiceError("amount must be greater than zero.")
            if reinvested_dividend > 0:
                raise InvestmentServiceError(
                    "reinvested_dividend_amount is not allowed for received dividends."
                )
            contribution_value = 0
            dividend_value = amount
            reinvested_dividend_value = 0
            cash = amount
            invested = 0
            cash_delta = amount
            invested_delta = 0
        elif normalized_type in {"compra", "reinvestimento"}:
            amount = cash or invested or contribution + reinvested_dividend or dividend
            if amount <= 0:
                raise InvestmentServiceError("amount must be greater than zero.")
            if dividend > 0:
                raise InvestmentServiceError(
                    "dividend_amount is only allowed for received dividends."
                )
            available_dividends = self._available_dividends_for_account(account_id)
            if normalized_type == "reinvestimento":
                reinvested_dividend_value = reinvested_dividend or amount
                contribution_value = 0
            elif reinvested_dividend_amount is None and contribution_amount is None:
                reinvested_dividend_value = min(available_dividends, amount)
                contribution_value = amount - reinvested_dividend_value
            else:
                reinvested_dividend_value = reinvested_dividend
                contribution_value = contribution if contribution_amount is not None else amount - reinvested_dividend_value
                if contribution_value + reinvested_dividend_value != amount:
                    raise InvestmentServiceError(
                        "contribution_amount plus reinvested_dividend_amount must equal the purchase amount."
                    )
            if reinvested_dividend_value > available_dividends:
                raise InvestmentServiceError(
                    "reinvested_dividend_amount exceeds available dividends for the account."
                )
            cash = amount
            invested = amount
            dividend_value = 0
            cash_delta = -amount
            invested_delta = amount
        else:
            amount = cash or invested or contribution or dividend
            if amount <= 0:
                raise InvestmentServiceError("amount must be greater than zero.")
            contribution_value = amount if normalized_type == "aporte" else 0
            dividend_value = amount if normalized_type in {"provento", "rendimento"} else 0
            reinvested_dividend_value = 0
            cash_delta = self._cash_delta_for_type(normalized_type, amount)
            invested_delta = self._invested_delta_for_type(normalized_type, amount)
            cash = amount
            invested = amount if invested == 0 else invested

        return {
            "id": movement_id,
            "occurred_at": occurred_at,
            "type": normalized_type,
            "account_id": account_id,
            "description": description,
            "contribution_amount": contribution_value,
            "dividend_amount": dividend_value,
            "reinvested_dividend_amount": reinvested_dividend_value,
            "cash_amount": cash,
            "invested_amount": invested,
            "cash_delta": cash_delta,
            "invested_delta": invested_delta,
            "asset_ticker": asset_ticker,
            "asset_class": asset_class,
            "category": category,
            "origin_account_id": origin_account_id,
            "destination_account_id": destination_account_id,
            "affects_cash": True if affects_cash is None else affects_cash,
            "affects_invested_capital": (
                normalized_type not in {"provento", "rendimento", "taxa"}
                if affects_invested_capital is None
                else affects_invested_capital
            ),
            "affects_income": (
                normalized_type in {"provento", "rendimento"}
                if affects_income is None
                else affects_income
            ),
        }

    def _append_upsert_event(self, event_type: str, payload: dict[str, object]) -> None:
        self._sync_projections()
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

    def _normalize_movement_type(self, value: str) -> str:
        return value

    def _cash_delta_for_type(self, movement_type: str, amount: int) -> int:
        if movement_type in {"compra", "taxa"}:
            return -amount
        if movement_type in {"venda", "provento", "rendimento", "aporte", "contribution"}:
            return amount
        if movement_type in {"resgate", "withdrawal"}:
            return amount
        return 0

    def _invested_delta_for_type(self, movement_type: str, amount: int) -> int:
        if movement_type in {"compra", "reinvestimento", "aporte", "contribution"}:
            return amount
        if movement_type in {"venda", "resgate", "withdrawal"}:
            return -amount
        return 0

    def _available_dividends_for_account(self, account_id: str) -> int:
        available = 0
        for movement in self._projector.list_investment_movements():
            if movement["account_id"] != account_id:
                continue
            available += int(movement.get("dividend_amount") or 0)
            available -= int(movement.get("reinvested_dividend_amount") or 0)
        return max(available, 0)

    def _find_movement(
        self,
        movement_id: str,
    ) -> dict[str, str | int | bool | None] | None:
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
