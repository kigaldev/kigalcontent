"""KigalChat only shows real bot data: no simulated sweep, honest empty state, whole-word matching."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

_TEST_DB = Path(tempfile.gettempdir()) / "ace_test_suite.db"
if _TEST_DB.exists():
    _TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TEST_DB.as_posix()}"

from app.api.routes import _matches_keyword  # noqa: E402
from app.main import app  # noqa: E402


@pytest.mark.parametrize(
    ("text", "keyword", "expected"),
    [
        ("GUIA", "GUIA", True),
        ("quiero la guía!!", "GUIA", True),
        ("Guía, por favor", "guia", True),
        ("GUIAR", "GUIA", False),
        ("guias", "GUIA", False),
        ("seguía", "GUIA", False),
        ("año", "ano", False),
        ("", "GUIA", False),
        ("GUIA", "  ", False),
    ],
)
def test_keyword_matches_whole_word_only(text: str, keyword: str, expected: bool) -> None:
    assert _matches_keyword(text, keyword) is expected


def test_auto_sweep_endpoint_is_gone() -> None:
    with TestClient(app) as client:
        assert client.post("/api/v1/kigalchat/auto-sweep").status_code in (404, 405)
        paths = {getattr(r, "path", "") for r in app.routes}
        assert "/api/v1/kigalchat/auto-sweep" not in paths


def test_interactions_empty_and_status_disconnected_without_bot_tables() -> None:
    with TestClient(app) as client:
        resp = client.get("/api/v1/kigalchat/interactions")
        assert resp.status_code == 200
        assert resp.json() == []

        status = client.get("/api/v1/kigalchat/status")
        assert status.status_code == 200
        body = status.json()
        assert body["bot_connected"] is False
        assert body["accounts"] == 0
        assert body["active_rules"] == 0
        assert body["funnel_7d"] == []


def test_manychat_trigger_records_matched_not_delivered_and_rejects_partial_word() -> None:
    with (
        patch("app.core.config.Settings.save_creator_profile_file", return_value=None),
        TestClient(app) as client,
    ):
        upd = client.put(
            "/api/v1/creator-profile",
            json={
                "lead_magnets": [
                    {
                        "id": "lm-test-guia",
                        "title": "Guía de prueba",
                        "description": "Recurso creado por el test",
                        "format": "PDF",
                        "delivery_url": "https://example.com/guia",
                        "source": "manual",
                    }
                ],
                "manychat_triggers": [
                    {
                        "id": "trig-test-guia",
                        "keyword": "GUIA",
                        "lead_magnet_id": "lm-test-guia",
                        "platform": "all",
                        "dm_reply_template": "Aquí la tienes:",
                        "active": True,
                        "triggers_count": 0,
                    }
                ],
            },
        )
        assert upd.status_code == 200

        miss = client.post(
            "/api/v1/manychat/trigger",
            json={"keyword": "GUIAR", "platform": "instagram", "comment_text": "me gusta guiar equipos"},
        ).json()
        assert miss["matched"] is False

        hit = client.post(
            "/api/v1/manychat/trigger",
            json={"keyword": "x", "platform": "instagram", "username": "@test_user", "comment_text": "¡Quiero la guía!"},
        ).json()
        assert hit["matched"] is True
        assert hit["delivery_url"] == "https://example.com/guia"

        logs = client.get("/api/v1/audit-logs").json()
        triggered = [entry for entry in logs if entry["action_type"] == "MANYCHAT_KEYWORD_TRIGGERED"]
        assert triggered, "the matched trigger must be audited"
        assert all(entry["payload"]["status"] == "MATCHED" for entry in triggered)


def test_reads_real_bot_rows_and_never_exposes_access_token() -> None:
    """Simulates the bot schema in SQLite (keywords as Postgres array text) and drops it afterwards."""
    import sqlite3

    token_value = "IGQ-test-token-not-a-secret"
    ddl = [
        "CREATE TABLE bot_accounts (account_id TEXT PRIMARY KEY, username TEXT, proyecto TEXT, access_token TEXT, "
        "token_refreshed_at TEXT, paused_until TEXT, enabled BOOLEAN)",
        "CREATE TABLE bot_rules (id INTEGER PRIMARY KEY, account_id TEXT, name TEXT, enabled BOOLEAN, keywords TEXT, "
        "post_id TEXT, created_at TEXT)",
        "CREATE TABLE bot_sent (id INTEGER PRIMARY KEY, account_id TEXT, igsid TEXT, username TEXT, rule_id INTEGER, "
        "kind TEXT, created_at TEXT)",
        "CREATE VIEW bot_embudo_7d AS SELECT r.account_id, r.name, r.keywords, "
        "SUM(CASE WHEN s.kind = 'prompt' THEN 1 ELSE 0 END) AS botones, "
        "SUM(CASE WHEN s.kind = 'reward' THEN 1 ELSE 0 END) AS enlaces, NULL AS conversion_pct, "
        "r.id AS rule_id, r.enabled FROM bot_rules r LEFT JOIN bot_sent s ON s.rule_id = r.id GROUP BY r.id",
    ]
    with TestClient(app) as client:
        con = sqlite3.connect(_TEST_DB)
        try:
            for stmt in ddl:
                con.execute(stmt)
            con.execute("INSERT INTO bot_accounts VALUES ('1784', 'cuenta_test', NULL, ?, NULL, NULL, 1)", (token_value,))
            con.execute("INSERT INTO bot_rules VALUES (7, '1784', 'Regla test', 1, '{GUIA}', NULL, NULL)")
            con.execute("INSERT INTO bot_sent VALUES (1, '1784', 'ig1', 'persona_test', 7, 'prompt', '2026-11-25 10:00:00')")
            con.execute("INSERT INTO bot_sent VALUES (2, '1784', 'ig1', 'persona_test', 7, 'reward', '2026-11-25 10:05:00')")
            con.commit()

            items = client.get("/api/v1/kigalchat/interactions")
            assert items.status_code == 200
            data = items.json()
            assert [i["kind"] for i in data] == ["reward", "prompt"]
            first = data[0]
            assert first["username"] == "@persona_test"
            assert first["account_username"] == "cuenta_test"
            assert first["matched_keyword"] == "GUIA"
            assert first["lead_magnet_title"] == "Regla test"
            assert first["comment_text"] == ""
            assert first["status"] == "SENT"

            status = client.get("/api/v1/kigalchat/status").json()
            assert status["bot_connected"] is True
            assert status["accounts"] == 1
            assert status["active_rules"] == 1
            assert status["funnel_7d"][0]["prompts_sent"] == 1
            assert status["funnel_7d"][0]["rewards_sent"] == 1
            assert status["funnel_7d"][0]["keyword"] == "GUIA"

            assert token_value not in items.text
            assert token_value not in client.get("/api/v1/kigalchat/status").text
        finally:
            for obj in ("VIEW bot_embudo_7d", "TABLE bot_sent", "TABLE bot_rules", "TABLE bot_accounts"):
                kind, name = obj.split()
                con.execute(f"DROP {kind} IF EXISTS {name}")
            con.commit()
            con.close()


def test_manychat_trigger_dry_run_counts_and_logs_nothing() -> None:
    with (
        patch("app.core.config.Settings.save_creator_profile_file", return_value=None),
        TestClient(app) as client,
    ):
        assert client.put(
            "/api/v1/creator-profile",
            json={
                "manychat_triggers": [
                    {
                        "id": "trig-test-dry",
                        "keyword": "PRUEBA",
                        "platform": "all",
                        "dm_reply_template": "Hola:",
                        "active": True,
                        "triggers_count": 0,
                    }
                ],
            },
        ).status_code == 200

        def matched_logs() -> int:
            logs = client.get("/api/v1/audit-logs").json()
            return sum(1 for e in logs if e["action_type"] == "MANYCHAT_KEYWORD_TRIGGERED")

        before = matched_logs()
        res = client.post(
            "/api/v1/manychat/trigger",
            json={"keyword": "x", "comment_text": "una prueba", "dry_run": True},
        ).json()
        assert res["matched"] is True
        assert res["dm_reply_text"]
        assert res["triggers_count"] == 0
        assert matched_logs() == before
        assert client.get("/api/v1/creator-profile").json()["manychat_triggers"][0]["triggers_count"] == 0


def test_manychat_trigger_matches_only_comment_text_when_present() -> None:
    with (
        patch("app.core.config.Settings.save_creator_profile_file", return_value=None),
        TestClient(app) as client,
    ):
        assert client.put(
            "/api/v1/creator-profile",
            json={
                "manychat_triggers": [
                    {"id": "trig-test-only-comment", "keyword": "GUIA", "platform": "all", "active": True}
                ],
            },
        ).status_code == 200
        # The panel may pick keyword=GUIA by substring; the comment itself must decide (as the real bot does).
        miss = client.post(
            "/api/v1/manychat/trigger",
            json={"keyword": "GUIA", "comment_text": "quiero guias", "dry_run": True},
        ).json()
        assert miss["matched"] is False
        hit = client.post("/api/v1/manychat/trigger", json={"keyword": "GUIA", "dry_run": True}).json()
        assert hit["matched"] is True


def test_purge_script_detects_simulated_publications_only() -> None:
    import importlib.util
    from types import SimpleNamespace

    script = Path(__file__).resolve().parents[1] / "scripts" / "purge_seed_data.py"
    spec = importlib.util.spec_from_file_location("purge_seed_data", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    def post(channel: str, ext: str | None, url: str | None) -> SimpleNamespace:
        return SimpleNamespace(channel=channel, external_platform_id=ext, canonical_url=url)

    assert module._is_simulated_publication(post("linkedin", "LINKEDIN_ab12cd34ef_1764000000", None))
    assert module._is_simulated_publication(post("instagram", None, "https://social.contentengine.local/instagram/x"))
    assert not module._is_simulated_publication(post("instagram", "17895695668004550", "https://www.instagram.com/p/abc/"))
    assert not module._is_simulated_publication(post("linkedin", "urn:li:share:7000000000000000000", None))
