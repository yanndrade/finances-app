from __future__ import annotations

from collections.abc import Sequence
from threading import RLock

from sqlalchemy import Boolean
from sqlalchemy import Integer
from sqlalchemy import String
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
from finance_app.domain.projections import (
    AccountProjection,
    BalanceStateProjection,
    CardProjection,
    CardPurchaseProjection,
    InvoiceItemProjection,
    InvoiceProjection,
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
        category_id: str | None = None,
        account_id: str | None = None,
        payment_method: str | None = None,
        person_id: str | None = None,
        text: str | None = None,
    ) -> list[dict[str, str | int | None]]:
        with self._lock:
            self.bootstrap()
            with self._session_factory() as session:
                query = session.query(TransactionProjectionRecord)

                if occurred_from is not None:
                    query = query.filter(TransactionProjectionRecord.occurred_at >= occurred_from)
                if occurred_to is not None:
                    query = query.filter(TransactionProjectionRecord.occurred_at <= occurred_to)
                if category_id is not None:
                    query = query.filter(TransactionProjectionRecord.category_id == category_id)
                if account_id is not None:
                    query = query.filter(TransactionProjectionRecord.account_id == account_id)
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

                rows = (
                    query.order_by(
                        TransactionProjectionRecord.occurred_at.desc(),
                        TransactionProjectionRecord.transaction_id.desc(),
                    )
                    .all()
                )

        return [
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
                    .filter(
                        or_(
                            TransactionProjectionRecord.description.is_(None),
                            TransactionProjectionRecord.description == "",
                        )
                    )
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
        }

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
        receivable.received_at = str(payload["received_at"])
        receivable.receipt_transaction_id = _optional_string(
            payload.get("receipt_transaction_id")
        )

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
