from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from finance_app.application.accounts import AccountNotFoundError
from finance_app.application.investments import (
    InvalidInvestmentDateError,
    InvalidInvestmentRangeError,
    InvalidInvestmentTypeError,
    InvalidInvestmentViewError,
    InvestmentMovementAlreadyExistsError,
    InvestmentService,
    InvestmentServiceError,
)


class CreateInvestmentMovementRequest(BaseModel):
    id: str = Field(min_length=1)
    occurred_at: str
    type: Literal[
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
    ]
    account_id: str = Field(min_length=1)
    description: str | None = None
    contribution_amount: int | None = Field(default=None, ge=0)
    dividend_amount: int | None = Field(default=None, ge=0)
    reinvested_dividend_amount: int | None = Field(default=None, ge=0)
    cash_amount: int | None = Field(default=None, ge=0)
    invested_amount: int | None = Field(default=None, ge=0)
    asset_ticker: str | None = None
    asset_class: str | None = None
    category: str | None = None
    origin_account_id: str | None = None
    destination_account_id: str | None = None
    affects_cash: bool | None = None
    affects_invested_capital: bool | None = None
    affects_income: bool | None = None


class InvestmentSnapshotRequest(BaseModel):
    id: str = Field(min_length=1)
    date: str
    period: str = Field(min_length=1)
    total_patrimony: int = Field(ge=0)
    applied_value: int = Field(ge=0)
    gross_balance: int = Field(ge=0)
    free_cash: int = Field(ge=0)
    accumulated_dividends: int = Field(default=0, ge=0)
    monthly_contribution_target: int = Field(default=0, ge=0)
    fii_applied_value: int = Field(default=0, ge=0)
    fii_monthly_income: int = Field(default=0, ge=0)
    stock_applied_value: int = Field(default=0, ge=0)
    stock_monthly_income: int = Field(default=0, ge=0)
    total_monthly_income: int = Field(default=0, ge=0)
    reinvested_income: int = Field(default=0, ge=0)
    notes: str | None = None


class InvestmentAssetRequest(BaseModel):
    id: str = Field(min_length=1)
    ticker: str = Field(min_length=1)
    name: str | None = None
    asset_class: Literal["caixa", "renda_fixa", "fii", "acao", "exterior", "cripto", "outros"]
    category: str = Field(min_length=1)
    quantity: int = Field(default=0, ge=0)
    average_price: int = Field(default=0, ge=0)
    current_price: int | None = Field(default=None, ge=0)
    invested_value: int | None = Field(default=None, ge=0)
    current_value: int | None = Field(default=None, ge=0)
    monthly_income: int | None = Field(default=None, ge=0)
    notes: str | None = None


class AllocationTargetRequest(BaseModel):
    id: str = Field(min_length=1)
    asset_class: str = Field(min_length=1)
    label: str = Field(min_length=1)
    ideal_percentage: int = Field(ge=0, le=10000)
    current_value: int = Field(default=0, ge=0)


class MonthlyIncomeRecordRequest(BaseModel):
    id: str = Field(min_length=1)
    month: str = Field(min_length=7, max_length=7)
    asset_class: str = Field(min_length=1)
    asset_ticker: str | None = None
    amount: int = Field(ge=0)


