"""Initial enterprise schema with relational tables and pgvector indexes.

Revision ID: 0001_initial_enterprise
Revises:
Create Date: 2026-11-14
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

from app.models.entities import EmbeddingVector

revision = "0001_initial_enterprise"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"
    if is_postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "workspaces",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("plan_tier", sa.String(length=50), nullable=False, server_default="PRO"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "creator_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("creator_code", sa.String(length=50), nullable=False, server_default="CR-001"),
        sa.Column("creator_name", sa.String(length=255), nullable=False),
        sa.Column("personal_brand_tagline", sa.Text(), nullable=True),
        sa.Column("niche", sa.String(length=255), nullable=False),
        sa.Column("target_icp", sa.Text(), nullable=False),
        sa.Column("active_goal", sa.String(length=64), nullable=False, server_default="EMAIL_LEAD_CAPTURE"),
        sa.Column("content_pillars", sa.JSON(), nullable=False),
        sa.Column("conversion_goals_catalog", sa.JSON(), nullable=False),
        sa.Column("lead_magnets", sa.JSON(), nullable=False),
        sa.Column("social_profiles", sa.JSON(), nullable=False),
        sa.Column("voice_guidelines", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "ideas",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("concept_title", sa.Text(), nullable=False),
        sa.Column("source_origin", sa.String(length=100), nullable=False, server_default="manual"),
        sa.Column("impact_score", sa.Float(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("ease_score", sa.Float(), nullable=False),
        sa.Column("ice_score", sa.Float(), nullable=False),
        sa.Column("ice_multiplicative", sa.Float(), nullable=False),
        sa.Column("tam_classification", sa.String(length=50), nullable=False, server_default="CORE_80"),
        sa.Column("triage_status", sa.String(length=50), nullable=False, server_default="UNPRIORITIZED"),
        sa.Column("research_dossier", sa.JSON(), nullable=False),
        sa.Column("semantic_embedding", EmbeddingVector(1536), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "content_projects",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("idea_id", sa.Uuid(), sa.ForeignKey("ideas.id", ondelete="SET NULL"), nullable=True),
        sa.Column("asset_code", sa.String(length=50), unique=True, nullable=False),
        sa.Column("working_title", sa.String(length=255), nullable=False),
        sa.Column("target_duration", sa.String(length=50), nullable=False, server_default="STANDARD_SHORT"),
        sa.Column("conversion_goal", sa.String(length=64), nullable=False, server_default="EMAIL_LEAD_CAPTURE"),
        sa.Column("current_state", sa.String(length=50), nullable=False, server_default="INIT"),
        sa.Column("ice_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("tam_classification", sa.String(length=50), nullable=False, server_default="CORE_80"),
        sa.Column("ab_variants", sa.JSON(), nullable=False),
        sa.Column("state_history", sa.JSON(), nullable=False),
        sa.Column("temporal_workflow_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "scripts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("content_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("script_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("duration_preset", sa.String(length=50), nullable=False, server_default="STANDARD_SHORT"),
        sa.Column("conversion_goal", sa.String(length=64), nullable=False, server_default="EMAIL_LEAD_CAPTURE"),
        sa.Column("wpm_rate", sa.Integer(), nullable=False, server_default="140"),
        sa.Column("two_column_blocks", sa.JSON(), nullable=False),
        sa.Column("hook_variants", sa.JSON(), nullable=False),
        sa.Column("selected_hook_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cta_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("word_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_duration_sec", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "video_assets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("content_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("raw_media_url", sa.Text(), nullable=False),
        sa.Column("master_media_url", sa.Text(), nullable=True),
        sa.Column("thumbnail_a_url", sa.Text(), nullable=True),
        sa.Column("thumbnail_b_url", sa.Text(), nullable=True),
        sa.Column("s3_upload_id", sa.String(length=255), nullable=True),
        sa.Column("probe_metadata", sa.JSON(), nullable=False),
        sa.Column("transcription_json", sa.JSON(), nullable=False),
        sa.Column("silence_segments_json", sa.JSON(), nullable=False),
        sa.Column("silences_trimmed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("measured_lufs", sa.Float(), nullable=True),
        sa.Column("true_peak_dbfs", sa.Float(), nullable=True),
        sa.Column("ass_subtitles", sa.Text(), nullable=True),
        sa.Column("qc_passed", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("qc_report", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "social_posts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("content_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel", sa.String(length=50), nullable=False),
        sa.Column("external_platform_id", sa.String(length=255), nullable=True),
        sa.Column("canonical_url", sa.Text(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("post_body", sa.Text(), nullable=False),
        sa.Column("first_comment", sa.Text(), nullable=True),
        sa.Column("hashtags", sa.JSON(), nullable=False),
        sa.Column("metadata_payload", sa.JSON(), nullable=False),
        sa.Column("preflight_warnings", sa.JSON(), nullable=False),
        sa.Column("preflight_passed", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("publish_status", sa.String(length=50), nullable=False, server_default="DRAFT"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("hitl_approval_token", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "performance_snapshots",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("social_post_id", sa.Uuid(), sa.ForeignKey("social_posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("window_type", sa.String(length=10), nullable=False),
        sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("hold_rate_3s", sa.Float(), nullable=True),
        sa.Column("completion_rate", sa.Float(), nullable=True),
        sa.Column("watch_time_share", sa.Float(), nullable=True),
        sa.Column("sends_per_reach", sa.Float(), nullable=True),
        sa.Column("dwell_time_seconds", sa.Float(), nullable=True),
        sa.Column("outlier_multiplier", sa.Float(), nullable=True),
        sa.Column("retention_curve", sa.JSON(), nullable=False),
        sa.Column("diagnosis_layer", sa.String(length=100), nullable=True),
        sa.Column("rmta_classification", sa.String(length=50), nullable=True),
        sa.Column("recommended_action", sa.Text(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "hook_vault",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("hook_text", sa.Text(), nullable=False),
        sa.Column("hook_type", sa.String(length=100), nullable=False),
        sa.Column("verdict", sa.String(length=50), nullable=False, server_default="TEST"),
        sa.Column("observed_hold_rate", sa.Float(), nullable=True),
        sa.Column("semantic_vector", EmbeddingVector(1536), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "learned_rules",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("content_projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("rmta_classification", sa.String(length=50), nullable=False),
        sa.Column("diagnosis_layer", sa.String(length=100), nullable=False),
        sa.Column("rule_statement", sa.Text(), nullable=False),
        sa.Column("confidence_weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("workspace_id", sa.Uuid(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("content_projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action_type", sa.String(length=100), nullable=False),
        sa.Column("agent_or_user_id", sa.String(length=255), nullable=False),
        sa.Column("security_tier", sa.Integer(), nullable=False),
        sa.Column("operation_status", sa.String(length=50), nullable=False),
        sa.Column("hitl_token_id", sa.String(length=255), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("ip_source", sa.String(length=45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("idx_content_projects_state", "content_projects", ["workspace_id", "current_state"])
    op.create_index("idx_social_posts_channel_status", "social_posts", ["channel", "publish_status"])
    op.create_index("idx_performance_snapshots_window", "performance_snapshots", ["social_post_id", "window_type"])


def downgrade() -> None:
    op.drop_index("idx_performance_snapshots_window", table_name="performance_snapshots")
    op.drop_index("idx_social_posts_channel_status", table_name="social_posts")
    op.drop_index("idx_content_projects_state", table_name="content_projects")
    op.drop_table("audit_logs")
    op.drop_table("learned_rules")
    op.drop_table("hook_vault")
    op.drop_table("performance_snapshots")
    op.drop_table("social_posts")
    op.drop_table("video_assets")
    op.drop_table("scripts")
    op.drop_table("content_projects")
    op.drop_table("ideas")
    op.drop_table("creator_profiles")
    op.drop_table("workspaces")
