"""Self-healing background watchdog for MiniPC Ollama authenticated Cloudflare Tunnel.

Designed to run silently via `pythonw.exe` on Windows login (Task Scheduler / Startup):
1. Ensures local Ollama (127.0.0.1:11434) is running (launches Ollama app if needed).
2. Runs the authenticated reverse proxy on 127.0.0.1:11435 in a background thread.
3. Launches `cloudflared` (hidden, no console window) pointing to 127.0.0.1:11435.
4. Syncs the live tunnel URL + Bearer token to Railway (preserving the user's chosen model).
5. Monitors the tunnel every 60s and auto-heals after sleep, network drops, or restarts.
"""

from __future__ import annotations

import json
import logging
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from logging.handlers import RotatingFileHandler
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

BACKEND_URL = os.environ.get(
    "KIGAL_BACKEND_URL",
    "https://autonomous-content-engine-backend-production.up.railway.app",
).rstrip("/")
DEFAULT_MODEL = os.environ.get("KIGAL_OLLAMA_MODEL", "qwen3.6:27b")
PROXY_HOST = "127.0.0.1"
PROXY_PORT = int(os.environ.get("OLLAMA_PROXY_PORT", "11435"))
OLLAMA_LOCAL_URL = "http://127.0.0.1:11434"
TOKEN_FILE = REPO_ROOT / ".ollama_tunnel_token"
URL_FILE = REPO_ROOT / ".ollama_tunnel_url"
LOG_FILE = REPO_ROOT / "ollama_watchdog.log"
LOCK_PORT = 11436  # Local loopback lock socket to enforce single watchdog instance

CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0
TUNNEL_URL_RE = re.compile(r"(https://[a-zA-Z0-9-]+\.trycloudflare\.com)")


