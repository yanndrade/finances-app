from typing import Protocol

from finance_app.domain.security import AuthorizedDevice
from finance_app.domain.security import DevicePairingResult
from finance_app.domain.security import LanNetworkInfo
from finance_app.domain.security import LanSecurityState
from finance_app.domain.security import PairToken

class SecurityGateway(Protocol):
    def set_password(self, password: str, inactivity_lock_seconds: int | None = None) -> None: ...
    def verify_password(self, password: str) -> bool: ...
    def lock(self) -> None: ...
    def unlock(self, password: str) -> bool: ...
    def read_lan_security_state(self) -> LanSecurityState: ...
    def set_lan_enabled(self, enabled: bool) -> LanSecurityState: ...
    def issue_pair_token(self) -> PairToken: ...
    def pair_device(self, pair_token: str, device_name: str | None = None) -> DevicePairingResult | None: ...
    def list_authorized_devices(self) -> list[AuthorizedDevice]: ...
    def revoke_device(self, device_id: str) -> bool: ...
    def verify_device_token(self, device_token: str, *, request_ip: str | None = None) -> bool: ...
    def resolve_lan_network(self) -> LanNetworkInfo | None: ...


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


class ReadLanSecurityStateUseCase:
    def __init__(self, gateway: SecurityGateway) -> None:
        self._gateway = gateway

    def execute(self) -> LanSecurityState:
        return self._gateway.read_lan_security_state()


class SetLanEnabledUseCase:
    def __init__(self, gateway: SecurityGateway) -> None:
        self._gateway = gateway

    def execute(self, enabled: bool) -> LanSecurityState:
        return self._gateway.set_lan_enabled(enabled)


class IssuePairTokenUseCase:
    def __init__(self, gateway: SecurityGateway) -> None:
        self._gateway = gateway

    def execute(self) -> PairToken:
        return self._gateway.issue_pair_token()


class PairDeviceUseCase:
    def __init__(self, gateway: SecurityGateway) -> None:
        self._gateway = gateway

    def execute(
        self,
        pair_token: str,
        device_name: str | None = None,
    ) -> DevicePairingResult | None:
        return self._gateway.pair_device(pair_token=pair_token, device_name=device_name)


class ListAuthorizedDevicesUseCase:
    def __init__(self, gateway: SecurityGateway) -> None:
        self._gateway = gateway

    def execute(self) -> list[AuthorizedDevice]:
        return self._gateway.list_authorized_devices()


class RevokeAuthorizedDeviceUseCase:
    def __init__(self, gateway: SecurityGateway) -> None:
        self._gateway = gateway

    def execute(self, device_id: str) -> bool:
        return self._gateway.revoke_device(device_id)
