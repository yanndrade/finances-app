from __future__ import annotations

from collections.abc import Sequence
from datetime import date
from datetime import datetime
from datetime import timedelta
from threading import RLock

from sqlalchemy import Boolean
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import and_
from sqlalchemy import func
from sqlalchemy.exc import NoSuchTableError
from sqlalchemy import inspect
from sqlalchemy import or_
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import Session
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import sessionmaker

from finance_app.domain.cards import PurchaseInstallmentAllocation
from finance_app.domain.cards import allocate_purchase_installments
from finance_app.domain.events import StoredEvent
from finance_app.domain.policies import (
    budget_status as domain_budget_status,
    investment_goal_target,
    requires_review,
)
from finance_app.domain.projections import (
    AccountProjection,
    BalanceStateProjection,
    BudgetProjection,
    CardProjection,
    CardPurchaseProjection,
    InvestmentMovementProjection,
    InvoiceItemProjection,
    InvoiceProjection,
    PendingProjection,
    RecurringRuleProjection,
    ReimbursementProjection,
    TransactionProjection,
)
from finance_app.infrastructure.db import get_engine
from finance_app.infrastructure.event_store import EventStore


class ProjectionBase(DeclarativeBase):
    """Metadata for app.db materialized projections."""


class EventCursorRecord(ProjectionBase):
    __tablename__ = "event_cursor"

    singleton_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    last_applied_event_id: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class AccountProjectionRecord(ProjectionBase):
    __tablename__ = "accounts"

    account_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    initial_balance: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class CardProjectionRecord(ProjectionBase):
    __tablename__ = "cards"

    card_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    limit: Mapped[int] = mapped_column(Integer, nullable=False)
    closing_day: Mapped[int] = mapped_column(Integer, nullable=False)
    due_day: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_account_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class CardPurchaseProjectionRecord(ProjectionBase):
    __tablename__ = "card_purchases"

    purchase_id: Mapped[str] = mapped_column(String, primary_key=True)
    purchase_date: Mapped[str] = mapped_column(String, nullable=False, index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    category_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    card_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    installments_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    invoice_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    reference_month: Mapped[str] = mapped_column(String, nullable=False, index=True)
    closing_date: Mapped[str] = mapped_column(String, nullable=False)
    due_date: Mapped[str] = mapped_column(String, nullable=False)


class CardPurchaseInstallmentRecord(ProjectionBase):
    __tablename__ = "card_purchase_installments"

    installment_id: Mapped[str] = mapped_column(String, primary_key=True)
    purchase_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    card_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    purchase_date: Mapped[str] = mapped_column(String, nullable=False, index=True)
    category_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    installment_number: Mapped[int] = mapped_column(Integer, nullable=False)
    installments_count: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    invoice_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    reference_month: Mapped[str] = mapped_column(String, nullable=False, index=True)
    closing_date: Mapped[str] = mapped_column(String, nullable=False)
    due_date: Mapped[str] = mapped_column(String, nullable=False)


class InvoiceProjectionRecord(ProjectionBase):
    __tablename__ = "invoices"

    invoice_id: Mapped[str] = mapped_column(String, primary_key=True)
    card_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    reference_month: Mapped[str] = mapped_column(String, nullable=False, index=True)
    closing_date: Mapped[str] = mapped_column(String, nullable=False)
    due_date: Mapped[str] = mapped_column(String, nullable=False)
    total_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    paid_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    remaining_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    purchase_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="open")


class BalanceStateRecord(ProjectionBase):
    __tablename__ = "balance_state"

    account_id: Mapped[str] = mapped_column(String, primary_key=True)
    current_balance: Mapped[int] = mapped_column(Integer, nullable=False)


class TransactionProjectionRecord(ProjectionBase):
    __tablename__ = "transactions"

    transaction_id: Mapped[str] = mapped_column(String, primary_key=True)
    occurred_at: Mapped[str] = mapped_column(String, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    account_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    payment_method: Mapped[str] = mapped_column(String, nullable=False, index=True)
    category_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    person_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    transfer_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    direction: Mapped[str | None] = mapped_column(String, nullable=True)


class ReimbursementProjectionRecord(ProjectionBase):
    __tablename__ = "reimbursements"

    transaction_id: Mapped[str] = mapped_column(String, primary_key=True)
    person_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, index=True, default="pending")
    account_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    occurred_at: Mapped[str] = mapped_column(String, nullable=False, index=True)
    received_at: Mapped[str | None] = mapped_column(String, nullable=True)
    receipt_transaction_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)


class RecurringRuleProjectionRecord(ProjectionBase):
    __tablename__ = "recurring_rules"

    rule_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    due_day: Mapped[int] = mapped_column(Integer, nullable=False)
    account_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    payment_method: Mapped[str] = mapped_column(String, nullable=False)
    category_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class PendingProjectionRecord(ProjectionBase):
    __tablename__ = "pendings"

    pending_id: Mapped[str] = mapped_column(String, primary_key=True)
    rule_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    month: Mapped[str] = mapped_column(String, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    due_date: Mapped[str] = mapped_column(String, nullable=False, index=True)
    account_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    payment_method: Mapped[str] = mapped_column(String, nullable=False)
    category_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, index=True, default="pending")
    transaction_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    confirmed_at: Mapped[str | None] = mapped_column(String, nullable=True)


class BudgetLimitRecord(ProjectionBase):
    __tablename__ = "budgets"

    category_id: Mapped[str] = mapped_column(String, primary_key=True)
    month: Mapped[str] = mapped_column(String, primary_key=True)
    limit: Mapped[int] = mapped_column(Integer, nullable=False)


