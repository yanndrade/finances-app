from finance_app.domain.health import HealthStatus


class HealthCheckUseCase:
    """Minimal application service used by interface smoke tests."""

    def execute(self) -> dict[str, str]:
        status = HealthStatus()
        return {"status": status.status, "source": status.source}
