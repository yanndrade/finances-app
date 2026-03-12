from __future__ import annotations

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

    with_san = base_command + [
        "-addext",
        "subjectAltName=DNS:localhost,IP:127.0.0.1",
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
