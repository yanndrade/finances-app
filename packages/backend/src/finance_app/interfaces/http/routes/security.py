from urllib.parse import quote

from fastapi import APIRouter
from fastapi import HTTPException
from fastapi import Query
from fastapi import Request
from fastapi import Response
from fastapi import status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from pydantic import Field

from finance_app.application.security import CreatePasswordUseCase
from finance_app.application.security import IssuePairTokenUseCase
from finance_app.application.security import ListAuthorizedDevicesUseCase
from finance_app.application.security import LockAppUseCase
from finance_app.application.security import PairDeviceUseCase
from finance_app.application.security import ReadLanSecurityStateUseCase
from finance_app.application.security import RevokeAuthorizedDeviceUseCase
from finance_app.application.security import SetLanEnabledUseCase
from finance_app.application.security import UnlockAppUseCase
from finance_app.infrastructure.security import SecurityStore


class SetPasswordRequest(BaseModel):
    password: str = Field(min_length=1)
    inactivity_lock_seconds: int | None = Field(default=None, ge=0)


class UnlockRequest(BaseModel):
    password: str = Field(min_length=1)


class LanToggleRequest(BaseModel):
    enabled: bool


class PairDeviceRequest(BaseModel):
    pair_token: str = Field(min_length=1)
    device_name: str | None = Field(default=None, max_length=160)


