from dataclasses import dataclass


@dataclass(frozen=True)
class HealthStatus:
    status: str = "ok"
    source: str = "application"
