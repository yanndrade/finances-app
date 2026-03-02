from fastapi import APIRouter, FastAPI

from finance_app.application.health import HealthCheckUseCase


def build_router() -> APIRouter:
    router = APIRouter()

    @router.get("/health")
    def health() -> dict[str, str]:
        return HealthCheckUseCase().execute()

    return router


def create_app() -> FastAPI:
    app = FastAPI(title="finance-app backend")
    app.include_router(build_router())
    return app
