"""List (and optionally delete) rows that were invented by old seed/simulation code.

Dry run by default: prints exactly what it would change and touches nothing.
Only with --apply does it delete/update, in a single transaction.

    backend\\.venv\\Scripts\\python.exe scripts\\purge_seed_data.py            # dry run
    backend\\.venv\\Scripts\\python.exe scripts\\purge_seed_data.py --apply    # really purge

It uses DATABASE_URL like the app (local SQLite ace_local.db when unset).

Unequivocal markers only (from code that has been removed or that already purged them):
  * AuditLog MANYCHAT_KEYWORD_TRIGGERED written by the removed /kigalchat/auto-sweep
    (payload.source == "kigalchat_auto_sweep" or one of its invented handles).
  * Seed projects ACE-101..ACE-104 (and their scripts, assets, posts, snapshots, rules, logs),
    seed ideas with the known seed titles, and audit rows by "OrchestratorAgent"/"PipelineSeeder".
  * SocialPost marked PUBLISHED by the removed "sandbox_verified" connector mode (canonical_url on
    contentengine.local or external_platform_id "<CHANNEL>_<10 chars>_<unix ts>"). They are NOT deleted:
    they become FAILED with an explicit publish_error and lose the invented id/url.
  * HookVaultEntry.observed_hold_rate: it was always filled with the *estimated* hold rate of a
    template hook, never with an observation, so it is set back to NULL (the hooks are kept).
The creator profile is never touched; a sample profile ("David") is only reported.
"""

from __future__ import annotations

import argparse
import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, select, update  # noqa: E402

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.entities import (  # noqa: E402
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
)
from app.services.seed import DUMMY_CODES, DUMMY_TITLES  # noqa: E402

FAKE_HANDLES = {"@carlos_founder", "@laura_ops", "@martin_saas", "@sofia_b2b", "@alex_growth"}
SEED_AGENTS = ["OrchestratorAgent", "PipelineSeeder"]
SAMPLE_CREATOR_NAMES = {"David"}
SIMULATED_PUBLISH_ERROR = "Publicación simulada (no se publicó de verdad)"


def _is_simulated_publication(post: SocialPost) -> bool:
    url = post.canonical_url or ""
    if "contentengine.local" in url:
        return True
    ext = post.external_platform_id or ""
    channel = re.escape(str(post.channel or "").upper())
    return bool(channel) and re.fullmatch(rf"{channel}_.{{10}}_\d{{9,11}}", ext) is not None


def _is_fake_interaction(payload: dict | None) -> bool:
    p = payload or {}
    username = str(p.get("username") or "").strip()
    if username and not username.startswith("@"):
        username = f"@{username}"
    return p.get("source") == "kigalchat_auto_sweep" or username in FAKE_HANDLES


