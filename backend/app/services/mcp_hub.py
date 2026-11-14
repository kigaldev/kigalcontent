"""MCP Client Hub: JSON-RPC 2.0 schema validation and environment healthcheck."""

from __future__ import annotations

import json
import os
import shutil
import time
import uuid
from typing import Any

from app.core.config import get_settings


class MCPClientHub:
    """Manages configured MCP servers and validates JSON-RPC 2.0 tool invocations."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def load_registry(self) -> dict[str, Any]:
        path = self.settings.mcp_servers_path
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8")).get("mcpServers", {})
        return {}

    def healthcheck(self) -> dict[str, Any]:
        registry = self.load_registry()
        local_tools = {}
        for tool in ["ffmpeg", "ffprobe", "python3", "node", "npx"]:
            resolved = shutil.which(tool)
            local_tools[tool] = {"available": bool(resolved), "path": resolved}

        env_vars = {}
        for key in [
            "BRAVE_API_KEY",
            "YOUTUBE_CLIENT_SECRET_FILE",
            "INSTAGRAM_ACCESS_TOKEN",
            "TIKTOK_ACCESS_TOKEN",
            "LINKEDIN_ACCESS_TOKEN",
        ]:
            env_vars[key] = bool(os.environ.get(key))

        return {
            "status": "healthy" if local_tools["ffmpeg"]["available"] else "degraded",
            "local_tools": local_tools,
            "configured_servers": list(registry.keys()),
            "servers_detail": {
                name: {"command": cfg.get("command"), "description": cfg.get("description")}
                for name, cfg in registry.items()
            },
            "credentials_configured": env_vars,
            "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    def build_jsonrpc_call(self, server_name: str, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Construct a validated JSON-RPC 2.0 tool invocation envelope."""
        registry = self.load_registry()
        if server_name not in registry and server_name not in {
            "research_engine",
            "local_filesystem",
            "youtube_data",
            "meta_graph",
            "tiktok_marketing",
            "linkedin_api",
            "av_production_ffmpeg",
        }:
            raise ValueError(f"Unknown MCP server '{server_name}'.")

        return {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "server": server_name,
                "name": tool_name,
                "arguments": arguments,
            },
            "id": f"req-{uuid.uuid4().hex[:8]}",
        }