class InvestmentMovementRecord(ProjectionBase):
    __tablename__ = "investment_movements"

    movement_id: Mapped[str] = mapped_column(String, primary_key=True)
    occurred_at: Mapped[str] = mapped_column(String, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    account_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    contribution_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dividend_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cash_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    invested_amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cash_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    invested_delta: Mapped[int] = mapped_column(Integer, nullable=False)


class Projector:
    def __init__(
        self,
        event_database_url: str | None = None,
        projection_database_url: str | None = None,
    ) -> None:
        self._event_store = EventStore(database_url=event_database_url)
        self._engine = get_engine(projection_database_url)
        self._lock = RLock()
        self._session_factory = sessionmaker(
            bind=self._engine,
            autoflush=False,
            autocommit=False,
        )

    def bootstrap(self) -> None:
        with self._lock:
            if self._projection_schema_requires_rebuild():
                ProjectionBase.metadata.drop_all(self._engine)

            ProjectionBase.metadata.create_all(self._engine)
            with self._session_factory.begin() as session:
                cursor = session.get(EventCursorRecord, 1)
                if cursor is None:
                    session.add(EventCursorRecord(singleton_id=1, last_applied_event_id=0))

    def run(self) -> int:
        with self._lock:
            self.bootstrap()
            last_applied_event_id = self.get_last_applied_event_id()
            events = self._event_store.list_events_after(last_applied_event_id)

            if not events:
                return 0

            with self._session_factory.begin() as session:
                cursor = session.get(EventCursorRecord, 1)
                assert cursor is not None

                for event in events:
                    self._apply_event(session, event)
                    session.flush()
                    cursor.last_applied_event_id = event.event_id

            return len(events)

    def rebuild(self) -> int:
        with self._lock:
            ProjectionBase.metadata.drop_all(self._engine)
            self.bootstrap()
            return self.run()

    def reset(self) -> None:
        with self._lock:
            ProjectionBase.metadata.drop_all(self._engine)
            self.bootstrap()

    def get_last_applied_event_id(self) -> int:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                cursor = session.get(EventCursorRecord, 1)
                assert cursor is not None
                return cursor.last_applied_event_id

    def list_accounts(self) -> list[dict[str, str | int | bool]]:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                rows = (
                    session.query(AccountProjectionRecord)
                    .order_by(AccountProjectionRecord.account_id.asc())
                    .all()
                )

        return [
            AccountProjection(
                account_id=row.account_id,
                name=row.name,
                type=row.type,
                initial_balance=row.initial_balance,
                is_active=row.is_active,
            ).to_dict()
            for row in rows
        ]

    def list_cards(self) -> list[dict[str, str | int | bool]]:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                rows = (
                    session.query(CardProjectionRecord)
                    .order_by(CardProjectionRecord.card_id.asc())
                    .all()
                )

        return [
            CardProjection(
                card_id=row.card_id,
                name=row.name,
                limit=row.limit,
                closing_day=row.closing_day,
                due_day=row.due_day,
                payment_account_id=row.payment_account_id,
                is_active=row.is_active,
            ).to_dict()
            for row in rows
        ]

    def list_card_purchases(
        self,
        *,
        card_id: str | None = None,
    ) -> list[dict[str, str | int | None]]:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                query = session.query(CardPurchaseProjectionRecord)
                if card_id is not None:
                    query = query.filter(CardPurchaseProjectionRecord.card_id == card_id)

                rows = (
                    query.order_by(
                        CardPurchaseProjectionRecord.purchase_date.desc(),
                        CardPurchaseProjectionRecord.purchase_id.desc(),
                    )
                    .all()
                )

        return [
            CardPurchaseProjection(
                purchase_id=row.purchase_id,
                purchase_date=row.purchase_date,
                amount=row.amount,
                category_id=row.category_id,
                card_id=row.card_id,
                description=row.description,
                installments_count=row.installments_count,
                invoice_id=row.invoice_id,
                reference_month=row.reference_month,
                closing_date=row.closing_date,
                due_date=row.due_date,
            ).to_dict()
            for row in rows
        ]

    def list_invoices(
        self,
        *,
        card_id: str | None = None,
    ) -> list[dict[str, str | int]]:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                query = session.query(InvoiceProjectionRecord)
                if card_id is not None:
                    query = query.filter(InvoiceProjectionRecord.card_id == card_id)

                rows = (
                    query.order_by(
                        InvoiceProjectionRecord.reference_month.desc(),
                        InvoiceProjectionRecord.invoice_id.desc(),
                    )
                    .all()
                )

        return [
            InvoiceProjection(
                invoice_id=row.invoice_id,
                card_id=row.card_id,
                reference_month=row.reference_month,
                closing_date=row.closing_date,
                due_date=row.due_date,
                total_amount=row.total_amount,
                paid_amount=row.paid_amount,
                remaining_amount=row.remaining_amount,
                purchase_count=row.purchase_count,
                status=row.status,
            ).to_dict()
            for row in rows
        ]

    def list_invoice_items(
        self,
        *,
        invoice_id: str,
    ) -> list[dict[str, str | int | None]]:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                rows = (
                    session.query(CardPurchaseInstallmentRecord)
                    .filter(CardPurchaseInstallmentRecord.invoice_id == invoice_id)
                    .order_by(
                        CardPurchaseInstallmentRecord.purchase_date.desc(),
                        CardPurchaseInstallmentRecord.installment_id.desc(),
                    )
                    .all()
                )

                descriptions = {
                    row.purchase_id: row.description
                    for row in (
                        session.query(CardPurchaseProjectionRecord)
                        .filter(
                            CardPurchaseProjectionRecord.purchase_id.in_(
                                [item.purchase_id for item in rows]
                            )
                        )
                        .all()
                    )
                }

        return [
            InvoiceItemProjection(
                invoice_item_id=row.installment_id,
                invoice_id=row.invoice_id,
                purchase_id=row.purchase_id,
                card_id=row.card_id,
                purchase_date=row.purchase_date,
                category_id=row.category_id,
                description=descriptions.get(row.purchase_id),
                installment_number=row.installment_number,
                installments_count=row.installments_count,
                amount=row.amount,
            ).to_dict()
            for row in rows
        ]

    def list_balance_states(self) -> list[dict[str, str | int]]:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                rows = (
                    session.query(BalanceStateRecord)
                    .order_by(BalanceStateRecord.account_id.asc())
                    .all()
                )

        return [
            BalanceStateProjection(
                account_id=row.account_id,
                current_balance=row.current_balance,
            ).to_dict()
            for row in rows
        ]

    def list_transactions(
        self,
        *,
        occurred_from: str | None = None,
        occurred_to: str | None = None,
        transaction_type: str | None = None,
        category_id: str | None = None,
        account_id: str | None = None,
        card_id: str | None = None,
        payment_method: str | None = None,
        person_id: str | None = None,
        text: str | None = None,
        include_ledger: bool = False,
    ) -> list[dict[str, str | int | None]]:
        card_purchase_ledger_rows: list[dict[str, str | int | None]] = []
        investment_ledger_rows: list[dict[str, str | int | None]] = []

        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                query = session.query(TransactionProjectionRecord)

                if occurred_from is not None:
                    query = query.filter(TransactionProjectionRecord.occurred_at >= occurred_from)
                if occurred_to is not None:
                    query = query.filter(TransactionProjectionRecord.occurred_at <= occurred_to)
                query = self._apply_transaction_filters(
                    query,
                    transaction_type=transaction_type,
                    category_id=category_id,
                    account_id=account_id,
                    card_id=card_id,
                    payment_method=payment_method,
                    person_id=person_id,
                    text=text,
                )

                rows = (
                    query.order_by(
                        TransactionProjectionRecord.occurred_at.desc(),
                        TransactionProjectionRecord.transaction_id.desc(),
                    )
                    .all()
                )

                if include_ledger:
                    card_purchase_ledger_rows = self._list_card_purchases_for_ledger(
                        session,
                        occurred_from=occurred_from,
                        occurred_to=occurred_to,
                        transaction_type=transaction_type,
                        category_id=category_id,
                        account_id=account_id,
                        card_id=card_id,
                        payment_method=payment_method,
                        person_id=person_id,
                        text=text,
                    )
                    investment_ledger_rows = self._list_investment_movements_for_ledger(
                        session,
                        occurred_from=occurred_from,
                        occurred_to=occurred_to,
                        transaction_type=transaction_type,
                        category_id=category_id,
                        account_id=account_id,
                        card_id=card_id,
                        payment_method=payment_method,
                        person_id=person_id,
                        text=text,
                    )

        transactions = [
            TransactionProjection(
                transaction_id=row.transaction_id,
                occurred_at=row.occurred_at,
                type=row.type,
                amount=row.amount,
                account_id=row.account_id,
                payment_method=row.payment_method,
                category_id=row.category_id,
                description=row.description,
                person_id=row.person_id,
                status=row.status,
                transfer_id=row.transfer_id,
                direction=row.direction,
            ).to_dict()
            for row in rows
        ]

        if not include_ledger:
            return transactions

        ledger_transactions = transactions + card_purchase_ledger_rows + investment_ledger_rows
        for item in ledger_transactions:
            if item.get("ledger_event_type") is not None:
                continue
            (
                item["ledger_event_type"],
                item["ledger_source"],
                item["ledger_destination"],
            ) = self._ledger_projection_for_transaction(item)

        ledger_transactions.sort(
            key=lambda item: (
                str(item.get("occurred_at") or ""),
                str(item.get("transaction_id") or ""),
            ),
            reverse=True,
        )

        return ledger_transactions

    def get_report_summary(
        self,
        *,
        occurred_from: str,
        occurred_to: str,
        category_id: str | None = None,
        account_id: str | None = None,
        card_id: str | None = None,
        payment_method: str | None = None,
        person_id: str | None = None,
        text: str | None = None,
    ) -> dict[str, object]:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                transaction_query = (
                    session.query(TransactionProjectionRecord)
                    .filter(TransactionProjectionRecord.status == "active")
                    .filter(TransactionProjectionRecord.occurred_at >= occurred_from)
                    .filter(TransactionProjectionRecord.occurred_at <= occurred_to)
                )
                transaction_query = self._apply_transaction_filters(
                    transaction_query,
                    category_id=category_id,
                    account_id=account_id,
                    card_id=card_id,
                    payment_method=payment_method,
                    person_id=person_id,
                    text=text,
                )
                transaction_rows: Sequence[TransactionProjectionRecord] = (
                    transaction_query.order_by(
                        TransactionProjectionRecord.occurred_at.asc(),
                        TransactionProjectionRecord.transaction_id.asc(),
                    )
                    .all()
                )
                period_installment_rows = self._list_installments_for_report(
                    session,
                    due_from_timestamp=occurred_from,
                    due_to_timestamp=occurred_to,
                    category_id=category_id,
                    account_id=account_id,
                    card_id=card_id,
                    payment_method=payment_method,
                    person_id=person_id,
                    text=text,
                )
                future_installment_rows = self._list_installments_for_report(
                    session,
                    due_after_timestamp=occurred_to,
                    category_id=category_id,
                    account_id=account_id,
                    card_id=card_id,
                    payment_method=payment_method,
                    person_id=person_id,
                    text=text,
                )

        income_total = sum(
            row.amount for row in transaction_rows if row.type == "income"
        )
        expense_from_transactions = sum(
            row.amount
            for row in transaction_rows
            if row.type == "expense" and row.category_id != "invoice_payment"
        )
        period_installment_impact_total = sum(
            row.amount for row in period_installment_rows
        )
        expense_total = expense_from_transactions + period_installment_impact_total
        net_total = income_total - expense_total

        category_totals: dict[str, int] = {}
        for row in transaction_rows:
            if row.type != "expense" or row.category_id == "invoice_payment":
                continue
            category_totals[row.category_id] = (
                category_totals.get(row.category_id, 0) + row.amount
            )
        for row in period_installment_rows:
            category_totals[row.category_id] = (
                category_totals.get(row.category_id, 0) + row.amount
            )
        category_breakdown = sorted(
            [
                {
                    "category_id": category_name,
                    "total": total,
                }
                for category_name, total in category_totals.items()
            ],
            key=lambda item: item["total"],
            reverse=True,
        )

        weekly_trend = self._build_weekly_trend(
            occurred_from=occurred_from,
            occurred_to=occurred_to,
            transaction_rows=transaction_rows,
            period_installment_rows=period_installment_rows,
        )

        future_by_month: dict[str, int] = {}
        for row in future_installment_rows:
            future_by_month[row.reference_month] = (
                future_by_month.get(row.reference_month, 0) + row.amount
            )
        future_installment_months = [
            {"month": month, "total": total}
            for month, total in sorted(future_by_month.items(), key=lambda item: item[0])
        ]

        return {
            "totals": {
                "income_total": income_total,
                "expense_total": expense_total,
                "net_total": net_total,
            },
            "category_breakdown": category_breakdown,
            "weekly_trend": weekly_trend,
            "future_commitments": {
                "period_installment_impact_total": period_installment_impact_total,
                "future_installment_total": sum(
                    row.amount for row in future_installment_rows
                ),
                "future_installment_months": future_installment_months,
            },
        }

    def list_reimbursements(
        self,
        *,
        status: str | None = None,
        person_id: str | None = None,
    ) -> list[dict[str, str | int | None]]:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                query = session.query(ReimbursementProjectionRecord)
                if status is not None:
                    query = query.filter(ReimbursementProjectionRecord.status == status)
                if person_id is not None:
                    query = query.filter(ReimbursementProjectionRecord.person_id == person_id)

                rows = (
                    query.order_by(
                        ReimbursementProjectionRecord.occurred_at.desc(),
                        ReimbursementProjectionRecord.transaction_id.desc(),
                    )
                    .all()
                )

        return [
            ReimbursementProjection(
                transaction_id=row.transaction_id,
                person_id=row.person_id,
                amount=row.amount,
                status=row.status,
                account_id=row.account_id,
                occurred_at=row.occurred_at,
                received_at=row.received_at,
                receipt_transaction_id=row.receipt_transaction_id,
            ).to_dict()
            for row in rows
        ]

    def list_investment_movements(
        self,
        *,
        occurred_from: str | None = None,
        occurred_to: str | None = None,
    ) -> list[dict[str, str | int | None]]:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                query = session.query(InvestmentMovementRecord)
                if occurred_from is not None:
                    query = query.filter(InvestmentMovementRecord.occurred_at >= occurred_from)
                if occurred_to is not None:
                    query = query.filter(InvestmentMovementRecord.occurred_at <= occurred_to)

                rows = (
                    query.order_by(
                        InvestmentMovementRecord.occurred_at.desc(),
                        InvestmentMovementRecord.movement_id.desc(),
                    )
                    .all()
                )

        return [
            InvestmentMovementProjection(
                movement_id=row.movement_id,
                occurred_at=row.occurred_at,
                type=row.type,
                account_id=row.account_id,
                description=row.description,
                contribution_amount=row.contribution_amount,
                dividend_amount=row.dividend_amount,
                cash_amount=row.cash_amount,
                invested_amount=row.invested_amount,
                cash_delta=row.cash_delta,
                invested_delta=row.invested_delta,
            ).to_dict()
            for row in rows
        ]

    def get_investment_overview(
        self,
        *,
        view: str,
        occurred_from: str,
        occurred_to: str,
    ) -> dict[str, object]:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                movements_in_range: Sequence[InvestmentMovementRecord] = (
                    session.query(InvestmentMovementRecord)
                    .filter(InvestmentMovementRecord.occurred_at >= occurred_from)
                    .filter(InvestmentMovementRecord.occurred_at <= occurred_to)
                    .order_by(
                        InvestmentMovementRecord.occurred_at.asc(),
                        InvestmentMovementRecord.movement_id.asc(),
                    )
                    .all()
                )
                movements_after_from: Sequence[InvestmentMovementRecord] = (
                    session.query(InvestmentMovementRecord)
                    .filter(InvestmentMovementRecord.occurred_at >= occurred_from)
                    .all()
                )
                movement_rows_all: Sequence[InvestmentMovementRecord] = (
                    session.query(InvestmentMovementRecord).all()
                )
                account_type_by_id = {
                    row.account_id: row.type
                    for row in session.query(AccountProjectionRecord).all()
                }
                current_cash_balance = int(
                    session.query(func.coalesce(func.sum(BalanceStateRecord.current_balance), 0))
                    .join(
                        AccountProjectionRecord,
                        AccountProjectionRecord.account_id == BalanceStateRecord.account_id,
                    )
                    .filter(AccountProjectionRecord.type != "investment")
                    .scalar()
                    or 0
                )
                current_invested_balance = sum(
                    row.invested_delta for row in movement_rows_all
                )
                current_dividends_accumulated = sum(
                    row.dividend_amount for row in movement_rows_all
                )
                tx_after_from: Sequence[TransactionProjectionRecord] = (
                    session.query(TransactionProjectionRecord)
                    .filter(TransactionProjectionRecord.status == "active")
                    .filter(TransactionProjectionRecord.occurred_at >= occurred_from)
                    .all()
                )
                tx_in_range: Sequence[TransactionProjectionRecord] = (
                    session.query(TransactionProjectionRecord)
                    .filter(TransactionProjectionRecord.status == "active")
                    .filter(TransactionProjectionRecord.occurred_at >= occurred_from)
                    .filter(TransactionProjectionRecord.occurred_at <= occurred_to)
                    .all()
                )

                movement_cash_after_from = sum(
                    row.cash_delta for row in movements_after_from
                )
                movement_invested_after_from = sum(
                    row.invested_delta for row in movements_after_from
                )
                cash_after_from_from_transactions = sum(
                    self._signed_amount(
                        transaction_type=row.type,
                        amount=row.amount,
                        status=row.status,
                        direction=row.direction,
                    )
                    for row in tx_after_from
                    if account_type_by_id.get(row.account_id) != "investment"
                )
                cash_baseline = (
                    current_cash_balance
                    - movement_cash_after_from
                    - cash_after_from_from_transactions
                )
                invested_baseline = current_invested_balance - movement_invested_after_from

                income_by_month = self._income_totals_by_month(session=session)

        contribution_total = sum(row.contribution_amount for row in movements_in_range)
        dividend_total = sum(row.dividend_amount for row in movements_in_range)
        withdrawal_total = sum(
            row.cash_amount for row in movements_in_range if row.type == "withdrawal"
        )
        bucket_keys = self._bucket_keys_for_range(
            view=view,
            occurred_from=occurred_from,
            occurred_to=occurred_to,
        )
        transaction_cash_by_bucket = {
            key: 0 for key in bucket_keys
        }
        for row in tx_in_range:
            if account_type_by_id.get(row.account_id) == "investment":
                continue
            bucket = self._bucket_key(view=view, occurred_at=row.occurred_at)
            if bucket not in transaction_cash_by_bucket:
                continue
            transaction_cash_by_bucket[bucket] += self._signed_amount(
                transaction_type=row.type,
                amount=row.amount,
                status=row.status,
                direction=row.direction,
            )
        movement_cash_by_bucket = {key: 0 for key in bucket_keys}
        movement_invested_by_bucket = {key: 0 for key in bucket_keys}
        contribution_by_bucket = {key: 0 for key in bucket_keys}
        dividend_by_bucket = {key: 0 for key in bucket_keys}
        withdrawal_by_bucket = {key: 0 for key in bucket_keys}
        for row in movements_in_range:
            bucket = self._bucket_key(view=view, occurred_at=row.occurred_at)
            if bucket not in movement_cash_by_bucket:
                continue
            movement_cash_by_bucket[bucket] += row.cash_delta
            movement_invested_by_bucket[bucket] += row.invested_delta
            contribution_by_bucket[bucket] += row.contribution_amount
            dividend_by_bucket[bucket] += row.dividend_amount
            if row.type == "withdrawal":
                withdrawal_by_bucket[bucket] += row.cash_amount

        running_cash = cash_baseline
        running_invested = invested_baseline
        wealth_series: list[dict[str, int | str]] = []
        trend_series: list[dict[str, int | str]] = []
        for bucket in bucket_keys:
            running_cash += transaction_cash_by_bucket[bucket] + movement_cash_by_bucket[bucket]
            running_invested += movement_invested_by_bucket[bucket]
            wealth_series.append(
                {
                    "bucket": bucket,
                    "cash_balance": running_cash,
                    "invested_balance": running_invested,
                    "wealth": running_cash + running_invested,
                }
            )
            trend_series.append(
                {
                    "bucket": bucket,
                    "contribution_total": contribution_by_bucket[bucket],
                    "dividend_total": dividend_by_bucket[bucket],
                    "withdrawal_total": withdrawal_by_bucket[bucket],
                }
            )

        range_end_cash_balance = running_cash
        range_end_invested_balance = running_invested
        monthly_income_total = self._income_total_for_range(
            income_by_month=income_by_month,
            occurred_from=occurred_from,
            occurred_to=occurred_to,
        )
        target = investment_goal_target(monthly_income_total=monthly_income_total)
        realized = contribution_total + dividend_total

        return {
            "view": view,
            "from": occurred_from,
            "to": occurred_to,
            "totals": {
                "contribution_total": contribution_total,
                "dividend_total": dividend_total,
                "withdrawal_total": withdrawal_total,
                "invested_balance": range_end_invested_balance,
                "cash_balance": range_end_cash_balance,
                "wealth": range_end_cash_balance + range_end_invested_balance,
                "dividends_accumulated": current_dividends_accumulated,
            },
            "goal": {
                "target": target,
                "realized": realized,
                "remaining": max(target - realized, 0),
                "progress_percent": (
                    100 if target <= 0 else min(int(round((realized * 100) / target)), 100)
                ),
            },
            "series": {
                "wealth_evolution": wealth_series,
                "contribution_dividend_trend": trend_series,
            },
        }

    def list_recurring_rules(
        self,
        *,
        is_active: bool | None = None,
    ) -> list[dict[str, str | int | bool | None]]:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                query = session.query(RecurringRuleProjectionRecord)
                if is_active is not None:
                    query = query.filter(RecurringRuleProjectionRecord.is_active == is_active)

                rows = query.order_by(RecurringRuleProjectionRecord.rule_id.asc()).all()

        return [
            RecurringRuleProjection(
                rule_id=row.rule_id,
                name=row.name,
                amount=row.amount,
                due_day=row.due_day,
                account_id=row.account_id,
                payment_method=row.payment_method,
                category_id=row.category_id,
                description=row.description,
                is_active=row.is_active,
            ).to_dict()
            for row in rows
        ]

    def list_pendings(
        self,
        *,
        month: str,
    ) -> list[dict[str, str | int | None]]:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                rows = (
                    session.query(PendingProjectionRecord)
                    .filter(PendingProjectionRecord.month == month)
                    .order_by(
                        PendingProjectionRecord.due_date.asc(),
                        PendingProjectionRecord.pending_id.asc(),
                    )
                    .all()
                )
                pendings = [self._pending_to_dict(row) for row in rows]

        return pendings

    def list_category_budgets(
        self,
        *,
        month: str,
    ) -> list[dict[str, str | int]]:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                return self._list_category_budgets_for_month(session, month)

    def get_pending(self, pending_id: str) -> dict[str, str | int | None] | None:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                row = session.get(PendingProjectionRecord, pending_id)
                if row is None:
                    return None

                return self._pending_to_dict(row)

    def materialize_month_pendings(self, *, month: str) -> None:
        with self._lock:
            self.bootstrap()
            with self._session_factory.begin() as session:
                self._ensure_month_pendings(session, month=month)
                session.flush()

    def get_dashboard_summary(self, *, month: str) -> dict[str, object]:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                month_rows: Sequence[TransactionProjectionRecord] = (
                    session.query(TransactionProjectionRecord)
                    .filter(TransactionProjectionRecord.occurred_at.like(f"{month}-%"))
                    .filter(TransactionProjectionRecord.status == "active")
                    .order_by(
                        TransactionProjectionRecord.occurred_at.desc(),
                        TransactionProjectionRecord.transaction_id.desc(),
                    )
                    .all()
                )
                recent_rows = month_rows[:10]
                balance_total = (
                    session.query(func.coalesce(func.sum(BalanceStateRecord.current_balance), 0))
                    .scalar()
                )

                # Previous month data for delta comparison
                prev_month = self._previous_month_key(month)
                prev_rows: Sequence[TransactionProjectionRecord] = (
                    session.query(TransactionProjectionRecord)
                    .filter(TransactionProjectionRecord.occurred_at.like(f"{prev_month}-%"))
                    .filter(TransactionProjectionRecord.status == "active")
                    .all()
                )

                # Review queue: transactions missing description or with placeholder category
                review_rows: Sequence[TransactionProjectionRecord] = (
                    session.query(TransactionProjectionRecord)
                    .filter(TransactionProjectionRecord.occurred_at.like(f"{month}-%"))
                    .filter(TransactionProjectionRecord.status == "active")
                    .filter(TransactionProjectionRecord.type != "transfer")
                    .order_by(TransactionProjectionRecord.occurred_at.desc())
                    .all()
                )
                installment_rows: Sequence[CardPurchaseInstallmentRecord] = (
                    session.query(CardPurchaseInstallmentRecord)
                    .filter(CardPurchaseInstallmentRecord.reference_month == month)
                    .order_by(
                        CardPurchaseInstallmentRecord.installment_id.asc(),
                    )
                    .all()
                )
                pending_reimbursement_rows: Sequence[ReimbursementProjectionRecord] = (
                    session.query(ReimbursementProjectionRecord)
                    .filter(ReimbursementProjectionRecord.status == "pending")
                    .order_by(ReimbursementProjectionRecord.occurred_at.desc())
                    .all()
                )
                category_budgets = self._list_category_budgets_for_month(session, month)

        recent_transactions = [
            TransactionProjection(
                transaction_id=row.transaction_id,
                occurred_at=row.occurred_at,
                type=row.type,
                amount=row.amount,
                account_id=row.account_id,
                payment_method=row.payment_method,
                category_id=row.category_id,
                description=row.description,
                person_id=row.person_id,
                status=row.status,
                transfer_id=row.transfer_id,
                direction=row.direction,
            ).to_dict()
            for row in recent_rows
        ]
        total_income = sum(
            row.amount for row in month_rows if row.type == "income"
        )
        total_expense = sum(
            row.amount for row in month_rows if row.type == "expense"
        )

        # Spending by category (expenses only, excluding transfers)
        category_totals: dict[str, int] = {}
        for row in month_rows:
            if row.type == "expense":
                category_totals[row.category_id] = (
                    category_totals.get(row.category_id, 0) + row.amount
                )
        for row in installment_rows:
            category_totals[row.category_id] = (
                category_totals.get(row.category_id, 0) + row.amount
            )
        spending_by_category = sorted(
            [{"category_id": cat, "total": total} for cat, total in category_totals.items()],
            key=lambda item: item["total"],
            reverse=True,
        )

        # Previous month totals
        prev_income = sum(row.amount for row in prev_rows if row.type == "income")
        prev_expense = sum(row.amount for row in prev_rows if row.type == "expense")

        # Daily balance series (cumulative running total for sparkline)
        daily_map: dict[str, int] = {}
        for row in month_rows:
            if row.type == "transfer":
                continue
            day = row.occurred_at[:10]
            delta = row.amount if row.type == "income" else -row.amount
            daily_map[day] = daily_map.get(day, 0) + delta
        running = 0
        daily_balance_series = []
        for day in sorted(daily_map.keys()):
            running += daily_map[day]
            daily_balance_series.append({"date": day, "balance": running})

        review_queue = [
            TransactionProjection(
                transaction_id=row.transaction_id,
                occurred_at=row.occurred_at,
                type=row.type,
                amount=row.amount,
                account_id=row.account_id,
                payment_method=row.payment_method,
                category_id=row.category_id,
                description=row.description,
                person_id=row.person_id,
                status=row.status,
                transfer_id=row.transfer_id,
                direction=row.direction,
            ).to_dict()
            for row in review_rows
            if requires_review(description=row.description)
        ]
        pending_reimbursements = [
            ReimbursementProjection(
                transaction_id=row.transaction_id,
                person_id=row.person_id,
                amount=row.amount,
                status=row.status,
                account_id=row.account_id,
                occurred_at=row.occurred_at,
                received_at=row.received_at,
                receipt_transaction_id=row.receipt_transaction_id,
            ).to_dict()
            for row in pending_reimbursement_rows
        ]
        budget_alerts = [
            budget for budget in category_budgets if str(budget["status"]) != "ok"
        ]

        return {
            "month": month,
            "total_income": total_income,
            "total_expense": total_expense,
            "net_flow": total_income - total_expense,
            "current_balance": int(balance_total or 0),
            "pending_reimbursements_total": sum(
                reimbursement["amount"] for reimbursement in pending_reimbursements
            ),
            "pending_reimbursements": pending_reimbursements,
            "recent_transactions": recent_transactions,
            "spending_by_category": spending_by_category,
            "previous_month": {
                "total_income": prev_income,
                "total_expense": prev_expense,
                "net_flow": prev_income - prev_expense,
            },
            "daily_balance_series": daily_balance_series,
            "review_queue": review_queue,
            "category_budgets": category_budgets,
            "budget_alerts": budget_alerts,
        }

    def _list_category_budgets_for_month(
        self,
        session: Session,
        month: str,
    ) -> list[dict[str, str | int]]:
        rows: Sequence[BudgetLimitRecord] = (
            session.query(BudgetLimitRecord)
            .filter(BudgetLimitRecord.month == month)
            .order_by(BudgetLimitRecord.category_id.asc())
            .all()
        )
        if not rows:
            return []

        categories = {row.category_id for row in rows}
        spending_by_category = self._budget_spending_by_category(
            session=session,
            month=month,
            categories=categories,
        )

        return [
            BudgetProjection(
                category_id=row.category_id,
                month=row.month,
                limit=row.limit,
                spent=spending_by_category.get(row.category_id, 0),
                usage_percent=self._budget_usage_percent(
                    spent=spending_by_category.get(row.category_id, 0),
                    limit=row.limit,
                ),
                status=self._budget_status(
                    spent=spending_by_category.get(row.category_id, 0),
                    limit=row.limit,
                ),
            ).to_dict()
            for row in rows
        ]

    def _budget_spending_by_category(
        self,
        *,
        session: Session,
        month: str,
        categories: set[str],
    ) -> dict[str, int]:
        totals = {category: 0 for category in categories}

        expense_rows: Sequence[TransactionProjectionRecord] = (
            session.query(TransactionProjectionRecord)
            .filter(TransactionProjectionRecord.occurred_at.like(f"{month}-%"))
            .filter(TransactionProjectionRecord.status == "active")
            .filter(TransactionProjectionRecord.type == "expense")
            .filter(TransactionProjectionRecord.category_id != "invoice_payment")
            .filter(TransactionProjectionRecord.category_id.in_(categories))
            .all()
        )
        for row in expense_rows:
            totals[row.category_id] = totals.get(row.category_id, 0) + row.amount

        installment_rows: Sequence[CardPurchaseInstallmentRecord] = (
            session.query(CardPurchaseInstallmentRecord)
            .filter(CardPurchaseInstallmentRecord.category_id.in_(categories))
            .all()
        )
        for row in installment_rows:
            installment_month = self._budget_month_for_installment(
                purchase_date=row.purchase_date,
                installment_number=row.installment_number,
            )
            if installment_month != month:
                continue
            totals[row.category_id] = totals.get(row.category_id, 0) + row.amount

        return totals

    def _budget_month_for_installment(
        self,
        *,
        purchase_date: str,
        installment_number: int,
    ) -> str:
        purchase = datetime.fromisoformat(purchase_date.replace("Z", "+00:00"))
        month_index = (
            purchase.year * 12
            + (purchase.month - 1)
            + max(installment_number - 1, 0)
        )
        year = month_index // 12
        month = (month_index % 12) + 1
        return f"{year:04d}-{month:02d}"

    def _budget_usage_percent(self, *, spent: int, limit: int) -> int:
        if limit <= 0:
            return 0
        return int(round((spent * 100) / limit))

    def _budget_status(self, *, spent: int, limit: int) -> str:
        return domain_budget_status(spent=spent, limit=limit)

    @staticmethod
    def _previous_month_key(month: str) -> str:
        year, mon = int(month[:4]), int(month[5:7])
        if mon == 1:
            return f"{year - 1}-12"
        return f"{year}-{mon - 1:02d}"

    def _apply_event(self, session: Session, event: StoredEvent) -> None:
        if event.type == "AccountCreated":
            self._apply_account_created(session, event.payload)
            return

        if event.type == "AccountUpdated":
            self._apply_account_updated(session, event.payload)
            return

        if event.type == "CardCreated":
            self._apply_card_created(session, event.payload)
            return

        if event.type == "CardUpdated":
            self._apply_card_updated(session, event.payload)
            return

        if event.type == "CardPurchaseCreated":
            self._apply_card_purchase_created(session, event.payload)
            return

        if event.type == "RecurringRuleCreated":
            self._apply_recurring_rule_created(session, event.payload)
            return

        if event.type == "BudgetUpdated":
            self._apply_budget_updated(session, event.payload)
            return

        if event.type == "InvestmentMovementRecorded":
            self._apply_investment_movement_recorded(session, event.payload)
            return

        if event.type == "InvoicePaid":
            self._apply_invoice_paid(session, event.payload)
            return

        if event.type in {"IncomeCreated", "ExpenseCreated"}:
            self._apply_transaction_created(session, event.payload)
            return

        if event.type == "TransactionUpdated":
            self._apply_transaction_updated(session, event.payload)
            return

        if event.type == "TransactionVoided":
            self._apply_transaction_voided(session, event.payload)
            return

        if event.type == "ReimbursementReceived":
            self._apply_reimbursement_received(session, event.payload)
            return

        if event.type == "PendingConfirmed":
            self._apply_pending_confirmed(session, event.payload)
            return

        if event.type == "TransferCreated":
            self._apply_transfer_created(session, event.payload)

    def _apply_account_created(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        account_id = str(payload["id"])
        existing = session.get(AccountProjectionRecord, account_id)

        if existing is None:
            session.add(
                AccountProjectionRecord(
                    account_id=account_id,
                    name=str(payload["name"]),
                    type=str(payload["type"]),
                    initial_balance=int(payload["initial_balance"]),
                    is_active=bool(payload.get("is_active", True)),
                )
            )

        balance = session.get(BalanceStateRecord, account_id)
        if balance is None:
            session.add(
                BalanceStateRecord(
                    account_id=account_id,
                    current_balance=int(payload["initial_balance"]),
                )
            )

    def _apply_account_updated(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        account_id = str(payload["id"])
        existing = session.get(AccountProjectionRecord, account_id)

        if existing is None:
            return

        existing.name = str(payload["name"])
        existing.type = str(payload["type"])
        existing.initial_balance = int(payload["initial_balance"])
        existing.is_active = bool(payload.get("is_active", True))

        balance = session.get(BalanceStateRecord, account_id)
        if balance is None:
            session.add(
                BalanceStateRecord(
                    account_id=account_id,
                    current_balance=int(payload["initial_balance"]),
                )
            )
            return

        balance.current_balance = int(payload["initial_balance"])

    def _apply_card_created(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        card_id = str(payload["id"])
        existing = session.get(CardProjectionRecord, card_id)

        if existing is not None:
            return

        session.add(
            CardProjectionRecord(
                card_id=card_id,
                name=str(payload["name"]),
                limit=int(payload["limit"]),
                closing_day=int(payload["closing_day"]),
                due_day=int(payload["due_day"]),
                payment_account_id=str(payload["payment_account_id"]),
                is_active=bool(payload.get("is_active", True)),
            )
        )

    def _apply_card_updated(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        card_id = str(payload["id"])
        existing = session.get(CardProjectionRecord, card_id)

        if existing is None:
            return

        existing.name = str(payload["name"])
        existing.limit = int(payload["limit"])
        existing.closing_day = int(payload["closing_day"])
        existing.due_day = int(payload["due_day"])
        existing.payment_account_id = str(payload["payment_account_id"])
        existing.is_active = bool(payload.get("is_active", True))

    def _apply_card_purchase_created(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        purchase_id = str(payload["id"])
        existing = session.get(CardPurchaseProjectionRecord, purchase_id)
        if existing is not None:
            return

        card_id = str(payload["card_id"])
        card = session.get(CardProjectionRecord, card_id)
        if card is None:
            return

        allocations = allocate_purchase_installments(
            purchase_date=str(payload["purchase_date"]),
            total_amount=int(payload["amount"]),
            installments_count=int(payload.get("installments_count", 1)),
            closing_day=card.closing_day,
            due_day=card.due_day,
        )
        visible_allocations = [allocation for allocation in allocations if allocation.amount > 0]
        first_allocation = visible_allocations[0]
        reference_month = first_allocation.reference_month
        invoice_id = f"{card_id}:{reference_month}"

        session.add(
            CardPurchaseProjectionRecord(
                purchase_id=purchase_id,
                purchase_date=str(payload["purchase_date"]),
                amount=int(payload["amount"]),
                category_id=str(payload["category_id"]),
                card_id=card_id,
                description=_optional_string(payload.get("description")),
                installments_count=int(payload.get("installments_count", 1)),
                invoice_id=invoice_id,
                reference_month=reference_month,
                closing_date=first_allocation.closing_date,
                due_date=first_allocation.due_date,
            )
        )
        self._sync_reimbursement_from_card_purchase(
            session,
            purchase_id=purchase_id,
            person_id=_optional_string(payload.get("person_id")),
            amount=int(payload["amount"]),
            account_id=card.payment_account_id,
            purchase_date=str(payload["purchase_date"]),
        )

        for allocation in visible_allocations:
            installment_id = f"{purchase_id}:{allocation.installment_number}"
            session.add(
                CardPurchaseInstallmentRecord(
                    installment_id=installment_id,
                    purchase_id=purchase_id,
                    card_id=card_id,
                    purchase_date=str(payload["purchase_date"]),
                    category_id=str(payload["category_id"]),
                    installment_number=allocation.installment_number,
                    installments_count=int(payload.get("installments_count", 1)),
                    amount=allocation.amount,
                    invoice_id=f"{card_id}:{allocation.reference_month}",
                    reference_month=allocation.reference_month,
                    closing_date=allocation.closing_date,
                    due_date=allocation.due_date,
                )
            )
            self._apply_invoice_item(
                session,
                card_id=card_id,
                allocation=allocation,
            )

    def _apply_recurring_rule_created(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        rule_id = str(payload["id"])
        existing = session.get(RecurringRuleProjectionRecord, rule_id)
        if existing is not None:
            return

        session.add(
            RecurringRuleProjectionRecord(
                rule_id=rule_id,
                name=str(payload["name"]),
                amount=int(payload["amount"]),
                due_day=int(payload["due_day"]),
                account_id=str(payload["account_id"]),
                payment_method=str(payload["payment_method"]),
                category_id=str(payload["category_id"]),
                description=_optional_string(payload.get("description")),
                is_active=bool(payload.get("is_active", True)),
            )
        )

    def _apply_budget_updated(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        category_id = str(payload["category_id"])
        month = str(payload["month"])
        existing = session.get(
            BudgetLimitRecord,
            {
                "category_id": category_id,
                "month": month,
            },
        )
        if existing is None:
            session.add(
                BudgetLimitRecord(
                    category_id=category_id,
                    month=month,
                    limit=int(payload["limit"]),
                )
            )
            return

        existing.limit = int(payload["limit"])

    def _apply_investment_movement_recorded(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        movement_id = str(payload["id"])
        if session.get(InvestmentMovementRecord, movement_id) is not None:
            return

        cash_delta = int(payload["cash_delta"])
        session.add(
            InvestmentMovementRecord(
                movement_id=movement_id,
                occurred_at=str(payload["occurred_at"]),
                type=str(payload["type"]),
                account_id=str(payload["account_id"]),
                description=_optional_string(payload.get("description")),
                contribution_amount=int(payload.get("contribution_amount", 0)),
                dividend_amount=int(payload.get("dividend_amount", 0)),
                cash_amount=int(payload.get("cash_amount", 0)),
                invested_amount=int(payload.get("invested_amount", 0)),
                cash_delta=cash_delta,
                invested_delta=int(payload["invested_delta"]),
            )
        )
        self._apply_balance_delta(
            session,
            account_id=str(payload["account_id"]),
            delta=cash_delta,
        )

    def _apply_invoice_item(
        self,
        session: Session,
        *,
        card_id: str,
        allocation: PurchaseInstallmentAllocation,
    ) -> None:
        invoice_id = f"{card_id}:{allocation.reference_month}"
        invoice = session.get(InvoiceProjectionRecord, invoice_id)
        if invoice is None:
            session.add(
                InvoiceProjectionRecord(
                    invoice_id=invoice_id,
                    card_id=card_id,
                    reference_month=allocation.reference_month,
                    closing_date=allocation.closing_date,
                    due_date=allocation.due_date,
                    total_amount=allocation.amount,
                    paid_amount=0,
                    remaining_amount=allocation.amount,
                    purchase_count=1,
                    status="open",
                )
            )
            return

        invoice.total_amount += allocation.amount
        invoice.remaining_amount += allocation.amount
        invoice.purchase_count += 1
        self._sync_invoice_status(invoice)

    def _apply_invoice_paid(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        payment_id = str(payload["id"])
        transaction_id = f"{payment_id}:invoice-payment"
        if session.get(TransactionProjectionRecord, transaction_id) is not None:
            return

        invoice_id = str(payload["invoice_id"])
        invoice = session.get(InvoiceProjectionRecord, invoice_id)
        if invoice is None:
            return

        amount = int(payload["amount"])
        paid_amount = min(amount, invoice.remaining_amount)
        if paid_amount <= 0:
            return

        invoice.paid_amount += paid_amount
        invoice.remaining_amount -= paid_amount
        self._sync_invoice_status(invoice)

        session.add(
            TransactionProjectionRecord(
                transaction_id=transaction_id,
                occurred_at=str(payload["paid_at"]),
                type="expense",
                amount=paid_amount,
                account_id=str(payload["account_id"]),
                payment_method="OTHER",
                category_id="invoice_payment",
                description=f"Pagamento de fatura {invoice_id}",
                person_id=None,
                status="active",
                transfer_id=None,
                direction=None,
            )
        )
        self._apply_balance_delta(
            session,
            account_id=str(payload["account_id"]),
            delta=-paid_amount,
        )

    def _apply_transaction_created(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        transaction_id = str(payload["id"])
        existing = session.get(TransactionProjectionRecord, transaction_id)

        if existing is not None:
            return

        session.add(
            TransactionProjectionRecord(
                transaction_id=transaction_id,
                occurred_at=str(payload["occurred_at"]),
                type=str(payload["type"]),
                amount=int(payload["amount"]),
                account_id=str(payload["account_id"]),
                payment_method=str(payload["payment_method"]),
                category_id=str(payload["category_id"]),
                description=_optional_string(payload.get("description")),
                person_id=_optional_string(payload.get("person_id")),
                status=str(payload.get("status", "active")),
                transfer_id=_optional_string(payload.get("transfer_id")),
                direction=_optional_string(payload.get("direction")),
            )
        )
        self._apply_balance_delta(
            session,
            account_id=str(payload["account_id"]),
            delta=self._signed_amount(
                transaction_type=str(payload["type"]),
                amount=int(payload["amount"]),
                status=str(payload.get("status", "active")),
            ),
        )
        self._sync_reimbursement_from_transaction(
            session,
            transaction_id=transaction_id,
            transaction_type=str(payload["type"]),
            person_id=_optional_string(payload.get("person_id")),
            amount=int(payload["amount"]),
            status=str(payload.get("status", "active")),
            account_id=str(payload["account_id"]),
            occurred_at=str(payload["occurred_at"]),
        )

    def _apply_transaction_updated(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        transaction_id = str(payload["id"])
        existing = session.get(TransactionProjectionRecord, transaction_id)

        if existing is None:
            return

        previous_account_id = existing.account_id
        previous_delta = self._transaction_balance_impact(existing)

        new_account_id = str(payload["account_id"])
        new_type = str(payload["type"])
        new_amount = int(payload["amount"])
        new_status = str(payload.get("status", existing.status))
        new_delta = self._signed_amount(
            transaction_type=new_type,
            amount=new_amount,
            status=new_status,
            direction=_optional_string(payload.get("direction")),
        )

        if previous_account_id == new_account_id:
            self._apply_balance_delta(
                session,
                account_id=new_account_id,
                delta=new_delta - previous_delta,
            )
        else:
            self._apply_balance_delta(
                session,
                account_id=previous_account_id,
                delta=-previous_delta,
            )
            self._apply_balance_delta(
                session,
                account_id=new_account_id,
                delta=new_delta,
            )

        existing.occurred_at = str(payload["occurred_at"])
        existing.type = new_type
        existing.amount = new_amount
        existing.account_id = new_account_id
        existing.payment_method = str(payload["payment_method"])
        existing.category_id = str(payload["category_id"])
        existing.description = _optional_string(payload.get("description"))
        existing.person_id = _optional_string(payload.get("person_id"))
        existing.status = new_status
        existing.transfer_id = _optional_string(payload.get("transfer_id"))
        existing.direction = _optional_string(payload.get("direction"))
        self._sync_reimbursement_from_transaction(
            session,
            transaction_id=transaction_id,
            transaction_type=new_type,
            person_id=existing.person_id,
            amount=existing.amount,
            status=existing.status,
            account_id=existing.account_id,
            occurred_at=existing.occurred_at,
        )

    def _apply_transaction_voided(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        transaction_id = str(payload["id"])
        existing = session.get(TransactionProjectionRecord, transaction_id)

        if existing is None or existing.status == "voided":
            return

        self._apply_balance_delta(
            session,
            account_id=existing.account_id,
            delta=-self._transaction_balance_impact(existing),
        )
        existing.status = "voided"
        self._sync_reimbursement_from_transaction(
            session,
            transaction_id=transaction_id,
            transaction_type=existing.type,
            person_id=existing.person_id,
            amount=existing.amount,
            status=existing.status,
            account_id=existing.account_id,
            occurred_at=existing.occurred_at,
        )

    def _apply_reimbursement_received(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        transaction_id = str(payload["transaction_id"])
        receivable = session.get(ReimbursementProjectionRecord, transaction_id)
        if receivable is None:
            return

        receivable.status = "received"
        receivable.account_id = str(payload.get("account_id", receivable.account_id))
        receivable.received_at = str(payload["received_at"])
        receivable.receipt_transaction_id = _optional_string(
            payload.get("receipt_transaction_id")
        )

    def _apply_pending_confirmed(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        pending_id = str(payload["pending_id"])
        pending = session.get(PendingProjectionRecord, pending_id)

        if pending is None:
            month = self._pending_month_from_id(pending_id)
            if month is not None:
                self._ensure_month_pendings(session, month=month)
                pending = session.get(PendingProjectionRecord, pending_id)

        if pending is None or pending.status == "confirmed":
            return

        pending.status = "confirmed"
        pending.transaction_id = _optional_string(payload.get("transaction_id"))
        pending.confirmed_at = _optional_string(payload.get("confirmed_at"))

    def _apply_transfer_created(
        self,
        session: Session,
        payload: dict[str, object],
    ) -> None:
        transfer_id = str(payload["id"])
        occurred_at = str(payload["occurred_at"])
        amount = int(payload["amount"])
        description = _optional_string(payload.get("description"))

        debit_id = f"{transfer_id}:debit"
        if session.get(TransactionProjectionRecord, debit_id) is None:
            session.add(
                TransactionProjectionRecord(
                    transaction_id=debit_id,
                    occurred_at=occurred_at,
                    type="transfer",
                    amount=amount,
                    account_id=str(payload["from_account_id"]),
                    payment_method="OTHER",
                    category_id="transfer",
                    description=description,
                    person_id=None,
                    status="active",
                    transfer_id=transfer_id,
                    direction="debit",
                )
            )
            self._apply_balance_delta(
                session,
                account_id=str(payload["from_account_id"]),
                delta=-amount,
            )

        credit_id = f"{transfer_id}:credit"
        if session.get(TransactionProjectionRecord, credit_id) is None:
            session.add(
                TransactionProjectionRecord(
                    transaction_id=credit_id,
                    occurred_at=occurred_at,
                    type="transfer",
                    amount=amount,
                    account_id=str(payload["to_account_id"]),
                    payment_method="OTHER",
                    category_id="transfer",
                    description=description,
                    person_id=None,
                    status="active",
                    transfer_id=transfer_id,
                    direction="credit",
                )
            )
            self._apply_balance_delta(
                session,
                account_id=str(payload["to_account_id"]),
                delta=amount,
            )

    def _sync_reimbursement_from_transaction(
        self,
        session: Session,
        *,
        transaction_id: str,
        transaction_type: str,
        person_id: str | None,
        amount: int,
        status: str,
        account_id: str,
        occurred_at: str,
    ) -> None:
        existing = session.get(ReimbursementProjectionRecord, transaction_id)
        should_track = (
            transaction_type == "expense"
            and person_id is not None
            and person_id.strip() != ""
            and status == "active"
        )

        if not should_track:
            if existing is not None and existing.status != "received":
                session.delete(existing)
            return

        if existing is None:
            session.add(
                ReimbursementProjectionRecord(
                    transaction_id=transaction_id,
                    person_id=person_id,
                    amount=amount,
                    status="pending",
                    account_id=account_id,
                    occurred_at=occurred_at,
                    received_at=None,
                    receipt_transaction_id=None,
                )
            )
            return

        if existing.status == "received":
            return

        existing.person_id = person_id
        existing.amount = amount
        existing.account_id = account_id
        existing.occurred_at = occurred_at

    def _sync_reimbursement_from_card_purchase(
        self,
        session: Session,
        *,
        purchase_id: str,
        person_id: str | None,
        amount: int,
        account_id: str,
        purchase_date: str,
    ) -> None:
        if person_id is None or person_id.strip() == "":
            return

        existing = session.get(ReimbursementProjectionRecord, purchase_id)
        if existing is None:
            session.add(
                ReimbursementProjectionRecord(
                    transaction_id=purchase_id,
                    person_id=person_id,
                    amount=amount,
                    status="pending",
                    account_id=account_id,
                    occurred_at=purchase_date,
                    received_at=None,
                    receipt_transaction_id=None,
                )
            )
            return

        if existing.status == "received":
            return

        existing.person_id = person_id
        existing.amount = amount
        existing.account_id = account_id
        existing.occurred_at = purchase_date

    def _ensure_month_pendings(self, session: Session, *, month: str) -> None:
        rows: Sequence[RecurringRuleProjectionRecord] = (
            session.query(RecurringRuleProjectionRecord)
            .filter(RecurringRuleProjectionRecord.is_active.is_(True))
            .order_by(RecurringRuleProjectionRecord.rule_id.asc())
            .all()
        )

        for row in rows:
            pending_id = f"{row.rule_id}:{month}"
            if session.get(PendingProjectionRecord, pending_id) is not None:
                continue

            session.add(
                PendingProjectionRecord(
                    pending_id=pending_id,
                    rule_id=row.rule_id,
                    month=month,
                    name=row.name,
                    amount=row.amount,
                    due_date=self._due_date_for_month(month, row.due_day),
                    account_id=row.account_id,
                    payment_method=row.payment_method,
                    category_id=row.category_id,
                    description=row.description,
                    status="pending",
                    transaction_id=None,
                    confirmed_at=None,
                )
            )

    def _pending_to_dict(
        self,
        row: PendingProjectionRecord,
    ) -> dict[str, str | int | None]:
        return PendingProjection(
            pending_id=row.pending_id,
            rule_id=row.rule_id,
            month=row.month,
            name=row.name,
            amount=row.amount,
            due_date=row.due_date,
            account_id=row.account_id,
            payment_method=row.payment_method,
            category_id=row.category_id,
            description=row.description,
            status=row.status,
            transaction_id=row.transaction_id,
        ).to_dict()

    def _pending_month_from_id(self, pending_id: str) -> str | None:
        parts = pending_id.rsplit(":", 1)
        if len(parts) != 2:
            return None

        month = parts[1]
        try:
            datetime.strptime(month, "%Y-%m")
        except ValueError:
            return None

        return month

    def _due_date_for_month(self, month: str, due_day: int) -> str:
        parsed_month = datetime.strptime(month, "%Y-%m")
        return date(parsed_month.year, parsed_month.month, due_day).isoformat()

    def _income_totals_by_month(self, *, session: Session) -> dict[str, int]:
        rows: Sequence[TransactionProjectionRecord] = (
            session.query(TransactionProjectionRecord)
            .filter(TransactionProjectionRecord.status == "active")
            .filter(TransactionProjectionRecord.type == "income")
            .all()
        )
        totals: dict[str, int] = {}
        for row in rows:
            month_key = row.occurred_at[:7]
            totals[month_key] = totals.get(month_key, 0) + row.amount
        return totals

    def _income_total_for_range(
        self,
        *,
        income_by_month: dict[str, int],
        occurred_from: str,
        occurred_to: str,
    ) -> int:
        start = self._parse_utc(occurred_from)
        end = self._parse_utc(occurred_to)
        total = 0
        cursor = date(start.year, start.month, 1)
        end_marker = date(end.year, end.month, 1)
        while cursor <= end_marker:
            key = f"{cursor.year:04d}-{cursor.month:02d}"
            total += income_by_month.get(key, 0)
            if cursor.month == 12:
                cursor = date(cursor.year + 1, 1, 1)
            else:
                cursor = date(cursor.year, cursor.month + 1, 1)
        return total

    def _bucket_keys_for_range(
        self,
        *,
        view: str,
        occurred_from: str,
        occurred_to: str,
    ) -> list[str]:
        start = self._parse_utc(occurred_from)
        end = self._parse_utc(occurred_to)
        if end < start:
            return []

        if view == "daily":
            keys: list[str] = []
            current = start.date()
            while current <= end.date():
                keys.append(current.isoformat())
                current = current + timedelta(days=1)
            return keys

        if view == "weekly":
            keys = []
            current = (start - timedelta(days=start.weekday())).date()
            while current <= end.date():
                iso_year, iso_week, _ = current.isocalendar()
                keys.append(f"{iso_year:04d}-W{iso_week:02d}")
                current = current + timedelta(days=7)
            return keys

        if view in {"monthly", "bimonthly", "quarterly"}:
            keys = []
            seen: set[str] = set()
            current = date(start.year, start.month, 1)
            end_marker = date(end.year, end.month, 1)
            while current <= end_marker:
                key = self._bucket_key_for_date(view=view, value=current)
                if key not in seen:
                    keys.append(key)
                    seen.add(key)
                if current.month == 12:
                    current = date(current.year + 1, 1, 1)
                else:
                    current = date(current.year, current.month + 1, 1)
            return keys

        if view == "yearly":
            keys = []
            for year in range(start.year, end.year + 1):
                keys.append(f"{year:04d}")
            return keys

        return []

    def _bucket_key(self, *, view: str, occurred_at: str) -> str:
        parsed = self._parse_utc(occurred_at)
        return self._bucket_key_for_date(view=view, value=parsed.date())

    def _bucket_key_for_date(self, *, view: str, value: date) -> str:
        if view == "daily":
            return value.isoformat()
        if view == "weekly":
            iso_year, iso_week, _ = value.isocalendar()
            return f"{iso_year:04d}-W{iso_week:02d}"
        if view == "monthly":
            return f"{value.year:04d}-{value.month:02d}"
        if view == "bimonthly":
            bi = ((value.month - 1) // 2) + 1
            return f"{value.year:04d}-B{bi}"
        if view == "quarterly":
            quarter = ((value.month - 1) // 3) + 1
            return f"{value.year:04d}-Q{quarter}"
        return f"{value.year:04d}"

    def _parse_utc(self, value: str) -> datetime:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))

    def _apply_transaction_filters(
        self,
        query: object,
        *,
        transaction_type: str | None = None,
        category_id: str | None = None,
        account_id: str | None = None,
        card_id: str | None = None,
        payment_method: str | None = None,
        person_id: str | None = None,
        text: str | None = None,
    ) -> object:
        if transaction_type is not None:
            query = query.filter(TransactionProjectionRecord.type == transaction_type)
        if category_id is not None:
            query = query.filter(TransactionProjectionRecord.category_id == category_id)
        if account_id is not None:
            query = query.filter(TransactionProjectionRecord.account_id == account_id)
        if card_id is not None:
            query = query.filter(
                TransactionProjectionRecord.category_id == "invoice_payment"
            ).filter(
                TransactionProjectionRecord.description.ilike(f"%{card_id}%")
            )
        if payment_method is not None:
            query = query.filter(
                TransactionProjectionRecord.payment_method == payment_method
            )
        if person_id is not None:
            query = query.filter(TransactionProjectionRecord.person_id == person_id)
        if text is not None:
            search = f"%{text}%"
            query = query.filter(
                or_(
                    TransactionProjectionRecord.description.ilike(search),
                    TransactionProjectionRecord.category_id.ilike(search),
                )
            )
        return query

    def _list_installments_for_report(
        self,
        session: Session,
        *,
        due_from_timestamp: str | None = None,
        due_to_timestamp: str | None = None,
        due_after_timestamp: str | None = None,
        category_id: str | None = None,
        account_id: str | None = None,
        card_id: str | None = None,
        payment_method: str | None = None,
        person_id: str | None = None,
        text: str | None = None,
    ) -> list[CardPurchaseInstallmentRecord]:
        if payment_method is not None:
            return []

        query = session.query(CardPurchaseInstallmentRecord)
        due_timestamp = func.printf(
            "%sT23:59:59Z",
            CardPurchaseInstallmentRecord.due_date,
        )
        if due_from_timestamp is not None:
            query = query.filter(due_timestamp >= due_from_timestamp)
        if due_to_timestamp is not None:
            query = query.filter(due_timestamp <= due_to_timestamp)
        if due_after_timestamp is not None:
            query = query.filter(due_timestamp > due_after_timestamp)
        if category_id is not None:
            query = query.filter(CardPurchaseInstallmentRecord.category_id == category_id)
        if card_id is not None:
            query = query.filter(CardPurchaseInstallmentRecord.card_id == card_id)

        if account_id is not None:
            query = query.join(
                CardProjectionRecord,
                CardProjectionRecord.card_id == CardPurchaseInstallmentRecord.card_id,
            ).filter(
                CardProjectionRecord.payment_account_id == account_id
            )

        if person_id is not None:
            query = query.join(
                ReimbursementProjectionRecord,
                and_(
                    ReimbursementProjectionRecord.transaction_id
                    == CardPurchaseInstallmentRecord.purchase_id,
                    ReimbursementProjectionRecord.person_id == person_id,
                ),
            )

        if text is not None:
            search = f"%{text}%"
            query = query.join(
                CardPurchaseProjectionRecord,
                CardPurchaseProjectionRecord.purchase_id
                == CardPurchaseInstallmentRecord.purchase_id,
            ).filter(
                or_(
                    CardPurchaseProjectionRecord.description.ilike(search),
                    CardPurchaseInstallmentRecord.category_id.ilike(search),
                )
            )

        return (
            query.order_by(
                CardPurchaseInstallmentRecord.due_date.asc(),
                CardPurchaseInstallmentRecord.installment_id.asc(),
            )
            .all()
        )

    def _list_card_purchases_for_ledger(
        self,
        session: Session,
        *,
        occurred_from: str | None = None,
        occurred_to: str | None = None,
        transaction_type: str | None = None,
        category_id: str | None = None,
        account_id: str | None = None,
        card_id: str | None = None,
        payment_method: str | None = None,
        person_id: str | None = None,
        text: str | None = None,
    ) -> list[dict[str, str | int | None]]:
        if transaction_type is not None and transaction_type != "expense":
            return []
        if payment_method is not None and payment_method != "OTHER":
            return []

        query = session.query(
            CardPurchaseProjectionRecord,
            CardProjectionRecord.payment_account_id,
        ).join(
            CardProjectionRecord,
            CardProjectionRecord.card_id == CardPurchaseProjectionRecord.card_id,
        )
        if occurred_from is not None:
            query = query.filter(CardPurchaseProjectionRecord.purchase_date >= occurred_from)
        if occurred_to is not None:
            query = query.filter(CardPurchaseProjectionRecord.purchase_date <= occurred_to)
        if category_id is not None:
            query = query.filter(CardPurchaseProjectionRecord.category_id == category_id)
        if card_id is not None:
            query = query.filter(CardPurchaseProjectionRecord.card_id == card_id)
        if account_id is not None:
            query = query.filter(CardProjectionRecord.payment_account_id == account_id)
        if person_id is not None:
            query = query.join(
                ReimbursementProjectionRecord,
                and_(
                    ReimbursementProjectionRecord.transaction_id
                    == CardPurchaseProjectionRecord.purchase_id,
                    ReimbursementProjectionRecord.person_id == person_id,
                ),
            )
        if text is not None:
            search = f"%{text}%"
            query = query.filter(
                or_(
                    CardPurchaseProjectionRecord.description.ilike(search),
                    CardPurchaseProjectionRecord.category_id.ilike(search),
                    CardPurchaseProjectionRecord.card_id.ilike(search),
                )
            )

        rows = (
            query.order_by(
                CardPurchaseProjectionRecord.purchase_date.desc(),
                CardPurchaseProjectionRecord.purchase_id.desc(),
            )
            .all()
        )

        ledger_rows: list[dict[str, str | int | None]] = []
        for purchase_row, payment_account_id in rows:
            ledger_rows.append(
                {
                    "transaction_id": f"{purchase_row.purchase_id}:card-purchase",
                    "occurred_at": purchase_row.purchase_date,
                    "type": "expense",
                    "amount": purchase_row.amount,
                    "account_id": payment_account_id,
                    "payment_method": "OTHER",
                    "category_id": purchase_row.category_id,
                    "description": purchase_row.description,
                    "person_id": None,
                    "status": "readonly",
                    "ledger_event_type": "card_purchase",
                    "ledger_source": f"card_liability:{purchase_row.card_id}",
                    "ledger_destination": f"category:{purchase_row.category_id}",
                }
            )

        return ledger_rows

    def _list_investment_movements_for_ledger(
        self,
        session: Session,
        *,
        occurred_from: str | None = None,
        occurred_to: str | None = None,
        transaction_type: str | None = None,
        category_id: str | None = None,
        account_id: str | None = None,
        card_id: str | None = None,
        payment_method: str | None = None,
        person_id: str | None = None,
        text: str | None = None,
    ) -> list[dict[str, str | int | None]]:
        if transaction_type is not None and transaction_type != "investment":
            return []
        if payment_method is not None and payment_method != "OTHER":
            return []
        if person_id is not None:
            return []
        if card_id is not None:
            return []
        if category_id is not None and category_id not in {
            "investment_contribution",
            "investment_withdrawal",
        }:
            return []

        query = session.query(InvestmentMovementRecord)
        if occurred_from is not None:
            query = query.filter(InvestmentMovementRecord.occurred_at >= occurred_from)
        if occurred_to is not None:
            query = query.filter(InvestmentMovementRecord.occurred_at <= occurred_to)
        if account_id is not None:
            query = query.filter(InvestmentMovementRecord.account_id == account_id)
        if category_id == "investment_contribution":
            query = query.filter(InvestmentMovementRecord.type == "contribution")
        if category_id == "investment_withdrawal":
            query = query.filter(InvestmentMovementRecord.type == "withdrawal")
        if text is not None:
            search = f"%{text}%"
            query = query.filter(
                or_(
                    InvestmentMovementRecord.description.ilike(search),
                    InvestmentMovementRecord.type.ilike(search),
                )
            )

        rows = (
            query.order_by(
                InvestmentMovementRecord.occurred_at.desc(),
                InvestmentMovementRecord.movement_id.desc(),
            )
            .all()
        )

        ledger_rows: list[dict[str, str | int | None]] = []
        for row in rows:
            movement_category = (
                "investment_contribution"
                if row.type == "contribution"
                else "investment_withdrawal"
            )
            amount = abs(row.cash_delta)
            if row.type == "contribution":
                ledger_source = f"account:{row.account_id}"
                ledger_destination = f"investment_asset:{row.account_id}"
            else:
                ledger_source = f"investment_asset:{row.account_id}"
                ledger_destination = f"account:{row.account_id}"

            if text is not None and text.lower() not in movement_category.lower():
                description = (row.description or "").lower()
                if text.lower() not in description:
                    continue

            ledger_rows.append(
                {
                    "transaction_id": f"{row.movement_id}:investment",
                    "occurred_at": row.occurred_at,
                    "type": "investment",
                    "amount": amount,
                    "account_id": row.account_id,
                    "payment_method": "OTHER",
                    "category_id": movement_category,
                    "description": row.description,
                    "person_id": None,
                    "status": "readonly",
                    "ledger_event_type": movement_category,
                    "ledger_source": ledger_source,
                    "ledger_destination": ledger_destination,
                }
            )

        return ledger_rows

    def _build_weekly_trend(
        self,
        *,
        occurred_from: str,
        occurred_to: str,
        transaction_rows: Sequence[TransactionProjectionRecord],
        period_installment_rows: Sequence[CardPurchaseInstallmentRecord],
    ) -> list[dict[str, str | int]]:
        weekly_keys = self._bucket_keys_for_range(
            view="weekly",
            occurred_from=occurred_from,
            occurred_to=occurred_to,
        )
        trend_map: dict[str, dict[str, str | int]] = {
            key: {
                "week": key,
                "income_total": 0,
                "expense_total": 0,
                "net_total": 0,
            }
            for key in weekly_keys
        }

        for row in transaction_rows:
            if row.type not in {"income", "expense"}:
                continue
            if row.type == "expense" and row.category_id == "invoice_payment":
                continue
            bucket = self._bucket_key(view="weekly", occurred_at=row.occurred_at)
            if bucket not in trend_map:
                continue
            if row.type == "income":
                trend_map[bucket]["income_total"] = int(trend_map[bucket]["income_total"]) + row.amount
            else:
                trend_map[bucket]["expense_total"] = int(trend_map[bucket]["expense_total"]) + row.amount

        for row in period_installment_rows:
            installment_bucket = self._bucket_key_for_date(
                view="weekly",
                value=date.fromisoformat(row.due_date),
            )
            if installment_bucket not in trend_map:
                continue
            trend_map[installment_bucket]["expense_total"] = (
                int(trend_map[installment_bucket]["expense_total"]) + row.amount
            )

        result: list[dict[str, str | int]] = []
        for key in weekly_keys:
            current = trend_map[key]
            current["net_total"] = (
                int(current["income_total"]) - int(current["expense_total"])
            )
            result.append(current)
        return result

    def _projection_schema_requires_rebuild(self) -> bool:
        inspector = inspect(self._engine)
        table_names = set(inspector.get_table_names())

        if "accounts" not in table_names:
            return False

        account_columns = self._safe_column_names(inspector, "accounts")
        if account_columns is None:
            return True
        if "is_active" not in account_columns:
            return True

        if "balance_state" not in table_names:
            return True

        if "cards" not in table_names:
            return True

        card_columns = self._safe_column_names(inspector, "cards")
        if card_columns is None:
            return True
        expected_card_columns = {
            "card_id",
            "name",
            "limit",
            "closing_day",
            "due_day",
            "payment_account_id",
            "is_active",
        }
        if card_columns != expected_card_columns:
            return True

        if "card_purchases" not in table_names:
            return True

        card_purchase_columns = self._safe_column_names(inspector, "card_purchases")
        if card_purchase_columns is None:
            return True
        expected_card_purchase_columns = {
            "purchase_id",
            "purchase_date",
            "amount",
            "category_id",
            "card_id",
            "description",
            "installments_count",
            "invoice_id",
            "reference_month",
            "closing_date",
            "due_date",
        }
        if card_purchase_columns != expected_card_purchase_columns:
            return True

        if "card_purchase_installments" not in table_names:
            return True

        installment_columns = self._safe_column_names(inspector, "card_purchase_installments")
        if installment_columns is None:
            return True
        expected_installment_columns = {
            "installment_id",
            "purchase_id",
            "card_id",
            "purchase_date",
            "category_id",
            "installment_number",
            "installments_count",
            "amount",
            "invoice_id",
            "reference_month",
            "closing_date",
            "due_date",
        }
        if installment_columns != expected_installment_columns:
            return True

        if "invoices" not in table_names:
            return True

        invoice_columns = self._safe_column_names(inspector, "invoices")
        if invoice_columns is None:
            return True
        expected_invoice_columns = {
            "invoice_id",
            "card_id",
            "reference_month",
            "closing_date",
            "due_date",
            "total_amount",
            "paid_amount",
            "remaining_amount",
            "purchase_count",
            "status",
        }
        if invoice_columns != expected_invoice_columns:
            return True

        if "transactions" not in table_names:
            return True

        transaction_columns = self._safe_column_names(inspector, "transactions")
        if transaction_columns is None:
            return True
        expected_transaction_columns = {
            "transaction_id",
            "occurred_at",
            "type",
            "amount",
            "account_id",
            "payment_method",
            "category_id",
            "description",
            "person_id",
            "status",
            "transfer_id",
            "direction",
        }
        if transaction_columns != expected_transaction_columns:
            return True

        if "reimbursements" not in table_names:
            return True

        reimbursement_columns = self._safe_column_names(inspector, "reimbursements")
        if reimbursement_columns is None:
            return True
        expected_reimbursement_columns = {
            "transaction_id",
            "person_id",
            "amount",
            "status",
            "account_id",
            "occurred_at",
            "received_at",
            "receipt_transaction_id",
        }
        if reimbursement_columns != expected_reimbursement_columns:
            return True

        if "recurring_rules" not in table_names:
            return True

        recurring_rule_columns = self._safe_column_names(inspector, "recurring_rules")
        if recurring_rule_columns is None:
            return True
        expected_recurring_rule_columns = {
            "rule_id",
            "name",
            "amount",
            "due_day",
            "account_id",
            "payment_method",
            "category_id",
            "description",
            "is_active",
        }
        if recurring_rule_columns != expected_recurring_rule_columns:
            return True

        if "pendings" not in table_names:
            return True

        pending_columns = self._safe_column_names(inspector, "pendings")
        if pending_columns is None:
            return True
        expected_pending_columns = {
            "pending_id",
            "rule_id",
            "month",
            "name",
            "amount",
            "due_date",
            "account_id",
            "payment_method",
            "category_id",
            "description",
            "status",
            "transaction_id",
            "confirmed_at",
        }
        if pending_columns != expected_pending_columns:
            return True

        if "budgets" not in table_names:
            return True

        budget_columns = self._safe_column_names(inspector, "budgets")
        if budget_columns is None:
            return True
        expected_budget_columns = {
            "category_id",
            "month",
            "limit",
        }
        if budget_columns != expected_budget_columns:
            return True

        if "investment_movements" not in table_names:
            return True

        investment_columns = self._safe_column_names(inspector, "investment_movements")
        if investment_columns is None:
            return True
        expected_investment_columns = {
            "movement_id",
            "occurred_at",
            "type",
            "account_id",
            "description",
            "contribution_amount",
            "dividend_amount",
            "cash_amount",
            "invested_amount",
            "cash_delta",
            "invested_delta",
        }
        if investment_columns != expected_investment_columns:
            return True

        return False

    def _safe_column_names(
        self,
        inspector: object,
        table_name: str,
    ) -> set[str] | None:
        try:
            columns = inspector.get_columns(table_name)  # type: ignore[attr-defined]
        except NoSuchTableError:
            return None

        return {str(column["name"]) for column in columns}

    def _apply_balance_delta(
        self,
        session: Session,
        *,
        account_id: str,
        delta: int,
    ) -> None:
        if delta == 0:
            return

        balance = session.get(BalanceStateRecord, account_id)
        if balance is None:
            session.add(
                BalanceStateRecord(
                    account_id=account_id,
                    current_balance=delta,
                )
            )
            return

        balance.current_balance += delta

    def _signed_amount(
        self,
        *,
        transaction_type: str,
        amount: int,
        status: str,
        direction: str | None = None,
    ) -> int:
        if status != "active":
            return 0

        if transaction_type == "transfer":
            return amount if direction == "credit" else -amount

        return amount if transaction_type == "income" else -amount

    def _ledger_projection_for_transaction(
        self,
        transaction: dict[str, str | int | None],
    ) -> tuple[str, str, str]:
        transaction_type = str(transaction.get("type") or "")
        account_id = str(transaction.get("account_id") or "")
        category_id = str(transaction.get("category_id") or "")
        transfer_id = _optional_string(transaction.get("transfer_id"))
        direction = _optional_string(transaction.get("direction"))
        description = _optional_string(transaction.get("description"))
        person_id = _optional_string(transaction.get("person_id"))

        if transaction_type == "transfer":
            ledger_transfer_id = transfer_id or str(transaction.get("transaction_id") or "unknown")
            if direction == "credit":
                return (
                    "transfer_in",
                    f"transfer:{ledger_transfer_id}",
                    f"account:{account_id}",
                )
            return (
                "transfer_out",
                f"account:{account_id}",
                f"transfer:{ledger_transfer_id}",
            )

        if transaction_type == "income":
            if category_id == "reimbursement_received":
                source = f"person:{person_id}" if person_id else "person:reembolso"
                return ("reimbursement_received", source, f"account:{account_id}")
            return ("income", f"category:{category_id}", f"account:{account_id}")

        if transaction_type == "expense":
            if category_id == "invoice_payment":
                invoice_id = self._extract_invoice_identifier(description)
                return (
                    "invoice_payment",
                    f"account:{account_id}",
                    f"card_liability:{invoice_id}",
                )
            return ("expense", f"account:{account_id}", f"category:{category_id}")

        return ("unknown", f"account:{account_id}", "unknown:unknown")

    def _extract_invoice_identifier(self, description: str | None) -> str:
        if description is None:
            return "unknown"

        marker = "Pagamento de fatura "
        if marker in description:
            return description.split(marker, maxsplit=1)[1].strip() or "unknown"

        return "unknown"

    def _transaction_balance_impact(self, row: TransactionProjectionRecord) -> int:
        return self._signed_amount(
            transaction_type=row.type,
            amount=row.amount,
            status=row.status,
            direction=row.direction,
        )

    def _sync_invoice_status(self, invoice: InvoiceProjectionRecord) -> None:
        if invoice.remaining_amount <= 0:
            invoice.status = "paid"
            invoice.remaining_amount = 0
            return

        if invoice.paid_amount > 0:
            invoice.status = "partial"
            return

        invoice.status = "open"


def _optional_string(value: object | None) -> str | None:
    if value is None:
        return None

    return str(value)










