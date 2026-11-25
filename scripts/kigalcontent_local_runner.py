"""Silent background supervisor for running KigalContent 100% locally on the MiniPC.

Manages two local services with zero port conflicts against Open WebUI (:3000), n8n (:5678),
Home Assistant (:8123), and native Ollama (:11434):
  1. FastAPI Backend + FFmpeg 9.1 + native Ollama GPU -> http://localhost:8000
  2. Next.js Standalone Frontend                      -> http://localhost:3001
"""

from __future__ import annotations

import logging
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from logging.handlers import RotatingFileHandler
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
FRONTEND_DIR = REPO_ROOT / "frontend"
LOG_FILE = REPO_ROOT / "kigalcontent_local.log"

BACKEND_PORT = int(os.environ.get("KIGAL_BACKEND_PORT", "8000"))
FRONTEND_PORT = int(os.environ.get("KIGAL_FRONTEND_PORT", "3001"))
LOCK_PORT = 18001
CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0


def _setup_logging() -> logging.Logger:
    logger = logging.getLogger("kigal_local")
    logger.setLevel(logging.INFO)
    handler = RotatingFileHandler(LOG_FILE, maxBytes=1_024_000, backupCount=2, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(handler)
    return logger


log = _setup_logging()


def _acquire_lock() -> socket.socket | None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(("127.0.0.1", LOCK_PORT))
        sock.listen(1)
        return sock
    except OSError:
        sock.close()
        return None


def _resolve_python() -> str:
    venv_py = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
    if venv_py.exists():
        return str(venv_py)
    return sys.executable


def _resolve_node() -> str:
    found = shutil.which("node")
    if found:
        return found
    for c in (
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "nodejs" / "node.exe",
    ):
        if c.exists():
            return str(c)
    raise FileNotFoundError("node.exe not found")


def _ensure_ollama() -> None:
    try:
        with urllib.request.urlopen("http://127.0.0.1:11434/api/tags", timeout=3) as resp:
            if resp.status == 200:
                return
    except Exception:
        pass
    ollama_app = Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Ollama" / "ollama app.exe"
    if ollama_app.exists():
        log.info("Launching native Ollama app: %s", ollama_app)
        try:
            subprocess.Popen([str(ollama_app)], creationflags=CREATE_NO_WINDOW)
        except Exception as exc:
            log.warning("Could not launch Ollama: %s", exc)


def _start_backend(python_bin: str) -> subprocess.Popen[bytes]:
    env = os.environ.copy()
    env.setdefault("PYTHONUTF8", "1")
    out_log = open(REPO_ROOT / "kigalcontent_backend.log", "ab")
    proc = subprocess.Popen(
        [
            python_bin,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            str(BACKEND_PORT),
        ],
        cwd=str(BACKEND_DIR),
        env=env,
        stdout=out_log,
        stderr=out_log,
        creationflags=CREATE_NO_WINDOW,
    )
    log.info("Started FastAPI Backend on http://0.0.0.0:%d (PID %d)", BACKEND_PORT, proc.pid)
    return proc


def _start_frontend(node_bin: str) -> subprocess.Popen[bytes]:
    env = os.environ.copy()
    env["PORT"] = str(FRONTEND_PORT)
    env["HOSTNAME"] = "0.0.0.0"
    env["BACKEND_URL"] = f"http://127.0.0.1:{BACKEND_PORT}"
    env["NEXT_PUBLIC_API_URL"] = f"http://localhost:{BACKEND_PORT}"

    standalone_server = FRONTEND_DIR / ".next" / "standalone" / "server.js"
    out_log = open(REPO_ROOT / "kigalcontent_frontend.log", "ab")

    if standalone_server.exists():
        cmd = [node_bin, str(standalone_server)]
        cwd = str(standalone_server.parent)
        mode = "standalone"
    else:
        next_bin = FRONTEND_DIR / "node_modules" / "next" / "dist" / "bin" / "next"
        cmd = [node_bin, str(next_bin), "dev", "--turbopack", "-p", str(FRONTEND_PORT), "-H", "0.0.0.0"]
        cwd = str(FRONTEND_DIR)
        mode = "dev"

    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        env=env,
        stdout=out_log,
        stderr=out_log,
        creationflags=CREATE_NO_WINDOW,
    )
    log.info("Started Next.js Frontend (%s) on http://0.0.0.0:%d (PID %d)", mode, FRONTEND_PORT, proc.pid)
    return proc


def main() -> None:
    lock_sock = _acquire_lock()
    if lock_sock is None:
        log.info("Local stack supervisor already running on lock port %d; exiting.", LOCK_PORT)
        return

    log.info("Starting KigalContent 100%% Local MiniPC Stack...")
    _ensure_ollama()
    python_bin = _resolve_python()
    node_bin = _resolve_node()

    backend_proc: subprocess.Popen[bytes] | None = None
    frontend_proc: subprocess.Popen[bytes] | None = None

    try:
        while True:
            if backend_proc is None or backend_proc.poll() is not None:
                if backend_proc is not None:
                    log.warning("Backend exited (code %s); restarting...", backend_proc.returncode)
                backend_proc = _start_backend(python_bin)

            if frontend_proc is None or frontend_proc.poll() is not None:
                if frontend_proc is not None:
                    log.warning("Frontend exited (code %s); restarting...", frontend_proc.returncode)
                frontend_proc = _start_frontend(node_bin)

            time.sleep(15)
    finally:
        for proc in (frontend_proc, backend_proc):
            if proc is not None and proc.poll() is None:
                try:
                    proc.terminate()
                except Exception:
                    pass
        lock_sock.close()


if __name__ == "__main__":
    main()
