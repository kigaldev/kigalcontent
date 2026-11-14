"""Initial database seeding from creator_profile.json and realistic production pipeline records."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
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
from app.schemas.contracts import ConversionGoal, DurationPreset, FSMState, TAMClassification
from app.services.domain_engines import (
    calculate_ice_and_hooks,
    compute_block_metrics,
    compute_deterministic_embedding,
    generate_parametric_script,
)
from app.services.social_connectors import SocialCopyCraftEngine, validate_preflight
from app.schemas.contracts import SocialChannel


DEFAULT_WORKSPACE_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")


async def seed_initial_data(db: AsyncSession) -> Workspace:
    """Populate default workspace, creator profile, FSM projects, scripts, QC, social & analytics."""
    existing_ws = (await db.execute(select(Workspace).limit(1))).scalar_one_or_none()
    if existing_ws:
        return existing_ws

    settings = get_settings()
    profile_json = settings.load_creator_profile_file()

    ws = Workspace(
        id=DEFAULT_WORKSPACE_ID,
        name="Kigal Content Studio — Enterprise",
        plan_tier="ENTERPRISE",
    )
    db.add(ws)

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
        lead_magnets=[
            {
                "name": "Blueprint 6x6 de Automatización de Contenido con IA",
                "trigger_word": "BLUEPRINT",
                "channel": "ManyChat DM / Newsletter",
            }
        ],
        social_profiles=profile_json.get("social_profiles", {}),
        voice_guidelines="Directo, empírico, cero intros pasivas, orientado a sistemas medibles.",
    )
    db.add(creator)

    seed_specs = [
        {
            "code": "ACE-101",
            "title": "La paradoja del CEO de 3T$: Sistemas vs Horas Manuales",
            "duration": DurationPreset.STANDARD_SHORT,
            "goal": ConversionGoal.EMAIL_LEAD_CAPTURE,
            "state": FSMState.HITL_PENDING_PUBLISH,
            "impact": 9.2,
            "confidence": 8.6,
            "ease": 8.0,
            "tam": TAMClassification.EXPANSION_20,
        },
        {
            "code": "ACE-102",
            "title": "Por qué el CTR engaña: Watch Time Share en YouTube Test & Compare",
            "duration": DurationPreset.LONG_FORM,
            "goal": ConversionGoal.PLATFORM_RETENTION_LOOP,
            "state": FSMState.PUBLISHED_LIVE,
            "impact": 9.0,
            "confidence": 8.8,
            "ease": 7.2,
            "tam": TAMClassification.CORE_80,
        },
        {
            "code": "ACE-103",
            "title": "3 reglas de copywriting anti-penalización para LinkedIn 2026",
            "duration": DurationPreset.EXTENDED_SHORT,
            "goal": ConversionGoal.B2B_INBOUND_CONVERSATION,
            "state": FSMState.HITL_PENDING_PRODUCTION,
            "impact": 8.5,
            "confidence": 8.2,
            "ease": 8.4,
            "tam": TAMClassification.CORE_80,
        },
        {
            "code": "ACE-104",
            "title": "Subtítulos en zona segura 9:16 y sonoridad -14 LUFS",
            "duration": DurationPreset.MICRO_SHORT,
            "goal": ConversionGoal.RELATIONAL_DISTRIBUTION_SHARES,
            "state": FSMState.SCRIPTED_PACKAGED,
            "impact": 8.1,
            "confidence": 7.9,
            "ease": 8.8,
            "tam": TAMClassification.CORE_80,
        },
    ]

    copy_engine = SocialCopyCraftEngine(profile_json)
    first_project_id: uuid.UUID | None = None
    published_post: SocialPost | None = None

    for idx, spec in enumerate(seed_specs):
        ice_res = calculate_ice_and_hooks(
            concept_title=spec["title"],
            impact=spec["impact"],
            confidence=spec["confidence"],
            ease=spec["ease"],
            tam_classification=spec["tam"],
        )
        idea = Idea(
            workspace_id=ws.id,
            concept_title=spec["title"],
            source_origin="brave_research_mcp" if idx % 2 == 0 else "audience_outlier_mining",
            impact_score=spec["impact"],
            confidence_score=spec["confidence"],
            ease_score=spec["ease"],
            ice_score=ice_res.ice_score,
            ice_multiplicative=ice_res.ice_multiplicative,
            tam_classification=spec["tam"].value,
            triage_status=ice_res.status,
            research_dossier={
                "sources": ["YouTube Creator Insider (Watch Time Share)", "LinkedIn 360Brew Dwell Study"],
                "hooks_generated": len(ice_res.hook_candidates),
            },
            semantic_embedding=compute_deterministic_embedding(spec["title"]),
        )
        db.add(idea)
        await db.flush()

        for h_idx, hook in enumerate(ice_res.hook_candidates[:2]):
            db.add(
                HookVaultEntry(
                    workspace_id=ws.id,
                    hook_text=hook.hook_text,
                    hook_type=hook.category,
                    verdict="VIRAL" if idx == 1 and h_idx == 0 else "SOLID",
                    observed_hold_rate=hook.estimated_hold_rate,
                    semantic_vector=compute_deterministic_embedding(hook.hook_text),
                )
            )

        blocks, ab_variants, cta_text = generate_parametric_script(
            topic=spec["title"],
            preset=spec["duration"],
            goal=spec["goal"],
            wpm_rate=140,
            profile=profile_json,
        )
        computed_blocks, wc, est_sec, _ = compute_block_metrics(blocks, 140, spec["duration"])

        project = ContentProject(
            workspace_id=ws.id,
            idea_id=idea.id,
            asset_code=spec["code"],
            working_title=spec["title"],
            target_duration=spec["duration"].value,
            conversion_goal=spec["goal"].value,
            current_state=spec["state"].value,
            ice_score=ice_res.ice_score,
            tam_classification=spec["tam"].value,
            ab_variants=[v.model_dump(mode="json") for v in ab_variants],
            state_history=[
                {"from": "INIT", "to": "CAPTURED", "agent": "OrchestratorAgent", "tier": 1},
                {"from": "CAPTURED", "to": spec["state"].value, "agent": "PipelineSeeder", "tier": 1},
            ],
            temporal_workflow_id=f"wf-lifecycle-{spec['code'].lower()}",
        )
        db.add(project)
        await db.flush()

        if first_project_id is None:
            first_project_id = project.id

        script = Script(
            project_id=project.id,
            script_version=1,
            duration_preset=spec["duration"].value,
            conversion_goal=spec["goal"].value,
            wpm_rate=140,
            two_column_blocks=[b.model_dump(mode="json") for b in computed_blocks],
            hook_variants=[h.model_dump(mode="json") for h in ice_res.hook_candidates],
            selected_hook_index=0,
            cta_text=cta_text,
            word_count=wc,
            estimated_duration_sec=est_sec,
        )
        db.add(script)

        # Add media QC snapshot for produced/published assets
        if spec["state"] in (FSMState.HITL_PENDING_PUBLISH, FSMState.PUBLISHED_LIVE):
            demo_words = [
                {"word": "Deja", "start_ms": 100, "end_ms": 420, "confidence": 0.99},
                {"word": "de", "start_ms": 430, "end_ms": 580, "confidence": 0.98},
                {"word": "medir", "start_ms": 600, "end_ms": 950, "confidence": 0.99},
                {"word": "CTR", "start_ms": 970, "end_ms": 1400, "confidence": 0.99},
                {"word": "bruto,", "start_ms": 1420, "end_ms": 1820, "confidence": 0.97},
                {"word": "mide", "start_ms": 1900, "end_ms": 2250, "confidence": 0.99},
                {"word": "Watch", "start_ms": 2270, "end_ms": 2650, "confidence": 0.99},
                {"word": "Time", "start_ms": 2670, "end_ms": 2980, "confidence": 0.99},
                {"word": "Share.", "start_ms": 3000, "end_ms": 3480, "confidence": 0.99},
            ]
            db.add(
                VideoAsset(
                    project_id=project.id,
                    raw_media_url=f"s3://ace-media-vault/projects/{project.id}/raw/{spec['code']}.mp4",
                    master_media_url=f"s3://ace-media-vault/projects/{project.id}/processed/{spec['code']}_master_916.mp4",
                    thumbnail_a_url=f"s3://ace-media-vault/projects/{project.id}/ab/thumb_a_1280x720.png",
                    thumbnail_b_url=f"s3://ace-media-vault/projects/{project.id}/ab/thumb_b_1280x720.png",
                    probe_metadata={"width": 1080, "height": 1920, "fps": 30.0, "video_codec": "h264"},
                    transcription_json=demo_words,
                    silence_segments_json=[{"start": 1.65, "end": 2.42, "duration": 0.77}],
                    silences_trimmed=4,
                    measured_lufs=-14.0,
                    true_peak_dbfs=-1.0,
                    qc_passed=True,
                    qc_report={"ebu_r128": "PASS", "safe_zone": "45%-65%", "subtitles": "burned_ass"},
                )
            )

        # Generate multi-channel posts
        generated_posts = copy_engine.generate_all_channels(
            headline=spec["title"],
            core_value=f"Implementación práctica de {spec['title']} con arquitectura de bucle cerrado.",
            debate_question="¿Prefieres optimizar CTR bruto o Watch Time Share?",
            thesis_points=[
                "El volumen sin sistemas multiplica deuda operativa",
                "Normaliza a -14 LUFS y elimina pausas >400ms",
                "Nunca pongas enlaces en el cuerpo principal de LinkedIn",
            ],
            chapters=[
                {"time": "00:00", "title": "Gancho y tesis"},
                {"time": "00:20", "title": "Diagnóstico Watch Time Share"},
                {"time": "00:45", "title": "Marco RMT-A y CTA"},
            ],
            goal=spec["goal"],
        )

        for post_dict in generated_posts:
            ch = SocialChannel(post_dict["channel"])
            pf = validate_preflight(ch, post_dict)
            is_live = spec["state"] == FSMState.PUBLISHED_LIVE
            sp = SocialPost(
                project_id=project.id,
                channel=post_dict["channel"],
                title=post_dict.get("title"),
                post_body=post_dict["post_body"],
                first_comment=post_dict.get("first_comment"),
                hashtags=post_dict.get("hashtags", []),
                metadata_payload=post_dict.get("metadata_payload", {}),
                preflight_warnings=pf.warnings + pf.blocking_errors,
                preflight_passed=pf.passed,
                publish_status="PUBLISHED" if is_live else "READY_FOR_HITL",
                external_platform_id=f"{ch.value.upper()}_LIVE_{spec['code']}" if is_live else None,
                canonical_url=f"https://social.contentengine.local/{ch.value.lower()}/{spec['code']}" if is_live else None,
                published_at=datetime.now(timezone.utc) - timedelta(days=7) if is_live else None,
            )
            db.add(sp)
            await db.flush()
            if is_live and ch == SocialChannel.YOUTUBE:
                published_post = sp

    if published_post is not None:
        retention_curve = [
            {"sec": 0, "pct": 100},
            {"sec": 3, "pct": 74},
            {"sec": 10, "pct": 68},
            {"sec": 20, "pct": 64},
            {"sec": 30, "pct": 61},
            {"sec": 45, "pct": 57},
            {"sec": 60, "pct": 54},
            {"sec": 90, "pct": 51},
        ]
        for win, views, hold, comp, wts, sends, mult in [
            ("24h", 14200, 71.4, 59.0, 68.5, 2.4, 2.1),
            ("7d", 46800, 74.0, 56.5, 71.8, 3.1, 3.4),
            ("30d", 89400, 73.2, 54.0, 72.4, 3.4, 4.1),
        ]:
            db.add(
                PerformanceSnapshot(
                    social_post_id=published_post.id,
                    window_type=win,
                    view_count=views,
                    hold_rate_3s=hold,
                    completion_rate=comp,
                    watch_time_share=wts,
                    sends_per_reach=sends,
                    dwell_time_seconds=44.5,
                    outlier_multiplier=mult,
                    retention_curve=retention_curve,
                    diagnosis_layer="EXITO_ESTRUCTURAL",
                    rmta_classification="REPETIR_FRANQUICIAR",
                    recommended_action="Escalar como serie recurrente con gancho de contraste cuantitativo.",
                )
            )

    db.add(
        LearnedRule(
            workspace_id=ws.id,
            project_id=first_project_id,
            rmta_classification="REPETIR_FRANQUICIAR",
            diagnosis_layer="EXITO_ESTRUCTURAL",
            rule_statement="Ganchos contraintuitivos con cifra cuantitativa superan 72% Hold Rate 3s.",
            confidence_weight=0.92,
        )
    )
    db.add(
        AuditLog(
            workspace_id=ws.id,
            project_id=first_project_id,
            action_type="SYSTEM_BOOTSTRAP_VERIFIED",
            agent_or_user_id="OrchestratorAgent",
            security_tier=1,
            operation_status="SUCCESS",
            payload={"seeded_projects": len(seed_specs), "permissions_mode": "controlled_autonomy"},
            ip_source="127.0.0.1",
        )
    )

    await db.commit()
    return ws
