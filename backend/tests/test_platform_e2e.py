"""Comprehensive Backend Integration & Unit Tests for Autonomous Content Engine Web."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Point database to an isolated temporary SQLite DB for tests
_TEST_DB = Path(tempfile.gettempdir()) / "ace_test_suite.db"
if _TEST_DB.exists():
    _TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TEST_DB.as_posix()}"

from app.core.security import HITLSecurityManager
from app.main import app
from app.schemas.contracts import (
    ConversionGoal,
    DurationPreset,
    RMTADiagnosisRequest,
    SocialChannel,
    WatchTimeShareRequest,
    WatchTimeShareVariant,
)
from app.services.domain_engines import (
    calculate_ice_and_hooks,
    calculate_watch_time_share,
    compute_block_metrics,
    diagnose_rmta,
    generate_parametric_script,
)
from app.services.social_connectors import SocialCopyCraftEngine, validate_preflight
from app.workers.media_pipeline import run_full_media_pipeline


class TestDomainAlgorithms:
    def test_ice_scorer_and_hooks(self):
        approved = calculate_ice_and_hooks("Sistemas de Automatización IA", 8.5, 8.0, 7.5)
        assert approved.ice_score == 8.0
        assert approved.threshold_met is True
        assert approved.status == "APROBADO_PRIORITARIO"
        assert len(approved.hook_candidates) == 5

        rejected = calculate_ice_and_hooks("Idea sin tracción", 3.0, 4.0, 3.5)
        assert rejected.ice_score == 3.5
        assert rejected.threshold_met is False
        assert rejected.status == "DESCARTADO"

    def test_parametric_duration_script_word_budgets_and_wpm(self):
        for preset, expected_min_w, expected_max_w in [
            (DurationPreset.MICRO_SHORT, 40, 75),
            (DurationPreset.STANDARD_SHORT, 110, 150),
            (DurationPreset.EXTENDED_SHORT, 220, 380),
            (DurationPreset.LONG_FORM, 1200, 1700),
        ]:
            blocks, ab, cta = generate_parametric_script(
                topic="Arquitectura Multiagente",
                preset=preset,
                goal=ConversionGoal.EMAIL_LEAD_CAPTURE,
                wpm_rate=140,
            )
            _, wc, est_sec, _ = compute_block_metrics(blocks, 140, preset)
            assert len(ab) == 2
            assert ab[0].thumbnail_dimensions == "1280x720"
            assert "BLUEPRINT" in cta
            assert wc >= int(expected_min_w * 0.7), f"{preset}: word count {wc} too low"
            assert wc <= int(expected_max_w * 1.25), f"{preset}: word count {wc} too high"
            assert est_sec > 0

    def test_watch_time_share_beats_raw_ctr(self):
        req = WatchTimeShareRequest(
            variant_a=WatchTimeShareVariant(impressions=10000, ctr_pct=8.0, avd_seconds=40),
            variant_b=WatchTimeShareVariant(impressions=10000, ctr_pct=5.0, avd_seconds=180),
        )
        res = calculate_watch_time_share(req)
        assert res.winner == "B"
        assert res.share_b_pct > 70.0

    def test_rmta_four_layer_diagnosis(self):
        diag = diagnose_rmta(
            RMTADiagnosisRequest(
                views=45000,
                baseline_views=12000,
                hold_rate_3s=71.0,
                completion_rate=58.0,
                sends_per_reach=3.2,
                persist_rule=False,
            )
        )
        assert diag.is_outlier_positive is True
        assert diag.rmta_classification == "REPETIR_FRANQUICIAR"
        assert diag.diagnosis_layer == "EXITO_ESTRUCTURAL"
        assert set(diag.four_layer_breakdown.keys()) == {"idea_tam", "empaque", "ejecucion", "distribucion"}

    def test_social_copycraft_and_preflight_rules(self):
        engine = SocialCopyCraftEngine()
        posts = engine.generate_all_channels(
            headline="Cómo automatizar tu máquina de contenido en 2026 sin aumentar horas",
            core_value="Guía técnica para pasar de producción artesanal a sistema determinista.",
            debate_question="¿Sistemas o más editores?",
            thesis_points=["Elimina silencios >400ms", "Verifica zonas seguras 9:16"],
            chapters=[{"time": "00:00", "title": "Intro"}, {"time": "00:25", "title": "Sistema"}],
            goal=ConversionGoal.B2B_INBOUND_CONVERSATION,
        )
        by_ch = {p["channel"]: p for p in posts}
        assert "SISTEMAS" in by_ch["LinkedIn"]["first_comment"]
        assert "https://" not in by_ch["LinkedIn"]["post_body"]
        assert len(by_ch["YouTube"]["title"]) < 60
        assert len(by_ch["Instagram"]["post_body"].splitlines()[0]) <= 120
        assert len(by_ch["TikTok"]["post_body"]) <= 300

        for ch_name, post in by_ch.items():
            pf = validate_preflight(SocialChannel(ch_name), post)
            assert pf.passed is True, f"{ch_name} failed preflight: {pf.blocking_errors}"

        # Verify LinkedIn link detector catches illegal body URL
        bad_li = {**by_ch["LinkedIn"], "post_body": "Mira esto https://spam.example.com"}
        pf_bad = validate_preflight(SocialChannel.LINKEDIN, bad_li)
        assert pf_bad.passed is False
        assert len(pf_bad.blocking_errors) == 1

    def test_hmac_hitl_security_signing_and_tamper_rejection(self):
        mgr = HITLSecurityManager(secret_key="unit-test-secret")
        issued = mgr.issue_hitl_token(
            project_id="proj-abc-123",
            tier=3,
            action="publish_linkedin",
            actor="david",
        )
        assert issued["token"].startswith("HITL_AUTH_CREATOR_OK_")

        ok = mgr.verify_hitl_token(
            token=issued["token"],
            project_id="proj-abc-123",
            required_tier=3,
            action="publish_linkedin",
            actor="david",
        )
        assert ok.valid is True

        # Tampered token must fail
        tampered = issued["token"][:-4] + "0000"
        bad = mgr.verify_hitl_token(
            token=tampered,
            project_id="proj-abc-123",
            required_tier=3,
            action="publish_linkedin",
            actor="david",
        )
        assert bad.valid is False

        # Tier 2 token cannot authorize Tier 3 action
        t2 = mgr.issue_hitl_token("proj-abc-123", tier=2, action="publish_linkedin", actor="david")
        insufficient = mgr.verify_hitl_token(
            token=t2["token"],
            project_id="proj-abc-123",
            required_tier=3,
            action="publish_linkedin",
            actor="david",
        )
        assert insufficient.valid is False


class TestRealMediaPipelineFFmpeg:
    def test_ffmpeg_silence_trim_and_ebu_r128_loudnorm_and_916_master(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            raw_path = Path(tmpdir) / "demo_raw.mp4"
            report = run_full_media_pipeline(
                project_id="test-media-01",
                raw_media_url=str(raw_path),
                script_text_hint="Sistemas automatizados de contenido con audio normalizado y subtítulos seguros",
                generate_demo_source_if_missing=True,
            )
            assert report.qc_passed is True
            assert report.silences_trimmed >= 1
            assert -15.5 <= report.measured_lufs <= -12.5
            assert report.true_peak_dbfs <= -0.5
            assert report.resolution == "1080x1920"
            assert Path(report.master_media_url).exists()
            assert Path(report.thumbnail_a_url).exists()
            assert Path(report.thumbnail_b_url).exists()
            assert "PlayResX: 1080" in report.ass_subtitles_preview
            assert len(report.transcription_words) >= 5


class TestFastAPIEndToEnd:
    def test_full_api_lifecycle_and_hitl_blocking(self):
        with TestClient(app) as client:
            health = client.get("/health")
            assert health.status_code == 200
            assert health.json()["status"] == "ok"

            mcp = client.get("/api/v1/mcp/healthcheck")
            assert mcp.status_code == 200
            assert "mcp" in mcp.json()

            # Create project -> auto scripts in SCRIPTED_PACKAGED
            create_resp = client.post(
                "/api/v1/projects",
                json={
                    "working_title": "Sistemas de Contenido Multiagente 2026",
                    "target_duration": "STANDARD_SHORT",
                    "conversion_goal": "EMAIL_LEAD_CAPTURE",
                    "impact": 9.0,
                    "confidence": 8.5,
                    "ease": 8.0,
                },
            )
            assert create_resp.status_code == 201
            proj = create_resp.json()
            pid = proj["id"]
            assert proj["current_state"] == "SCRIPTED_PACKAGED"

            # Attempt Tier 2 transition without HITL token -> MUST block 403
            blocked_t2 = client.post(
                f"/api/v1/projects/{pid}/transition",
                json={"target_state": "HITL_PENDING_PRODUCTION", "agent_or_user": "creator"},
            )
            assert blocked_t2.status_code == 403

            # Issue Tier 2 token & transition
            t2_tok = client.post(
                "/api/v1/hitl/issue-token",
                json={
                    "project_id": pid,
                    "tier": 2,
                    "action": "approve_script_for_production",
                    "actor": "creator",
                },
            ).json()["token"]

            ok_t2 = client.post(
                f"/api/v1/projects/{pid}/transition",
                json={
                    "target_state": "HITL_PENDING_PRODUCTION",
                    "agent_or_user": "creator",
                    "hitl_token": t2_tok,
                },
            )
            assert ok_t2.status_code == 200
            assert ok_t2.json()["current_state"] == "HITL_PENDING_PRODUCTION"

            # S3 multipart init
            s3_init = client.post(
                "/api/v1/media/s3/multipart-init",
                json={"project_id": pid, "filename": "take01.mp4", "part_count": 2},
            )
            assert s3_init.status_code == 200
            assert len(s3_init.json()["presigned_part_urls"]) == 2

            # Process media -> transitions to PRODUCED_VALIDATED
            media_res = client.post(
                "/api/v1/media/process",
                json={"project_id": pid, "raw_media_url": "s3://ace-media-vault/demo.mp4"},
            )
            assert media_res.status_code == 200
            assert media_res.json()["qc_passed"] is True

            # Transition to HITL_PENDING_PUBLISH
            ok_pending_pub = client.post(
                f"/api/v1/projects/{pid}/transition",
                json={"target_state": "HITL_PENDING_PUBLISH", "agent_or_user": "creator"},
            )
            assert ok_pending_pub.status_code == 200

            # Attempt Tier 3 publish WITHOUT token -> MUST block 403
            blocked_pub = client.post(
                "/api/v1/social/publish",
                json={"project_id": pid, "channels": ["LinkedIn"], "actor": "creator"},
            )
            assert blocked_pub.status_code == 403

            # Issue Tier 3 token with 2FA code and publish LinkedIn
            t3_tok = client.post(
                "/api/v1/hitl/issue-token",
                json={
                    "project_id": pid,
                    "tier": 3,
                    "action": "publish_linkedin",
                    "actor": "creator",
                    "two_factor_code": "884210",
                },
            ).json()["token"]

            pub_ok = client.post(
                "/api/v1/social/publish",
                json={
                    "project_id": pid,
                    "channels": ["LinkedIn"],
                    "hitl_token": t3_tok,
                    "actor": "creator",
                },
            )
            assert pub_ok.status_code == 200
            assert pub_ok.json()["status"] == "PUBLISHED_LIVE"

            # Verify immutable audit log captured both BLOCKED and SUCCESS entries
            audits = client.get("/api/v1/audit-logs").json()
            statuses = {a["operation_status"] for a in audits}
            assert "BLOCKED_HITL_REQUIRED" in statuses
            assert "SUCCESS" in statuses
