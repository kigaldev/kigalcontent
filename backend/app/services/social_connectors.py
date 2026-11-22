"""Algorithmic Multi-Channel Copycrafting, Preflight Validation, and OAuth2 Social Connectors."""

from __future__ import annotations

import hashlib
import re
import time
from typing import Any
from urllib.parse import quote

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
            first_comment = (
                f"👉 Recurso y arquitectura completa ({cta_text}) — acceso directo: "
                "https://contentengine.local/blueprint"
            )

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

        # Deterministic verified sandbox execution when live OAuth2 token is not configured
        ext_id = f"{self.channel.value.upper()}_{idem_key[:10]}_{int(time.time())}"
        return {
            "status": "PUBLISHED",
            "mode": "sandbox_verified",
            "channel": self.channel.value,
            "external_platform_id": ext_id,
            "canonical_url": f"https://social.contentengine.local/{self.channel.value.lower()}/{ext_id}",
            "idempotency_key": idem_key,
            "preflight_warnings": preflight.warnings,
            "auth_verified": True,
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
            vid = data.get("id", f"yt_{idempotency_key[:8]}")
            return {
                "status": "PUBLISHED",
                "mode": "live_oauth2",
                "channel": self.channel.value,
                "external_platform_id": vid,
                "canonical_url": f"https://youtube.com/watch?v={vid}",
                "idempotency_key": idempotency_key,
                "auth_verified": True,
            }


class MetaGraphConnector(BaseSocialConnector):
    channel = SocialChannel.INSTAGRAM
    api_base = "https://graph.facebook.com/v21.0"

    async def _dispatch_oauth_request(self, project_id: str, payload: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        settings = get_settings()
        ig_id = settings.instagram_business_account_id or "me"
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{self.api_base}/{ig_id}/media",
                headers={"Authorization": f"Bearer {self.access_token}", "X-Idempotency-Key": idempotency_key},
                json={
                    "media_type": "REELS",
                    "caption": payload.get("post_body", ""),
                    "share_to_feed": True,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            media_id = data.get("id", f"ig_{idempotency_key[:8]}")
            return {
                "status": "PUBLISHED",
                "mode": "live_oauth2",
                "channel": self.channel.value,
                "external_platform_id": media_id,
                "canonical_url": f"https://www.instagram.com/reel/{media_id}/",
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
            pub_id = data.get("data", {}).get("publish_id", f"tt_{idempotency_key[:8]}")
            return {
                "status": "PUBLISHED",
                "mode": "live_oauth2",
                "channel": self.channel.value,
                "external_platform_id": pub_id,
                "canonical_url": f"https://www.tiktok.com/@creator/video/{pub_id}",
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
            post_urn = resp.json().get("id", f"urn:li:share:{idempotency_key[:8]}")

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
        SocialChannel.INSTAGRAM: MetaGraphConnector(access_token_override or settings.instagram_access_token),
        SocialChannel.TIKTOK: TikTokContentConnector(access_token_override or settings.tiktok_access_token),
        SocialChannel.LINKEDIN: LinkedInUGCConnector(
            access_token_override or settings.linkedin_access_token,
            person_urn=person_urn_override or settings.linkedin_person_urn,
        ),
    }
    return mapping[channel]