def build_investments_router(investment_service: InvestmentService) -> APIRouter:
    router = APIRouter()

    @router.post("/api/investments/movements", status_code=status.HTTP_201_CREATED)
    def create_investment_movement(
        payload: CreateInvestmentMovementRequest,
    ) -> dict[str, str | int | bool | None]:
        try:
            return investment_service.create_movement(
                movement_id=payload.id,
                occurred_at=payload.occurred_at,
                movement_type=payload.type,
                account_id=payload.account_id,
                description=payload.description,
                contribution_amount=payload.contribution_amount,
                dividend_amount=payload.dividend_amount,
                reinvested_dividend_amount=payload.reinvested_dividend_amount,
                cash_amount=payload.cash_amount,
                invested_amount=payload.invested_amount,
                asset_ticker=payload.asset_ticker,
                asset_class=payload.asset_class,
                category=payload.category,
                origin_account_id=payload.origin_account_id,
                destination_account_id=payload.destination_account_id,
                affects_cash=payload.affects_cash,
                affects_invested_capital=payload.affects_invested_capital,
                affects_income=payload.affects_income,
            )
        except AccountNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc
        except InvestmentMovementAlreadyExistsError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(exc),
            ) from exc
        except (
            InvalidInvestmentDateError,
            InvalidInvestmentTypeError,
            InvestmentServiceError,
        ) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.get("/api/investments/movements")
    def list_investment_movements(
        occurred_from: str | None = Query(default=None, alias="from"),
        occurred_to: str | None = Query(default=None, alias="to"),
    ) -> list[dict[str, str | int | bool | None]]:
        try:
            return investment_service.list_movements(
                occurred_from=occurred_from,
                occurred_to=occurred_to,
            )
        except (
            InvalidInvestmentDateError,
            InvalidInvestmentRangeError,
            InvestmentServiceError,
        ) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.get("/api/investments/current")
    def get_current_investments() -> dict[str, object]:
        return investment_service.get_current()

    @router.get("/api/investments/snapshots")
    def list_investment_snapshots() -> list[dict[str, str | int | None]]:
        return investment_service.list_snapshots()

    @router.get("/api/investments/snapshots/{period}")
    def get_investment_snapshot_by_period(period: str) -> dict[str, str | int | None]:
        snapshot = investment_service.get_snapshot_by_period(period)
        if snapshot is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Investment snapshot for period '{period}' was not found.",
            )
        return snapshot

    @router.post("/api/investments/snapshots", status_code=status.HTTP_201_CREATED)
    def save_investment_snapshot(
        payload: InvestmentSnapshotRequest,
    ) -> dict[str, str | int | None]:
        return investment_service.save_snapshot(payload.model_dump())

    @router.get("/api/investments/assets")
    def list_investment_assets() -> list[dict[str, str | int | None]]:
        return investment_service.list_assets()

    @router.post("/api/investments/assets", status_code=status.HTTP_201_CREATED)
    def save_investment_asset(
        payload: InvestmentAssetRequest,
    ) -> dict[str, str | int | None]:
        data = payload.model_dump()
        if data["invested_value"] is None:
            data["invested_value"] = int(data["quantity"]) * int(data["average_price"])
        if data["current_value"] is None:
            price = data["current_price"] if data["current_price"] is not None else data["average_price"]
            data["current_value"] = int(data["quantity"]) * int(price)
        return investment_service.save_asset(data)

    @router.delete("/api/investments/assets/{asset_id}")
    def delete_investment_asset(asset_id: str) -> dict[str, str]:
        return investment_service.delete_asset(asset_id)

    @router.get("/api/investments/allocation-targets")
    def list_allocation_targets() -> list[dict[str, str | int]]:
        return investment_service.list_allocation_targets()

    @router.post("/api/investments/allocation-targets", status_code=status.HTTP_201_CREATED)
    def save_allocation_target(
        payload: AllocationTargetRequest,
    ) -> dict[str, str | int]:
        return investment_service.save_allocation_target(payload.model_dump())

    @router.get("/api/investments/income-records")
    def list_income_records(
        month_from: str | None = Query(default=None, alias="from"),
        month_to: str | None = Query(default=None, alias="to"),
    ) -> list[dict[str, str | int | None]]:
        return investment_service.list_income_records(
            month_from=month_from,
            month_to=month_to,
        )

    @router.post("/api/investments/income-records", status_code=status.HTTP_201_CREATED)
    def save_income_record(
        payload: MonthlyIncomeRecordRequest,
    ) -> dict[str, str | int | None]:
        return investment_service.save_income_record(payload.model_dump())

    @router.get("/api/investments/history")
    def get_investment_history(
        view: Literal["daily", "weekly", "monthly", "bimonthly", "quarterly", "yearly"] = Query(...),
        occurred_from: str = Query(..., alias="from"),
        occurred_to: str = Query(..., alias="to"),
        goal_percent: int = Query(default=10, ge=0, le=100),
    ) -> dict[str, object]:
        try:
            return investment_service.get_overview(
                view=view,
                occurred_from=occurred_from,
                occurred_to=occurred_to,
                goal_percent=goal_percent,
            )
        except (
            InvalidInvestmentDateError,
            InvalidInvestmentRangeError,
            InvalidInvestmentViewError,
            InvestmentServiceError,
        ) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    @router.get("/api/investments/overview")
    def get_investment_overview(
        view: Literal["daily", "weekly", "monthly", "bimonthly", "quarterly", "yearly"] = Query(...),
        occurred_from: str = Query(..., alias="from"),
        occurred_to: str = Query(..., alias="to"),
        goal_percent: int = Query(default=10, ge=0, le=100),
    ) -> dict[str, object]:
        try:
            return investment_service.get_overview(
                view=view,
                occurred_from=occurred_from,
                occurred_to=occurred_to,
                goal_percent=goal_percent,
            )
        except (
            InvalidInvestmentDateError,
            InvalidInvestmentRangeError,
            InvalidInvestmentViewError,
            InvestmentServiceError,
        ) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=str(exc),
            ) from exc

    return router
