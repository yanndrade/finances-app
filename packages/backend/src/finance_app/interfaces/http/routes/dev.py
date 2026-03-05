from collections.abc import Callable

from fastapi import APIRouter

def build_dev_router(
    *,
    reset_events: Callable[[], None],
    reset_projections: Callable[[], None],
) -> APIRouter:
    router = APIRouter()

    @router.post("/api/dev/reset")
    def reset_application_data() -> dict[str, str]:
        reset_events()
        reset_projections()
        return {
            "status": "ok",
            "message": "Application data reset.",
        }

    return router
