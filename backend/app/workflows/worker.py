"""Temporal.io worker process registering all workflows and activities."""

from __future__ import annotations

import asyncio
import logging

from temporalio.client import Client
from temporalio.worker import Worker

from app.core.config import get_settings
from app.workflows.temporal_workflows import (
    AnalyticsAuditWorkflow,
    ContentLifecycleWorkflow,
    MediaProcessingWorkflow,
    PublishingWorkflow,
    activity_compensate_saga_rollback,
    activity_generate_parametric_script,
    activity_process_media_pipeline,
    activity_publish_social_channels,
    activity_research_and_score_ice,
    activity_run_closed_loop_audit,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("temporal_worker")


async def run_worker() -> None:
    settings = get_settings()
    logger.info("Connecting to Temporal server at %s", settings.temporal_host)
    client = await Client.connect(settings.temporal_host, namespace=settings.temporal_namespace)
    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[
            ContentLifecycleWorkflow,
            MediaProcessingWorkflow,
            PublishingWorkflow,
            AnalyticsAuditWorkflow,
        ],
        activities=[
            activity_research_and_score_ice,
            activity_generate_parametric_script,
            activity_process_media_pipeline,
            activity_publish_social_channels,
            activity_run_closed_loop_audit,
            activity_compensate_saga_rollback,
        ],
    )
    logger.info("Temporal Worker started on task queue: %s", settings.temporal_task_queue)
    await worker.run()


if __name__ == "__main__":
    asyncio.run(run_worker())
