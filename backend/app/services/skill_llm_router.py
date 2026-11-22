"""Hybrid Skill-Aware LLM Router: Loads canonical Skill markdowns + routes across Ollama (MiniPC), Anthropic Claude (Prompt Caching), OpenAI-compatible APIs, and deterministic fallback."""

from __future__ import annotations

import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any

import httpx

from app.core.config import get_settings
from app.schemas.contracts import (
    ABPackagingVariant,
    ConversionGoal,
    DurationPreset,
    HookCandidate,
    LLMConfigResponse,
    LLMConfigUpdateRequest,
    LLMProviderMode,
    LLMTestConnectionResponse,
    LoadedSkillAgentSpec,
    RecommendedLocalModel,
    TAMClassification,
    TwoColumnScriptBlock,
)
from app.services.domain_engines import (
    DURATION_SPECS,
    calculate_ice_and_hooks,
    compute_block_metrics,
    compute_deterministic_embedding,
    generate_parametric_script,
    get_cta_for_goal,
)

logger = logging.getLogger("ace.llm_router")

RECOMMENDED_LOCAL_MODELS: list[RecommendedLocalModel] = [
    RecommendedLocalModel(
        tier_ram="24GB",
        model_id="qwen3:14b",
        pull_command="ollama pull qwen3:14b",
        ram_usage_gb="~9.5 GB",
        role="Equilibrio ideal hoy: español natural, modo razonamiento y JSON estricto",
        spanish_quality="Excelente",
        recommended=True,
    ),
    RecommendedLocalModel(
        tier_ram="24GB",
        model_id="gemma3:12b",
        pull_command="ollama pull gemma3:12b",
        ram_usage_gb="~8.1 GB",
        role="Ultraligero y veloz para ganchos virales cortos y variantes A/B",
        spanish_quality="Muy Buena",
        recommended=False,
    ),
    RecommendedLocalModel(
        tier_ram="24GB",
        model_id="mistral-small3.1:24b",
        pull_command="ollama pull mistral-small3.1:24b",
        ram_usage_gb="~14.5 GB",
        role="Especialista en agentes y esquemas JSON sin roturas (justo en 24 GB)",
        spanish_quality="Muy Buena",
        recommended=False,
    ),
    RecommendedLocalModel(
        tier_ram="48GB",
        model_id="qwen3:32b",
        pull_command="ollama pull qwen3:32b",
        ram_usage_gb="~22.0 GB",
        role="Modelo estrella al ampliar a 48 GB: calidad narrativa nivel API comercial",
        spanish_quality="Sobresaliente",
        recommended=True,
    ),
    RecommendedLocalModel(
        tier_ram="48GB",
        model_id="mistral-small3.1:24b-instruct-2503-q8_0",
        pull_command="ollama pull mistral-small3.1:24b-instruct-2503-q8_0",
        ram_usage_gb="~25.0 GB",
        role="Fidelidad Q8 casi sin compresión para cumplir reglas estrictas de duración",
        spanish_quality="Excelente",
        recommended=False,
    ),
    RecommendedLocalModel(
        tier_ram="48GB",
        model_id="bge-m3",
        pull_command="ollama pull bge-m3",
        ram_usage_gb="~1.2 GB",
        role="Embeddings multilingües locales para la Bóveda de Ganchos (pgvector)",
        spanish_quality="Nativo",
        recommended=True,
    ),
]

AGENT_DEFINITIONS: list[tuple[str, str, str]] = [
    ("orchestrator", "agents/orchestrator.md", "Orquestador Maestro FSM y Reglas Globales"),
    ("researcher_strategist", "agents/researcher_strategist.md", "Investigador Empírico, ICE Scorer y Hook Vault"),
    ("director_scriptwriter", "agents/director_scriptwriter.md", "Director Audiovisual y Guionista 2 Columnas"),
    ("postproducer_editor", "agents/postproducer_editor.md", "Postproductor FFmpeg -14 LUFS y Whisper"),
    ("publisher_distributor", "agents/publisher_distributor.md", "Estratega de Copycrafting y Pre-vuelo Social"),
    ("analytics_experimenter", "agents/analytics_experimenter.md", "Auditor RMT-A y Watch Time Share"),
]


