"""Workspace initialization and creator profile persistence without fake/dummy test data."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.entities import (
    AuditLog,
    ContentProject,
    CreatorProfile,
    HookVaultEntry,
    Idea,
    LearnedRule,
    PerformanceSnapshot,
    Script,
    SocialPost,
    VideoAsset,
    Workspace,
)

logger = logging.getLogger("uvicorn.error")

DEFAULT_WORKSPACE_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")

DUMMY_CODES = ["ACE-101", "ACE-102", "ACE-103", "ACE-104"]
DUMMY_TITLES = [
    "La paradoja del CEO de 3T$: Sistemas vs Horas Manuales",
    "Por qué el CTR engaña: Watch Time Share en YouTube Test & Compare",
    "3 reglas de copywriting anti-penalización para LinkedIn 2026",
    "Subtítulos en zona segura 9:16 y sonoridad -14 LUFS",
]


async def purge_test_dummy_records(db: AsyncSession) -> int:
    """Removes all invented/dummy test projects, scripts, assets and metrics from the database."""
    purged_count = 0
    try:
        # 1. Find dummy projects
        stmt = select(ContentProject).where(ContentProject.asset_code.in_(DUMMY_CODES))
        dummy_projects = (await db.execute(stmt)).scalars().all()

        for project in dummy_projects:
            purged_count += 1
            # Delete child performance snapshots and social posts
            posts = (
                await db.execute(
                    select(SocialPost).where(SocialPost.project_id == project.id)
                )
            ).scalars().all()
            for post in posts:
                await db.execute(
                    delete(PerformanceSnapshot).where(
                        PerformanceSnapshot.social_post_id == post.id
                    )
                )
                await db.delete(post)

            # Delete scripts, video assets, learned rules, audit logs
            await db.execute(delete(Script).where(Script.project_id == project.id))
            await db.execute(
                delete(VideoAsset).where(VideoAsset.project_id == project.id)
            )
            await db.execute(
                delete(LearnedRule).where(LearnedRule.project_id == project.id)
            )
            await db.execute(
                delete(AuditLog).where(AuditLog.project_id == project.id)
            )
            await db.delete(project)

        # 2. Delete dummy ideas
        ideas = (
            await db.execute(
                select(Idea).where(Idea.concept_title.in_(DUMMY_TITLES))
            )
        ).scalars().all()
        for idea in ideas:
            await db.delete(idea)

        # 3. Clean dummy audit logs
        await db.execute(
            delete(AuditLog).where(
                AuditLog.agent_or_user_id.in_(["OrchestratorAgent", "PipelineSeeder"])
            )
        )

        await db.commit()
        if purged_count > 0:
            logger.info("Purged %d dummy test project(s) from database.", purged_count)
    except Exception as exc:
        logger.warning("Purging test dummy records encountered an issue: %s", exc)
        await db.rollback()

    return purged_count


async def seed_initial_data(db: AsyncSession) -> Workspace:
    """Ensures Workspace and CreatorProfile exist, and purges any leftover dummy test records."""
    existing_ws = (await db.execute(select(Workspace).limit(1))).scalar_one_or_none()

    if existing_ws:
        await purge_test_dummy_records(db)
        return existing_ws

    settings = get_settings()
    profile_json = settings.load_creator_profile_file()

    ws = Workspace(
        id=DEFAULT_WORKSPACE_ID,
        name="Kigal Content Studio — Enterprise",
        plan_tier="ENTERPRISE",
    )
    db.add(ws)
    await db.flush()

    creator = CreatorProfile(
        workspace_id=ws.id,
        creator_code=profile_json.get("creator_id", "CR-001"),
        creator_name=profile_json.get("name", "David"),
        personal_brand_tagline=profile_json.get("personal_brand_tagline", ""),
        niche=profile_json.get("niche", "Solopreneurship & AI Systems"),
        target_icp=profile_json.get("ideal_customer_profile", "Fundadores B2B y creadores"),
        active_goal=profile_json.get("active_conversion_goal", "EMAIL_LEAD_CAPTURE"),
        content_pillars=profile_json.get("content_pillars", []),
        conversion_goals_catalog=profile_json.get("conversion_goals_catalog", {}),
        lead_magnets=profile_json.get("lead_magnets", []),
        social_profiles=profile_json.get("social_profiles", {}),
        voice_guidelines=profile_json.get("voice_guidelines", "Directo, empírico, sin rodeos, orientado a resultados."),
    )
    db.add(creator)
    await db.commit()

    # Ensure any dummy test records are purged
    await purge_test_dummy_records(db)
    return ws
