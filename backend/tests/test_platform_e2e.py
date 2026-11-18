"""Comprehensive Backend Integration & Unit Tests for Autonomous Content Engine Web."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

# Point database to an isolated temporary SQLite DB for tests
_TEST_DB = Path(tempfile.gettempdir()) / "ace_test_suite.db"
if _TEST_DB.exists():
    _TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TEST_DB.as_posix()}"

from app.core.config import get_settings
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
from app.workers.media_pipeline import (
    NATIVE_EDITOR_SIGNATURES,
    build_native_editor_ffmpeg_flags,
    run_full_media_pipeline,
)


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

        # Verify native editor fingerprints & X/Twitter helper
        assert by_ch["YouTube"]["metadata_payload"]["native_editor_fingerprint"] == NATIVE_EDITOR_SIGNATURES["YouTube"]
        assert by_ch["Instagram"]["metadata_payload"]["native_editor_fingerprint"] == NATIVE_EDITOR_SIGNATURES["Instagram"]
        assert by_ch["TikTok"]["metadata_payload"]["native_editor_fingerprint"] == NATIVE_EDITOR_SIGNATURES["TikTok"]

        x_post = engine.generate_x_twitter(
            headline="Automatiza tu sistema editorial en 2026",
            thesis_points=["Elimina cuellos manuales", "Mide Watch Time Share"],
            goal=ConversionGoal.EMAIL_LEAD_CAPTURE,
        )
        assert x_post["channel"] == "X"
        assert len(x_post["post_body"]) <= 280
        assert x_post["first_comment"]

    def test_build_native_editor_ffmpeg_flags_and_rebrand(self):
        assert get_settings().app_name == "KigalContent Studio API"

        for platform in ("Instagram", "TikTok", "YouTube"):
            flags = build_native_editor_ffmpeg_flags(platform)
            assert "-map_metadata" in flags and "-1" in flags
            assert "-fflags" in flags and "+bitexact" in flags
            assert "-movflags" in flags and "+faststart+use_metadata_tags" in flags
            assert "-colorspace" in flags and "bt709" in flags
            expected_sig = NATIVE_EDITOR_SIGNATURES[platform]
            for k, v in expected_sig.items():
                assert f"{k}={v}" in flags

        # Unknown platform falls back cleanly to Instagram signature
        fallback_flags = build_native_editor_ffmpeg_flags("UnknownPlatform")
        assert f"make={NATIVE_EDITOR_SIGNATURES['Instagram']['make']}" in fallback_flags
        assert (
            f"com.apple.quicktime.software={NATIVE_EDITOR_SIGNATURES['Instagram']['com.apple.quicktime.software']}"
            in fallback_flags
        )

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
            assert report.native_signature_profile == NATIVE_EDITOR_SIGNATURES["Instagram"]

    def test_ffmpeg_pipeline_with_native_editor_signature(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            raw_path = Path(tmpdir) / "demo_tiktok_raw.mp4"
            report = run_full_media_pipeline(
                project_id="test-media-sig-tiktok",
                raw_media_url=str(raw_path),
                script_text_hint="Flujo nativo optimizado para retención y audio limpio",
                generate_demo_source_if_missing=True,
                target_platform_signature="TikTok",
            )
            assert report.qc_passed is True
            assert report.native_signature_profile == NATIVE_EDITOR_SIGNATURES["TikTok"]
            master_path = Path(report.master_media_url)
            assert master_path.exists()

            ffprobe = shutil.which("ffprobe") or "ffprobe"
            probe = subprocess.run(
                [ffprobe, "-v", "quiet", "-print_format", "json", "-show_format", str(master_path)],
                check=True,
                capture_output=True,
                text=True,
            )
            tags = json.loads(probe.stdout).get("format", {}).get("tags", {})
            assert tags.get("comment") == NATIVE_EDITOR_SIGNATURES["TikTok"]["comment"]


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

    def test_skill_loader_and_hybrid_llm_router(self):
        with TestClient(app) as client:
            skills_resp = client.get("/api/v1/llm/skills")
            assert skills_resp.status_code == 200
            skills = skills_resp.json()
            agent_ids = {s["agent_id"] for s in skills}
            assert "director_scriptwriter" in agent_ids
            assert "researcher_strategist" in agent_ids
            assert all(s["char_count"] > 100 for s in skills)

            cfg_resp = client.get("/api/v1/llm/config")
            assert cfg_resp.status_code == 200
            cfg = cfg_resp.json()
            assert cfg["anthropic_prompt_caching_enabled"] is True
            assert len(cfg["recommended_local_models"]) >= 4

            upd_resp = client.put(
                "/api/v1/llm/config",
                json={"active_provider": "auto", "ollama_model": "qwen3:14b"},
            )
            assert upd_resp.status_code == 200
            assert upd_resp.json()["ollama_model"] == "qwen3:14b"

            # Probing an unreachable local Ollama endpoint must cleanly fall back without crashing
            probe_resp = client.post(
                "/api/v1/llm/test-connection",
                json={
                    "provider": "ollama",
                    "ollama_base_url": "http://127.0.0.1:59999",
                    "ollama_model": "qwen3:14b",
                },
            )
            assert probe_resp.status_code == 200
            assert probe_resp.json()["fallback_used"] is True

    def test_n8n_workflow_catalog_endpoint(self):
        with TestClient(app) as client:
            resp = client.get("/api/v1/n8n/workflows")
            assert resp.status_code == 200
            workflows = resp.json()
            assert len(workflows) == 5
            filenames = {wf["filename"] for wf in workflows}
            assert "01_radar_ideas_ice_matutino.json" in filenames
            assert "05_auditoria_rmta_aprendizaje.json" in filenames
            for wf in workflows:
                assert wf["workflow_json"].get("nodes"), f"Empty nodes in {wf['filename']}"

    def test_creator_profile_github_import_validation(self):
        with TestClient(app) as client:
            bad_resp = client.post(
                "/api/v1/creator-profile/import-github",
                json={"repo_url_or_slug": "invalid-single-word"},
            )
            assert bad_resp.status_code == 400

    def test_ads_generate_campaign_endpoint(self):
        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/ads/generate-campaign",
                json={
                    "topic": "Automatización de Embudo con IA para Consultores B2B",
                    "platforms": ["Meta Ads", "Google Ads"],
                    "objective": "Leads / ManyChat",
                    "target_url": "https://kigalcontent.studio/blueprint",
                    "trigger_keyword": "SISTEMA",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["variants"]) == 3
            angles = [v["angle_name"] for v in data["variants"]]
            assert "PAS Dolor" in angles
            assert "Autoridad / Caso Real" in angles
            assert "Demo Contraintuitiva" in angles
            for variant in data["variants"]:
                assert len(variant["remotion_916_storyboard"]) >= 3
                assert variant["primary_text"]
                assert variant["headline"]

            rsa = data["google_rsa"]
            assert len(rsa["headlines"]) >= 5
            assert all(len(h) <= 30 for h in rsa["headlines"])
            assert len(rsa["descriptions"]) >= 3
            assert all(len(d) <= 90 for d in rsa["descriptions"])
            assert len(rsa["search_keywords_exact"]) >= 3
            assert len(rsa["search_keywords_phrase"]) >= 3
            assert len(rsa["search_keywords_negative"]) >= 3
            assert rsa["youtube_5s_hook"]

            assert len(data["ga4_utm_links"]) >= 3
            assert all("utm_source=" in link["url"] for link in data["ga4_utm_links"])

    def test_kigalchat_auto_sweep_and_interactions(self):
        with (
            patch("app.core.config.Settings.save_creator_profile_file", return_value=None),
            TestClient(app) as client,
        ):
            # Before configuring triggers, auto-sweep returns processed_count=0 cleanly
            empty_sweep = client.post("/api/v1/kigalchat/auto-sweep")
            assert empty_sweep.status_code == 200
            assert empty_sweep.json()["processed_count"] == 0
            assert empty_sweep.json()["interactions"] == []

            initial_list = client.get("/api/v1/kigalchat/interactions")
            assert initial_list.status_code == 200
            assert initial_list.json() == []

            # Configure a LeadMagnetItem and active ManyChat/KigalChat trigger rule
            upd = client.put(
                "/api/v1/creator-profile",
                json={
                    "lead_magnets": [
                        {
                            "id": "lm-kigal-01",
                            "title": "Blueprint KigalChat IA",
                            "description": "Sistema de automatización de comentarios y DMs",
                            "format": "Guía PDF",
                            "delivery_url": "https://kigalcontent.studio/recursos/blueprint",
                            "source": "manual",
                        }
                    ],
                    "manychat_triggers": [
                        {
                            "id": "trig-kigal-01",
                            "keyword": "SISTEMA",
                            "lead_magnet_id": "lm-kigal-01",
                            "platform": "instagram",
                            "dm_reply_template": "¡Hola! Aquí tienes tu Blueprint:",
                            "active": True,
                            "triggers_count": 0,
                        }
                    ],
                },
            )
            assert upd.status_code == 200

            # Single manual trigger generates varied public_comment_reply
            trig = client.post(
                "/api/v1/manychat/trigger",
                json={
                    "keyword": "SISTEMA",
                    "platform": "instagram",
                    "username": "@founder_test",
                    "comment_text": "Quiero el SISTEMA porfa",
                },
            )
            assert trig.status_code == 200
            trig_data = trig.json()
            assert trig_data["matched"] is True
            assert trig_data["public_comment_reply"]
            assert trig_data["triggers_count"] == 1

            # Auto-sweep processes active rule and increments triggers_count
            sweep = client.post("/api/v1/kigalchat/auto-sweep")
            assert sweep.status_code == 200
            sweep_data = sweep.json()
            assert sweep_data["processed_count"] == 1
            assert len(sweep_data["interactions"]) == 1
            item = sweep_data["interactions"][0]
            assert item["matched_keyword"] == "SISTEMA"
            assert item["lead_magnet_title"] == "Blueprint KigalChat IA"
            assert item["delivery_url"] == "https://kigalcontent.studio/recursos/blueprint"
            assert item["public_comment_reply"]
            assert item["dm_reply_text"]
            assert item["status"] == "DELIVERED"

            # Persisted triggers_count is now 2 and interactions list has both records
            prof = client.get("/api/v1/creator-profile").json()
            assert prof["manychat_triggers"][0]["triggers_count"] == 2

            interactions = client.get("/api/v1/kigalchat/interactions").json()
            assert len(interactions) == 2
            assert all(i["public_comment_reply"] for i in interactions)

    def test_ideas_ai_evaluate_and_radar_matutino_ingest(self):
        with TestClient(app) as client:
            # 1. AI Evaluate Idea with rich context notes and platform selection
            eval_resp = client.post(
                "/api/v1/ideas/ai-evaluate",
                json={
                    "concept_title": "Cómo automatizar captación de clientes con Manychat e IA local",
                    "context_notes": "Noticia y tendencia del día: los creadores que reemplazan enlaces directos en la bio por automatizaciones de comentarios y DM obtienen 3.8x más leads cualificados.",
                    "target_platforms": ["YouTube", "Instagram", "LinkedIn"],
                },
            )
            assert eval_resp.status_code == 200
            eval_data = eval_resp.json()
            assert eval_data["ice_score"] >= 7.0
            assert eval_data["impact"] >= 5.0
            assert eval_data["confidence"] >= 5.0
            assert eval_data["ease"] >= 5.0
            assert eval_data["rationale"]
            assert len(eval_data["hook_candidates"]) >= 1
            assert eval_data["estimated_hold_rate"] >= 50.0

            # 2. Ingest idea from Radar Matutino n8n automation
            radar_resp = client.post(
                "/api/v1/ideas/radar-matutino",
                json={
                    "concept_title": "Radar Matutino: Automatización con Qwen3 y DeepSeek",
                    "context_notes": "Modelos abiertos para MiniPCs permiten orquestar guiones y miniaturas sin coste de suscripción recurrente.",
                    "source_origin": "radar_matutino",
                    "source_url": "https://news.ycombinator.com",
                    "target_platforms": ["YouTube", "Instagram", "TikTok", "LinkedIn", "X"],
                    "auto_evaluate_ai": True,
                    "auto_create_project": True,
                },
            )
            assert radar_resp.status_code == 200
            radar_data = radar_resp.json()
            assert radar_data["status"] == "INGESTED_AND_PROJECT_CREATED"
            assert radar_data["threshold_met"] is True
            assert radar_data["project_id"] is not None
            assert radar_data["asset_code"] is not None
            assert radar_data["source_origin"] == "radar_matutino"
            assert "context_notes" in radar_data
            assert len(radar_data["target_platforms"]) == 5

            # 3. Verify created project carries context notes, source_origin and platforms in list_projects
            proj_resp = client.get("/api/v1/projects")
            assert proj_resp.status_code == 200
            projects = proj_resp.json()
            matching = [p for p in projects if p["id"] == radar_data["project_id"]]
            assert len(matching) == 1
            radar_proj = matching[0]
            assert radar_proj["source_origin"] == "radar_matutino"
            assert radar_proj["context_notes"]
            assert "TikTok" in radar_proj["target_platforms"]




