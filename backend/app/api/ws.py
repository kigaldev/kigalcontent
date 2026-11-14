"""Real-time WebSocket event broadcaster for pipeline transitions, media QC, and HITL alerts."""

from __future__ import annotations

import json
import time
from typing import Any

from fastapi import WebSocket


class EventBroadcaster:
    """Maintains active WebSocket clients and broadcasts JSON events."""

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)
        await websocket.send_json(
            {
                "event": "CONNECTED",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "payload": {"message": "Subscribed to Autonomous Content Engine event stream"},
            }
        )

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def broadcast(self, event_type: str, payload: dict[str, Any]) -> None:
        message = json.dumps(
            {
                "event": event_type,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "payload": payload,
            }
        )
        stale: list[WebSocket] = []
        for ws in list(self._connections):
            try:
                await ws.send_text(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self._connections.discard(ws)


broadcaster = EventBroadcaster()
