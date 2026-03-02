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
