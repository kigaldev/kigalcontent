"""SQLAlchemy 2.0 ORM Models for Autonomous Content Engine."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class EmbeddingVector(TypeDecorator):
    """Uses pgvector Vector(1536) on PostgreSQL and JSON array on SQLite."""

    impl = JSON
    cache_ok = True

    def __init__(self, dimensions: int = 1536) -> None:
        super().__init__()
        self.dimensions = dimensions

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(Vector(self.dimensions))
        return dialect.type_descriptor(JSON())


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan_tier: Mapped[str] = mapped_column(String(50), nullable=False, default="PRO")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    creator_profiles: Mapped[list[CreatorProfile]] = relationship(back_populates="workspace", cascade="all, delete-orphan")
    ideas: Mapped[list[Idea]] = relationship(back_populates="workspace", cascade="all, delete-orphan")
    projects: Mapped[list[ContentProject]] = relationship(back_populates="workspace", cascade="all, delete-orphan")
    hook_vault: Mapped[list[HookVaultEntry]] = relationship(back_populates="workspace", cascade="all, delete-orphan")


class CreatorProfile(Base):
    __tablename__ = "creator_profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    creator_code: Mapped[str] = mapped_column(String(50), nullable=False, default="CR-001")
    creator_name: Mapped[str] = mapped_column(String(255), nullable=False)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    personal_brand_tagline: Mapped[str | None] = mapped_column(Text, nullable=True)
    niche: Mapped[str] = mapped_column(String(255), nullable=False)
    target_icp: Mapped[str] = mapped_column(Text, nullable=False)
    project_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    strategic_goals: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    communication_style: Mapped[str | None] = mapped_column(String(255), nullable=True)
    visual_style: Mapped[str | None] = mapped_column(String(255), nullable=True)
    active_goal: Mapped[str] = mapped_column(String(64), nullable=False, default="EMAIL_LEAD_CAPTURE")
    content_pillars: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    conversion_goals_catalog: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    lead_magnets: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    social_profiles: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    voice_guidelines: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    workspace: Mapped[Workspace] = relationship(back_populates="creator_profiles")


class Idea(Base):
    __tablename__ = "ideas"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    concept_title: Mapped[str] = mapped_column(Text, nullable=False)
    source_origin: Mapped[str] = mapped_column(String(100), nullable=False, default="manual")
    impact_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    ease_score: Mapped[float] = mapped_column(Float, nullable=False)
    ice_score: Mapped[float] = mapped_column(Float, nullable=False)
    ice_multiplicative: Mapped[float] = mapped_column(Float, nullable=False)
    tam_classification: Mapped[str] = mapped_column(String(50), nullable=False, default="CORE_80")
    triage_status: Mapped[str] = mapped_column(String(50), nullable=False, default="UNPRIORITIZED")
    context_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_platforms: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    research_dossier: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    semantic_embedding: Mapped[list[float] | None] = mapped_column(EmbeddingVector(1536), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    workspace: Mapped[Workspace] = relationship(back_populates="ideas")


class ContentProject(Base):
    __tablename__ = "content_projects"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    idea_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("ideas.id", ondelete="SET NULL"), nullable=True)
    asset_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    working_title: Mapped[str] = mapped_column(String(255), nullable=False)
    target_duration: Mapped[str] = mapped_column(String(50), nullable=False, default="STANDARD_SHORT")
    conversion_goal: Mapped[str] = mapped_column(String(64), nullable=False, default="EMAIL_LEAD_CAPTURE")
    current_state: Mapped[str] = mapped_column(String(50), nullable=False, default="INIT")
    ice_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    tam_classification: Mapped[str] = mapped_column(String(50), nullable=False, default="CORE_80")
    context_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_origin: Mapped[str] = mapped_column(String(100), nullable=False, default="manual")
    target_platforms: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    content_format: Mapped[str] = mapped_column(String(50), nullable=False, default="TEXT_AND_VIDEO")
    ab_variants: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    state_history: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    temporal_workflow_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    workspace: Mapped[Workspace] = relationship(back_populates="projects")
    scripts: Mapped[list[Script]] = relationship(back_populates="project", cascade="all, delete-orphan")
    video_assets: Mapped[list[VideoAsset]] = relationship(back_populates="project", cascade="all, delete-orphan")
    social_posts: Mapped[list[SocialPost]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Script(Base):
    __tablename__ = "scripts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("content_projects.id", ondelete="CASCADE"), nullable=False)
    script_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    duration_preset: Mapped[str] = mapped_column(String(50), nullable=False, default="STANDARD_SHORT")
    conversion_goal: Mapped[str] = mapped_column(String(64), nullable=False, default="EMAIL_LEAD_CAPTURE")
    wpm_rate: Mapped[int] = mapped_column(Integer, nullable=False, default=140)
    two_column_blocks: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    hook_variants: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    selected_hook_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cta_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_duration_sec: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    project: Mapped[ContentProject] = relationship(back_populates="scripts")


class VideoAsset(Base):
    __tablename__ = "video_assets"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("content_projects.id", ondelete="CASCADE"), nullable=False)
    raw_media_url: Mapped[str] = mapped_column(Text, nullable=False)
    master_media_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_a_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_b_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    s3_upload_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    probe_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    transcription_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    silence_segments_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    silences_trimmed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    measured_lufs: Mapped[float | None] = mapped_column(Float, nullable=True)
    true_peak_dbfs: Mapped[float | None] = mapped_column(Float, nullable=True)
    ass_subtitles: Mapped[str | None] = mapped_column(Text, nullable=True)
    qc_passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    qc_report: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    project: Mapped[ContentProject] = relationship(back_populates="video_assets")


class SocialPost(Base):
    __tablename__ = "social_posts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("content_projects.id", ondelete="CASCADE"), nullable=False)
    channel: Mapped[str] = mapped_column(String(50), nullable=False)
    external_platform_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    canonical_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    post_body: Mapped[str] = mapped_column(Text, nullable=False)
    first_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    hashtags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    metadata_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    preflight_warnings: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    preflight_passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    publish_status: Mapped[str] = mapped_column(String(50), nullable=False, default="DRAFT")
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hitl_approval_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    project: Mapped[ContentProject] = relationship(back_populates="social_posts")
    snapshots: Mapped[list[PerformanceSnapshot]] = relationship(back_populates="social_post", cascade="all, delete-orphan")


class PerformanceSnapshot(Base):
    __tablename__ = "performance_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    social_post_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("social_posts.id", ondelete="CASCADE"), nullable=False)
    window_type: Mapped[str] = mapped_column(String(10), nullable=False)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hold_rate_3s: Mapped[float | None] = mapped_column(Float, nullable=True)
    completion_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    watch_time_share: Mapped[float | None] = mapped_column(Float, nullable=True)
    sends_per_reach: Mapped[float | None] = mapped_column(Float, nullable=True)
    dwell_time_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    outlier_multiplier: Mapped[float | None] = mapped_column(Float, nullable=True)
    retention_curve: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    diagnosis_layer: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rmta_classification: Mapped[str | None] = mapped_column(String(50), nullable=True)
    recommended_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    social_post: Mapped[SocialPost] = relationship(back_populates="snapshots")


class HookVaultEntry(Base):
    __tablename__ = "hook_vault"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    hook_text: Mapped[str] = mapped_column(Text, nullable=False)
    hook_type: Mapped[str] = mapped_column(String(100), nullable=False)
    verdict: Mapped[str] = mapped_column(String(50), nullable=False, default="TEST")
    observed_hold_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    semantic_vector: Mapped[list[float] | None] = mapped_column(EmbeddingVector(1536), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    workspace: Mapped[Workspace] = relationship(back_populates="hook_vault")


class LearnedRule(Base):
    __tablename__ = "learned_rules"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("content_projects.id", ondelete="SET NULL"), nullable=True)
    rmta_classification: Mapped[str] = mapped_column(String(50), nullable=False)
    diagnosis_layer: Mapped[str] = mapped_column(String(100), nullable=False)
    rule_statement: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("content_projects.id", ondelete="SET NULL"), nullable=True)
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    agent_or_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    security_tier: Mapped[int] = mapped_column(Integer, nullable=False)
    operation_status: Mapped[str] = mapped_column(String(50), nullable=False)
    hitl_token_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    ip_source: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class SocialCredential(Base):
    __tablename__ = "social_credentials"

    channel: Mapped[str] = mapped_column(String(50), primary_key=True)
    access_token: Mapped[str] = mapped_column(Text, nullable=False, default="")
    person_urn: Mapped[str | None] = mapped_column(String(255), nullable=True)
    account_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
