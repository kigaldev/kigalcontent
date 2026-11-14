"""Core domain engines: Context Engine, ICE, Parametric Scripts, FSM, and RMT-A."""

from __future__ import annotations

import hashlib
import json
import math
import time
from typing import Any

from app.core.config import get_settings
from app.schemas.contracts import (
    ABPackagingVariant,
    ConversionGoal,
    DurationPreset,
    FSMState,
    HookCandidate,
    ICEScoreResponse,
    RMTADiagnosisRequest,
    RMTADiagnosisResponse,
    TAMClassification,
    TwoColumnScriptBlock,
    WatchTimeShareRequest,
    WatchTimeShareResponse,
)


DURATION_SPECS: dict[DurationPreset, dict[str, Any]] = {
    DurationPreset.MICRO_SHORT: {
        "label": "Micro-Short (15–30s)",
        "duration_range": (15, 30),
        "word_range": (40, 75),
        "cut_interval_sec": (1.5, 2.5),
        "channels": ["TikTok", "Instagram Reels", "YouTube Shorts"],
        "focus": "Loop Rate & Sends per Reach",
    },
    DurationPreset.STANDARD_SHORT: {
        "label": "Standard Short (45–60s)",
        "duration_range": (45, 60),
        "word_range": (110, 150),
        "cut_interval_sec": (3.0, 5.0),
        "channels": ["Instagram Reels", "TikTok", "YouTube Shorts"],
        "focus": "Gancho 0-3s + Conflicto + 2 Argumentos B-roll + CTA directa",
    },
    DurationPreset.EXTENDED_SHORT: {
        "label": "Extended Short (90–180s)",
        "duration_range": (90, 180),
        "word_range": (220, 380),
        "cut_interval_sec": (5.0, 8.0),
        "channels": ["TikTok", "YouTube Shorts (3m)", "LinkedIn Video"],
        "focus": "Historia + Marco de 3 Pasos + CTA de Cualificación",
    },
    DurationPreset.LONG_FORM: {
        "label": "Long-Form (8–12 min)",
        "duration_range": (480, 720),
        "word_range": (1200, 1700),
        "cut_interval_sec": (15.0, 30.0),
        "channels": ["YouTube Horizontal"],
        "focus": "Estructura STP en 5-7 bucles + Timestamps + Retención de Catálogo",
    },
}

VALID_FSM_TRANSITIONS: dict[FSMState, list[FSMState]] = {
    FSMState.INIT: [FSMState.CAPTURED],
    FSMState.CAPTURED: [FSMState.RESEARCHED_TRIAGED, FSMState.ARCHIVED],
    FSMState.RESEARCHED_TRIAGED: [FSMState.SCRIPTED_PACKAGED, FSMState.ARCHIVED],
    FSMState.SCRIPTED_PACKAGED: [FSMState.HITL_PENDING_PRODUCTION, FSMState.ARCHIVED],
    FSMState.HITL_PENDING_PRODUCTION: [FSMState.PRODUCED_VALIDATED, FSMState.REJECTED_REVISION],
    FSMState.PRODUCED_VALIDATED: [FSMState.HITL_PENDING_PUBLISH, FSMState.REJECTED_REVISION],
    FSMState.HITL_PENDING_PUBLISH: [FSMState.PUBLISHED_LIVE, FSMState.REJECTED_REVISION],
    FSMState.REJECTED_REVISION: [FSMState.SCRIPTED_PACKAGED, FSMState.PRODUCED_VALIDATED, FSMState.ARCHIVED],
    FSMState.PUBLISHED_LIVE: [FSMState.AUDITED_CLOSED_LOOP],
    FSMState.AUDITED_CLOSED_LOOP: [FSMState.CAPTURED],
    FSMState.ARCHIVED: [],
}

TRANSITION_SECURITY_TIERS: dict[tuple[FSMState, FSMState], int] = {
    (FSMState.SCRIPTED_PACKAGED, FSMState.HITL_PENDING_PRODUCTION): 2,
    (FSMState.HITL_PENDING_PUBLISH, FSMState.PUBLISHED_LIVE): 3,
}


