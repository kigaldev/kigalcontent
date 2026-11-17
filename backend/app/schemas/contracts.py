"""Strict Pydantic v2 data contracts for Autonomous Content Engine."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DurationPreset(str, Enum):
    MICRO_SHORT = "MICRO_SHORT"        # 15-30s | 40-75 words | cuts 1.5-2.5s
    STANDARD_SHORT = "STANDARD_SHORT"  # 45-60s | 110-150 words | cuts 3-5s
    EXTENDED_SHORT = "EXTENDED_SHORT"  # 90-180s | 220-380 words | cuts 5-8s
    LONG_FORM = "LONG_FORM"            # 8-12m | 1,200-1,700 words | cuts 15-30s


class ConversionGoal(str, Enum):
    EMAIL_LEAD_CAPTURE = "EMAIL_LEAD_CAPTURE"
    B2B_INBOUND_CONVERSATION = "B2B_INBOUND_CONVERSATION"
    RELATIONAL_DISTRIBUTION_SHARES = "RELATIONAL_DISTRIBUTION_SHARES"
    PLATFORM_RETENTION_LOOP = "PLATFORM_RETENTION_LOOP"


class FSMState(str, Enum):
    INIT = "INIT"
    CAPTURED = "CAPTURED"
    RESEARCHED_TRIAGED = "RESEARCHED_TRIAGED"
    SCRIPTED_PACKAGED = "SCRIPTED_PACKAGED"
    HITL_PENDING_PRODUCTION = "HITL_PENDING_PRODUCTION"
    PRODUCED_VALIDATED = "PRODUCED_VALIDATED"
    HITL_PENDING_PUBLISH = "HITL_PENDING_PUBLISH"
    PUBLISHED_LIVE = "PUBLISHED_LIVE"
    AUDITED_CLOSED_LOOP = "AUDITED_CLOSED_LOOP"
    REJECTED_REVISION = "REJECTED_REVISION"
    ARCHIVED = "ARCHIVED"


class SocialChannel(str, Enum):
    YOUTUBE = "YouTube"
    INSTAGRAM = "Instagram"
    TIKTOK = "TikTok"
    LINKEDIN = "LinkedIn"


class TAMClassification(str, Enum):
    CORE_80 = "CORE_80"
    EXPANSION_20 = "EXPANSION_20"


# --- Creator Profile (Context Engine) ---

class ConversionGoalSpec(BaseModel):
    objective: str
    lead_magnet_name: str | None = None
    lead_magnet_format: str | None = None
    trigger_word: str | None = None
    automation_backend: str | None = None
    preferred_cta_style: str


class SocialAccountItem(BaseModel):
    id: str
    platform: str  # youtube, instagram, tiktok, linkedin, website, github, x, other
    label: str = ""
    url: str


class GitHubRepoItem(BaseModel):
    repo_full_name: str
    repo_url: str
    description: str = ""
    primary_language: str | None = None
    topics: list[str] = Field(default_factory=list)
    homepage: str | None = None
    added_at: str | None = None


class LeadMagnetItem(BaseModel):
    id: str
    title: str
    description: str = ""
    format: str = "Guía PDF"
    delivery_url: str = ""
    source: str = "manual"  # manual or github:<repo>
    created_at: str | None = None


class ManyChatTriggerRule(BaseModel):
    id: str
    keyword: str
    lead_magnet_id: str | None = None
    platform: str = "all"  # all, instagram, tiktok, youtube, linkedin
    dm_reply_template: str = ""
    manychat_flow_id: str | None = None
    active: bool = True
    triggers_count: int = 0


class CreatorProfileSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    creator_id: str = "CR-001"
    name: str
    age: int | None = None
    personal_brand_tagline: str | None = None
    niche: str
    ideal_customer_profile: str
    project_context: str | None = None
    strategic_goals: list[str] = Field(default_factory=list)
    communication_style: str | None = None
    visual_style: str | None = None
    content_pillars: list[str] = Field(default_factory=list)
    conversion_goals_catalog: dict[str, ConversionGoalSpec] = Field(default_factory=dict)
    active_conversion_goal: ConversionGoal = ConversionGoal.EMAIL_LEAD_CAPTURE
    social_profiles: dict[str, str] = Field(default_factory=dict)
    social_accounts: list[SocialAccountItem] = Field(default_factory=list)
    github_repos: list[GitHubRepoItem] = Field(default_factory=list)
    lead_magnets: list[LeadMagnetItem] = Field(default_factory=list)
    manychat_triggers: list[ManyChatTriggerRule] = Field(default_factory=list)
    voice_guidelines: str | None = None


class CreatorProfileUpdateRequest(BaseModel):
    name: str | None = None
    age: int | None = None
    personal_brand_tagline: str | None = None
    niche: str | None = None
    ideal_customer_profile: str | None = None
    project_context: str | None = None
    strategic_goals: list[str] | None = None
    communication_style: str | None = None
    visual_style: str | None = None
    content_pillars: list[str] | None = None
    active_conversion_goal: ConversionGoal | None = None
    conversion_goals_catalog: dict[str, ConversionGoalSpec] | None = None
    social_profiles: dict[str, str] | None = None
    social_accounts: list[SocialAccountItem] | None = None
    github_repos: list[GitHubRepoItem] | None = None
    lead_magnets: list[LeadMagnetItem] | None = None
    manychat_triggers: list[ManyChatTriggerRule] | None = None
    voice_guidelines: str | None = None


class GitHubImportRequest(BaseModel):
    repo_url_or_slug: str = Field(..., min_length=3, max_length=300)
    github_token: str | None = None


class GitHubImportResponse(BaseModel):
    repo_full_name: str
    repo_url: str
    description: str
    primary_language: str | None = None
    topics: list[str] = Field(default_factory=list)
    readme_excerpt: str = ""
    suggested_niche: str = ""
    suggested_project_context: str = ""
    suggested_content_pillars: list[str] = Field(default_factory=list)
    suggested_tagline: str = ""
    suggested_name: str = ""
    suggested_icp: str = ""
    suggested_strategic_goals: list[str] = Field(default_factory=list)
    suggested_communication_style: str = "Educativo y Didáctico"
    suggested_visual_style: str = "Tecnológico / Neón Dinámico"
    suggested_voice_guidelines: str = ""
    homepage: str | None = None
    extracted_lead_magnets: list[LeadMagnetItem] = Field(default_factory=list)


class GitHubBatchImportRequest(BaseModel):
    repos: list[GitHubImportRequest] = Field(..., min_length=1, max_length=5)


class GitHubBatchImportResponse(BaseModel):
    imported_repos: list[GitHubRepoItem] = Field(default_factory=list)
    suggested_name: str = ""
    suggested_tagline: str = ""
    suggested_niche: str = ""
    suggested_icp: str = ""
    suggested_project_context: str = ""
    suggested_strategic_goals: list[str] = Field(default_factory=list)
    suggested_communication_style: str = "Educativo y Didáctico"
    suggested_visual_style: str = "Tecnológico / Neón Dinámico"
    suggested_content_pillars: list[str] = Field(default_factory=list)
    suggested_voice_guidelines: str = ""
    suggested_social_accounts: list[SocialAccountItem] = Field(default_factory=list)
    extracted_lead_magnets: list[LeadMagnetItem] = Field(default_factory=list)


class ManyChatTriggerRequest(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=100)
    platform: str = Field(default="instagram")
    username: str = Field(default="@usuario")
    comment_text: str | None = None


class ManyChatTriggerResponse(BaseModel):
    matched: bool
    keyword: str
    platform: str
    lead_magnet: LeadMagnetItem | None = None
    public_comment_reply: str = ""
    dm_reply_text: str
    delivery_url: str = ""
    manychat_flow_id: str | None = None
    triggers_count: int = 0


class KigalChatInteraction(BaseModel):
    id: str
    timestamp: str
    platform: str
    username: str
    comment_text: str
    matched_keyword: str
    public_comment_reply: str
    dm_reply_text: str
    lead_magnet_title: str
    delivery_url: str = ""
    status: str = "DELIVERED"


class KigalChatAutoSweepResponse(BaseModel):
    processed_count: int
    interactions: list[KigalChatInteraction] = Field(default_factory=list)



# --- ICE Scorer & Research ---

class ICEScoreRequest(BaseModel):
    concept_title: str = Field(..., min_length=3, max_length=500)
    source_origin: str = Field(default="manual")
    impact: float = Field(..., ge=1.0, le=10.0)
    confidence: float = Field(..., ge=1.0, le=10.0)
    ease: float = Field(..., ge=1.0, le=10.0)
    tam_classification: TAMClassification = TAMClassification.CORE_80


class HookCandidate(BaseModel):
    category: str
    hook_text: str
    pattern_interrupt: str
    estimated_hold_rate: float


class ICEScoreResponse(BaseModel):
    idea_id: UUID | None = None
    concept_title: str
    impact: float
    confidence: float
    ease: float
    ice_score: float
    ice_multiplicative: float
    status: str
    threshold_met: bool
    tam_classification: TAMClassification
    hook_candidates: list[HookCandidate] = Field(default_factory=list)


# --- Two-Column Script Studio ---

class TwoColumnScriptBlock(BaseModel):
    block_id: str
    section_label: str
    timecode: str
    visual_direction: str
    b_roll_cue: str
    on_screen_text: str
    audio_voiceover: str
    sfx_cue: str = ""
    music_cue: str = ""
    pattern_interrupt_sec: float = 3.0
    word_count: int = 0
    estimated_seconds: float = 0.0
    pacing_warning: bool = False


class ABPackagingVariant(BaseModel):
    variant_label: str
    title: str
    thumbnail_concept: str
    thumbnail_dimensions: str = "1280x720"
    hypothesis: str = ""


class ScriptGenerateRequest(BaseModel):
    project_id: UUID
    duration_preset: DurationPreset = DurationPreset.STANDARD_SHORT
    conversion_goal: ConversionGoal = ConversionGoal.EMAIL_LEAD_CAPTURE
    wpm_rate: int = Field(default=140, ge=130, le=150)
    topic_override: str | None = None
    custom_blocks: list[TwoColumnScriptBlock] | None = None


class ScriptUpdateRequest(BaseModel):
    duration_preset: DurationPreset | None = None
    conversion_goal: ConversionGoal | None = None
    wpm_rate: int = Field(default=140, ge=130, le=150)
    two_column_blocks: list[TwoColumnScriptBlock]
    selected_hook_index: int = Field(default=0, ge=0)
    ab_variants: list[ABPackagingVariant] | None = None


class ScriptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    script_version: int
    duration_preset: DurationPreset
    conversion_goal: ConversionGoal
    wpm_rate: int
    two_column_blocks: list[TwoColumnScriptBlock]
    hook_variants: list[HookCandidate]
    selected_hook_index: int
    cta_text: str
    word_count: int
    estimated_duration_sec: float
    target_word_range: tuple[int, int]
    target_duration_range_sec: tuple[int, int]
    pattern_interrupt_interval_sec: tuple[float, float]
    within_budget: bool
    created_at: datetime


# --- Projects & FSM Transitions ---

class ProjectCreateRequest(BaseModel):
    working_title: str = Field(..., min_length=3, max_length=255)
    target_duration: DurationPreset = DurationPreset.STANDARD_SHORT
    conversion_goal: ConversionGoal = ConversionGoal.EMAIL_LEAD_CAPTURE
    tam_classification: TAMClassification = TAMClassification.CORE_80
    impact: float = Field(default=8.5, ge=1.0, le=10.0)
    confidence: float = Field(default=8.0, ge=1.0, le=10.0)
    ease: float = Field(default=7.5, ge=1.0, le=10.0)
    auto_generate_script: bool = True


class FSMTransitionRequest(BaseModel):
    target_state: FSMState
    agent_or_user: str = Field(default="Creator")
    hitl_token: str | None = None
    reason: str | None = None


class ProjectSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_code: str
    working_title: str
    target_duration: DurationPreset
    conversion_goal: ConversionGoal
    current_state: FSMState
    ice_score: float
    tam_classification: TAMClassification
    ab_variants: list[ABPackagingVariant] = Field(default_factory=list)
    state_history: list[dict[str, Any]] = Field(default_factory=list)
    temporal_workflow_id: str | None = None
    created_at: datetime
    updated_at: datetime


# --- HITL Governance ---

class HITLTokenIssueRequest(BaseModel):
    project_id: str
    tier: int = Field(..., ge=2, le=3)
    action: str
    actor: str = Field(default="creator")
    two_factor_code: str | None = None


class HITLTokenIssueResponse(BaseModel):
    token: str
    project_id: str
    tier: int
    action: str
    actor: str
    expires_at: int


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID | None = None
    action_type: str
    agent_or_user_id: str
    security_tier: int
    operation_status: str
    hitl_token_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    ip_source: str | None = None
    created_at: datetime


# --- Media Pipeline & S3 Multipart ---

class S3MultipartInitRequest(BaseModel):
    project_id: UUID
    filename: str
    content_type: str = "video/mp4"
    part_count: int = Field(default=1, ge=1, le=100)


class S3MultipartInitResponse(BaseModel):
    upload_id: str
    object_key: str
    bucket: str
    presigned_part_urls: list[dict[str, Any]]
    download_url: str


class MediaProcessRequest(BaseModel):
    project_id: UUID
    raw_media_url: str
    silence_noise_db: float = Field(default=-35.0, le=-10.0, ge=-70.0)
    min_silence_duration_sec: float = Field(default=0.4, ge=0.2, le=2.0)
    target_lufs: float = Field(default=-14.0, ge=-24.0, le=-8.0)
    subtitle_y_percent: int = Field(default=55, ge=25, le=70)
    generate_demo_source_if_missing: bool = True
    target_platform_signature: str = Field(default="Instagram")


class WordTimestamp(BaseModel):
    word: str
    start_ms: int
    end_ms: int
    confidence: float = 0.98


class MediaQCReport(BaseModel):
    video_asset_id: UUID | None = None
    project_id: UUID | str
    raw_media_url: str
    master_media_url: str
    thumbnail_a_url: str | None = None
    thumbnail_b_url: str | None = None
    silences_trimmed: int
    silence_intervals: list[dict[str, float]] = Field(default_factory=list)
    measured_lufs: float
    true_peak_dbfs: float
    lufs_within_ebu_r128: bool
    resolution: str = "1080x1920"
    fps: float = 30.0
    transcription_words: list[WordTimestamp] = Field(default_factory=list)
    ass_subtitles_preview: str = ""
    qc_passed: bool
    native_signature_profile: dict[str, str] = Field(default_factory=dict)


# --- Social Copycrafting & Publishing ---

class SocialCopyGenerateRequest(BaseModel):
    project_id: UUID
    headline: str
    core_value: str
    debate_question: str = "¿Crees que los sistemas reemplazan equipos o los multiplican?"
    thesis_points: list[str] = Field(default_factory=lambda: [
        "El volumen sin sistemas es una prisión operativa",
        "Automatiza la distribución antes de escalar equipo",
        "Mide Watch Time Share y Sends/Reach, no likes pasivos",
    ])
    chapters: list[dict[str, str]] = Field(default_factory=lambda: [
        {"time": "00:00", "title": "Gancho y tesis"},
        {"time": "00:18", "title": "Arquitectura operativa"},
        {"time": "00:45", "title": "Implementación y CTA"},
    ])
    conversion_goal: ConversionGoal | None = None


class PreflightCheckResult(BaseModel):
    platform: SocialChannel
    passed: bool
    warnings: list[str] = Field(default_factory=list)
    blocking_errors: list[str] = Field(default_factory=list)


class SocialPostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    channel: str
    external_platform_id: str | None = None
    canonical_url: str | None = None
    title: str | None = None
    post_body: str
    first_comment: str | None = None
    hashtags: list[str] = Field(default_factory=list)
    metadata_payload: dict[str, Any] = Field(default_factory=dict)
    preflight_warnings: list[str] = Field(default_factory=list)
    preflight_passed: bool
    publish_status: str
    hitl_approval_token: str | None = None
    published_at: datetime | None = None


class SocialPublishExecuteRequest(BaseModel):
    project_id: UUID
    channels: list[SocialChannel]
    hitl_token: str | None = None
    actor: str = "creator"


# --- Closed-Loop Analytics & RMT-A ---

class WatchTimeShareVariant(BaseModel):
    impressions: float = Field(..., ge=0)
    ctr_pct: float = Field(..., ge=0, le=100)
    avd_seconds: float = Field(..., ge=0)


class WatchTimeShareRequest(BaseModel):
    variant_a: WatchTimeShareVariant
    variant_b: WatchTimeShareVariant


class WatchTimeShareResponse(BaseModel):
    variant_a_watch_time_seconds: float
    variant_b_watch_time_seconds: float
    share_a_pct: float
    share_b_pct: float
    winner: str
    delta_pct: float
    explanation: str


class RMTADiagnosisRequest(BaseModel):
    project_id: UUID | None = None
    social_post_id: UUID | None = None
    window_type: str = Field(default="7d", pattern="^(24h|7d|30d)$")
    views: int = Field(..., ge=0)
    baseline_views: float = Field(..., gt=0)
    hold_rate_3s: float = Field(..., ge=0, le=100)
    completion_rate: float = Field(..., ge=0, le=100)
    sends_per_reach: float = Field(default=1.5, ge=0, le=100)
    dwell_time_seconds: float = Field(default=28.0, ge=0)
    watch_time_share: float = Field(default=55.0, ge=0, le=100)
    consecutive_bottom_quartile_iterations: int = Field(default=0, ge=0)
    persist_rule: bool = True


class RMTADiagnosisResponse(BaseModel):
    views_factor_vs_baseline: float
    is_outlier_positive: bool
    is_outlier_negative: bool
    diagnosis_layer: str
    rmta_classification: str
    recommended_action: str
    sends_social_value_sufficient: bool
    four_layer_breakdown: dict[str, dict[str, Any]]
    learned_rule_statement: str


# --- Google Drive & Infrastructure Connections ---

class GoogleDriveScanRequest(BaseModel):
    folder_url_or_id: str


class GoogleDriveFileItem(BaseModel):
    file_id: str
    name: str
    mime_type: str = "video/mp4"
    size_bytes: int = 0
    web_view_link: str
    thumbnail_link: str | None = None
    source: str = "google_drive"


class GoogleDriveScanResponse(BaseModel):
    folder_id: str
    files: list[GoogleDriveFileItem]


class GoogleDriveImportRequest(BaseModel):
    project_id: UUID
    file_url_or_id: str
    script_text_hint: str | None = None
    auto_process: bool = True


class InfrastructureServiceStatus(BaseModel):
    service_name: str
    status: str  # "CONNECTED" | "SANDBOX_MOCK" | "MISSING_CREDENTIALS"
    provider: str
    details: str
    action_required: str | None = None


class SystemConnectionsStatusResponse(BaseModel):
    all_ready_for_production: bool
    database: InfrastructureServiceStatus
    storage: InfrastructureServiceStatus
    cache: InfrastructureServiceStatus
    google_drive: InfrastructureServiceStatus
    media_worker: InfrastructureServiceStatus
    social_channels: dict[str, InfrastructureServiceStatus]


# --- Hybrid Skill-Aware LLM Router ---

class LLMProviderMode(str, Enum):
    AUTO = "auto"
    OLLAMA = "ollama"
    ANTHROPIC = "anthropic"
    OPENAI_COMPATIBLE = "openai_compatible"
    DETERMINISTIC = "deterministic"


class LoadedSkillAgentSpec(BaseModel):
    agent_id: str
    filename: str
    title: str
    char_count: int
    estimated_tokens: int


class RecommendedLocalModel(BaseModel):
    tier_ram: str  # "24GB" | "48GB"
    model_id: str
    pull_command: str
    ram_usage_gb: str
    role: str
    spanish_quality: str
    recommended: bool = False


class LLMConfigResponse(BaseModel):
    active_provider: LLMProviderMode
    effective_provider: str
    ollama_base_url: str
    ollama_model: str
    ollama_embedding_model: str
    anthropic_model: str
    anthropic_prompt_caching_enabled: bool = True
    anthropic_key_configured: bool = False
    openai_compatible_base_url: str
    openai_compatible_model: str
    openai_compatible_key_configured: bool = False
    loaded_skills: list[LoadedSkillAgentSpec] = Field(default_factory=list)
    recommended_local_models: list[RecommendedLocalModel] = Field(default_factory=list)


class LLMConfigUpdateRequest(BaseModel):
    active_provider: LLMProviderMode | None = None
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    ollama_embedding_model: str | None = None
    anthropic_model: str | None = None
    anthropic_api_key: str | None = None
    openai_compatible_base_url: str | None = None
    openai_compatible_model: str | None = None
    openai_compatible_api_key: str | None = None


class LLMTestConnectionRequest(BaseModel):
    provider: LLMProviderMode | None = None
    ollama_base_url: str | None = None
    ollama_model: str | None = None


class LLMTestConnectionResponse(BaseModel):
    reachable: bool
    provider: str
    active_model: str
    installed_models: list[str] = Field(default_factory=list)
    latency_ms: float = 0.0
    sample_output: str = ""
    fallback_used: bool = False
    message: str = ""


class N8nWorkflowTemplateResponse(BaseModel):
    workflow_id: str
    filename: str
    name: str
    trigger_type: str
    schedule_or_webhook: str
    description: str
    endpoints_used: list[str] = Field(default_factory=list)
    workflow_json: dict[str, Any] = Field(default_factory=dict)


# --- Paid Ads Campaign Engine (Meta Ads, Google Ads Search/YouTube & Remotion) ---

class AdCampaignGenerateRequest(BaseModel):
    project_id: str | None = None
    topic: str
    platforms: list[str] = Field(default_factory=lambda: ["Meta Ads", "Google Ads"])
    objective: str = "Leads / ManyChat"
    target_url: str = ""
    trigger_keyword: str = "GUIA"


class AdCreativeVariant(BaseModel):
    variant_id: str
    angle_name: str
    framework: str
    primary_text: str
    headline: str
    description: str
    cta_button: str
    remotion_916_storyboard: list[dict[str, str]]


class GoogleRSASpec(BaseModel):
    headlines: list[str]
    descriptions: list[str]
    search_keywords_exact: list[str]
    search_keywords_phrase: list[str]
    search_keywords_negative: list[str]
    youtube_5s_hook: str


class AdCampaignResponse(BaseModel):
    topic: str
    objective: str
    platforms: list[str]
    variants: list[AdCreativeVariant]
    google_rsa: GoogleRSASpec
    ga4_utm_links: list[dict[str, str]]



