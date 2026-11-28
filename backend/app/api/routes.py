"""REST API Router for Autonomous Content Engine Web."""

from __future__ import annotations

import asyncio
import json
import os
import re
import unicodedata
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy import inspect as sa_inspect
from sqlalchemy import text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.ws import broadcaster
from app.core.config import get_settings
from app.core.security import HITLSecurityManager, get_permissions_summary
from app.db.session import get_db
from app.models.entities import (
    AuditLog,
    Autolist,
    AutolistItem,
    ContentProject,
    CreatorProfile,
    HookVaultEntry,
    Idea,
    LearnedRule,
    PerformanceSnapshot,
    Script,
    SocialCredential,
    SocialPost,
    VideoAsset,
    Workspace,
)
from app.schemas.contracts import (
    AdCampaignGenerateRequest,
    AdCampaignResponse,
    AdCreativeVariant,
    AuditLogResponse,
    AutolistCreateRequest,
    AutolistItemCreateRequest,
    AutolistItemResponse,
    AutolistResponse,
    AutolistUpdateRequest,
    BestTimeHeatmapResponse,
    ComposerPostCreateRequest,
    ConversionGoal,
    ContentFormat,
    CreatorProfileSchema,
    CreatorProfileUpdateRequest,
    DurationPreset,
    FSMState,
    FSMTransitionRequest,
    GitHubBatchImportRequest,
    GitHubBatchImportResponse,
    GitHubImportRequest,
    GitHubImportResponse,
    GitHubRepoItem,
    GoogleDriveFileItem,
    GoogleDriveImportRequest,
    GoogleDriveScanRequest,
    GoogleDriveScanResponse,
    GoogleRSASpec,
    HITLTokenIssueRequest,
    HITLTokenIssueResponse,
    HookCandidate,
    ICEScoreRequest,
    ICEScoreResponse,
    IdeaAIEvaluationRequest,
    IdeaAIEvaluationResponse,
    IdeaChatMessage,
    IdeaChatRefineRequest,
    IdeaChatRefineResponse,
    InfrastructureServiceStatus,
    KigalChatFunnelRow,
    KigalChatInteraction,
    KigalChatStatus,
    LeadMagnetItem,
    LinkedInAdLibrarySearchRequest,
    LinkedInAdLibrarySearchResponse,
    LinkedInAdLibraryStatusResponse,
    LinkedInAdToIdeaRequest,
    LLMConfigResponse,
    LLMConfigUpdateRequest,
    LLMTestConnectionRequest,
    LLMTestConnectionResponse,
    LoadedSkillAgentSpec,
    ManyChatTriggerRequest,
    ManyChatTriggerResponse,
    ManyChatTriggerRule,
    MediaProcessRequest,
    MediaQCReport,
    N8nWorkflowTemplateResponse,
    PreflightCheckResult,
    ProjectCreateRequest,
    ProjectSummaryResponse,
    PublishingCalendarResponse,
    RadarMatutinoIngestRequest,
    RadarMatutinoIngestResponse,
    RMTADiagnosisRequest,
    RMTADiagnosisResponse,
    S3MultipartInitRequest,
    S3MultipartInitResponse,
    ScheduleUpdateRequest,
    ScriptGenerateRequest,
    ScriptResponse,
    ScriptUpdateRequest,
    SocialAccountItem,
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
from app.services.linkedin_ads import (
    LinkedInAdLibraryClient,
    generate_linkedin_b2b_ads_spec,
)
from app.services.mcp_hub import MCPClientHub
from app.services.publishing_scheduler import (
    RATE_LIMITED_STATUS,
    channel_pause_message,
    compute_best_time_heatmap,
    get_channel_pause_until,
    project_autolist_slots,
    rate_limit_audit_payload,
    register_channel_pause,
    resolve_effective_social_credential,
    run_due_scheduled_posts,
)
from app.services.social_connectors import (
    InstagramApiError,
    MetaGraphConnector,
    SocialCopyCraftEngine,
    SocialPublishError,
    SocialRateLimitError,
    get_connector_for_channel,
    validate_preflight,
)
from app.services.storage_s3 import ObjectStorageService
from app.services.google_drive import GoogleDriveService
from app.services.skill_llm_router import get_llm_router
from app.services.zimage_service import generate_image_with_zimage, get_zimage_status
from app.workers.media_pipeline import run_full_media_pipeline


router = APIRouter()


@router.get("/health")
async def api_v1_health() -> dict[str, str]:
    return {"status": "ok", "service": "KigalContent Studio API", "version": "3.0.0"}


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


def _serialize_social_post(
    post: SocialPost,
    project: ContentProject | None = None,
) -> SocialPostResponse:
    return SocialPostResponse(
        id=post.id,
        project_id=post.project_id,
        channel=post.channel,
        external_platform_id=post.external_platform_id,
        canonical_url=post.canonical_url,
        title=post.title,
        post_body=post.post_body,
        first_comment=post.first_comment,
        hashtags=post.hashtags or [],
        metadata_payload=post.metadata_payload or {},
        preflight_warnings=post.preflight_warnings or [],
        preflight_passed=post.preflight_passed,
        publish_status=post.publish_status,
        hitl_approval_token=post.hitl_approval_token,
        scheduled_at=post.scheduled_at,
        published_at=post.published_at,
        auto_publish=getattr(post, "auto_publish", True),
        timezone=getattr(post, "timezone", "Europe/Madrid") or "Europe/Madrid",
        publish_error=getattr(post, "publish_error", None),
        autolist_id=getattr(post, "autolist_id", None),
        project_title=project.working_title if project else None,
        asset_code=project.asset_code if project else None,
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

def _serialize_creator_profile(row: CreatorProfile) -> CreatorProfileSchema:
    raw_social = dict(row.social_profiles or {})
    flat_social: dict[str, str] = {
        k: str(v) for k, v in raw_social.items() if not k.startswith("_") and isinstance(v, str)
    }
    raw_accounts = raw_social.get("_accounts")
    social_accounts: list[SocialAccountItem] = []
    if isinstance(raw_accounts, list):
        for idx, acc in enumerate(raw_accounts):
            if isinstance(acc, dict) and acc.get("url"):
                social_accounts.append(
                    SocialAccountItem(
                        id=str(acc.get("id") or f"acc-{idx}"),
                        platform=str(acc.get("platform") or "other"),
                        label=str(acc.get("label") or ""),
                        url=str(acc.get("url")),
                    )
                )
    if not social_accounts and flat_social:
        for plat, url_val in flat_social.items():
            if url_val.strip():
                social_accounts.append(
                    SocialAccountItem(
                        id=f"legacy-{plat}",
                        platform=plat,
                        label="Principal",
                        url=url_val.strip(),
                    )
                )

    raw_repos = raw_social.get("_github_repos")
    github_repos: list[GitHubRepoItem] = []
    if isinstance(raw_repos, list):
        for repo in raw_repos[:5]:
            if isinstance(repo, dict) and repo.get("repo_full_name"):
                github_repos.append(GitHubRepoItem(**repo))

    raw_catalog = dict(row.conversion_goals_catalog or {})
    raw_triggers = raw_catalog.pop("_manychat_triggers", [])
    clean_catalog = {k: v for k, v in raw_catalog.items() if not k.startswith("_") and isinstance(v, dict)}

    manychat_triggers: list[ManyChatTriggerRule] = []
    if isinstance(raw_triggers, list):
        for t in raw_triggers:
            if isinstance(t, dict) and t.get("keyword"):
                manychat_triggers.append(ManyChatTriggerRule(**t))
    elif "EMAIL_LEAD_CAPTURE" in clean_catalog and isinstance(clean_catalog["EMAIL_LEAD_CAPTURE"], dict):
        kw = clean_catalog["EMAIL_LEAD_CAPTURE"].get("trigger_word")
        if kw:
            manychat_triggers.append(
                ManyChatTriggerRule(
                    id="trig-default",
                    keyword=str(kw).upper(),
                    lead_magnet_id=None,
                    platform="all",
                    dm_reply_template=f"¡Gracias por comentar {str(kw).upper()}! Aquí tienes tu recurso:",
                    active=True,
                )
            )

    lead_magnets: list[LeadMagnetItem] = []
    for idx, lm in enumerate(row.lead_magnets or []):
        if isinstance(lm, dict) and lm.get("title"):
            lead_magnets.append(
                LeadMagnetItem(
                    id=str(lm.get("id") or f"lm-{idx}"),
                    title=str(lm.get("title")),
                    description=str(lm.get("description") or ""),
                    format=str(lm.get("format") or "Guía PDF"),
                    delivery_url=str(lm.get("delivery_url") or ""),
                    source=str(lm.get("source") or "manual"),
                    created_at=lm.get("created_at"),
                )
            )

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
        conversion_goals_catalog=clean_catalog,
        active_conversion_goal=ConversionGoal(row.active_goal),
        social_profiles=flat_social,
        social_accounts=social_accounts,
        github_repos=github_repos,
        lead_magnets=lead_magnets,
        manychat_triggers=manychat_triggers,
        voice_guidelines=row.voice_guidelines,
    )


@router.get("/creator-profile", response_model=CreatorProfileSchema)
async def get_creator_profile(db: AsyncSession = Depends(get_db)) -> CreatorProfileSchema:
    row = (await db.execute(select(CreatorProfile).limit(1))).scalar_one_or_none()
    if not row:
        raw = get_settings().load_creator_profile_file()
        return CreatorProfileSchema(**raw)
    return _serialize_creator_profile(row)


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

    current_catalog = dict(row.conversion_goals_catalog or {})
    if body.conversion_goals_catalog is not None:
        preserved_triggers = current_catalog.get("_manychat_triggers")
        current_catalog = {
            k: v.model_dump(mode="json") for k, v in body.conversion_goals_catalog.items()
        }
        if preserved_triggers is not None:
            current_catalog["_manychat_triggers"] = preserved_triggers
    if body.manychat_triggers is not None:
        current_catalog["_manychat_triggers"] = [
            t.model_dump(mode="json") for t in body.manychat_triggers
        ]
    row.conversion_goals_catalog = current_catalog

    current_social = dict(row.social_profiles or {})
    if body.social_profiles is not None:
        preserved_acc = current_social.get("_accounts")
        preserved_repos = current_social.get("_github_repos")
        current_social = dict(body.social_profiles)
        if preserved_acc is not None:
            current_social["_accounts"] = preserved_acc
        if preserved_repos is not None:
            current_social["_github_repos"] = preserved_repos
    if body.social_accounts is not None:
        current_social["_accounts"] = [a.model_dump(mode="json") for a in body.social_accounts]
        # Sync primary URL per platform to flat social_profiles for backwards compatibility
        for plat in ("youtube", "instagram", "tiktok", "linkedin", "website", "github"):
            first_match = next((a.url for a in body.social_accounts if a.platform == plat and a.url), None)
            if first_match:
                current_social[plat] = first_match
    if body.github_repos is not None:
        current_social["_github_repos"] = [r.model_dump(mode="json") for r in body.github_repos[:5]]
    row.social_profiles = current_social

    if body.lead_magnets is not None:
        row.lead_magnets = [lm.model_dump(mode="json") for lm in body.lead_magnets]

    if body.voice_guidelines is not None:
        row.voice_guidelines = body.voice_guidelines

    # Sync back to canonical creator_profile.json
    settings = get_settings()
    file_data = settings.load_creator_profile_file()
    serialized = _serialize_creator_profile(row)
    file_data.update(serialized.model_dump(mode="json"))
    settings.save_creator_profile_file(file_data)

    await _record_audit(
        db=db,
        workspace_id=row.workspace_id,
        action_type="UPDATE_CREATOR_CONTEXT_ENGINE",
        agent_or_user_id="Creator",
        security_tier=1,
        operation_status="SUCCESS",
        payload={
            "active_goal": row.active_goal,
            "niche": row.niche,
            "github_repos_count": len(serialized.github_repos),
            "lead_magnets_count": len(serialized.lead_magnets),
            "manychat_triggers_count": len(serialized.manychat_triggers),
        },
        ip_source=request.client.host if request.client else "127.0.0.1",
    )
    await db.commit()
    return await get_creator_profile(db)


def _parse_github_slug(raw: str) -> tuple[str, str]:
    cleaned = raw.strip().rstrip("/")
    if cleaned.endswith(".git"):
        cleaned = cleaned[:-4]
    if "github.com/" in cleaned:
        cleaned = cleaned.split("github.com/", 1)[1]
    parts = [p for p in cleaned.split("/") if p]
    if len(parts) < 2:
        raise HTTPException(
            status_code=400,
            detail="Formato de repositorio inválido. Usa 'usuario/repositorio' o 'https://github.com/usuario/repositorio'.",
        )
    return parts[0], parts[1]


async def _fetch_single_github_repo(
    body: GitHubImportRequest,
) -> tuple[GitHubImportResponse, GitHubRepoItem, str]:
    """Fetch metadata, README and lead magnet candidates for a single GitHub repository."""
    import re
    import httpx

    owner, repo = _parse_github_slug(body.repo_url_or_slug)
    headers: dict[str, str] = {
        "User-Agent": "AutonomousContentEngine/2.0",
        "Accept": "application/vnd.github+json",
    }
    if body.github_token and body.github_token.strip():
        headers["Authorization"] = f"Bearer {body.github_token.strip()}"

    async with httpx.AsyncClient(timeout=12.0) as client:
        meta_resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}",
            headers=headers,
        )
        if meta_resp.status_code == 404:
            raise HTTPException(
                status_code=404,
                detail=f"Repositorio '{owner}/{repo}' no encontrado (si es privado, añade un GitHub Token).",
            )
        if meta_resp.status_code >= 400:
            raise HTTPException(
                status_code=meta_resp.status_code,
                detail=f"Error al consultar GitHub ({meta_resp.status_code}).",
            )
        meta = meta_resp.json()

        readme_text = ""
        readme_headers = {**headers, "Accept": "application/vnd.github.raw+json"}
        readme_resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/readme",
            headers=readme_headers,
        )
        if readme_resp.status_code == 200:
            readme_text = readme_resp.text[:3500]

        root_items: list[dict[str, Any]] = []
        contents_resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/contents",
            headers=headers,
        )
        if contents_resp.status_code == 200 and isinstance(contents_resp.json(), list):
            root_items = contents_resp.json()

    description = meta.get("description") or ""
    language = meta.get("language") or ""
    topics: list[str] = meta.get("topics") or []
    homepage = (meta.get("homepage") or "").strip() or None
    repo_full_name = meta.get("full_name") or f"{owner}/{repo}"
    repo_url = meta.get("html_url") or f"https://github.com/{owner}/{repo}"
    owner_login = (meta.get("owner") or {}).get("login") or owner

    excerpt_lines = [
        line.strip()
        for line in readme_text.splitlines()
        if line.strip() and not line.strip().startswith("<!--")
    ][:12]
    readme_excerpt = "\n".join(excerpt_lines)[:900]

    pillars = list(dict.fromkeys(([language] if language else []) + topics[:5]))
    if not pillars:
        pillars = ["Desarrollo de Producto", "Build in Public", "Automatización"]

    suggested_niche = (
        f"Tecnología, {language} y {topics[0]}"
        if language and topics
        else f"Desarrollo y Producto Digital ({language or repo})"
    )
    suggested_context = (
        f"Proyecto en GitHub: {repo_full_name} ({repo_url}).\n"
        f"Descripción: {description or 'Sin descripción breve en GitHub.'}\n"
        f"Stack / Temas: {', '.join(pillars)}.\n\n"
        f"Resumen técnico del README:\n{readme_excerpt}"
    ).strip()

    # Extract Lead Magnets from repo + root files/docs/templates + README links
    now_iso = datetime.now(timezone.utc).isoformat()
    extracted_lms: list[LeadMagnetItem] = [
        LeadMagnetItem(
            id=f"lm-gh-{owner}-{repo}".lower(),
            title=f"Repositorio & Kit: {repo}",
            description=description or f"Código fuente, arquitectura y documentación de {repo_full_name}.",
            format="Repo GitHub / Open Source",
            delivery_url=repo_url,
            source=f"github:{repo_full_name}",
            created_at=now_iso,
        )
    ]

    resource_keywords = ("guide", "guia", "template", "plantilla", "checklist", "prompt", "workflow", "docs", "starter", "example", "demo")
    for item in root_items:
        item_name = str(item.get("name") or "")
        item_url = str(item.get("html_url") or "")
        if item_url and any(kw in item_name.lower() for kw in resource_keywords):
            extracted_lms.append(
                LeadMagnetItem(
                    id=f"lm-gh-{repo}-{item_name}".lower()[:64],
                    title=f"Recurso {repo}: {item_name}",
                    description=f"Carpeta o archivo extraído automáticamente de {repo_full_name}.",
                    format="Plantilla / Docs" if item.get("type") == "dir" else "Archivo / Guía",
                    delivery_url=item_url,
                    source=f"github:{repo_full_name}",
                    created_at=now_iso,
                )
            )

    for match in re.finditer(r"\[([^\]]{4,80})\]\((https?://[^\)]+)\)", readme_text):
        link_title, link_url = match.group(1).strip(), match.group(2).strip()
        if any(kw in link_title.lower() or kw in link_url.lower() for kw in resource_keywords):
            if len(extracted_lms) < 6:
                extracted_lms.append(
                    LeadMagnetItem(
                        id=f"lm-gh-link-{uuid.uuid4().hex[:8]}",
                        title=link_title,
                        description=f"Recurso enlazado en el README de {repo_full_name}.",
                        format="Enlace / Guía",
                        delivery_url=link_url,
                        source=f"github:{repo_full_name}",
                        created_at=now_iso,
                    )
                )

    suggested_icp = (
        f"Desarrolladores, founders y profesionales técnicos interesados en {', '.join(pillars[:3])} "
        f"que buscan soluciones prácticas basadas en {repo}."
    )
    suggested_goals = [
        "Captar correos y leads cualificados (Lead Magnets)",
        "Posicionar liderazgo de opinión y reconocimiento de marca",
        "Generar conversaciones y respuestas por Mensaje Directo (DMs)",
    ]
    suggested_voice = (
        f"Directo, técnico pero accesible. Muestra demos reales de {repo}, comparte aprendizajes de código y arquitectura, "
        "y evita el humo corporativo."
    )

    resp = GitHubImportResponse(
        repo_full_name=repo_full_name,
        repo_url=repo_url,
        description=description,
        primary_language=language or None,
        topics=topics,
        readme_excerpt=readme_excerpt,
        suggested_niche=suggested_niche,
        suggested_project_context=suggested_context,
        suggested_content_pillars=pillars,
        suggested_tagline=description[:120] if description else f"Construyendo {repo_full_name} en público",
        suggested_name=owner_login,
        suggested_icp=suggested_icp,
        suggested_strategic_goals=suggested_goals,
        suggested_communication_style="Directo y con Autoridad",
        suggested_visual_style="Tecnológico / Neón Dinámico",
        suggested_voice_guidelines=suggested_voice,
        homepage=homepage,
        extracted_lead_magnets=extracted_lms,
    )
    repo_item = GitHubRepoItem(
        repo_full_name=repo_full_name,
        repo_url=repo_url,
        description=description,
        primary_language=language or None,
        topics=topics,
        homepage=homepage,
        added_at=now_iso,
    )
    return resp, repo_item, owner_login


