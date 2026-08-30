from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

from finance_app.domain.events import NewEvent


class CardServiceError(Exception):
    pass


class CardNotFoundError(CardServiceError):
    pass


class CardAlreadyExistsError(CardServiceError):
    pass


class InvalidCardLimitError(CardServiceError):
    pass


class InvalidCardCycleDayError(CardServiceError):
    pass


class CardHolderNotFoundError(CardServiceError):
    pass


class InvalidCardHolderError(CardServiceError):
    pass


class CardEventStore(Protocol):
    def create_schema(self) -> None: ...
    def append(self, event: NewEvent) -> int: ...


class CardProjector(Protocol):
    def run(self) -> int: ...
    def list_cards(self) -> list[dict[str, str | int | bool]]: ...
    def list_card_holders(
        self,
        *,
        card_id: str | None = None,
    ) -> list[dict[str, str | int | bool | None]]: ...


class AccountReader(Protocol):
    def get_account(self, account_id: str) -> dict[str, str | int | bool]: ...


class CardService:
    def __init__(
        self,
        event_store: CardEventStore,
        projector: CardProjector,
        account_reader: AccountReader,
    ) -> None:
        self._event_store = event_store
        self._projector = projector
        self._account_reader = account_reader

    def list_cards(self) -> list[dict[str, str | int | bool]]:
        self._sync_projections()
        return self._projector.list_cards()

    def create_card(
        self,
        *,
        card_id: str,
        name: str,
        limit_amount: int,
        closing_day: int,
        due_day: int,
        payment_account_id: str | None = None,
    ) -> dict[str, str | int | bool]:
        self._sync_projections()
        if self._find_card(card_id) is not None:
            raise CardAlreadyExistsError(f"Card '{card_id}' already exists.")

        normalized_payment_account_id = self._normalize_payment_account_id(payment_account_id)

        payload = {
            "id": card_id,
            "name": name,
            "limit": limit_amount,
            "closing_day": closing_day,
            "due_day": due_day,
            "payment_account_id": normalized_payment_account_id,
            "is_active": True,
        }

        self._validate_payload(payload)
        if normalized_payment_account_id:
            self._account_reader.get_account(normalized_payment_account_id)
        self._append_event("CardCreated", payload)
        return self.get_card(card_id)

    def update_card(
        self,
        card_id: str,
        *,
        name: str | None = None,
        limit_amount: int | None = None,
        closing_day: int | None = None,
        due_day: int | None = None,
        payment_account_id: str | None = None,
        is_active: bool | None = None,
    ) -> dict[str, str | int | bool]:
        self._sync_projections()
        existing = self._find_card(card_id)

        if existing is None:
            raise CardNotFoundError(f"Card '{card_id}' was not found.")

        merged = {
            "id": card_id,
            "name": name if name is not None else str(existing["name"]),
            "limit": limit_amount if limit_amount is not None else int(existing["limit"]),
            "closing_day": (
                closing_day if closing_day is not None else int(existing["closing_day"])
            ),
            "due_day": due_day if due_day is not None else int(existing["due_day"]),
            "payment_account_id": (
                self._normalize_payment_account_id(payment_account_id)
                if payment_account_id is not None
                else str(existing["payment_account_id"])
            ),
            "is_active": is_active if is_active is not None else bool(existing["is_active"]),
        }

        self._validate_payload(merged)
        if str(merged["payment_account_id"]):
            self._account_reader.get_account(str(merged["payment_account_id"]))

        comparable = {
            "name": merged["name"],
            "limit": merged["limit"],
            "closing_day": merged["closing_day"],
            "due_day": merged["due_day"],
            "payment_account_id": merged["payment_account_id"],
            "is_active": merged["is_active"],
        }
        if all(existing[key] == value for key, value in comparable.items()):
            return self.get_card(card_id)

        self._append_event("CardUpdated", merged)
        return self.get_card(card_id)

    def get_card(self, card_id: str) -> dict[str, str | int | bool]:
        self._sync_projections()
        card = self._find_card(card_id)

        if card is None:
            raise CardNotFoundError(f"Card '{card_id}' was not found.")

        return card

    def list_holders(
        self,
        card_id: str,
    ) -> list[dict[str, str | int | bool | None]]:
        self.get_card(card_id)
        return self._projector.list_card_holders(card_id=card_id)

    def upsert_holder(
        self,
        *,
        card_id: str,
        holder_id: str,
        name: str,
        last_four: str | None = None,
        is_primary: bool = False,
        sub_limit: int | None = None,
        reimbursable_person_id: str | None = None,
        is_active: bool = True,
    ) -> dict[str, str | int | bool | None]:
        card = self.get_card(card_id)
        normalized_last_four = self._normalize_last_four(last_four)
        self._validate_holder_payload(
            name=name,
            sub_limit=sub_limit,
            card_limit=int(card["limit"]),
        )

        holders = self._projector.list_card_holders(card_id=card_id)
        for holder in holders:
            if holder["holder_id"] == holder_id:
                continue
            if is_primary and bool(holder["is_primary"]):
                raise InvalidCardHolderError(
                    f"Card '{card_id}' already has a primary holder."
                )
            if (
                normalized_last_four is not None
                and holder["last_four"] == normalized_last_four
            ):
                raise InvalidCardHolderError(
                    f"Another holder of card '{card_id}' already uses "
                    f"the digits '{normalized_last_four}'."
                )

        self._append_event(
            "CardHolderUpserted",
            {
                "id": holder_id,
                "card_id": card_id,
                "name": name.strip(),
                "last_four": normalized_last_four,
                "is_primary": is_primary,
                "sub_limit": sub_limit,
                "reimbursable_person_id": (
                    reimbursable_person_id.strip()
                    if reimbursable_person_id and reimbursable_person_id.strip()
                    else None
                ),
                "is_active": is_active,
            },
        )
        return self.get_holder(holder_id)

    def get_holder(self, holder_id: str) -> dict[str, str | int | bool | None]:
        self._sync_projections()
        holder = self._find_holder(holder_id)
        if holder is None:
            raise CardHolderNotFoundError(f"Card holder '{holder_id}' was not found.")
        return holder

    def remove_holder(self, holder_id: str) -> dict[str, str]:
        self.get_holder(holder_id)
        self._append_event("CardHolderRemoved", {"id": holder_id})
        return {"holder_id": holder_id, "status": "removed"}

    def _find_holder(self, holder_id: str) -> dict[str, str | int | bool | None] | None:
        for holder in self._projector.list_card_holders():
            if holder["holder_id"] == holder_id:
                return holder
        return None

    def _validate_holder_payload(
        self,
        *,
        name: str,
        sub_limit: int | None,
        card_limit: int,
    ) -> None:
        if not name.strip():
            raise InvalidCardHolderError("name is required.")
        if sub_limit is None:
            return
        if sub_limit <= 0:
            raise InvalidCardHolderError("sub_limit must be greater than zero.")
        if sub_limit > card_limit:
            raise InvalidCardHolderError(
                "sub_limit cannot exceed the card's shared limit."
            )

    def _normalize_last_four(self, last_four: str | None) -> str | None:
        if last_four is None:
            return None
        normalized = last_four.strip()
        if not normalized:
            return None
        if not normalized.isdigit() or len(normalized) != 4:
            raise InvalidCardHolderError("last_four must be exactly 4 digits.")
        return normalized

    def _validate_payload(self, payload: dict[str, str | int | bool]) -> None:
        if int(payload["limit"]) <= 0:
            raise InvalidCardLimitError("limit must be greater than zero.")

        self._validate_cycle_day(int(payload["closing_day"]), "closing_day")
        self._validate_cycle_day(int(payload["due_day"]), "due_day")

        if not str(payload["name"]).strip():
            raise CardServiceError("name is required.")

    def _validate_cycle_day(self, value: int, field_name: str) -> None:
        if value < 1 or value > 28:
            raise InvalidCardCycleDayError(f"{field_name} must be between 1 and 28.")

    def _append_event(
        self,
        event_type: str,
        payload: dict[str, str | int | bool | None],
    ) -> None:
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

    def _find_card(self, card_id: str) -> dict[str, str | int | bool] | None:
        for card in self._projector.list_cards():
            if card["card_id"] == card_id:
                return card

        return None

    def _normalize_payment_account_id(self, payment_account_id: str | None) -> str:
        if payment_account_id is None:
            return ""

        return payment_account_id.strip()

    def _utc_now(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
