"""Authenticated local reverse proxy for exposing MiniPC Ollama and Z-Image-Turbo safely via Cloudflare Tunnel.

Listens on 127.0.0.1:11435 (by default) and forwards safe Ollama read/inference endpoints
to http://127.0.0.1:11434, plus local Z-Image-Turbo endpoints (`/zimage/status`, `/zimage/generate`),
after verifying `Authorization: Bearer <OLLAMA_TUNNEL_TOKEN>`.
"""

from __future__ import annotations

import base64
import hmac
import json
import os
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

LISTEN_HOST = os.environ.get("OLLAMA_PROXY_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("OLLAMA_PROXY_PORT", "11435"))
UPSTREAM_BASE = os.environ.get("OLLAMA_UPSTREAM_URL", "http://127.0.0.1:11434").rstrip("/")
N8N_UPSTREAM_BASE = os.environ.get("N8N_UPSTREAM_URL", "http://127.0.0.1:5678").rstrip("/")
REQUIRED_TOKEN = os.environ.get("OLLAMA_TUNNEL_TOKEN", "").strip()

ZIMAGE_DIR = Path(os.environ.get("ZIMAGE_DIR", r"C:\ai\stable-diffusion"))
ZIMAGE_CLI = ZIMAGE_DIR / "bin" / "sd-cli.exe"
ZIMAGE_MODELS_DIR = ZIMAGE_DIR / "models"
ZIMAGE_DIFFUSION = ZIMAGE_MODELS_DIR / "z_image_turbo-Q8_0.gguf"
ZIMAGE_VAE = ZIMAGE_MODELS_DIR / "ae.safetensors"
ZIMAGE_LLM = ZIMAGE_MODELS_DIR / "Qwen3-4B-Instruct-2507-Q8_0.gguf"
ZIMAGE_OUTPUT_DIR = ZIMAGE_DIR / "salidas"
_ZIMAGE_LOCK = threading.Lock()

ALLOWED_PATHS = {
    "/api/tags",
    "/api/version",
    "/api/show",
    "/api/chat",
    "/api/generate",
    "/api/embeddings",
    "/api/embed",
}


def _zimage_status_payload() -> dict[str, object]:
    missing: list[str] = []
    for label, p in (
        ("sd-cli.exe", ZIMAGE_CLI),
        ("z_image_turbo-Q8_0.gguf", ZIMAGE_DIFFUSION),
        ("ae.safetensors", ZIMAGE_VAE),
        ("Qwen3-4B-Instruct-2507-Q8_0.gguf", ZIMAGE_LLM),
    ):
        if not p.is_file():
            missing.append(label)
    recent: list[str] = []
    if ZIMAGE_OUTPUT_DIR.is_dir():
        pngs = sorted(ZIMAGE_OUTPUT_DIR.glob("*.png"), key=lambda x: x.stat().st_mtime, reverse=True)
        recent = [p.name for p in pngs[:5]]
    return {
        "available": len(missing) == 0,
        "engine": "stable-diffusion.cpp (Vulkan Radeon 780M)",
        "model": ZIMAGE_DIFFUSION.name,
        "text_encoder": ZIMAGE_LLM.name,
        "vae": ZIMAGE_VAE.name,
        "output_dir": str(ZIMAGE_OUTPUT_DIR),
        "missing_files": missing,
        "recent_outputs": recent,
    }


def _unload_ollama_models() -> None:
    """Unload any resident Ollama models so unified iGPU memory is free for Vulkan."""
    try:
        req = urllib.request.Request(f"{UPSTREAM_BASE}/api/ps", method="GET")
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        for item in data.get("models", []):
            name = item.get("name") or item.get("model")
            if not name:
                continue
            unload_body = json.dumps({"model": name, "prompt": "", "keep_alive": 0}).encode("utf-8")
            ureq = urllib.request.Request(
                f"{UPSTREAM_BASE}/api/generate",
                data=unload_body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urllib.request.urlopen(ureq, timeout=10):
                    pass
            except Exception:
                pass
    except Exception:
        pass


def _run_zimage_generation(prompt: str, width: int, height: int, steps: int, seed: int) -> dict[str, object]:
    status = _zimage_status_payload()
    if not status["available"]:
        raise RuntimeError(f"Z-Image no disponible (faltan archivos: {status['missing_files']})")

    ZIMAGE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = ZIMAGE_OUTPUT_DIR / f"zimage_kc_{ts}.png"

    width = max(512, min(1280, (int(width) // 64) * 64))
    height = max(512, min(1280, (int(height) // 64) * 64))
    steps = max(4, min(20, int(steps)))

    with _ZIMAGE_LOCK:
        _unload_ollama_models()
        t0 = time.perf_counter()
        cmd = [
            str(ZIMAGE_CLI),
            "--diffusion-model",
            str(ZIMAGE_DIFFUSION),
            "--vae",
            str(ZIMAGE_VAE),
            "--llm",
            str(ZIMAGE_LLM),
            "-p",
            prompt,
            "--cfg-scale",
            "1.0",
            "--steps",
            str(steps),
            "-W",
            str(width),
            "-H",
            str(height),
            "--seed",
            str(int(seed)),
            "-o",
            str(out_path),
        ]
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=360,
            check=False,
        )
        elapsed = round(time.perf_counter() - t0, 1)
        if not out_path.is_file():
            stderr_tail = (proc.stderr or proc.stdout or "").strip()[-400:]
            raise RuntimeError(f"sd-cli no generó la imagen (exit {proc.returncode}): {stderr_tail}")

        b64 = base64.b64encode(out_path.read_bytes()).decode("ascii")
        return {
            "ok": True,
            "mime_type": "image/png",
            "image_b64": b64,
            "output_path": str(out_path),
            "elapsed_seconds": elapsed,
            "width": width,
            "height": height,
            "steps": steps,
            "model": ZIMAGE_DIFFUSION.name,
        }


class OllamaAuthProxyHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        sys.stdout.write(f"[ollama-proxy] {self.address_string()} - {fmt % args}\n")
        sys.stdout.flush()

    def _send_json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _check_auth(self) -> bool:
        if not REQUIRED_TOKEN:
            return False
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return False
        provided = auth[len("Bearer "):].strip()
        return hmac.compare_digest(provided, REQUIRED_TOKEN)

    def _proxy(self, method: str) -> None:
        path_only = self.path.split("?", 1)[0]
        if path_only == "/proxy-health":
            self._send_json(
                200,
                {
                    "status": "ok",
                    "upstream": UPSTREAM_BASE,
                    "zimage_available": bool(_zimage_status_payload()["available"]),
                },
            )
            return

        if not self._check_auth():
            self._send_json(401, {"error": "Unauthorized: valid Bearer token required"})
            return

        if path_only == "/zimage/status" and method == "GET":
            self._send_json(200, _zimage_status_payload())
            return

        if path_only == "/zimage/generate" and method == "POST":
            length = int(self.headers.get("Content-Length", "0") or "0")
            raw = self.rfile.read(length) if length > 0 else b"{}"
            try:
                req_data = json.loads(raw.decode("utf-8") or "{}")
                prompt = str(req_data.get("prompt") or "").strip()
                if not prompt:
                    self._send_json(400, {"error": "Prompt is required"})
                    return
                res = _run_zimage_generation(
                    prompt=prompt,
                    width=int(req_data.get("width") or 768),
                    height=int(req_data.get("height") or 768),
                    steps=int(req_data.get("steps") or 8),
                    seed=int(req_data.get("seed") if req_data.get("seed") is not None else -1),
                )
                self._send_json(200, res)
            except Exception as exc:
                self._send_json(500, {"ok": False, "error": str(exc)})
            return

        if path_only in ("/n8n-proxy/api/v1/workflows", "/n8n-proxy/api/v1/executions") and method == "GET":
            n8n_key = self.headers.get("X-N8N-API-KEY", "").strip()
            if not n8n_key:
                self._send_json(401, {"error": "X-N8N-API-KEY header required"})
                return
            suffix = self.path[len("/n8n-proxy"):]
            n8n_url = f"{N8N_UPSTREAM_BASE}{suffix}"
            n8n_req = urllib.request.Request(
                n8n_url,
                headers={"Accept": "application/json", "X-N8N-API-KEY": n8n_key},
                method="GET",
            )
            try:
                with urllib.request.urlopen(n8n_req, timeout=12) as resp:
                    resp_body = resp.read()
                    self.send_response(resp.status)
                    self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
                    self.send_header("Content-Length", str(len(resp_body)))
                    self.end_headers()
                    self.wfile.write(resp_body)
            except urllib.error.HTTPError as err:
                err_body = err.read()
                self.send_response(err.code)
                self.send_header("Content-Type", err.headers.get("Content-Type", "application/json"))
                self.send_header("Content-Length", str(len(err_body)))
                self.end_headers()
                self.wfile.write(err_body)
            except Exception as exc:
                self._send_json(502, {"error": f"Upstream n8n error: {exc}"})
            return

        if path_only not in ALLOWED_PATHS:
            self._send_json(403, {"error": f"Path not allowed via tunnel: {path_only}"})
            return

        body: bytes | None = None
        if method in ("POST", "PUT", "PATCH"):
            length = int(self.headers.get("Content-Length", "0") or "0")
            body = self.rfile.read(length) if length > 0 else b""

        upstream_url = f"{UPSTREAM_BASE}{self.path}"
        headers = {"Accept": "application/json"}
        if body is not None:
            headers["Content-Type"] = self.headers.get("Content-Type", "application/json")

        req = urllib.request.Request(upstream_url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
                self.send_header("Content-Length", str(len(resp_body)))
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as err:
            err_body = err.read()
            self.send_response(err.code)
            self.send_header("Content-Type", err.headers.get("Content-Type", "application/json"))
            self.send_header("Content-Length", str(len(err_body)))
            self.end_headers()
            self.wfile.write(err_body)
        except Exception as exc:
            self._send_json(502, {"error": f"Upstream Ollama error: {exc}"})

    def do_GET(self) -> None:
        self._proxy("GET")

    def do_POST(self) -> None:
        self._proxy("POST")


def main() -> None:
    if not REQUIRED_TOKEN:
        sys.stderr.write("ERROR: OLLAMA_TUNNEL_TOKEN must be set before starting proxy.\n")
        sys.exit(1)
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), OllamaAuthProxyHandler)
    sys.stdout.write(f"[ollama-proxy] Listening on http://{LISTEN_HOST}:{LISTEN_PORT} -> {UPSTREAM_BASE}\n")
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