@router.post("/creator-profile/import-github", response_model=GitHubImportResponse)
async def import_github_repo_context(body: GitHubImportRequest) -> GitHubImportResponse:
    """Fetch repository metadata, README and Lead Magnets from GitHub to enrich Creator Context."""
    resp, _, _ = await _fetch_single_github_repo(body)
    return resp


@router.post("/creator-profile/import-github-batch", response_model=GitHubBatchImportResponse)
async def import_github_repos_batch(body: GitHubBatchImportRequest) -> GitHubBatchImportResponse:
    """Fetch up to 5 GitHub repositories and autocomplete the full Creator Profile + Lead Magnets."""
    imported_repos: list[GitHubRepoItem] = []
    all_pillars: list[str] = []
    context_sections: list[str] = []
    social_accounts: list[SocialAccountItem] = []
    extracted_lms: list[LeadMagnetItem] = []
    seen_lm_urls: set[str] = set()
    first_resp: GitHubImportResponse | None = None
    owner_name = ""

    for req in body.repos[:5]:
        resp, repo_item, owner_login = await _fetch_single_github_repo(req)
        if first_resp is None:
            first_resp = resp
            owner_name = owner_login
        imported_repos.append(repo_item)
        all_pillars.extend(resp.suggested_content_pillars)
        context_sections.append(resp.suggested_project_context)

        social_accounts.append(
            SocialAccountItem(
                id=f"gh-{repo_item.repo_full_name.replace('/', '-')}",
                platform="github",
                label=repo_item.repo_full_name,
                url=repo_item.repo_url,
            )
        )
        if repo_item.homepage:
            social_accounts.append(
                SocialAccountItem(
                    id=f"web-{repo_item.repo_full_name.replace('/', '-')}",
                    platform="website",
                    label=f"Web {repo_item.repo_full_name.split('/')[-1]}",
                    url=repo_item.homepage,
                )
            )
        for lm in resp.extracted_lead_magnets:
            if lm.delivery_url not in seen_lm_urls:
                seen_lm_urls.add(lm.delivery_url)
                extracted_lms.append(lm)

    unique_pillars = list(dict.fromkeys(all_pillars))[:8]
    repo_names = ", ".join(r.repo_full_name for r in imported_repos)
    merged_context = "\n\n---\n\n".join(context_sections)

    return GitHubBatchImportResponse(
        imported_repos=imported_repos,
        suggested_name=owner_name,
        suggested_tagline=(
            first_resp.suggested_tagline
            if first_resp
            else f"Creador de {repo_names}"
        ),
        suggested_niche=(
            first_resp.suggested_niche
            if first_resp
            else "Tecnología, Software y Automatización"
        ),
        suggested_icp=(
            f"Founders, desarrolladores y equipos técnicos interesados en {', '.join(unique_pillars[:4])}."
        ),
        suggested_project_context=merged_context,
        suggested_strategic_goals=[
            "Captar correos y leads cualificados (Lead Magnets)",
            "Posicionar liderazgo de opinión y reconocimiento de marca",
            "Generar conversaciones y respuestas por Mensaje Directo (DMs)",
        ],
        suggested_communication_style="Directo y con Autoridad",
        suggested_visual_style="Tecnológico / Neón Dinámico",
        suggested_content_pillars=unique_pillars,
        suggested_voice_guidelines=(
            f"Tono práctico y transparente (Build in Public). Comparte aprendizajes reales de {repo_names}, "
            "ejemplos concretos de código/sistema y evita el relleno teórico."
        ),
        suggested_social_accounts=social_accounts,
        extracted_lead_magnets=extracted_lms,
    )


_KEYWORD_STRIP_MARKS = {"\u0300", "\u0301", "\u0302", "\u0308"}


def _normalize_keyword_text(value: str) -> str:
    """Drop grave/acute/circumflex/diaeresis but keep the tilde of ñ, then lowercase (as bot/lib/match.ts)."""
    decomposed = unicodedata.normalize("NFD", value)
    return "".join(ch for ch in decomposed if ch not in _KEYWORD_STRIP_MARKS).lower()


def _is_word_char(ch: str) -> bool:
    return unicodedata.category(ch)[0] in ("L", "M", "N")


def _matches_keyword(text: str, keyword: str) -> bool:
    """Whole-word match: GUIA matches "guía!!" and "quiero la guia", never "guias", "GUIAR" or "seguía"."""
    k = _normalize_keyword_text(keyword.strip())
    if not k:
        return False
    haystack = _normalize_keyword_text(text)
    start = haystack.find(k)
    while start != -1:
        end = start + len(k)
        before_ok = start == 0 or not _is_word_char(haystack[start - 1])
        after_ok = end == len(haystack) or not _is_word_char(haystack[end])
        if before_ok and after_ok:
            return True
        start = haystack.find(k, start + 1)
    return False


def _build_kigalchat_public_reply(
    username: str,
    keyword: str,
    lead_magnet_title: str,
    variant_seed: int = 0,
) -> str:
    """Generate varied, anti-spam public comment replies to trigger DM delivery safely."""
    handle = username if username.startswith("@") else f"@{username}"
    templates = [
        f"¡Enviado por DM {handle}! 📩 Revisa tus mensajes (o solicitudes) para abrir {lead_magnet_title}.",
        f"{handle} te acabo de mandar {lead_magnet_title} por privado ✨ Échale un ojo a tu bandeja.",
        f"¡Listo {handle}! 🚀 Ya tienes el acceso directo a {lead_magnet_title} en tu DM.",
        f"Recibido '{keyword}' {handle} 🙌 Te dejé {lead_magnet_title} en mensajes directos.",
        f"¡Hecho {handle}! 💡 Revisa tu bandeja de DM, ahí tienes {lead_magnet_title}.",
    ]
    return templates[variant_seed % len(templates)]


def _resolve_rule_lead_magnet(
    rule: ManyChatTriggerRule,
    profile: CreatorProfileSchema,
    row: CreatorProfile,
    fallback_first: bool = False,
) -> tuple[LeadMagnetItem | None, str, str]:
    linked_lm: LeadMagnetItem | None = next(
        (lm for lm in profile.lead_magnets if lm.id == rule.lead_magnet_id),
        None,
    )
    if not linked_lm and fallback_first and profile.lead_magnets:
        linked_lm = profile.lead_magnets[0]
    if linked_lm:
        return linked_lm, linked_lm.title, linked_lm.delivery_url

    if fallback_first and row.lead_magnets:
        first_raw = row.lead_magnets[0]
        if isinstance(first_raw, dict):
            raw_title = str(first_raw.get("title") or first_raw.get("name") or f"Recurso {rule.keyword}")
            raw_url = str(first_raw.get("delivery_url") or "")
            return None, raw_title, raw_url
    return None, "tu recurso", ""


@router.post("/manychat/trigger", response_model=ManyChatTriggerResponse)
@router.post("/manychat/webhook", response_model=ManyChatTriggerResponse)
async def execute_manychat_keyword_trigger(
    body: ManyChatTriggerRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ManyChatTriggerResponse:
    """Match an incoming keyword (KigalChat/ManyChat/DM/Comment) to a Lead Magnet and return public + DM replies."""
    row = (await db.execute(select(CreatorProfile).limit(1))).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Creator profile not found.")

    profile = _serialize_creator_profile(row)
    incoming_kw = body.keyword.strip().upper()
    comment_text = body.comment_text or body.keyword

    matched_rule: ManyChatTriggerRule | None = None
    for rule in profile.manychat_triggers:
        if not rule.active:
            continue
        if rule.platform not in ("all", body.platform.lower()):
            continue
        if _matches_keyword(comment_text, rule.keyword):
            matched_rule = rule
            break

    if not matched_rule:
        return ManyChatTriggerResponse(
            matched=False,
            keyword=incoming_kw,
            platform=body.platform,
            lead_magnet=None,
            public_comment_reply="",
            dm_reply_text="",
            delivery_url="",
        )

    linked_lm, lm_title, delivery_url = _resolve_rule_lead_magnet(
        matched_rule, profile, row, fallback_first=False
    )
    template = matched_rule.dm_reply_template.strip() or (
        f"¡Hola {body.username}! Aquí tienes acceso directo a {lm_title}:"
    )
    dm_reply_text = f"{template} {delivery_url}".strip()
    public_comment_reply = _build_kigalchat_public_reply(
        username=body.username,
        keyword=matched_rule.keyword,
        lead_magnet_title=lm_title,
        variant_seed=matched_rule.triggers_count,
    )

    if body.dry_run:
        # Rule tester: same match result, but no counter, no AuditLog and no broadcast.
        return ManyChatTriggerResponse(
            matched=True,
            keyword=matched_rule.keyword,
            platform=body.platform,
            lead_magnet=linked_lm,
            public_comment_reply=public_comment_reply,
            dm_reply_text=dm_reply_text,
            delivery_url=delivery_url,
            manychat_flow_id=matched_rule.manychat_flow_id,
            triggers_count=matched_rule.triggers_count,
        )

    # Increment triggers_count & persist
    matched_rule.triggers_count += 1
    current_catalog = dict(row.conversion_goals_catalog or {})
    current_catalog["_manychat_triggers"] = [
        t.model_dump(mode="json") for t in profile.manychat_triggers
    ]
    row.conversion_goals_catalog = current_catalog

    await _record_audit(
        db=db,
        workspace_id=row.workspace_id,
        action_type="MANYCHAT_KEYWORD_TRIGGERED",
        agent_or_user_id=f"ManyChat:{body.platform}",
        security_tier=1,
        operation_status="SUCCESS",
        payload={
            "keyword": matched_rule.keyword,
            "platform": body.platform,
            "username": body.username,
            "comment_text": body.comment_text or body.keyword,
            "public_comment_reply": public_comment_reply,
            "dm_reply_text": dm_reply_text,
            "lead_magnet_title": lm_title,
            "delivery_url": delivery_url,
            # This endpoint only computes the replies for an external ManyChat flow; it delivers nothing.
            "status": "MATCHED",
        },
        ip_source=request.client.host if request.client else "127.0.0.1",
    )
    await db.commit()

    await broadcaster.broadcast(
        "MANYCHAT_KEYWORD_MATCHED",
        {
            "keyword": matched_rule.keyword,
            "platform": body.platform,
            "username": body.username,
            "lead_magnet": lm_title,
            "public_comment_reply": public_comment_reply,
        },
    )

    return ManyChatTriggerResponse(
        matched=True,
        keyword=matched_rule.keyword,
        platform=body.platform,
        lead_magnet=linked_lm,
        public_comment_reply=public_comment_reply,
        dm_reply_text=dm_reply_text,
        delivery_url=delivery_url,
        manychat_flow_id=matched_rule.manychat_flow_id,
        triggers_count=matched_rule.triggers_count,
    )


def _pg_text_array(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, str):
        return [k.strip('"') for k in value.strip("{}").split(",") if k]
    return [str(k) for k in value]


async def _bot_tables_present(db: AsyncSession) -> tuple[bool, bool]:
    """Return (core bot tables exist, funnel view exists) without reading their data."""

    def _check(sync_session: Any) -> tuple[bool, bool]:
        insp = sa_inspect(sync_session.connection())
        tables = set(insp.get_table_names())
        core = {"bot_accounts", "bot_rules", "bot_sent"} <= tables
        try:
            views = set(insp.get_view_names())
        except Exception:
            views = set()
        return core, "bot_embudo_7d" in views

    return await db.run_sync(_check)


@router.get("/kigalchat/interactions", response_model=list[KigalChatInteraction])
async def list_kigalchat_interactions(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
) -> list[KigalChatInteraction]:
    """Messages the Instagram bot actually sent, read-only from bot_sent (+ bot_rules, bot_accounts).

    bot_sent stores neither the original comment nor which reply variant was sent, so comment_text,
    public_comment_reply and dm_reply_text stay empty instead of being invented.
    Returns [] when the bot tables do not exist (see /kigalchat/status).
    """
    core, _ = await _bot_tables_present(db)
    if not core:
        return []
    limit = max(1, min(limit, 500))
    rows = (
        await db.execute(
            sa_text(
                "SELECT s.id, s.account_id, s.username, s.rule_id, s.kind, s.created_at, "
                "r.name AS rule_name, r.keywords AS keywords, a.username AS account_username "
                "FROM bot_sent s "
                "LEFT JOIN bot_rules r ON r.id = s.rule_id "
                "LEFT JOIN bot_accounts a ON a.account_id = s.account_id "
                "ORDER BY s.created_at DESC LIMIT :limit"
            ),
            {"limit": limit},
        )
    ).mappings().all()

    interactions: list[KigalChatInteraction] = []
    for r in rows:
        created = r["created_at"]
        username = (r["username"] or "").strip()
        interactions.append(
            KigalChatInteraction(
                id=f"bot-{r['id']}",
                timestamp=created.isoformat() if hasattr(created, "isoformat") else str(created or ""),
                platform="instagram",
                username=f"@{username.lstrip('@')}" if username else "",
                comment_text="",
                matched_keyword=", ".join(_pg_text_array(r["keywords"])),
                public_comment_reply="",
                dm_reply_text="",
                lead_magnet_title=str(r["rule_name"] or ""),
                delivery_url="",
                status="SENT",
                kind=str(r["kind"] or ""),
                account_username=r["account_username"],
                rule_id=r["rule_id"],
            )
        )
    return interactions


@router.get("/kigalchat/status", response_model=KigalChatStatus)
async def kigalchat_status(db: AsyncSession = Depends(get_db)) -> KigalChatStatus:
    """Whether the Instagram bot tables exist, enabled accounts, active rules and the 7-day funnel."""
    core, has_view = await _bot_tables_present(db)
    if not core:
        return KigalChatStatus(
            bot_connected=False,
            detail="Las tablas del bot (bot_*) no existen en esta base de datos.",
        )
    accounts = (await db.execute(sa_text("SELECT count(*) FROM bot_accounts WHERE enabled"))).scalar_one()
    active_rules = (
        await db.execute(
            sa_text(
                "SELECT count(*) FROM bot_rules r JOIN bot_accounts a ON a.account_id = r.account_id "
                "WHERE r.enabled AND a.enabled"
            )
        )
    ).scalar_one()
    funnel: list[KigalChatFunnelRow] = []
    if has_view:
        rows = (
            await db.execute(
                sa_text(
                    "SELECT rule_id, account_id, name, keywords, enabled, botones, enlaces, conversion_pct "
                    "FROM bot_embudo_7d"
                )
            )
        ).mappings().all()
        for r in rows:
            keywords = _pg_text_array(r["keywords"])
            funnel.append(
                KigalChatFunnelRow(
                    rule_id=r["rule_id"],
                    account_id=str(r["account_id"]),
                    name=str(r["name"]),
                    keyword=keywords[0] if keywords else None,
                    keywords=keywords,
                    enabled=r["enabled"],
                    prompts_sent=int(r["botones"] or 0),
                    rewards_sent=int(r["enlaces"] or 0),
                    conversion_pct=float(r["conversion_pct"]) if r["conversion_pct"] is not None else None,
                )
            )
    return KigalChatStatus(
        bot_connected=True,
        accounts=int(accounts or 0),
        active_rules=int(active_rules or 0),
        funnel_7d=funnel,
        detail="" if has_view else "Falta la vista bot_embudo_7d.",
    )


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
            "context_notes": r.context_notes,
            "target_platforms": r.target_platforms or ["YouTube", "Instagram", "TikTok", "LinkedIn", "X"],
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
        context_notes=body.context_notes,
        target_platforms=body.target_platforms,
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
                # An estimate is not an observation: stays null until real post metrics exist.
                observed_hold_rate=None,
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
    result.context_notes = body.context_notes
    result.target_platforms = body.target_platforms
    return result


@router.post("/ideas/ai-evaluate", response_model=IdeaAIEvaluationResponse)
async def ai_evaluate_idea(
    body: IdeaAIEvaluationRequest,
    db: AsyncSession = Depends(get_db),
) -> IdeaAIEvaluationResponse:
    ws = await _get_default_workspace(db)
    creator_prof = await get_creator_profile(db)
    profile_dict = creator_prof.model_dump(mode="json") if creator_prof else None

    router_llm = get_llm_router()
    eval_result, provider_used = await router_llm.evaluate_idea_with_ai(
        concept_title=body.concept_title,
        context_notes=body.context_notes,
        creator_profile=profile_dict,
        target_platforms=body.target_platforms,
    )

    hook_models = [
        HookCandidate(
            category=h.get("category", "General"),
            hook_text=h.get("hook_text", body.concept_title),
            pattern_interrupt=h.get("pattern_interrupt", "Zoom 115%"),
            estimated_hold_rate=float(h.get("estimated_hold_rate", 70.0)),
        )
        for h in eval_result.get("hook_candidates", [])
    ]

    await _record_audit(
        db=db,
        workspace_id=ws.id,
        action_type="AI_IDEA_EVALUATION",
        agent_or_user_id=f"SkillRouter-{provider_used}",
        security_tier=1,
        operation_status="SUCCESS",
        payload={
            "title": body.concept_title,
            "ice_score": eval_result["ice_score"],
            "provider": provider_used,
        },
    )
    await db.commit()

    return IdeaAIEvaluationResponse(
        impact=eval_result["impact"],
        confidence=eval_result["confidence"],
        ease=eval_result["ease"],
        ice_score=eval_result["ice_score"],
        tam_classification=TAMClassification(eval_result["tam_classification"]),
        rationale=eval_result["rationale"],
        suggested_platforms=eval_result.get("suggested_platforms", body.target_platforms),
        hook_candidates=hook_models,
        estimated_hold_rate=eval_result.get("estimated_hold_rate", 75.0),
    )


@router.post("/ideas/chat-refine", response_model=IdeaChatRefineResponse)
async def chat_refine_idea(
    body: IdeaChatRefineRequest,
    db: AsyncSession = Depends(get_db),
) -> IdeaChatRefineResponse:
    """
    Conversational strategist co-pilot for refining raw creator concepts into compelling publications.
    Supports bouncing ideas back and forth, determining if video is needed (TEXT_ONLY vs TEXT_AND_VIDEO),
    and formulating genuine, anti-slop copy.
    """
    ws = await _get_default_workspace(db)
    creator_prof = await get_creator_profile(db)
    profile_dict = creator_prof.model_dump(mode="json") if creator_prof else None

    router_llm = get_llm_router()
    messages_payload = [m.model_dump() for m in body.messages]
    result = await router_llm.chat_refine_idea(
        messages=messages_payload,
        creator_profile=profile_dict,
        current_title=body.current_title,
        current_context=body.current_context,
        target_platforms=body.target_platforms,
        preferred_format=body.preferred_format.value,
    )

    hook_models = [
        HookCandidate(
            category=h.get("category", "Estrategia"),
            hook_text=h.get("hook_text", body.current_title or "Gancho sugerido"),
            pattern_interrupt=h.get("pattern_interrupt", "Corte limpio"),
            estimated_hold_rate=float(h.get("estimated_hold_rate", 75.0)),
        )
        for h in result.get("suggested_hooks", [])
    ]

    return IdeaChatRefineResponse(
        reply=result["reply"],
        suggested_title=result.get("suggested_title"),
        suggested_context_notes=result.get("suggested_context_notes"),
        suggested_format=ContentFormat(result.get("suggested_format", ContentFormat.TEXT_AND_VIDEO.value)),
        suggested_platforms=result.get("suggested_platforms", body.target_platforms),
        suggested_hooks=hook_models,
        calculated_ice=result.get("calculated_ice"),
        tam_recommendation=TAMClassification(result.get("tam_recommendation", TAMClassification.CORE_80.value)),
        ready_to_create=bool(result.get("ready_to_create", True)),
    )


@router.post("/ideas/radar-matutino", response_model=RadarMatutinoIngestResponse)
async def ingest_radar_matutino_idea(
    body: RadarMatutinoIngestRequest,
    db: AsyncSession = Depends(get_db),
) -> RadarMatutinoIngestResponse:
    """
    Ingest material from Radar Matutino n8n automation or direct webhook.
    Automatically evaluates with AI, stores rich context, and creates project if ICE >= 7.0.
    """
    ws = await _get_default_workspace(db)
    creator_prof = await get_creator_profile(db)
    profile_dict = creator_prof.model_dump(mode="json") if creator_prof else None

    router_llm = get_llm_router()
    eval_result, provider_used = await router_llm.evaluate_idea_with_ai(
        concept_title=body.concept_title,
        context_notes=body.context_notes,
        creator_profile=profile_dict,
        target_platforms=body.target_platforms,
    )

    impact = eval_result["impact"]
    confidence = eval_result["confidence"]
    ease = eval_result["ease"]
    ice_score = eval_result["ice_score"]
    tam_classification = eval_result["tam_classification"]
    threshold_met = ice_score >= 7.0

    idea = Idea(
        workspace_id=ws.id,
        concept_title=body.concept_title,
        source_origin=body.source_origin,
        impact_score=impact,
        confidence_score=confidence,
        ease_score=ease,
        ice_score=ice_score,
        ice_multiplicative=(impact * confidence * ease) / 100.0,
        tam_classification=tam_classification,
        triage_status="APPROVED_SCRIPT" if threshold_met else "UNPRIORITIZED",
        context_notes=body.context_notes,
        target_platforms=body.target_platforms,
        research_dossier={
            "source_url": body.source_url,
            "rationale": eval_result["rationale"],
            "hooks": eval_result.get("hook_candidates", []),
            "hold_rate": eval_result.get("estimated_hold_rate", 70.0),
        },
        semantic_embedding=compute_deterministic_embedding(body.concept_title),
    )
    db.add(idea)
    await db.flush()

    project_id = None
    asset_code = None

    if body.auto_create_project and threshold_met:
        asset_code = f"KC-{uuid.uuid4().hex[:5].upper()}"
        initial_state = FSMState.SCRIPTED_PACKAGED

        blocks, ab_variants, cta_text = generate_parametric_script(
            topic=body.concept_title,
            preset=body.target_duration,
            goal=body.conversion_goal,
        )

        project = ContentProject(
            workspace_id=ws.id,
            idea_id=idea.id,
            asset_code=asset_code,
            working_title=body.concept_title,
            target_duration=body.target_duration.value,
            conversion_goal=body.conversion_goal.value,
            current_state=initial_state.value,
            ice_score=ice_score,
            tam_classification=tam_classification,
            context_notes=body.context_notes,
            source_origin=body.source_origin,
            target_platforms=body.target_platforms,
            ab_variants=[v.model_dump(mode="json") for v in ab_variants],
            state_history=[
                {"from": "INIT", "to": "CAPTURED", "agent": "RadarMatutinoN8N", "tier": 1},
                {"from": "CAPTURED", "to": initial_state.value, "agent": "ResearcherStrategist", "tier": 1},
            ],
            temporal_workflow_id=f"wf-radar-{asset_code.lower()}",
        )
        db.add(project)
        await db.flush()
        project_id = project.id

        computed_blocks, wc, est_sec, _ = compute_block_metrics(blocks, 140, body.target_duration)
        db.add(
            Script(
                project_id=project.id,
                script_version=1,
                duration_preset=body.target_duration.value,
                conversion_goal=body.conversion_goal.value,
                wpm_rate=140,
                two_column_blocks=[b.model_dump(mode="json") for b in computed_blocks],
                hook_variants=[
                    {
                        "category": h.get("category", "General"),
                        "hook_text": h.get("hook_text", body.concept_title),
                        "pattern_interrupt": h.get("pattern_interrupt", "Zoom 115%"),
                        "estimated_hold_rate": float(h.get("estimated_hold_rate", 70.0)),
                    }
                    for h in eval_result.get("hook_candidates", [])
                ],
                selected_hook_index=0,
                cta_text=cta_text,
                word_count=wc,
                estimated_duration_sec=est_sec,
            )
        )

    await _record_audit(
        db=db,
        workspace_id=ws.id,
        action_type="RADAR_MATUTINO_INGEST",
        agent_or_user_id="n8n_radar_matutino",
        security_tier=1,
        operation_status="SUCCESS",
        payload={
            "title": body.concept_title,
            "source_origin": body.source_origin,
            "ice_score": ice_score,
            "threshold_met": threshold_met,
            "project_id": str(project_id) if project_id else None,
        },
    )
    await db.commit()

    await broadcaster.broadcast(
        "RADAR_MATUTINO_IDEA_RECEIVED",
        {
            "idea_id": str(idea.id),
            "concept_title": body.concept_title,
            "source_origin": body.source_origin,
            "ice_score": ice_score,
            "threshold_met": threshold_met,
            "project_id": str(project_id) if project_id else None,
            "asset_code": asset_code,
            "target_platforms": body.target_platforms,
            "context_notes": body.context_notes,
        },
    )

    hook_models = [
        HookCandidate(
            category=h.get("category", "General"),
            hook_text=h.get("hook_text", body.concept_title),
            pattern_interrupt=h.get("pattern_interrupt", "Zoom 115%"),
            estimated_hold_rate=float(h.get("estimated_hold_rate", 70.0)),
        )
        for h in eval_result.get("hook_candidates", [])
    ]

    return RadarMatutinoIngestResponse(
        status="INGESTED_AND_PROJECT_CREATED" if project_id else "INGESTED_AS_IDEA",
        concept_title=body.concept_title,
        source_origin=body.source_origin,
        ice_score=ice_score,
        threshold_met=threshold_met,
        project_id=project_id,
        asset_code=asset_code,
        idea_id=idea.id,
        target_platforms=body.target_platforms,
        context_notes=body.context_notes,
        evaluation=IdeaAIEvaluationResponse(
            impact=impact,
            confidence=confidence,
            ease=ease,
            ice_score=ice_score,
            tam_classification=TAMClassification(tam_classification),
            rationale=eval_result["rationale"],
            suggested_platforms=eval_result.get("suggested_platforms", body.target_platforms),
            hook_candidates=hook_models,
            estimated_hold_rate=eval_result.get("estimated_hold_rate", 75.0),
        ),
    )


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
            context_notes=r.context_notes,
            source_origin=r.source_origin,
            target_platforms=r.target_platforms or ["YouTube", "Instagram", "TikTok", "LinkedIn", "X"],
            content_format=ContentFormat(getattr(r, "content_format", None) or ContentFormat.TEXT_AND_VIDEO.value),
        )
        for r in rows
    ]


