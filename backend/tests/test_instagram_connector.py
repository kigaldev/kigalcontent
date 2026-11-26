"""Instagram connector (Instagram API with Instagram Login) against a mocked graph.instagram.com."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs

# Same isolated SQLite DB as test_platform_e2e.py, set before any app import (never the real database).
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{(Path(tempfile.gettempdir()) / 'ace_test_suite.db').as_posix()}"

import httpx
import pytest

from app.core.security import HITLSecurityManager
from app.services.social_connectors import (
    InstagramApiError,
    MetaGraphConnector,
    SocialRateLimitError,
)

IG_USER = "17841400000000001"
VIDEO_URL = "https://media.example.com/reels/reel-01.mp4"
CAPTION = "Tres errores al automatizar tu negocio.\n\n#Automatizacion #IA #Pymes"


def _payload(**meta: Any) -> dict[str, Any]:
    return {
        "title": "Tres errores al automatizar tu negocio.",
        "post_body": CAPTION,
        "hashtags": ["#Automatizacion", "#IA", "#Pymes"],
        "metadata_payload": meta,
    }


def _token(project_id: str) -> tuple[HITLSecurityManager, str]:
    mgr = HITLSecurityManager()
    tok = mgr.issue_hitl_token(project_id=project_id, tier=3, action="publish_instagram", actor="creator")["token"]
    return mgr, tok


class GraphMock:
    """Routes requests by (method, path suffix) and records every call."""

    def __init__(self, handlers: dict[tuple[str, str], Callable[[httpx.Request], httpx.Response]]) -> None:
        self.handlers = handlers
        self.calls: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        assert request.url.host == "graph.instagram.com"
        assert request.url.path.startswith("/v27.0/")
        assert request.headers["Authorization"] == "Bearer ig_live_mock_token"
        path = request.url.path[len("/v27.0/"):]
        handler = self.handlers.get((request.method, path))
        assert handler is not None, f"Unexpected call {request.method} {path}"
        return handler(request)

    def posted(self, path: str) -> list[dict[str, list[str]]]:
        return [
            parse_qs(c.content.decode())
            for c in self.calls
            if c.method == "POST" and c.url.path.endswith(path)
        ]


def _ok(body: dict[str, Any]) -> Callable[[httpx.Request], httpx.Response]:
    return lambda _req: httpx.Response(200, json=body)


def _limit_ok() -> Callable[[httpx.Request], httpx.Response]:
    return _ok({"data": [{"quota_usage": 3, "config": {"quota_total": 100, "quota_duration": 86400}}]})


def _connector(mock: GraphMock, ig_user_id: str = "") -> MetaGraphConnector:
    return MetaGraphConnector(
        "ig_live_mock_token",
        ig_user_id=ig_user_id,
        transport=httpx.MockTransport(mock),
        poll_interval_seconds=0,
        video_poll_timeout_seconds=5,
        image_poll_timeout_seconds=5,
    )


async def test_reel_happy_path_polls_publishes_and_reads_real_permalink():
    statuses = iter(["IN_PROGRESS", "IN_PROGRESS", "FINISHED"])
    mock = GraphMock(
        {
            ("GET", "me"): _ok({"user_id": IG_USER, "username": "kikegallego_"}),
            ("GET", f"{IG_USER}/content_publishing_limit"): _limit_ok(),
            ("POST", f"{IG_USER}/media"): _ok({"id": "cont_555"}),
            ("GET", "cont_555"): lambda _r: httpx.Response(200, json={"status_code": next(statuses)}),
            ("POST", f"{IG_USER}/media_publish"): _ok({"id": "media_999"}),
            ("GET", "media_999"): _ok(
                {"permalink": "https://www.instagram.com/reel/DAbCdEf123/", "timestamp": "2026-11-25T10:00:00+0000"}
            ),
        }
    )
    mgr, tok = _token("proj-ig-reel-01")
    res = await _connector(mock).publish(
        "proj-ig-reel-01",
        _payload(media_url=VIDEO_URL, share_to_feed=True, thumb_offset=1500),
        hitl_token=tok,
        security_manager=mgr,
    )

    assert res["status"] == "PUBLISHED"
    assert res["external_platform_id"] == "media_999"
    assert res["canonical_url"] == "https://www.instagram.com/reel/DAbCdEf123/"
    assert res["container_id"] == "cont_555"
    created = mock.posted(f"{IG_USER}/media")[0]
    assert created["media_type"] == ["REELS"]
    assert created["video_url"] == [VIDEO_URL]
    assert created["caption"] == [CAPTION]
    assert created["share_to_feed"] == ["true"]
    assert created["thumb_offset"] == ["1500"]
    assert mock.posted("media_publish")[0]["creation_id"] == ["cont_555"]
    polls = [c for c in mock.calls if c.method == "GET" and c.url.path.endswith("cont_555")]
    assert len(polls) == 3


async def test_trial_reel_sends_trial_params_and_never_shares_to_feed():
    mock = GraphMock(
        {
            ("GET", f"{IG_USER}/content_publishing_limit"): _limit_ok(),
            ("POST", f"{IG_USER}/media"): _ok({"id": "cont_trial"}),
            ("GET", "cont_trial"): _ok({"status_code": "FINISHED"}),
            ("POST", f"{IG_USER}/media_publish"): _ok({"id": "media_trial"}),
            ("GET", "media_trial"): _ok({"permalink": "https://www.instagram.com/reel/Trial1/"}),
        }
    )
    mgr, tok = _token("proj-ig-trial")
    res = await _connector(mock, ig_user_id=IG_USER).publish(
        "proj-ig-trial",
        _payload(media_url=VIDEO_URL, share_to_feed=True, trial_params={"graduation_strategy": "MANUAL"}),
        hitl_token=tok,
        security_manager=mgr,
    )
    assert res["status"] == "PUBLISHED" and res["trial_reel"] is True
    created = mock.posted(f"{IG_USER}/media")[0]
    assert json.loads(created["trial_params"][0]) == {"graduation_strategy": "MANUAL"}
    assert created["share_to_feed"] == ["false"]
    assert not any(c.url.path.endswith("/me") for c in mock.calls)


async def test_container_error_fails_cleanly_with_meta_message_and_never_publishes():
    mock = GraphMock(
        {
            ("GET", f"{IG_USER}/content_publishing_limit"): _limit_ok(),
            ("POST", f"{IG_USER}/media"): _ok({"id": "cont_bad"}),
            ("GET", "cont_bad"): _ok({"status_code": "ERROR", "status": "Error: video codec not supported"}),
        }
    )
    mgr, tok = _token("proj-ig-err")
    with pytest.raises(InstagramApiError) as excinfo:
        await _connector(mock, ig_user_id=IG_USER).publish(
            "proj-ig-err", _payload(media_url=VIDEO_URL), hitl_token=tok, security_manager=mgr
        )
    assert "ERROR" in str(excinfo.value)
    assert "video codec not supported" in str(excinfo.value)
    assert mock.posted("media_publish") == []


async def test_rate_limit_code_4_raises_typed_error_with_one_hour_retry_after():
    mock = GraphMock(
        {
            ("GET", f"{IG_USER}/content_publishing_limit"): _limit_ok(),
            ("POST", f"{IG_USER}/media"): lambda _r: httpx.Response(
                400, json={"error": {"message": "Application request limit reached", "code": 4}}
            ),
        }
    )
    mgr, tok = _token("proj-ig-limit")
    with pytest.raises(SocialRateLimitError) as excinfo:
        await _connector(mock, ig_user_id=IG_USER).publish(
            "proj-ig-limit", _payload(media_url=VIDEO_URL), hitl_token=tok, security_manager=mgr
        )
    assert excinfo.value.retry_after == 3600
    assert excinfo.value.code == 4
    assert "Application request limit reached" in str(excinfo.value)
    # Exactly one attempt: no retry loop.
    assert len(mock.posted(f"{IG_USER}/media")) == 1


async def test_abuse_code_368_pauses_24_hours():
    mock = GraphMock(
        {
            ("GET", f"{IG_USER}/content_publishing_limit"): lambda _r: httpx.Response(
                400, json={"error": {"message": "Temporarily blocked", "code": 368}}
            ),
        }
    )
    mgr, tok = _token("proj-ig-368")
    with pytest.raises(SocialRateLimitError) as excinfo:
        await _connector(mock, ig_user_id=IG_USER).publish(
            "proj-ig-368", _payload(media_url=VIDEO_URL), hitl_token=tok, security_manager=mgr
        )
    assert excinfo.value.retry_after == 86400


async def test_publishing_quota_exhausted_stops_before_creating_containers():
    mock = GraphMock(
        {
            ("GET", f"{IG_USER}/content_publishing_limit"): _ok(
                {"data": [{"quota_usage": 100, "config": {"quota_total": 100}}]}
            ),
        }
    )
    mgr, tok = _token("proj-ig-quota")
    with pytest.raises(SocialRateLimitError):
        await _connector(mock, ig_user_id=IG_USER).publish(
            "proj-ig-quota", _payload(media_url=VIDEO_URL), hitl_token=tok, security_manager=mgr
        )
    assert mock.posted(f"{IG_USER}/media") == []


async def test_without_token_returns_not_configured_without_any_url_or_http_call():
    def _no_http(_req: httpx.Request) -> httpx.Response:
        raise AssertionError("No HTTP call expected without token")

    connector = MetaGraphConnector("", transport=httpx.MockTransport(_no_http))
    mgr, tok = _token("proj-ig-none")
    res = await connector.publish("proj-ig-none", _payload(media_url=VIDEO_URL), hitl_token=tok, security_manager=mgr)
    assert res["status"] == "NOT_CONFIGURED"
    assert res["external_platform_id"] is None
    assert res["canonical_url"] is None
    assert res["auth_verified"] is False
    assert res["message"] == "Instagram no está conectado: añade el token en Ajustes"


async def test_carousel_with_one_child_is_a_validation_error_before_any_call():
    def _no_http(_req: httpx.Request) -> httpx.Response:
        raise AssertionError("No HTTP call expected for an invalid carousel")

    connector = MetaGraphConnector("ig_live_mock_token", ig_user_id=IG_USER, transport=httpx.MockTransport(_no_http))
    mgr, tok = _token("proj-ig-carousel-1")
    with pytest.raises(ValueError, match="de 2 a 20"):
        await connector.publish(
            "proj-ig-carousel-1",
            _payload(media_type="CAROUSEL", media_urls=["https://media.example.com/c/01.jpg"]),
            hitl_token=tok,
            security_manager=mgr,
        )


async def test_carousel_happy_path_creates_children_then_parent():
    child_ids = iter(["child_1", "child_2", "parent_1"])
    mock = GraphMock(
        {
            ("GET", f"{IG_USER}/content_publishing_limit"): _limit_ok(),
            ("POST", f"{IG_USER}/media"): lambda _r: httpx.Response(200, json={"id": next(child_ids)}),
            ("GET", "child_1"): _ok({"status_code": "FINISHED"}),
            ("GET", "child_2"): _ok({"status_code": "FINISHED"}),
            ("GET", "parent_1"): _ok({"status_code": "FINISHED"}),
            ("POST", f"{IG_USER}/media_publish"): _ok({"id": "media_c"}),
            ("GET", "media_c"): _ok({"permalink": "https://www.instagram.com/p/Carr1/"}),
        }
    )
    mgr, tok = _token("proj-ig-carousel")
    res = await _connector(mock, ig_user_id=IG_USER).publish(
        "proj-ig-carousel",
        _payload(media_urls=["https://media.example.com/c/01.jpg", "https://media.example.com/c/02.jpeg"]),
        hitl_token=tok,
        security_manager=mgr,
    )
    assert res["status"] == "PUBLISHED" and res["media_type"] == "CAROUSEL"
    assert res["canonical_url"] == "https://www.instagram.com/p/Carr1/"
    created = mock.posted(f"{IG_USER}/media")
    assert created[0]["is_carousel_item"] == ["true"]
    assert created[2]["media_type"] == ["CAROUSEL"]
    assert created[2]["children"] == ["child_1,child_2"]


@pytest.mark.parametrize(
    "media_url",
    [
        "C:/media_workspace/out/reel.mp4",
        "data:video/mp4;base64,AAAA",
        "http://localhost:8000/media/reel.mp4",
        "https://127.0.0.1/reel.mp4",
    ],
)
async def test_non_public_media_fails_with_clear_spanish_error(media_url: str):
    def _no_http(_req: httpx.Request) -> httpx.Response:
        raise AssertionError("Nothing must be published half-way")

    connector = MetaGraphConnector("ig_live_mock_token", ig_user_id=IG_USER, transport=httpx.MockTransport(_no_http))
    mgr, tok = _token("proj-ig-local")
    with pytest.raises(ValueError, match="tiene que estar en una URL pública"):
        await connector.publish(
            "proj-ig-local", _payload(media_url=media_url, media_type="REELS"), hitl_token=tok, security_manager=mgr
        )


async def test_png_image_is_rejected_because_instagram_only_accepts_jpeg():
    def _no_http(_req: httpx.Request) -> httpx.Response:
        raise AssertionError("No HTTP call expected")

    connector = MetaGraphConnector("ig_live_mock_token", ig_user_id=IG_USER, transport=httpx.MockTransport(_no_http))
    mgr, tok = _token("proj-ig-png")
    with pytest.raises(ValueError, match="JPEG"):
        await connector.publish(
            "proj-ig-png", _payload(media_url="https://media.example.com/post.png"), hitl_token=tok, security_manager=mgr
        )


async def test_fetch_profile_uses_graph_instagram_me_with_user_id():
    mock = GraphMock({("GET", "me"): _ok({"user_id": IG_USER, "username": "kikegallego_"})})
    me = await _connector(mock).fetch_profile()
    assert me == {"user_id": IG_USER, "username": "kikegallego_"}
    assert mock.calls[0].url.params["fields"] == "user_id,username"


# ---------- Best time heatmap: real analytics only ----------


def test_best_time_heatmap_without_analytics_is_empty_not_benchmark():
    from app.services.publishing_scheduler import compute_best_time_heatmap

    res = compute_best_time_heatmap("Instagram", [], tz="Europe/Madrid")
    assert res.source == "empty"
    assert len(res.grid) == 168
    assert all(slot.score == 0 for slot in res.grid)
    assert res.peak_slot["score"] == 0


def test_best_time_heatmap_uses_only_measured_snapshots():
    from datetime import datetime, timezone
    from types import SimpleNamespace

    from app.services.publishing_scheduler import compute_best_time_heatmap

    measured = SimpleNamespace(
        recorded_at=datetime(2026, 11, 25, 19, 0, tzinfo=timezone.utc),  # Wednesday 20:00 Madrid
        outlier_multiplier=None,
        hold_rate_3s=70.0,
        completion_rate=50.0,
    )
    no_metrics = SimpleNamespace(
        recorded_at=datetime(2026, 11, 24, 9, 0, tzinfo=timezone.utc),
        outlier_multiplier=None,
        hold_rate_3s=None,
        completion_rate=None,
    )
    res = compute_best_time_heatmap("Instagram", [measured, no_metrics], tz="Europe/Madrid")
    assert res.source == "analytics"
    non_zero = [s for s in res.grid if s.score > 0]
    assert len(non_zero) == 1
    assert (non_zero[0].day_of_week, non_zero[0].hour, non_zero[0].score) == (2, 20, 60)
    assert res.peak_slot == {"day_label": "Mié", "hour": 20, "score": 60}


# ---------- Validation hardening ----------


async def test_image_type_with_video_url_is_rejected():
    def _no_http(_req: httpx.Request) -> httpx.Response:
        raise AssertionError("No HTTP call expected")

    connector = MetaGraphConnector("ig_live_mock_token", ig_user_id=IG_USER, transport=httpx.MockTransport(_no_http))
    mgr, tok = _token("proj-ig-image-mp4")
    with pytest.raises(ValueError, match="no puede llevar un vídeo"):
        await connector.publish(
            "proj-ig-image-mp4", _payload(media_type="IMAGE", media_url=VIDEO_URL), hitl_token=tok, security_manager=mgr
        )


def test_media_urls_with_single_item_is_not_a_carousel():
    media_type, urls, _ = MetaGraphConnector._media_spec(_payload(media_urls=[VIDEO_URL]))
    assert (media_type, urls) == ("REELS", [VIDEO_URL])
    media_type, _, _ = MetaGraphConnector._media_spec(_payload(media_urls=["https://media.example.com/a.jpg"]))
    assert media_type == "IMAGE"


@pytest.mark.parametrize(
    "ref",
    [
        "s3:///reels/reel.mp4",  # empty bucket
        "s3://another-bucket/reels/reel.mp4",  # not the configured bucket
        "https://localhost./reel.mp4",
        "https://127.1/reel.mp4",
        "https://2130706433/reel.mp4",
        "https://intranet/reel.mp4",
        "https://10.0.0.5/reel.mp4",
        "https://[::1]/reel.mp4",
    ],
)
def test_resolve_public_media_url_rejects_non_public_references(ref: str):
    from app.services.social_connectors import resolve_public_media_url

    with pytest.raises(ValueError, match="URL pública"):
        resolve_public_media_url(ref, "vídeo")


def test_resolve_public_media_url_keeps_public_https():
    from app.services.social_connectors import resolve_public_media_url

    assert resolve_public_media_url(VIDEO_URL) == VIDEO_URL


def test_connector_prefers_ig_user_id_bound_to_saved_token():
    from app.schemas.contracts import SocialChannel
    from app.services.social_connectors import get_connector_for_channel

    conn = get_connector_for_channel(SocialChannel.INSTAGRAM, access_token_override="tok", person_urn_override="1784199")
    assert conn.ig_user_id == "1784199"


def test_default_video_poll_timeout_matches_ig_mjs():
    assert MetaGraphConnector("tok").video_poll_timeout == 900


def test_linkedin_template_never_invents_a_link_in_first_comment():
    from app.schemas.contracts import ConversionGoal
    from app.services.social_connectors import SocialCopyCraftEngine

    engine = SocialCopyCraftEngine(profile={})
    post = engine.generate_linkedin("Titular", ["Punto uno", "Punto dos"], ConversionGoal.EMAIL_LEAD_CAPTURE)
    assert "contentengine.local" not in (post["first_comment"] or "")


# ---------- /social/publish: partial failure, idempotent retry and shared pause ----------


@pytest.fixture
def api_client():
    import asyncio

    from fastapi.testclient import TestClient
    from sqlalchemy import delete

    from app.db.session import AsyncSessionLocal
    from app.main import app
    from app.models.entities import AuditLog
    from app.services import publishing_scheduler

    publishing_scheduler._CHANNEL_PAUSED_UNTIL.clear()
    with TestClient(app) as client:
        yield client
    publishing_scheduler._CHANNEL_PAUSED_UNTIL.clear()

    # Remove the durable pause rows these tests create so other tests are not paused.
    async def _cleanup() -> None:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(AuditLog).where(AuditLog.operation_status == "RATE_LIMITED"))
            await db.commit()

    asyncio.run(_cleanup())


def _prepare_ig_and_linkedin_posts(client) -> str:
    resp = client.post(
        "/api/v1/publishing/posts",
        json={
            "channels": ["Instagram", "LinkedIn"],
            "title": "Tres errores al automatizar",
            "post_body": "Tres errores al automatizar tu negocio.\n\nTexto sin enlaces. #Automatizacion #IA #Pymes",
            "hashtags": ["#Automatizacion", "#IA", "#Pymes"],
            "media_url": VIDEO_URL,
            "publish_mode": "DRAFT",
            "timezone": "Europe/Madrid",
            "auto_publish": False,
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["posts"][0]["project_id"]


def _publish(client, pid: str):
    tok = HITLSecurityManager().issue_hitl_token(
        project_id=pid, tier=3, action="publish_all_channels", actor="creator"
    )["token"]
    return client.post(
        "/api/v1/social/publish",
        json={"project_id": pid, "channels": ["Instagram", "LinkedIn"], "hitl_token": tok, "actor": "creator"},
    )


def _posts_by_channel(client, pid: str) -> dict[str, dict[str, Any]]:
    detail = client.get(f"/api/v1/projects/{pid}").json()
    return {p["channel"]: p for p in detail["social_posts"]}


IG_PUBLISHED = {
    "status": "PUBLISHED",
    "mode": "live_oauth2",
    "channel": "Instagram",
    "external_platform_id": "media_999",
    "canonical_url": "https://www.instagram.com/reel/DAbCdEf123/",
    "auth_verified": True,
}


def test_publish_keeps_instagram_when_linkedin_fails_and_retry_does_not_republish(api_client):
    from unittest.mock import AsyncMock, patch

    from app.core.config import get_settings
    from app.services.social_connectors import LinkedInUGCConnector, SocialPublishError

    pid = _prepare_ig_and_linkedin_posts(api_client)
    ig_mock = AsyncMock(return_value=dict(IG_PUBLISHED))
    li_mock = AsyncMock(side_effect=SocialPublishError("LinkedIn no devolvió el id de la publicación."))
    with (
        patch.object(get_settings(), "instagram_access_token", "mock_ig_live_token"),
        patch.object(get_settings(), "linkedin_access_token", "mock_li_live_token"),
        patch.object(MetaGraphConnector, "_dispatch_oauth_request", new=ig_mock),
        patch.object(LinkedInUGCConnector, "_dispatch_oauth_request", new=li_mock),
    ):
        first = _publish(api_client, pid)
        assert first.status_code == 200, first.text
        body = first.json()
        assert body["status"] == "PARTIALLY_PUBLISHED"
        by_ch = {p["channel"]: p for p in body["publications"]}
        assert by_ch["Instagram"]["status"] == "PUBLISHED"
        assert by_ch["LinkedIn"]["status"] == "FAILED"

        posts = _posts_by_channel(api_client, pid)
        assert posts["Instagram"]["publish_status"] == "PUBLISHED"
        assert posts["Instagram"]["external_platform_id"] == "media_999"
        assert posts["LinkedIn"]["publish_status"] == "FAILED"

        second = _publish(api_client, pid)
        assert second.status_code == 200, second.text
        again = {p["channel"]: p for p in second.json()["publications"]}
        assert again["Instagram"]["already_published"] is True
        assert ig_mock.await_count == 1  # Instagram was never called again
        assert li_mock.await_count == 2


def test_rate_limit_is_reported_with_retry_after_and_pauses_the_channel(api_client):
    from unittest.mock import AsyncMock, patch

    from app.core.config import get_settings
    from app.services import publishing_scheduler
    from app.services.social_connectors import LinkedInUGCConnector

    pid = _prepare_ig_and_linkedin_posts(api_client)
    ig_mock = AsyncMock(
        side_effect=SocialRateLimitError("Instagram: límite (código 4). Pausa de 1 h.", retry_after=3600, code=4)
    )
    li_mock = AsyncMock(
        return_value={
            "status": "PUBLISHED",
            "mode": "live_oauth2",
            "channel": "LinkedIn",
            "external_platform_id": "urn:li:share:42",
            "canonical_url": "https://www.linkedin.com/feed/update/urn:li:share:42/",
            "auth_verified": True,
        }
    )
    with (
        patch.object(get_settings(), "instagram_access_token", "mock_ig_live_token"),
        patch.object(get_settings(), "linkedin_access_token", "mock_li_live_token"),
        patch.object(MetaGraphConnector, "_dispatch_oauth_request", new=ig_mock),
        patch.object(LinkedInUGCConnector, "_dispatch_oauth_request", new=li_mock),
    ):
        first = _publish(api_client, pid)
        assert first.status_code == 200, first.text
        assert first.headers["Retry-After"] == "3600"
        by_ch = {p["channel"]: p for p in first.json()["publications"]}
        assert by_ch["Instagram"]["status"] == "RATE_LIMITED"
        assert by_ch["Instagram"]["retry_after"] == 3600
        assert by_ch["LinkedIn"]["status"] == "PUBLISHED"
        assert _posts_by_channel(api_client, pid)["LinkedIn"]["publish_status"] == "PUBLISHED"

        # The pause is durable (audit row) and shared: even with the in-memory cache cleared, no new call.
        publishing_scheduler._CHANNEL_PAUSED_UNTIL.clear()
        second = _publish(api_client, pid)
        assert second.status_code == 200
        assert int(second.headers["Retry-After"]) > 3500
        assert {p["channel"]: p for p in second.json()["publications"]}["Instagram"]["status"] == "RATE_LIMITED"
        assert ig_mock.await_count == 1
        assert li_mock.await_count == 1
