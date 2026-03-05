from fastapi import APIRouter

from finance_app.application.health import HealthCheckUseCase


def build_health_router() -> APIRouter:
    router = APIRouter()

    @router.get("/health")
    def health() -> dict[str, str]:
        return HealthCheckUseCase().execute()

    return router
