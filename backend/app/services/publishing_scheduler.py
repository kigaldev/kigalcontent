"""Metricool-style publishing scheduler, Best-Time Heatmap engine, and Autolist slot projector."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import logging
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.ws import broadcaster
from app.core.config import get_settings
from app.core.security import HITLSecurityManager
from app.db.session import AsyncSessionLocal
from app.models.entities import (
    AuditLog,
    Autolist,
    ContentProject,
    PerformanceSnapshot,
    SocialCredential,
    SocialPost,
    Workspace,
)
from app.schemas.contracts import (
    BestTimeHeatmapResponse,
    BestTimeSlot,
    SocialChannel,
)
from app.services.social_connectors import get_connector_for_channel


logger = logging.getLogger("uvicorn.error")

DAY_LABELS: tuple[str, ...] = ("Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom")


def _safe_zoneinfo(tz_name: str | None) -> tuple[str, ZoneInfo]:
    candidate = (tz_name or "Europe/Madrid").strip() or "Europe/Madrid"
    try:
        return candidate, ZoneInfo(candidate)
    except (ZoneInfoNotFoundError, KeyError, ValueError):
        return "Europe/Madrid", ZoneInfo("Europe/Madrid")


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _score_label(score: int) -> str:
    if score >= 85:
        return "Pico Máximo"
    if score >= 70:
        return "Alta Tracción"
    if score >= 50:
        return "Moderado"
    return "Baja Actividad"


def _benchmark_score(channel: str, day_of_week: int, hour: int) -> int:
    """Calibrated audience engagement curves (0-100) per social channel."""
    ch = channel.strip().lower()
    is_weekend = day_of_week in (5, 6)
    is_midweek = day_of_week in (1, 2, 3)

    if ch == "linkedin":
        if is_weekend:
            base = 24 if 9 <= hour <= 19 else 12
        elif is_midweek:
            if hour == 9:
                base = 96 if day_of_week == 1 else (94 if day_of_week == 2 else 92)
            elif hour in (8, 10):
                base = 88
            elif hour in (12, 13):
                base = 86
            elif hour in (11, 14, 17):
                base = 76
            elif 7 <= hour <= 19:
                base = 60
            else:
                base = 18
        else:
            # Monday / Friday
            if hour in (8, 9, 10):
                base = 81 if day_of_week == 0 else 75
            elif hour in (12, 13):
                base = 78 if day_of_week == 0 else 70
            elif 7 <= hour <= 18:
                base = 56
            else:
                base = 18
        return max(5, min(100, base))

    if ch == "instagram":
        if hour in (19, 20, 21):
            base = 96 if (day_of_week in (2, 3, 6) and hour == 20) else 89
        elif hour in (12, 13, 14):
            base = 85 if not is_weekend else 81
        elif hour in (18, 22):
            base = 77
        elif 9 <= hour <= 17:
            base = 63
        else:
            base = 20
        return max(5, min(100, base))

    if ch == "tiktok":
        if hour in (19, 20, 21):
            base = 97 if (day_of_week in (3, 4, 5, 6) and hour == 20) else 91
        elif hour in (18, 22):
            base = 86
        elif hour in (12, 13, 14):
            base = 74
        elif hour in (23, 0):
            base = 55
        elif 9 <= hour <= 17:
            base = 48
        else:
            base = 22
        return max(5, min(100, base))

    # YouTube default curve
    if day_of_week in (3, 4, 5, 6):
        if hour in (18, 19, 20):
            base = 96 if (day_of_week in (4, 5, 6) and hour == 19) else 90
        elif hour in (17, 21):
            base = 84
        elif 14 <= hour <= 16:
            base = 72
        elif 10 <= hour <= 13:
            base = 58
        else:
            base = 22
    else:
        if hour in (18, 19, 20):
            base = 82
        elif hour in (17, 21):
            base = 75
        elif 12 <= hour <= 16:
            base = 62
        else:
            base = 20
    return max(5, min(100, base))


def _snapshot_engagement_score(snap: PerformanceSnapshot) -> float:
    if snap.outlier_multiplier is not None:
        raw = 50.0 + (float(snap.outlier_multiplier) - 1.0) * 24.0
    else:
        hold = float(snap.hold_rate_3s if snap.hold_rate_3s is not None else 58.0)
        comp = float(snap.completion_rate if snap.completion_rate is not None else 48.0)
        raw = hold * 0.55 + comp * 0.45
    if snap.sends_per_reach is not None and snap.sends_per_reach >= 2.0:
        raw += 8.0
    if snap.view_count and snap.view_count > 10000:
        raw += 5.0
    return max(15.0, min(100.0, raw))


def compute_best_time_heatmap(
    channel: str,
    snapshots: list[PerformanceSnapshot],
    tz: str = "Europe/Madrid",
) -> BestTimeHeatmapResponse:
    """Compute a 7x24 Best Time to Post heatmap blending DB analytics with channel benchmarks."""
    tz_name, zone = _safe_zoneinfo(tz)

    buckets: dict[tuple[int, int], list[float]] = defaultdict(list)
    for snap in snapshots:
        recorded_at = getattr(snap, "recorded_at", None)
        if recorded_at is None:
            continue
        local_dt = _ensure_utc(recorded_at).astimezone(zone)
        buckets[(local_dt.weekday(), local_dt.hour)].append(_snapshot_engagement_score(snap))

    has_analytics = len(buckets) > 0
    grid: list[BestTimeSlot] = []
    best_slot: BestTimeSlot | None = None

    for day in range(7):
        day_label = DAY_LABELS[day]
        for hour in range(24):
            bench = _benchmark_score(channel, day, hour)
            observed = buckets.get((day, hour))
            if observed:
                real_avg = sum(observed) / len(observed)
                final_score = int(round(max(0.0, min(100.0, 0.65 * real_avg + 0.35 * bench))))
            else:
                final_score = bench

            slot = BestTimeSlot(
                day_of_week=day,
                day_label=day_label,
                hour=hour,
                score=final_score,
                label=_score_label(final_score),
            )
            grid.append(slot)
            if best_slot is None or slot.score > best_slot.score:
                best_slot = slot

    assert best_slot is not None
    return BestTimeHeatmapResponse(
        channel=channel,
        timezone=tz_name,
        source="analytics" if has_analytics else "benchmark",
        peak_slot={
            "day_label": best_slot.day_label,
            "hour": best_slot.hour,
            "score": best_slot.score,
        },
        grid=grid,
    )


def _parse_hhmm(time_str: Any) -> tuple[int, int] | None:
    raw = str(time_str or "").strip()
    if ":" not in raw:
        return None
    parts = raw.split(":", 1)
    try:
        hour = int(parts[0])
        minute = int(parts[1][:2])
    except ValueError:
        return None
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return hour, minute


def project_autolist_slots(
    autolists: list[Autolist],
    start_dt: datetime,
    end_dt: datetime,
) -> list[dict[str, Any]]:
    """Project recurring active autolist slots onto [start_dt, end_dt] in each autolist's timezone."""
    start_utc = _ensure_utc(start_dt)
    end_utc = _ensure_utc(end_dt)
    if end_utc < start_utc:
        return []

    projected: list[dict[str, Any]] = []

    for al in autolists:
        if not al.is_active or not al.schedule_slots or not al.items or not al.channels:
            continue

        _, tz_info = _safe_zoneinfo(al.timezone)
        sorted_items = sorted(al.items, key=lambda it: (it.position, str(it.id)))

        # Group valid schedule slots by day_of_week (0=Mon .. 6=Sun)
        slots_by_day: dict[int, list[tuple[int, int]]] = defaultdict(list)
        for slot in al.schedule_slots:
            if not isinstance(slot, dict):
                continue
            try:
                dow = int(slot.get("day_of_week", -1))
            except (TypeError, ValueError):
                continue
            if not (0 <= dow <= 6):
                continue
            parsed_t = _parse_hhmm(slot.get("time"))
            if parsed_t is None:
                continue
            slots_by_day[dow].append(parsed_t)

        if not slots_by_day:
            continue

        for dow in slots_by_day:
            slots_by_day[dow].sort()

        local_start_date = start_utc.astimezone(tz_info).date()
        local_end_date = end_utc.astimezone(tz_info).date()

        item_cursor = 0
        current_date = local_start_date
        while current_date <= local_end_date:
            day_times = slots_by_day.get(current_date.weekday(), [])
            for hour, minute in day_times:
                local_dt = datetime(
                    current_date.year,
                    current_date.month,
                    current_date.day,
                    hour,
                    minute,
                    tzinfo=tz_info,
                )
                slot_utc = local_dt.astimezone(timezone.utc)
                if not (start_utc <= slot_utc <= end_utc):
                    continue

                if al.repeat_loop:
                    item = sorted_items[item_cursor % len(sorted_items)]
                elif item_cursor < len(sorted_items):
                    item = sorted_items[item_cursor]
                else:
                    break

                item_cursor += 1
                for ch in al.channels:
                    projected.append(
                        {
                            "id": f"proj-{al.id}-{slot_utc.strftime('%Y%m%d%H%M')}-{ch}",
                            "autolist_id": str(al.id),
                            "autolist_name": al.name,
                            "channel": str(ch),
                            "scheduled_at": slot_utc.isoformat(),
                            "title": item.title or al.name,
                            "post_body": item.post_body,
                            "is_projected": True,
                        }
                    )

            if not al.repeat_loop and item_cursor >= len(sorted_items):
                break
            current_date += timedelta(days=1)

    projected.sort(key=lambda row: row["scheduled_at"])
    return projected


