"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Calculator,
  Clock,
  HelpCircle,
  Layers,
  PlusCircle,
  Shield,
  Sparkles,
  Target,
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
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<DurationPreset>("STANDARD_SHORT");
  const [goal, setGoal] = useState<ConversionGoal>("EMAIL_LEAD_CAPTURE");
  const [tam, setTam] = useState<"CORE_80" | "EXPANSION_20">("CORE_80");
  const [impact, setImpact] = useState(8.5);
  const [confidence, setConfidence] = useState(8.0);
  const [ease, setEase] = useState(7.8);
  const [creating, setCreating] = useState(false);

  const liveIce = useMemo(
    () => Math.round(((impact + confidence + ease) / 3) * 10) / 10,
    [impact, confidence, ease]
  );

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
      {/* Step Header & Callout */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 rounded-xl p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950">
              1
            </span>
            <h2 className="text-lg font-bold text-white">
              Paso 1: Tablero de Ideas y Prioridades
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Organiza tus ideas de video en columnas según su fase de producción y evalúa cuáles tienen mayor potencial antes de grabarlas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-300 hover:text-white text-xs font-medium transition"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>{showGuide ? "Ocultar Explicación" : "¿Cómo funciona?"}</span>
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
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-xs text-slate-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-cyan-300 text-sm">
            <Sparkles className="w-4 h-4" />
            ¿Cómo saber qué idea grabar primero? (Prioridad de 1 a 10)
          </div>
          <p className="leading-relaxed">
            Para evitar perder horas grabando videos que nadie verá, cada idea se califica según tres factores sencillos:
          </p>
          <ul className="grid sm:grid-cols-3 gap-3 pt-1">
            <li className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
              <strong className="text-white block mb-0.5">1. Impacto</strong>
              ¿Cuánto valor aporta a tu audiencia y cuántas visitas potenciales puede generar?
            </li>
            <li className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
              <strong className="text-white block mb-0.5">2. Confianza</strong>
              ¿Qué tan seguro estás de que el tema le interesa a tu público objetivo?
            </li>
            <li className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
              <strong className="text-white block mb-0.5">3. Facilidad</strong>
              ¿Es rápido y sencillo de grabar y editar, o requiere mucho tiempo y equipo?
            </li>
          </ul>
          <p className="text-[11px] text-cyan-200/80 pt-1">
            💡 Las ideas con una puntuación media de <strong>7.0 o superior</strong> se aprueban para pasar directamente al <strong>Paso 2 (Taller de Guiones)</strong>.
          </p>
        </div>
      )}

      {/* Create New Video Idea Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateProject}
          className="bg-slate-900/90 border border-cyan-500/40 rounded-xl p-5 grid gap-5 lg:grid-cols-3 shadow-xl"
        >
          <div className="lg:col-span-2 space-y-4">
            <label className="block text-xs font-semibold text-slate-200">
              Título o Tema del Video
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. 3 Errores comunes que arruinan la retención de tus videos cortos"
                className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 placeholder:text-slate-500"
                required
              />
            </label>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="block text-xs font-medium text-slate-300">
                Duración del Video
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value as DurationPreset)}
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-white"
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
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-white"
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
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-white"
                >
                  <option value="CORE_80">Comunidad Actual (80% del canal)</option>
                  <option value="EXPANSION_20">Nuevos Públicos (20% para crecer)</option>
                </select>
              </label>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              {DURATION_PRESET_META[duration].description}
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-cyan-400" />
                Prioridad Calculada
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${
                  liveIce >= 7.0
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                }`}
              >
                {liveIce.toFixed(1)} / 10 {liveIce >= 7.0 ? "(Aprobada)" : "(Poco recomendada)"}
              </span>
            </div>

            {[
              { label: "Impacto esperado", val: impact, set: setImpact },
              { label: "Seguridad de que gustará", val: confidence, set: setConfidence },
              { label: "Facilidad para grabarlo", val: ease, set: setEase },
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
                  step={0.5}
                  value={item.val}
                  onChange={(e) => item.set(parseFloat(e.target.value))}
                  className="w-full"
                />
              </label>
            ))}

            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
            >
              {creating ? "Guardando idea..." : "Guardar Idea y Continuar"}
            </button>
          </div>
        </form>
      )}

      {/* Kanban Board Columns (8 Progressive Phases) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {FSM_COLUMNS.map((col) => {
          const items = projects.filter((p) => p.current_state === col.state);
          return (
            <section
              key={col.state}
              className={`bg-slate-900/60 border ${col.colorClass} rounded-xl p-3 flex flex-col min-h-[240px]`}
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
                  return (
                    <article
                      key={proj.id}
                      className={`rounded-lg border p-3 transition cursor-pointer ${
                        isSelected
                          ? "bg-slate-800/90 border-cyan-400 shadow-lg shadow-cyan-500/10"
                          : "bg-slate-950/80 border-slate-800 hover:border-slate-600"
                      }`}
                      onClick={() => setSelectedProjectId(proj.id)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[11px] font-mono font-bold text-cyan-300">
                          {proj.asset_code}
                        </span>
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300"
                          title="Prioridad de 1 a 10"
                        >
                          Prioridad {proj.ice_score.toFixed(1)}/10
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-slate-100 leading-snug mb-2 line-clamp-2">
                        {proj.working_title}
                      </h4>

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