def compute_deterministic_embedding(text: str, dims: int = 1536) -> list[float]:
    """Generate a normalized 1536-dim semantic fingerprint vector for pgvector storage."""
    seed_bytes = text.strip().lower().encode("utf-8")
    values: list[float] = []
    counter = 0
    while len(values) < dims:
        digest = hashlib.sha512(seed_bytes + counter.to_bytes(4, "big")).digest()
        for i in range(0, len(digest), 2):
            if len(values) >= dims:
                break
            raw = int.from_bytes(digest[i : i + 2], "big", signed=True)
            values.append(raw / 32768.0)
        counter += 1
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [round(v / norm, 6) for v in values]


def get_cta_for_goal(profile: dict[str, Any], goal: ConversionGoal) -> str:
    catalog = profile.get("conversion_goals_catalog", {})
    goal_data = catalog.get(goal.value, {})
    style = goal_data.get("preferred_cta_style")
    trigger = goal_data.get("trigger_word", "")

    defaults = {
        ConversionGoal.EMAIL_LEAD_CAPTURE: f"Comenta {trigger or 'BLUEPRINT'} y te envío el recurso completo por mensaje privado.",
        ConversionGoal.B2B_INBOUND_CONVERSATION: f"Si diriges una empresa y quieres auditar tus procesos, envíame un DM con la palabra {trigger or 'SISTEMAS'}.",
        ConversionGoal.RELATIONAL_DISTRIBUTION_SHARES: "Envíale este video a ese socio o colega que sigue atrapado operando todo de forma manual.",
        ConversionGoal.PLATFORM_RETENTION_LOOP: "Ahora que entiendes este principio, haz clic en el video que aparece en pantalla para ver la implementación técnica completa.",
    }
    if style:
        return style.replace("[TRIGGER_WORD]", trigger or "BLUEPRINT")
    return defaults[goal]


def calculate_ice_and_hooks(
    concept_title: str,
    impact: float,
    confidence: float,
    ease: float,
    tam_classification: TAMClassification = TAMClassification.CORE_80,
) -> ICEScoreResponse:
    """Compute ICE average, multiplicative score, triage status, and 5 categorized hooks."""
    ice_avg = round((impact + confidence + ease) / 3.0, 2)
    ice_mult = round(impact * confidence * ease, 2)
    if ice_avg >= 7.0:
        status = "APROBADO_PRIORITARIO"
    elif ice_avg >= 4.0:
        status = "EN_ESPERA"
    else:
        status = "DESCARTADO"

    hooks = [
        HookCandidate(
            category="Contrarian",
            hook_text=f"Deja de escalar horas en '{concept_title[:48]}': esto es lo que rompe tu margen.",
            pattern_interrupt="Zoom punch 115% + corte seco de audio a los 1.2s",
            estimated_hold_rate=74.5,
        ),
        HookCandidate(
            category="Curiosidad",
            hook_text=f"El patrón oculto detrás de {concept_title[:52]} que el 95% ignora.",
            pattern_interrupt="Overlay de métrica real con sonido whoosh grave",
            estimated_hold_rate=71.2,
        ),
        HookCandidate(
            category="Dolor/Pérdida",
            hook_text=f"Estás perdiendo el 80% de tu alcance por este único fallo en {concept_title[:42]}.",
            pattern_interrupt="Cambio a blanco y negro durante 0.8s + texto rojo en zona segura",
            estimated_hold_rate=69.8,
        ),
        HookCandidate(
            category="Historia Personal",
            hook_text=f"Pasé de operar 70 horas a automatizar '{concept_title[:40]}' en 14 días.",
            pattern_interrupt="B-roll de dashboard en vivo + BGM entra en el segundo 2.0",
            estimated_hold_rate=67.4,
        ),
        HookCandidate(
            category="Lista Accionable",
            hook_text=f"3 reglas técnicas para dominar {concept_title[:46]} hoy mismo.",
            pattern_interrupt="Contador numérico flotante [01/03] en tercio superior",
            estimated_hold_rate=66.1,
        ),
    ]

    return ICEScoreResponse(
        concept_title=concept_title,
        impact=impact,
        confidence=confidence,
        ease=ease,
        ice_score=ice_avg,
        ice_multiplicative=ice_mult,
        status=status,
        threshold_met=ice_avg >= 7.0,
        tam_classification=tam_classification,
        hook_candidates=hooks,
    )