async def resolve_effective_social_credential(
    db: AsyncSession, channel_key: str
) -> tuple[str, str, str, str | None]:
    """Return (access_token, person_urn, source, account_name) checking DB first, then env settings."""
    key = channel_key.strip().lower()
    settings = get_settings()

    if key == "linkedin_ads":
        ads_row = (
            await db.execute(select(SocialCredential).where(SocialCredential.channel == "linkedin_ads"))
        ).scalar_one_or_none()
        if ads_row and ads_row.access_token and ads_row.access_token.strip():
            return (
                ads_row.access_token.strip(),
                (ads_row.person_urn or settings.linkedin_person_urn or "").strip(),
                "database",
                ads_row.account_name,
            )

        li_row = (
            await db.execute(select(SocialCredential).where(SocialCredential.channel == "linkedin"))
        ).scalar_one_or_none()
        if li_row and li_row.access_token and li_row.access_token.strip():
            return (
                li_row.access_token.strip(),
                (li_row.person_urn or settings.linkedin_person_urn or "").strip(),
                "database_linkedin",
                li_row.account_name,
            )

        env_li = settings.linkedin_access_token
        if env_li and env_li.strip() and not env_li.startswith("test_"):
            return env_li.strip(), (settings.linkedin_person_urn or "").strip(), "env", None

        return "", (settings.linkedin_person_urn or "").strip(), "none", None

    row = (
        await db.execute(select(SocialCredential).where(SocialCredential.channel == key))
    ).scalar_one_or_none()

    env_map = {
        "youtube": (settings.youtube_access_token, ""),
        "instagram": (settings.instagram_access_token, ""),
        "tiktok": (settings.tiktok_access_token, ""),
        "linkedin": (settings.linkedin_access_token, settings.linkedin_person_urn),
    }
    env_token, env_urn = env_map.get(key, ("", ""))

    if row and row.access_token and row.access_token.strip():
        return (
            row.access_token.strip(),
            (row.person_urn or env_urn or "").strip(),
            "database",
            row.account_name,
        )
    if env_token and env_token.strip() and not env_token.startswith("test_"):
        return env_token.strip(), (env_urn or "").strip(), "env", None
    return "", (env_urn or "").strip(), "none", None


