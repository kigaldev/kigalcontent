"""REST API Router for Autonomous Content Engine Web."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.ws import broadcaster
from app.core.config import get_settings
from app.core.security import HITLSecurityManager, get_permissions_summary
from app.db.session import get_db
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
from app.schemas.contracts import (
    AuditLogResponse,
    ConversionGoal,
    CreatorProfileSchema,
    CreatorProfileUpdateRequest,
    DurationPreset,
    FSMState,
    FSMTransitionRequest,
    GoogleDriveFileItem,
    GoogleDriveImportRequest,
    GoogleDriveScanRequest,
    GoogleDriveScanResponse,
    HITLTokenIssueRequest,
    HITLTokenIssueResponse,
    ICEScoreRequest,
    ICEScoreResponse,
    InfrastructureServiceStatus,
    LLMConfigResponse,
    LLMConfigUpdateRequest,
    LLMTestConnectionRequest,
    LLMTestConnectionResponse,
    LoadedSkillAgentSpec,
    MediaProcessRequest,
    MediaQCReport,
    PreflightCheckResult,
    ProjectCreateRequest,
    ProjectSummaryResponse,
    RMTADiagnosisRequest,
    RMTADiagnosisResponse,
    S3MultipartInitRequest,
    S3MultipartInitResponse,
    ScriptGenerateRequest,
    ScriptResponse,
    ScriptUpdateRequest,
    SocialChannel,
    SocialCopyGenerateRequest,
    SocialPostResponse,
    SocialPublishExecuteRequest,
    SystemConnectionsStatusResponse,
    TAMClassification,
    WatchTimeShareRequest,
    WatchTimeShareResponse,
)
from app.services.domain_engines import (
    DURATION_SPECS,
    TRANSITION_SECURITY_TIERS,
    VALID_FSM_TRANSITIONS,
    append_learned_rule_file,
    calculate_ice_and_hooks,
    calculate_watch_time_share,
    compute_block_metrics,
    compute_deterministic_embedding,
    diagnose_rmta,
    generate_parametric_script,
)
from app.services.mcp_hub import MCPClientHub
from app.services.social_connectors import (
    SocialCopyCraftEngine,
    get_connector_for_channel,
    validate_preflight,
)
from app.services.storage_s3 import ObjectStorageService
from app.services.google_drive import GoogleDriveService
from app.services.skill_llm_router import get_llm_router
from app.workers.media_pipeline import run_full_media_pipeline


router = APIRouter()


async def _get_default_workspace(db: AsyncSession) -> Workspace:
    ws = (await db.execute(select(Workspace).limit(1))).scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not initialized.")
    return ws


async def _record_audit(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    action_type: str,
    agent_or_user_id: str,
    security_tier: int,
    operation_status: str,
    project_id: uuid.UUID | None = None,
    hitl_token_id: str | None = None,
    payload: dict[str, Any] | None = None,
    ip_source: str | None = "127.0.0.1",
) -> AuditLog:
    entry = AuditLog(
        workspace_id=workspace_id,
        project_id=project_id,
        action_type=action_type,
        agent_or_user_id=agent_or_user_id,
        security_tier=security_tier,
        operation_status=operation_status,
        hitl_token_id=hitl_token_id,
        payload=payload or {},
        ip_source=ip_source,
    )
    db.add(entry)
    await db.flush()
    return entry


def _build_script_response(script: Script) -> ScriptResponse:
    preset = DurationPreset(script.duration_preset)
    spec = DURATION_SPECS[preset]
    min_w, max_w = spec["word_range"]
    min_d, max_d = spec["duration_range"]
    within_budget = (min_w * 0.85 <= script.word_count <= max_w * 1.15) and (
        script.estimated_duration_sec <= max_d * 1.15
    )
    return ScriptResponse(
        id=script.id,
        project_id=script.project_id,
        script_version=script.script_version,
        duration_preset=preset,
        conversion_goal=ConversionGoal(script.conversion_goal),
        wpm_rate=script.wpm_rate,
        two_column_blocks=script.two_column_blocks,
        hook_variants=script.hook_variants,
        selected_hook_index=script.selected_hook_index,
        cta_text=script.cta_text,
        word_count=script.word_count,
        estimated_duration_sec=script.estimated_duration_sec,
        target_word_range=spec["word_range"],
        target_duration_range_sec=spec["duration_range"],
        pattern_interrupt_interval_sec=spec["cut_interval_sec"],
        within_budget=within_budget,
        created_at=script.created_at,
    )


# --- 1. MCP & Governance ---

@router.get("/mcp/healthcheck")
async def mcp_healthcheck() -> dict[str, Any]:
    hub = MCPClientHub()
    return {
        "mcp": hub.healthcheck(),
        "permissions_matrix": get_permissions_summary(),
        "duration_specs": {k.value: v for k, v in DURATION_SPECS.items()},
    }


@router.post("/mcp/jsonrpc-preview")
async def mcp_jsonrpc_preview(server_name: str, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    hub = MCPClientHub()
    try:
        return hub.build_jsonrpc_call(server_name, tool_name, arguments)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# --- 2. Creator Context Engine ---

@router.get("/creator-profile", response_model=CreatorProfileSchema)
async def get_creator_profile(db: AsyncSession = Depends(get_db)) -> CreatorProfileSchema:
    row = (await db.execute(select(CreatorProfile).limit(1))).scalar_one_or_none()
    if not row:
        raw = get_settings().load_creator_profile_file()
        return CreatorProfileSchema(**raw)
    return CreatorProfileSchema(
        creator_id=row.creator_code,
        name=row.creator_name,
        age=row.age,
        personal_brand_tagline=row.personal_brand_tagline,
        niche=row.niche,
        ideal_customer_profile=row.target_icp,
        project_context=row.project_context,
        strategic_goals=row.strategic_goals or [],
        communication_style=row.communication_style,
        visual_style=row.visual_style,
        content_pillars=row.content_pillars,
        conversion_goals_catalog=row.conversion_goals_catalog,
        active_conversion_goal=ConversionGoal(row.active_goal),
        social_profiles=row.social_profiles,
        voice_guidelines=row.voice_guidelines,
    )


@router.put("/creator-profile", response_model=CreatorProfileSchema)
async def update_creator_profile(
    body: CreatorProfileUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> CreatorProfileSchema:
    row = (await db.execute(select(CreatorProfile).limit(1))).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Creator profile not found.")

    if body.name is not None:
        row.creator_name = body.name
    if body.age is not None:
        row.age = body.age
    if body.personal_brand_tagline is not None:
        row.personal_brand_tagline = body.personal_brand_tagline
    if body.niche is not None:
        row.niche = body.niche
    if body.ideal_customer_profile is not None:
        row.target_icp = body.ideal_customer_profile
    if body.project_context is not None:
        row.project_context = body.project_context
    if body.strategic_goals is not None:
        row.strategic_goals = body.strategic_goals
    if body.communication_style is not None:
        row.communication_style = body.communication_style
    if body.visual_style is not None:
        row.visual_style = body.visual_style
    if body.content_pillars is not None:
        row.content_pillars = body.content_pillars
    if body.active_conversion_goal is not None:
        row.active_goal = body.active_conversion_goal.value
    if body.conversion_goals_catalog is not None:
        row.conversion_goals_catalog = {
            k: v.model_dump(mode="json") for k, v in body.conversion_goals_catalog.items()
        }
    if body.social_profiles is not None:
        row.social_profiles = body.social_profiles
    if body.voice_guidelines is not None:
        row.voice_guidelines = body.voice_guidelines

    # Sync back to canonical creator_profile.json
    settings = get_settings()
    file_data = settings.load_creator_profile_file()
    file_data.update(
        {
            "name": row.creator_name,
            "age": row.age,
            "personal_brand_tagline": row.personal_brand_tagline,
            "niche": row.niche,
            "ideal_customer_profile": row.target_icp,
            "project_context": row.project_context,
            "strategic_goals": row.strategic_goals,
            "communication_style": row.communication_style,
            "visual_style": row.visual_style,
            "content_pillars": row.content_pillars,
            "active_conversion_goal": row.active_goal,
            "conversion_goals_catalog": row.conversion_goals_catalog,
            "social_profiles": row.social_profiles,
        }
    )
    settings.save_creator_profile_file(file_data)

    await _record_audit(
        db=db,
        workspace_id=row.workspace_id,
        action_type="UPDATE_CREATOR_CONTEXT_ENGINE",
        agent_or_user_id="Creator",
        security_tier=1,
        operation_status="SUCCESS",
        payload={"active_goal": row.active_goal, "niche": row.niche},
        ip_source=request.client.host if request.client else "127.0.0.1",
    )
    await db.commit()
    return await get_creator_profile(db)


# --- 3. Ideas, ICE Scorer & Hook Vault ---

@router.get("/ideas")
async def list_ideas(db: AsyncSession = Depends(get_db)) -> list[dict[str, Any]]:
    rows = (await db.execute(select(Idea).order_by(desc(Idea.created_at)))).scalars().all()
    return [
        {
            "id": str(r.id),
            "concept_title": r.concept_title,
            "source_origin": r.source_origin,
            "impact": r.impact_score,
            "confidence": r.confidence_score,
            "ease": r.ease_score,
            "ice_score": r.ice_score,
            "ice_multiplicative": r.ice_multiplicative,
            "tam_classification": r.tam_classification,
            "triage_status": r.triage_status,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/ideas/score-ice", response_model=ICEScoreResponse)
async def score_idea_ice(
    body: ICEScoreRequest,
    db: AsyncSession = Depends(get_db),
) -> ICEScoreResponse:
    ws = await _get_default_workspace(db)
    result = calculate_ice_and_hooks(
        concept_title=body.concept_title,
        impact=body.impact,
        confidence=body.confidence,
        ease=body.ease,
        tam_classification=body.tam_classification,
    )
    idea = Idea(
        workspace_id=ws.id,
        concept_title=body.concept_title,
        source_origin=body.source_origin,
        impact_score=body.impact,
        confidence_score=body.confidence,
        ease_score=body.ease,
        ice_score=result.ice_score,
        ice_multiplicative=result.ice_multiplicative,
        tam_classification=body.tam_classification.value,
        triage_status=result.status,
        research_dossier={"hooks": [h.model_dump(mode="json") for h in result.hook_candidates]},
        semantic_embedding=compute_deterministic_embedding(body.concept_title),
    )
    db.add(idea)
    await db.flush()

    for hook in result.hook_candidates[:3]:
        db.add(
            HookVaultEntry(
                workspace_id=ws.id,
                hook_text=hook.hook_text,
                hook_type=hook.category,
                verdict="SOLID" if result.threshold_met else "TEST",
                observed_hold_rate=hook.estimated_hold_rate,
                semantic_vector=compute_deterministic_embedding(hook.hook_text),
            )
        )

    await _record_audit(
        db=db,
        workspace_id=ws.id,
        action_type="ICE_SCORE_EVALUATION",
        agent_or_user_id="ResearcherStrategist",
        security_tier=1,
        operation_status="SUCCESS",
        payload={"ice_score": result.ice_score, "status": result.status},
    )
    await db.commit()
    result.idea_id = idea.id
    return result


@router.get("/hooks")
async def list_hook_vault(db: AsyncSession = Depends(get_db)) -> list[dict[str, Any]]:
    rows = (await db.execute(select(HookVaultEntry).order_by(desc(HookVaultEntry.created_at)).limit(40))).scalars().all()
    return [
        {
            "id": str(r.id),
            "hook_text": r.hook_text,
            "hook_type": r.hook_type,
            "verdict": r.verdict,
            "observed_hold_rate": r.observed_hold_rate,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


# --- 4. Projects, FSM & HITL Governance ---

@router.get("/projects", response_model=list[ProjectSummaryResponse])
async def list_projects(db: AsyncSession = Depends(get_db)) -> list[ProjectSummaryResponse]:
    rows = (await db.execute(select(ContentProject).order_by(desc(ContentProject.updated_at)))).scalars().all()
    return [
        ProjectSummaryResponse(
            id=r.id,
            asset_code=r.asset_code,
            working_title=r.working_title,
            target_duration=DurationPreset(r.target_duration),
            conversion_goal=ConversionGoal(r.conversion_goal),
            current_state=FSMState(r.current_state),
            ice_score=r.ice_score,
            tam_classification=TAMClassification(r.tam_classification),
            ab_variants=r.ab_variants,
            state_history=r.state_history,
            temporal_workflow_id=r.temporal_workflow_id,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.post("/projects", response_model=ProjectSummaryResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> ProjectSummaryResponse:
    ws = await _get_default_workspace(db)
    ice_res = calculate_ice_and_hooks(
        concept_title=body.working_title,
        impact=body.impact,
        confidence=body.confidence,
        ease=body.ease,
        tam_classification=body.tam_classification,
    )
    idea = Idea(
        workspace_id=ws.id,
        concept_title=body.working_title,
        source_origin="studio_intake",
        impact_score=body.impact,
        confidence_score=body.confidence,
        ease_score=body.ease,
        ice_score=ice_res.ice_score,
        ice_multiplicative=ice_res.ice_multiplicative,
        tam_classification=body.tam_classification.value,
        triage_status=ice_res.status,
        semantic_embedding=compute_deterministic_embedding(body.working_title),
    )
    db.add(idea)
    await db.flush()

    initial_state = FSMState.RESEARCHED_TRIAGED if ice_res.threshold_met else FSMState.ARCHIVED
    asset_code = f"ACE-{uuid.uuid4().hex[:5].upper()}"

    blocks, ab_variants, cta_text = generate_parametric_script(
        topic=body.working_title,
        preset=body.target_duration,
        goal=body.conversion_goal,
    )
    if body.auto_generate_script and ice_res.threshold_met:
        initial_state = FSMState.SCRIPTED_PACKAGED

    project = ContentProject(
        workspace_id=ws.id,
        idea_id=idea.id,
        asset_code=asset_code,
        working_title=body.working_title,
        target_duration=body.target_duration.value,
        conversion_goal=body.conversion_goal.value,
        current_state=initial_state.value,
        ice_score=ice_res.ice_score,
        tam_classification=body.tam_classification.value,
        ab_variants=[v.model_dump(mode="json") for v in ab_variants],
        state_history=[
            {"from": "INIT", "to": "CAPTURED", "agent": "OrchestratorAgent", "tier": 1},
            {"from": "CAPTURED", "to": initial_state.value, "agent": "DirectorScriptwriter", "tier": 1},
        ],
        temporal_workflow_id=f"wf-lifecycle-{asset_code.lower()}",
    )
    db.add(project)
    await db.flush()

    if body.auto_generate_script:
        computed_blocks, wc, est_sec, _ = compute_block_metrics(blocks, 140, body.target_duration)
        db.add(
            Script(
                project_id=project.id,
                script_version=1,
                duration_preset=body.target_duration.value,
                conversion_goal=body.conversion_goal.value,
                wpm_rate=140,
                two_column_blocks=[b.model_dump(mode="json") for b in computed_blocks],
                hook_variants=[h.model_dump(mode="json") for h in ice_res.hook_candidates],
                selected_hook_index=0,
                cta_text=cta_text,
                word_count=wc,
                estimated_duration_sec=est_sec,
            )
        )

        # Auto-generate draft social copy matrix
        copy_engine = SocialCopyCraftEngine()
        for post_dict in copy_engine.generate_all_channels(
            headline=body.working_title,
            core_value=f"Implementación paso a paso de {body.working_title}",
            debate_question="¿Qué métrica pesa más en tu canal hoy?",
            thesis_points=["Aplica sistemas medibles", "Elimina pausas muertas >400ms"],
            chapters=[{"time": "00:00", "title": "Gancho"}, {"time": "00:25", "title": "Marco"}],
            goal=body.conversion_goal,
        ):
            ch = SocialChannel(post_dict["channel"])
            pf = validate_preflight(ch, post_dict)
            db.add(
                SocialPost(
                    project_id=project.id,
                    channel=post_dict["channel"],
                    title=post_dict.get("title"),
                    post_body=post_dict["post_body"],
                    first_comment=post_dict.get("first_comment"),
                    hashtags=post_dict.get("hashtags", []),
                    metadata_payload=post_dict.get("metadata_payload", {}),
                    preflight_warnings=pf.warnings + pf.blocking_errors,
                    preflight_passed=pf.passed,
                    publish_status="READY_FOR_HITL",
                )
            )

    await _record_audit(
        db=db,
        workspace_id=ws.id,
        project_id=project.id,
        action_type="CREATE_CONTENT_PROJECT",
        agent_or_user_id="OrchestratorAgent",
        security_tier=1,
        operation_status="SUCCESS",
        payload={"asset_code": asset_code, "ice_score": ice_res.ice_score, "state": initial_state.value},
    )
    await db.commit()
    await db.refresh(project)

    await broadcaster.broadcast(
        "PROJECT_CREATED",
        {"project_id": str(project.id), "asset_code": asset_code, "state": initial_state.value},
    )

    return ProjectSummaryResponse(
        id=project.id,
        asset_code=project.asset_code,
        working_title=project.working_title,
        target_duration=DurationPreset(project.target_duration),
        conversion_goal=ConversionGoal(project.conversion_goal),
        current_state=FSMState(project.current_state),
        ice_score=project.ice_score,
        tam_classification=TAMClassification(project.tam_classification),
        ab_variants=project.ab_variants,
        state_history=project.state_history,
        temporal_workflow_id=project.temporal_workflow_id,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("/projects/{project_id}")
async def get_project_detail(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    project = (await db.execute(select(ContentProject).where(ContentProject.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    script = (
        await db.execute(
            select(Script).where(Script.project_id == project_id).order_by(desc(Script.script_version)).limit(1)
        )
    ).scalar_one_or_none()
    video = (
        await db.execute(
            select(VideoAsset).where(VideoAsset.project_id == project_id).order_by(desc(VideoAsset.created_at)).limit(1)
        )
    ).scalar_one_or_none()
    posts = (await db.execute(select(SocialPost).where(SocialPost.project_id == project_id))).scalars().all()

    return {
        "project": ProjectSummaryResponse(
            id=project.id,
            asset_code=project.asset_code,
            working_title=project.working_title,
            target_duration=DurationPreset(project.target_duration),
            conversion_goal=ConversionGoal(project.conversion_goal),
            current_state=FSMState(project.current_state),
            ice_score=project.ice_score,
            tam_classification=TAMClassification(project.tam_classification),
            ab_variants=project.ab_variants,
            state_history=project.state_history,
            temporal_workflow_id=project.temporal_workflow_id,
            created_at=project.created_at,
            updated_at=project.updated_at,
        ).model_dump(mode="json"),
        "script": _build_script_response(script).model_dump(mode="json") if script else None,
        "video_asset": {
            "id": str(video.id),
            "raw_media_url": video.raw_media_url,
            "master_media_url": video.master_media_url,
            "thumbnail_a_url": video.thumbnail_a_url,
            "thumbnail_b_url": video.thumbnail_b_url,
            "silences_trimmed": video.silences_trimmed,
            "silence_segments_json": video.silence_segments_json,
            "measured_lufs": video.measured_lufs,
            "true_peak_dbfs": video.true_peak_dbfs,
            "transcription_json": video.transcription_json,
            "ass_subtitles": video.ass_subtitles,
            "qc_passed": video.qc_passed,
            "qc_report": video.qc_report,
        }
        if video
        else None,
        "social_posts": [
            SocialPostResponse(
                id=p.id,
                project_id=p.project_id,
                channel=p.channel,
                external_platform_id=p.external_platform_id,
                canonical_url=p.canonical_url,
                title=p.title,
                post_body=p.post_body,
                first_comment=p.first_comment,
                hashtags=p.hashtags,
                metadata_payload=p.metadata_payload,
                preflight_warnings=p.preflight_warnings,
                preflight_passed=p.preflight_passed,
                publish_status=p.publish_status,
                hitl_approval_token=p.hitl_approval_token,
                published_at=p.published_at,
            ).model_dump(mode="json")
            for p in posts
        ],
    }


@router.post("/hitl/issue-token", response_model=HITLTokenIssueResponse)
async def issue_hitl_token(
    body: HITLTokenIssueRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> HITLTokenIssueResponse:
    ws = await _get_default_workspace(db)
    if body.tier == 3 and (not body.two_factor_code or len(body.two_factor_code.strip()) < 4):
        raise HTTPException(
            status_code=400,
            detail="Tier 3 HITL authorization requires explicit 2FA confirmation code (>=4 chars).",
        )

    sec_mgr = HITLSecurityManager()
    issued = sec_mgr.issue_hitl_token(
        project_id=body.project_id,
        tier=body.tier,
        action=body.action,
        actor=body.actor,
    )
    proj_uuid = None
    try:
        proj_uuid = uuid.UUID(body.project_id)
    except ValueError:
        pass

    await _record_audit(
        db=db,
        workspace_id=ws.id,
        project_id=proj_uuid,
        action_type=f"ISSUE_HITL_TIER_{body.tier}_TOKEN",
        agent_or_user_id=body.actor,
        security_tier=body.tier,
        operation_status="SUCCESS",
        hitl_token_id=issued["token"],
        payload={"action": body.action, "expires_at": issued["expires_at"]},
        ip_source=request.client.host if request.client else "127.0.0.1",
    )
    await db.commit()

    await broadcaster.broadcast(
        "HITL_TOKEN_ISSUED",
        {"project_id": body.project_id, "tier": body.tier, "action": body.action},
    )
    return HITLTokenIssueResponse(**issued)


@router.post("/projects/{project_id}/transition", response_model=ProjectSummaryResponse)
async def transition_project_state(
    project_id: uuid.UUID,
    body: FSMTransitionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ProjectSummaryResponse:
    project = (await db.execute(select(ContentProject).where(ContentProject.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    current = FSMState(project.current_state)
    allowed_next = VALID_FSM_TRANSITIONS.get(current, [])
    if body.target_state not in allowed_next:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid FSM transition: {current.value} -> {body.target_state.value}. Allowed: {[s.value for s in allowed_next]}",
        )

    required_tier = TRANSITION_SECURITY_TIERS.get((current, body.target_state), 1)
    action_name = f"transition_to_{body.target_state.value.lower()}"
    if required_tier == 2:
        action_name = "approve_script_for_production"
    elif required_tier == 3:
        action_name = "publish_all_channels_live"

    sec_mgr = HITLSecurityManager()
    ip_addr = request.client.host if request.client else "127.0.0.1"
    if required_tier in (2, 3):
        verification = sec_mgr.verify_hitl_token(
            token=body.hitl_token,
            project_id=str(project.id),
            required_tier=required_tier,
            action=action_name,
            actor=body.agent_or_user,
        )
        if not verification.valid:
            await _record_audit(
                db=db,
                workspace_id=project.workspace_id,
                project_id=project.id,
                action_type=f"TRANSITION_TO_{body.target_state.value}",
                agent_or_user_id=body.agent_or_user,
                security_tier=required_tier,
                operation_status="BLOCKED_HITL_REQUIRED",
                hitl_token_id=body.hitl_token,
                payload={"reason": verification.reason},
                ip_source=ip_addr,
            )
            await db.commit()
            raise HTTPException(
                status_code=403,
                detail=f"BLOCKED [Tier {required_tier} HITL]: {verification.reason}",
            )

    history = list(project.state_history or [])
    history.append(
        {
            "from": current.value,
            "to": body.target_state.value,
            "agent": body.agent_or_user,
            "tier": required_tier,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "reason": body.reason,
        }
    )
    project.current_state = body.target_state.value
    project.state_history = history

    await _record_audit(
        db=db,
        workspace_id=project.workspace_id,
        project_id=project.id,
        action_type=f"TRANSITION_TO_{body.target_state.value}",
        agent_or_user_id=body.agent_or_user,
        security_tier=required_tier,
        operation_status="SUCCESS",
        hitl_token_id=body.hitl_token,
        payload={"from": current.value, "to": body.target_state.value},
        ip_source=ip_addr,
    )
    await db.commit()
    await db.refresh(project)

    await broadcaster.broadcast(
        "FSM_STATE_CHANGED",
        {
            "project_id": str(project.id),
            "asset_code": project.asset_code,
            "from": current.value,
            "to": project.current_state,
            "tier": required_tier,
        },
    )

    return ProjectSummaryResponse(
        id=project.id,
        asset_code=project.asset_code,
        working_title=project.working_title,
        target_duration=DurationPreset(project.target_duration),
        conversion_goal=ConversionGoal(project.conversion_goal),
        current_state=FSMState(project.current_state),
        ice_score=project.ice_score,
        tam_classification=TAMClassification(project.tam_classification),
        ab_variants=project.ab_variants,
        state_history=project.state_history,
        temporal_workflow_id=project.temporal_workflow_id,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("/audit-logs", response_model=list[AuditLogResponse])
async def list_audit_logs(limit: int = 50, db: AsyncSession = Depends(get_db)) -> list[AuditLogResponse]:
    rows = (await db.execute(select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit))).scalars().all()
    return [AuditLogResponse.model_validate(r) for r in rows]


# --- 5. Two-Column Script Studio ---

@router.post("/scripts/generate", response_model=ScriptResponse)
async def generate_script_endpoint(
    body: ScriptGenerateRequest,
    db: AsyncSession = Depends(get_db),
) -> ScriptResponse:
    project = (await db.execute(select(ContentProject).where(ContentProject.id == body.project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    latest_ver = (
        await db.execute(
            select(Script.script_version)
            .where(Script.project_id == project.id)
            .order_by(desc(Script.script_version))
            .limit(1)
        )
    ).scalar_one_or_none() or 0

    topic = body.topic_override or project.working_title
    llm_router = get_llm_router()
    creator_row = (await db.execute(select(CreatorProfile).limit(1))).scalar_one_or_none()
    profile_dict = (
        {
            "name": creator_row.creator_name,
            "niche": creator_row.niche,
            "ideal_customer_profile": creator_row.target_icp,
            "project_context": creator_row.project_context,
            "strategic_goals": creator_row.strategic_goals,
            "communication_style": creator_row.communication_style,
            "visual_style": creator_row.visual_style,
            "content_pillars": creator_row.content_pillars,
            "active_conversion_goal": creator_row.active_goal,
            "conversion_goals_catalog": creator_row.conversion_goals_catalog,
        }
        if creator_row
        else None
    )

    if body.custom_blocks:
        computed_blocks, wc, est_sec, _ = compute_block_metrics(
            body.custom_blocks, body.wpm_rate, body.duration_preset
        )
        _, ab_variants, cta_text = generate_parametric_script(
            topic=topic,
            preset=body.duration_preset,
            goal=body.conversion_goal,
            wpm_rate=body.wpm_rate,
        )
    else:
        computed_blocks, ab_variants, cta_text, _provider = await llm_router.generate_structured_script(
            topic=topic,
            preset=body.duration_preset,
            goal=body.conversion_goal,
            wpm_rate=body.wpm_rate,
            creator_profile=profile_dict,
        )
        _, wc, est_sec, _ = compute_block_metrics(computed_blocks, body.wpm_rate, body.duration_preset)

    ice_info, _ = await llm_router.generate_hooks_with_skill(
        topic, 8.5, 8.0, 8.0, creator_profile=profile_dict
    )

    project.target_duration = body.duration_preset.value
    project.conversion_goal = body.conversion_goal.value
    project.ab_variants = [v.model_dump(mode="json") for v in ab_variants]

    script = Script(
        project_id=project.id,
        script_version=latest_ver + 1,
        duration_preset=body.duration_preset.value,
        conversion_goal=body.conversion_goal.value,
        wpm_rate=body.wpm_rate,
        two_column_blocks=[b.model_dump(mode="json") for b in computed_blocks],
        hook_variants=[h.model_dump(mode="json") for h in ice_info.hook_candidates],
        selected_hook_index=0,
        cta_text=cta_text,
        word_count=wc,
        estimated_duration_sec=est_sec,
    )
    db.add(script)
    await db.commit()
    await db.refresh(script)
    return _build_script_response(script)


@router.put("/scripts/{script_id}", response_model=ScriptResponse)
async def update_script_endpoint(
    script_id: uuid.UUID,
    body: ScriptUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> ScriptResponse:
    script = (await db.execute(select(Script).where(Script.id == script_id))).scalar_one_or_none()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found.")

    preset = body.duration_preset or DurationPreset(script.duration_preset)
    goal = body.conversion_goal or ConversionGoal(script.conversion_goal)
    computed_blocks, wc, est_sec, _ = compute_block_metrics(body.two_column_blocks, body.wpm_rate, preset)

    script.duration_preset = preset.value
    script.conversion_goal = goal.value
    script.wpm_rate = body.wpm_rate
    script.two_column_blocks = [b.model_dump(mode="json") for b in computed_blocks]
    script.selected_hook_index = body.selected_hook_index
    script.word_count = wc
    script.estimated_duration_sec = est_sec

    project = (await db.execute(select(ContentProject).where(ContentProject.id == script.project_id))).scalar_one_or_none()
    if project:
        project.target_duration = preset.value
        project.conversion_goal = goal.value
        if body.ab_variants is not None:
            project.ab_variants = [v.model_dump(mode="json") for v in body.ab_variants]

    await db.commit()
    await db.refresh(script)
    return _build_script_response(script)


# --- 6. Media Pipeline & S3 Multipart ---

@router.post("/media/s3/multipart-init", response_model=S3MultipartInitResponse)
async def init_s3_multipart(body: S3MultipartInitRequest) -> S3MultipartInitResponse:
    storage = ObjectStorageService()
    res = storage.initiate_multipart_upload(
        project_id=str(body.project_id),
        filename=body.filename,
        content_type=body.content_type,
        part_count=body.part_count,
    )
    return S3MultipartInitResponse(**res)


@router.post("/media/process", response_model=MediaQCReport)
async def process_media_endpoint(
    body: MediaProcessRequest,
    db: AsyncSession = Depends(get_db),
) -> MediaQCReport:
    project = (await db.execute(select(ContentProject).where(ContentProject.id == body.project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    script = (
        await db.execute(
            select(Script).where(Script.project_id == project.id).order_by(desc(Script.script_version)).limit(1)
        )
    ).scalar_one_or_none()
    script_hint = None
    if script and script.two_column_blocks:
        script_hint = " ".join(b.get("audio_voiceover", "") for b in script.two_column_blocks[:2]).strip()

    report = run_full_media_pipeline(
        project_id=str(project.id),
        raw_media_url=body.raw_media_url,
        script_text_hint=script_hint,
        silence_noise_db=body.silence_noise_db,
        min_silence_duration_sec=body.min_silence_duration_sec,
        target_lufs=body.target_lufs,
        subtitle_y_percent=body.subtitle_y_percent,
        generate_demo_source_if_missing=body.generate_demo_source_if_missing,
    )

    asset = VideoAsset(
        project_id=project.id,
        raw_media_url=report.raw_media_url,
        master_media_url=report.master_media_url,
        thumbnail_a_url=report.thumbnail_a_url,
        thumbnail_b_url=report.thumbnail_b_url,
        probe_metadata={"resolution": report.resolution, "fps": report.fps},
        transcription_json=[w.model_dump(mode="json") for w in report.transcription_words],
        silence_segments_json=report.silence_intervals,
        silences_trimmed=report.silences_trimmed,
        measured_lufs=report.measured_lufs,
        true_peak_dbfs=report.true_peak_dbfs,
        ass_subtitles=report.ass_subtitles_preview,
        qc_passed=report.qc_passed,
        qc_report={
            "ebu_r128": "PASS" if report.lufs_within_ebu_r128 else "FAIL",
            "measured_lufs": report.measured_lufs,
            "true_peak_dbfs": report.true_peak_dbfs,
            "silences_trimmed": report.silences_trimmed,
        },
    )
    db.add(asset)
    if project.current_state == FSMState.HITL_PENDING_PRODUCTION.value and report.qc_passed:
        project.current_state = FSMState.PRODUCED_VALIDATED.value

    await _record_audit(
        db=db,
        workspace_id=project.workspace_id,
        project_id=project.id,
        action_type="MEDIA_PIPELINE_QC_COMPLETE",
        agent_or_user_id="PostproducerEditor",
        security_tier=1,
        operation_status="SUCCESS" if report.qc_passed else "WARNING",
        payload={"measured_lufs": report.measured_lufs, "silences_trimmed": report.silences_trimmed},
    )
    await db.commit()
    await db.refresh(asset)
    report.video_asset_id = asset.id

    await broadcaster.broadcast(
        "MEDIA_QC_COMPLETED",
        {
            "project_id": str(project.id),
            "measured_lufs": report.measured_lufs,
            "silences_trimmed": report.silences_trimmed,
            "qc_passed": report.qc_passed,
        },
    )
    return report


@router.get("/media/{project_id}/master-file")
async def download_master_media(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    asset = (
        await db.execute(
            select(VideoAsset).where(VideoAsset.project_id == project_id).order_by(desc(VideoAsset.created_at)).limit(1)
        )
    ).scalar_one_or_none()
    if not asset or not asset.master_media_url:
        raise HTTPException(status_code=404, detail="Master media not found.")
    path = Path(asset.master_media_url)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Master file is stored in remote S3/R2 bucket.")
    return FileResponse(path, media_type="video/mp4", filename=path.name)


# --- 7. Social Copycrafting, Preflight & Publishing ---

@router.post("/social/copycraft", response_model=list[SocialPostResponse])
async def generate_social_copy_matrix(
    body: SocialCopyGenerateRequest,
    db: AsyncSession = Depends(get_db),
) -> list[SocialPostResponse]:
    project = (await db.execute(select(ContentProject).where(ContentProject.id == body.project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    goal = body.conversion_goal or ConversionGoal(project.conversion_goal)
    engine = SocialCopyCraftEngine()
    generated = engine.generate_all_channels(
        headline=body.headline,
        core_value=body.core_value,
        debate_question=body.debate_question,
        thesis_points=body.thesis_points,
        chapters=body.chapters,
        goal=goal,
    )

    # Replace existing unpublished drafts for this project
    existing = (await db.execute(select(SocialPost).where(SocialPost.project_id == project.id))).scalars().all()
    for e in existing:
        if e.publish_status != "PUBLISHED":
            await db.delete(e)
    await db.flush()

    created_posts: list[SocialPost] = []
    for item in generated:
        ch = SocialChannel(item["channel"])
        pf = validate_preflight(ch, item)
        sp = SocialPost(
            project_id=project.id,
            channel=item["channel"],
            title=item.get("title"),
            post_body=item["post_body"],
            first_comment=item.get("first_comment"),
            hashtags=item.get("hashtags", []),
            metadata_payload=item.get("metadata_payload", {}),
            preflight_warnings=pf.warnings + pf.blocking_errors,
            preflight_passed=pf.passed,
            publish_status="READY_FOR_HITL",
        )
        db.add(sp)
        created_posts.append(sp)

    await db.commit()
    for sp in created_posts:
        await db.refresh(sp)
    return [SocialPostResponse.model_validate(sp) for sp in created_posts]


@router.post("/social/preflight", response_model=PreflightCheckResult)
async def check_social_preflight(channel: SocialChannel, payload: dict[str, Any]) -> PreflightCheckResult:
    return validate_preflight(channel, payload)


@router.put("/social/posts/{post_id}", response_model=SocialPostResponse)
async def update_social_post(
    post_id: uuid.UUID,
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db),
) -> SocialPostResponse:
    post = (await db.execute(select(SocialPost).where(SocialPost.id == post_id))).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Social post not found.")

    if "title" in payload:
        post.title = payload["title"]
    if "post_body" in payload:
        post.post_body = payload["post_body"]
    if "first_comment" in payload:
        post.first_comment = payload["first_comment"]
    if "hashtags" in payload:
        post.hashtags = payload["hashtags"]

    pf = validate_preflight(
        SocialChannel(post.channel),
        {
            "title": post.title,
            "post_body": post.post_body,
            "first_comment": post.first_comment,
            "hashtags": post.hashtags,
        },
    )
    post.preflight_warnings = pf.warnings + pf.blocking_errors
    post.preflight_passed = pf.passed
    await db.commit()
    await db.refresh(post)
    return SocialPostResponse.model_validate(post)


@router.post("/social/publish")
async def execute_social_publish(
    body: SocialPublishExecuteRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    project = (await db.execute(select(ContentProject).where(ContentProject.id == body.project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    posts = (await db.execute(select(SocialPost).where(SocialPost.project_id == project.id))).scalars().all()
    post_by_channel = {p.channel: p for p in posts}
    ip_addr = request.client.host if request.client else "127.0.0.1"
    sec_mgr = HITLSecurityManager()

    results: list[dict[str, Any]] = []
    for ch in body.channels:
        sp = post_by_channel.get(ch.value)
        if not sp:
            raise HTTPException(status_code=404, detail=f"No prepared post found for {ch.value}.")

        connector = get_connector_for_channel(ch)
        try:
            pub_res = await connector.publish(
                project_id=str(project.id),
                payload={
                    "title": sp.title,
                    "post_body": sp.post_body,
                    "first_comment": sp.first_comment,
                    "hashtags": sp.hashtags,
                    "metadata_payload": sp.metadata_payload,
                },
                hitl_token=body.hitl_token,
                actor=body.actor,
                security_manager=sec_mgr,
            )
        except PermissionError as exc:
            await _record_audit(
                db=db,
                workspace_id=project.workspace_id,
                project_id=project.id,
                action_type=f"PUBLISH_{ch.value.upper()}",
                agent_or_user_id=body.actor,
                security_tier=3,
                operation_status="BLOCKED_HITL_REQUIRED",
                hitl_token_id=body.hitl_token,
                payload={"error": str(exc)},
                ip_source=ip_addr,
            )
            await db.commit()
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        sp.external_platform_id = pub_res["external_platform_id"]
        sp.canonical_url = pub_res["canonical_url"]
        sp.publish_status = "PUBLISHED"
        sp.published_at = datetime.now(timezone.utc)
        sp.hitl_approval_token = body.hitl_token
        results.append(pub_res)

        await _record_audit(
            db=db,
            workspace_id=project.workspace_id,
            project_id=project.id,
            action_type=f"PUBLISH_{ch.value.upper()}",
            agent_or_user_id=body.actor,
            security_tier=3,
            operation_status="SUCCESS",
            hitl_token_id=body.hitl_token,
            payload=pub_res,
            ip_source=ip_addr,
        )

    project.current_state = FSMState.PUBLISHED_LIVE.value
    history = list(project.state_history or [])
    history.append(
        {
            "from": FSMState.HITL_PENDING_PUBLISH.value,
            "to": FSMState.PUBLISHED_LIVE.value,
            "agent": body.actor,
            "tier": 3,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )
    project.state_history = history
    await db.commit()

    await broadcaster.broadcast(
        "PUBLISHED_LIVE",
        {"project_id": str(project.id), "channels": [c.value for c in body.channels]},
    )
    return {"status": "PUBLISHED_LIVE", "project_id": str(project.id), "publications": results}


# --- 8. Closed-Loop Analytics & RMT-A ---

@router.get("/analytics/overview")
async def analytics_overview(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    snapshots = (
        await db.execute(select(PerformanceSnapshot).order_by(desc(PerformanceSnapshot.recorded_at)))
    ).scalars().all()
    rules = (await db.execute(select(LearnedRule).order_by(desc(LearnedRule.created_at)).limit(20))).scalars().all()
    hooks = (await db.execute(select(HookVaultEntry).order_by(desc(HookVaultEntry.created_at)).limit(20))).scalars().all()

    return {
        "snapshots": [
            {
                "id": str(s.id),
                "social_post_id": str(s.social_post_id),
                "window_type": s.window_type,
                "view_count": s.view_count,
                "hold_rate_3s": s.hold_rate_3s,
                "completion_rate": s.completion_rate,
                "watch_time_share": s.watch_time_share,
                "sends_per_reach": s.sends_per_reach,
                "dwell_time_seconds": s.dwell_time_seconds,
                "outlier_multiplier": s.outlier_multiplier,
                "retention_curve": s.retention_curve,
                "diagnosis_layer": s.diagnosis_layer,
                "rmta_classification": s.rmta_classification,
                "recommended_action": s.recommended_action,
            }
            for s in snapshots
        ],
        "learned_rules": [
            {
                "id": str(r.id),
                "rmta_classification": r.rmta_classification,
                "diagnosis_layer": r.diagnosis_layer,
                "rule_statement": r.rule_statement,
                "confidence_weight": r.confidence_weight,
                "created_at": r.created_at.isoformat(),
            }
            for r in rules
        ],
        "hook_vault": [
            {
                "id": str(h.id),
                "hook_text": h.hook_text,
                "hook_type": h.hook_type,
                "verdict": h.verdict,
                "observed_hold_rate": h.observed_hold_rate,
            }
            for h in hooks
        ],
    }


@router.post("/analytics/watch-time-share", response_model=WatchTimeShareResponse)
async def compute_watch_time_share(body: WatchTimeShareRequest) -> WatchTimeShareResponse:
    return calculate_watch_time_share(body)


@router.post("/analytics/diagnose-rmta", response_model=RMTADiagnosisResponse)
async def diagnose_rmta_endpoint(
    body: RMTADiagnosisRequest,
    db: AsyncSession = Depends(get_db),
) -> RMTADiagnosisResponse:
    ws = await _get_default_workspace(db)
    diag = diagnose_rmta(body)

    if body.persist_rule:
        db.add(
            LearnedRule(
                workspace_id=ws.id,
                project_id=body.project_id,
                rmta_classification=diag.rmta_classification,
                diagnosis_layer=diag.diagnosis_layer,
                rule_statement=diag.learned_rule_statement,
                confidence_weight=0.95 if diag.is_outlier_positive else 0.8,
            )
        )
        if body.social_post_id:
            db.add(
                PerformanceSnapshot(
                    social_post_id=body.social_post_id,
                    window_type=body.window_type,
                    view_count=body.views,
                    hold_rate_3s=body.hold_rate_3s,
                    completion_rate=body.completion_rate,
                    watch_time_share=body.watch_time_share,
                    sends_per_reach=body.sends_per_reach,
                    dwell_time_seconds=body.dwell_time_seconds,
                    outlier_multiplier=diag.views_factor_vs_baseline,
                    diagnosis_layer=diag.diagnosis_layer,
                    rmta_classification=diag.rmta_classification,
                    recommended_action=diag.recommended_action,
                )
            )
        if body.project_id:
            proj = (
                await db.execute(select(ContentProject).where(ContentProject.id == body.project_id))
            ).scalar_one_or_none()
            if proj and proj.current_state == FSMState.PUBLISHED_LIVE.value:
                proj.current_state = FSMState.AUDITED_CLOSED_LOOP.value

        append_learned_rule_file(
            {
                "project_id": str(body.project_id) if body.project_id else None,
                "rmta_classification": diag.rmta_classification,
                "diagnosis_layer": diag.diagnosis_layer,
                "rule_statement": diag.learned_rule_statement,
            }
        )
        await _record_audit(
            db=db,
            workspace_id=ws.id,
            project_id=body.project_id,
            action_type="CLOSED_LOOP_RMTA_AUDIT",
            agent_or_user_id="AnalyticsExperimenter",
            security_tier=1,
            operation_status="SUCCESS",
            payload={"rmta": diag.rmta_classification, "layer": diag.diagnosis_layer},
        )
        await db.commit()

        await broadcaster.broadcast(
            "RMTA_RULE_LEARNED",
            {
                "rmta": diag.rmta_classification,
                "layer": diag.diagnosis_layer,
                "rule": diag.learned_rule_statement,
            },
        )

    return diag


# --- 7. Google Drive Video Ingestion & Infrastructure Status ---

@router.post("/media/google-drive/scan", response_model=GoogleDriveScanResponse)
async def scan_google_drive_folder(body: GoogleDriveScanRequest) -> GoogleDriveScanResponse:
    """Scan a shared Google Drive folder for available video files."""
    service = GoogleDriveService()
    try:
        folder_id = service.extract_resource_id(body.folder_url_or_id)
        files = await service.list_folder_videos(body.folder_url_or_id)
        return GoogleDriveScanResponse(
            folder_id=folder_id,
            files=[GoogleDriveFileItem(**f) for f in files],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Error al escanear carpeta de Google Drive: {exc}",
        ) from exc


@router.post("/media/google-drive/import", response_model=MediaQCReport)
async def import_video_from_google_drive(
    body: GoogleDriveImportRequest,
    db: AsyncSession = Depends(get_db),
) -> MediaQCReport:
    """Download video from Google Drive and run deterministic FFmpeg/Whisper pipeline."""
    proj = (
        await db.execute(select(ContentProject).where(ContentProject.id == body.project_id))
    ).scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found.")

    service = GoogleDriveService()
    try:
        local_path = await service.download_file_to_workspace(body.file_url_or_id)
        report = run_full_media_pipeline(
            project_id=str(proj.id),
            raw_media_url=str(local_path),
            script_text_hint=body.script_text_hint,
            generate_demo_source_if_missing=True,
        )

        # Update Project and Video Asset in DB
        asset = (
            await db.execute(select(VideoAsset).where(VideoAsset.project_id == proj.id))
        ).scalar_one_or_none()
        if not asset:
            asset = VideoAsset(
                project_id=proj.id,
                raw_media_url=str(local_path),
                master_media_url=report.master_media_url,
                qc_passed=report.qc_passed,
                qc_report=report.model_dump(mode="json"),
            )
            db.add(asset)
        else:
            asset.raw_media_url = str(local_path)
            asset.master_media_url = report.master_media_url
            asset.qc_passed = report.qc_passed
            asset.qc_report = report.model_dump(mode="json")

        proj.current_state = FSMState.PRODUCED_VALIDATED.value
        await db.commit()

        await broadcaster.broadcast(
            "MEDIA_IMPORTED_FROM_GDRIVE",
            {
                "project_id": str(proj.id),
                "resolution": report.resolution,
                "measured_lufs": report.measured_lufs,
                "silences_trimmed": report.silences_trimmed,
            },
        )
        return report
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Fallo en la importación y procesamiento de video desde Google Drive: {exc}",
        ) from exc


@router.get("/system/connections-status", response_model=SystemConnectionsStatusResponse)
async def get_system_connections_status(
    db: AsyncSession = Depends(get_db),
) -> SystemConnectionsStatusResponse:
    """Check health and live status of Supabase, Cloudflare R2, Redis, Google Drive and Social APIs."""
    settings = get_settings()

    # 1. Database Check (Supabase PostgreSQL vs SQLite fallback)
    db_url = settings.database_url
    if "postgres" in db_url.lower():
        is_supabase = "supabase" in db_url.lower()
        provider_name = "Supabase PostgreSQL 16" if is_supabase else "PostgreSQL 16 (pgvector)"
        db_status = InfrastructureServiceStatus(
            service_name="Base de Datos",
            status="CONNECTED",
            provider=provider_name,
            details="PostgreSQL conectado con soporte para extensiones vectoriales de memoria episódica.",
            action_required=None,
        )
    else:
        db_status = InfrastructureServiceStatus(
            service_name="Base de Datos",
            status="SANDBOX_MOCK",
            provider="SQLite Autónomo Local / Vercel tmp",
            details="Operando en base de datos local SQLite. Para producción permanente se recomienda conectar Supabase.",
            action_required="Añadir DATABASE_URL de Supabase en variables de entorno.",
        )

    # 2. Storage Check (Cloudflare R2 vs S3 vs Local)
    s3_endpoint = settings.s3_endpoint_url
    if "r2.cloudflarestorage.com" in s3_endpoint:
        storage_status = InfrastructureServiceStatus(
            service_name="Almacenamiento de Video",
            status="CONNECTED",
            provider="Cloudflare R2 ($0 egreso)",
            details=f"Bucket '{settings.s3_bucket_name}' conectado con URLs prefirmadas multiparte.",
            action_required=None,
        )
    elif settings.aws_access_key_id and settings.aws_access_key_id != "test":
        storage_status = InfrastructureServiceStatus(
            service_name="Almacenamiento de Video",
            status="CONNECTED",
            provider="AWS S3 / Compatible",
            details=f"Bucket '{settings.s3_bucket_name}' conectado.",
            action_required=None,
        )
    else:
        storage_status = InfrastructureServiceStatus(
            service_name="Almacenamiento de Video",
            status="SANDBOX_MOCK",
            provider="Almacenamiento Local Simulado",
            details="Los videos se guardan en el disco temporal local. Para producción masiva se recomienda Cloudflare R2.",
            action_required="Añadir S3_ENDPOINT_URL de Cloudflare R2, S3_BUCKET_NAME y credenciales.",
        )

    # 3. Cache & Queue Check (Upstash Redis vs Local)
    redis_url = settings.redis_url
    if "upstash.io" in redis_url or ("rediss://" in redis_url and "localhost" not in redis_url):
        cache_status = InfrastructureServiceStatus(
            service_name="Caché y Rate-Limiting",
            status="CONNECTED",
            provider="Upstash Redis Serverless",
            details="Control de tasa y colas de publicación distribuidas conectadas.",
            action_required=None,
        )
    else:
        cache_status = InfrastructureServiceStatus(
            service_name="Caché y Rate-Limiting",
            status="SANDBOX_MOCK",
            provider="Caché en Memoria Local",
            details="Rate-limiting ejecutándose en memoria local.",
            action_required="Añadir REDIS_URL de Upstash Redis para entornos multi-instancia.",
        )

    # 4. Google Drive Check
    has_gdrive_key = bool(os.environ.get("GOOGLE_DRIVE_API_KEY"))
    google_drive_status = InfrastructureServiceStatus(
        service_name="Ingesta Google Drive",
        status="CONNECTED" if has_gdrive_key else "SANDBOX_MOCK",
        provider="Google Drive API v3",
        details="Listo para importar videos desde enlaces compartidos y carpetas de Google Drive."
        if has_gdrive_key
        else "Descarga directa de enlaces públicos activada. Para escanear carpetas privadas añade GOOGLE_DRIVE_API_KEY.",
        action_required=None if has_gdrive_key else "Opcional: Añadir GOOGLE_DRIVE_API_KEY de Google Cloud Console.",
    )

    # 5. Media Processing Worker Check
    media_worker_status = InfrastructureServiceStatus(
        service_name="Worker de Video y Audio",
        status="CONNECTED",
        provider="FFmpeg 7.x + Faster-Whisper",
        details="Pipeline de normalización EBU R128 (-14 LUFS) y corte de silencios activo.",
        action_required=None,
    )

    # 6. Social Channels
    social_channels: dict[str, InfrastructureServiceStatus] = {}
    tokens = {
        "YouTube": settings.youtube_access_token,
        "Instagram": settings.instagram_access_token,
        "TikTok": settings.tiktok_access_token,
        "LinkedIn": settings.linkedin_access_token,
    }
    for ch_name, token in tokens.items():
        is_live = bool(token and token.strip() and not token.startswith("test_"))
        social_channels[ch_name] = InfrastructureServiceStatus(
            service_name=ch_name,
            status="CONNECTED" if is_live else "SANDBOX_MOCK",
            provider=f"API Oficial {ch_name}",
            details="Credencial en vivo detectada. Publicación directa autorizada."
            if is_live
            else "Modo Sandbox / Simulación seguro activo. Publicaciones simuladas sin tocar cuenta real.",
            action_required=None if is_live else f"Añadir token oficial de {ch_name} cuando quieras publicar en vivo.",
        )

    all_ready = (
        db_status.status == "CONNECTED"
        and storage_status.status == "CONNECTED"
    )

    return SystemConnectionsStatusResponse(
        all_ready_for_production=all_ready,
        database=db_status,
        storage=storage_status,
        cache=cache_status,
        google_drive=google_drive_status,
        media_worker=media_worker_status,
        social_channels=social_channels,
    )


# --- 8. Hybrid Skill-Aware LLM Router (Ollama MiniPC + Claude Prompt Caching) ---

@router.get("/llm/config", response_model=LLMConfigResponse)
async def get_llm_config() -> LLMConfigResponse:
    """Return active LLM router configuration, hardware RAM presets, and loaded Skill specs."""
    return get_llm_router().get_config_response()


@router.put("/llm/config", response_model=LLMConfigResponse)
async def update_llm_config(body: LLMConfigUpdateRequest) -> LLMConfigResponse:
    """Hot-update active LLM provider (Ollama local, Claude with Prompt Caching, OpenRouter, Deterministic)."""
    return get_llm_router().update_config(body)


@router.post("/llm/test-connection", response_model=LLMTestConnectionResponse)
async def test_llm_connection(body: LLMTestConnectionRequest) -> LLMTestConnectionResponse:
    """Probe Ollama (MiniPC/Tunnel), Anthropic Claude API, or deterministic engine."""
    return await get_llm_router().test_connection(
        provider_override=body.provider,
        ollama_base_url=body.ollama_base_url,
        ollama_model=body.ollama_model,
    )


@router.get("/llm/skills", response_model=list[LoadedSkillAgentSpec])
async def list_loaded_skills() -> list[LoadedSkillAgentSpec]:
    """List canonical Markdown agent Skills loaded from claude-content-engine-skill/."""
    return get_llm_router().loader.list_loaded_skills()


