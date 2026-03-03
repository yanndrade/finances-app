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

    def to_dict(self) -> dict[str, str | int | bool]:
        return {
            "card_id": self.card_id,
            "name": self.name,
            "limit": self.limit,
            "closing_day": self.closing_day,
            "due_day": self.due_day,
            "payment_account_id": self.payment_account_id,
            "is_active": self.is_active,
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
    description: str | None
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
            "description": self.description,
            "installment_number": self.installment_number,
            "installments_count": self.installments_count,
            "amount": self.amount,
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
