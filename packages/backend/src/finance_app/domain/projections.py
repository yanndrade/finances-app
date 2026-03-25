from dataclasses import dataclass


@dataclass(frozen=True)
class AccountProjection:
    account_id: str
    name: str
    type: str
    initial_balance: int
    is_active: bool

    def to_dict(self) -> dict[str, str | int | bool]:
        return {
            "account_id": self.account_id,
            "name": self.name,
            "type": self.type,
            "initial_balance": self.initial_balance,
            "is_active": self.is_active,
        }


@dataclass(frozen=True)
class CardProjection:
    card_id: str
    name: str
    limit: int
    closing_day: int
    due_day: int
    payment_account_id: str
    is_active: bool
    future_installment_total: int = 0

    def to_dict(self) -> dict[str, str | int | bool]:
        return {
            "card_id": self.card_id,
            "name": self.name,
            "limit": self.limit,
            "closing_day": self.closing_day,
            "due_day": self.due_day,
            "payment_account_id": self.payment_account_id,
            "is_active": self.is_active,
            "future_installment_total": self.future_installment_total,
        }


@dataclass(frozen=True)
class CardPurchaseProjection:
    purchase_id: str
    purchase_date: str
    amount: int
    category_id: str
    card_id: str
    description: str | None
    installments_count: int
    invoice_id: str
    reference_month: str
    closing_date: str
    due_date: str

    def to_dict(self) -> dict[str, str | int | None]:
        return {
            "purchase_id": self.purchase_id,
            "purchase_date": self.purchase_date,
            "amount": self.amount,
            "category_id": self.category_id,
            "card_id": self.card_id,
            "description": self.description,
            "installments_count": self.installments_count,
            "invoice_id": self.invoice_id,
            "reference_month": self.reference_month,
            "closing_date": self.closing_date,
            "due_date": self.due_date,
        }


@dataclass(frozen=True)
class InvoiceProjection:
    invoice_id: str
    card_id: str
    reference_month: str
    closing_date: str
    due_date: str
    total_amount: int
    paid_amount: int
    remaining_amount: int
    purchase_count: int
    status: str

    def to_dict(self) -> dict[str, str | int]:
        return {
            "invoice_id": self.invoice_id,
            "card_id": self.card_id,
            "reference_month": self.reference_month,
            "closing_date": self.closing_date,
            "due_date": self.due_date,
            "total_amount": self.total_amount,
            "paid_amount": self.paid_amount,
            "remaining_amount": self.remaining_amount,
            "purchase_count": self.purchase_count,
            "status": self.status,
        }


@dataclass(frozen=True)
class InvoiceItemProjection:
    invoice_item_id: str
    invoice_id: str
    purchase_id: str
    card_id: str
    purchase_date: str
    category_id: str
    title: str | None
    description: str | None
    origin_type: str | None
    group_id: str | None
    installment_number: int
    installments_count: int
    amount: int

    def to_dict(self) -> dict[str, str | int | None]:
        return {
            "invoice_item_id": self.invoice_item_id,
            "invoice_id": self.invoice_id,
            "purchase_id": self.purchase_id,
            "card_id": self.card_id,
            "purchase_date": self.purchase_date,
            "category_id": self.category_id,
            "title": self.title,
            "description": self.description,
            "origin_type": self.origin_type,
            "group_id": self.group_id,
            "installment_number": self.installment_number,
            "installments_count": self.installments_count,
            "amount": self.amount,
        }


@dataclass(frozen=True)
class CardInstallmentProjection:
    installment_id: str
    purchase_id: str
    card_id: str
    purchase_date: str
    due_date: str
    reference_month: str
    category_id: str
    description: str | None
    installment_number: int
    installments_count: int
    amount: int
    invoice_id: str

    def to_dict(self) -> dict[str, str | int | None]:
        return {
            "installment_id": self.installment_id,
            "purchase_id": self.purchase_id,
            "card_id": self.card_id,
            "purchase_date": self.purchase_date,
            "due_date": self.due_date,
            "reference_month": self.reference_month,
            "category_id": self.category_id,
            "description": self.description,
            "installment_number": self.installment_number,
            "installments_count": self.installments_count,
            "amount": self.amount,
            "invoice_id": self.invoice_id,
        }


@dataclass(frozen=True)
class BalanceStateProjection:
    account_id: str
    current_balance: int

    def to_dict(self) -> dict[str, str | int]:
        return {
            "account_id": self.account_id,
            "current_balance": self.current_balance,
        }


@dataclass(frozen=True)
class TransactionProjection:
    transaction_id: str
    occurred_at: str
    type: str
    amount: int
    account_id: str
    payment_method: str
    category_id: str
    description: str | None
    person_id: str | None
    status: str
    transfer_id: str | None = None
    direction: str | None = None

    def to_dict(self) -> dict[str, str | int | None]:
        data: dict[str, str | int | None] = {
            "transaction_id": self.transaction_id,
            "occurred_at": self.occurred_at,
            "type": self.type,
            "amount": self.amount,
            "account_id": self.account_id,
            "payment_method": self.payment_method,
            "category_id": self.category_id,
            "description": self.description,
            "person_id": self.person_id,
            "status": self.status,
        }
        if self.transfer_id is not None:
            data["transfer_id"] = self.transfer_id
        if self.direction is not None:
            data["direction"] = self.direction
        return data


