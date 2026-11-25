"""FastAPI Application Entrypoint for Autonomous Content Engine Web."""

from __future__ import annotations

import asyncio
import contextlib
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_v1_router
from app.api.ws import broadcaster
from app.core.config import get_settings
from app.db.session import AsyncSessionLocal, init_db
from app.services.publishing_scheduler import scheduler_background_loop
from app.services.seed import seed_initial_data
from app.services.skill_llm_router import get_llm_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        await init_db()
        async with AsyncSessionLocal() as db:
            await seed_initial_data(db)
            await get_llm_router().sync_from_db(db)
    except Exception as exc:
        import logging
        logging.getLogger("uvicorn.error").warning("DB init deferred/failed on cold-start: %s", exc)

    scheduler_task: asyncio.Task[None] | None = None
    if not os.environ.get("PYTEST_CURRENT_TEST") and not os.environ.get("VERCEL"):
        scheduler_task = asyncio.create_task(scheduler_background_loop(60))
    try:
        yield
    finally:
        if scheduler_task is not None:
            scheduler_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await scheduler_task


settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    version="2.0.0",
    description="Autonomous Content Engine Web API — Multi-Agent Content OS with Temporal, FFmpeg/Whisper & HITL Security",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix=settings.api_v1_prefix)


@app.get("/health")
@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name, "version": "2.0.0"}


@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket) -> None:
    await broadcaster.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        broadcaster.disconnect(websocket)
