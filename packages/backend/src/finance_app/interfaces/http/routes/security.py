from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field

from finance_app.application.security import (
    CreatePasswordUseCase,
    LockAppUseCase,
    UnlockAppUseCase,
)
from finance_app.infrastructure.security import SecurityStore


class SetPasswordRequest(BaseModel):
    password: str = Field(min_length=1)
    inactivity_lock_seconds: int | None = Field(default=None, ge=0)


class UnlockRequest(BaseModel):
    password: str = Field(min_length=1)


def build_security_router(security_store: SecurityStore) -> APIRouter:
    router = APIRouter()
    create_password = CreatePasswordUseCase(security_store)
    lock_app = LockAppUseCase(security_store)
    unlock_app = UnlockAppUseCase(security_store)

    @router.get("/api/security/state")
    def read_security_state() -> dict[str, bool | int | None]:
        state = security_store.read_security_state()
        return {
            "password_configured": bool(state.password_hash),
            "is_locked": state.is_locked,
            "requires_lock_on_startup": security_store.requires_lock_on_startup(),
            "inactivity_lock_seconds": state.inactivity_lock_seconds,
        }

    @router.post("/api/security/password", status_code=status.HTTP_204_NO_CONTENT)
    def set_password(payload: SetPasswordRequest) -> Response:
        create_password.execute(
            payload.password,
            inactivity_lock_seconds=payload.inactivity_lock_seconds,
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @router.post("/api/security/lock", status_code=status.HTTP_204_NO_CONTENT)
    def lock_application() -> Response:
        lock_app.execute()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @router.post("/api/security/unlock")
    def unlock_application(payload: UnlockRequest) -> dict[str, bool]:
        if not unlock_app.execute(payload.password):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid password.",
            )
        return {"unlocked": True}

    return router