def compute_block_metrics(
    blocks: list[TwoColumnScriptBlock],
    wpm_rate: int,
    preset: DurationPreset,
) -> tuple[list[TwoColumnScriptBlock], int, float, bool]:
    """Calculate per-block and total word count & oral duration at 130-150 WPM."""
    spec = DURATION_SPECS[preset]
    words_per_sec = wpm_rate / 60.0
    max_cut_window = spec["cut_interval_sec"][1] * 4.5 if preset != DurationPreset.LONG_FORM else 140.0

    updated: list[TwoColumnScriptBlock] = []
    total_words = 0
    total_sec = 0.0

    for block in blocks:
        wc = len([w for w in block.audio_voiceover.strip().split() if w])
        est_sec = round(wc / words_per_sec, 1) if wc > 0 else 0.0
        warning = est_sec > max_cut_window
        updated.append(
            block.model_copy(
                update={
                    "word_count": wc,
                    "estimated_seconds": est_sec,
                    "pacing_warning": warning,
                }
            )
        )
        total_words += wc
        total_sec += est_sec

    min_w, max_w = spec["word_range"]
    min_d, max_d = spec["duration_range"]
    within_budget = (min_w * 0.85 <= total_words <= max_w * 1.15) and (total_sec <= max_d * 1.15)
    return updated, total_words, round(total_sec, 1), within_budget


