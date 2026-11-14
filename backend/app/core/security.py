"""Cryptographic Human-in-the-Loop (HITL) Governance and 3-Tier Permissions."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any

from app.core.config import get_settings


HITL_TOKEN_PREFIX = "HITL_AUTH_CREATOR_OK_"


@dataclass(frozen=True)
class HITLVerificationResult:
    valid: bool
    tier: int
    project_id: str
    action: str
    actor: str
    expires_at: int
    token: str
    reason: str


class HITLSecurityManager:
    """Issues and verifies HMAC-SHA256 tokens for Tier 2 and Tier 3 operations."""

    def __init__(self, secret_key: str | None = None) -> None:
        settings = get_settings()
        self.secret = (secret_key or settings.hitl_hmac_secret).encode("utf-8")
        self.matrix = settings.load_permissions_matrix()

    def get_action_tier(self, action: str) -> int:
        tiers = self.matrix.get("tier_classification", {})
        if action in tiers.get("tier_3_critical_irreversible", {}).get("actions", []):
            return 3
        if action in tiers.get("tier_2_sensitive_review", {}).get("actions", []):
            return 2
        if action in tiers.get("tier_1_safe_autonomous", {}).get("allowed_actions", []):
            return 1
        # Default safe classification for explicit tier actions
        if action.startswith("publish_") or action.startswith("delete_raw"):
            return 3
        if action.startswith("approve_") or action.startswith("finalize_"):
            return 2
        return 1

    def _compute_signature(
        self,
        project_id: str,
        tier: int,
        action: str,
        actor: str,
        expires_at: int,
    ) -> str:
        message = f"{project_id}|{tier}|{action}|{actor}|{expires_at}".encode("utf-8")
        return hmac.new(self.secret, message, hashlib.sha256).hexdigest()[:24].upper()

    def issue_hitl_token(
        self,
        project_id: str,
        tier: int,
        action: str,
        actor: str = "creator",
        ttl_seconds: int | None = None,
    ) -> dict[str, Any]:
        """
        Issue a signed HITL token in canonical format:
        HITL_AUTH_CREATOR_OK_<PROJECT_ID>_T<TIER>_<EXPIRES>_<HMAC24>
        """
        if tier not in (2, 3):
            raise ValueError("HITL tokens are only required for Tier 2 and Tier 3 actions.")

        settings = get_settings()
        default_ttl = 86400 if tier == 2 else settings.hitl_token_ttl_seconds
        ttl = ttl_seconds or default_ttl
        expires_at = int(time.time()) + ttl
        safe_pid = project_id.replace("_", "-")
        sig = self._compute_signature(safe_pid, tier, action, actor, expires_at)
        token = f"{HITL_TOKEN_PREFIX}{safe_pid}_T{tier}_{expires_at}_{sig}"
        return {
            "token": token,
            "project_id": project_id,
            "tier": tier,
            "action": action,
            "actor": actor,
            "expires_at": expires_at,
        }

    def verify_hitl_token(
        self,
        token: str | None,
        project_id: str,
        required_tier: int,
        action: str,
        actor: str | None = None,
    ) -> HITLVerificationResult:
        """
        Verify a HITL token. Rejects missing, tampered, expired, mismatched project/tier,
        or wrong action bindings.
        """
        if required_tier == 1:
            return HITLVerificationResult(
                valid=True,
                tier=1,
                project_id=project_id,
                action=action,
                actor=actor or "system",
                expires_at=0,
                token="",
                reason="Tier 1 autonomous action requires no HITL signature.",
            )

        if not token or not token.startswith(HITL_TOKEN_PREFIX):
            return HITLVerificationResult(
                valid=False,
                tier=required_tier,
                project_id=project_id,
                action=action,
                actor=actor or "unknown",
                expires_at=0,
                token=token or "",
                reason="Missing or invalid HITL_AUTH_CREATOR_OK_ token prefix.",
            )

        remainder = token[len(HITL_TOKEN_PREFIX) :]
        parts = remainder.rsplit("_", 3)
        if len(parts) != 4:
            return HITLVerificationResult(
                valid=False,
                tier=required_tier,
                project_id=project_id,
                action=action,
                actor=actor or "unknown",
                expires_at=0,
                token=token,
                reason="Malformed HMAC HITL token structure.",
            )

        token_pid, tier_str, expires_str, provided_sig = parts
        safe_pid = project_id.replace("_", "-")
        if token_pid != safe_pid:
            return HITLVerificationResult(
                valid=False,
                tier=required_tier,
                project_id=project_id,
                action=action,
                actor=actor or "unknown",
                expires_at=0,
                token=token,
                reason=f"Token bound to project {token_pid}, expected {safe_pid}.",
            )

        try:
            token_tier = int(tier_str.lstrip("T"))
            expires_at = int(expires_str)
        except ValueError:
            return HITLVerificationResult(
                valid=False,
                tier=required_tier,
                project_id=project_id,
                action=action,
                actor=actor or "unknown",
                expires_at=0,
                token=token,
                reason="Non-numeric tier or expiry in HITL token.",
            )

        if token_tier < required_tier:
            return HITLVerificationResult(
                valid=False,
                tier=required_tier,
                project_id=project_id,
                action=action,
                actor=actor or "unknown",
                expires_at=expires_at,
                token=token,
                reason=f"Token Tier {token_tier} insufficient for Tier {required_tier} operation.",
            )

        if int(time.time()) > expires_at:
            return HITLVerificationResult(
                valid=False,
                tier=required_tier,
                project_id=project_id,
                action=action,
                actor=actor or "unknown",
                expires_at=expires_at,
                token=token,
                reason="HITL authorization token has expired.",
            )

        expected_actor = actor or "creator"
        expected_sig = self._compute_signature(
            safe_pid, token_tier, action, expected_actor, expires_at
        )
        if not hmac.compare_digest(provided_sig, expected_sig):
            return HITLVerificationResult(
                valid=False,
                tier=required_tier,
                project_id=project_id,
                action=action,
                actor=expected_actor,
                expires_at=expires_at,
                token=token,
                reason="Cryptographic HMAC signature verification failed.",
            )

        return HITLVerificationResult(
            valid=True,
            tier=token_tier,
            project_id=project_id,
            action=action,
            actor=expected_actor,
            expires_at=expires_at,
            token=token,
            reason="Verified HMAC-SHA256 HITL authorization.",
        )

    def require_valid_token(
        self,
        token: str | None,
        project_id: str,
        required_tier: int,
        action: str,
        actor: str = "creator",
    ) -> HITLVerificationResult:
        result = self.verify_hitl_token(
            token=token,
            project_id=project_id,
            required_tier=required_tier,
            action=action,
            actor=actor,
        )
        if not result.valid:
            raise PermissionError(
                f"ACCESO DENEGADO [Tier {required_tier} HITL]: {result.reason}"
            )
        return result


def get_permissions_summary() -> dict[str, Any]:
    return get_settings().load_permissions_matrix()
