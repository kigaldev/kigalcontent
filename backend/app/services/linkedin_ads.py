"""LinkedIn Ad Library API client and B2B LinkedIn Ads campaign generator."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
import re
from typing import Any
from urllib.parse import quote

import httpx

from app.schemas.contracts import (
    CreatorProfileSchema,
    LinkedInAdLibraryItem,
    LinkedInAdLibrarySearchRequest,
    LinkedInAdLibrarySearchResponse,
    LinkedInAdLibraryStatusResponse,
    LinkedInAdsSpec,
    LinkedInConversationAd,
    LinkedInDocumentAd,
    LinkedInSponsoredSingleImageAd,
    LinkedInTargetingBlueprint,
    LinkedInThoughtLeaderAd,
)


CANDIDATE_LINKEDIN_VERSIONS: tuple[str, ...] = ("202601", "202602", "202505", "202503")
AD_LIBRARY_ENDPOINT = "https://api.linkedin.com/rest/adLibrary"


def _fit_text(text: str, limit: int) -> str:
    """Trim copy cleanly on word boundaries within LinkedIn character caps."""
    clean = " ".join(text.split()).strip()
    if len(clean) <= limit:
        return clean
    cut = clean[:limit].rstrip()
    if " " in cut and len(cut) > int(limit * 0.55):
        cut = cut.rsplit(" ", 1)[0].rstrip(" ,.;:-")
    return (cut or clean[:limit]).strip()[:limit]


def _format_restli_date(date_str: str | None) -> str | None:
    if not date_str or not date_str.strip():
        return None
    raw = date_str.strip()[:10]
    try:
        dt = datetime.strptime(raw, "%Y-%m-%d")
        return f"(day:{dt.day},month:{dt.month},year:{dt.year})"
    except ValueError:
        return None


def _epoch_or_str_to_iso_date(val: Any) -> str | None:
    if val is None or val == "":
        return None
    if isinstance(val, (int, float)):
        ts = float(val)
        if ts > 1e12:
            ts /= 1000.0
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
        except (OSError, OverflowError, ValueError):
            return None
    return str(val).strip()[:10] or None


def _extract_profile_attr(profile: CreatorProfileSchema | dict[str, Any] | None, key: str, default: Any = "") -> Any:
    if profile is None:
        return default
    if isinstance(profile, dict):
        return profile.get(key, default)
    return getattr(profile, key, default)


class LinkedInAdLibraryClient:
    """Async client for LinkedIn's official Ad Library REST API (/rest/adLibrary)."""

    base_url = AD_LIBRARY_ENDPOINT
    candidate_versions = CANDIDATE_LINKEDIN_VERSIONS

    def _build_query_url(
        self,
        *,
        keyword: str = "",
        advertiser: str = "",
        countries: list[str] | None = None,
        date_start: str | None = None,
        date_end: str | None = None,
        count: int = 12,
        countries_style: str = "urn_list",
    ) -> str:
        params: list[str] = ["q=criteria"]
        if keyword.strip():
            params.append(f"keyword={quote(keyword.strip(), safe='')}")
        if advertiser.strip():
            params.append(f"advertiser={quote(advertiser.strip(), safe='')}")

        clean_countries = [
            re.sub(r"[^A-Za-z]", "", c.strip()).lower()[:2]
            for c in (countries or [])
            if re.sub(r"[^A-Za-z]", "", c.strip())
        ]
        if clean_countries and countries_style != "omit":
            urns = ",".join(f"urn%3Ali%3Acountry%3A{cc}" for cc in clean_countries)
            if countries_style == "wrapped_urn":
                params.append(f"countries=(value:List({urns}))")
            else:
                params.append(f"countries=List({urns})")

        start_part = _format_restli_date(date_start)
        end_part = _format_restli_date(date_end)
        if start_part and end_part:
            params.append(f"dateRange=(start:{start_part},end:{end_part})")
        elif start_part:
            params.append(f"dateRange=(start:{start_part})")
        elif end_part:
            params.append(f"dateRange=(end:{end_part})")

        params.append(f"count={max(1, min(25, int(count)))}")
        return f"{self.base_url}?{'&'.join(params)}"

    @staticmethod
    def _is_version_error(status_code: int, body_text: str) -> bool:
        if status_code not in (400, 426):
            return False
        low = body_text.lower()
        return any(
            marker in low
            for marker in ("nonexistent_version", "linkedin-version", "version", "deprecated")
        )

    async def _request_with_version_fallback(
        self, token: str, url: str
    ) -> tuple[httpx.Response, str]:
        last_resp: httpx.Response | None = None
        last_version = self.candidate_versions[0]

        async with httpx.AsyncClient(timeout=20.0) as client:
            for version in self.candidate_versions:
                last_version = version
                headers = {
                    "Authorization": f"Bearer {token}",
                    "X-Restli-Protocol-Version": "2.0.0",
                    "Linkedin-Version": version,
                }
                resp = await client.get(url, headers=headers)
                last_resp = resp
                if self._is_version_error(resp.status_code, resp.text):
                    continue
                return resp, version

        assert last_resp is not None
        return last_resp, last_version

    @staticmethod
    def _parse_ad_element(el: dict[str, Any], index: int) -> LinkedInAdLibraryItem:
        details = el.get("details") if isinstance(el.get("details"), dict) else {}
        advertiser_obj = details.get("advertiser") if isinstance(details.get("advertiser"), dict) else {}
        creative = details.get("creative") if isinstance(details.get("creative"), dict) else {}
        stats = details.get("adStatistics") if isinstance(details.get("adStatistics"), dict) else {}

        ad_url = el.get("ad_url") or el.get("adUrl")
        raw_id = el.get("ad_id") or el.get("adId") or el.get("id")
        if not raw_id and isinstance(ad_url, str) and ad_url.strip():
            raw_id = ad_url.rstrip("/").split("/")[-1]
        ad_id = str(raw_id or f"li-ad-{index + 1}")

        ad_format = str(
            el.get("format")
            or details.get("type")
            or details.get("adType")
            or creative.get("format")
            or "SPONSORED_CONTENT"
        )
        status = str(
            el.get("status")
            or ("RESTRICTED" if el.get("isRestricted") else "ACTIVE")
        )
        advertiser_name = str(
            el.get("advertiser_name")
            or advertiser_obj.get("advertiserName")
            or advertiser_obj.get("name")
            or details.get("advertiserName")
            or "Anunciante LinkedIn"
        )
        advertiser_url = el.get("advertiser_url") or advertiser_obj.get("advertiserUrl")
        payer_name = el.get("payer_name") or advertiser_obj.get("adPayer") or details.get("adPayer")

        body_text = str(
            el.get("body_text")
            or creative.get("text")
            or creative.get("commentary")
            or creative.get("body")
            or creative.get("introductoryText")
            or details.get("body")
            or ""
        ).strip()
        headline = el.get("headline") or creative.get("headline") or creative.get("title")
        description = el.get("description") or creative.get("description")
        landing_page_url = (
            el.get("landing_page_url")
            or creative.get("landingPageUrl")
            or creative.get("clickUri")
            or creative.get("destinationUrl")
        )

        creative_urls: list[str] = []
        raw_urls = el.get("creative_urls") or creative.get("mediaUrls") or []
        if isinstance(raw_urls, list):
            creative_urls.extend(str(u) for u in raw_urls if u)
        for single_key in ("imageUrl", "videoUrl", "thumbnailUrl", "mediaUrl"):
            val = creative.get(single_key)
            if isinstance(val, str) and val and val not in creative_urls:
                creative_urls.append(val)

        first_shown_date = _epoch_or_str_to_iso_date(
            el.get("first_shown_date") or stats.get("firstImpressionAt")
        )
        last_shown_date = _epoch_or_str_to_iso_date(
            el.get("last_shown_date") or stats.get("latestImpressionAt")
        )

        raw_impr = el.get("impressions_range") or stats.get("totalImpressions")
        impressions_range: str | None = None
        if isinstance(raw_impr, dict):
            low_v = raw_impr.get("from")
            high_v = raw_impr.get("to")
            if low_v is not None and high_v is not None:
                impressions_range = f"{int(low_v):,} - {int(high_v):,}"
            elif low_v is not None:
                impressions_range = f">{int(low_v):,}"
        elif raw_impr is not None:
            impressions_range = str(raw_impr)

        top_countries: list[str] = []
        if isinstance(el.get("top_countries"), list):
            top_countries = [str(c) for c in el["top_countries"] if c]
        elif isinstance(stats.get("impressionsDistributionByCountry"), list):
            for row in stats["impressionsDistributionByCountry"]:
                if isinstance(row, dict) and row.get("country"):
                    top_countries.append(str(row["country"]))

        targeting_included: list[str] = []
        if isinstance(el.get("targeting_included"), list):
            targeting_included = [str(t) for t in el["targeting_included"] if t]
        elif isinstance(details.get("targeting"), list):
            for facet in details["targeting"]:
                if isinstance(facet, dict):
                    facet_name = facet.get("facetName") or facet.get("type") or ""
                    included = facet.get("includedSegments") or facet.get("values") or []
                    if isinstance(included, list) and included:
                        joined = ", ".join(str(x) for x in included[:3])
                        targeting_included.append(f"{facet_name}: {joined}".strip(": "))
                    elif facet_name:
                        targeting_included.append(str(facet_name))

        return LinkedInAdLibraryItem(
            ad_id=ad_id,
            ad_url=ad_url,
            format=ad_format,
            status=status,
            advertiser_name=advertiser_name,
            advertiser_url=advertiser_url,
            payer_name=payer_name,
            body_text=body_text,
            headline=str(headline) if headline is not None else None,
            description=str(description) if description is not None else None,
            landing_page_url=str(landing_page_url) if landing_page_url is not None else None,
            creative_urls=creative_urls,
            first_shown_date=first_shown_date,
            last_shown_date=last_shown_date,
            impressions_range=impressions_range,
            top_countries=top_countries,
            targeting_included=targeting_included,
        )

    @staticmethod
    def _compute_insights(items: list[LinkedInAdLibraryItem]) -> dict[str, Any]:
        if not items:
            return {"top_formats": [], "avg_copy_chars": 0, "detected_angles": []}

        fmt_counts = Counter(item.format for item in items if item.format)
        top_formats = [
            {"format": fmt, "count": cnt}
            for fmt, cnt in fmt_counts.most_common(5)
        ]
        avg_copy_chars = round(sum(len(item.body_text) for item in items) / len(items))

        angle_rules: list[tuple[str, tuple[str, ...]]] = [
            ("Lead Magnet / Recurso Descargable", ("guía", "guia", "ebook", "plantilla", "pdf", "checklist", "download", "guide", "template", "report")),
            ("Dolor / Coste Operativo", ("manual", "horas", "pierdes", "caos", "cost", "waste", "save time", "ahorra", "problema", "error")),
            ("Caso de Éxito / Métricas", ("%", "x ", "roi", "case study", "caso", "resultados", "revenue", "pipeline", "clientes")),
            ("Demo / Producto en Vivo", ("demo", "prueba", "trial", "gratis", "free", "ver cómo", "watch", "plataforma", "software")),
            ("Evento / Webinar B2B", ("webinar", "directo", "masterclass", "evento", "event", "register", "plazas")),
        ]
        detected_angles: list[str] = []
        corpus = " \n ".join(f"{it.headline or ''} {it.body_text}".lower() for it in items)
        for label, markers in angle_rules:
            if any(m in corpus for m in markers):
                detected_angles.append(label)
        if not detected_angles:
            detected_angles.append("Posicionamiento B2B / Autoridad")

        return {
            "top_formats": top_formats,
            "avg_copy_chars": avg_copy_chars,
            "detected_angles": detected_angles,
        }

    @staticmethod
    def _auth_diagnostic_message(status_code: int, detail: str = "") -> str:
        snippet = f" Detalle: {detail[:180]}" if detail else ""
        return (
            f"LinkedIn Ad Library devolvió HTTP {status_code}. "
            "Esta API requiere un Access Token OAuth 2.0 válido emitido por una app que tenga "
            "habilitado el producto «Ad Library API» en LinkedIn Developer Portal (y permisos vigentes). "
            "Renueva o configura el token en Conexiones Oficiales."
            f"{snippet}"
        )

    async def check_status(
        self,
        token: str,
        token_source: str = "none",
        account_name: str = "",
    ) -> LinkedInAdLibraryStatusResponse:
        clean_token = (token or "").strip()
        if not clean_token:
            return LinkedInAdLibraryStatusResponse(
                configured=False,
                live_verified=False,
                token_source=token_source,
                account_name=account_name,
                needs_token_refresh=False,
                message=(
                    "No hay ningún Access Token configurado para LinkedIn Ads / Ad Library. "
                    "Configura un token de LinkedIn con el producto Ad Library API en Conexiones Oficiales."
                ),
            )

        probe_attempts = [
            self._build_query_url(keyword="B2B", countries=["ES"], count=1, countries_style="urn_list"),
            self._build_query_url(keyword="B2B", countries=["ES"], count=1, countries_style="wrapped_urn"),
            self._build_query_url(keyword="B2B", countries=[], count=1, countries_style="omit"),
        ]
        resp: httpx.Response | None = None
        version_used = self.candidate_versions[0]
        try:
            for probe_url in probe_attempts:
                resp, version_used = await self._request_with_version_fallback(clean_token, probe_url)
                if resp.status_code != 400:
                    break
        except httpx.HTTPError as exc:
            return LinkedInAdLibraryStatusResponse(
                configured=True,
                live_verified=False,
                token_source=token_source,
                account_name=account_name,
                needs_token_refresh=False,
                message=f"No se pudo conectar con LinkedIn Ad Library API: {exc}",
            )

        assert resp is not None
        if resp.status_code == 200:
            return LinkedInAdLibraryStatusResponse(
                configured=True,
                live_verified=True,
                token_source=token_source,
                account_name=account_name,
                api_version_used=version_used,
                status_code=200,
                needs_token_refresh=False,
                message="✅ Conexión en vivo verificada con LinkedIn Ad Library API.",
            )

        if resp.status_code in (401, 403):
            return LinkedInAdLibraryStatusResponse(
                configured=True,
                live_verified=False,
                token_source=token_source,
                account_name=account_name,
                api_version_used=version_used,
                status_code=resp.status_code,
                needs_token_refresh=True,
                message=self._auth_diagnostic_message(resp.status_code, resp.text),
            )

        return LinkedInAdLibraryStatusResponse(
            configured=True,
            live_verified=False,
            token_source=token_source,
            account_name=account_name,
            api_version_used=version_used,
            status_code=resp.status_code,
            needs_token_refresh=False,
            message=f"LinkedIn Ad Library respondió HTTP {resp.status_code}: {resp.text[:500]}",
        )

    async def search(
        self,
        token: str,
        req: LinkedInAdLibrarySearchRequest,
    ) -> LinkedInAdLibrarySearchResponse:
        clean_token = (token or "").strip()
        empty_insights = {"top_formats": [], "avg_copy_chars": 0, "detected_angles": []}
        if not clean_token:
            return LinkedInAdLibrarySearchResponse(
                live=False,
                source="not_configured",
                status_code=None,
                needs_token_refresh=False,
                message=(
                    "No hay token configurado para consultar LinkedIn Ad Library en vivo. "
                    "Añade tu token en Conexiones Oficiales (canal LinkedIn Ads o LinkedIn)."
                ),
                total_returned=0,
                items=[],
                insights=empty_insights,
            )

        styles = ["urn_list", "wrapped_urn", "omit"] if req.countries else ["omit"]
        effective_keyword = req.keyword.strip() or ("" if req.advertiser.strip() else "B2B")
        resp: httpx.Response | None = None
        version_used = self.candidate_versions[0]
        try:
            for style in styles:
                url = self._build_query_url(
                    keyword=effective_keyword,
                    advertiser=req.advertiser,
                    countries=req.countries,
                    date_start=req.date_start,
                    date_end=req.date_end,
                    count=req.count,
                    countries_style=style,
                )
                resp, version_used = await self._request_with_version_fallback(clean_token, url)
                if resp.status_code != 400:
                    break
        except httpx.HTTPError as exc:
            return LinkedInAdLibrarySearchResponse(
                live=False,
                source="error",
                status_code=None,
                needs_token_refresh=False,
                message=f"Error de red al consultar LinkedIn Ad Library: {exc}",
                total_returned=0,
                items=[],
                insights=empty_insights,
            )

        assert resp is not None
        if resp.status_code in (401, 403):
            return LinkedInAdLibrarySearchResponse(
                live=False,
                source="error",
                status_code=resp.status_code,
                needs_token_refresh=True,
                message=self._auth_diagnostic_message(resp.status_code, resp.text),
                api_version_used=version_used,
                total_returned=0,
                items=[],
                insights=empty_insights,
            )

        if resp.status_code != 200:
            return LinkedInAdLibrarySearchResponse(
                live=False,
                source="error",
                status_code=resp.status_code,
                needs_token_refresh=False,
                message=f"Error LinkedIn Ad Library (HTTP {resp.status_code}): {resp.text[:500]}",
                api_version_used=version_used,
                total_returned=0,
                items=[],
                insights=empty_insights,
            )

        payload = resp.json() if resp.content else {}
        elements = payload.get("elements") if isinstance(payload, dict) else []
        if not isinstance(elements, list):
            elements = []

        items = [
            self._parse_ad_element(el, idx)
            for idx, el in enumerate(elements)
            if isinstance(el, dict)
        ]
        insights = self._compute_insights(items)

        return LinkedInAdLibrarySearchResponse(
            live=True,
            source="linkedin_live_api",
            status_code=200,
            needs_token_refresh=False,
            message=f"{len(items)} anuncios recuperados en vivo desde LinkedIn Ad Library.",
            api_version_used=version_used,
            total_returned=len(items),
            items=items,
            insights=insights,
        )