@router.post("/projects/purge-test-data")
async def purge_test_data_endpoint(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    from app.services.seed import purge_test_dummy_records
    count = await purge_test_dummy_records(db)
    return {"status": "ok", "purged_projects": count}


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
        source_origin=body.source_origin,
        impact_score=body.impact,
        confidence_score=body.confidence,
        ease_score=body.ease,
        ice_score=ice_res.ice_score,
        ice_multiplicative=ice_res.ice_multiplicative,
        tam_classification=body.tam_classification.value,
        triage_status=ice_res.status,
        context_notes=body.context_notes,
        target_platforms=body.target_platforms,
        semantic_embedding=compute_deterministic_embedding(body.working_title),
    )
    db.add(idea)
    await db.flush()

    initial_state = FSMState.RESEARCHED_TRIAGED if ice_res.threshold_met else FSMState.ARCHIVED
    asset_code = f"KC-{uuid.uuid4().hex[:5].upper()}"

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
        context_notes=body.context_notes,
        source_origin=body.source_origin,
        target_platforms=body.target_platforms,
        content_format=body.content_format.value,
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
            context_notes=body.context_notes,
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
        context_notes=project.context_notes,
        source_origin=project.source_origin,
        target_platforms=project.target_platforms or ["YouTube", "Instagram", "TikTok", "LinkedIn", "X"],
        content_format=ContentFormat(getattr(project, "content_format", None) or ContentFormat.TEXT_AND_VIDEO.value),
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
            context_notes=project.context_notes,
            source_origin=project.source_origin,
            target_platforms=project.target_platforms or ["YouTube", "Instagram", "TikTok", "LinkedIn", "X"],
            content_format=ContentFormat(getattr(project, "content_format", None) or ContentFormat.TEXT_AND_VIDEO.value),
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
            _serialize_social_post(p, project).model_dump(mode="json")
            for p in posts
        ],
    }


