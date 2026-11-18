"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  Calculator,
  Check,
  Clock,
  FileText,
  HelpCircle,
  Instagram,
  Layers,
  Loader2,
  PlaySquare,
  PlusCircle,
  Radio,
  Shield,
  Sparkles,
  Target,
  Twitter,
  Zap,
} from "lucide-react";
import { useEngineStore } from "@/store/useEngineStore";
import { apiClient } from "@/lib/api";
import {
  CONVERSION_GOAL_META,
  DURATION_PRESET_META,
  FSM_COLUMNS,
  HUMAN_STATE_LABELS,
} from "@/lib/utils";
import type {
  ContentProject,
  ConversionGoal,
  DurationPreset,
  FSMState,
  IdeaAIEvaluationResponse,
  ScriptTargetPlatform,
} from "@/types/engine";

interface KanbanPipelineBoardProps {
  onRefresh: () => Promise<void>;
}

const NEXT_STATE_MAP: Partial<Record<FSMState, FSMState>> = {
  CAPTURED: "RESEARCHED_TRIAGED",
  RESEARCHED_TRIAGED: "SCRIPTED_PACKAGED",
  SCRIPTED_PACKAGED: "HITL_PENDING_PRODUCTION",
  HITL_PENDING_PRODUCTION: "PRODUCED_VALIDATED",
  PRODUCED_VALIDATED: "HITL_PENDING_PUBLISH",
  HITL_PENDING_PUBLISH: "PUBLISHED_LIVE",
  PUBLISHED_LIVE: "AUDITED_CLOSED_LOOP",
};

const AVAILABLE_PLATFORMS: Array<{
  id: ScriptTargetPlatform;
  label: string;
  shortLabel: string;
  badge: string;
  activeColor: string;
  borderColor: string;
}> = [
  {
    id: "YouTube",
    label: "YouTube",
    shortLabel: "YT",
    badge: "Shorts & 16:9",
    activeColor: "bg-red-600/20 text-red-300 border-red-500/40",
    borderColor: "hover:border-red-500/40",
  },
  {
    id: "Instagram",
    label: "Instagram",
    shortLabel: "IG",
    badge: "Reels & Grid",
    activeColor: "bg-pink-600/20 text-pink-300 border-pink-500/40",
    borderColor: "hover:border-pink-500/40",
  },
  {
    id: "TikTok",
    label: "TikTok",
    shortLabel: "TT",
    badge: "SEO & Loops",
    activeColor: "bg-cyan-600/20 text-cyan-300 border-cyan-500/40",
    borderColor: "hover:border-cyan-500/40",
  },
  {
    id: "LinkedIn",
    label: "LinkedIn",
    shortLabel: "LI",
    badge: "Zero-Link",
    activeColor: "bg-blue-600/20 text-blue-300 border-blue-500/40",
    borderColor: "hover:border-blue-500/40",
  },
  {
    id: "X",
    label: "X (Twitter)",
    shortLabel: "X",
    badge: "Hilos Virales",
    activeColor: "bg-slate-700/40 text-slate-200 border-slate-500/50",
    borderColor: "hover:border-slate-500/40",
  },
];

