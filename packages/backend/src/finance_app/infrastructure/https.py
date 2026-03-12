from __future__ import annotations

import ipaddress
import socket
import shutil
import subprocess
from pathlib import Path


def ensure_self_signed_certificate(
    cert_dir: Path,
    *,
    common_name: str = "finance-app.local",
) -> tuple[Path, Path]:
    cert_dir.mkdir(parents=True, exist_ok=True)
    cert_path = cert_dir / "server.crt"
    key_path = cert_dir / "server.key"

    if cert_path.exists() and key_path.exists():
        return cert_path, key_path

    openssl = shutil.which("openssl")
    if openssl is None:
        raise RuntimeError(
            "OpenSSL not found. Install OpenSSL or create server.crt/server.key manually."
        )

    base_command = [
        openssl,
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-sha256",
        "-days",
        "3650",
        "-nodes",
        "-keyout",
        str(key_path),
        "-out",
        str(cert_path),
        "-subj",
        f"/CN={common_name}",
    ]
    san_entries = ["DNS:localhost", "IP:127.0.0.1"]
    lan_ip = _discover_private_ipv4()
    if lan_ip is not None:
        san_entries.append(f"IP:{lan_ip}")

    with_san = base_command + [
        "-addext",
        f"subjectAltName={','.join(dict.fromkeys(san_entries))}",
    ]
    if _run_openssl(with_san):
        return cert_path, key_path

    if _run_openssl(base_command):
        return cert_path, key_path

    raise RuntimeError("Failed to generate self-signed certificate with OpenSSL.")


def _run_openssl(command: list[str]) -> bool:
    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return False

    return completed.returncode == 0


def _discover_private_ipv4() -> str | None:
    candidates: list[str] = []

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("10.255.255.255", 1))
            candidates.append(probe.getsockname()[0])
    except OSError:
        pass

    try:
        hostname = socket.gethostname()
        for family, _, _, _, sockaddr in socket.getaddrinfo(hostname, None):
            if family == socket.AF_INET:
                candidates.append(sockaddr[0])
    except OSError:
        pass

    seen: set[str] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        try:
            ip = ipaddress.ip_address(candidate)
        except ValueError:
            continue
        if (
            ip.version == 4
            and ip.is_private
            and not ip.is_loopback
            and not ip.is_link_local
            and not ip.is_multicast
        ):
            return candidate

    return None