@router.delete("/projects/{project_id}")
async def delete_project(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    project = (await db.execute(select(ContentProject).where(ContentProject.id == project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    asset_code = project.asset_code
    await db.delete(project)
    await db.commit()
    await _ws_broadcast("project_deleted", {"project_id": str(project_id), "asset_code": asset_code})
    return {"deleted": True, "project_id": str(project_id), "asset_code": asset_code}


@router.post("/hitl/issue-token", response_model=HITLTokenIssueResponse)
async def issue_hitl_token(
    body: HITLTokenIssueRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> HITLTokenIssueResponse:
    ws = await _get_default_workspace(db)
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
    ip_addr = request.client.host if request.client else "127.0.0.1"

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

    try:
        report = run_full_media_pipeline(
            project_id=str(project.id),
            raw_media_url=body.raw_media_url,
            script_text_hint=script_hint,
            silence_noise_db=body.silence_noise_db,
            min_silence_duration_sec=body.min_silence_duration_sec,
            target_lufs=body.target_lufs,
            subtitle_y_percent=body.subtitle_y_percent,
            generate_demo_source_if_missing=body.generate_demo_source_if_missing,
            target_platform_signature=body.target_platform_signature,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail="No se encuentra el vídeo original. Súbelo o indica una ruta válida antes de procesarlo.",
        ) from exc

    asset = VideoAsset(
        project_id=project.id,
        raw_media_url=report.raw_media_url,
        master_media_url=report.master_media_url,
        thumbnail_a_url=report.thumbnail_a_url,
        thumbnail_b_url=report.thumbnail_b_url,
        probe_metadata={
            "resolution": report.resolution,
            "fps": report.fps,
            "target_platform_signature": body.target_platform_signature,
        },
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
            "native_signature_profile": report.native_signature_profile,
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
        headline=body.headline or project.working_title,
        core_value=body.core_value,
        debate_question=body.debate_question,
        thesis_points=body.thesis_points,
        chapters=body.chapters,
        goal=goal,
        context_notes=project.context_notes,
    )

    # Upgrade LinkedIn copy with AI / Smart Editorial polish when project has context_notes
    if project.context_notes and project.context_notes.strip():
        gem_key, _, _, _ = await _get_effective_social_credential(db, "gemini_nano_banana")
        oai_key, _, _, _ = await _get_effective_social_credential(db, "openai_gpt_images")
        anth_key, _, _, _ = await _get_effective_social_credential(db, "anthropic_claude")
        prof_row = (await db.execute(select(CreatorProfile).limit(1))).scalar_one_or_none()
        prof_dict = _serialize_creator_profile(prof_row).model_dump() if prof_row else None
        polished = await get_llm_router().polish_linkedin_post(
            title=body.headline or project.working_title,
            context_notes=project.context_notes,
            creator_profile=prof_dict,
            gemini_api_key=gem_key,
            openai_api_key=oai_key,
            anthropic_api_key=anth_key,
        )
        for item in generated:
            if item.get("channel") == SocialChannel.LINKEDIN.value:
                item["title"] = polished["hook"]
                item["post_body"] = polished["post_body"]
                if polished.get("first_comment"):
                    item["first_comment"] = polished["first_comment"]
                if polished.get("hashtags"):
                    item["hashtags"] = polished["hashtags"]

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
    if "metadata_payload" in payload and isinstance(payload["metadata_payload"], dict):
        merged_meta = dict(post.metadata_payload or {})
        merged_meta.update(payload["metadata_payload"])
        post.metadata_payload = merged_meta

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


@router.post("/social/polish-linkedin")
async def polish_linkedin_draft_endpoint(
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Rewrite and polish a LinkedIn post using Gemini, OpenAI, Claude/Ollama, or Spanish Editorial Rewriter."""
    title = str(payload.get("title") or "").strip()
    body = str(payload.get("body") or "").strip()
    context_notes = str(payload.get("context_notes") or "").strip()
    project_id = payload.get("project_id")

    if project_id and (not context_notes or not title):
        try:
            proj = (
                await db.execute(select(ContentProject).where(ContentProject.id == uuid.UUID(str(project_id))))
            ).scalar_one_or_none()
            if proj:
                if not title:
                    title = proj.working_title
                if not context_notes and proj.context_notes:
                    context_notes = proj.context_notes
        except ValueError:
            pass

    if not (title or body or context_notes):
        raise HTTPException(status_code=400, detail="Envía un título, borrador o contexto para pulir con IA.")

    gem_key, _, _, _ = await _get_effective_social_credential(db, "gemini_nano_banana")
    oai_key, _, _, _ = await _get_effective_social_credential(db, "openai_gpt_images")
    anth_key, _, _, _ = await _get_effective_social_credential(db, "anthropic_claude")
    preferred_engine = str(payload.get("preferred_engine") or "auto").strip().lower()
    prof_row = (await db.execute(select(CreatorProfile).limit(1))).scalar_one_or_none()
    prof_dict = _serialize_creator_profile(prof_row).model_dump() if prof_row else None

    return await get_llm_router().polish_linkedin_post(
        title=title,
        body=body,
        context_notes=context_notes,
        creator_profile=prof_dict,
        gemini_api_key=gem_key,
        openai_api_key=oai_key,
        anthropic_api_key=anth_key,
        preferred_engine=preferred_engine,
    )


@router.post("/social/generate-visual")
async def generate_social_visual(
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Generate an infographic or editorial image for LinkedIn / social posts.
    Supports Nano Banana (Gemini Imagen), GPT Images (OpenAI), or instant local SVG infographic rendering.
    """
    import base64
    import html
    import os
    import textwrap
    import httpx

    title = str(payload.get("title") or "KigalContent").strip()
    body = str(payload.get("body") or "").strip()
    visual_type = str(payload.get("visual_type") or "INFOGRAPHIC").upper()
    provider = str(payload.get("provider") or "svg_local").lower()
    custom_prompt = str(payload.get("prompt") or "").strip()

    profile = await get_creator_profile(db)
    author_name = str(payload.get("author_name") or profile.name or "Kike Gallego")

    # Extract clean bullet points from the actual post body
    raw_paras = [p.strip() for p in body.split("\n") if p.strip() and not p.strip().startswith("#")]
    key_points = [p[:115] + ("…" if len(p) > 115 else "") for p in raw_paras[:4]]
    if not key_points:
        key_points = ["Contenido diseñado desde el editor de KigalContent Studio."]

    ai_prompt = custom_prompt or (
        f"Editorial minimalist {visual_type.lower()} for LinkedIn in Spanish, dark navy & cyan Pro Studio aesthetic, "
        f"clean typography, topic: '{title[:120]}'. Key concepts: {'; '.join(key_points[:3])}. "
        f"No gibberish text, crisp modern geometric layout, 4:5 portrait."
    )

    image_url: str | None = None
    used_provider = "svg_local"
    provider_note = "Infografía vectorial generada al instante desde el texto de tu publicación."

    openai_key, _, _, _ = await _get_effective_social_credential(db, "openai_gpt_images")
    gemini_key, _, _, _ = await _get_effective_social_credential(db, "gemini_nano_banana")

    if provider == "z_image":
        llm_cfg = get_llm_router()._effective_settings()
        default_w = 768
        default_h = 960 if visual_type == "INFOGRAPHIC" else 768
        req_w = int(payload.get("width") or default_w)
        req_h = int(payload.get("height") or default_h)
        req_steps = int(payload.get("steps") or 8)
        req_seed = int(payload.get("seed") if payload.get("seed") is not None else -1)
        try:
            z_res = await generate_image_with_zimage(
                prompt=ai_prompt,
                width=req_w,
                height=req_h,
                steps=req_steps,
                seed=req_seed,
                ollama_base_url=str(llm_cfg.get("ollama_base_url") or ""),
                ollama_api_key=str(llm_cfg.get("ollama_api_key") or ""),
            )
            image_url = z_res["image_url"]
            used_provider = "z_image"
            secs = z_res.get("elapsed_seconds")
            secs_txt = f" en {secs}s" if secs is not None else ""
            mode_txt = "GPU local del MiniPC" if z_res.get("mode") == "local_gpu" else "túnel GPU MiniPC"
            provider_note = (
                f"✅ Imagen {z_res.get('width', req_w)}×{z_res.get('height', req_h)} generada con "
                f"Z-Image-Turbo ({mode_txt}{secs_txt} · 0,00 €)."
            )
        except Exception as exc:
            logger.warning("Z-Image fallback to SVG: %s", exc)
            provider_note = f"⚠️ Error con Z-Image-Turbo ({exc}). Se generó infografía SVG nativa como respaldo."

    if not image_url and provider == "gpt_images":
        if not openai_key:
            provider_note = (
                "⚠️ No tienes guardada tu API Key de GPT Images (OpenAI). "
                "Añádela en 'Configurar API Keys' aquí mismo o en Conexiones Oficiales. "
                "Mientras tanto, hemos generado la infografía SVG nativa."
            )
        else:
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    # Try gpt-image-1 first, then dall-e-3 fallback
                    for model_name, req_json in (
                        ("gpt-image-1", {"model": "gpt-image-1", "prompt": ai_prompt, "size": "1024x1024", "n": 1}),
                        ("dall-e-3", {"model": "dall-e-3", "prompt": ai_prompt, "size": "1024x1024", "n": 1}),
                    ):
                        resp = await client.post(
                            "https://api.openai.com/v1/images/generations",
                            headers={"Authorization": f"Bearer {openai_key}"},
                            json=req_json,
                        )
                        if resp.status_code == 200:
                            item = resp.json()["data"][0]
                            if item.get("b64_json"):
                                image_url = f"data:image/png;base64,{item['b64_json']}"
                            elif item.get("url"):
                                image_url = item["url"]
                            if image_url:
                                used_provider = "gpt_images"
                                provider_note = f"✅ Imagen generada en vivo con GPT Images ({model_name})."
                                break
                    if not image_url:
                        provider_note = (
                            "⚠️ OpenAI no pudo generar la imagen con la clave actual (revisa saldo/permisos en platform.openai.com). "
                            "Se generó infografía SVG nativa como respaldo."
                        )
            except Exception as exc:
                logger.warning("GPT Images fallback to SVG: %s", exc)
                provider_note = f"⚠️ Error conectando con GPT Images ({exc}). Se generó infografía SVG nativa."

    if not image_url and provider == "nano_banana":
        if not gemini_key:
            provider_note = (
                "⚠️ No tienes guardada tu API Key de Nano Banana (Google Gemini). "
                "Añádela en 'Configurar API Keys' aquí mismo o en Conexiones Oficiales. "
                "Mientras tanto, hemos generado la infografía SVG nativa."
            )
        else:
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    # 1. Try Gemini 2.5 Flash Image (Nano Banana) via generateContent
                    nb_resp = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={gemini_key}",
                        json={
                            "contents": [{"parts": [{"text": ai_prompt}]}],
                            "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]},
                        },
                    )
                    if nb_resp.status_code == 200:
                        parts = (
                            nb_resp.json()
                            .get("candidates", [{}])[0]
                            .get("content", {})
                            .get("parts", [])
                        )
                        for part in parts:
                            inline = part.get("inlineData") or part.get("inline_data")
                            if isinstance(inline, dict) and inline.get("data"):
                                mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                                image_url = f"data:{mime};base64,{inline['data']}"
                                used_provider = "nano_banana"
                                provider_note = "✅ Imagen generada en vivo con Nano Banana (Gemini 2.5 Flash Image)."
                                break

                    # 2. Fallback to Imagen 3 predict endpoint
                    if not image_url:
                        im_resp = await client.post(
                            f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key={gemini_key}",
                            json={"instances": [{"prompt": ai_prompt}], "parameters": {"sampleCount": 1, "aspectRatio": "3:4"}},
                        )
                        if im_resp.status_code == 200:
                            preds = im_resp.json().get("predictions", [])
                            if preds and preds[0].get("bytesBase64Encoded"):
                                image_url = f"data:image/png;base64,{preds[0]['bytesBase64Encoded']}"
                                used_provider = "nano_banana"
                                provider_note = "✅ Imagen generada en vivo con Nano Banana (Google Imagen 3)."

                    if not image_url:
                        provider_note = (
                            "⚠️ Google Gemini no devolvió imagen con la clave actual (verifica que tu API Key tenga habilitada la generación de imágenes en Google AI Studio). "
                            "Se generó infografía SVG nativa como respaldo."
                        )
            except Exception as exc:
                logger.warning("Nano Banana fallback to SVG: %s", exc)
                provider_note = f"⚠️ Error conectando con Nano Banana ({exc}). Se generó infografía SVG nativa."

    if not image_url:
        # Render crisp 1080x1350 SVG Infographic from the user's real post content
        wrapped_title = textwrap.wrap(title, width=32)[:3]
        title_svg = "".join(
            f'<text x="80" y="{210 + i * 56}" fill="#f8fafc" font-family="Inter, system-ui, sans-serif" font-size="44" font-weight="800">{html.escape(line)}</text>'
            for i, line in enumerate(wrapped_title)
        )
        cards_svg = ""
        start_y = 420
        for idx, pt in enumerate(key_points[:4]):
            cy = start_y + idx * 195
            lines = textwrap.wrap(pt, width=48)[:3]
            lines_svg = "".join(
                f'<text x="155" y="{cy + 62 + li * 34}" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="25" font-weight="500">{html.escape(l)}</text>'
                for li, l in enumerate(lines)
            )
            cards_svg += f"""
            <rect x="75" y="{cy}" width="930" height="165" rx="18" fill="#0d1526" stroke="#1e293b" stroke-width="2"/>
            <circle cx="115" cy="{cy + 58}" r="20" fill="#06b6d4" fill-opacity="0.18" stroke="#22d3ee" stroke-width="2"/>
            <text x="115" y="{cy + 66}" text-anchor="middle" fill="#22d3ee" font-family="monospace" font-size="20" font-weight="700">0{idx + 1}</text>
            {lines_svg}
            """

        svg_doc = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
          <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#040711"/>
              <stop offset="100%" stop-color="#0b1326"/>
            </linearGradient>
          </defs>
          <rect width="1080" height="1350" fill="url(#bg)"/>
          <rect x="75" y="90" width="240" height="38" rx="19" fill="#0891b2" fill-opacity="0.2" stroke="#22d3ee" stroke-opacity="0.5"/>
          <text x="195" y="116" text-anchor="middle" fill="#67e8f9" font-family="monospace" font-size="18" font-weight="700">{html.escape(visual_type)}</text>
          {title_svg}
          <line x1="80" y1="385" x2="260" y2="385" stroke="#22d3ee" stroke-width="4" stroke-linecap="round"/>
          {cards_svg}
          <text x="80" y="1280" fill="#94a3b8" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="600">{html.escape(author_name)}</text>
          <text x="1000" y="1280" text-anchor="end" fill="#22d3ee" font-family="monospace" font-size="20" font-weight="700">KigalContent Studio</text>
        </svg>"""
        b64 = base64.b64encode(svg_doc.encode("utf-8")).decode("ascii")
        image_url = f"data:image/svg+xml;base64,{b64}"

    return {
        "image_url": image_url,
        "provider": used_provider,
        "visual_type": visual_type,
        "prompt": ai_prompt,
        "note": provider_note,
    }


async def _get_effective_social_credential(
    db: AsyncSession, channel_key: str
) -> tuple[str, str, str, str | None]:
    """Return (access_token, person_urn, source, account_name) checking DB first, then env settings."""
    return await resolve_effective_social_credential(db, channel_key)


SUPPORTED_CREDENTIAL_CHANNELS = (
    "youtube",
    "instagram",
    "tiktok",
    "linkedin",
    "linkedin_ads",
    "gemini_nano_banana",
    "openai_gpt_images",
    "anthropic_claude",
    "canva",
    "apify",
)


@router.get("/social/credentials")
async def list_social_credentials(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """List connection status (masked) for social networks and visual/AI engines."""
    result: dict[str, Any] = {}
    for ch in SUPPORTED_CREDENTIAL_CHANNELS:
        token, urn, source, account_name = await _get_effective_social_credential(db, ch)
        masked = f"{token[:6]}…{token[-4:]}" if len(token) > 12 else ("••••" if token else "")
        result[ch] = {
            "channel": ch,
            "configured": bool(token),
            "source": source,
            "person_urn": urn if (urn and urn != "urn:li:person:creator-001") else "",
            "account_name": account_name or "",
            "masked_token": masked,
        }
    llm_cfg = get_llm_router()._effective_settings()
    z_status = await get_zimage_status(
        ollama_base_url=str(llm_cfg.get("ollama_base_url") or ""),
        ollama_api_key=str(llm_cfg.get("ollama_api_key") or ""),
    )
    result["z_image"] = {
        "channel": "z_image",
        "configured": bool(z_status.get("available")),
        "source": str(z_status.get("mode") or "unavailable"),
        "person_urn": "",
        "account_name": str(z_status.get("model") or "z_image_turbo-Q8_0.gguf"),
        "masked_token": "GPU Local 0 €" if z_status.get("available") else "",
    }
    return {"channels": result}


@router.get("/zimage/status")
async def zimage_status_endpoint() -> dict[str, Any]:
    """Return availability and hardware details for local/tunneled Z-Image-Turbo."""
    llm_cfg = get_llm_router()._effective_settings()
    return await get_zimage_status(
        ollama_base_url=str(llm_cfg.get("ollama_base_url") or ""),
        ollama_api_key=str(llm_cfg.get("ollama_api_key") or ""),
    )


@router.put("/social/credentials")
async def save_social_credential(
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Persist an OAuth2 access token or Visual/AI API key in PostgreSQL."""
    ch = str(payload.get("channel") or "").strip().lower()
    if ch not in SUPPORTED_CREDENTIAL_CHANNELS:
        raise HTTPException(status_code=400, detail="Canal no soportado.")

    token = str(payload.get("access_token") or "").strip()
    person_urn = str(payload.get("person_urn") or "").strip() or None

    row = (
        await db.execute(select(SocialCredential).where(SocialCredential.channel == ch))
    ).scalar_one_or_none()

    if row is None:
        row = SocialCredential(channel=ch, access_token=token, person_urn=person_urn)
        db.add(row)
    else:
        if token and ch == "instagram" and token != row.access_token and person_urn is None:
            # New Instagram token: the stored ig_user_id/account may belong to another account.
            row.person_urn = None
            row.account_name = None
        if token:
            row.access_token = token
        if person_urn is not None:
            row.person_urn = person_urn

    await db.commit()
    await db.refresh(row)
    return {
        "saved": True,
        "channel": ch,
        "configured": bool(row.access_token),
        "person_urn": row.person_urn or "",
        "account_name": row.account_name or "",
    }


@router.post("/social/credentials/test")
async def test_social_credential(
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Test a social channel OAuth2 token or Visual/AI API key live against the official API."""
    import httpx

    ch = str(payload.get("channel") or "").strip().lower()
    if ch not in SUPPORTED_CREDENTIAL_CHANNELS:
        raise HTTPException(status_code=400, detail="Canal no soportado.")

    provided_token = str(payload.get("access_token") or "").strip()
    provided_urn = str(payload.get("person_urn") or "").strip()

    saved_token, saved_urn, saved_source, saved_account = await _get_effective_social_credential(db, ch)
    token = provided_token or saved_token
    if not token:
        return {
            "ok": False,
            "channel": ch,
            "message": f"No hay ninguna clave/token de {ch} guardada ni introducida. Pégala y pulsa Guardar.",
        }

    if ch == "apify":
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(f"https://api.apify.com/v2/users/me?token={token}")
            if r.status_code == 200:
                u_data = r.json().get("data") or {}
                uname = str(u_data.get("username") or u_data.get("email") or "Apify Account")
                row = (await db.execute(select(SocialCredential).where(SocialCredential.channel == ch))).scalar_one_or_none()
                if row is None:
                    db.add(SocialCredential(channel=ch, access_token=token, account_name=f"Apify (@{uname})"))
                else:
                    row.access_token = token
                    row.account_name = f"Apify (@{uname})"
                await db.commit()
                return {
                    "ok": True,
                    "channel": ch,
                    "account_name": f"Apify (@{uname})",
                    "message": f"✅ API Token de Apify verificado (@{uname}) y guardado. El Radar Diario de Reels Virales (Flujo 06) ya está listo.",
                }
            return {
                "ok": False,
                "channel": ch,
                "message": f"Apify rechazó el token (HTTP {r.status_code}). Cópialo desde console.apify.com/settings/integrations.",
            }

    if ch == "gemini_nano_banana":
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={token}")
            if r.status_code == 200:
                row = (await db.execute(select(SocialCredential).where(SocialCredential.channel == ch))).scalar_one_or_none()
                if row is None:
                    db.add(SocialCredential(channel=ch, access_token=token, account_name="Google Gemini API"))
                else:
                    row.access_token = token
                    row.account_name = "Google Gemini API"
                await db.commit()
                return {
                    "ok": True,
                    "channel": ch,
                    "account_name": "Google Gemini API",
                    "message": "✅ API Key de Nano Banana (Google Gemini) verificada y guardada. Activa para imágenes, infografías y redacción IA.",
                }
            return {
                "ok": False,
                "channel": ch,
                "message": f"Google Gemini rechazó la API Key (HTTP {r.status_code}). Comprueba tu clave en aistudio.google.com/apikey.",
            }

    if ch == "openai_gpt_images":
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {token}"},
            )
            if r.status_code == 200:
                row = (await db.execute(select(SocialCredential).where(SocialCredential.channel == ch))).scalar_one_or_none()
                if row is None:
                    db.add(SocialCredential(channel=ch, access_token=token, account_name="OpenAI API"))
                else:
                    row.access_token = token
                    row.account_name = "OpenAI API"
                await db.commit()
                return {
                    "ok": True,
                    "channel": ch,
                    "account_name": "OpenAI API",
                    "message": "✅ API Key de GPT Images (OpenAI) verificada y guardada. Activa para imágenes y redacción IA.",
                }
            return {
                "ok": False,
                "channel": ch,
                "message": f"OpenAI rechazó la API Key (HTTP {r.status_code}). Comprueba tu clave en platform.openai.com/api-keys.",
            }

    if ch == "anthropic_claude":
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                "https://api.anthropic.com/v1/models",
                headers={
                    "x-api-key": token,
                    "anthropic-version": "2023-06-01",
                },
            )
            if r.status_code == 200:
                row = (await db.execute(select(SocialCredential).where(SocialCredential.channel == ch))).scalar_one_or_none()
                if row is None:
                    db.add(SocialCredential(channel=ch, access_token=token, account_name="Anthropic Claude API"))
                else:
                    row.access_token = token
                    row.account_name = "Anthropic Claude API"
                await db.commit()
                return {
                    "ok": True,
                    "channel": ch,
                    "account_name": "Anthropic Claude API",
                    "message": "✅ API Key de Anthropic (Claude) verificada y guardada. Activa para redacción y pulido IA de LinkedIn.",
                }
            return {
                "ok": False,
                "channel": ch,
                "message": f"Anthropic rechazó la API Key (HTTP {r.status_code}). Comprueba tu clave en console.anthropic.com/settings/keys.",
            }

    if ch == "canva":
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                "https://api.canva.com/rest/v1/users/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            if r.status_code == 200:
                profile_data = r.json()
                cname = (
                    profile_data.get("team_user", {}).get("display_name")
                    or profile_data.get("display_name")
                    or "Cuenta Canva Connect"
                )
                row = (await db.execute(select(SocialCredential).where(SocialCredential.channel == ch))).scalar_one_or_none()
                if row is None:
                    db.add(SocialCredential(channel=ch, access_token=token, account_name=cname))
                else:
                    row.access_token = token
                    row.account_name = cname
                await db.commit()
                return {
                    "ok": True,
                    "channel": ch,
                    "account_name": cname,
                    "message": f"✅ Canva Connect verificado y guardado ({cname}).",
                }
            return {
                "ok": False,
                "channel": ch,
                "message": f"Canva Connect rechazó el token (HTTP {r.status_code}). Genera un token OAuth válido en canva.dev.",
            }

    if ch == "linkedin_ads":
        status_res = await LinkedInAdLibraryClient().check_status(
            token,
            token_source="input" if provided_token else saved_source,
            account_name=saved_account or "",
        )
        if status_res.live_verified:
            row = (
                await db.execute(select(SocialCredential).where(SocialCredential.channel == "linkedin_ads"))
            ).scalar_one_or_none()
            if row is None:
                db.add(SocialCredential(channel="linkedin_ads", access_token=token))
            else:
                row.access_token = token
            await db.commit()
        return {
            "ok": status_res.live_verified,
            "channel": "linkedin_ads",
            "live_verified": status_res.live_verified,
            "api_version_used": status_res.api_version_used,
            "status_code": status_res.status_code,
            "needs_token_refresh": status_res.needs_token_refresh,
            "message": status_res.message,
        }

    if ch == "instagram":
        # Llamada real a graph.instagram.com (Instagram API with Instagram Login): username real o el error de Meta.
        try:
            me = await MetaGraphConnector(token).fetch_profile()
        except InstagramApiError as exc:
            return {"ok": False, "channel": "instagram", "status_code": exc.http_status, "message": str(exc)}
        except httpx.HTTPError as exc:
            return {
                "ok": False,
                "channel": "instagram",
                "message": f"No se pudo contactar con graph.instagram.com ({type(exc).__name__}).",
            }
        username = str(me.get("username") or "").strip()
        ig_user_id = str(me.get("user_id") or "").strip()
        if not username or not ig_user_id:
            return {
                "ok": False,
                "channel": "instagram",
                "message": "Instagram respondió sin user_id/username: revisa que el token sea de Instagram Login.",
            }
        row = (
            await db.execute(select(SocialCredential).where(SocialCredential.channel == "instagram"))
        ).scalar_one_or_none()
        # person_urn holds the ig_user_id bound to this token; the connector prefers it over the env setting.
        if row is None:
            db.add(
                SocialCredential(
                    channel="instagram", access_token=token, person_urn=ig_user_id, account_name=f"@{username}"
                )
            )
        else:
            row.access_token = token
            row.person_urn = ig_user_id
            row.account_name = f"@{username}"
        await db.commit()
        return {
            "ok": True,
            "channel": "instagram",
            "account_name": f"@{username}",
            "ig_user_id": ig_user_id,
            "message": f"✅ Conectado con Instagram como @{username}. Token guardado en el servidor.",
        }

    if ch == "linkedin":
        async with httpx.AsyncClient(timeout=15.0) as client:
            resolved_urn = provided_urn or (saved_urn if saved_urn != "urn:li:person:creator-001" else "")
            account_name = ""

            # 1. Try OpenID Connect /v2/userinfo
            r_ui = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={"Authorization": f"Bearer {token}"},
            )
            if r_ui.status_code == 200:
                data = r_ui.json()
                sub = data.get("sub")
                if sub:
                    resolved_urn = f"urn:li:person:{sub}"
                account_name = data.get("name") or data.get("email") or ""
            else:
                # 2. Fallback to /v2/me
                r_me = await client.get(
                    "https://api.linkedin.com/v2/me",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if r_me.status_code == 200:
                    data = r_me.json()
                    lid = data.get("id")
                    if lid:
                        resolved_urn = f"urn:li:person:{lid}"
                    first = data.get("localizedFirstName", "")
                    last = data.get("localizedLastName", "")
                    account_name = f"{first} {last}".strip()
                else:
                    return {
                        "ok": False,
                        "channel": "linkedin",
                        "status_code": r_ui.status_code,
                        "message": (
                            f"LinkedIn rechazó el token (HTTP {r_ui.status_code}). "
                            f"Comprueba que no esté caducado y tenga los permisos 'openid', 'profile' y 'w_member_social'. "
                            f"Detalle: {r_ui.text[:200]}"
                        ),
                    }

            # Persist verified token + resolved URN + account name
            row = (
                await db.execute(select(SocialCredential).where(SocialCredential.channel == "linkedin"))
            ).scalar_one_or_none()
            if row is None:
                row = SocialCredential(
                    channel="linkedin",
                    access_token=token,
                    person_urn=resolved_urn or None,
                    account_name=account_name or None,
                )
                db.add(row)
            else:
                row.access_token = token
                if resolved_urn:
                    row.person_urn = resolved_urn
                if account_name:
                    row.account_name = account_name
            await db.commit()

            return {
                "ok": True,
                "channel": "linkedin",
                "account_name": account_name,
                "person_urn": resolved_urn,
                "message": f"✅ Conectado en vivo con LinkedIn ({account_name or 'Cuenta verificada'} · {resolved_urn}). Token guardado en el servidor.",
            }

    return {
        "ok": True,
        "channel": ch,
        "message": f"Token de {ch.capitalize()} recibido. Pulsa Guardar Token para persistirlo en el servidor.",
    }


@router.post("/social/publish")
async def execute_social_publish(
    body: SocialPublishExecuteRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    project = (await db.execute(select(ContentProject).where(ContentProject.id == body.project_id))).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    posts = (await db.execute(select(SocialPost).where(SocialPost.project_id == project.id))).scalars().all()
    post_by_channel = {p.channel: p for p in posts}
    missing = [ch.value for ch in body.channels if ch.value not in post_by_channel]
    if missing:
        raise HTTPException(status_code=404, detail=f"No prepared post found for {', '.join(missing)}.")
    ip_addr = request.client.host if request.client else "127.0.0.1"
    sec_mgr = HITLSecurityManager()

    results: list[dict[str, Any]] = []
    max_retry_after = 0
    for ch in body.channels:
        sp = post_by_channel[ch.value]
        if sp.publish_status == "PUBLISHED":
            # Already live on the platform: never publish it twice on a retry.
            results.append(
                {
                    "status": "PUBLISHED",
                    "already_published": True,
                    "channel": ch.value,
                    "external_platform_id": sp.external_platform_id,
                    "canonical_url": sp.canonical_url,
                }
            )
            continue

        paused_until = await get_channel_pause_until(db, ch.value)
        if paused_until is not None:
            retry_after = max(1, int((paused_until - datetime.now(timezone.utc)).total_seconds()))
            max_retry_after = max(max_retry_after, retry_after)
            results.append(
                {
                    "status": RATE_LIMITED_STATUS,
                    "channel": ch.value,
                    "error": channel_pause_message(ch.value, paused_until),
                    "retry_after": retry_after,
                }
            )
            continue

        eff_token, eff_urn, _, _ = await _get_effective_social_credential(db, ch.value.lower())
        connector = get_connector_for_channel(
            ch,
            access_token_override=eff_token or None,
            person_urn_override=eff_urn or None,
        )
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
        except SocialRateLimitError as exc:
            resume_at = register_channel_pause(ch.value, exc.retry_after)
            max_retry_after = max(max_retry_after, int(exc.retry_after))
            sp.publish_error = f"{exc} Se podrá reintentar a partir de {resume_at.isoformat()}."
            await _record_audit(
                db=db,
                workspace_id=project.workspace_id,
                project_id=project.id,
                action_type=f"PUBLISH_{ch.value.upper()}",
                agent_or_user_id=body.actor,
                security_tier=3,
                operation_status=RATE_LIMITED_STATUS,
                hitl_token_id=body.hitl_token,
                payload=rate_limit_audit_payload(ch.value, str(exc), exc.retry_after, resume_at),
                ip_source=ip_addr,
            )
            await db.commit()
            results.append(
                {
                    "status": RATE_LIMITED_STATUS,
                    "channel": ch.value,
                    "error": str(exc),
                    "retry_after": int(exc.retry_after),
                }
            )
            continue
        except Exception as exc:
            err_detail = str(exc)
            resp = getattr(exc, "response", None)
            if resp is not None:
                err_detail = f"Error API {ch.value} ({resp.status_code}): {resp.text[:300]}"
            sp.publish_status = "FAILED"
            sp.publish_error = err_detail
            await _record_audit(
                db=db,
                workspace_id=project.workspace_id,
                project_id=project.id,
                action_type=f"PUBLISH_{ch.value.upper()}",
                agent_or_user_id=body.actor,
                security_tier=3,
                operation_status="FAILED",
                hitl_token_id=body.hitl_token,
                payload={"channel": ch.value, "error": err_detail},
                ip_source=ip_addr,
            )
            await db.commit()
            results.append({"status": "FAILED", "channel": ch.value, "error": err_detail})
            continue

        if pub_res.get("status") != "PUBLISHED":
            # Not connected: nothing was published, so nothing is marked or counted as published.
            results.append(pub_res)
            await _record_audit(
                db=db,
                workspace_id=project.workspace_id,
                project_id=project.id,
                action_type=f"PUBLISH_{ch.value.upper()}",
                agent_or_user_id=body.actor,
                security_tier=3,
                operation_status=str(pub_res.get("status") or "NOT_CONFIGURED"),
                hitl_token_id=body.hitl_token,
                payload={"channel": ch.value, "message": pub_res.get("message")},
                ip_source=ip_addr,
            )
            await db.commit()
            continue

        sp.external_platform_id = pub_res["external_platform_id"]
        sp.canonical_url = pub_res.get("canonical_url")
        sp.publish_status = "PUBLISHED"
        sp.publish_error = None
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
        # Commit each live publication immediately: a later channel failing must never lose it.
        await db.commit()

    if max_retry_after:
        response.headers["Retry-After"] = str(max_retry_after)

    published_count = sum(1 for r in results if r.get("status") == "PUBLISHED")
    if published_count < len(results):
        # At least one channel did not go out: the project does not go live.
        await db.commit()
        if published_count:
            overall = "PARTIALLY_PUBLISHED"
        elif max_retry_after:
            overall = RATE_LIMITED_STATUS
        else:
            overall = "NOT_PUBLISHED"
        return {"status": overall, "project_id": str(project.id), "publications": results}

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
            generate_demo_source_if_missing=False,
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

    # 6. Social Channels (check PostgreSQL social_credentials + env settings)
    social_channels: dict[str, InfrastructureServiceStatus] = {}
    for ch_name in ("YouTube", "Instagram", "TikTok", "LinkedIn"):
        eff_token, eff_urn, source, account_name = await _get_effective_social_credential(db, ch_name.lower())
        is_live = bool(eff_token)
        detail_msg = (
            f"Credencial en vivo ({source})"
            + (f" · {account_name}" if account_name else "")
            + (f" · {eff_urn}" if eff_urn and ch_name == "LinkedIn" and eff_urn != "urn:li:person:creator-001" else "")
            + ". Publicación directa autorizada."
            if is_live
            else "Modo Sandbox / Simulación seguro activo. Publicaciones simuladas sin tocar cuenta real."
        )
        social_channels[ch_name] = InfrastructureServiceStatus(
            service_name=ch_name,
            status="CONNECTED" if is_live else "SANDBOX_MOCK",
            provider=f"API Oficial {ch_name}",
            details=detail_msg,
            action_required=None if is_live else f"Añadir y guardar token oficial de {ch_name} en Conexiones Oficiales.",
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
async def get_llm_config(db: AsyncSession = Depends(get_db)) -> LLMConfigResponse:
    """Return active LLM router configuration, hardware RAM presets, live Ollama probe, and loaded Skill specs."""
    router_svc = get_llm_router()
    await router_svc.sync_from_db(db)
    return await router_svc.get_config_response_async(probe=True)


@router.put("/llm/config", response_model=LLMConfigResponse)
async def update_llm_config(
    body: LLMConfigUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> LLMConfigResponse:
    """Hot-update active LLM provider (Ollama local/tunnel, Claude, OpenRouter, Deterministic) and persist in DB."""
    router_svc = get_llm_router()
    await router_svc.sync_from_db(db)
    router_svc.update_config(body)
    await router_svc.persist_to_db(db)
    return await router_svc.get_config_response_async(probe=True)


@router.post("/llm/test-connection", response_model=LLMTestConnectionResponse)
async def test_llm_connection(
    body: LLMTestConnectionRequest,
    db: AsyncSession = Depends(get_db),
) -> LLMTestConnectionResponse:
    """Probe Ollama (MiniPC/Tunnel), Anthropic Claude API, or deterministic engine."""
    router_svc = get_llm_router()
    await router_svc.sync_from_db(db)
    return await router_svc.test_connection(
        provider_override=body.provider,
        ollama_base_url=body.ollama_base_url,
        ollama_model=body.ollama_model,
        ollama_api_key=body.ollama_api_key,
    )


@router.get("/llm/skills", response_model=list[LoadedSkillAgentSpec])
async def list_loaded_skills() -> list[LoadedSkillAgentSpec]:
    """List canonical Markdown agent Skills loaded from claude-content-engine-skill/."""
    return get_llm_router().loader.list_loaded_skills()


# --- 9. n8n Automation Workflow Templates ---

N8N_WORKFLOW_CATALOG: list[dict[str, Any]] = [
    {
        "workflow_id": "01-radar-ideas-ice",
        "filename": "01_radar_ideas_ice_matutino.json",
        "name": "01 - Radar Matutino de Ideas ICE y Guionización IA",
        "trigger_type": "Schedule / Cron",
        "schedule_or_webhook": "Todos los días 08:00 AM",
        "description": "Evalúa propuestas con ICE Score. Si supera 7.0, crea el proyecto en el tablero Kanban y redacta el guión AV con Ollama.",
        "endpoints_used": [
            "POST /api/v1/ideas/score-ice",
            "POST /api/v1/projects",
            "POST /api/v1/scripts/generate",
        ],
    },
    {
        "workflow_id": "02-drive-ffmpeg",
        "filename": "02_ingesta_google_drive_ffmpeg.json",
        "name": "02 - Ingesta Google Drive y Procesado FFmpeg (-14 LUFS)",
        "trigger_type": "Webhook",
        "schedule_or_webhook": "POST /webhook/ace-drive-ingest",
        "description": "Escanea nuevas grabaciones en Google Drive, recorta silencios, normaliza el audio a EBU R128 (-14 LUFS) y genera subtítulos con Whisper.",
        "endpoints_used": [
            "POST /api/v1/media/google-drive/scan",
            "POST /api/v1/media/google-drive/import",
        ],
    },
    {
        "workflow_id": "03-hitl-alert",
        "filename": "03_alerta_hitl_aprobacion_movil.json",
        "name": "03 - Alerta HITL al Móvil (Revisión antes de Publicar)",
        "trigger_type": "Webhook",
        "schedule_or_webhook": "POST /webhook/ace-hitl-alert",
        "description": "Cuando un vídeo queda listo para publicar, envía un aviso a Telegram con el resumen y enlace directo para tu aprobación humana (Nivel 3).",
        "endpoints_used": [
            "Telegram Bot API",
        ],
    },
    {
        "workflow_id": "04-publish-multichannel",
        "filename": "04_publicacion_multicanal_escalonada.json",
        "name": "04 - Publicación Multicanal Segura (Con Token HMAC)",
        "trigger_type": "Webhook",
        "schedule_or_webhook": "POST /webhook/ace-publish-approved",
        "description": "Emite token criptográfico HITL Nivel 3 con verificación 2FA y publica simultáneamente en YouTube, Instagram, TikTok y LinkedIn.",
        "endpoints_used": [
            "POST /api/v1/hitl/issue-token",
            "POST /api/v1/social/publish",
        ],
    },
    {
        "workflow_id": "05-rmta-weekly",
        "filename": "05_auditoria_rmta_aprendizaje.json",
        "name": "05 - Auditoría Semanal RMT-A y Memoria Episódica",
        "trigger_type": "Schedule / Cron",
        "schedule_or_webhook": "Lunes 09:00 AM",
        "description": "Ejecuta diagnóstico de 4 capas (Hold Rate 3s, Retención, Envíos) y guarda las lecciones aprendidas en learned_rules.md para mejorar futuros guiones.",
        "endpoints_used": [
            "POST /api/v1/analytics/diagnose-rmta",
        ],
    },
    {
        "workflow_id": "06-radar-reels-virales",
        "filename": "06_radar_reels_virales_inspiracion.json",
        "name": "06 - Radar Diario de Reels Virales (Inspiración del Tema del Día)",
        "trigger_type": "Schedule / Cron",
        "schedule_or_webhook": "Todos los días 08:15 AM",
        "description": "Toma las temáticas recién capturadas por el Flujo 01, busca los Reels con más reproducciones y engagement vía Apify y adjunta los mejores enlaces y ganchos a cada proyecto del Kanban.",
        "endpoints_used": [
            "GET /api/v1/projects",
            "POST /api/v1/radar/reels-inspiration",
        ],
    },
]


def _resolve_n8n_workflows_dir() -> Path | None:
    resolved = Path(__file__).resolve()
    candidates = [
        resolved.parents[3] / "infra" / "n8n" / "workflows",
        resolved.parents[2] / "infra" / "n8n" / "workflows",
        Path.cwd() / "infra" / "n8n" / "workflows",
        Path.cwd().parent / "infra" / "n8n" / "workflows",
    ]
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    return None


@router.get("/n8n/workflows", response_model=list[N8nWorkflowTemplateResponse])
async def list_n8n_workflows() -> list[N8nWorkflowTemplateResponse]:
    """Return official n8n workflow templates ready to download/import into MiniPC n8n."""
    workflows_dir = _resolve_n8n_workflows_dir()
    results: list[N8nWorkflowTemplateResponse] = []

    for meta in N8N_WORKFLOW_CATALOG:
        parsed_json: dict[str, Any] = {}
        if workflows_dir is not None:
            file_path = workflows_dir / meta["filename"]
            if file_path.is_file():
                try:
                    parsed_json = json.loads(file_path.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    parsed_json = {}

        results.append(
            N8nWorkflowTemplateResponse(
                workflow_id=meta["workflow_id"],
                filename=meta["filename"],
                name=meta["name"],
                trigger_type=meta["trigger_type"],
                schedule_or_webhook=meta["schedule_or_webhook"],
                description=meta["description"],
                endpoints_used=meta["endpoints_used"],
                workflow_json=parsed_json,
            )
        )

    return results


class N8nConnectionPayload(BaseModel):
    base_url: str = Field(..., min_length=4, max_length=300)
    api_key: str | None = Field(default=None, max_length=2000)


def _match_n8n_catalog_id(wf_name: str) -> str | None:
    low = (wf_name or "").strip().lower()
    for meta in N8N_WORKFLOW_CATALOG:
        prefix = meta["name"].split("-")[0].strip().lower()
        if prefix and (low.startswith(f"{prefix} -") or low.startswith(f"{prefix}-")):
            return meta["workflow_id"]
        if low == meta["name"].strip().lower():
            return meta["workflow_id"]
    return None


def _extract_n8n_execution_error(exec_obj: dict[str, Any]) -> tuple[str | None, str | None]:
    data = exec_obj.get("data")
    if not isinstance(data, dict):
        return None, None
    result_data = data.get("resultData")
    if not isinstance(result_data, dict):
        return None, None

    last_node = result_data.get("lastNodeExecuted")
    err = result_data.get("error")
    err_msg: str | None = None
    if isinstance(err, dict):
        node_info = err.get("node")
        if not last_node and isinstance(node_info, dict):
            last_node = node_info.get("name")
        err_msg = err.get("message") or err.get("description")
        if err.get("name") and err_msg and not str(err_msg).startswith(str(err.get("name"))):
            err_msg = f"{err['name']}: {err_msg}"
    if not err_msg:
        run_data = result_data.get("runData")
        if isinstance(run_data, dict):
            for node_name, runs in run_data.items():
                if isinstance(runs, list):
                    for run_item in runs:
                        if isinstance(run_item, dict) and isinstance(run_item.get("error"), dict):
                            node_err = run_item["error"]
                            last_node = last_node or node_name
                            err_msg = node_err.get("message") or node_err.get("description")
                            break
                if err_msg:
                    break
    return (str(last_node) if last_node else None, str(err_msg)[:320] if err_msg else None)


async def _fetch_n8n_live_status_impl(db: AsyncSession) -> dict[str, Any]:
    row = (
        await db.execute(select(SocialCredential).where(SocialCredential.channel == "n8n_server"))
    ).scalar_one_or_none()
    base_url = str(
        (row.account_name if row and row.account_name else "")
        or os.environ.get("N8N_BASE_URL")
        or "http://127.0.0.1:5678"
    ).strip().rstrip("/")
    api_key = str((row.access_token if row else "") or os.environ.get("N8N_API_KEY") or "").strip()

    if not api_key:
        return {
            "configured": False,
            "reachable": False,
            "n8n_base_url": base_url,
            "api_key_configured": False,
            "active_count": 0,
            "error_count": 0,
            "message": "Añade tu N8N API Key (en n8n → Settings → n8n API) para ver qué flujos están activos y detectar errores en vivo.",
            "workflows": [],
        }

    headers = {"X-N8N-API-KEY": api_key, "Accept": "application/json"}
    via_tunnel = False

    async def _query_n8n_pair(target_base: str, req_headers: dict[str, str]):
        async with httpx.AsyncClient(timeout=8.0) as client:
            return await asyncio.gather(
                client.get(f"{target_base}/api/v1/workflows?limit=100", headers=req_headers),
                client.get(f"{target_base}/api/v1/executions?limit=40&includeData=true", headers=req_headers),
            )

    try:
        try:
            wf_resp, ex_resp = await _query_n8n_pair(base_url, headers)
        except Exception as direct_exc:
            # If backend runs in the cloud (Railway) and cannot reach local/LAN/Tailscale IP directly,
            # automatically route through the authenticated MiniPC Cloudflare tunnel proxy.
            llm_cfg = get_llm_router()._effective_settings()
            tunnel_base = str(llm_cfg.get("ollama_base_url") or "").strip().rstrip("/")
            tunnel_token = str(llm_cfg.get("ollama_api_key") or "").strip()
            if tunnel_base and not any(h in tunnel_base for h in ("127.0.0.1", "localhost")):
                tunnel_headers = dict(headers)
                if tunnel_token:
                    tunnel_headers["Authorization"] = f"Bearer {tunnel_token}"
                wf_resp, ex_resp = await _query_n8n_pair(f"{tunnel_base}/n8n-proxy", tunnel_headers)
                via_tunnel = True
            else:
                raise direct_exc

        if wf_resp.status_code in (401, 403):
            return {
                "configured": True,
                "reachable": False,
                "n8n_base_url": base_url,
                "api_key_configured": True,
                "active_count": 0,
                "error_count": 0,
                "message": f"n8n rechazó la API Key (HTTP {wf_resp.status_code}). Genera una nueva en n8n → Settings → n8n API.",
                "workflows": [],
            }
        wf_resp.raise_for_status()
        wf_payload = wf_resp.json()
        raw_wfs = wf_payload.get("data", wf_payload) if isinstance(wf_payload, dict) else wf_payload
        if not isinstance(raw_wfs, list):
            raw_wfs = []

        raw_execs: list[dict[str, Any]] = []
        if ex_resp.status_code == 200:
            ex_payload = ex_resp.json()
            ex_list = ex_payload.get("data", ex_payload) if isinstance(ex_payload, dict) else ex_payload
            if isinstance(ex_list, list):
                raw_execs = ex_list
    except Exception as exc:
        return {
            "configured": True,
            "reachable": False,
            "n8n_base_url": base_url,
            "api_key_configured": True,
            "active_count": 0,
            "error_count": 0,
            "message": f"No se pudo conectar con n8n en {base_url}: {str(exc)[:180]}",
            "workflows": [],
        }

    latest_exec_by_wf: dict[str, dict[str, Any]] = {}
    for ex in raw_execs:
        if not isinstance(ex, dict):
            continue
        wf_id = str(ex.get("workflowId") or "")
        if wf_id and wf_id not in latest_exec_by_wf:
            latest_exec_by_wf[wf_id] = ex

    workflows_out: list[dict[str, Any]] = []
    active_count = 0
    error_count = 0
    for wf in raw_wfs:
        if not isinstance(wf, dict):
            continue
        wf_id = str(wf.get("id") or "")
        wf_name = str(wf.get("name") or "")
        is_active = bool(wf.get("active"))
        matched_id = _match_n8n_catalog_id(wf_name)
        last_ex = latest_exec_by_wf.get(wf_id)
        last_status = "none"
        last_at: str | None = None
        last_exec_id: str | None = None
        err_node: str | None = None
        err_msg: str | None = None
        if last_ex:
            last_exec_id = str(last_ex.get("id") or "")
            raw_status = str(last_ex.get("status") or "").lower()
            if not raw_status:
                raw_status = "success" if last_ex.get("finished") else "running"
            last_status = raw_status
            last_at = last_ex.get("stoppedAt") or last_ex.get("startedAt")
            if last_status == "error":
                err_node, err_msg = _extract_n8n_execution_error(last_ex)

        if matched_id:
            if is_active:
                active_count += 1
            if last_status == "error":
                error_count += 1

        workflows_out.append(
            {
                "n8n_workflow_id": wf_id,
                "matched_catalog_id": matched_id,
                "name": wf_name,
                "active": is_active,
                "last_execution_id": last_exec_id,
                "last_execution_status": last_status,
                "last_execution_at": last_at,
                "last_error_node": err_node,
                "last_error_message": err_msg,
                "editor_url": f"{base_url}/workflow/{wf_id}",
            }
        )

    via_txt = " vía túnel MiniPC" if via_tunnel else ""
    return {
        "configured": True,
        "reachable": True,
        "n8n_base_url": base_url,
        "api_key_configured": True,
        "active_count": active_count,
        "error_count": error_count,
        "message": f"Conectado a n8n{via_txt} ({len(workflows_out)} flujos totales · {active_count} de KigalContent activos · {error_count} con error).",
        "workflows": workflows_out,
    }


@router.get("/n8n/live-status")
async def get_n8n_live_status(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Query the connected n8n server API for live active/inactive state and execution errors."""
    return await _fetch_n8n_live_status_impl(db)


@router.put("/n8n/connection")
async def save_n8n_connection(
    body: N8nConnectionPayload,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Save n8n server base URL and Public API key and return fresh live status."""
    clean_url = body.base_url.strip().rstrip("/")
    if not clean_url.startswith(("http://", "https://")):
        is_local = clean_url.startswith(("localhost", "127.", "192.168.", "10.", "172."))
        clean_url = f"{'http' if is_local else 'https'}://{clean_url}"

    row = (
        await db.execute(select(SocialCredential).where(SocialCredential.channel == "n8n_server"))
    ).scalar_one_or_none()
    if row is None:
        row = SocialCredential(
            channel="n8n_server",
            access_token=(body.api_key or "").strip(),
            account_name=clean_url,
        )
        db.add(row)
    else:
        if body.api_key is not None and body.api_key.strip():
            row.access_token = body.api_key.strip()
        row.account_name = clean_url
    await db.commit()
    return await _fetch_n8n_live_status_impl(db)


class ReelsInspirationRequest(BaseModel):
    project_id: str | None = None
    topic: str | None = None
    hashtags: list[str] = Field(default_factory=list)
    limit: int = Field(default=5, ge=1, le=12)


_TOPIC_HASHTAG_MAP: list[tuple[tuple[str, ...], str]] = [
    (("automatiz", "n8n", "workflow", "flujo"), "automatizacion"),
    (("ecommerce", "e-commerce", "tienda online", "shopify"), "ecommerce"),
    (("pyme", "pymes", "empresa", "negocio", "autonomo"), "pymes"),
    (("marketing", "ventas", "cliente", "leads", "seo"), "marketingdigital"),
    (("claude", "chatgpt", "openai", "gemini", "agente", "llm"), "herramientasia"),
    (("digitaliz", "web", "transformacion"), "transformaciondigital"),
]


def _derive_reels_hashtags(topic: str, explicit: list[str]) -> list[str]:
    clean_explicit = [
        re.sub(r"[^a-z0-9]", "", h.lower().lstrip("#"))
        for h in explicit
        if h and h.strip()
    ]
    clean_explicit = [h for h in clean_explicit if len(h) >= 3]
    if clean_explicit:
        return list(dict.fromkeys(clean_explicit))[:3]

    norm = unicodedata.normalize("NFD", (topic or "").lower())
    norm = "".join(ch for ch in norm if unicodedata.category(ch) != "Mn")
    picked: list[str] = ["inteligenciaartificial"]
    for keys, tag in _TOPIC_HASHTAG_MAP:
        if any(k in norm for k in keys) and tag not in picked:
            picked.append(tag)
        if len(picked) >= 3:
            break
    if len(picked) < 2:
        picked.append("automatizacion")
    return picked[:3]


@router.post("/radar/reels-inspiration")
async def radar_reels_inspiration(
    body: ReelsInspirationRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Find top-performing Instagram Reels matching a Radar Matutino project topic via Apify and attach them to context_notes."""
    apify_token, _, _, _ = await _get_effective_social_credential(db, "apify")
    apify_token = (apify_token or os.environ.get("APIFY_API_TOKEN") or "").strip()
    if not apify_token:
        raise HTTPException(
            status_code=400,
            detail="Falta APIFY_API_TOKEN. Consigue tu token gratuito en console.apify.com/settings/integrations y guárdalo en Conexiones Oficiales → Motores Visuales → Apify.",
        )

    project: ContentProject | None = None
    if body.project_id:
        try:
            pid = uuid.UUID(body.project_id)
            project = (
                await db.execute(select(ContentProject).where(ContentProject.id == pid))
            ).scalar_one_or_none()
        except ValueError:
            project = None
    elif not body.topic:
        project = (
            await db.execute(
                select(ContentProject)
                .where(ContentProject.source_origin == "radar_matutino")
                .order_by(desc(ContentProject.created_at))
                .limit(1)
            )
        ).scalar_one_or_none()

    topic = (body.topic or (project.working_title if project else "") or "inteligencia artificial para pymes").strip()
    hashtags = _derive_reels_hashtags(topic, body.hashtags)

    apify_url = (
        f"https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/"
        f"run-sync-get-dataset-items?token={apify_token}"
    )
    apify_payload = {
        "hashtags": hashtags,
        "resultsType": "reels",
        "resultsLimit": 12,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(apify_url, json=apify_payload)
            if resp.status_code in (401, 403):
                raise HTTPException(
                    status_code=401,
                    detail=f"Apify rechazó el token (HTTP {resp.status_code}). Revísalo en Conexiones Oficiales → Motores Visuales.",
                )
            resp.raise_for_status()
            raw_items = resp.json()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Error consultando Apify Reels Scraper: {str(exc)[:220]}",
        ) from exc

    if not isinstance(raw_items, list):
        raw_items = []

    ranked: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        if not url and item.get("shortCode"):
            url = f"https://www.instagram.com/reel/{item['shortCode']}/"
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)

        views = int(item.get("videoPlayCount") or item.get("videoViewCount") or item.get("playCount") or 0)
        likes = int(item.get("likesCount") or 0)
        comments = int(item.get("commentsCount") or 0)
        duration = item.get("videoDuration")
        caption = " ".join(str(item.get("caption") or "").split())
        hook = caption[:140] + ("…" if len(caption) > 140 else "")
        owner = str(item.get("ownerUsername") or item.get("ownerFullName") or "creador")
        score = views + likes * 15 + comments * 40

        ranked.append(
            {
                "url": url,
                "owner_username": owner,
                "views": views,
                "likes": likes,
                "comments": comments,
                "duration_seconds": round(float(duration), 1) if isinstance(duration, (int, float)) else None,
                "hook_excerpt": hook,
                "engagement_score": score,
                "timestamp": item.get("timestamp"),
            }
        )

    ranked.sort(key=lambda r: r["engagement_score"], reverse=True)
    top_reels = ranked[: body.limit]

    attached_to_project = False
    if project is not None and top_reels:
        lines = [f"🎬 REELS VIRALES DE INSPIRACIÓN (#{', #'.join(hashtags)}):"]
        for idx, r in enumerate(top_reels, start=1):
            dur_txt = f" · {r['duration_seconds']}s" if r["duration_seconds"] else ""
            lines.append(
                f"{idx}. @{r['owner_username']} ({r['views']:,} views · {r['likes']:,} likes{dur_txt}) — {r['url']}\n   Gancho: \"{r['hook_excerpt']}\""
            )
        block = "\n".join(lines)
        existing_notes = (project.context_notes or "").strip()
        if "🎬 REELS VIRALES DE INSPIRACIÓN" in existing_notes:
            existing_notes = existing_notes.split("🎬 REELS VIRALES DE INSPIRACIÓN")[0].strip()
        project.context_notes = f"{existing_notes}\n\n{block}".strip() if existing_notes else block
        await db.commit()
        attached_to_project = True

    return {
        "ok": True,
        "topic": topic,
        "hashtags_used": hashtags,
        "total_scanned": len(raw_items),
        "top_reels": top_reels,
        "project_id": str(project.id) if project else None,
        "asset_code": project.asset_code if project else None,
        "attached_to_project": attached_to_project,
    }


# --- 11. Paid Ads Campaign Engine (Meta Ads, Google Ads Search/YouTube & Remotion) ---


def _fit_char_limit(text: str, limit: int) -> str:
    """Trim copy cleanly on word boundaries so Google Ads RSA limits (<=30 / <=90) never overflow."""
    clean = " ".join(text.split()).strip()
    if len(clean) <= limit:
        return clean
    cut = clean[:limit].rstrip()
    if " " in cut and len(cut) > int(limit * 0.55):
        cut = cut.rsplit(" ", 1)[0].rstrip(" ,.;:-")
    return (cut or clean[:limit]).strip()[:limit]


def _append_utm_params(base_url: str, utm_params: dict[str, str]) -> str:
    raw = base_url.strip() or "https://kigalcontent.studio/recurso"
    if not raw.startswith(("http://", "https://")):
        raw = f"https://{raw.lstrip('/')}"
    parsed = urlparse(raw)
    query_pairs = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query_pairs.update(utm_params)
    return urlunparse(parsed._replace(query=urlencode(query_pairs)))


def _slugify_utm(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug[:40] or "kigal_campaign"


@router.post("/ads/generate-campaign", response_model=AdCampaignResponse)
async def generate_ads_campaign(
    body: AdCampaignGenerateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AdCampaignResponse:
    """Generate Meta Ads, Google Ads RSA/Search/YouTube & Remotion 9:16 creative campaigns from CreatorProfile."""
    row = (await db.execute(select(CreatorProfile).limit(1))).scalar_one_or_none()
    if row:
        profile = _serialize_creator_profile(row)
        raw_lms = row.lead_magnets or []
        workspace_id: uuid.UUID | None = row.workspace_id
    else:
        profile = CreatorProfileSchema(**get_settings().load_creator_profile_file())
        raw_lms = []
        workspace_id = None

    project_uuid: uuid.UUID | None = None
    project_title: str | None = None
    if body.project_id:
        try:
            parsed_pid = uuid.UUID(body.project_id)
            proj = (
                await db.execute(select(ContentProject).where(ContentProject.id == parsed_pid))
            ).scalar_one_or_none()
            if proj:
                project_uuid = proj.id
                project_title = proj.working_title
        except ValueError:
            pass

    topic = body.topic.strip() or project_title or "Sistemas de Contenido e IA"
    niche = profile.niche or "Automatización con IA y Sistemas"
    icp = profile.ideal_customer_profile or "Fundadores y consultores B2B"
    creator_name = profile.name or "David"
    keyword = (body.trigger_keyword or "GUIA").strip().upper()

    # Resolve primary Lead Magnet from CreatorProfile
    lm_title = ""
    lm_url = ""
    if profile.lead_magnets:
        lm_title = profile.lead_magnets[0].title
        lm_url = profile.lead_magnets[0].delivery_url
    elif raw_lms and isinstance(raw_lms[0], dict):
        lm_title = str(raw_lms[0].get("title") or raw_lms[0].get("name") or "")
        lm_url = str(raw_lms[0].get("delivery_url") or "")
    if not lm_title:
        email_spec = profile.conversion_goals_catalog.get("EMAIL_LEAD_CAPTURE")
        if email_spec and email_spec.lead_magnet_name:
            lm_title = email_spec.lead_magnet_name
    if not lm_title:
        lm_title = f"Guía Práctica: {topic}"

    target_url = body.target_url.strip() or lm_url or "https://kigalcontent.studio/recurso"
    is_dm_objective = any(tok in body.objective.lower() for tok in ("manychat", "kigalchat", "dm", "lead"))
    cta_btn = "SEND_MESSAGE" if is_dm_objective else "LEARN_MORE"

    variants = [
        AdCreativeVariant(
            variant_id="VAR-PAS-01",
            angle_name="PAS Dolor",
            framework="PAS (Problema · Agitación · Solución)",
            primary_text=(
                f"¿Sigues atrapado ejecutando {topic} de forma manual mientras tu margen se reduce?\n\n"
                f"Para {icp} dentro de {niche}, el verdadero cuello de botella no es falta de ideas: "
                f"es operar sin una arquitectura repetible. Cada semana pierdes horas valiosas en tareas operativas.\n\n"
                f"Por eso preparamos «{lm_title}». Comenta {keyword} o haz clic abajo para recibir el sistema paso a paso."
            ),
            headline=_fit_char_limit(f"Deja El Caos Manual En {topic}", 40),
            description=_fit_char_limit(f"Sistema para {icp}. Comenta {keyword} y accede a {lm_title}.", 125),
            cta_button=cta_btn,
            remotion_916_storyboard=[
                {
                    "scene": "1",
                    "timecode": "00:00-00:03",
                    "remotion_component": "PainHookKineticOverlay",
                    "visual_direction": "Close-up vertical 9:16 con zoom punch 115% y badge rojo de alerta operativa.",
                    "on_screen_text": f"EL COSTO OCULTO DE {topic[:24].upper()}",
                    "audio_voiceover": f"Si eres {icp[:45]} y sigues haciendo {topic} a mano, estás perdiendo horas cada día.",
                },
                {
                    "scene": "2",
                    "timecode": "00:03-00:12",
                    "remotion_component": "BottleneckMetricCard",
                    "visual_direction": "Split-screen Remotion: izquierda reloj quemando horas vs derecha flujo automatizado.",
                    "on_screen_text": "MÁS HORAS ≠ MÁS ESCALA",
                    "audio_voiceover": f"En {niche[:55]}, el volumen sin sistema solo multiplica el agotamiento operativo.",
                },
                {
                    "scene": "3",
                    "timecode": "00:12-00:22",
                    "remotion_component": "BlueprintStepReveal",
                    "visual_direction": "Animación de 3 nodos conectados mostrando el flujo del recurso en pantalla.",
                    "on_screen_text": lm_title[:36].upper(),
                    "audio_voiceover": f"Con {lm_title} conviertes un proceso artesanal en un sistema determinista.",
                },
                {
                    "scene": "4",
                    "timecode": "00:22-00:30",
                    "remotion_component": "KigalChatKeywordCTA",
                    "visual_direction": f"Burbuja animada de DM automático tras comentar {keyword}.",
                    "on_screen_text": f"COMENTA «{keyword}» AHORA",
                    "audio_voiceover": f"Comenta {keyword} o toca el botón y te enviamos {lm_title} al instante.",
                },
            ],
        ),
        AdCreativeVariant(
            variant_id="VAR-AUTH-02",
            angle_name="Autoridad / Caso Real",
            framework="Autoridad + Caso Real Empírico",
            primary_text=(
                f"Cómo pasamos de flujos manuales en {topic} a un ecosistema medible pensado para {icp}.\n\n"
                f"Después de auditar implementaciones reales en {niche}, documentamos exactamente qué palancas "
                f"disparan resultados sin inflar costes ni equipo.\n\n"
                f"Descarga o solicita «{lm_title}» comentando {keyword} y replica la misma hoja de ruta en tu proyecto."
            ),
            headline=_fit_char_limit(f"Caso Real: {topic} Escalable", 40),
            description=_fit_char_limit(f"Metodología probada de {creator_name}: solicita {lm_title} con {keyword}.", 125),
            cta_button=cta_btn,
            remotion_916_storyboard=[
                {
                    "scene": "1",
                    "timecode": "00:00-00:03",
                    "remotion_component": "CaseStudyProofBanner",
                    "visual_direction": "Dashboard real de resultados en 9:16 con counter animado y cámara frontal.",
                    "on_screen_text": "CASO REAL EN PRODUCCIÓN",
                    "audio_voiceover": f"Así es como implementamos {topic} para {icp[:45]} con métricas reales.",
                },
                {
                    "scene": "2",
                    "timecode": "00:03-00:13",
                    "remotion_component": "BeforeAfterTelemetry",
                    "visual_direction": "Comparativa de métricas antes vs después con tarjetas neon dark-mode.",
                    "on_screen_text": "PROCESO VALIDADO EN NICHO",
                    "audio_voiceover": f"Auditamos cada cuello de botella en {niche[:50]} y aislamos las 3 piezas críticas.",
                },
                {
                    "scene": "3",
                    "timecode": "00:13-00:23",
                    "remotion_component": "LeadMagnetPreviewScroll",
                    "visual_direction": "Mockup 3D móvil recorriendo las secciones de la guía/plantilla.",
                    "on_screen_text": f"INCLUYE: {lm_title[:30]}",
                    "audio_voiceover": f"Todo el desglose técnico está empaquetado dentro de {lm_title}.",
                },
                {
                    "scene": "4",
                    "timecode": "00:23-00:30",
                    "remotion_component": "DirectOfferFooter",
                    "visual_direction": "Flecha animada hacia CTA + badge de entrega inmediata por DM/URL.",
                    "on_screen_text": f"ENVÍA «{keyword}» O TOCA ABAJO",
                    "audio_voiceover": f"Toca el enlace o comenta {keyword} y recíbelo hoy mismo.",
                },
            ],
        ),
        AdCreativeVariant(
            variant_id="VAR-CONTRA-03",
            angle_name="Demo Contraintuitiva",
            framework="Contrarian Hook + Live Demo",
            primary_text=(
                f"No necesitas más herramientas ni más horas para dominar {topic}.\n\n"
                f"De hecho, la mayoría de {icp} fracasa en {niche} por añadir complejidad antes de simplificar su sistema core. "
                f"En esta demo de 30 segundos ves cómo reemplazar fricción manual por una secuencia automatizada.\n\n"
                f"Llévate «{lm_title}» comentando {keyword} o entrando directo desde este anuncio."
            ),
            headline=_fit_char_limit(f"Menos Complejidad En {topic}", 40),
            description=_fit_char_limit(f"Mira la demo real y consigue {lm_title} con la palabra {keyword}.", 125),
            cta_button="LEARN_MORE",
            remotion_916_storyboard=[
                {
                    "scene": "1",
                    "timecode": "00:00-00:03",
                    "remotion_component": "ContrarianStrikethroughHook",
                    "visual_direction": "Texto tachando mitos del sector + corte seco de audio a los 1.2s.",
                    "on_screen_text": "NO NECESITAS MÁS HERRAMIENTAS",
                    "audio_voiceover": f"Casi todo lo que te cuentan sobre {topic} para {icp[:35]} está al revés.",
                },
                {
                    "scene": "2",
                    "timecode": "00:03-00:14",
                    "remotion_component": "LiveWorkflowScreencast",
                    "visual_direction": "Captura de pantalla acelerada 1.5x con zoom dinámico en la ejecución real.",
                    "on_screen_text": "DEMO EN VIVO: PASO A PASO",
                    "audio_voiceover": "Mira cómo funciona en vivo: un solo disparador conecta adquisición, entrega y medición.",
                },
                {
                    "scene": "3",
                    "timecode": "00:14-00:23",
                    "remotion_component": "ArchitectureTakeaway",
                    "visual_direction": "Resumen visual en 3 bullets de alto contraste dentro de zona segura 9:16.",
                    "on_screen_text": "SIMPLE · MEDIBLE · REPLICABLE",
                    "audio_voiceover": f"Sin sobrecarga operativa, pensado específicamente para {niche[:45]}.",
                },
                {
                    "scene": "4",
                    "timecode": "00:23-00:30",
                    "remotion_component": "UTMActionEndcard",
                    "visual_direction": "Endcard limpia con botón CTA y palabra clave en neón cyan.",
                    "on_screen_text": f"ACCEDE CON «{keyword}»",
                    "audio_voiceover": f"Accede ahora a {lm_title} desde el botón o comenta {keyword}.",
                },
            ],
        ),
    ]

    topic_short = _fit_char_limit(topic, 18)
    niche_short = _fit_char_limit(niche, 24)
    icp_short = _fit_char_limit(icp, 24)
    lm_short = _fit_char_limit(lm_title, 28)
    kw_short = _fit_char_limit(keyword, 10)

    raw_rsa_headlines = [
        f"{topic_short} Sin Caos",
        f"Domina {topic_short}",
        f"Sistema {topic_short}",
        f"Guía {topic_short} 2026",
        f"Comenta {kw_short} Ahora",
        lm_short,
        "Ahorra +10h Semanales",
        "Automatización Real IA",
        "Escala Sin Más Equipo",
        "Descarga El Blueprint",
    ]
    rsa_headlines: list[str] = []
    seen_h: set[str] = set()
    for h in raw_rsa_headlines:
        fitted = _fit_char_limit(h, 30)
        if fitted and fitted.lower() not in seen_h:
            seen_h.add(fitted.lower())
            rsa_headlines.append(fitted)

    raw_rsa_descriptions = [
        f"Sistema práctico en {topic_short} para {icp_short}. Accede a {lm_short}.",
        f"Deja el trabajo manual: aplica {topic_short} con arquitectura probada y medible.",
        f"Solicita {lm_short} ahora o usa {kw_short}. Cero teoría, ejecución directa.",
        f"Diseñado para {icp_short} en {niche_short}. Implementación paso a paso.",
    ]
    rsa_descriptions = [_fit_char_limit(d, 90) for d in raw_rsa_descriptions]

    kw_base = re.sub(r"[^\w\sáéíóúñü-]", "", topic.lower()).strip()
    kw_core = " ".join(kw_base.split()[:4]) or "sistemas ia"
    niche_core = " ".join(re.sub(r"[^\w\sáéíóúñü-]", "", niche.lower()).split()[:3]) or "automatizacion"

    google_rsa = GoogleRSASpec(
        headlines=rsa_headlines,
        descriptions=rsa_descriptions,
        search_keywords_exact=[
            f"[{kw_core}]",
            f"[sistema {kw_core}]",
            f"[guia {kw_core}]",
            f"[{kw_core} {niche_core}]",
        ],
        search_keywords_phrase=[
            f'"{kw_core}"',
            f'"como implementar {kw_core}"',
            f'"automatizar {kw_core}"',
            f'"plantilla {kw_core}"',
        ],
        search_keywords_negative=[
            "-gratis",
            "-curso pirata",
            "-descargar crack",
            "-empleo",
            "-vacantes",
            "-wikipedia",
            "-que significa",
        ],
        youtube_5s_hook=(
            f"Espera 5 segundos: si lideras en {icp_short} y sigues resolviendo {topic} a mano, "
            f"estás perdiendo margen cada semana. Mira cómo funciona {lm_title} antes de saltar."
        ),
    )

    campaign_slug = _slugify_utm(topic)
    utm_specs = [
        {
            "platform": "Meta Ads (Reels / Stories)",
            "variant_id": "VAR-PAS-01",
            "utm_source": "meta",
            "utm_medium": "paid_social",
            "utm_campaign": f"kigal_{campaign_slug}",
            "utm_content": "pas_dolor_916",
            "utm_term": keyword.lower(),
        },
        {
            "platform": "Meta Ads (Feed Autoridad)",
            "variant_id": "VAR-AUTH-02",
            "utm_source": "meta",
            "utm_medium": "paid_social",
            "utm_campaign": f"kigal_{campaign_slug}",
            "utm_content": "autoridad_caso_real",
            "utm_term": keyword.lower(),
        },
        {
            "platform": "Google Ads Search (RSA)",
            "variant_id": "RSA-SEARCH",
            "utm_source": "google",
            "utm_medium": "cpc",
            "utm_campaign": f"search_{campaign_slug}",
            "utm_content": "rsa_exact_phrase",
            "utm_term": kw_core.replace(" ", "+"),
        },
        {
            "platform": "YouTube Ads (In-Stream 5s)",
            "variant_id": "YT-5S-HOOK",
            "utm_source": "youtube",
            "utm_medium": "paid_video",
            "utm_campaign": f"yt_{campaign_slug}",
            "utm_content": "demo_contraintuitiva_5s",
            "utm_term": keyword.lower(),
        },
        {
            "platform": "LinkedIn Ads (Thought Leader)",
            "variant_id": "LI-THOUGHT-LEADER",
            "utm_source": "linkedin",
            "utm_medium": "paid_social",
            "utm_campaign": f"li_{campaign_slug}",
            "utm_content": "thought_leader_ad",
            "utm_term": keyword.lower(),
        },
        {
            "platform": "LinkedIn Ads (Document / Lead Gen)",
            "variant_id": "LI-DOC-CAROUSEL",
            "utm_source": "linkedin",
            "utm_medium": "paid_social",
            "utm_campaign": f"li_{campaign_slug}",
            "utm_content": "document_carousel_ad",
            "utm_term": keyword.lower(),
        },
    ]
    ga4_utm_links: list[dict[str, str]] = []
    for spec in utm_specs:
        full_url = _append_utm_params(
            target_url,
            {
                "utm_source": spec["utm_source"],
                "utm_medium": spec["utm_medium"],
                "utm_campaign": spec["utm_campaign"],
                "utm_content": spec["utm_content"],
                "utm_term": spec["utm_term"],
            },
        )
        ga4_utm_links.append({**spec, "url": full_url, "utm_url": full_url})

    linkedin_ads = generate_linkedin_b2b_ads_spec(
        topic=topic,
        objective=body.objective,
        target_url=target_url,
        trigger_keyword=keyword,
        profile=profile,
        lm_title=lm_title,
    )

    if workspace_id is not None:
        await _record_audit(
            db=db,
            workspace_id=workspace_id,
            project_id=project_uuid,
            action_type="AD_CAMPAIGN_GENERATED",
            agent_or_user_id="AdsCampaignStrategist",
            security_tier=1,
            operation_status="SUCCESS",
            payload={
                "topic": topic,
                "objective": body.objective,
                "platforms": body.platforms,
                "variants_count": len(variants),
                "trigger_keyword": keyword,
            },
            ip_source=request.client.host if request.client else "127.0.0.1",
        )
        await db.commit()

    await broadcaster.broadcast(
        "AD_CAMPAIGN_GENERATED",
        {
            "topic": topic,
            "platforms": body.platforms,
            "variants_count": len(variants),
        },
    )

    return AdCampaignResponse(
        topic=topic,
        objective=body.objective,
        platforms=body.platforms,
        variants=variants,
        google_rsa=google_rsa,
        linkedin_ads=linkedin_ads,
        ga4_utm_links=ga4_utm_links,
    )


@router.get("/ads/linkedin-library/status", response_model=LinkedInAdLibraryStatusResponse)
async def get_linkedin_ad_library_status(
    db: AsyncSession = Depends(get_db),
) -> LinkedInAdLibraryStatusResponse:
    """Verify live access to LinkedIn Ad Library API using configured linkedin_ads or linkedin token."""
    token, _, source, account_name = await _get_effective_social_credential(db, "linkedin_ads")
    return await LinkedInAdLibraryClient().check_status(
        token=token,
        token_source=source,
        account_name=account_name or "",
    )


@router.post("/ads/linkedin-library/search", response_model=LinkedInAdLibrarySearchResponse)
async def search_linkedin_ad_library(
    body: LinkedInAdLibrarySearchRequest,
    db: AsyncSession = Depends(get_db),
) -> LinkedInAdLibrarySearchResponse:
    """Query LinkedIn's official Ad Library API for competitive B2B ad intelligence."""
    token, _, _, _ = await _get_effective_social_credential(db, "linkedin_ads")
    return await LinkedInAdLibraryClient().search(token=token, req=body)


@router.post("/ads/linkedin-library/to-idea")
async def import_linkedin_ad_to_idea(
    body: LinkedInAdToIdeaRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Convert a LinkedIn Ad Library inspiration into an evaluated Idea + Kanban ContentProject."""
    ws = await _get_default_workspace(db)
    raw_headline = (body.headline or "").strip()
    snippet = " ".join(body.body_text.split())[:65].strip()
    working_title = (
        raw_headline[:255]
        if raw_headline
        else f"Ángulo {body.advertiser_name[:40]}: {snippet}"[:255]
    )
    context_notes = (
        f"Inspiración importada desde LinkedIn Ad Library.\n"
        f"Anunciante: {body.advertiser_name} · Formato: {body.format}\n"
        + (f"Landing: {body.landing_page_url}\n" if body.landing_page_url else "")
        + f"\nCopy original analizado:\n{body.body_text.strip()}"
    )

    idea = Idea(
        workspace_id=ws.id,
        concept_title=working_title,
        source_origin="linkedin_ad_library",
        impact_score=8.5,
        confidence_score=8.0,
        ease_score=8.5,
        ice_score=8.33,
        ice_multiplicative=578.0,
        tam_classification=TAMClassification.CORE_80.value,
        triage_status="APROBADO_PRIORITARIO",
        context_notes=context_notes,
        target_platforms=["LinkedIn"],
        research_dossier={
            "advertiser_name": body.advertiser_name,
            "format": body.format,
            "landing_page_url": body.landing_page_url,
        },
        semantic_embedding=compute_deterministic_embedding(working_title),
    )
    db.add(idea)
    await db.flush()

    asset_code = f"LI-{uuid.uuid4().hex[:5].upper()}"
    blocks, ab_variants, cta_text = generate_parametric_script(
        topic=working_title,
        preset=DurationPreset.STANDARD_SHORT,
        goal=ConversionGoal.B2B_INBOUND_CONVERSATION,
    )
    project = ContentProject(
        workspace_id=ws.id,
        idea_id=idea.id,
        asset_code=asset_code,
        working_title=working_title,
        target_duration=DurationPreset.STANDARD_SHORT.value,
        conversion_goal=ConversionGoal.B2B_INBOUND_CONVERSATION.value,
        current_state=FSMState.SCRIPTED_PACKAGED.value,
        ice_score=8.33,
        tam_classification=TAMClassification.CORE_80.value,
        context_notes=context_notes,
        source_origin="linkedin_ad_library",
        target_platforms=["LinkedIn"],
        content_format=ContentFormat.TEXT_ONLY.value,
        ab_variants=[v.model_dump(mode="json") for v in ab_variants],
        state_history=[
            {"from": "INIT", "to": "CAPTURED", "agent": "LinkedInAdLibrary", "tier": 1},
            {"from": "CAPTURED", "to": FSMState.SCRIPTED_PACKAGED.value, "agent": "AdsCampaignStrategist", "tier": 1},
        ],
        temporal_workflow_id=f"wf-liad-{asset_code.lower()}",
    )
    db.add(project)
    await db.flush()

    computed_blocks, wc, est_sec, _ = compute_block_metrics(blocks, 140, DurationPreset.STANDARD_SHORT)
    db.add(
        Script(
            project_id=project.id,
            script_version=1,
            duration_preset=DurationPreset.STANDARD_SHORT.value,
            conversion_goal=ConversionGoal.B2B_INBOUND_CONVERSATION.value,
            wpm_rate=140,
            two_column_blocks=[b.model_dump(mode="json") for b in computed_blocks],
            hook_variants=[],
            selected_hook_index=0,
            cta_text=cta_text,
            word_count=wc,
            estimated_duration_sec=est_sec,
        )
    )

    copy_engine = SocialCopyCraftEngine()
    li_draft = copy_engine.generate_linkedin(
        headline=working_title,
        thesis_points=[snippet or working_title],
        goal=ConversionGoal.B2B_INBOUND_CONVERSATION,
        context_notes=context_notes,
    )
    pf = validate_preflight(SocialChannel.LINKEDIN, li_draft)
    db.add(
        SocialPost(
            project_id=project.id,
            channel=SocialChannel.LINKEDIN.value,
            title=li_draft.get("title"),
            post_body=li_draft["post_body"],
            first_comment=li_draft.get("first_comment"),
            hashtags=li_draft.get("hashtags", []),
            metadata_payload=li_draft.get("metadata_payload", {}),
            preflight_warnings=pf.warnings + pf.blocking_errors,
            preflight_passed=pf.passed,
            publish_status="READY_FOR_HITL",
        )
    )

    await _record_audit(
        db=db,
        workspace_id=ws.id,
        project_id=project.id,
        action_type="LINKEDIN_AD_TO_IDEA",
        agent_or_user_id="AdsCampaignStrategist",
        security_tier=1,
        operation_status="SUCCESS",
        payload={
            "advertiser_name": body.advertiser_name,
            "format": body.format,
            "asset_code": asset_code,
        },
        ip_source=request.client.host if request.client else "127.0.0.1",
    )
    await db.commit()

    await broadcaster.broadcast(
        "PROJECT_CREATED",
        {"project_id": str(project.id), "asset_code": asset_code, "source": "linkedin_ad_library"},
    )
    return {
        "imported": True,
        "project_id": str(project.id),
        "asset_code": asset_code,
        "working_title": working_title,
    }


# --- 12. Metricool-Style Publishing Scheduler, Best Times & Autolists ---


def _normalize_dt_utc(dt: datetime | None, tz_name: str = "Europe/Madrid") -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        try:
            tz_obj = ZoneInfo((tz_name or "Europe/Madrid").strip() or "Europe/Madrid")
        except (ZoneInfoNotFoundError, KeyError, ValueError):
            tz_obj = timezone.utc
        return dt.replace(tzinfo=tz_obj).astimezone(timezone.utc)
    return dt.astimezone(timezone.utc)


def _parse_calendar_bound(raw: str | None, is_end: bool = False) -> datetime | None:
    if not raw or not raw.strip():
        return None
    txt = re.sub(r" (\d{2}:\d{2})$", r"+\1", raw.strip())
    is_date_only = len(txt) == 10 and "T" not in txt and " " not in txt
    try:
        parsed = datetime.fromisoformat(txt.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Fecha inválida en calendario: {raw}") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    else:
        parsed = parsed.astimezone(timezone.utc)
    if is_date_only and is_end:
        parsed = parsed.replace(hour=23, minute=59, second=59)
    return parsed


def _compute_scheduled_hitl_ttl(scheduled_utc: datetime | None) -> int:
    if scheduled_utc is None:
        return 3600
    delta = int((scheduled_utc - datetime.now(timezone.utc)).total_seconds())
    return max(3600, min(180 * 86400, delta + 7200))


def _canonical_channel_name(raw_channel: str) -> str:
    lookup = {
        "youtube": SocialChannel.YOUTUBE.value,
        "instagram": SocialChannel.INSTAGRAM.value,
        "tiktok": SocialChannel.TIKTOK.value,
        "linkedin": SocialChannel.LINKEDIN.value,
    }
    return lookup.get(raw_channel.strip().lower(), raw_channel.strip() or SocialChannel.LINKEDIN.value)


async def _load_autolist(db: AsyncSession, autolist_id: uuid.UUID) -> Autolist:
    row = (
        await db.execute(
            select(Autolist)
            .options(selectinload(Autolist.items))
            .where(Autolist.id == autolist_id)
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Autolist not found.")
    return row


@router.get("/publishing/calendar", response_model=PublishingCalendarResponse)
async def get_publishing_calendar(
    start: str | None = None,
    end: str | None = None,
    channel: str | None = None,
    tz_param: str = Query(default="Europe/Madrid", alias="timezone"),
    db: AsyncSession = Depends(get_db),
) -> PublishingCalendarResponse:
    """Return scheduled/draft/published SocialPosts, projected Autolist slots, and connected channels."""
    now_utc = datetime.now(timezone.utc)
    default_start = (now_utc - timedelta(days=now_utc.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    start_dt = _parse_calendar_bound(start, is_end=False) or default_start
    end_dt = _parse_calendar_bound(end, is_end=True) or (start_dt + timedelta(days=30))

    stmt = (
        select(SocialPost, ContentProject)
        .join(ContentProject, SocialPost.project_id == ContentProject.id)
        .order_by(SocialPost.scheduled_at.asc(), desc(SocialPost.created_at))
    )
    rows = (await db.execute(stmt)).all()

    channel_filter = channel.strip().lower() if channel and channel.strip() and channel.strip().upper() != "ALL" else None

    calendar_posts: list[SocialPostResponse] = []
    for sp, proj in rows:
        if channel_filter and sp.channel.lower() != channel_filter:
            continue
        effective_dt = sp.scheduled_at or sp.published_at
        if effective_dt is not None:
            eff_utc = _normalize_dt_utc(effective_dt)
            assert eff_utc is not None
            if not (start_dt <= eff_utc <= end_dt):
                continue
        elif sp.publish_status not in ("DRAFT", "MANUAL_REMINDER", "READY_FOR_HITL"):
            continue
        calendar_posts.append(_serialize_social_post(sp, proj))

    autolists = (
        (
            await db.execute(
                select(Autolist)
                .options(selectinload(Autolist.items))
                .where(Autolist.is_active.is_(True))
            )
        )
        .scalars()
        .all()
    )
    projected_slots = project_autolist_slots(list(autolists), start_dt, end_dt)
    if channel_filter:
        projected_slots = [
            s for s in projected_slots if str(s.get("channel", "")).lower() == channel_filter
        ]

    connected_channels: dict[str, dict[str, Any]] = {}
    for ch_name in ("YouTube", "Instagram", "TikTok", "LinkedIn"):
        token, urn, source, account_name = await _get_effective_social_credential(
            db, ch_name.lower()
        )
        connected_channels[ch_name] = {
            "configured": bool(token),
            "account_name": account_name or "",
            "source": source,
            "person_urn": urn if (urn and urn != "urn:li:person:creator-001") else "",
        }

    return PublishingCalendarResponse(
        posts=calendar_posts,
        projected_autolist_slots=projected_slots,
        connected_channels=connected_channels,
        timezone=tz_param,
    )


@router.post("/publishing/posts")
async def create_publishing_posts(
    body: ComposerPostCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Create multi-channel draft, manual reminder, scheduled, or immediate posts from Composer."""
    mode = body.publish_mode.strip().upper()
    if mode not in ("DRAFT", "SCHEDULED", "MANUAL_REMINDER", "PUBLISH_NOW"):
        raise HTTPException(status_code=400, detail=f"publish_mode no soportado: {body.publish_mode}")

    scheduled_utc = _normalize_dt_utc(body.scheduled_at, body.timezone)
    if mode == "SCHEDULED" and scheduled_utc is None:
        raise HTTPException(
            status_code=400,
            detail="Debes especificar una fecha/hora (scheduled_at) para programar la publicación.",
        )

    ws = await _get_default_workspace(db)
    if body.project_id is not None:
        project = (
            await db.execute(select(ContentProject).where(ContentProject.id == body.project_id))
        ).scalar_one_or_none()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found.")
    else:
        first_line = " ".join(body.post_body.strip().splitlines()[:1])[:80]
        working_title = (body.title or first_line or "Publicación Programada").strip()[:255]
        asset_code = f"PUB-{uuid.uuid4().hex[:5].upper()}"
        target_platforms = list(dict.fromkeys(ch.value for ch in body.channels))
        project = ContentProject(
            workspace_id=ws.id,
            asset_code=asset_code,
            working_title=working_title,
            target_duration=DurationPreset.STANDARD_SHORT.value,
            conversion_goal=ConversionGoal.EMAIL_LEAD_CAPTURE.value,
            current_state=FSMState.HITL_PENDING_PUBLISH.value,
            ice_score=8.0,
            tam_classification=TAMClassification.CORE_80.value,
            source_origin="publishing_composer",
            target_platforms=target_platforms,
            content_format=(
                ContentFormat.TEXT_ONLY.value
                if body.visual_mode == "NONE"
                else ContentFormat.TEXT_AND_VIDEO.value
            ),
            state_history=[
                {"from": "INIT", "to": FSMState.HITL_PENDING_PUBLISH.value, "agent": "PublishingComposer", "tier": 1}
            ],
            temporal_workflow_id=f"wf-pub-{asset_code.lower()}",
        )
        db.add(project)
        await db.flush()

    requires_hitl = mode == "PUBLISH_NOW" or (mode == "SCHEDULED" and body.auto_publish)
    sec_mgr = HITLSecurityManager()
    approval_token: str | None = body.hitl_token
    if requires_hitl and not approval_token:
        ttl_seconds = _compute_scheduled_hitl_ttl(scheduled_utc)
        issued = sec_mgr.issue_hitl_token(
            project_id=str(project.id),
            tier=3,
            action="publish_all_channels",
            actor="creator",
            ttl_seconds=ttl_seconds,
        )
        approval_token = issued["token"]

    unique_channels = list(dict.fromkeys(body.channels))
    created_posts: list[SocialPost] = []
    publications: list[dict[str, Any]] = []
    ip_addr = request.client.host if request.client else "127.0.0.1"

    for ch in unique_channels:
        override = (
            body.per_channel_overrides.get(ch.value)
            or body.per_channel_overrides.get(ch.value.lower())
            or {}
        )
        ch_title = override.get("title") if "title" in override and override.get("title") is not None else body.title
        ch_body = str(override.get("post_body") or body.post_body)
        ch_first_comment = (
            override.get("first_comment") if "first_comment" in override else body.first_comment
        )

        post_payload = {
            "title": ch_title,
            "post_body": ch_body,
            "first_comment": ch_first_comment,
            "hashtags": body.hashtags,
            "metadata_payload": {
                "visual_mode": body.visual_mode,
                "media_url": body.media_url,
                "auto_first_comment": bool(ch_first_comment),
                "source": "publishing_composer",
            },
        }
        pf = validate_preflight(ch, post_payload)

        if mode == "DRAFT":
            pub_status = "DRAFT"
            auto_pub = body.auto_publish
        elif mode == "MANUAL_REMINDER":
            pub_status = "MANUAL_REMINDER"
            auto_pub = False
        elif mode == "SCHEDULED":
            pub_status = "SCHEDULED"
            auto_pub = body.auto_publish
        else:
            pub_status = "SCHEDULED"
            auto_pub = True

        sp = SocialPost(
            project_id=project.id,
            channel=ch.value,
            title=ch_title,
            post_body=ch_body,
            first_comment=ch_first_comment,
            hashtags=body.hashtags,
            metadata_payload=post_payload["metadata_payload"],
            preflight_warnings=pf.warnings + pf.blocking_errors,
            preflight_passed=pf.passed,
            publish_status=pub_status,
            scheduled_at=scheduled_utc,
            hitl_approval_token=approval_token,
            auto_publish=auto_pub,
            timezone=body.timezone or "Europe/Madrid",
        )
        db.add(sp)
        await db.flush()

        paused_until = await get_channel_pause_until(db, ch.value) if mode == "PUBLISH_NOW" else None
        if paused_until is not None:
            pause_msg = channel_pause_message(ch.value, paused_until)
            sp.publish_status = "FAILED"
            sp.publish_error = pause_msg
            publications.append(
                {
                    "channel": ch.value,
                    "status": RATE_LIMITED_STATUS,
                    "error": pause_msg,
                    "retry_after": max(1, int((paused_until - datetime.now(timezone.utc)).total_seconds())),
                }
            )
        elif mode == "PUBLISH_NOW":
            eff_token, eff_urn, _, _ = await _get_effective_social_credential(db, ch.value.lower())
            connector = get_connector_for_channel(
                ch,
                access_token_override=eff_token or None,
                person_urn_override=eff_urn or None,
            )
            try:
                pub_res = await connector.publish(
                    project_id=str(project.id),
                    payload=post_payload,
                    hitl_token=approval_token,
                    actor="creator",
                    security_manager=sec_mgr,
                )
                if pub_res.get("status") != "PUBLISHED":
                    raise SocialPublishError(
                        str(pub_res.get("message") or f"{ch.value}: no publicado ({pub_res.get('status')}).")
                    )
                sp.external_platform_id = pub_res["external_platform_id"]
                sp.canonical_url = pub_res.get("canonical_url")
                sp.publish_status = "PUBLISHED"
                sp.published_at = datetime.now(timezone.utc)
                sp.publish_error = None
                publications.append(pub_res)

                await _record_audit(
                    db=db,
                    workspace_id=project.workspace_id,
                    project_id=project.id,
                    action_type=f"PUBLISH_{ch.value.upper()}",
                    agent_or_user_id="creator",
                    security_tier=3,
                    operation_status="SUCCESS",
                    hitl_token_id=approval_token,
                    payload=pub_res,
                    ip_source=ip_addr,
                )
                # Persist each live publication at once so nothing later can lose it.
                await db.commit()
            except SocialRateLimitError as exc:
                resume_at = register_channel_pause(ch.value, exc.retry_after)
                sp.publish_status = "FAILED"
                sp.publish_error = f"{exc} Se podrá reintentar a partir de {resume_at.isoformat()}."
                publications.append(
                    {
                        "channel": ch.value,
                        "status": RATE_LIMITED_STATUS,
                        "error": str(exc),
                        "retry_after": int(exc.retry_after),
                    }
                )
                await _record_audit(
                    db=db,
                    workspace_id=project.workspace_id,
                    project_id=project.id,
                    action_type=f"PUBLISH_{ch.value.upper()}",
                    agent_or_user_id="creator",
                    security_tier=3,
                    operation_status=RATE_LIMITED_STATUS,
                    hitl_token_id=approval_token,
                    payload=rate_limit_audit_payload(ch.value, str(exc), exc.retry_after, resume_at),
                    ip_source=ip_addr,
                )
            except Exception as exc:
                resp = getattr(exc, "response", None)
                err_msg = (
                    f"Error API {ch.value} ({resp.status_code}): {resp.text[:300]}"
                    if resp is not None
                    else str(exc)
                )
                sp.publish_status = "FAILED"
                sp.publish_error = err_msg
                publications.append({"channel": ch.value, "status": "FAILED", "error": err_msg})
                await _record_audit(
                    db=db,
                    workspace_id=project.workspace_id,
                    project_id=project.id,
                    action_type=f"PUBLISH_{ch.value.upper()}",
                    agent_or_user_id="creator",
                    security_tier=3,
                    operation_status="FAILED",
                    hitl_token_id=approval_token,
                    payload={"error": err_msg},
                    ip_source=ip_addr,
                )

        created_posts.append(sp)

    if mode == "PUBLISH_NOW" and all(p.publish_status == "PUBLISHED" for p in created_posts):
        project.current_state = FSMState.PUBLISHED_LIVE.value

    if mode != "PUBLISH_NOW":
        await _record_audit(
            db=db,
            workspace_id=project.workspace_id,
            project_id=project.id,
            action_type=f"COMPOSER_{mode}_POSTS",
            agent_or_user_id="creator",
            security_tier=3 if requires_hitl else 1,
            operation_status="SUCCESS",
            hitl_token_id=approval_token,
            payload={
                "channels": [c.value for c in unique_channels],
                "scheduled_at": scheduled_utc.isoformat() if scheduled_utc else None,
                "auto_publish": body.auto_publish,
            },
            ip_source=ip_addr,
        )

    await db.commit()
    for sp in created_posts:
        await db.refresh(sp)

    serialized = [_serialize_social_post(sp, project).model_dump(mode="json") for sp in created_posts]
    await broadcaster.broadcast(
        "PUBLISHING_POSTS_CREATED",
        {"created_count": len(serialized), "mode": mode, "project_id": str(project.id)},
    )
    return {
        "created_count": len(serialized),
        "posts": serialized,
        "publications": publications,
    }


@router.patch("/publishing/schedule/{post_id}", response_model=SocialPostResponse)
async def reschedule_publishing_post(
    post_id: uuid.UUID,
    body: ScheduleUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SocialPostResponse:
    """Reschedule a post (drag & drop), toggle auto_publish, and renew Tier 3 HITL token if needed."""
    post = (await db.execute(select(SocialPost).where(SocialPost.id == post_id))).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Social post not found.")

    project = (
        await db.execute(select(ContentProject).where(ContentProject.id == post.project_id))
    ).scalar_one_or_none()

    if "timezone" in body.model_fields_set and body.timezone:
        post.timezone = body.timezone.strip()
    if "auto_publish" in body.model_fields_set and body.auto_publish is not None:
        post.auto_publish = body.auto_publish
    if "scheduled_at" in body.model_fields_set:
        post.scheduled_at = _normalize_dt_utc(body.scheduled_at, post.timezone)
    if "publish_status" in body.model_fields_set and body.publish_status:
        allowed_statuses = {"DRAFT", "SCHEDULED", "MANUAL_REMINDER", "READY_FOR_HITL", "PUBLISHED", "FAILED"}
        if body.publish_status not in allowed_statuses:
            raise HTTPException(status_code=400, detail=f"Estado inválido: {body.publish_status}")
        post.publish_status = body.publish_status

    if post.publish_status == "SCHEDULED" and post.auto_publish:
        if post.scheduled_at is None:
            raise HTTPException(
                status_code=400,
                detail="scheduled_at es obligatorio cuando el estado es SCHEDULED con auto_publish.",
            )
        scheduled_utc = _normalize_dt_utc(post.scheduled_at, post.timezone)
        assert scheduled_utc is not None
        sec_mgr = HITLSecurityManager()
        action = f"publish_{post.channel.lower()}"

        if body.hitl_token:
            post.hitl_approval_token = body.hitl_token
        else:
            needs_new_token = not post.hitl_approval_token
            if post.hitl_approval_token:
                verif = sec_mgr.verify_hitl_token(
                    token=post.hitl_approval_token,
                    project_id=str(post.project_id),
                    required_tier=3,
                    action=action,
                    actor="creator",
                )
                if not verif.valid or int(scheduled_utc.timestamp()) + 3600 > verif.expires_at:
                    needs_new_token = True
            if needs_new_token:
                issued = sec_mgr.issue_hitl_token(
                    project_id=str(post.project_id),
                    tier=3,
                    action="publish_all_channels",
                    actor="creator",
                    ttl_seconds=_compute_scheduled_hitl_ttl(scheduled_utc),
                )
                post.hitl_approval_token = issued["token"]

    if project is not None:
        await _record_audit(
            db=db,
            workspace_id=project.workspace_id,
            project_id=project.id,
            action_type="RESCHEDULE_SOCIAL_POST",
            agent_or_user_id="creator",
            security_tier=3 if (post.publish_status == "SCHEDULED" and post.auto_publish) else 1,
            operation_status="SUCCESS",
            hitl_token_id=post.hitl_approval_token,
            payload={
                "post_id": str(post.id),
                "scheduled_at": post.scheduled_at.isoformat() if post.scheduled_at else None,
                "auto_publish": post.auto_publish,
                "publish_status": post.publish_status,
            },
            ip_source=request.client.host if request.client else "127.0.0.1",
        )

    await db.commit()
    await db.refresh(post)
    return _serialize_social_post(post, project)


@router.delete("/publishing/posts/{post_id}")
async def delete_publishing_post(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    post = (await db.execute(select(SocialPost).where(SocialPost.id == post_id))).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Social post not found.")
    await db.delete(post)
    await db.commit()
    return {"deleted": True, "post_id": str(post_id)}


@router.get("/publishing/best-times", response_model=BestTimeHeatmapResponse)
async def get_publishing_best_times(
    channel: str = "LinkedIn",
    tz_param: str = Query(default="Europe/Madrid", alias="timezone"),
    db: AsyncSession = Depends(get_db),
) -> BestTimeHeatmapResponse:
    """Return 7x24 Best Time to Post audience heatmap combining DB snapshots and channel curves."""
    canonical = _canonical_channel_name(channel)
    snapshots = (
        (
            await db.execute(
                select(PerformanceSnapshot)
                .join(SocialPost, PerformanceSnapshot.social_post_id == SocialPost.id)
                .where(SocialPost.channel == canonical)
            )
        )
        .scalars()
        .all()
    )
    return compute_best_time_heatmap(channel=canonical, snapshots=list(snapshots), tz=tz_param)


@router.get("/publishing/autolists", response_model=list[AutolistResponse])
async def list_autolists(db: AsyncSession = Depends(get_db)) -> list[AutolistResponse]:
    rows = (
        (
            await db.execute(
                select(Autolist)
                .options(selectinload(Autolist.items))
                .order_by(desc(Autolist.created_at))
            )
        )
        .scalars()
        .all()
    )
    return [AutolistResponse.model_validate(r) for r in rows]


@router.post("/publishing/autolists", response_model=AutolistResponse)
async def create_autolist(
    body: AutolistCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> AutolistResponse:
    ws = await _get_default_workspace(db)
    al = Autolist(
        workspace_id=ws.id,
        name=body.name.strip(),
        description=body.description.strip(),
        channels=[_canonical_channel_name(c) for c in body.channels],
        schedule_slots=body.schedule_slots,
        timezone=body.timezone or "Europe/Madrid",
        is_active=body.is_active,
        repeat_loop=body.repeat_loop,
    )
    db.add(al)
    await db.commit()
    loaded = await _load_autolist(db, al.id)
    return AutolistResponse.model_validate(loaded)


@router.put("/publishing/autolists/{autolist_id}", response_model=AutolistResponse)
async def update_autolist(
    autolist_id: uuid.UUID,
    body: AutolistUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> AutolistResponse:
    al = await _load_autolist(db, autolist_id)
    if body.name is not None:
        al.name = body.name.strip()
    if body.description is not None:
        al.description = body.description.strip()
    if body.channels is not None:
        al.channels = [_canonical_channel_name(c) for c in body.channels]
    if body.schedule_slots is not None:
        al.schedule_slots = body.schedule_slots
    if body.timezone is not None:
        al.timezone = body.timezone.strip() or "Europe/Madrid"
    if body.is_active is not None:
        al.is_active = body.is_active
    if body.repeat_loop is not None:
        al.repeat_loop = body.repeat_loop

    await db.commit()
    loaded = await _load_autolist(db, al.id)
    return AutolistResponse.model_validate(loaded)


@router.delete("/publishing/autolists/{autolist_id}")
async def delete_autolist(
    autolist_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    al = (await db.execute(select(Autolist).where(Autolist.id == autolist_id))).scalar_one_or_none()
    if not al:
        raise HTTPException(status_code=404, detail="Autolist not found.")
    await db.delete(al)
    await db.commit()
    return {"deleted": True, "autolist_id": str(autolist_id)}


@router.post("/publishing/autolists/{autolist_id}/items", response_model=AutolistItemResponse)
async def add_autolist_item(
    autolist_id: uuid.UUID,
    body: AutolistItemCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> AutolistItemResponse:
    al = await _load_autolist(db, autolist_id)
    if body.project_id is not None:
        proj = (
            await db.execute(select(ContentProject).where(ContentProject.id == body.project_id))
        ).scalar_one_or_none()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found.")

    next_pos = body.position
    if next_pos is None:
        next_pos = max((it.position for it in al.items), default=-1) + 1

    item = AutolistItem(
        autolist_id=al.id,
        project_id=body.project_id,
        title=body.title,
        post_body=body.post_body,
        first_comment=body.first_comment,
        media_url=body.media_url,
        position=next_pos,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return AutolistItemResponse.model_validate(item)


@router.delete("/publishing/autolists/{autolist_id}/items/{item_id}")
async def delete_autolist_item(
    autolist_id: uuid.UUID,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    item = (
        await db.execute(
            select(AutolistItem).where(
                AutolistItem.id == item_id,
                AutolistItem.autolist_id == autolist_id,
            )
        )
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Autolist item not found.")
    await db.delete(item)
    await db.commit()
    return {"deleted": True, "item_id": str(item_id)}


@router.post("/publishing/scheduler/tick")
async def trigger_publishing_scheduler_tick(
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Manually trigger one scheduler pass to dispatch due scheduled posts."""
    results = await run_due_scheduled_posts(db)
    return {"processed_count": len(results), "results": results}




