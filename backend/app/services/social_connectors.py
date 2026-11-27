"""Algorithmic Multi-Channel Copycrafting, Preflight Validation, and OAuth2 Social Connectors."""

from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import json
import re
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import quote, urlparse

import httpx

from app.core.config import get_settings
from app.core.security import HITLSecurityManager
from app.schemas.contracts import ConversionGoal, PreflightCheckResult, SocialChannel
from app.services.domain_engines import get_cta_for_goal
from app.workers.media_pipeline import NATIVE_EDITOR_SIGNATURES


URL_PATTERN = re.compile(r"https?://\S+", re.IGNORECASE)


class SocialCopyCraftEngine:
    """Generates anti-penalty, algorithm-aligned copy across YouTube, Instagram, TikTok & LinkedIn."""

    def __init__(self, profile: dict[str, Any] | None = None) -> None:
        self.profile = profile or get_settings().load_creator_profile_file()

    def generate_youtube(
        self,
        title: str,
        summary: str,
        chapters: list[dict[str, str]],
        goal: ConversionGoal,
    ) -> dict[str, Any]:
        clean_title = title.strip()
        if len(clean_title) >= 60:
            clean_title = clean_title[:56].rstrip() + "..."
        cta_text = get_cta_for_goal(self.profile, goal)

        lines = [
            summary[:150].strip(),
            "",
            "📌 MARCAS DE TIEMPO:",
        ]
        if not chapters:
            chapters = [{"time": "00:00", "title": "Gancho y Tesis"}]
        for ch in chapters:
            lines.append(f"{ch.get('time', '00:00')} - {ch.get('title', 'Bloque')}")

        lines.extend(
            [
                "",
                "🚀 RECURSO DESTACADO:",
                cta_text,
                "",
                "#SistemasIA #Productividad #ContentEngine",
            ]
        )
        return {
            "channel": SocialChannel.YOUTUBE.value,
            "title": clean_title,
            "post_body": "\n".join(lines),
            "first_comment": None,
            "hashtags": ["#SistemasIA", "#Productividad", "#ContentEngine"],
            "metadata_payload": {
                "privacy_status": "unlisted",
                "notify_subscribers": True,
                "ab_test_enabled": True,
                "chapters_count": len(chapters),
                "native_editor_fingerprint": NATIVE_EDITOR_SIGNATURES["YouTube"],
            },
        }

    def generate_instagram(
        self,
        hook_first_line: str,
        core_value: str,
        goal: ConversionGoal,
    ) -> dict[str, Any]:
        hook = hook_first_line.strip()
        if len(hook) > 120:
            hook = hook[:117].rstrip() + "..."
        cta_text = get_cta_for_goal(self.profile, goal)
        hashtags = ["#SistemasIA", "#Solopreneur", "#ProductividadDigital", "#Automatizacion"]

        body_lines = [
            hook,
            "",
            core_value.strip(),
            "",
            "👇 CÓMO APLICARLO:",
            f"1. {cta_text}",
            "2. Envíale este Reel por DM a ese socio que todavía opera todo manual.",
            "",
            "Guarda este video para tu próxima sesión estratégica. 📌",
            "",
            " ".join(hashtags),
        ]
        return {
            "channel": SocialChannel.INSTAGRAM.value,
            "title": hook,
            "post_body": "\n".join(body_lines),
            "first_comment": None,
            "hashtags": hashtags,
            "metadata_payload": {
                "first_line_chars": len(hook),
                "share_to_feed": True,
                "target_metric": "Sends per Reach (>2.0%)",
                "native_editor_fingerprint": NATIVE_EDITOR_SIGNATURES["Instagram"],
            },
        }

    def generate_tiktok(
        self,
        seo_query_phrase: str,
        debate_question: str,
        goal: ConversionGoal,
    ) -> dict[str, Any]:
        search_hook = seo_query_phrase.strip()[:95].rstrip()
        cta_text = get_cta_for_goal(self.profile, goal)
        hashtags = ["#AprendeEnTikTok", "#SistemasIA", "#NegociosDigitales"]
        raw_caption = f"{search_hook}. {debate_question.strip()} {cta_text} {' '.join(hashtags)}"
        if len(raw_caption) > 300:
            raw_caption = raw_caption[:297].rstrip() + "..."

        return {
            "channel": SocialChannel.TIKTOK.value,
            "title": search_hook,
            "post_body": raw_caption,
            "first_comment": None,
            "hashtags": hashtags,
            "metadata_payload": {
                "search_first_100": raw_caption[:100],
                "allow_duet": True,
                "allow_stitch": True,
                "allow_comments": True,
                "target_metric": "Completion Rate & Loop Rate",
                "native_editor_fingerprint": NATIVE_EDITOR_SIGNATURES["TikTok"],
            },
        }

    @staticmethod
    def _clean_context_paragraph(text: str) -> str:
        """Remove prompt-wrapper prefixes while keeping the author's real story intact."""
        cleaned = URL_PATTERN.sub("[enlace en 1er comentario]", text.strip())
        cleaned = re.sub(
            r"^(?:Contexto afinado por Copiloto Estratega:\s*|Publicaci[oó]n en LinkedIn sobre[^:\n]*:\s*|"
            r"La idea es (?:comentar|explicar|hablar|contar|redactar|escribir)\s+(?:c[oó]mo\s+|que\s+|sobre\s+)?|"
            r"(?:Quiero|Necesito|Voy a)\s+(?:redactar|crear|escribir|publicar|comentar)\s+(?:un\s+)?(?:post|publicaci[oó]n)\s+(?:en\s+linkedin\s+)?(?:sobre|indicando|explicando|donde)?\s*)",
            "",
            cleaned,
            flags=re.IGNORECASE,
        ).strip()
        if cleaned and cleaned[0].islower():
            cleaned = cleaned[0].upper() + cleaned[1:]
        return cleaned

    @staticmethod
    def _extract_dynamic_hashtags(headline: str, notes: str) -> list[str]:
        corpus = f"{headline} {notes}".lower()
        tag_rules: list[tuple[str, tuple[str, ...]]] = [
            ("#HERO24", ("hero24", "heroe", "héroe")),
            ("#Servicios", ("fontanero", "electricista", "reforma", "servicios", "profesionales", "albañil", "mudanza")),
            ("#Productividad", ("horas", "tiempo", "optimiz", "productividad", "factur", "contabilidad")),
            ("#CaptacionClientes", ("clientes", "captación", "captacion", "presupuesto", "boca-oreja")),
            ("#PymesEspaña", ("españa", "pyme", "negocio", "empresa")),
            ("#B2B", ("b2b", "ventas", "leads", "inbound", "growth")),
            ("#IA", ("inteligencia artificial", " ia ", "automatiz")),
            ("#Liderazgo", ("liderazgo", "equipo", "estrategia", "crecimiento")),
        ]
        tags: list[str] = []
        for tag, keywords in tag_rules:
            if any(k in corpus for k in keywords) and tag not in tags:
                tags.append(tag)
            if len(tags) >= 5:
                break
        if len(tags) < 3:
            for fallback_tag in ("#Crecimiento", "#Negocios", "#Estrategia"):
                if fallback_tag not in tags:
                    tags.append(fallback_tag)
                if len(tags) >= 3:
                    break
        return tags

    def generate_linkedin(
        self,
        headline: str,
        thesis_points: list[str],
        goal: ConversionGoal,
        context_notes: str | None = None,
    ) -> dict[str, Any]:
        clean_headline = self._clean_context_paragraph(headline) if headline else ""
        hook = (clean_headline or headline.strip())[:135].rstrip()
        cta_text = get_cta_for_goal(self.profile, goal)
        raw_notes = (context_notes or "").strip()

        if raw_notes and len(raw_notes) > 30:
            raw_paragraphs = [
                p.strip()
                for p in re.split(r"\n\s*\n+", raw_notes)
                if p.strip()
            ]
            # If the user wrote a single dense block, split into readable 2-sentence paragraphs
            if len(raw_paragraphs) == 1 and len(raw_paragraphs[0]) > 260:
                sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", raw_paragraphs[0]) if s.strip()]
                raw_paragraphs = [
                    " ".join(sentences[i : i + 2])
                    for i in range(0, len(sentences), 2)
                ]

            formatted_paragraphs: list[str] = []
            for idx, para in enumerate(raw_paragraphs):
                clean_p = self._clean_context_paragraph(para)
                clean_p = re.sub(
                    r"^[-•]\s*(Objetivo|Tesis|Llamada a la acci[oó]n|Reflexi[oó]n|Nuevo enfoque|Anuncio|CTA B2B):\s*",
                    "",
                    clean_p,
                    flags=re.IGNORECASE,
                ).strip()
                if not clean_p:
                    continue
                if idx == len(raw_paragraphs) - 1 and any(
                    tok in clean_p.lower() for tok in ("dm", "mensaje", "escrib", "coment", "contact")
                ):
                    formatted_paragraphs.append(f"👉 {clean_p}")
                else:
                    formatted_paragraphs.append(clean_p)

            hashtags = self._extract_dynamic_hashtags(hook, raw_notes)
            body_lines: list[str] = []
            for para in formatted_paragraphs:
                body_lines.append(para)
                body_lines.append("")

            has_question = any("?" in p for p in formatted_paragraphs)
            if not has_question:
                body_lines.append("💬 ¿Te encuentras con esta misma situación en tu sector? Te leo en comentarios.")
                body_lines.append("")

            body_lines.append(" ".join(hashtags))

            found_urls = URL_PATTERN.findall(raw_notes)
            if found_urls:
                first_comment = f"👉 Enlace mencionado en la publicación: {found_urls[0]}"
            elif goal == ConversionGoal.B2B_INBOUND_CONVERSATION or any(
                tok in raw_notes.lower() for tok in ("dm", "mensaje", "escrib", "registr")
            ):
                first_comment = (
                    "Si quieres que lo comentemos para tu caso concreto, escríbeme por mensaje directo "
                    "o deja un comentario aquí abajo y te respondo personalmente."
                )
            else:
                first_comment = f"👉 {cta_text}"
        else:
            hashtags = ["#Sistemas", "#Automatizacion", "#LiderazgoDigital"]
            body_lines = [
                "La mayoría de los operadores confunden volumen de horas con apalancamiento real.",
                "",
                "Lo que aplican los equipos de alto rendimiento en 2026:",
                "",
            ]
            for pt in thesis_points[:4]:
                clean_pt = URL_PATTERN.sub("[recurso en 1er comentario]", pt.strip())
                body_lines.append(f"• {clean_pt}")

            body_lines.extend(
                [
                    "",
                    "La infraestructura absorbe el trabajo repetitivo para que el criterio humano decida.",
                    "",
                    "¿Dónde pierdes más horas operativas esta semana? Te leo en comentarios.",
                    "",
                    " ".join(hashtags),
                ]
            )
            # No real link available here: never invent one. The CTA comes from the creator profile.
            first_comment = f"👉 {cta_text}" if cta_text else None

        return {
            "channel": SocialChannel.LINKEDIN.value,
            "title": hook,
            "post_body": "\n".join(body_lines).strip(),
            "first_comment": first_comment,
            "hashtags": hashtags,
            "metadata_payload": {
                "has_link_in_body": False,
                "pdf_carousel_supported": True,
                "target_metric": "Dwell Time & Qualified Comments",
            },
        }

    def generate_x_twitter(
        self,
        headline: str,
        thesis_points: list[str],
        goal: ConversionGoal,
    ) -> dict[str, Any]:
        """Generate an X (Twitter) high-signal thread opener with follow-up CTA reply."""
        hook = headline.strip()[:140]
        cta_text = get_cta_for_goal(self.profile, goal)
        hashtags = ["#SistemasIA", "#BuildInPublic"]

        bullets = [
            f"→ {URL_PATTERN.sub('[enlace en respuesta]', pt.strip())}"
            for pt in thesis_points[:3]
            if pt and pt.strip()
        ]
        parts = [hook]
        if bullets:
            parts.extend(["", *bullets])
        parts.extend(["", "🧵 Hilo técnico 👇"])
        thread_opener = "\n".join(parts)
        if len(thread_opener) > 280:
            thread_opener = thread_opener[:277].rstrip() + "..."

        first_reply = f"{cta_text} {' '.join(hashtags)}".strip()
        return {
            "channel": "X",
            "title": hook[:100],
            "post_body": thread_opener,
            "first_comment": first_reply,
            "hashtags": hashtags,
            "metadata_payload": {
                "format": "thread_opener",
                "char_count": len(thread_opener),
                "has_link_in_opener": False,
                "target_metric": "Bookmarks & Thread Engagement",
            },
        }

    def generate_all_channels(
        self,
        headline: str,
        core_value: str,
        debate_question: str,
        thesis_points: list[str],
        chapters: list[dict[str, str]],
        goal: ConversionGoal,
        context_notes: str | None = None,
    ) -> list[dict[str, Any]]:
        return [
            self.generate_youtube(headline, core_value, chapters, goal),
            self.generate_instagram(headline, core_value, goal),
            self.generate_tiktok(headline, debate_question, goal),
            self.generate_linkedin(headline, thesis_points, goal, context_notes=context_notes),
        ]