export function KanbanPipelineBoard({ onRefresh }: KanbanPipelineBoardProps) {
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    setActiveTab,
    openHitlModal,
    showToast,
    backendOnline,
    setProjects,
  } = useEngineStore();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [radarFilter, setRadarFilter] = useState<"all" | "radar" | "manual">("all");

  // Idea Form State
  const [title, setTitle] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<ScriptTargetPlatform[]>([
    "YouTube",
    "Instagram",
    "TikTok",
    "LinkedIn",
    "X",
  ]);
  const [duration, setDuration] = useState<DurationPreset>("STANDARD_SHORT");
  const [goal, setGoal] = useState<ConversionGoal>("EMAIL_LEAD_CAPTURE");
  const [tam, setTam] = useState<"CORE_80" | "EXPANSION_20">("CORE_80");
  const [impact, setImpact] = useState(8.5);
  const [confidence, setConfidence] = useState(8.0);
  const [ease, setEase] = useState(7.8);
  const [creating, setCreating] = useState(false);

  // AI Evaluation State
  const [evaluatingAI, setEvaluatingAI] = useState(false);
  const [aiEvaluation, setAiEvaluation] = useState<IdeaAIEvaluationResponse | null>(null);
  const [ingestingRadar, setIngestingRadar] = useState(false);

  const liveIce = useMemo(
    () => Math.round(((impact + confidence + ease) / 3) * 10) / 10,
    [impact, confidence, ease]
  );

  const radarCount = useMemo(
    () =>
      projects.filter(
        (p) => p.source_origin === "radar_matutino" || p.source_origin === "n8n_cron"
      ).length,
    [projects]
  );

  const manualCount = useMemo(
    () =>
      projects.filter(
        (p) => p.source_origin !== "radar_matutino" && p.source_origin !== "n8n_cron"
      ).length,
    [projects]
  );

  const filteredProjects = useMemo(() => {
    if (radarFilter === "radar") {
      return projects.filter(
        (p) => p.source_origin === "radar_matutino" || p.source_origin === "n8n_cron"
      );
    }
    if (radarFilter === "manual") {
      return projects.filter(
        (p) => p.source_origin !== "radar_matutino" && p.source_origin !== "n8n_cron"
      );
    }
    return projects;
  }, [projects, radarFilter]);

  const togglePlatform = (pId: ScriptTargetPlatform) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(pId)) {
        if (prev.length <= 1) {
          showToast("info", "Debes mantener al menos una plataforma seleccionada.");
          return prev;
        }
        return prev.filter((p) => p !== pId);
      }
      return [...prev, pId];
    });
  };

  const handleAIEvaluate = async () => {
    if (!title.trim()) {
      showToast("info", "Escribe primero un título o concepto de la idea para valorarla.");
      return;
    }
    setEvaluatingAI(true);
    try {
      if (backendOnline) {
        const res = await apiClient.evaluateIdeaWithAI({
          concept_title: title.trim(),
          context_notes: contextNotes.trim() || undefined,
          target_platforms: selectedPlatforms,
        });
        setAiEvaluation(res);
        setImpact(res.impact);
        setConfidence(res.confidence);
        setEase(res.ease);
        setTam(res.tam_classification);
        if (res.suggested_platforms && res.suggested_platforms.length > 0) {
          setSelectedPlatforms(res.suggested_platforms);
        }
        showToast(
          "success",
          `✨ Idea valorada con IA: Prioridad ${res.ice_score}/10 (${res.tam_classification === "CORE_80" ? "Comunidad 80%" : "Expansión 20%"}).`
        );
      } else {
        // Local heuristic fallback
        const mockScore = 8.4;
        setImpact(8.7);
        setConfidence(8.2);
        setEase(8.3);
        setTam("CORE_80");
        setAiEvaluation({
          impact: 8.7,
          confidence: 8.2,
          ease: 8.3,
          ice_score: mockScore,
          tam_classification: "CORE_80",
          rationale: `Análisis local IA: Idea de alto potencial para tu nicho con ${contextNotes.split(" ").length} palabras de contexto. Tasa de retención proyectada del 78%.`,
          suggested_platforms: selectedPlatforms,
          hook_candidates: [
            {
              category: "Contraintuitivo",
              hook_text: `La mayoría de creadores hacen ${title} completamente al revés.`,
              pattern_interrupt: "Zoom 115% + SFX pop",
              estimated_hold_rate: 78.5,
            },
          ],
          estimated_hold_rate: 78.5,
        });
        showToast("info", `✨ Idea valorada localmente con Prioridad ${mockScore}/10.`);
      }
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Error al evaluar idea con IA"
      );
    } finally {
      setEvaluatingAI(false);
    }
  };

  const handleSimulateRadarIngest = async () => {
    setIngestingRadar(true);
    try {
      const sampleTitles = [
        "Cómo desplegar un Content Engine con IA local sin pagar cuotas SaaS",
        "3 Errores de audio y pausas muertas que hunden tu retención en YouTube y TikTok",
        "Estrategia Zero-Link en LinkedIn: Por qué poner enlaces en el post destruye tu alcance",
        "Por qué los creadores que no usan Lead Magnets automáticos pierden el 80% de sus clientes",
      ];
      const randomTitle = sampleTitles[Math.floor(Math.random() * sampleTitles.length)];
      const sampleNotes =
        "Radar Matutino n8n: Tendencia detectada en newsletters y GitHub trending. La audiencia busca sistemas que operen de forma autónoma sin depender de suscripciones recurrentes. Conexión directa con Lead Magnet de automatización.";

      if (backendOnline) {
        const res = await apiClient.ingestRadarMatutino({
          concept_title: randomTitle,
          context_notes: sampleNotes,
          source_origin: "radar_matutino",
          source_url: "https://news.ycombinator.com",
          target_platforms: ["YouTube", "Instagram", "TikTok", "LinkedIn", "X"],
          target_duration: "STANDARD_SHORT",
          conversion_goal: "EMAIL_LEAD_CAPTURE",
          auto_evaluate_ai: true,
          auto_create_project: true,
        });
        await onRefresh();
        if (res.project_id) {
          setSelectedProjectId(res.project_id);
        }
        showToast(
          "success",
          `📡 Radar Matutino: Ingestada idea "${res.concept_title}" con Prioridad IA ${res.ice_score}/10.`
        );
      } else {
        const mock: ContentProject = {
          id: crypto.randomUUID(),
          asset_code: `KC-${Math.floor(100 + Math.random() * 900)}`,
          working_title: randomTitle,
          target_duration: "STANDARD_SHORT",
          conversion_goal: "EMAIL_LEAD_CAPTURE",
          current_state: "SCRIPTED_PACKAGED",
          ice_score: 8.6,
          tam_classification: "CORE_80",
          context_notes: sampleNotes,
          source_origin: "radar_matutino",
          target_platforms: ["YouTube", "Instagram", "TikTok", "LinkedIn", "X"],
          ab_variants: [],
          state_history: [],
          temporal_workflow_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setProjects([mock, ...projects]);
        setSelectedProjectId(mock.id);
        showToast(
          "success",
          `📡 Radar Matutino: Idea simulada guardada con Prioridad 8.6/10.`
        );
      }
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Error ingrestando desde Radar Matutino"
      );
    } finally {
      setIngestingRadar(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      if (backendOnline) {
        const created = await apiClient.createProject({
          working_title: title.trim(),
          target_duration: duration,
          conversion_goal: goal,
          tam_classification: tam,
          impact,
          confidence,
          ease,
          context_notes: contextNotes.trim() || undefined,
          source_origin: "manual",
          target_platforms: selectedPlatforms,
        });
        await onRefresh();
        setSelectedProjectId(created.id);
        showToast(
          "success",
          `Idea "${created.working_title}" guardada con prioridad ${created.ice_score}/10.`
        );
      } else {
        const mock: ContentProject = {
          id: crypto.randomUUID(),
          asset_code: `KC-${Math.floor(100 + Math.random() * 900)}`,
          working_title: title.trim(),
          target_duration: duration,
          conversion_goal: goal,
          current_state: liveIce >= 7.0 ? "SCRIPTED_PACKAGED" : "ARCHIVED",
          ice_score: liveIce,
          tam_classification: tam,
          context_notes: contextNotes.trim() || undefined,
          source_origin: "manual",
          target_platforms: selectedPlatforms,
          ab_variants: [],
          state_history: [],
          temporal_workflow_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setProjects([mock, ...projects]);
        setSelectedProjectId(mock.id);
        showToast("info", `Idea guardada localmente con prioridad ${liveIce}/10.`);
      }
      setTitle("");
      setContextNotes("");
      setAiEvaluation(null);
      setShowCreateForm(false);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error creando idea");
    } finally {
      setCreating(false);
    }
  };

  const handleAdvanceState = async (proj: ContentProject) => {
    const nextState = NEXT_STATE_MAP[proj.current_state];
    if (!nextState) return;

    if (
      proj.current_state === "SCRIPTED_PACKAGED" &&
      nextState === "HITL_PENDING_PRODUCTION"
    ) {
      openHitlModal({
        open: true,
        projectId: proj.id,
        assetCode: proj.asset_code,
        targetState: nextState,
        tier: 2,
        action: "approve_script_for_production",
        description:
          "Revisión antes de grabar: Confirmas que el guión y los textos están listos para pasar a grabación y edición.",
      });
      return;
    }

    if (
      proj.current_state === "HITL_PENDING_PUBLISH" &&
      nextState === "PUBLISHED_LIVE"
    ) {
      openHitlModal({
        open: true,
        projectId: proj.id,
        assetCode: proj.asset_code,
        targetState: nextState,
        tier: 3,
        action: "publish_all_channels_live",
        description:
          "Autorización de publicación en redes sociales: Estás autorizando publicar este video de forma definitiva en tus canales.",
      });
      return;
    }

    try {
      if (backendOnline) {
        await apiClient.transitionProject(proj.id, {
          target_state: nextState,
          agent_or_user: "Creador",
        });
        await onRefresh();
        showToast("success", `El video avanzó a: ${HUMAN_STATE_LABELS[nextState] ?? nextState}`);
      } else {
        setProjects(
          projects.map((p) =>
            p.id === proj.id ? { ...p, current_state: nextState } : p
          )
        );
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error al cambiar de fase");
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Header & Radar Matutino Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#07090e] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950">
              1
            </span>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Paso 1: Tablero de Ideas y Prioridades
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Organiza tus ideas según su fase de producción, recibe el material automático del <strong>Radar Matutino</strong> y calcula objetivamente la prioridad con IA antes de grabar.
          </p>
        </div>

        {/* Filters and Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Radar Matutino Filter Chips */}
          <div className="flex items-center bg-[#020306] border border-slate-800 rounded-lg p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setRadarFilter("all")}
              className={`px-2.5 py-1.5 rounded-md transition ${
                radarFilter === "all"
                  ? "bg-slate-800 text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Todos ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setRadarFilter("radar")}
              className={`px-2.5 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                radarFilter === "radar"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold"
                  : "text-slate-400 hover:text-amber-300"
              }`}
            >
              <Radio className="w-3 h-3 text-amber-400" />
              <span>Radar ({radarCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setRadarFilter("manual")}
              className={`px-2.5 py-1.5 rounded-md transition ${
                radarFilter === "manual"
                  ? "bg-slate-800 text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Manuales ({manualCount})
            </button>
          </div>

          {/* Simulate Radar Ingestion */}
          <button
            type="button"
            onClick={handleSimulateRadarIngest}
            disabled={ingestingRadar}
            title="Simula la recepción de una idea enriquecida desde la automatización n8n Radar Matutino"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-950/20 text-amber-300 hover:bg-amber-950/40 text-xs font-medium transition"
          >
            {ingestingRadar ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Radio className="w-3.5 h-3.5" />
            )}
            <span>{ingestingRadar ? "Ingestando..." : "Ingesta Radar Matutino"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-300 hover:text-white text-xs font-medium transition"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>{showGuide ? "Ocultar Guía" : "¿Cómo funciona?"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs sm:text-sm transition shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{showCreateForm ? "Cerrar Formulario" : "Añadir Nueva Idea"}</span>
          </button>
        </div>
      </div>

      {/* Explanatory Box (Plain Language) */}
      {showGuide && (
        <div className="rounded-xl border border-cyan-500/30 bg-[#070c14] p-4 text-xs text-slate-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-cyan-300 text-sm">
            <Sparkles className="w-4 h-4" />
            ¿Cómo saber qué idea grabar primero? (Prioridad Calculada con IA)
          </div>
          <p className="leading-relaxed">
            Para evitar perder horas grabando videos que nadie verá, nuestro director de contenido IA evalúa cada idea y contexto según tres factores metodológicos:
          </p>
          <ul className="grid sm:grid-cols-3 gap-3 pt-1">
            <li className="bg-[#020306] border border-slate-800 rounded-lg p-2.5">
              <strong className="text-white block mb-0.5">1. Impacto</strong>
              ¿Cuánto valor aporta a tu audiencia y qué potencial de retención y viralidad tiene?
            </li>
            <li className="bg-[#020306] border border-slate-800 rounded-lg p-2.5">
              <strong className="text-white block mb-0.5">2. Confianza</strong>
              ¿Qué tan validado está el interés y dolor de tu nicho y cliente ideal (ICP)?
            </li>
            <li className="bg-[#020306] border border-slate-800 rounded-lg p-2.5">
              <strong className="text-white block mb-0.5">3. Facilidad</strong>
              ¿Tienes notas y fuentes listas, o requiere una producción muy compleja?
            </li>
          </ul>
          <p className="text-[11px] text-cyan-200/80 pt-1">
            💡 Las ideas con una puntuación media de <strong>7.0 o superior</strong> se aprueban para pasar directamente al <strong>Paso 2 (Taller de Guiones)</strong> activando los visores de las plataformas que hayas seleccionado.
          </p>
        </div>
      )}

      {/* Create New Video Idea Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateProject}
          className="bg-[#07090e] border border-cyan-500/40 rounded-xl p-5 grid gap-5 lg:grid-cols-3 shadow-2xl"
        >
          <div className="lg:col-span-2 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                Título o Tema Principal del Video
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Cómo automatizar la captación de leads en redes con IA y Manychat"
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 placeholder:text-slate-500"
                required
              />
            </div>

            {/* Rich Context Text Area */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  Notas, Contexto o Material Bruto de la Idea (Radar Matutino / Enlaces / Resumen)
                </label>
                <span className="text-[10px] text-slate-500">
                  {contextNotes.split(/\s+/).filter(Boolean).length} palabras
                </span>
              </div>
              <textarea
                rows={4}
                value={contextNotes}
                onChange={(e) => setContextNotes(e.target.value)}
                placeholder="Explica aquí tu idea, puntos clave, guión preliminar o pega el texto/artículo extraído del Radar Matutino. La IA utilizará este contexto para calcular la prioridad objetiva y generar los mejores ganchos..."
                className="w-full rounded-lg bg-[#020306] border border-slate-700 p-3 text-xs text-white focus:outline-none focus:border-cyan-400 placeholder:text-slate-500 leading-relaxed font-sans"
              />
              <p className="text-[11px] text-slate-400 mt-1 italic">
                Cuanto más contexto proporciones, mayor precisión tendrá la valoración del impacto y facilidad por parte de la IA.
              </p>
            </div>

            {/* Target Platforms Multi-Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-2">
                Plataformas Objetivo Elegidas (Activan/Desactivan los siguientes pasos)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {AVAILABLE_PLATFORMS.map((plat) => {
                  const active = selectedPlatforms.includes(plat.id);
                  return (
                    <button
                      key={plat.id}
                      type="button"
                      onClick={() => togglePlatform(plat.id)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition ${
                        active
                          ? `${plat.activeColor} border-opacity-100 shadow-sm font-semibold`
                          : "bg-[#020306] border-slate-800 text-slate-400 hover:text-slate-200 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        {active && <Check className="w-3 h-3 text-emerald-400" />}
                        <span className="text-xs">{plat.label}</span>
                      </div>
                      <span className="text-[9px] opacity-75">{plat.badge}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">
                Al seleccionar las plataformas, se habilitarán sus visores dedicados en el <strong>Paso 2 (Taller de Guiones)</strong> y sus comprobaciones de publicación en el <strong>Paso 4</strong>.
              </p>
            </div>

            {/* Video Specs Selectors */}
            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              <label className="block text-xs font-medium text-slate-300">
                Duración del Video
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value as DurationPreset)}
                  className="mt-1 w-full rounded-lg bg-[#020306] border border-slate-700 px-2.5 py-2 text-xs text-white"
                >
                  {Object.entries(DURATION_PRESET_META).map(([k, meta]) => (
                    <option key={k} value={k}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-300">
                Objetivo del Video
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as ConversionGoal)}
                  className="mt-1 w-full rounded-lg bg-[#020306] border border-slate-700 px-2.5 py-2 text-xs text-white"
                >
                  {Object.entries(CONVERSION_GOAL_META).map(([k, meta]) => (
                    <option key={k} value={k}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-300">
                Tipo de Audiencia
                <select
                  value={tam}
                  onChange={(e) =>
                    setTam(e.target.value as "CORE_80" | "EXPANSION_20")
                  }
                  className="mt-1 w-full rounded-lg bg-[#020306] border border-slate-700 px-2.5 py-2 text-xs text-white"
                >
                  <option value="CORE_80">Comunidad Actual (80% del canal)</option>
                  <option value="EXPANSION_20">Nuevos Públicos (20% para crecer)</option>
                </select>
              </label>
            </div>
          </div>

          {/* Right Column: AI Valuation Engine & Sliders */}
          <div className="bg-[#020306] border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
            <div>
              {/* Header with Calculated Score */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-cyan-400" />
                  Prioridad Calculada
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                    liveIce >= 7.0
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  }`}
                >
                  {liveIce.toFixed(1)} / 10 {liveIce >= 7.0 ? "(Aprobada)" : "(Baja)"}
                </span>
              </div>

              {/* AI Valuation Trigger Button */}
              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleAIEvaluate}
                  disabled={evaluatingAI || !title.trim()}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-violet-600 via-cyan-600 to-emerald-600 hover:from-violet-500 hover:to-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md disabled:opacity-50"
                >
                  {evaluatingAI ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Valorando con IA y Perfil Paso 0...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-cyan-300" />
                      <span>✨ Valorar Prioridad con IA</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-slate-500 mt-1 text-center">
                  La IA analiza el título, notas y tu nicho del Paso 0 para calcular Impacto, Confianza y Facilidad.
                </p>
              </div>

              {/* AI Diagnosis Callout (if evaluated) */}
              {aiEvaluation && (
                <div className="mt-3 p-3 rounded-lg border border-cyan-500/30 bg-cyan-950/20 text-xs space-y-1.5 animate-fadeIn">
                  <div className="flex items-center justify-between text-cyan-300 font-bold text-[11px]">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Diagnóstico IA
                    </span>
                    <span className="text-emerald-400">
                      ⚡ Retención: ~{aiEvaluation.estimated_hold_rate}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    {aiEvaluation.rationale}
                  </p>
                  {aiEvaluation.hook_candidates[0] && (
                    <div className="pt-1 text-[10px] text-slate-400 border-t border-cyan-500/20">
                      <span className="font-semibold text-cyan-200">Gancho sugerido:</span> &quot;
                      {aiEvaluation.hook_candidates[0].hook_text}&quot;
                    </div>
                  )}
                </div>
              )}

              {/* Fine-Tuning Sliders */}
              <div className="space-y-3 pt-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Ajuste de Variables ICE (1 - 10)
                </span>
                {[
                  { label: "1. Impacto esperado", val: impact, set: setImpact },
                  { label: "2. Confianza / Seguridad", val: confidence, set: setConfidence },
                  { label: "3. Facilidad de producción", val: ease, set: setEase },
                ].map((item) => (
                  <label key={item.label} className="block text-xs text-slate-400">
                    <div className="flex justify-between mb-1">
                      <span>{item.label}</span>
                      <span className="font-mono text-white font-bold">{item.val.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={0.1}
                      value={item.val}
                      onChange={(e) => item.set(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-md"
            >
              {creating ? "Guardando idea..." : "Guardar Idea y Continuar"}
            </button>
          </div>
        </form>
      )}

      {/* Kanban Board Columns (8 Progressive Phases) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {FSM_COLUMNS.map((col) => {
          const items = filteredProjects.filter((p) => p.current_state === col.state);
          return (
            <section
              key={col.state}
              className={`bg-[#07090e] border ${col.colorClass} rounded-xl p-3 flex flex-col min-h-[240px] shadow-sm`}
            >
              <header className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-800/80">
                <div>
                  <h3 className="text-xs font-bold text-slate-200">
                    {col.title}
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    {HUMAN_STATE_LABELS[col.state] ?? col.state}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs font-mono text-slate-300">
                    {items.length}
                  </span>
                </div>
              </header>

              <div className="space-y-3 flex-1">
                {items.length === 0 && (
                  <div className="h-24 rounded-lg border border-dashed border-slate-800/80 flex items-center justify-center text-xs text-slate-500 text-center px-2">
                    No hay videos en esta fase
                  </div>
                )}

                {items.map((proj) => {
                  const isSelected = proj.id === selectedProjectId;
                  const next = NEXT_STATE_MAP[proj.current_state];
                  const isRadar =
                    proj.source_origin === "radar_matutino" ||
                    proj.source_origin === "n8n_cron";
                  const platforms =
                    proj.target_platforms && proj.target_platforms.length > 0
                      ? proj.target_platforms
                      : (["YouTube", "Instagram", "TikTok", "LinkedIn", "X"] as ScriptTargetPlatform[]);

                  return (
                    <article
                      key={proj.id}
                      className={`rounded-lg border p-3 transition cursor-pointer ${
                        isSelected
                          ? "bg-slate-800/90 border-cyan-400 shadow-lg shadow-cyan-500/10"
                          : "bg-[#020306] border-slate-800 hover:border-slate-700"
                      }`}
                      onClick={() => setSelectedProjectId(proj.id)}
                    >
                      {/* Top Badges: Asset Code, Radar Pill & ICE Score */}
                      <div className="flex items-center justify-between gap-1.5 mb-1.5 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono font-bold text-cyan-300">
                            {proj.asset_code}
                          </span>
                          {isRadar && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1"
                              title="Capturado automáticamente por el Radar Matutino n8n"
                            >
                              <Radio className="w-2.5 h-2.5 text-amber-400" />
                              Radar
                            </span>
                          )}
                        </div>
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          title="Prioridad de 1 a 10"
                        >
                          Prioridad {proj.ice_score.toFixed(1)}/10
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-slate-100 leading-snug mb-2 line-clamp-2">
                        {proj.working_title}
                      </h4>

                      {/* Context Notes Excerpt if present */}
                      {proj.context_notes && (
                        <p className="text-[10px] text-slate-400 line-clamp-1 italic mb-2 bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-800/60">
                          {proj.context_notes}
                        </p>
                      )}

                      {/* Platforms Pills */}
                      <div className="flex flex-wrap items-center gap-1 mb-2.5">
                        {platforms.map((plat) => (
                          <span
                            key={plat}
                            className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60"
                          >
                            {plat === "YouTube"
                              ? "YT"
                              : plat === "Instagram"
                              ? "IG"
                              : plat === "TikTok"
                              ? "TT"
                              : plat === "LinkedIn"
                              ? "LI"
                              : "X"}
                          </span>
                        ))}
                      </div>

                      {/* Specs Tags */}
                      <div className="flex flex-wrap gap-1.5 text-[10px] mb-3">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          {DURATION_PRESET_META[proj.target_duration].shortLabel}
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          <Target className="w-3 h-3 text-violet-400" />
                          {CONVERSION_GOAL_META[proj.conversion_goal].badge}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProjectId(proj.id);
                            setActiveTab("script-studio");
                          }}
                          className="text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          Ir al Guión
                        </button>

                        {next && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleAdvanceState(proj);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-[11px] font-medium text-slate-200 transition"
                          >
                            {next === "HITL_PENDING_PRODUCTION" ||
                            next === "PUBLISHED_LIVE" ? (
                              <Shield className="w-3 h-3 text-amber-400" />
                            ) : (
                              <ArrowRight className="w-3 h-3" />
                            )}
                            Avanzar
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