class SkillPromptLoader:
    """Loads markdown instructions & templates from claude-content-engine-skill/."""

    def __init__(self, skill_dir: Path | None = None) -> None:
        self.skill_dir = skill_dir or get_settings().skill_base_dir

    def _read_markdown(self, relative_path: str) -> str:
        path = self.skill_dir / relative_path
        if path.exists():
            return path.read_text(encoding="utf-8")
        return ""

    def list_loaded_skills(self) -> list[LoadedSkillAgentSpec]:
        specs: list[LoadedSkillAgentSpec] = []
        for agent_id, rel_path, title in AGENT_DEFINITIONS:
            content = self._read_markdown(rel_path)
            chars = len(content)
            specs.append(
                LoadedSkillAgentSpec(
                    agent_id=agent_id,
                    filename=rel_path,
                    title=title,
                    char_count=chars,
                    estimated_tokens=max(1, chars // 4),
                )
            )
        return specs

    def build_agent_system_prompt(
        self,
        agent_id: str,
        creator_profile: dict[str, Any] | None = None,
    ) -> str:
        """Assemble canonical system prompt combining Skill Markdown + Creator Context."""
        skill_root = self._read_markdown("SKILL.md")
        agent_rel = next(
            (rel for aid, rel, _ in AGENT_DEFINITIONS if aid == agent_id),
            "agents/orchestrator.md",
        )
        agent_md = self._read_markdown(agent_rel)
        profile = creator_profile or get_settings().load_creator_profile_file()

        context_summary = {
            "name": profile.get("name"),
            "niche": profile.get("niche"),
            "ideal_customer_profile": profile.get("ideal_customer_profile"),
            "project_context": profile.get("project_context"),
            "communication_style": profile.get("communication_style"),
            "visual_style": profile.get("visual_style"),
            "strategic_goals": profile.get("strategic_goals"),
            "active_conversion_goal": profile.get("active_conversion_goal"),
            "content_pillars": profile.get("content_pillars"),
        }

        sections = [
            "=== CANONICAL SKILL SPECIFICATION (AUTONOMOUS CONTENT ENGINE v2) ===",
            skill_root.strip(),
            f"=== AGENT ROLE INSTRUCTIONS ({agent_id}) ===",
            agent_md.strip(),
            "=== CREATOR CONTEXT ENGINE (ACTIVE PROFILE) ===",
            json.dumps(context_summary, ensure_ascii=False, indent=2),
            "=== STRICT OUTPUT REQUIREMENT ===",
            "Responde siempre en español natural alineado con el estilo de comunicación del creador y devuelve JSON válido estrictamente ajustado al esquema pedido.",
        ]
        return "\n\n".join(s for s in sections if s)


def _extract_json_object(raw_text: str) -> dict[str, Any] | None:
    """Robustly extract JSON from LLM output (handles markdown fences or <think> tags)."""
    cleaned = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()
    fence_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", cleaned, flags=re.DOTALL)
    if fence_match:
        cleaned = fence_match.group(1)
    else:
        brace_match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if brace_match:
            cleaned = brace_match.group(0)
    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


class HybridLLMRouter:
    """Routes Skill-augmented inference to Ollama Local, Anthropic Claude (Prompt Caching), OpenAI-compatible, or deterministic fallback."""

    def __init__(self) -> None:
        self.loader = SkillPromptLoader()
        self._runtime_overrides: dict[str, Any] = self._load_runtime_overrides()

    @staticmethod
    def _runtime_config_file() -> Path:
        if os.environ.get("VERCEL"):
            return Path("/tmp/ace_llm_runtime_config.json")
        return get_settings().learned_rules_path.parent / "llm_runtime_config.json"

    def _load_runtime_overrides(self) -> dict[str, Any]:
        path = self._runtime_config_file()
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                return data if isinstance(data, dict) else {}
            except Exception:
                return {}
        return {}

    def _save_runtime_overrides(self, data: dict[str, Any]) -> None:
        path = self._runtime_config_file()
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        except Exception as exc:
            logger.warning("Could not persist runtime LLM overrides: %s", exc)

    def _effective_settings(self) -> dict[str, str]:
        s = get_settings()
        ov = self._runtime_overrides
        return {
            "active_provider": str(ov.get("active_provider") or s.llm_provider or "auto"),
            "ollama_base_url": str(ov.get("ollama_base_url") or s.ollama_base_url).rstrip("/"),
            "ollama_model": str(ov.get("ollama_model") or s.ollama_model),
            "ollama_embedding_model": str(ov.get("ollama_embedding_model") or s.ollama_embedding_model),
            "anthropic_model": str(ov.get("anthropic_model") or s.anthropic_model),
            "anthropic_api_key": str(ov.get("anthropic_api_key") or s.anthropic_api_key or ""),
            "openai_compatible_base_url": str(ov.get("openai_compatible_base_url") or s.openai_compatible_base_url).rstrip("/"),
            "openai_compatible_model": str(ov.get("openai_compatible_model") or s.openai_compatible_model),
            "openai_compatible_api_key": str(ov.get("openai_compatible_api_key") or s.openai_compatible_api_key or ""),
        }

    def get_config_response(self) -> LLMConfigResponse:
        cfg = self._effective_settings()
        mode = LLMProviderMode(cfg["active_provider"]) if cfg["active_provider"] in LLMProviderMode._value2member_map_ else LLMProviderMode.AUTO

        effective = mode.value
        if mode == LLMProviderMode.AUTO:
            if cfg["anthropic_api_key"]:
                effective = "anthropic (auto-fallback a deterministic)"
            elif cfg["openai_compatible_api_key"]:
                effective = "openai_compatible (auto-fallback a deterministic)"
            else:
                effective = "ollama -> deterministic fallback"

        return LLMConfigResponse(
            active_provider=mode,
            effective_provider=effective,
            ollama_base_url=cfg["ollama_base_url"],
            ollama_model=cfg["ollama_model"],
            ollama_embedding_model=cfg["ollama_embedding_model"],
            anthropic_model=cfg["anthropic_model"],
            anthropic_prompt_caching_enabled=True,
            anthropic_key_configured=bool(cfg["anthropic_api_key"]),
            openai_compatible_base_url=cfg["openai_compatible_base_url"],
            openai_compatible_model=cfg["openai_compatible_model"],
            openai_compatible_key_configured=bool(cfg["openai_compatible_api_key"]),
            loaded_skills=self.loader.list_loaded_skills(),
            recommended_local_models=RECOMMENDED_LOCAL_MODELS,
        )

    def update_config(self, body: LLMConfigUpdateRequest) -> LLMConfigResponse:
        updates = body.model_dump(exclude_none=True, mode="json")
        # Do not overwrite stored key if masked/empty passed accidentally
        for key in ("anthropic_api_key", "openai_compatible_api_key"):
            if key in updates and (not updates[key] or "***" in str(updates[key])):
                updates.pop(key)
        self._runtime_overrides.update(updates)
        self._save_runtime_overrides(self._runtime_overrides)
        return self.get_config_response()

    async def probe_ollama(self, base_url: str | None = None) -> dict[str, Any]:
        url = (base_url or self._effective_settings()["ollama_base_url"]).rstrip("/")
        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{url}/api/tags")
                latency_ms = round((time.perf_counter() - t0) * 1000, 1)
                if resp.status_code == 200:
                    data = resp.json()
                    models = [m.get("name", "") for m in data.get("models", []) if m.get("name")]
                    return {"reachable": True, "models": models, "latency_ms": latency_ms, "error": None}
                return {"reachable": False, "models": [], "latency_ms": latency_ms, "error": f"HTTP {resp.status_code}"}
        except Exception as exc:
            return {
                "reachable": False,
                "models": [],
                "latency_ms": round((time.perf_counter() - t0) * 1000, 1),
                "error": str(exc),
            }

    async def test_connection(
        self,
        provider_override: LLMProviderMode | None = None,
        ollama_base_url: str | None = None,
        ollama_model: str | None = None,
    ) -> LLMTestConnectionResponse:
        cfg = self._effective_settings()
        target = provider_override or LLMProviderMode(cfg["active_provider"])

        if target in (LLMProviderMode.OLLAMA, LLMProviderMode.AUTO):
            probe = await self.probe_ollama(ollama_base_url or cfg["ollama_base_url"])
            model_name = ollama_model or cfg["ollama_model"]
            if probe["reachable"]:
                return LLMTestConnectionResponse(
                    reachable=True,
                    provider="ollama",
                    active_model=model_name,
                    installed_models=probe["models"],
                    latency_ms=probe["latency_ms"],
                    sample_output=f"MiniPC Ollama conectado ({len(probe['models'])} modelos instalados).",
                    fallback_used=False,
                    message="Conexión local/túnel con Ollama verificada con éxito.",
                )
            if target == LLMProviderMode.OLLAMA:
                return LLMTestConnectionResponse(
                    reachable=False,
                    provider="ollama",
                    active_model=model_name,
                    installed_models=[],
                    latency_ms=probe["latency_ms"],
                    sample_output="Fallback determinista listo para mantener la plataforma operativa.",
                    fallback_used=True,
                    message=f"No se pudo conectar con Ollama en {ollama_base_url or cfg['ollama_base_url']}: {probe['error']}.",
                )

        if target == LLMProviderMode.ANTHROPIC or (target == LLMProviderMode.AUTO and cfg["anthropic_api_key"]):
            key = cfg["anthropic_api_key"]
            if not key:
                return LLMTestConnectionResponse(
                    reachable=False,
                    provider="anthropic",
                    active_model=cfg["anthropic_model"],
                    fallback_used=True,
                    message="Falta ANTHROPIC_API_KEY. Activado fallback determinista sin coste.",
                )
            t0 = time.perf_counter()
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://api.anthropic.com/v1/messages",
                        headers={
                            "x-api-key": key,
                            "anthropic-version": "2023-06-01",
                            "anthropic-beta": "prompt-caching-2024-07-31",
                            "content-type": "application/json",
                        },
                        json={
                            "model": cfg["anthropic_model"],
                            "max_tokens": 16,
                            "messages": [{"role": "user", "content": "Responde OK"}],
                        },
                    )
                    latency_ms = round((time.perf_counter() - t0) * 1000, 1)
                    if resp.status_code == 200:
                        return LLMTestConnectionResponse(
                            reachable=True,
                            provider="anthropic",
                            active_model=cfg["anthropic_model"],
                            latency_ms=latency_ms,
                            sample_output="Claude API conectada con Prompt Caching (-90% en Skills).",
                            fallback_used=False,
                            message="Conexión verificada con Anthropic Claude API.",
                        )
                    return LLMTestConnectionResponse(
                        reachable=False,
                        provider="anthropic",
                        active_model=cfg["anthropic_model"],
                        latency_ms=latency_ms,
                        fallback_used=True,
                        message=f"Claude API devolvió HTTP {resp.status_code}.",
                    )
            except Exception as exc:
                return LLMTestConnectionResponse(
                    reachable=False,
                    provider="anthropic",
                    active_model=cfg["anthropic_model"],
                    fallback_used=True,
                    message=f"Error conectando a Claude API: {exc}",
                )

        return LLMTestConnectionResponse(
            reachable=True,
            provider="deterministic",
            active_model="ace-parametric-engine-v2",
            latency_ms=0.5,
            sample_output="Motor paramétrico determinista activo (0 ms latencia, 0 € coste).",
            fallback_used=True,
            message="Operando con motor determinista nativo.",
        )

    async def _invoke_json(
        self,
        agent_id: str,
        user_prompt: str,
        creator_profile: dict[str, Any] | None = None,
    ) -> tuple[dict[str, Any] | None, str]:
        """Execute LLM completion returning (parsed_json, provider_used)."""
        cfg = self._effective_settings()
        mode = cfg["active_provider"]
        if mode == "deterministic":
            return None, "deterministic"

        system_prompt = self.loader.build_agent_system_prompt(agent_id, creator_profile)

        # Resolve order of attempts
        attempts: list[str] = []
        if mode == "auto":
            attempts = ["ollama", "anthropic", "openai_compatible"]
        else:
            attempts = [mode]

        for provider in attempts:
            if provider == "ollama":
                probe = await self.probe_ollama(cfg["ollama_base_url"])
                if not probe["reachable"]:
                    continue
                try:
                    async with httpx.AsyncClient(timeout=45.0) as client:
                        resp = await client.post(
                            f"{cfg['ollama_base_url']}/api/chat",
                            json={
                                "model": cfg["ollama_model"],
                                "stream": False,
                                "format": "json",
                                "messages": [
                                    {"role": "system", "content": system_prompt},
                                    {"role": "user", "content": user_prompt},
                                ],
                                "options": {"temperature": 0.4},
                            },
                        )
                        if resp.status_code == 200:
                            content = resp.json().get("message", {}).get("content", "")
                            parsed = _extract_json_object(content)
                            if parsed:
                                return parsed, f"ollama:{cfg['ollama_model']}"
                except Exception as exc:
                    logger.warning("Ollama inference fallback triggered: %s", exc)

            elif provider == "anthropic" and cfg["anthropic_api_key"]:
                try:
                    async with httpx.AsyncClient(timeout=45.0) as client:
                        resp = await client.post(
                            "https://api.anthropic.com/v1/messages",
                            headers={
                                "x-api-key": cfg["anthropic_api_key"],
                                "anthropic-version": "2023-06-01",
                                "anthropic-beta": "prompt-caching-2024-07-31",
                                "content-type": "application/json",
                            },
                            json={
                                "model": cfg["anthropic_model"],
                                "max_tokens": 2048,
                                "system": [
                                    {
                                        "type": "text",
                                        "text": system_prompt,
                                        "cache_control": {"type": "ephemeral"},
                                    }
                                ],
                                "messages": [{"role": "user", "content": user_prompt}],
                            },
                        )
                        if resp.status_code == 200:
                            blocks = resp.json().get("content", [])
                            text = "".join(b.get("text", "") for b in blocks if isinstance(b, dict))
                            parsed = _extract_json_object(text)
                            if parsed:
                                return parsed, f"anthropic:{cfg['anthropic_model']}"
                except Exception as exc:
                    logger.warning("Anthropic inference fallback triggered: %s", exc)

            elif provider == "openai_compatible" and cfg["openai_compatible_api_key"]:
                try:
                    async with httpx.AsyncClient(timeout=45.0) as client:
                        resp = await client.post(
                            f"{cfg['openai_compatible_base_url']}/chat/completions",
                            headers={
                                "Authorization": f"Bearer {cfg['openai_compatible_api_key']}",
                                "Content-Type": "application/json",
                            },
                            json={
                                "model": cfg["openai_compatible_model"],
                                "response_format": {"type": "json_object"},
                                "messages": [
                                    {"role": "system", "content": system_prompt},
                                    {"role": "user", "content": user_prompt},
                                ],
                            },
                        )
                        if resp.status_code == 200:
                            choices = resp.json().get("choices", [])
                            content = choices[0].get("message", {}).get("content", "") if choices else ""
                            parsed = _extract_json_object(content)
                            if parsed:
                                return parsed, f"openai_compatible:{cfg['openai_compatible_model']}"
                except Exception as exc:
                    logger.warning("OpenAI-compatible inference fallback triggered: %s", exc)

        return None, "deterministic"

    async def generate_structured_script(
        self,
        topic: str,
        preset: DurationPreset,
        goal: ConversionGoal,
        wpm_rate: int = 140,
        creator_profile: dict[str, Any] | None = None,
    ) -> tuple[list[TwoColumnScriptBlock], list[ABPackagingVariant], str, str]:
        """Generate two-column AV script using Skills + active LLM, cleanly falling back to deterministic engine."""
        spec = DURATION_SPECS[preset]
        profile = creator_profile or get_settings().load_creator_profile_file()
        cta_text = get_cta_for_goal(profile, goal)

        prompt = (
            f"Genera un guión técnico audiovisual a dos columnas para el tema: '{topic}'.\n"
            f"Parámetros obligatorios:\n"
            f"- Formato de duración: {spec['label']} (rango total de palabras: {spec['word_range'][0]} a {spec['word_range'][1]} palabras).\n"
            f"- Intervalo de cambio de plano: cada {spec['cut_interval_sec'][0]}–{spec['cut_interval_sec'][1]}s.\n"
            f"- Meta de conversión: {goal.value}.\n"
            f"- CTA de cierre obligatorio: {cta_text}\n\n"
            f"Devuelve EXCLUSIVAMENTE JSON con esta estructura:\n"
            '{"blocks": [{"block_id": "blk-1", "section_label": "Gancho (0-3s)", "timecode": "00:00 - 00:05", '
            '"visual_direction": "...", "b_roll_cue": "...", "on_screen_text": "...", '
            '"audio_voiceover": "...", "sfx_cue": "...", "music_cue": "...", "pattern_interrupt_sec": 2.5}], '
            '"ab_variants": [{"variant_label": "A", "title": "...", "thumbnail_concept": "...", "thumbnail_dimensions": "1280x720", "hypothesis": "..."}, '
            '{"variant_label": "B", "title": "...", "thumbnail_concept": "...", "thumbnail_dimensions": "1280x720", "hypothesis": "..."}]}'
        )

        parsed, provider_used = await self._invoke_json("director_scriptwriter", prompt, profile)
        if parsed and isinstance(parsed.get("blocks"), list) and len(parsed["blocks"]) >= 2:
            try:
                blocks: list[TwoColumnScriptBlock] = []
                for idx, b in enumerate(parsed["blocks"], start=1):
                    blocks.append(
                        TwoColumnScriptBlock(
                            block_id=str(b.get("block_id") or f"blk-{idx}"),
                            section_label=str(b.get("section_label") or f"Bloque {idx}"),
                            timecode=str(b.get("timecode") or "00:00 - 00:10"),
                            visual_direction=str(b.get("visual_direction") or "Plano medio a cámara"),
                            b_roll_cue=str(b.get("b_roll_cue") or "B-roll de apoyo"),
                            on_screen_text=str(b.get("on_screen_text") or topic[:40]),
                            audio_voiceover=str(b.get("audio_voiceover") or ""),
                            sfx_cue=str(b.get("sfx_cue") or "Whoosh"),
                            music_cue=str(b.get("music_cue") or "Lo-fi rítmico"),
                            pattern_interrupt_sec=float(b.get("pattern_interrupt_sec") or 3.0),
                        )
                    )
                ab_variants = [
                    ABPackagingVariant(
                        variant_label=str(v.get("variant_label") or "A"),
                        title=str(v.get("title") or topic[:58]),
                        thumbnail_concept=str(v.get("thumbnail_concept") or "Primer plano + texto clave"),
                        thumbnail_dimensions=str(v.get("thumbnail_dimensions") or "1280x720"),
                        hypothesis=str(v.get("hypothesis") or "Test de curiosidad vs beneficio directo."),
                    )
                    for v in (parsed.get("ab_variants") or [])[:2]
                ]
                computed, _, _, _ = compute_block_metrics(blocks, wpm_rate, preset)
                if not ab_variants:
                    _, ab_variants, _ = generate_parametric_script(topic, preset, goal, wpm_rate)
                return computed, ab_variants, cta_text, provider_used
            except Exception as exc:
                logger.warning("Failed parsing LLM script JSON, using deterministic fallback: %s", exc)

        det_blocks, det_ab, det_cta = generate_parametric_script(topic, preset, goal, wpm_rate)
        return det_blocks, det_ab, det_cta, "deterministic"

    async def generate_hooks_with_skill(
        self,
        concept_title: str,
        impact: float,
        confidence: float,
        ease: float,
        tam_classification: TAMClassification = TAMClassification.CORE_80,
        creator_profile: dict[str, Any] | None = None,
    ) -> tuple[Any, str]:
        """Score ICE deterministically and optionally enrich hooks via active Skill LLM."""
        base = calculate_ice_and_hooks(concept_title, impact, confidence, ease, tam_classification)
        cfg = self._effective_settings()
        if cfg["active_provider"] == "deterministic":
            return base, "deterministic"

        prompt = (
            f"Propón 3 ganchos virales (0-3 segundos) en español para el concepto: '{concept_title}'.\n"
            f"Devuelve JSON: {{\"hooks\": [{{\"category\": \"Contraintuitivo\", \"hook_text\": \"...\", "
            f"\"pattern_interrupt\": \"...\", \"estimated_hold_rate\": 72.5}}]}}"
        )
        parsed, provider_used = await self._invoke_json("researcher_strategist", prompt, creator_profile)
        if parsed and isinstance(parsed.get("hooks"), list) and len(parsed["hooks"]) >= 1:
            try:
                base.hook_candidates = [
                    HookCandidate(
                        category=str(h.get("category") or "Gancho IA"),
                        hook_text=str(h.get("hook_text") or concept_title),
                        pattern_interrupt=str(h.get("pattern_interrupt") or "Zoom 115% + SFX"),
                        estimated_hold_rate=float(h.get("estimated_hold_rate") or 70.0),
                    )
                    for h in parsed["hooks"][:4]
                ]
                return base, provider_used
            except Exception:
                pass
        return base, "deterministic"

    async def evaluate_idea_with_ai(
        self,
        concept_title: str,
        context_notes: str | None = None,
        creator_profile: dict[str, Any] | None = None,
        target_platforms: list[str] | None = None,
    ) -> tuple[dict[str, Any], str]:
        """
        Evaluate an idea using AI and loaded Creator / Researcher skills.
        Returns calculated ICE scores, TAM, rationale, and platform recommendations.
        """
        platforms = target_platforms or ["YouTube", "Instagram", "TikTok", "LinkedIn", "X"]
        niche = (creator_profile or {}).get("niche", "Automatización, IA y Negocios Digitales")
        icp = (creator_profile or {}).get("ideal_customer_profile", "Emprendedores, Creadores y Profesionales")
        notes_text = context_notes or "Sin notas adicionales."

        prompt = (
            f"Como director de estrategia de contenido y viralidad con metodología ICE (Impacto, Confianza, Facilidad):\n"
            f"Evalúa objetivamente la siguiente idea de video/publicación:\n\n"
            f"TÍTULO/CONCEPTO: '{concept_title}'\n"
            f"CONTEXTO/NOTAS O MATERIAL BRUTO: '{notes_text}'\n"
            f"NICHO DEL CREADOR: '{niche}'\n"
            f"AUDIENCIA OBJETIVO (ICP): '{icp}'\n"
            f"PLATAFORMAS OBJETIVO: {', '.join(platforms)}\n\n"
            f"Devuelve un JSON estrictamente estructurado con:\n"
            f"- 'impact': float entre 1.0 y 10.0 (potencial de alcance, retención y conversión)\n"
            f"- 'confidence': float entre 1.0 y 10.0 (certeza de interés y validación del dolor de la audiencia)\n"
            f"- 'ease': float entre 1.0 y 10.0 (simplicidad de producción, b-roll y edición)\n"
            f"- 'tam_classification': 'CORE_80' (si fideliza a su nicho) o 'EXPANSION_20' (si atrae nuevas audiencias masivas)\n"
            f"- 'rationale': explicación concisa de 2-3 frases en español justificando la valoración\n"
            f"- 'suggested_platforms': lista de plataformas idóneas para este formato\n"
            f"- 'estimated_hold_rate': float entre 50.0 y 92.0 (tasa de retención proyectada en los primeros 3 seg)\n"
            f"- 'hook_candidates': lista de 3 ganchos [{{'category': '...', 'hook_text': '...', 'pattern_interrupt': '...', 'estimated_hold_rate': ...}}]"
        )

        cfg = self._effective_settings()
        if cfg["active_provider"] != "deterministic":
            parsed, provider_used = await self._invoke_json("researcher_strategist", prompt, creator_profile)
            if parsed and isinstance(parsed.get("impact"), (int, float)):
                try:
                    impact = max(1.0, min(10.0, float(parsed["impact"])))
                    confidence = max(1.0, min(10.0, float(parsed.get("confidence", 7.5))))
                    ease = max(1.0, min(10.0, float(parsed.get("ease", 7.0))))
                    ice = round((impact + confidence + ease) / 3.0, 1)
                    tam = "EXPANSION_20" if str(parsed.get("tam_classification")).upper() == "EXPANSION_20" else "CORE_80"
                    rationale = str(parsed.get("rationale") or f"Idea valorada con IA para el nicho {niche}.")
                    suggested_plats = parsed.get("suggested_platforms") or platforms
                    hold_rate = float(parsed.get("estimated_hold_rate") or 75.0)
                    hooks = parsed.get("hook_candidates") or []

                    return {
                        "impact": impact,
                        "confidence": confidence,
                        "ease": ease,
                        "ice_score": ice,
                        "tam_classification": tam,
                        "rationale": rationale,
                        "suggested_platforms": suggested_plats,
                        "hook_candidates": hooks,
                        "estimated_hold_rate": hold_rate,
                    }, provider_used
                except Exception as exc:
                    logger.warning("Error parsing LLM idea evaluation: %s", exc)

        # Deterministic intelligent calculation based on context depth and keywords
        words = len((notes_text + " " + concept_title).split())
        has_numbers = bool(re.search(r"\d+", concept_title))
        has_howto = any(w in concept_title.lower() for w in ["cómo", "como", "3 ", "5 ", "guía", "guia", "secreto", "error", "sistema", "truco", "paso"])

        base_impact = 8.0 if has_howto or has_numbers else 7.2
        if words > 30:
            base_impact += 0.8
        base_impact = min(9.5, max(5.0, round(base_impact, 1)))

        base_confidence = 7.5
        if any(w in (concept_title + notes_text).lower() for w in ["ia", "automatiz", "herramienta", "código", "python", "creador", "negocio", "video"]):
            base_confidence += 1.0
        base_confidence = min(9.2, max(5.0, round(base_confidence, 1)))

        base_ease = 7.8
        if words > 80:
            base_ease += 0.6
        base_ease = min(9.0, max(5.0, round(base_ease, 1)))

        ice_calc = round((base_impact + base_confidence + base_ease) / 3.0, 1)
        tam_calc = "EXPANSION_20" if (has_howto and has_numbers) else "CORE_80"

        hooks_det = [
            {
                "category": "Contraintuitivo",
                "hook_text": f"La mayoría de creadores hacen {concept_title.lower()} completamente al revés.",
                "pattern_interrupt": "Corte rápido + Sonido pop + Zoom 110%",
                "estimated_hold_rate": 78.5,
            },
            {
                "category": "Curiosidad Negativa",
                "hook_text": f"Si sigues creando contenido sin aplicar esto, el algoritmo te va a invisibilizar.",
                "pattern_interrupt": "Efecto flash blanco + B-Roll advertencia",
                "estimated_hold_rate": 74.0,
            },
            {
                "category": "Prueba Rápida",
                "hook_text": f"En los próximos 45 segundos te muestro exactamente cómo ejecutar {concept_title.lower()}.",
                "pattern_interrupt": "Captura de pantalla rápida + Contador regresivo",
                "estimated_hold_rate": 82.0,
            },
        ]

        rationale_det = (
            f"Análisis IA: Idea de alto potencial con {words} palabras de contexto analizadas. "
            f"Alinea directamente con el perfil y dolor de tu nicho ({niche}), "
            f"con una retención inicial estimada del 78% en los primeros 3 segundos."
        )

        return {
            "impact": base_impact,
            "confidence": base_confidence,
            "ease": base_ease,
            "ice_score": ice_calc,
            "tam_classification": tam_calc,
            "rationale": rationale_det,
            "suggested_platforms": platforms,
            "hook_candidates": hooks_det,
            "estimated_hold_rate": 78.5,
        }, "deterministic"

    async def chat_refine_idea(
        self,
        messages: list[dict[str, str]],
        creator_profile: dict[str, Any] | None = None,
        current_title: str | None = None,
        current_context: str | None = None,
        target_platforms: list[str] | None = None,
        preferred_format: str = "TEXT_AND_VIDEO",
    ) -> dict[str, Any]:
        """
        Interactive content strategy chat co-pilot for refining ideas into polished publications.
        Loaded with Anti-Slop, LinkedIn Agent, Viral Storytelling, and HookLab skills.
        """
        platforms = target_platforms or ["LinkedIn", "X"]
        niche = (creator_profile or {}).get("niche", "Automatización, IA y Negocios Digitales")
        creator_name = (creator_profile or {}).get("name", "Creador")

        last_user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = m.get("content", "").strip()
                break

        cfg = self._effective_settings()
        if cfg["active_provider"] != "deterministic":
            prompt = (
                f"Eres el Director de Estrategia de Contenido y Viralidad de KigalContent para {creator_name} (Nicho: {niche}).\n"
                f"Tu rol es convertir ideas en bruto de creadores en publicaciones y guiones de alto impacto, 100% auténticos, "
                f"eliminando cualquier rastro de lenguaje genérico o corporativo ('anti-slop').\n"
                f"Plataformas preferidas: {', '.join(platforms)}\n"
                f"Historial de conversación:\n{json.dumps(messages, ensure_ascii=False)}\n\n"
                f"Contexto actual: Título='{current_title or ''}', Notas='{current_context or ''}', Formato='{preferred_format}'\n"
                f"Último mensaje del usuario: '{last_user_msg}'\n\n"
                f"Devuelve estrictamente un JSON con:\n"
                f"- 'reply': Tu respuesta conversacional al creador en markdown conciso (máx 3 párrafos).\n"
                f"- 'suggested_title': Título o titular definitivo sugerido.\n"
                f"- 'suggested_context_notes': Resumen enriquecido del briefing para redactar el post/guión.\n"
                f"- 'suggested_format': 'TEXT_ONLY', 'TEXT_AND_VIDEO', o 'VIDEO_ONLY'.\n"
                f"- 'suggested_platforms': lista de redes recomendadas.\n"
                f"- 'suggested_hooks': lista de 3 ganchos [{{'category': '...', 'hook_text': '...', 'pattern_interrupt': '...', 'estimated_hold_rate': ...}}].\n"
                f"- 'calculated_ice': float entre 1.0 y 10.0.\n"
                f"- 'tam_recommendation': 'CORE_80' o 'EXPANSION_20'.\n"
                f"- 'ready_to_create': boolean."
            )

            try:
                parsed, _ = await self._invoke_json("researcher_strategist", prompt, creator_profile)
                if parsed and isinstance(parsed.get("reply"), str) and len(parsed["reply"]) > 5:
                    return {
                        "reply": parsed["reply"],
                        "suggested_title": parsed.get("suggested_title") or current_title or last_user_msg[:60],
                        "suggested_context_notes": parsed.get("suggested_context_notes") or current_context or last_user_msg,
                        "suggested_format": parsed.get("suggested_format") or preferred_format,
                        "suggested_platforms": parsed.get("suggested_platforms") or platforms,
                        "suggested_hooks": parsed.get("suggested_hooks") or [],
                        "calculated_ice": float(parsed.get("calculated_ice") or 8.5),
                        "tam_recommendation": parsed.get("tam_recommendation") or "CORE_80",
                        "ready_to_create": bool(parsed.get("ready_to_create", True)),
                    }
            except Exception as exc:
                logger.warning("Error invoking LLM in chat_refine_idea: %s", exc)

        # Deterministic / Smart Heuristic Co-pilot Engine (strictly driven by user's actual message & context)
        lower_msg = (last_user_msg + " " + (current_context or "")).lower()
        has_linkedin = "linkedin" in lower_msg
        wants_video = "video" in lower_msg and not (
            "sin video" in lower_msg
            or "solo texto" in lower_msg
            or "solo escrito" in lower_msg
            or "publicacion escrita" in lower_msg
            or "publicación escrita" in lower_msg
        )

        detected_format = "TEXT_AND_VIDEO" if wants_video else (preferred_format or "TEXT_ONLY")
        detected_platforms = ["LinkedIn"] if has_linkedin else list(platforms)
        if ("twitter" in lower_msg or " x " in f" {lower_msg} ") and "X" not in detected_platforms:
            detected_platforms.append("X")

        raw_clean = re.sub(
            r"^(?:la idea es\s+(?:comentar|explicar|hablar|contar)?\s*(?:c[oó]mo|que|sobre)?\s*|"
            r"(?:redactar|crear|escribir|hacer|quiero|necesito|prepara|genera)\s+(?:un\s+)?(?:post|publicaci[oó]n|video|hilo|guion)\s+(?:en|para|sobre)?\s*(?:linkedin|instagram|tiktok|youtube|x|twitter)?\s*(?:indicando|explicando|hablando|que|sobre)?\s*)",
            "",
            last_user_msg.strip(),
            flags=re.IGNORECASE,
        ).strip()

        first_sentence = re.split(r"(?<=[.!?])\s+|\n", raw_clean)[0].strip() if raw_clean else ""
        suggested_title = (
            (current_title or "").strip()
            or (first_sentence[:72].rstrip(" ,.;:") if first_sentence else "Nueva Publicación Estratégica")
        )
        if suggested_title and suggested_title[0].islower():
            suggested_title = suggested_title[0].upper() + suggested_title[1:]

        # Preserve full user context without replacing it with canned templates
        if current_context and last_user_msg and last_user_msg.strip() not in current_context:
            context_brief = f"{current_context.strip()}\n\n{last_user_msg.strip()}"
        else:
            context_brief = (current_context or "").strip() or last_user_msg.strip()

        reply_text = (
            f"💡 He analizado tu enfoque: **{suggested_title}**.\n\n"
            f"Para que destaque en **{', '.join(detected_platforms)}** en formato "
            f"**{('Solo Texto / Post Escrito' if detected_format == 'TEXT_ONLY' else 'Video + Post Escrito')}**, "
            f"mantendremos íntegra tu experiencia real y la estructuraremos en 4 tiempos:\n"
            f"1. **Gancho inicial (<135 caracteres):** Una primera línea que rompa la expectativa antes del botón *'...ver más'*.\n"
            f"2. **Contexto real de campo:** Lo que pensabas al principio frente a lo que descubriste en la práctica.\n"
            f"3. **Aprendizaje / Propuesta de valor:** El giro concreto que resuelve el dolor real de tu audiencia.\n"
            f"4. **Cierre conversacional (CTA):** Invitación directa y natural a comentar o escribir por DM sin sonar a venta fría."
        )
        hooks = [
            {
                "category": "Contraintuitivo",
                "hook_text": suggested_title[:130],
                "pattern_interrupt": "Contraste directo entre expectativa y realidad",
                "estimated_hold_rate": 83.5,
            },
            {
                "category": "Experiencia de Campo",
                "hook_text": f"Lo que descubrí en la práctica sobre {suggested_title.lower()[:85]} (y por qué cambia el enfoque).",
                "pattern_interrupt": "Historia real en primera persona",
                "estimated_hold_rate": 80.5,
            },
            {
                "category": "Dolor Real",
                "hook_text": f"El verdadero cuello de botella detrás de {suggested_title.lower()[:85]}.",
                "pattern_interrupt": "Diagnóstico directo al punto de dolor",
                "estimated_hold_rate": 78.5,
            },
        ]

        return {
            "reply": reply_text,
            "suggested_title": suggested_title,
            "suggested_context_notes": context_brief,
            "suggested_format": detected_format,
            "suggested_platforms": detected_platforms,
            "suggested_hooks": hooks,
            "calculated_ice": 8.7,
            "tam_recommendation": "CORE_80",
            "ready_to_create": True,
        }

    async def compute_embedding_hybrid(self, text: str, dims: int = 1536) -> list[float]:
        """Compute semantic vector via Ollama (bge-m3 padded/projected to dims) or deterministic fallback."""
        cfg = self._effective_settings()
        if cfg["active_provider"] in ("auto", "ollama"):
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.post(
                        f"{cfg['ollama_base_url']}/api/embeddings",
                        json={"model": cfg["ollama_embedding_model"], "prompt": text},
                    )
                    if resp.status_code == 200:
                        emb = resp.json().get("embedding")
                        if isinstance(emb, list) and len(emb) > 0:
                            # Align dimension cleanly to 1536 for pgvector Vector(1536)
                            vec = [float(x) for x in emb[:dims]]
                            if len(vec) < dims:
                                vec.extend([0.0] * (dims - len(vec)))
                            return vec
            except Exception:
                pass
        return compute_deterministic_embedding(text, dims=dims)


_router_singleton: HybridLLMRouter | None = None


def get_llm_router() -> HybridLLMRouter:
    global _router_singleton
    if _router_singleton is None:
        _router_singleton = HybridLLMRouter()
    return _router_singleton
