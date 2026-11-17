"""Central configuration loaded from environment and skill v2 config artifacts."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SKILL_DIR = DEFAULT_REPO_ROOT / "claude-content-engine-skill"


def _normalize_postgres_url(raw: str) -> str:
    """Normalize postgresql:// URLs to postgresql+asyncpg://, auto-route Supabase IPv6 direct hosts to IPv4 poolers, and encode special characters."""
    url = raw.strip()
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)

    if url.startswith("postgresql+asyncpg://") and "@" in url:
        scheme, rest = url.split("://", 1)
        userinfo, hostpart = rest.rsplit("@", 1)

        # Auto-route direct Supabase IPv6 host (e.g. db.<ref>.supabase.co) to working IPv4 Supavisor Pooler
        import re
        supa_match = re.search(r"^db\.([a-zA-Z0-9]+)\.supabase\.co(?::\d+)?/(.+)$", hostpart)
        if supa_match:
            ref, dbname = supa_match.group(1), supa_match.group(2)
            hostpart = f"aws-0-eu-west-3.pooler.supabase.com:6543/{dbname}"
            if ":" in userinfo:
                u, p = userinfo.split(":", 1)
                if not u.startswith("postgres."):
                    userinfo = f"postgres.{ref}:{p}"

        if ":" in userinfo:
            user, password = userinfo.split(":", 1)
            # Only encode if password has raw special chars not already percent-encoded
            if unquote(password) == password and any(c in password for c in ":#{}[]/?@ "):
                password = quote(password, safe="")
            url = f"{scheme}://{user}:{password}@{hostpart}"
    return url


def _default_db_url() -> str:
    raw = os.environ.get("DATABASE_URL")
    if raw:
        return _normalize_postgres_url(raw)
    if os.environ.get("VERCEL"):
        return "sqlite+aiosqlite:////tmp/ace_local.db"
    return f"sqlite+aiosqlite:///{(DEFAULT_REPO_ROOT / 'backend' / 'ace_local.db').as_posix()}"


class Settings(BaseSettings):
    """Application settings with Pydantic v2 validation."""

    model_config = SettingsConfigDict(
        env_file=(str(DEFAULT_REPO_ROOT / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development")
    app_name: str = Field(default="KigalContent Studio API")
    api_v1_prefix: str = Field(default="/api/v1")

    # Security & HITL HMAC
    hitl_hmac_secret: str = Field(default="ace-dev-hmac-secret-256-bit-do-not-use-in-prod")
    jwt_secret_key: str = Field(default="ace-dev-jwt-secret-key")
    hitl_token_ttl_seconds: int = Field(default=3600)

    # Database & Supabase
    database_url: str = Field(default_factory=_default_db_url)
    supabase_project_url: str = Field(default="")
    google_drive_api_key: str = Field(default="")

    @field_validator("database_url", mode="before")
    @classmethod
    def _validate_database_url(cls, v: Any) -> str:
        if not v:
            return _default_db_url()
        return _normalize_postgres_url(str(v))

    # Redis & Temporal
    redis_url: str = Field(default="redis://localhost:6379/0")
    temporal_host: str = Field(default="localhost:7233")
    temporal_namespace: str = Field(default="default")
    temporal_task_queue: str = Field(default="content-engine-pipeline")

    # S3 / Cloudflare R2 / LocalStack
    s3_endpoint_url: str = Field(default="http://localhost:4566")
    s3_region: str = Field(default="auto")
    s3_bucket_name: str = Field(default="ace-media-vault")
    aws_access_key_id: str = Field(default="test")
    aws_secret_access_key: str = Field(default="test")

    @field_validator("s3_endpoint_url", mode="before")
    @classmethod
    def _validate_s3_endpoint(cls, v: Any) -> str:
        s = str(v or "http://localhost:4566").strip()
        # Automatically rewrite regional .eu. endpoints if present to prevent 404 on global buckets
        if ".eu.r2.cloudflarestorage.com" in s:
            s = s.replace(".eu.r2.cloudflarestorage.com", ".r2.cloudflarestorage.com")
        return s

    @field_validator("aws_access_key_id", mode="before")
    @classmethod
    def _validate_aws_key_id(cls, v: Any) -> str:
        val = str(v or "").strip()
        if val and val != "test":
            return val
        return (
            os.environ.get("R2_ACCESS_KEY_ID")
            or os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
            or val
            or "test"
        )

    @field_validator("aws_secret_access_key", mode="before")
    @classmethod
    def _validate_aws_secret_key(cls, v: Any) -> str:
        val = str(v or "").strip()
        if val and val != "test":
            return val
        return (
            os.environ.get("R2_SECRET_ACCESS_KEY")
            or os.environ.get("CLOUDFLARE_R2_SECRET_KEY")
            or val
            or "test"
        )

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

    # Hybrid Skill-Aware LLM Router (Ollama MiniPC + Anthropic Prompt Caching + OpenAI Compatible)
    llm_provider: str = Field(default="auto")
    ollama_base_url: str = Field(default="http://localhost:11434")
    ollama_model: str = Field(default="qwen3:14b")
    ollama_embedding_model: str = Field(default="bge-m3")
    anthropic_model: str = Field(default="claude-3-5-sonnet-latest")
    openai_compatible_base_url: str = Field(default="https://openrouter.ai/api/v1")
    openai_compatible_api_key: str = Field(default="")
    openai_compatible_model: str = Field(default="qwen/qwen-2.5-72b-instruct")

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
