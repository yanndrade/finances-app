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

    def to_dict(self) -> dict[str, str | int | None]:
        return {
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