async def run_due_scheduled_posts(db: AsyncSession) -> list[dict[str, Any]]:
    """Dispatch all scheduled SocialPosts with auto_publish=True whose scheduled_at <= UTC now."""
    now_utc = datetime.now(timezone.utc)
    candidates = (
        await db.execute(
            select(SocialPost).where(
                SocialPost.publish_status == "SCHEDULED",
                SocialPost.auto_publish.is_(True),
                SocialPost.scheduled_at.is_not(None),
            )
        )
    ).scalars().all()

    due_posts = [
        sp
        for sp in candidates
        if sp.scheduled_at is not None and _ensure_utc(sp.scheduled_at) <= now_utc
    ]
    if not due_posts:
        return []

    default_ws = (await db.execute(select(Workspace).limit(1))).scalar_one_or_none()
    sec_mgr = HITLSecurityManager()
    results: list[dict[str, Any]] = []

    for sp in due_posts:
        proj = (
            await db.execute(select(ContentProject).where(ContentProject.id == sp.project_id))
        ).scalar_one_or_none()
        ws_id = proj.workspace_id if proj else (default_ws.id if default_ws else None)

        try:
            action = f"publish_{sp.channel.lower()}"
            sec_mgr.require_valid_token(
                token=sp.hitl_approval_token,
                project_id=str(sp.project_id),
                required_tier=3,
                action=action,
                actor="creator",
            )

            ch_enum = SocialChannel(sp.channel)
            eff_token, eff_urn, _, _ = await resolve_effective_social_credential(
                db, sp.channel.lower()
            )
            connector = get_connector_for_channel(
                ch_enum,
                access_token_override=eff_token or None,
                person_urn_override=eff_urn or None,
            )
            pub_res = await connector.publish(
                project_id=str(sp.project_id),
                payload={
                    "title": sp.title,
                    "post_body": sp.post_body,
                    "first_comment": sp.first_comment,
                    "hashtags": sp.hashtags,
                    "metadata_payload": sp.metadata_payload,
                },
                hitl_token=sp.hitl_approval_token,
                actor="creator",
                security_manager=sec_mgr,
            )

            sp.external_platform_id = pub_res["external_platform_id"]
            sp.canonical_url = pub_res["canonical_url"]
            sp.publish_status = "PUBLISHED"
            sp.published_at = now_utc
            sp.publish_error = None

            if ws_id is not None:
                db.add(
                    AuditLog(
                        workspace_id=ws_id,
                        project_id=sp.project_id,
                        action_type=f"SCHEDULED_PUBLISH_{sp.channel.upper()}",
                        agent_or_user_id="PublishingScheduler",
                        security_tier=3,
                        operation_status="SUCCESS",
                        hitl_token_id=sp.hitl_approval_token,
                        payload=pub_res,
                        ip_source="scheduler",
                    )
                )

            results.append(
                {
                    "post_id": str(sp.id),
                    "project_id": str(sp.project_id),
                    **pub_res,
                }
            )
        except Exception as exc:
            resp = getattr(exc, "response", None)
            if resp is not None:
                err_msg = f"Error API {sp.channel} ({resp.status_code}): {resp.text[:300]}"
            else:
                err_msg = str(exc)

            sp.publish_status = "FAILED"
            sp.publish_error = err_msg
            op_status = "BLOCKED_HITL_REQUIRED" if isinstance(exc, PermissionError) else "FAILED"

            if ws_id is not None:
                db.add(
                    AuditLog(
                        workspace_id=ws_id,
                        project_id=sp.project_id,
                        action_type=f"SCHEDULED_PUBLISH_{sp.channel.upper()}",
                        agent_or_user_id="PublishingScheduler",
                        security_tier=3,
                        operation_status=op_status,
                        hitl_token_id=sp.hitl_approval_token,
                        payload={"error": err_msg, "channel": sp.channel},
                        ip_source="scheduler",
                    )
                )

            results.append(
                {
                    "post_id": str(sp.id),
                    "project_id": str(sp.project_id),
                    "channel": sp.channel,
                    "status": "FAILED",
                    "error": err_msg,
                }
            )

    await db.commit()

    try:
        await broadcaster.broadcast(
            "SCHEDULER_TICK_PROCESSED",
            {"processed_count": len(results), "results": results},
        )
    except Exception:
        pass

    return results


async def scheduler_background_loop(interval_seconds: int = 60) -> None:
    """Periodic asyncio background worker checking due scheduled social posts."""
    while True:
        try:
            async with AsyncSessionLocal() as db:
                await run_due_scheduled_posts(db)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Publishing scheduler tick failed: %s", exc)

        try:
            await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            break
