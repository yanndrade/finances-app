from typing import Protocol


class SecurityGateway(Protocol):
    def set_password(self, password: str, inactivity_lock_seconds: int | None = None) -> None: ...
    def verify_password(self, password: str) -> bool: ...
    def lock(self) -> None: ...
    def unlock(self, password: str) -> bool: ...


class CreatePasswordUseCase:
    def __init__(self, gateway: SecurityGateway) -> None:
        self._gateway = gateway

    def execute(self, password: str, inactivity_lock_seconds: int | None = None) -> None:
        self._gateway.set_password(password, inactivity_lock_seconds)


class VerifyPasswordUseCase:
    def __init__(self, gateway: SecurityGateway) -> None:
        self._gateway = gateway

    def execute(self, password: str) -> bool:
        return self._gateway.verify_password(password)


class LockAppUseCase:
    def __init__(self, gateway: SecurityGateway) -> None:
        self._gateway = gateway

    def execute(self) -> None:
        self._gateway.lock()


class UnlockAppUseCase:
    def __init__(self, gateway: SecurityGateway) -> None:
        self._gateway = gateway

    def execute(self, password: str) -> bool:
        return self._gateway.unlock(password)
