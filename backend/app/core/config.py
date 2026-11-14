"""Central configuration loaded from environment and skill v2 config artifacts."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SKILL_DIR = DEFAULT_REPO_ROOT / "claude-content-engine-skill"


def _default_db_url() -> str:
    raw = os.environ.get("DATABASE_URL")
    if raw:
        # Supabase and Heroku/Neon provide 'postgresql://' or 'postgres://'; SQLAlchemy 2.0 async requires 'postgresql+asyncpg://'
        if raw.startswith("postgresql://"):
            return raw.replace("postgresql://", "postgresql+asyncpg://", 1)
        if raw.startswith("postgres://"):
            return raw.replace("postgres://", "postgresql+asyncpg://", 1)
        return raw
    if os.environ.get("VERCEL"):
        return "sqlite+aiosqlite:////tmp/ace_local.db"
    return f"sqlite+aiosqlite:///{(DEFAULT_REPO_ROOT / 'backend' / 'ace_local.db').as_posix()}"


class Settings(BaseSettings):
    """Application settings with Pydantic v2 validation."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development")
    app_name: str = Field(default="Autonomous Content Engine")
    api_v1_prefix: str = Field(default="/api/v1")

    # Security & HITL HMAC
    hitl_hmac_secret: str = Field(default="ace-dev-hmac-secret-256-bit-do-not-use-in-prod")
    jwt_secret_key: str = Field(default="ace-dev-jwt-secret-key")
    hitl_token_ttl_seconds: int = Field(default=3600)

    # Database
    database_url: str = Field(default_factory=_default_db_url)

    # Redis & Temporal
    redis_url: str = Field(default="redis://localhost:6379/0")
    temporal_host: str = Field(default="localhost:7233")
    temporal_namespace: str = Field(default="default")
    temporal_task_queue: str = Field(default="content-engine-pipeline")

    # S3 / Cloudflare R2 / LocalStack
    s3_endpoint_url: str = Field(default="http://localhost:4566")
    s3_region: str = Field(default="us-east-1")
    s3_bucket_name: str = Field(default="ace-media-vault")
    aws_access_key_id: str = Field(default="test")
    aws_secret_access_key: str = Field(default="test")

    # Skill & Media Directories
    skill_base_dir: Path = Field(default=DEFAULT_SKILL_DIR)
    media_workspace_dir: Path = Field(default=DEFAULT_REPO_ROOT / "media_workspace")

    # Media Processing Tools
    ffmpeg_bin: str = Field(default="ffmpeg")
    ffprobe_bin: str = Field(default="ffprobe")
    whisper_model: str = Field(default="base")
    whisper_device: str = Field(default="cpu")

    # External APIs & Social Connectors
    anthropic_api_key: str = Field(default="")
    brave_api_key: str = Field(default="")
    youtube_access_token: str = Field(default="")
    instagram_access_token: str = Field(default="")
    instagram_business_account_id: str = Field(default="")
    tiktok_access_token: str = Field(default="")
    linkedin_access_token: str = Field(default="")
    linkedin_person_urn: str = Field(default="urn:li:person:creator-001")

    @property
    def creator_profile_path(self) -> Path:
        return self.skill_base_dir / "config" / "creator_profile.json"

    @property
    def permissions_matrix_path(self) -> Path:
        return self.skill_base_dir / "config" / "permissions_matrix.json"

    @property
    def mcp_servers_path(self) -> Path:
        return self.skill_base_dir / "config" / "mcp_servers.json"

    @property
    def learned_rules_path(self) -> Path:
        return self.skill_base_dir / ".content_engine" / "memory" / "learned_rules.json"

    def load_creator_profile_file(self) -> dict[str, Any]:
        if self.creator_profile_path.exists():
            return json.loads(self.creator_profile_path.read_text(encoding="utf-8"))
        return {
            "creator_id": "CR-001",
            "name": "David",
            "personal_brand_tagline": "Arquitectura de Negocios Unipersonales y Sistemas IA",
            "niche": "Solopreneurship y Automatización con IA",
            "ideal_customer_profile": "Fundadores y consultores B2B",
            "active_conversion_goal": "EMAIL_LEAD_CAPTURE",
            "conversion_goals_catalog": {},
            "content_pillars": [],
            "social_profiles": {},
        }

    def save_creator_profile_file(self, data: dict[str, Any]) -> None:
        self.creator_profile_path.parent.mkdir(parents=True, exist_ok=True)
        self.creator_profile_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def load_permissions_matrix(self) -> dict[str, Any]:
        if self.permissions_matrix_path.exists():
            return json.loads(self.permissions_matrix_path.read_text(encoding="utf-8"))
        return {
            "permission_policy": {"version": "1.0", "mode": "controlled_autonomy"},
            "tier_classification": {
                "tier_1_safe_autonomous": {"requires_human_approval": False, "allowed_actions": []},
                "tier_2_sensitive_review": {"requires_human_approval": True, "actions": []},
                "tier_3_critical_irreversible": {"requires_human_approval": True, "actions": []},
            },
        }


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    os.makedirs(settings.media_workspace_dir / "raw", exist_ok=True)
    os.makedirs(settings.media_workspace_dir / "processed", exist_ok=True)
    os.makedirs(settings.learned_rules_path.parent, exist_ok=True)
    return settings
