"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Calculator,
  Clock,
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
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<DurationPreset>("STANDARD_SHORT");
  const [goal, setGoal] = useState<ConversionGoal>("EMAIL_LEAD_CAPTURE");
  const [tam, setTam] = useState<"CORE_80" | "EXPANSION_20">("CORE_80");
  const [impact, setImpact] = useState(8.5);
  const [confidence, setConfidence] = useState(8.0);
  const [ease, setEase] = useState(7.8);
  const [creating, setCreating] = useState(false);

  const liveIce = useMemo(
    () => Math.round(((impact + confidence + ease) / 3) * 100) / 100,
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
          `Proyecto ${created.asset_code} creado (ICE ${created.ice_score} -> ${created.current_state}).`
        );
      } else {
        const mock: ContentProject = {
          id: crypto.randomUUID(),
          asset_code: `ACE-${Math.floor(200 + Math.random() * 700)}`,
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
        showToast("info", `Proyecto offline ${mock.asset_code} añadido con ICE ${liveIce}.`);
      }
      setTitle("");
      setShowCreateForm(false);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error creando proyecto");
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
          "Puerta HITL Tier 2: Estás aprobando el guión audiovisual a dos columnas y el empaque A/B para habilitar la subida de crudos e iniciar producción.",
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
          "Puerta HITL Tier 3 (Crítico / Irreversible): Estás autorizando el despliegue público en redes sociales con firma HMAC y doble factor.",
      });
      return;
    }

    try {
      if (backendOnline) {
        await apiClient.transitionProject(proj.id, {
          target_state: nextState,
          agent_or_user: "OrchestratorAgent",
        });
        await onRefresh();
        showToast("success", `${proj.asset_code} transicionó a ${nextState}`);
      } else {
        setProjects(
          projects.map((p) =>
            p.id === proj.id ? { ...p, current_state: nextState } : p
          )
        );
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error en transición FSM");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls & ICE Intake */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            Pipeline FSM &amp; Triaje Cuantitativo ICE
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cada activo recorre la Máquina de Estados Finita duradera (Temporal.io) con bloqueo preventivo Tier 2 y Tier 3.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          {showCreateForm ? "Cerrar Captura" : "Nueva Idea + Triaje ICE"}
        </button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreateProject}
          className="bg-slate-900/90 border border-cyan-500/40 rounded-xl p-5 grid gap-5 lg:grid-cols-3"
        >
          <div className="lg:col-span-2 space-y-4">
            <label className="block text-xs font-medium text-slate-300">
              Título / Tesis de Contenido
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Cómo auditar retención segundo a segundo con Temporal + FFmpeg"
                className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                required
              />
            </label>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="block text-xs font-medium text-slate-300">
                Selector de Duración
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
                Meta Comercial (CTA)
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
                Clasificación TAM (80/20)
                <select
                  value={tam}
                  onChange={(e) =>
                    setTam(e.target.value as "CORE_80" | "EXPANSION_20")
                  }
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-white"
                >
                  <option value="CORE_80">CORE 80% (Núcleo fiel)</option>
                  <option value="EXPANSION_20">EXPANSION 20% (Nuevo mercado)</option>
                </select>
              </label>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-cyan-400" />
                Calculadora ICE
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                  liveIce >= 7.0
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                }`}
              >
                ICE {liveIce.toFixed(2)} {liveIce >= 7.0 ? "≥ 7.0 OK" : "< 7.0 ARCHIVE"}
              </span>
            </div>

            {[
              { label: "Impacto (I)", val: impact, set: setImpact },
              { label: "Confianza Empírica (C)", val: confidence, set: setConfidence },
              { label: "Facilidad Rodaje (E)", val: ease, set: setEase },
            ].map((item) => (
              <label key={item.label} className="block text-xs text-slate-400">
                <div className="flex justify-between mb-1">
                  <span>{item.label}</span>
                  <span className="font-mono text-white">{item.val.toFixed(1)}</span>
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
              className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition"
            >
              {creating ? "Evaluando & Guionizando..." : "Ejecutar Triaje + Guión AV"}
            </button>
          </div>
        </form>
      )}

      {/* Horizontal Scrollable FSM Kanban Columns */}
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
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    {col.title}
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    {col.state}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {col.tier > 1 && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        col.tier === 3
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      }`}
                    >
                      T{col.tier} HITL
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs font-mono text-slate-300">
                    {items.length}
                  </span>
                </div>
              </header>

              <div className="space-y-3 flex-1">
                {items.length === 0 && (
                  <div className="h-24 rounded-lg border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-600">
                    Sin activos en esta fase
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
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                          ICE {proj.ice_score.toFixed(1)}
                        </span>
                      </div>

                      <h4 className="text-sm font-medium text-slate-100 leading-snug mb-2">
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
                          className="text-[11px] text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          Abrir Estudio
                        </button>

                        {next && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleAdvanceState(proj);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-[11px] font-medium text-slate-200 transition"
                          >
                            {col.tier > 1 ||
                            next === "HITL_PENDING_PRODUCTION" ||
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