def generate_parametric_script(
    topic: str,
    preset: DurationPreset,
    goal: ConversionGoal,
    wpm_rate: int = 140,
    profile: dict[str, Any] | None = None,
) -> tuple[list[TwoColumnScriptBlock], list[ABPackagingVariant], str]:
    """Generate a duration-adapted Two-Column AV script and A/B packaging variants."""
    creator_profile = profile or get_settings().load_creator_profile_file()
    cta_text = get_cta_for_goal(creator_profile, goal)
    niche = creator_profile.get("niche", "Sistemas de Contenido e IA")

    if preset == DurationPreset.MICRO_SHORT:
        raw_blocks = [
            TwoColumnScriptBlock(
                block_id="blk-1",
                section_label="Gancho Binario (0-3s)",
                timecode="00:00 - 00:04",
                visual_direction="Primer plano cerrado. Corte rápido 115%. Texto: 'NO ES VOLUMEN'.",
                b_roll_cue="Overlay rojo sobre gráfico de caída",
                on_screen_text="NO ES VOLUMEN, ES SISTEMA",
                audio_voiceover=f"El noventa por ciento falla en {topic} porque produce sin métricas ni estructura.",
                sfx_cue="Whoosh seco + Impact",
                music_cue="Silencio táctico 1.5s",
                pattern_interrupt_sec=1.8,
            ),
            TwoColumnScriptBlock(
                block_id="blk-2",
                section_label="Contraste Binario",
                timecode="00:04 - 00:18",
                visual_direction="Split screen: caos manual vs dashboard limpio. Cortes cada 2s.",
                b_roll_cue="Captura de flujo Temporal + checklist verde",
                on_screen_text="3 SEGUNDOS DECISIVOS",
                audio_voiceover="En cambio cuando auditas tu retención cada cuarenta y ocho horas y cortas silencios muertos, multiplicas tu alcance sin grabar el doble.",
                sfx_cue="Click mecánico cada cambio",
                music_cue="Beat electrónico 128 BPM (-20 dB)",
                pattern_interrupt_sec=2.0,
            ),
            TwoColumnScriptBlock(
                block_id="blk-3",
                section_label="Bucle y CTA Relacional",
                timecode="00:18 - 00:27",
                visual_direction="Regreso a cámara con push-in rápido y flecha al botón compartir.",
                b_roll_cue="Icono DM + Loop visual al primer frame",
                on_screen_text="GUARDA Y COMPARTE",
                audio_voiceover=f"{cta_text} Y por eso mismo...",
                sfx_cue="Pop final + transición en bucle",
                music_cue="Corte limpio en beat",
                pattern_interrupt_sec=2.0,
            ),
        ]
    elif preset == DurationPreset.STANDARD_SHORT:
        raw_blocks = [
            TwoColumnScriptBlock(
                block_id="blk-1",
                section_label="Gancho Verbal (0-3s)",
                timecode="00:00 - 00:04",
                visual_direction="Plano medio corto, contacto visual directo. Zoom 112% en palabra clave.",
                b_roll_cue="Texto grande centrado en zona segura (50% altura)",
                on_screen_text="EL ERROR QUE MATA TU ALCANCE",
                audio_voiceover=f"Si estás trabajando en {topic} sin validar primero el empaque, estás quemando tu mejor energía.",
                sfx_cue="Whoosh grave",
                music_cue="Silencio inicial 2s",
                pattern_interrupt_sec=3.0,
            ),
            TwoColumnScriptBlock(
                block_id="blk-2",
                section_label="Conflicto y Tensión",
                timecode="00:04 - 00:18",
                visual_direction="Corte a ángulo lateral 30° + gráfica de retención cayendo en los primeros 5s.",
                b_roll_cue="Screen recording de métricas 24h vs 7d",
                on_screen_text="CTR SIN RETENCIÓN = CASTIGO",
                audio_voiceover="La mayoría optimiza para clics vacíos o likes pasivos. Pero los algoritmos actuales miden Watch Time Share y envíos privados por mensaje directo. Si tu promesa inicial no coincide con los primeros diez segundos, la distribución se apaga al instante.",
                sfx_cue="Sub-bass drop",
                music_cue="Entra groove minimal (-22 dB)",
                pattern_interrupt_sec=4.0,
            ),
            TwoColumnScriptBlock(
                block_id="blk-3",
                section_label="Argumento 1 + B-Roll",
                timecode="00:18 - 00:34",
                visual_direction="B-roll de editor a dos columnas y normalización -14 LUFS en pantalla.",
                b_roll_cue="Timeline FFmpeg recortando silencios >400ms",
                on_screen_text="1. RITMO Y SONORIDAD -14 LUFS",
                audio_voiceover="Primero aplica diseño packaging-first y poda automática de pausas mayores a cuatrocientos milisegundos. Un ritmo vocal claro a ciento cuarenta palabras por minuto con sonoridad constante evita que la plataforma comprima tu audio y retiene al espectador.",
                sfx_cue="Teclado + swooshes",
                music_cue="Beat constante",
                pattern_interrupt_sec=4.0,
            ),
            TwoColumnScriptBlock(
                block_id="blk-4",
                section_label="Argumento 2 + CTA Objetivo",
                timecode="00:34 - 00:54",
                visual_direction="Regreso a plano principal con tarjeta gráfica del recurso y flecha animada.",
                b_roll_cue="Mockup de plantilla + matriz RMT-A",
                on_screen_text="2. BUCLE CERRADO RMT-A",
                audio_voiceover=f"Segundo, clasifica cada pieza con el marco RMT-A para repetir lo que escala y descartar lo que no tracciona. {cta_text}",
                sfx_cue="Campana sutil + pop",
                music_cue="Fade out progresivo",
                pattern_interrupt_sec=4.0,
            ),
        ]
    elif preset == DurationPreset.EXTENDED_SHORT:
        raw_blocks = [
            TwoColumnScriptBlock(
                block_id="blk-1",
                section_label="Gancho + Historia Inicial",
                timecode="00:00 - 00:25",
                visual_direction="Plano medio dinámico en estudio con cambio de plano cada 6s.",
                b_roll_cue="Archivo histórico + calendario editorial saturado",
                on_screen_text="DE 40 HORAS MANUALES A 1 SISTEMA",
                audio_voiceover=f"Hace seis meses publicábamos contenido sobre {topic} todos los días y los ingresos seguían estancados. El problema no era la cámara ni la frecuencia: era operar sin una arquitectura que conectara investigación empírica, guionizado por duración y analítica de bucle cerrado.",
                sfx_cue="Whoosh cinematográfico",
                music_cue="Tensión rítmica (-22 dB)",
                pattern_interrupt_sec=6.0,
            ),
            TwoColumnScriptBlock(
                block_id="blk-2",
                section_label="Paso 1: Triaje ICE",
                timecode="00:25 - 00:55",
                visual_direction="Captura interactiva del tablero Kanban e índice ICE >= 7.0.",
                b_roll_cue="Highlight animado en fórmula ICE",
                on_screen_text="PASO 1: FILTRO ICE >= 7.0",
                audio_voiceover="El primer paso del marco es el triaje cuantitativo ICE. Antes de encender luces evaluamos Impacto, Confianza basada en datos reales del canal y Facilidad de producción. Toda idea por debajo de siete puntos se archiva o se refina. Así dejamos de grabar intuiciones y garantizamos que cada minuto frente a cámara tenga retorno.",
                sfx_cue="Click UI",
                music_cue="Beat progresivo",
                pattern_interrupt_sec=6.5,
            ),
            TwoColumnScriptBlock(
                block_id="blk-3",
                section_label="Paso 2: Ejecución Determinista",
                timecode="00:55 - 01:30",
                visual_direction="Demostración de Whisper palabra por palabra y zonas seguras 9:16.",
                b_roll_cue="Simulador móvil TikTok + Instagram Reels",
                on_screen_text="PASO 2: ZONAS SEGURAS Y LUFS",
                audio_voiceover="El segundo paso es la posproducción determinista. Automatizamos la extracción de pausas muertas, normalizamos el audio exactamente a menos catorce LUFS según norma broadcast y ubicamos los subtítulos dinámicos en la banda central segura para que los botones de TikTok o Instagram jamás tapen el mensaje clave.",
                sfx_cue="Beep de validación QC",
                music_cue="Beat constante",
                pattern_interrupt_sec=7.0,
            ),
            TwoColumnScriptBlock(
                block_id="blk-4",
                section_label="Paso 3: Payoff y Cualificación",
                timecode="01:30 - 02:10",
                visual_direction="Plano frontal con recuadro comparativo de Watch Time Share y CTA.",
                b_roll_cue="Cuadrante RMT-A + tarjeta de perfil",
                on_screen_text="PASO 3: REGLA RMT-A Y CTA",
                audio_voiceover=f"El tercer paso cierra el ciclo a veinticuatro horas, siete días y treinta días. Resolvemos pruebas A/B por cuota de tiempo de visualización y convertimos los aprendizajes en reglas permanentes para el siguiente guión. {cta_text}",
                sfx_cue="Acorde resolutivo",
                music_cue="Cierre limpio",
                pattern_interrupt_sec=6.5,
            ),
        ]
    else:
        # LONG_FORM (8-12 min, 1200-1700 words target)
        stp_loops = []
        loop_titles = [
            ("Gancho & Promesa Maestra", "00:00 - 00:45", "POR QUÉ TU CONTENIDO NO ESCALA"),
            ("Bucle STP 1: El Diagnóstico Empírico y Triaje ICE", "00:45 - 02:15", "01. METODOLOGÍA ICE Y TAM 80/20"),
            ("Bucle STP 2: Ingeniería de Empaque A/B y Watch Time Share", "02:15 - 03:50", "02. PACKAGING-FIRST & WATCH TIME SHARE"),
            ("Bucle STP 3: Arquitectura de Guión AV a Dos Columnas", "03:50 - 05:30", "03. RITMO 140 WPM Y PATTERN INTERRUPTS"),
            ("Bucle STP 4: Posproducción GPU con FFmpeg y Faster-Whisper", "05:30 - 07:15", "04. PIPELINE DETERMINISTA -14 LUFS"),
            ("Bucle STP 5: Distribución Multicanal Anti-Penalización y HITL", "07:15 - 09:00", "05. COPYCRAFTING Y FIRMA TIER 3"),
            ("Bucle STP 6: Analítica RMT-A y Bucle Cerrado", "09:00 - 10:30", "06. CIERRE RMT-A Y SIGUIENTE VIDEO"),
        ]
        for idx, (label, tc, overlay) in enumerate(loop_titles):
            is_last = idx == len(loop_titles) - 1
            body_text = (
                f"En este bloque analizamos {label} aplicado directamente a {topic} dentro del nicho de {niche}. "
                "Cuando construimos sistemas de producción audiovisual para operadores modernos, cada transición debe abrir una tensión narrativa nueva y cerrarla con evidencia verificable. "
                "Observa cómo se comporta la curva de retención segundo a segundo cuando eliminamos introducciones genéricas y entregamos contexto accionable desde la primera frase. "
                "En lugar de improvisar frente a cámara, dividimos cada argumento en un SETUP que plantea el problema de mercado, una TENSIÓN que contrasta el error común frente a la métrica real, y un PAYOFF que demuestra la solución técnica con ejemplos concretos. "
                "Al mantener cambios visuales cada quince a veinticinco segundos mediante diagramas, capturas reales de tablero y reencuadres sutiles, logramos sostener una duración media de visualización superior al cincuenta por ciento. "
                "Esta disciplina operativa transforma piezas aisladas en activos compuestos que captan tráfico sugerido y de búsqueda durante meses."
            )
            if is_last:
                body_text += f" Para cerrar el ciclo completo, revisa la matriz RMT-A e implementa estas reglas en tu próxima iteración. {cta_text}"
            stp_loops.append(
                TwoColumnScriptBlock(
                    block_id=f"blk-{idx+1}",
                    section_label=label,
                    timecode=tc,
                    visual_direction=f"Plano principal + diagrama técnico STP #{idx+1} + B-roll contextual cada 20s.",
                    b_roll_cue="Captura de arquitectura / Gráfica de retención / Diagrama de flujo",
                    on_screen_text=overlay,
                    audio_voiceover=body_text,
                    sfx_cue="Transición sutil entre capítulos",
                    music_cue="Cama ambiental lo-fi (-24 dB)",
                    pattern_interrupt_sec=20.0,
                )
            )
        raw_blocks = stp_loops

    computed_blocks, _, _, _ = compute_block_metrics(raw_blocks, wpm_rate, preset)

    ab_variants = [
        ABPackagingVariant(
            variant_label="A",
            title=f"{topic[:44]} (Sistema Real)",
            thumbnail_concept="Rostro expresivo a la derecha + gráfico de retención subiendo + 3 palabras máximo",
            thumbnail_dimensions="1280x720",
            hypothesis="Enfoque de autoridad técnica con contraste limpio",
        ),
        ABPackagingVariant(
            variant_label="B",
            title=f"Por qué falla {topic[:38]}",
            thumbnail_concept="Split antes/después en alto contraste rojo/verde con métrica -14 LUFS / 3.4x",
            thumbnail_dimensions="1280x720",
            hypothesis="Curiosidad negativa / prevención de pérdida para maximizar Watch Time Share",
        ),
    ]

    return computed_blocks, ab_variants, cta_text


