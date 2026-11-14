"""Celery worker app for GPU-accelerated FFmpeg and Faster-Whisper jobs."""

from __future__ import annotations

from celery import Celery

from app.core.config import get_settings
from app.workers.media_pipeline import run_full_media_pipeline


settings = get_settings()

celery_app = Celery(
    "autonomous_content_engine_media",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_default_queue="media_gpu",
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)


@celery_app.task(
    name="media.process_asset",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=5,
    retry_backoff_max=300,
    max_retries=8,
)
def process_asset_task(
    self,
    project_id: str,
    raw_media_url: str,
    script_text_hint: str | None = None,
    silence_noise_db: float = -35.0,
    min_silence_duration_sec: float = 0.4,
    target_lufs: float = -14.0,
    subtitle_y_percent: int = 55,
) -> dict:
    report = run_full_media_pipeline(
        project_id=project_id,
        raw_media_url=raw_media_url,
        script_text_hint=script_text_hint,
        silence_noise_db=silence_noise_db,
        min_silence_duration_sec=min_silence_duration_sec,
        target_lufs=target_lufs,
        subtitle_y_percent=subtitle_y_percent,
    )
    return report.model_dump(mode="json")
