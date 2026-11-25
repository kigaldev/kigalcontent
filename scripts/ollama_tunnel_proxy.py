"""Authenticated local reverse proxy for exposing MiniPC Ollama safely via Cloudflare Tunnel.

Listens on 127.0.0.1:11435 (by default) and forwards only safe Ollama read/inference endpoints
to http://127.0.0.1:11434 after verifying `Authorization: Bearer <OLLAMA_TUNNEL_TOKEN>`.
"""

from __future__ import annotations

import hmac
import json
import os
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LISTEN_HOST = os.environ.get("OLLAMA_PROXY_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("OLLAMA_PROXY_PORT", "11435"))
UPSTREAM_BASE = os.environ.get("OLLAMA_UPSTREAM_URL", "http://127.0.0.1:11434").rstrip("/")
REQUIRED_TOKEN = os.environ.get("OLLAMA_TUNNEL_TOKEN", "").strip()

ALLOWED_PATHS = {
    "/api/tags",
    "/api/version",
    "/api/show",
    "/api/chat",
    "/api/generate",
    "/api/embeddings",
    "/api/embed",
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
            self._send_json(200, {"status": "ok", "upstream": UPSTREAM_BASE})
            return

        if not self._check_auth():
            self._send_json(401, {"error": "Unauthorized: valid Bearer token required"})
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