def _infer_b2b_targeting(
    niche: str,
    icp: str,
    pillars: list[str],
) -> LinkedInTargetingBlueprint:
    icp_low = f"{niche} {icp} {' '.join(pillars)}".lower()

    job_titles = [
        "Founder / CEO",
        "Director de Operaciones (COO)",
        "Head of Growth / CMO",
        "Consultor B2B / Socio Director",
    ]
    if any(k in icp_low for k in ("cto", "ingenier", "tech", "software", "saas", "ia", "ai", "desarroll")):
        job_titles = [
            "CTO / VP Engineering",
            "Head of AI & Automation",
            "Founder / SaaS CEO",
            "Tech Lead / Product Manager",
        ]
    elif any(k in icp_low for k in ("venta", "comercial", "b2b", "agencia", "consultor")):
        job_titles = [
            "VP Sales / Director Comercial",
            "Founder & Managing Partner",
            "Head of Growth B2B",
            "Director de Estrategia y Operaciones",
        ]

    industries = ["Servicios de TI y Consultoría", "Software (SaaS)", "Consultoría de Gestión"]
    if any(k in icp_low for k in ("marketing", "contenido", "media", "creador")):
        industries.append("Servicios de Marketing y Publicidad")
    else:
        industries.append("Servicios Empresariales B2B")

    return LinkedInTargetingBlueprint(
        job_titles=job_titles,
        seniorities=["Owner / Founder", "CXO", "VP", "Director"],
        company_sizes=["1-10 empleados", "11-50 empleados", "51-200 empleados"],
        industries=industries,
        geographies=["España (ES)", "LATAM (MX, CO, AR, CL)", "EE. UU. (B2B Hispano)"],
        recommended_daily_budget_eur="35€ - 75€ / día (test A/B Thought Leader vs Document Ad)",
    )