async def run(apply: bool) -> int:
    async with AsyncSessionLocal() as db:
        print(f"Database: {db.bind.dialect.name}")
        print("Mode: APPLY (changes will be committed)" if apply else "Mode: DRY RUN (nothing is changed)")

        # 1. Fake KigalChat interactions
        trig_rows = (
            await db.execute(select(AuditLog).where(AuditLog.action_type == "MANYCHAT_KEYWORD_TRIGGERED"))
        ).scalars().all()
        fake_logs = [r for r in trig_rows if _is_fake_interaction(r.payload)]
        print(f"\n[1] Fake KigalChat interactions (AuditLog): {len(fake_logs)} of {len(trig_rows)} MANYCHAT_KEYWORD_TRIGGERED")
        for r in fake_logs[:50]:
            p = r.payload or {}
            print(f"    - {r.id} {r.created_at} {p.get('username')} kw={p.get('keyword')} src={p.get('source')}")
        if len(fake_logs) > 50:
            print(f"    ... and {len(fake_logs) - 50} more")

        # 2. Seed projects and their children
        projects = (
            await db.execute(select(ContentProject).where(ContentProject.asset_code.in_(DUMMY_CODES)))
        ).scalars().all()
        print(f"\n[2] Seed projects ({', '.join(DUMMY_CODES)}): {len(projects)}")
        for proj in projects:
            print(f"    - {proj.asset_code} {proj.working_title!r} (+ scripts, assets, posts, snapshots, rules, logs)")

        # 3. Seed ideas
        ideas = (await db.execute(select(Idea).where(Idea.concept_title.in_(DUMMY_TITLES)))).scalars().all()
        print(f"\n[3] Seed ideas: {len(ideas)}")
        for idea in ideas:
            print(f"    - {idea.id} {idea.concept_title!r}")

        # 4. Seed audit rows
        seed_logs = (
            await db.execute(select(AuditLog).where(AuditLog.agent_or_user_id.in_(SEED_AGENTS)))
        ).scalars().all()
        print(f"\n[4] Seed audit rows by {SEED_AGENTS}: {len(seed_logs)}")

        # 5. Estimated hold rates stored as observed
        hooks = (
            await db.execute(select(HookVaultEntry).where(HookVaultEntry.observed_hold_rate.is_not(None)))
        ).scalars().all()
        print(f"\n[5] HookVaultEntry with an estimated value in observed_hold_rate (-> NULL, hook kept): {len(hooks)}")
        for h in hooks[:20]:
            print(f"    - {h.id} {h.observed_hold_rate} {h.hook_text[:70]!r}")

        # 6. Simulated publications (old sandbox_verified mode)
        published = (
            await db.execute(select(SocialPost).where(SocialPost.publish_status == "PUBLISHED"))
        ).scalars().all()
        simulated = [post for post in published if _is_simulated_publication(post)]
        print(
            f"\n[6] SocialPost PUBLISHED by the old simulated mode (-> FAILED, not deleted): "
            f"{len(simulated)} of {len(published)} PUBLISHED"
        )
        for post in simulated[:50]:
            print(f"    - {post.id} {post.channel} ext={post.external_platform_id} url={post.canonical_url}")

        # Report only
        profiles = (await db.execute(select(CreatorProfile))).scalars().all()
        for prof in profiles:
            if prof.creator_name in SAMPLE_CREATOR_NAMES:
                print(
                    f"\n[!] Creator profile {prof.id} has the sample name {prof.creator_name!r} "
                    f"(niche {prof.niche!r}). Not touched: edit it from the app."
                )

        total = len(fake_logs) + len(projects) + len(ideas) + len(seed_logs) + len(hooks) + len(simulated)
        print(f"\nTotal rows affected: {total}")
        if not apply:
            print("Dry run: nothing changed. Re-run with --apply to purge.")
            return total

        for r in fake_logs:
            await db.delete(r)
        for proj in projects:
            post_ids = [
                pid for pid in (
                    await db.execute(select(SocialPost.id).where(SocialPost.project_id == proj.id))
                ).scalars().all()
            ]
            if post_ids:
                await db.execute(delete(PerformanceSnapshot).where(PerformanceSnapshot.social_post_id.in_(post_ids)))
                await db.execute(delete(SocialPost).where(SocialPost.id.in_(post_ids)))
            await db.execute(delete(Script).where(Script.project_id == proj.id))
            await db.execute(delete(VideoAsset).where(VideoAsset.project_id == proj.id))
            await db.execute(delete(LearnedRule).where(LearnedRule.project_id == proj.id))
            await db.execute(delete(AuditLog).where(AuditLog.project_id == proj.id))
            await db.delete(proj)
        for idea in ideas:
            await db.delete(idea)
        if seed_logs:
            await db.execute(delete(AuditLog).where(AuditLog.agent_or_user_id.in_(SEED_AGENTS)))
        if hooks:
            await db.execute(
                update(HookVaultEntry)
                .where(HookVaultEntry.observed_hold_rate.is_not(None))
                .values(observed_hold_rate=None)
            )
        for post in simulated:
            post.publish_status = "FAILED"
            post.publish_error = SIMULATED_PUBLISH_ERROR
            post.canonical_url = None
            post.external_platform_id = None
        await db.commit()
        print("Applied.")
        return total


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="really delete/update (default: dry run)")
    args = parser.parse_args()
    asyncio.run(run(apply=args.apply))


if __name__ == "__main__":
    main()