def build_security_router(security_store: SecurityStore) -> APIRouter:
    router = APIRouter()
    create_password = CreatePasswordUseCase(security_store)
    lock_app = LockAppUseCase(security_store)
    unlock_app = UnlockAppUseCase(security_store)
    read_lan_state = ReadLanSecurityStateUseCase(security_store)
    set_lan_enabled = SetLanEnabledUseCase(security_store)
    issue_pair_token = IssuePairTokenUseCase(security_store)
    pair_device = PairDeviceUseCase(security_store)
    list_devices = ListAuthorizedDevicesUseCase(security_store)
    revoke_device = RevokeAuthorizedDeviceUseCase(security_store)

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

    @router.get("/api/security/lan")
    def read_lan_security_state(request: Request) -> dict[str, bool | int | str | None]:
        state = read_lan_state.execute()
        network = security_store.resolve_lan_network()

        if network is None:
            local_ip = None
            subnet = None
            public_url = None
        else:
            local_ip = network.local_ip
            subnet = network.subnet_cidr
            public_url = f"{_read_public_scheme(request)}://{local_ip}:{_read_public_port(request)}"

        return {
            "enabled": state.enabled,
            "pair_token_ttl_seconds": state.pair_token_ttl_seconds,
            "local_ip": local_ip,
            "subnet_cidr": subnet,
            "public_url": public_url,
            "public_scheme": _read_public_scheme(request),
        }

    @router.post("/api/security/lan")
    def update_lan_security_state(payload: LanToggleRequest) -> dict[str, bool | int]:
        updated = set_lan_enabled.execute(payload.enabled)
        return {
            "enabled": updated.enabled,
            "pair_token_ttl_seconds": updated.pair_token_ttl_seconds,
        }

    @router.post("/api/security/lan/pair-token")
    def create_pair_token(request: Request) -> dict[str, str]:
        lan_state = read_lan_state.execute()
        if not lan_state.enabled:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="LAN mode is disabled.",
            )

        network = security_store.resolve_lan_network()
        if network is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No private LAN network detected.",
            )

        pair_token = issue_pair_token.execute()
        pairing_url = _build_pairing_url(
            request=request,
            local_ip=network.local_ip,
            pair_token=pair_token.token,
        )
        return {
            "pair_token": pair_token.token,
            "expires_at": pair_token.expires_at,
            "pairing_url": pairing_url,
        }

    @router.get("/api/security/pair", response_class=HTMLResponse)
    def pairing_bootstrap_page(
        pair_token: str = Query(min_length=1),
    ) -> str:
        safe_token = pair_token.replace("\\", "\\\\").replace('"', '\\"')
        return f"""
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Finance App Pairing</title>
    <style>
      body {{
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        margin: 0;
        padding: 24px;
        background: #0b1020;
        color: #e9edf6;
      }}
      .card {{
        max-width: 460px;
        margin: 0 auto;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 12px;
        padding: 18px;
        background: rgba(255, 255, 255, 0.04);
      }}
      input {{
        width: 100%;
        height: 40px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.28);
        padding: 0 12px;
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
      }}
      button {{
        margin-top: 12px;
        width: 100%;
        height: 40px;
        border-radius: 8px;
        border: none;
        background: #3dd6a0;
        color: #062719;
        font-weight: 700;
      }}
      #status {{
        margin-top: 12px;
        font-size: 14px;
      }}
    </style>
  </head>
  <body>
    <div class="card">
      <h1 style="margin-top: 0; font-size: 20px;">Pair device</h1>
      <p style="font-size: 14px; opacity: 0.9;">
        Authorize this mobile browser for LAN access.
      </p>
      <label for="deviceName" style="display: block; font-size: 13px; margin-bottom: 6px;">
        Device name
      </label>
      <input id="deviceName" type="text" />
      <button id="pairButton" type="button">Pair device</button>
      <p id="status"></p>
    </div>
    <script>
      const pairToken = "{safe_token}";
      const deviceNameInput = document.getElementById("deviceName");
      const status = document.getElementById("status");
      const pairButton = document.getElementById("pairButton");

      if (deviceNameInput && !deviceNameInput.value) {{
        deviceNameInput.value = navigator.userAgent.slice(0, 80);
      }}

      pairButton?.addEventListener("click", async () => {{
        if (!status) return;
        status.textContent = "Pairing device...";
        try {{
          const response = await fetch("/api/security/pair", {{
            method: "POST",
            headers: {{
              "Content-Type": "application/json",
            }},
            body: JSON.stringify({{
              pair_token: pairToken,
              device_name: deviceNameInput?.value || undefined,
            }}),
          }});

          const payload = await response.json();
          if (!response.ok) {{
            status.textContent = payload?.detail || "Failed to pair device.";
            return;
          }}

          localStorage.setItem("finance.device_token", payload.device_token);
          status.textContent = "Device paired. Redirecting to app...";
          window.location.replace("/");
        }} catch (_error) {{
          status.textContent = "Failed to pair device.";
        }}
      }});
    </script>
  </body>
</html>
"""

    @router.post("/api/security/pair")
    def pair_mobile_device(payload: PairDeviceRequest) -> dict[str, str]:
        paired = pair_device.execute(
            pair_token=payload.pair_token,
            device_name=payload.device_name,
        )
        if paired is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or expired pairing token.",
            )

        return {
            "device_id": paired.device_id,
            "device_token": paired.device_token,
            "paired_at": paired.created_at,
        }

    @router.get("/api/security/devices")
    def list_authorized_devices() -> list[dict[str, str | None]]:
        devices = list_devices.execute()
        return [
            {
                "device_id": device.device_id,
                "name": device.name,
                "created_at": device.created_at,
                "last_seen_at": device.last_seen_at,
                "last_seen_ip": device.last_seen_ip,
                "revoked_at": device.revoked_at,
            }
            for device in devices
        ]

    @router.delete(
        "/api/security/devices/{device_id}",
        status_code=status.HTTP_204_NO_CONTENT,
    )
    def revoke_authorized_device(device_id: str) -> Response:
        if not revoke_device.execute(device_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device not found.",
            )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return router


def _read_public_scheme(request: Request) -> str:
    value = getattr(request.app.state, "public_scheme", "http")
    return value if isinstance(value, str) and value else "http"


def _read_public_port(request: Request) -> int:
    value = getattr(request.app.state, "public_port", 8000)
    if isinstance(value, int):
        return value
    return request.url.port or 8000


def _build_pairing_url(*, request: Request, local_ip: str, pair_token: str) -> str:
    scheme = _read_public_scheme(request)
    port = _read_public_port(request)
    return (
        f"{scheme}://{local_ip}:{port}/api/security/pair"
        f"?pair_token={quote(pair_token, safe='')}"
    )