def generate_linkedin_b2b_ads_spec(
    topic: str,
    objective: str,
    target_url: str,
    trigger_keyword: str,
    profile: CreatorProfileSchema | dict[str, Any] | None = None,
    lm_title: str = "",
) -> LinkedInAdsSpec:
    """Generate Spanish B2B LinkedIn Ads creative suite tailored to CreatorProfile."""
    creator_name = str(_extract_profile_attr(profile, "name", "") or _extract_profile_attr(profile, "creator_name", "Creador B2B"))
    niche = str(_extract_profile_attr(profile, "niche", "Automatización con IA y Sistemas B2B") or "Sistemas B2B")
    icp = str(_extract_profile_attr(profile, "ideal_customer_profile", "") or _extract_profile_attr(profile, "target_icp", "Founders y directivos B2B"))
    pillars_raw = _extract_profile_attr(profile, "content_pillars", []) or []
    pillars = [str(p) for p in pillars_raw] if isinstance(pillars_raw, list) else []

    clean_topic = topic.strip() or "Arquitectura de Sistemas B2B con IA"
    clean_lm = lm_title.strip() or f"Blueprint Práctico: {clean_topic}"
    clean_kw = (trigger_keyword or "BLUEPRINT").strip().upper()
    clean_url = target_url.strip() or "https://kigalcontent.studio/recurso"

    # 1. Thought Leader Ad (high-trust organic-looking sponsored post)
    tl_hook = _fit_text(
        f"Llevaba meses viendo a equipos en {niche[:35]} quemar horas en {clean_topic[:45]} sin retorno claro.",
        130,
    )
    tl_body = (
        f"{tl_hook}\n\n"
        f"Cuando auditamos cómo operan {icp[:70]}, casi siempre encontramos el mismo patrón: "
        f"mucho esfuerzo manual, cero sistema medible y decisiones tomadas sin trazabilidad.\n\n"
        f"Lo que cambió por completo nuestros resultados al implementar {clean_topic}:\n"
        f"→ Estandarizar el proceso en bloques repetibles en lugar de improvisar cada semana.\n"
        f"→ Medir retención real e intención B2B antes de escalar presupuesto.\n"
        f"→ Conectar captura directa sin fricción hacia «{clean_lm}».\n\n"
        f"Hemos empaquetado la arquitectura exacta para que tu equipo la replique en menos de una tarde."
    )
    tl_cta_soft = (
        f"Comenta «{clean_kw}» o escríbeme por DM si quieres el enlace directo a «{clean_lm}» ({clean_url})."
    )
    thought_leader_ad = LinkedInThoughtLeaderAd(
        intro_hook=tl_hook,
        full_post_body=tl_body,
        cta_soft=tl_cta_soft,
        target_audience_note=f"Promocionar desde el perfil personal de {creator_name} hacia {icp}.",
        estimated_ctr_benchmark="1.9% - 3.4% CTR (2.2x vs anuncio de página de empresa)",
    )

    # 2. Single Image Sponsored Content (strict LinkedIn char caps: intro<=600, headline<=70, desc<=100)
    si_intro = _fit_text(
        f"¿Tu equipo sigue ejecutando {clean_topic} de forma manual?\n\n"
        f"Para {icp[:80]} en {niche[:55]}, la diferencia entre estancarse y escalar está en la infraestructura.\n\n"
        f"Descarga «{clean_lm}» y replica paso a paso el sistema probado con métricas reales. "
        f"Referencia rápida: {clean_kw}.",
        600,
    )
    si_headline = _fit_text(f"{clean_lm} | Sistema B2B", 70)
    si_desc = _fit_text(
        f"Arquitectura en {clean_topic} para {icp}. Descarga gratuita ({clean_kw}).",
        100,
    )
    is_demo = "demo" in objective.lower()
    single_image_ad = LinkedInSponsoredSingleImageAd(
        intro_text=si_intro,
        headline=si_headline,
        description=si_desc,
        cta_label="Solicitar demo" if is_demo else "Descargar",
        visual_brief=(
            f"Creatividad 1200x627 o 1080x1080 fondo oscuro (#070B14) con diagrama limpio Antes/Después de "
            f"«{clean_topic[:40]}», tipografía blanca de alto contraste y badge cyan con el título «{clean_lm[:35]}»."
        ),
    )

    # 3. Document Carousel PDF Ad + Native Lead Gen Form
    doc_intro = _fit_text(
        f"Desliza las 6 láminas para ver la arquitectura exacta de {clean_topic} pensada para {icp[:70]}.\n\n"
        f"Al final puedes desbloquear «{clean_lm}» en 1 clic sin salir de LinkedIn.",
        600,
    )
    doc_headline = _fit_text(f"Carrusel PDF: {clean_topic}", 70)
    document_carousel_ad = LinkedInDocumentAd(
        intro_text=doc_intro,
        headline=doc_headline,
        slides_outline=[
            f"Lámina 1 (Portada): Por qué {clean_topic[:42]} falla sin sistema en 2026",
            "Lámina 2 (Diagnóstico): Los 3 cuellos de botella que frenan a equipos B2B",
            f"Lámina 3 (Arquitectura): Mapa visual de {clean_lm[:45]}",
            "Lámina 4 (Ejecución): Checklist operativo en 15 minutos por semana",
            "Lámina 5 (Prueba): Métricas reales antes vs después de automatizar",
            f"Lámina 6 (CTA): Descarga la plantilla completa con el formulario nativo ({clean_kw})",
        ],
        lead_gen_form_fields=[
            "Nombre",
            "Apellidos",
            "Email profesional",
            "Cargo / Puesto",
            "Nombre de la empresa",
            "Tamaño de la empresa",
        ],
        thank_you_message=(
            f"¡Listo! Ya tienes acceso a «{clean_lm}». Ábrelo directamente aquí: {clean_url}"
        ),
    )

    # 4. Conversation Ad (Sponsored InMail)
    conversation_ad = LinkedInConversationAd(
        subject=_fit_text(f"Sobre {clean_topic} en tu equipo", 60),
        opening_message=(
            f"Hola %FIRSTNAME%, soy {creator_name}. Veo que lideras iniciativas vinculadas a {icp[:75]}.\n\n"
            f"Acabamos de publicar «{clean_lm}», una guía técnica sobre {clean_topic} pensada para ahorrar "
            f"horas operativas sin aumentar estructura.\n\n"
            f"¿Te envío el acceso directo o prefieres ver un caso práctico aplicado a {niche[:45]}?"
        ),
        cta_buttons=[
            _fit_text(f"📥 Acceder a {clean_lm}", 45),
            "📊 Ver caso real B2B",
            "🗓️ Agendar diagnóstico 15 min",
        ],
    )

    targeting_blueprint = _infer_b2b_targeting(niche=niche, icp=icp, pillars=pillars)

    return LinkedInAdsSpec(
        thought_leader_ad=thought_leader_ad,
        single_image_ad=single_image_ad,
        document_carousel_ad=document_carousel_ad,
        conversation_ad=conversation_ad,
        targeting_blueprint=targeting_blueprint,
    )