def calculate_watch_time_share(req: WatchTimeShareRequest) -> WatchTimeShareResponse:
    """YouTube Test & Compare Watch Time Share calculation."""
    clicks_a = req.variant_a.impressions * (req.variant_a.ctr_pct / 100.0)
    total_watch_a = clicks_a * req.variant_a.avd_seconds

    clicks_b = req.variant_b.impressions * (req.variant_b.ctr_pct / 100.0)
    total_watch_b = clicks_b * req.variant_b.avd_seconds

    total_watch = total_watch_a + total_watch_b
    share_a = round((total_watch_a / total_watch * 100.0) if total_watch > 0 else 50.0, 2)
    share_b = round((total_watch_b / total_watch * 100.0) if total_watch > 0 else 50.0, 2)

    winner = "A" if share_a > share_b else ("B" if share_b > share_a else "TIE")
    delta_pct = round(abs(share_a - share_b), 2)

    explanation = (
        f"Variante {winner} gana con {max(share_a, share_b)}% de cuota total de tiempo visualizado "
        f"(A={round(total_watch_a / 60, 1)} min vs B={round(total_watch_b / 60, 1)} min), "
        "penalizando clics engañosos con baja retención."
        if winner != "TIE"
        else "Empate estadístico exacto en Watch Time Share."
    )

    return WatchTimeShareResponse(
        variant_a_watch_time_seconds=round(total_watch_a, 1),
        variant_b_watch_time_seconds=round(total_watch_b, 1),
        share_a_pct=share_a,
        share_b_pct=share_b,
        winner=winner,
        delta_pct=delta_pct,
        explanation=explanation,
    )