def validate_preflight(channel: SocialChannel, post_data: dict[str, Any]) -> PreflightCheckResult:
    """Enforce platform anti-penalty preflight rules before HITL Tier 3 release."""
    warnings: list[str] = []
    blocking_errors: list[str] = []

    body = post_data.get("post_body", "")
    title = post_data.get("title") or ""
    hashtags = post_data.get("hashtags") or []

    # Validaciones técnicas de formato audiovisual (patrón adaptado de gitroomhq/postiz-app)
    media = post_data.get("media_qc") or post_data.get("media_metadata") or {}
    duration = float(media.get("duration_sec", 0.0))
    res = str(media.get("resolution", ""))

    if channel in (SocialChannel.TIKTOK, SocialChannel.INSTAGRAM):
        if res and res != "1080x1920" and "x" in res:
            try:
                w, h = [int(p) for p in res.split("x")[:2]]
                if w > h:
                    blocking_errors.append(
                        f"BLOQUEO PRE-VUELO [{channel.value}]: El video debe ser vertical 9:16 (detectado formato apaisado {res})."
                    )
            except Exception:
                pass

    if channel == SocialChannel.LINKEDIN:
        if URL_PATTERN.search(body):
            blocking_errors.append(
                "BLOQUEO PRE-VUELO [LinkedIn]: Se detectó un enlace en el cuerpo principal. "
                "Muévelo al primer comentario para evitar penalización de alcance."
            )
        if not post_data.get("first_comment"):
            warnings.append("Sugerencia LinkedIn: Agrega el CTA o enlace en el primer comentario.")

    elif channel == SocialChannel.INSTAGRAM:
        first_line = body.splitlines()[0] if body.splitlines() else ""
        if len(first_line) > 120:
            blocking_errors.append(
                f"BLOQUEO PRE-VUELO [Instagram]: La primera línea tiene {len(first_line)} caracteres "
                "(máximo 120 antes del pliegue '...más')."
            )
        if not (3 <= len(hashtags) <= 5):
            warnings.append(
                f"Advertencia Instagram: Se recomiendan 3 a 5 hashtags específicos (actual: {len(hashtags)})."
            )

    elif channel == SocialChannel.TIKTOK:
        if len(body) > 300:
            warnings.append(
                f"Advertencia TikTok: Descripción de {len(body)} caracteres (objetivo <= 300)."
            )
        if len(body[:100].strip()) < 20:
            blocking_errors.append(
                "BLOQUEO PRE-VUELO [TikTok]: Los primeros 100 caracteres deben contener frase indexable para TikTok Search."
            )

    elif channel == SocialChannel.YOUTUBE:
        if len(title) >= 60:
            blocking_errors.append(
                f"BLOQUEO PRE-VUELO [YouTube]: Título de {len(title)} caracteres excede el límite móvil (<60)."
            )
        if "00:00" not in body:
            warnings.append("Advertencia YouTube: Agrega marcas de tiempo empezando en 00:00 para retención.")

    return PreflightCheckResult(
        platform=channel,
        passed=len(blocking_errors) == 0,
        warnings=warnings,
        blocking_errors=blocking_errors,
    )


