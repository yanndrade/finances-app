from typing import Protocol

from finance_app.domain.events import NewEvent


class EventWriter(Protocol):
    def append(self, event: NewEvent) -> int: ...
    def append_batch(self, events: list[NewEvent]) -> list[int]: ...


class AppendEventUseCase:
    def __init__(self, event_store: EventWriter) -> None:
        self._event_store = event_store

    def execute(self, event: NewEvent) -> int:
        return self._event_store.append(event)