def _setup_logging() -> logging.Logger:
    logger = logging.getLogger("ollama_watchdog")
    logger.setLevel(logging.INFO)
    handler = RotatingFileHandler(LOG_FILE, maxBytes=512_000, backupCount=2, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(handler)
    return logger


log = _setup_logging()


def _acquire_single_instance_lock() -> socket.socket | None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(("127.0.0.1", LOCK_PORT))
        sock.listen(1)
        return sock
    except OSError:
        sock.close()
        return None


def _load_or_create_token() -> str:
    if TOKEN_FILE.exists():
        tok = TOKEN_FILE.read_text(encoding="utf-8").strip()
        if tok:
            return tok
    tok = secrets.token_hex(32)
    TOKEN_FILE.write_text(tok, encoding="utf-8")
    log.info("Generated new 256-bit Bearer token in %s", TOKEN_FILE.name)
    return tok


def _find_cloudflared() -> str:
    found = shutil.which("cloudflared")
    if found:
        return found
    for candidate in (
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "cloudflared" / "cloudflared.exe",
        Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "cloudflared" / "cloudflared.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Links" / "cloudflared.exe",
    ):
        if candidate.exists():
            return str(candidate)
    raise FileNotFoundError("cloudflared executable not found")


def _get_local_ollama_models(timeout: float = 4.0) -> list[str]:
    try:
        with urllib.request.urlopen(f"{OLLAMA_LOCAL_URL}/api/tags", timeout=timeout) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                return [m.get("name", "") for m in data.get("models", []) if m.get("name")]
    except Exception:
        pass
    return []


def _ensure_local_ollama() -> list[str]:
    models = _get_local_ollama_models()
    if models:
        return models

    # On boot Ollama may still be starting up; wait briefly before launching it
    for _ in range(6):
        time.sleep(3)
        models = _get_local_ollama_models()
        if models:
            return models

    ollama_app = Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Ollama" / "ollama app.exe"
    if ollama_app.exists():
        log.info("Local Ollama not responding; launching %s", ollama_app)
        try:
            subprocess.Popen([str(ollama_app)], creationflags=CREATE_NO_WINDOW)
        except Exception as exc:
            log.warning("Could not launch Ollama app: %s", exc)

    for _ in range(20):
        time.sleep(3)
        models = _get_local_ollama_models()
        if models:
            log.info("Local Ollama ready with %d model(s).", len(models))
            return models
    return []


def _start_proxy_thread(token: str) -> ThreadingHTTPServer:
    os.environ["OLLAMA_TUNNEL_TOKEN"] = token
    os.environ["OLLAMA_PROXY_PORT"] = str(PROXY_PORT)
    import ollama_tunnel_proxy as proxy_mod

    proxy_mod.REQUIRED_TOKEN = token
    proxy_mod.LISTEN_HOST = PROXY_HOST
    proxy_mod.LISTEN_PORT = PROXY_PORT
    proxy_mod.UPSTREAM_BASE = OLLAMA_LOCAL_URL

    # Quiet proxy stdout when running under pythonw
    proxy_mod.OllamaAuthProxyHandler.log_message = lambda self, fmt, *args: None  # type: ignore[method-assign]

    server = ThreadingHTTPServer((PROXY_HOST, PROXY_PORT), proxy_mod.OllamaAuthProxyHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    log.info("Authenticated proxy listening on http://%s:%d -> %s", PROXY_HOST, PROXY_PORT, OLLAMA_LOCAL_URL)
    return server


def _verify_tunnel(tunnel_url: str, token: str, timeout: float = 8.0) -> bool:
    req = urllib.request.Request(
        f"{tunnel_url.rstrip('/')}/api/tags",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status == 200
    except Exception:
        return False


def _sync_backend(tunnel_url: str, token: str, installed_models: list[str]) -> bool:
    chosen_model = DEFAULT_MODEL if DEFAULT_MODEL in installed_models else (installed_models[0] if installed_models else DEFAULT_MODEL)
    # Preserve whichever installed model the user currently selected in the UI
    try:
        with urllib.request.urlopen(f"{BACKEND_URL}/api/v1/llm/config", timeout=10) as resp:
            if resp.status == 200:
                current = json.loads(resp.read().decode("utf-8"))
                cur_model = str(current.get("ollama_model") or "")
                if cur_model and cur_model in installed_models:
                    chosen_model = cur_model
    except Exception:
        pass

    payload = json.dumps(
        {
            "active_provider": "auto",
            "ollama_base_url": tunnel_url,
            "ollama_model": chosen_model,
            "ollama_api_key": token,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{BACKEND_URL}/api/v1/llm/config",
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                log.info(
                    "Synced to Railway -> model=%s reachable=%s models=%d",
                    data.get("ollama_model"),
                    data.get("ollama_reachable"),
                    len(data.get("ollama_models_detected") or []),
                )
                return True
    except Exception as exc:
        log.warning("Failed syncing tunnel URL to Railway: %s", exc)
    return False


def _spawn_tunnel(cloudflared_bin: str) -> tuple[subprocess.Popen[bytes], str | None]:
    cf_log = REPO_ROOT / "ollama_tunnel_live.log"
    try:
        if cf_log.exists():
            cf_log.unlink()
    except Exception:
        pass

    proc = subprocess.Popen(
        [
            cloudflared_bin,
            "tunnel",
            "--no-autoupdate",
            "--url",
            f"http://{PROXY_HOST}:{PROXY_PORT}",
            "--logfile",
            str(cf_log),
        ],
        cwd=str(REPO_ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=CREATE_NO_WINDOW,
    )

    tunnel_url: str | None = None
    for _ in range(50):
        if proc.poll() is not None:
            break
        if cf_log.exists():
            try:
                content = cf_log.read_text(encoding="utf-8", errors="ignore")
                match = TUNNEL_URL_RE.search(content)
                if match:
                    tunnel_url = match.group(1)
                    break
            except Exception:
                pass
        time.sleep(0.5)

    return proc, tunnel_url


def main() -> None:
    lock_sock = _acquire_single_instance_lock()
    if lock_sock is None:
        log.info("Watchdog already running on lock port %d; exiting duplicate instance.", LOCK_PORT)
        return

    log.info("Starting KigalContent MiniPC Ollama Tunnel Watchdog...")
    token = _load_or_create_token()
    cloudflared_bin = _find_cloudflared()
    models = _ensure_local_ollama()
    if not models:
        log.warning("Ollama did not report models at startup; continuing watchdog loop.")

    _start_proxy_thread(token)

    proc: subprocess.Popen[bytes] | None = None
    tunnel_url: str | None = None
    consecutive_failures = 0

    try:
        while True:
            need_restart = proc is None or proc.poll() is not None or not tunnel_url

            if not need_restart and tunnel_url:
                if _verify_tunnel(tunnel_url, token):
                    consecutive_failures = 0
                else:
                    consecutive_failures += 1
                    log.warning("Tunnel health check failed (%d/3) for %s", consecutive_failures, tunnel_url)
                    if consecutive_failures >= 3:
                        need_restart = True

            if need_restart:
                if proc is not None and proc.poll() is None:
                    try:
                        proc.terminate()
                        proc.wait(timeout=5)
                    except Exception:
                        proc.kill()

                models = _get_local_ollama_models() or _ensure_local_ollama()
                proc, tunnel_url = _spawn_tunnel(cloudflared_bin)
                if not tunnel_url:
                    log.warning("cloudflared did not yield a URL; retrying in 15s...")
                    time.sleep(15)
                    continue

                URL_FILE.write_text(tunnel_url, encoding="utf-8")
                log.info("Cloudflare Tunnel live: %s (PID %d)", tunnel_url, proc.pid)

                # Wait briefly for Cloudflare edge DNS propagation before syncing to Railway
                for _ in range(10):
                    if _verify_tunnel(tunnel_url, token):
                        break
                    time.sleep(2)

                for _ in range(5):
                    if _sync_backend(tunnel_url, token, models):
                        break
                    time.sleep(5)
                consecutive_failures = 0

            time.sleep(60)
    finally:
        if proc is not None and proc.poll() is None:
            proc.terminate()
        lock_sock.close()


if __name__ == "__main__":
    main()