NOT_CONFIGURED_STATUS = "NOT_CONFIGURED"


class SocialPublishError(RuntimeError):
    """A platform API rejected the publication (message already readable for the creator)."""


class InstagramApiError(SocialPublishError):
    """Error returned by graph.instagram.com, with Meta's own message and code."""

    def __init__(self, message: str, code: int | None = None, subcode: int | None = None, http_status: int | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.subcode = subcode
        self.http_status = http_status


class SocialRateLimitError(InstagramApiError):
    """Meta rate limit or abuse block: pause the channel for retry_after seconds, never retry in a loop."""

    def __init__(self, message: str, retry_after: int, **kwargs: Any) -> None:
        super().__init__(message, **kwargs)
        self.retry_after = retry_after


class BaseSocialConnector:
    """Idempotent OAuth2 connector with exponential retry configuration."""

    channel: SocialChannel
    api_base: str

    def __init__(self, access_token: str = "") -> None:
        self.access_token = access_token

    def _idempotency_key(self, project_id: str, payload: dict[str, Any]) -> str:
        raw = f"{self.channel.value}|{project_id}|{payload.get('title', '')}|{payload.get('post_body', '')[:80]}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]

    async def publish(
        self,
        project_id: str,
        payload: dict[str, Any],
        hitl_token: str | None,
        actor: str = "creator",
        security_manager: HITLSecurityManager | None = None,
    ) -> dict[str, Any]:
        manager = security_manager or HITLSecurityManager()
        action = f"publish_{self.channel.value.lower()}"
        manager.require_valid_token(
            token=hitl_token,
            project_id=project_id,
            required_tier=3,
            action=action,
            actor=actor,
        )

        preflight = validate_preflight(self.channel, payload)
        if not preflight.passed:
            raise ValueError("; ".join(preflight.blocking_errors))

        idem_key = self._idempotency_key(project_id, payload)
        if self.access_token:
            return await self._dispatch_oauth_request(project_id, payload, idem_key)

        # Sin credenciales no se publica nada ni se inventa un resultado: estado explícito.
        return {
            "status": NOT_CONFIGURED_STATUS,
            "mode": "not_configured",
            "channel": self.channel.value,
            "external_platform_id": None,
            "canonical_url": None,
            "message": f"{self.channel.value} no está conectado: añade el token en Ajustes",
            "idempotency_key": idem_key,
            "preflight_warnings": preflight.warnings,
            "auth_verified": False,
        }

    async def _dispatch_oauth_request(
        self,
        project_id: str,
        payload: dict[str, Any],
        idempotency_key: str,
    ) -> dict[str, Any]:
        raise NotImplementedError


class YouTubeDataConnector(BaseSocialConnector):
    channel = SocialChannel.YOUTUBE
    api_base = "https://www.googleapis.com/upload/youtube/v3/videos"

    async def _dispatch_oauth_request(self, project_id: str, payload: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "X-Idempotency-Key": idempotency_key,
        }
        body = {
            "snippet": {
                "title": payload.get("title", "Autonomous Content"),
                "description": payload.get("post_body", ""),
                "tags": payload.get("hashtags", []),
            },
            "status": {"privacyStatus": payload.get("metadata_payload", {}).get("privacy_status", "unlisted")},
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(self.api_base, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
            vid = data.get("id")
            if not vid:
                raise SocialPublishError("YouTube no devolvió el id del vídeo: no se marca como publicado.")
            return {
                "status": "PUBLISHED",
                "mode": "live_oauth2",
                "channel": self.channel.value,
                "external_platform_id": vid,
                "canonical_url": f"https://youtube.com/watch?v={vid}",
                "idempotency_key": idempotency_key,
                "auth_verified": True,
            }


INSTAGRAM_RATE_LIMIT_CODES = {4, 17, 32, 613}
INSTAGRAM_ABUSE_CODE = 368
VIDEO_EXTENSIONS = (".mp4", ".mov")
JPEG_EXTENSIONS = (".jpg", ".jpeg")
NOT_PUBLIC_MEDIA_MESSAGE = (
    "El {kind} tiene que estar en una URL pública (https) para que Instagram lo descargue: "
    "súbelo a R2/S3 o a un alojamiento público. No se ha publicado nada."
)


def _url_extension(url: str) -> str:
    path = urlparse(url).path.lower()
    return PurePosixPath(path).suffix


def resolve_public_media_url(raw: str, kind: str = "archivo") -> str:
    """Return an Internet-reachable URL for a media reference, or raise ValueError (never publish half-way)."""
    ref = (raw or "").strip()
    not_public = ValueError(NOT_PUBLIC_MEDIA_MESSAGE.format(kind=kind))
    if not ref:
        raise not_public
    parsed = urlparse(ref)
    scheme = parsed.scheme.lower()

    if scheme in ("s3", "r2"):
        from app.services.storage_s3 import ObjectStorageService

        settings = get_settings()
        bucket = parsed.netloc
        key = parsed.path.lstrip("/")
        if not key or not bucket or bucket != settings.s3_bucket_name:
            raise not_public
        presigned = ObjectStorageService().presigned_public_get_url(key, settings.instagram_media_url_ttl_seconds)
        if not presigned:
            raise not_public
        return presigned

    if scheme == "https" and parsed.hostname:
        host = parsed.hostname.lower().rstrip(".")
        if host in ("localhost", "0.0.0.0") or host.endswith(".local") or host.endswith(".localhost"):
            raise not_public
        # Hosts without a dot ("intranet") or purely numeric/abbreviated IPs ("127.1", "2130706433")
        # are never a public CDN: reject them instead of guessing how they resolve.
        if "." not in host and ":" not in host:
            raise not_public
        if host.replace(".", "").isdigit():
            try:
                ip = ipaddress.ip_address(host)
            except ValueError:
                raise not_public
            if not ip.is_global:
                raise not_public
        elif ":" in host:
            try:
                ip6 = ipaddress.ip_address(host)
            except ValueError:
                raise not_public
            if not ip6.is_global:
                raise not_public
        return ref

    # data:, file://, http:// and local paths are not downloadable by Meta.
    raise not_public


class MetaGraphConnector(BaseSocialConnector):
    """Instagram API with Instagram Login (graph.instagram.com). Mirrors studio/meta/ig.mjs."""

    channel = SocialChannel.INSTAGRAM

    def __init__(
        self,
        access_token: str = "",
        ig_user_id: str = "",
        transport: httpx.AsyncBaseTransport | None = None,
        poll_interval_seconds: float | None = None,
        video_poll_timeout_seconds: float | None = None,
        image_poll_timeout_seconds: float | None = None,
    ) -> None:
        super().__init__(access_token)
        settings = get_settings()
        base_host = settings.instagram_graph_base_url.rstrip("/")
        if self._is_unified_token() and base_host == "https://graph.instagram.com":
            base_host = "https://graph.facebook.com"
        self.api_base = f"{base_host}/{settings.instagram_api_version}"
        self.ig_user_id = ig_user_id or settings.instagram_business_account_id
        self._transport = transport
        self.poll_interval = (
            settings.instagram_poll_interval_seconds if poll_interval_seconds is None else poll_interval_seconds
        )
        self.video_poll_timeout = (
            settings.instagram_video_poll_timeout_seconds if video_poll_timeout_seconds is None else video_poll_timeout_seconds
        )
        self.image_poll_timeout = (
            settings.instagram_image_poll_timeout_seconds if image_poll_timeout_seconds is None else image_poll_timeout_seconds
        )

    def _is_unified_token(self) -> bool:
        return self.access_token.strip().startswith("EAA")

    # ---------- HTTP ----------

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=30.0, transport=self._transport)

    @staticmethod
    def _raise_meta_error(resp: httpx.Response, body: dict[str, Any]) -> None:
        err = body.get("error") if isinstance(body, dict) else None
        err = err if isinstance(err, dict) else {}
        code = err.get("code")
        subcode = err.get("error_subcode")
        msg = err.get("message") or "Error de Meta"
        full = f"Instagram: {msg} (código {code if code is not None else '?'}"
        full += f"/{subcode}" if subcode else ""
        full += f", HTTP {resp.status_code})"
        if code == INSTAGRAM_ABUSE_CODE:
            raise SocialRateLimitError(full + ". Pausa de 24 h.", retry_after=86400, code=code, subcode=subcode, http_status=resp.status_code)
        if (
            code in INSTAGRAM_RATE_LIMIT_CODES
            or (isinstance(code, int) and 80000 <= code <= 80099)
            or resp.status_code == 429
        ):
            raise SocialRateLimitError(full + ". Pausa de 1 h.", retry_after=3600, code=code, subcode=subcode, http_status=resp.status_code)
        raise InstagramApiError(full, code=code, subcode=subcode, http_status=resp.status_code)

    async def _api(self, client: httpx.AsyncClient, method: str, endpoint: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.api_base}/{endpoint.lstrip('/')}"
        clean = {k: v for k, v in (params or {}).items() if v is not None}
        headers = {"Authorization": f"Bearer {self.access_token}"}
        if method == "GET":
            resp = await client.get(url, params=clean, headers=headers)
        else:
            form = {
                k: (json.dumps(v) if isinstance(v, (dict, list)) else ("true" if v is True else "false" if v is False else str(v)))
                for k, v in clean.items()
            }
            resp = await client.post(url, data=form, headers=headers)
        try:
            body = resp.json()
        except ValueError:
            body = {}
        if resp.status_code >= 400 or (isinstance(body, dict) and body.get("error")):
            self._raise_meta_error(resp, body)
        return body if isinstance(body, dict) else {}

    async def fetch_profile(self, client: httpx.AsyncClient | None = None) -> dict[str, Any]:
        """Resolve IG user_id and username for both Unified Login (EAA -> graph.facebook.com) and Instagram Login (IGAA)."""
        async def _run(c: httpx.AsyncClient) -> dict[str, Any]:
            if self._is_unified_token():
                assigned = await self._api(c, "GET", "me/assigned_instagram_accounts", {"fields": "id,username"})
                items = assigned.get("data") if isinstance(assigned.get("data"), list) else []
                acc = items[0] if items else None
                if not acc:
                    pages = await self._api(c, "GET", "me/accounts", {"fields": "instagram_business_account{id,username}"})
                    for p in pages.get("data") or []:
                        if isinstance(p, dict) and isinstance(p.get("instagram_business_account"), dict):
                            acc = p["instagram_business_account"]
                            break
                if not acc or not acc.get("id"):
                    raise InstagramApiError("No se encontró ninguna cuenta de Instagram asignada a este token Unified Login.")
                return {"user_id": str(acc["id"]), "id": str(acc["id"]), "username": str(acc.get("username") or "")}
            return await self._api(c, "GET", "me", {"fields": "user_id,username"})

        if client is None:
            async with self._client() as own:
                return await _run(own)
        return await _run(client)

    async def _ensure_user_id(self, client: httpx.AsyncClient) -> str:
        if self.ig_user_id:
            return self.ig_user_id
        me = await self.fetch_profile(client)
        user_id = str(me.get("user_id") or "").strip()
        if not user_id:
            raise InstagramApiError("Instagram no devolvió user_id para este token.")
        self.ig_user_id = user_id
        return user_id

    async def _check_publishing_limit(self, client: httpx.AsyncClient, ig_id: str) -> None:
        data = await self._api(client, "GET", f"{ig_id}/content_publishing_limit", {"fields": "config,quota_usage"})
        rows = data.get("data") or []
        if not rows:
            return
        usage = rows[0].get("quota_usage")
        total = (rows[0].get("config") or {}).get("quota_total")
        if isinstance(usage, int) and isinstance(total, int) and usage >= total:
            raise SocialRateLimitError(
                f"Instagram: has llegado al límite de {total} publicaciones por API en 24 h. Pausa de 1 h.",
                retry_after=3600,
            )

    async def _wait_container(self, client: httpx.AsyncClient, container_id: str, label: str, timeout: float) -> None:
        loop = asyncio.get_running_loop()
        start = loop.time()
        while True:
            c = await self._api(client, "GET", container_id, {"fields": "status_code,status"})
            code = c.get("status_code")
            if code == "FINISHED":
                return
            if code in ("ERROR", "EXPIRED"):
                raise InstagramApiError(f"Instagram no pudo procesar {label}: {code} · {c.get('status') or 'sin motivo'}")
            if loop.time() - start >= timeout:
                raise InstagramApiError(
                    f"Instagram tardó más de {int(timeout)} s en procesar {label} (último estado: {code or 'desconocido'}). No se ha publicado."
                )
            await asyncio.sleep(self.poll_interval)

    # ---------- payload ----------

    @staticmethod
    def _media_spec(payload: dict[str, Any]) -> tuple[str, list[str], dict[str, Any]]:
        meta = payload.get("metadata_payload") or {}

        def pick(key: str) -> Any:
            return payload.get(key) if payload.get(key) is not None else meta.get(key)

        urls_raw = pick("media_urls") or pick("carousel_media_urls")
        if isinstance(urls_raw, list):
            urls = [str(u) for u in urls_raw if u]
        else:
            single = pick("media_url") or pick("video_url") or pick("image_url")
            urls = [str(single)] if single else []
        requested = str(pick("ig_media_type") or pick("media_type") or "").strip().upper()
        if requested in ("REEL", "VIDEO"):
            requested = "REELS"
        if requested in ("CAROUSEL_ALBUM",):
            requested = "CAROUSEL"
        if not requested:
            if len(urls) > 1:
                requested = "CAROUSEL"
            elif urls and _url_extension(urls[0]) in VIDEO_EXTENSIONS:
                requested = "REELS"
            else:
                requested = "IMAGE"
        options = {
            "share_to_feed": pick("share_to_feed"),
            "thumb_offset": pick("thumb_offset"),
            "trial_params": pick("trial_params"),
            "cover_url": pick("cover_url"),
            "alt_text": pick("alt_text"),
        }
        return requested, urls, options

    @staticmethod
    def _validate_spec(media_type: str, urls: list[str]) -> None:
        if media_type not in ("REELS", "IMAGE", "CAROUSEL"):
            raise ValueError(f"Tipo de publicación de Instagram no soportado: {media_type}.")
        if not urls:
            raise ValueError("Instagram necesita un vídeo o una imagen (media_url) para publicar. No se ha publicado nada.")
        if media_type == "CAROUSEL" and not (2 <= len(urls) <= 20):
            raise ValueError(f"Un carrusel de Instagram lleva de 2 a 20 elementos (tiene {len(urls)}).")
        if media_type in ("REELS", "IMAGE") and len(urls) != 1:
            raise ValueError(f"Un {media_type.lower()} de Instagram lleva un solo archivo.")
        for u in urls:
            ext = _url_extension(u)
            if media_type == "IMAGE" and ext in VIDEO_EXTENSIONS:
                raise ValueError("Una publicación de imagen no puede llevar un vídeo: usa un reel.")
            if media_type == "REELS" and ext and ext not in VIDEO_EXTENSIONS:
                raise ValueError(f"Un reel necesita un vídeo MP4 o MOV (recibido {ext}).")
            if media_type in ("IMAGE", "CAROUSEL") and ext not in VIDEO_EXTENSIONS and ext not in JPEG_EXTENSIONS:
                raise ValueError(
                    f"Instagram solo acepta imágenes JPEG (recibido {ext or 'sin extensión'}). "
                    "Exporta la imagen como .jpg y vuelve a intentarlo."
                )

    # ---------- publish ----------

    async def _dispatch_oauth_request(self, project_id: str, payload: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        media_type, raw_urls, options = self._media_spec(payload)
        self._validate_spec(media_type, raw_urls)
        kind = "vídeo" if media_type == "REELS" else "archivo"
        urls = [resolve_public_media_url(u, kind) for u in raw_urls]
        cover_url = resolve_public_media_url(str(options["cover_url"]), "portada") if options.get("cover_url") else None
        caption = str(payload.get("post_body") or "")

        async with self._client() as client:
            ig_id = await self._ensure_user_id(client)
            await self._check_publishing_limit(client, ig_id)

            if media_type == "CAROUSEL":
                children: list[str] = []
                alt_texts = options.get("alt_text") if isinstance(options.get("alt_text"), list) else []
                for i, u in enumerate(urls):
                    is_video = _url_extension(u) in VIDEO_EXTENSIONS
                    params: dict[str, Any] = (
                        {"media_type": "VIDEO", "video_url": u, "is_carousel_item": True}
                        if is_video
                        else {"image_url": u, "is_carousel_item": True, "alt_text": alt_texts[i] if i < len(alt_texts) else None}
                    )
                    child = await self._api(client, "POST", f"{ig_id}/media", params)
                    await self._wait_container(
                        client, child["id"], f"la diapositiva {i + 1}",
                        self.video_poll_timeout if is_video else self.image_poll_timeout,
                    )
                    children.append(child["id"])
                container = await self._api(
                    client, "POST", f"{ig_id}/media",
                    {"media_type": "CAROUSEL", "children": ",".join(children), "caption": caption},
                )
                timeout = self.image_poll_timeout
            elif media_type == "REELS":
                params = {
                    "media_type": "REELS",
                    "video_url": urls[0],
                    "caption": caption,
                    "cover_url": cover_url,
                    "share_to_feed": options.get("share_to_feed"),
                    "thumb_offset": options.get("thumb_offset"),
                    "trial_params": options.get("trial_params"),
                }
                if params["trial_params"] is not None:
                    # A trial reel is only shown to non-followers: never also share it to the feed.
                    params["share_to_feed"] = False
                container = await self._api(client, "POST", f"{ig_id}/media", params)
                timeout = self.video_poll_timeout
            else:
                alt = options.get("alt_text")
                container = await self._api(
                    client, "POST", f"{ig_id}/media",
                    {"image_url": urls[0], "caption": caption, "alt_text": alt if isinstance(alt, str) else None},
                )
                timeout = self.image_poll_timeout

            container_id = str(container.get("id") or "")
            if not container_id:
                raise InstagramApiError("Instagram no devolvió el id del contenedor.")
            await self._wait_container(client, container_id, "la publicación", timeout)

            published = await self._api(client, "POST", f"{ig_id}/media_publish", {"creation_id": container_id})
            media_id = str(published.get("id") or "")
            if not media_id:
                raise InstagramApiError("Instagram no devolvió el id de la publicación.")
            try:
                info = await self._api(client, "GET", media_id, {"fields": "permalink,timestamp"})
            except InstagramApiError:
                info = {}

        return {
            "status": "PUBLISHED",
            "mode": "live_oauth2",
            "api": "instagram_login",
            "channel": self.channel.value,
            "media_type": media_type,
            "trial_reel": options.get("trial_params") is not None and media_type == "REELS",
            "container_id": container_id,
            "external_platform_id": media_id,
            "canonical_url": info.get("permalink"),
            "published_timestamp": info.get("timestamp"),
            "idempotency_key": idempotency_key,
            "auth_verified": True,
        }


class TikTokContentConnector(BaseSocialConnector):
    channel = SocialChannel.TIKTOK
    api_base = "https://open.tiktokapis.com/v2/post/publish/video/init/"

    async def _dispatch_oauth_request(self, project_id: str, payload: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                self.api_base,
                headers={"Authorization": f"Bearer {self.access_token}", "X-Idempotency-Key": idempotency_key},
                json={
                    "post_info": {
                        "title": payload.get("post_body", "")[:150],
                        "privacy_level": "PUBLIC_TO_EVERYONE",
                        "disable_duet": False,
                        "disable_stitch": False,
                    }
                },
            )
            resp.raise_for_status()
            data = resp.json()
            pub_id = data.get("data", {}).get("publish_id")
            if not pub_id:
                raise SocialPublishError("TikTok no devolvió publish_id: no se marca como publicado.")
            return {
                "status": "PUBLISHED",
                "mode": "live_oauth2",
                "channel": self.channel.value,
                "external_platform_id": pub_id,
                # publish_id is not a video id: TikTok gives no public URL at this step.
                "canonical_url": None,
                "idempotency_key": idempotency_key,
                "auth_verified": True,
            }


class LinkedInUGCConnector(BaseSocialConnector):
    channel = SocialChannel.LINKEDIN
    api_base = "https://api.linkedin.com/v2/ugcPosts"

    def __init__(self, access_token: str = "", person_urn: str = "") -> None:
        super().__init__(access_token)
        self.person_urn = person_urn

    async def _resolve_person_urn(self, client: httpx.AsyncClient, configured_urn: str) -> str:
        if configured_urn and configured_urn != "urn:li:person:creator-001" and configured_urn.startswith("urn:li:"):
            return configured_urn
        # Try OpenID Connect /v2/userinfo first, then /v2/me
        try:
            ui_resp = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={"Authorization": f"Bearer {self.access_token}"},
            )
            if ui_resp.status_code == 200:
                sub = ui_resp.json().get("sub")
                if sub:
                    return f"urn:li:person:{sub}"
        except Exception:
            pass
        try:
            me_resp = await client.get(
                "https://api.linkedin.com/v2/me",
                headers={"Authorization": f"Bearer {self.access_token}"},
            )
            if me_resp.status_code == 200:
                lid = me_resp.json().get("id")
                if lid:
                    return f"urn:li:person:{lid}"
        except Exception:
            pass
        return configured_urn

    async def _dispatch_oauth_request(self, project_id: str, payload: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        settings = get_settings()
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "X-Restli-Protocol-Version": "2.0.0",
            "X-Idempotency-Key": idempotency_key,
        }
        title = str(payload.get("title") or "").strip()
        body = str(payload.get("post_body") or "").strip()
        full_text = f"{title}\n\n{body}".strip() if (title and not body.startswith(title)) else body

        async with httpx.AsyncClient(timeout=20.0) as client:
            preferred_urn = self.person_urn or settings.linkedin_person_urn
            author_urn = await self._resolve_person_urn(client, preferred_urn)
            if not author_urn or author_urn == "urn:li:person:creator-001":
                raise ValueError(
                    "No se pudo resolver tu LinkedIn Person URN automáticamente. "
                    "Asegúrate de que tu token tenga los permisos 'openid'/'profile' y 'w_member_social', "
                    "o introduce tu Person URN (urn:li:person:...) en Conexiones Oficiales."
                )
            ugc_body = {
                "author": author_urn,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {"text": full_text},
                        "shareMediaCategory": "NONE",
                    }
                },
                "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
            }
            resp = await client.post(self.api_base, headers=headers, json=ugc_body)
            resp.raise_for_status()
            post_urn = resp.json().get("id") or resp.headers.get("x-restli-id")
            if not post_urn:
                raise SocialPublishError("LinkedIn no devolvió el id de la publicación: no se marca como publicada.")

            first_comment_text = str(payload.get("first_comment") or "").strip()
            meta = payload.get("metadata_payload") or {}
            auto_first_comment = bool(meta.get("auto_first_comment", True))
            first_comment_status = "not_configured"
            if first_comment_text and auto_first_comment:
                try:
                    encoded_urn = quote(post_urn, safe="")
                    comment_headers = {
                        "Authorization": f"Bearer {self.access_token}",
                        "X-Restli-Protocol-Version": "2.0.0",
                        "Linkedin-Version": "202503",
                        "Content-Type": "application/json",
                    }
                    comment_body = {
                        "actor": author_urn,
                        "message": {"text": first_comment_text},
                    }
                    c_resp = await client.post(
                        f"https://api.linkedin.com/rest/socialActions/{encoded_urn}/comments",
                        headers=comment_headers,
                        json=comment_body,
                    )
                    if 200 <= c_resp.status_code < 300:
                        first_comment_status = "posted"
                    else:
                        first_comment_status = f"skipped_http_{c_resp.status_code}"
                except Exception as exc:
                    first_comment_status = f"skipped_error:{type(exc).__name__}"
            elif first_comment_text and not auto_first_comment:
                first_comment_status = "disabled"

            return {
                "status": "PUBLISHED",
                "mode": "live_oauth2",
                "channel": self.channel.value,
                "external_platform_id": post_urn,
                "canonical_url": f"https://www.linkedin.com/feed/update/{post_urn}/",
                "idempotency_key": idempotency_key,
                "first_comment_status": first_comment_status,
                "auth_verified": True,
            }


def get_connector_for_channel(
    channel: SocialChannel,
    access_token_override: str | None = None,
    person_urn_override: str | None = None,
) -> BaseSocialConnector:
    settings = get_settings()
    mapping: dict[SocialChannel, BaseSocialConnector] = {
        SocialChannel.YOUTUBE: YouTubeDataConnector(access_token_override or settings.youtube_access_token),
        # For Instagram the credential's person_urn holds the ig_user_id that /me returned for that token.
        SocialChannel.INSTAGRAM: MetaGraphConnector(
            access_token_override or settings.instagram_access_token,
            ig_user_id=(person_urn_override or "").strip() if (person_urn_override or "").strip().isdigit() else "",
        ),
        SocialChannel.TIKTOK: TikTokContentConnector(access_token_override or settings.tiktok_access_token),
        SocialChannel.LINKEDIN: LinkedInUGCConnector(
            access_token_override or settings.linkedin_access_token,
            person_urn=person_urn_override or settings.linkedin_person_urn,
        ),
    }
    return mapping[channel]