def diagnose_rmta(req: RMTADiagnosisRequest) -> RMTADiagnosisResponse:
    """4-layer causal diagnosis (Idea, Empaque, Ejecución, Distribución) & RMT-A classification."""
    views_factor = req.views / req.baseline_views if req.baseline_views > 0 else 1.0
    is_outlier_pos = views_factor >= 3.0
    is_outlier_neg = views_factor <= 0.5

    if req.consecutive_bottom_quartile_iterations >= 3:
        rmta = "ABANDONAR"
        layer = "FALLO_SISTEMICO_FORMATO"
        action = "3 iteraciones consecutivas en el cuartil inferior. Archivar formato y reasignar presupuesto al 80% Core."
        rule = f"Abandonar patrón actual tras 3 iteraciones <= 0.5x media ({round(views_factor, 2)}x)."
    elif req.hold_rate_3s >= 60.0 and req.completion_rate >= 50.0:
        rmta = "REPETIR_FRANQUICIAR"
        layer = "EXITO_ESTRUCTURAL"
        action = "Alto empaque + alta retención. Convertir en franquicia recurrente (Paddy Galloway Playbook)."
        rule = f"Repetir estructura ganadora: Hold 3s {req.hold_rate_3s}% y Completion {req.completion_rate}% ({round(views_factor, 2)}x)."
    elif req.hold_rate_3s < 50.0 and req.completion_rate >= 50.0:
        rmta = "MEJORAR"
        layer = "EMPAQUE_DEFICIENTE"
        action = "Alta retención pero bajo freno/CTR. Reescribir primeras 3 palabras del gancho y renovar miniatura A/B."
        rule = f"Conservar estructura narrativa pero reemplazar gancho/portada (Hold {req.hold_rate_3s}% < 50%)."
    elif req.hold_rate_3s >= 60.0 and req.completion_rate < 35.0:
        rmta = "MEJORAR"
        layer = "EJECUCION_DISPAR_CLICKBAIT"
        action = "Alto freno pero caída rápida. Re-cortar segundos 3–15, acelerar interrupciones de patrón y alinear promesa."
        rule = f"Alinear promesa del gancho con entrega en primeros 15s (Completion {req.completion_rate}% < 35%)."
    else:
        rmta = "PROBAR"
        layer = "FALLO_PREMISA_O_TAM"
        action = "Evaluar como experimento del 20% TAM o ajustar ángulo de distribución y horario."
        rule = f"Mantener en cuadrante de prueba controlada (20% TAM) antes de escalar ({round(views_factor, 2)}x)."

    four_layers = {
        "idea_tam": {
            "status": "STRONG" if views_factor >= 1.2 else ("WEAK" if views_factor <= 0.6 else "NEUTRAL"),
            "metric": f"{round(views_factor, 2)}x vs baseline",
            "note": "Tracción de premisa y relevancia del mercado objetivo.",
        },
        "empaque": {
            "status": "STRONG" if req.hold_rate_3s >= 60.0 else ("WEAK" if req.hold_rate_3s < 50.0 else "NEUTRAL"),
            "metric": f"{req.hold_rate_3s}% Hold 3s / CTR",
            "note": "Capacidad de frenar scroll y ganar Watch Time Share.",
        },
        "ejecucion": {
            "status": "STRONG" if req.completion_rate >= 50.0 else ("WEAK" if req.completion_rate < 35.0 else "NEUTRAL"),
            "metric": f"{req.completion_rate}% Completion / AVD",
            "note": "Ritmo audiovisual, cortes >400ms y cumplimiento de promesa.",
        },
        "distribucion": {
            "status": "STRONG" if req.sends_per_reach >= 2.0 else "NEUTRAL",
            "metric": f"{req.sends_per_reach}% Sends/Reach | {req.dwell_time_seconds}s Dwell",
            "note": "Distribución relacional (Dark Social) y tiempo de lectura en plataforma.",
        },
    }

    return RMTADiagnosisResponse(
        views_factor_vs_baseline=round(views_factor, 2),
        is_outlier_positive=is_outlier_pos,
        is_outlier_negative=is_outlier_neg,
        diagnosis_layer=layer,
        rmta_classification=rmta,
        recommended_action=action,
        sends_social_value_sufficient=req.sends_per_reach >= 2.0,
        four_layer_breakdown=four_layers,
        learned_rule_statement=rule,
    )


def append_learned_rule_file(rule_entry: dict[str, Any]) -> None:
    """Persist closed-loop RMT-A learning rule into .content_engine/memory/learned_rules.json."""
    path = get_settings().learned_rules_path
    path.parent.mkdir(parents=True, exist_ok=True)
    existing: list[dict[str, Any]] = []
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                existing = data
            elif isinstance(data, dict):
                existing = data.get("rules", [])
        except json.JSONDecodeError:
            existing = []
    existing.append({**rule_entry, "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    path.write_text(json.dumps({"rules": existing[-100:]}, indent=2, ensure_ascii=False), encoding="utf-8")
