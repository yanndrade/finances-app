from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class NewEvent:
    type: str
    timestamp: str
    payload: dict[str, Any]
    version: int


@dataclass(frozen=True)
class StoredEvent:
    event_id: int
    type: str
    timestamp: str
    payload: dict[str, Any]
    version: int