@dataclass(frozen=True)
class ReimbursementProjection:
    transaction_id: str
    person_id: str
    amount: int
    amount_received: int
    status: str
    account_id: str
    occurred_at: str
    expected_at: str | None
    received_at: str | None
    receipt_transaction_id: str | None
    notes: str | None

    def to_dict(self) -> dict[str, str | int | None]:
        return {
            "transaction_id": self.transaction_id,
            "person_id": self.person_id,
            "amount": self.amount,
            "amount_received": self.amount_received,
            "status": self.status,
            "account_id": self.account_id,
            "occurred_at": self.occurred_at,
            "expected_at": self.expected_at,
            "received_at": self.received_at,
            "receipt_transaction_id": self.receipt_transaction_id,
            "notes": self.notes,
        }


@dataclass(frozen=True)
class RecurringRuleProjection:
    rule_id: str
    name: str
    amount: int
    due_day: int
    account_id: str | None
    card_id: str | None
    payment_method: str
    category_id: str
    description: str | None
    is_active: bool

    def to_dict(self) -> dict[str, str | int | bool | None]:
        return {
            "rule_id": self.rule_id,
            "name": self.name,
            "amount": self.amount,
            "due_day": self.due_day,
            "account_id": self.account_id,
            "card_id": self.card_id,
            "payment_method": self.payment_method,
            "category_id": self.category_id,
            "description": self.description,
            "is_active": self.is_active,
        }


@dataclass(frozen=True)
class PendingProjection:
    pending_id: str
    rule_id: str
    month: str
    name: str
    amount: int
    due_date: str
    account_id: str | None
    card_id: str | None
    payment_method: str
    category_id: str
    description: str | None
    status: str
    transaction_id: str | None

    def to_dict(self) -> dict[str, str | int | None]:
        return {
            "pending_id": self.pending_id,
            "rule_id": self.rule_id,
            "month": self.month,
            "name": self.name,
            "amount": self.amount,
            "due_date": self.due_date,
            "account_id": self.account_id,
            "card_id": self.card_id,
            "payment_method": self.payment_method,
            "category_id": self.category_id,
            "description": self.description,
            "status": self.status,
            "transaction_id": self.transaction_id,
        }


@dataclass(frozen=True)
class BudgetProjection:
    category_id: str
    month: str
    limit: int
    spent: int
    usage_percent: int
    status: str

    def to_dict(self) -> dict[str, str | int]:
        return {
            "category_id": self.category_id,
            "month": self.month,
            "limit": self.limit,
            "spent": self.spent,
            "usage_percent": self.usage_percent,
            "status": self.status,
        }


@dataclass(frozen=True)
class InvestmentMovementProjection:
    movement_id: str
    occurred_at: str
    type: str
    account_id: str
    description: str | None
    contribution_amount: int
    dividend_amount: int
    cash_amount: int
    invested_amount: int
    cash_delta: int
    invested_delta: int

    def to_dict(self) -> dict[str, str | int | None]:
        return {
            "movement_id": self.movement_id,
            "occurred_at": self.occurred_at,
            "type": self.type,
            "account_id": self.account_id,
            "description": self.description,
            "contribution_amount": self.contribution_amount,
            "dividend_amount": self.dividend_amount,
            "cash_amount": self.cash_amount,
            "invested_amount": self.invested_amount,
            "cash_delta": self.cash_delta,
            "invested_delta": self.invested_delta,
        }


@dataclass(frozen=True)
class UnifiedMovementProjection:
    movement_id: str
    kind: str
    origin_type: str
    title: str
    description: str | None
    amount: int
    posted_at: str
    competence_month: str
    account_id: str
    card_id: str | None
    payment_method: str
    category_id: str
    counterparty: str | None
    lifecycle_status: str
    edit_policy: str
    parent_id: str | None
    group_id: str | None
    transfer_direction: str | None
    installment_number: int | None
    installment_total: int | None
    source_event_type: str

    def to_dict(self) -> dict[str, str | int | None]:
        return {
            "movement_id": self.movement_id,
            "kind": self.kind,
            "origin_type": self.origin_type,
            "title": self.title,
            "description": self.description,
            "amount": self.amount,
            "posted_at": self.posted_at,
            "competence_month": self.competence_month,
            "account_id": self.account_id,
            "card_id": self.card_id,
            "payment_method": self.payment_method,
            "category_id": self.category_id,
            "counterparty": self.counterparty,
            "lifecycle_status": self.lifecycle_status,
            "edit_policy": self.edit_policy,
            "parent_id": self.parent_id,
            "group_id": self.group_id,
            "transfer_direction": self.transfer_direction,
            "installment_number": self.installment_number,
            "installment_total": self.installment_total,
            "source_event_type": self.source_event_type,
        }
