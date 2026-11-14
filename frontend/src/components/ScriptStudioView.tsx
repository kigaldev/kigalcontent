"use client";

import React, { useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Gauge,
  Plus,
  RefreshCw,
  Save,
  Sliders,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useEngineStore } from "@/store/useEngineStore";
import { apiClient } from "@/lib/api";
import {
  CONVERSION_GOAL_META,
  DURATION_PRESET_META,
  computeLocalOralTiming,
} from "@/lib/utils";
import type {
  ConversionGoal,
  DurationPreset,
  TwoColumnScriptBlock,
} from "@/types/engine";

interface ScriptStudioViewProps {
  onRefresh: () => Promise<void>;
}

export function ScriptStudioView({ onRefresh }: ScriptStudioViewProps) {
  const {
    selectedDetail,
    selectedProjectId,
    creatorProfile,
    setCreatorProfile,
    setSelectedDetail,
    backendOnline,
    showToast,
  } = useEngineStore();

  const captionId = useId();
  const [preset, setPreset] = useState<DurationPreset>("STANDARD_SHORT");
  const [goal, setGoal] = useState<ConversionGoal>("EMAIL_LEAD_CAPTURE");
  const [wpm, setWpm] = useState(140);
  const [blocks, setBlocks] = useState<TwoColumnScriptBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [nicheEdit, setNicheEdit] = useState("");
  const [icpEdit, setIcpEdit] = useState("");

  useEffect(() => {
    if (selectedDetail?.script) {
      setPreset(selectedDetail.script.duration_preset);
      setGoal(selectedDetail.script.conversion_goal);
      setWpm(selectedDetail.script.wpm_rate);
      setBlocks(selectedDetail.script.two_column_blocks);
    }
  }, [selectedDetail]);

  useEffect(() => {
    if (creatorProfile) {
      setNicheEdit(creatorProfile.niche);
      setIcpEdit(creatorProfile.ideal_customer_profile);
    }
  }, [creatorProfile]);

  const timing = useMemo(
    () => computeLocalOralTiming(blocks, wpm, preset),
    [blocks, wpm, preset]
  );

  const spec = DURATION_PRESET_META[preset];
  const progressPct = Math.min(
    100,
    Math.round((timing.wordCount / spec.wordRange[1]) * 100)
  );

  const handleUpdateBlock = (
    idx: number,
    field: keyof TwoColumnScriptBlock,
    value: string
  ) => {
    setBlocks((prev) =>
      prev.map((blk, i) => (i === idx ? { ...blk, [field]: value } : blk))
    );
  };

  const handleAddBlock = () => {
    setBlocks((prev) => [
      ...prev,
      {
        block_id: `blk-${prev.length + 1}`,
        section_label: `Bloque ${prev.length + 1}`,
        timecode: "00:45 - 00:55",
        visual_direction: "Plano medio + B-roll de refuerzo.",
        b_roll_cue: "Captura de dashboard / métrica",
        on_screen_text: "PUNTO CLAVE",
        audio_voiceover:
          "Añade aquí la locución estructurada para este segmento audiovisual.",
        sfx_cue: "Click sutil",
        music_cue: "Continuar bed (-22 dB)",
        pattern_interrupt_sec: spec.cutInterval[0],
        word_count: 10,
        estimated_seconds: 4.3,
        pacing_warning: false,
      },
    ]);
  };

  const handleRegenerateScript = async () => {
    if (!selectedProjectId) return;
    setRegenerating(true);
    try {
      if (backendOnline) {
        const updated = await apiClient.generateScript({
          project_id: selectedProjectId,
          duration_preset: preset,
          conversion_goal: goal,
          wpm_rate: wpm,
        });
        setBlocks(updated.two_column_blocks);
        await onRefresh();
        showToast(
          "success",
          `Guión regenerado para ${spec.label} y meta ${CONVERSION_GOAL_META[goal].badge}.`
        );
      } else {
        showToast("info", "Regeneración de parámetros aplicada localmente.");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error regenerando guión");
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveScript = async () => {
    if (!selectedDetail?.script) return;
    setSaving(true);
    try {
      if (backendOnline) {
        const updated = await apiClient.updateScript(selectedDetail.script.id, {
          duration_preset: preset,
          conversion_goal: goal,
          wpm_rate: wpm,
          two_column_blocks: timing.blocks,
          selected_hook_index: selectedDetail.script.selected_hook_index,
        });
        setSelectedDetail({ ...selectedDetail, script: updated });
        await onRefresh();
        showToast(
          "success",
          `Guión v${updated.script_version} guardado (${updated.word_count} palabras · ${updated.estimated_duration_sec}s a ${wpm} WPM).`
        );
      } else {
        setSelectedDetail({
          ...selectedDetail,
          script: {
            ...selectedDetail.script,
            duration_preset: preset,
            conversion_goal: goal,
            wpm_rate: wpm,
            two_column_blocks: timing.blocks,
            word_count: timing.wordCount,
            estimated_duration_sec: timing.estimatedDurationSec,
            within_budget: timing.withinBudget,
          },
        });
        showToast("info", "Cambios guardados en memoria local.");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error guardando guión");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContextEngine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorProfile) return;
    try {
      if (backendOnline) {
        const updated = await apiClient.updateCreatorProfile({
          niche: nicheEdit,
          ideal_customer_profile: icpEdit,
          active_conversion_goal: goal,
        });
        setCreatorProfile(updated);
      } else {
        setCreatorProfile({
          ...creatorProfile,
          niche: nicheEdit,
          ideal_customer_profile: icpEdit,
          active_conversion_goal: goal,
        });
      }
      showToast("success", "Context Engine (creator_profile.json) actualizado.");
      setShowContextDrawer(false);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error actualizando perfil");
    }
  };

  if (!selectedDetail?.project) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-10 text-center text-slate-400">
        Selecciona un proyecto en el Kanban para abrir el Script Studio a dos columnas.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Parametric Selector & Context Engine Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold">
                {selectedDetail.project.asset_code}
              </span>
              <h2 className="text-base font-semibold text-white">
                {selectedDetail.project.working_title}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">{spec.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowContextDrawer((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 hover:border-violet-400 text-xs font-medium text-slate-200 transition"
            >
              <UserCheck className="w-4 h-4 text-violet-400" />
              Context Engine ({creatorProfile?.name ?? "David"})
            </button>

            <button
              type="button"
              onClick={handleRegenerateScript}
              disabled={regenerating}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-medium text-cyan-200 transition"
            >
              <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />
              Adaptar Estructura
            </button>

            <button
              type="button"
              onClick={handleSaveScript}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition"
            >
              <Save className="w-4 h-4" />
              {saving ? "Guardando..." : "Guardar Guión AV"}
            </button>
          </div>
        </div>

        {/* 4 Duration Modes + Conversion Goal + 130-150 WPM Slider */}
        <div className="grid gap-4 lg:grid-cols-12 pt-3 border-t border-slate-800">
          <div className="lg:col-span-5">
            <span className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              1. Selector Paramétrico de Duración
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(Object.keys(DURATION_PRESET_META) as DurationPreset[]).map((key) => {
                const active = preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPreset(key)}
                    className={`px-2.5 py-2 rounded-lg border text-left transition ${
                      active
                        ? "bg-cyan-500/15 border-cyan-400 text-cyan-200"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <div className="text-xs font-semibold">
                      {DURATION_PRESET_META[key].shortLabel}
                    </div>
                    <div className="text-[10px] opacity-80 truncate">
                      {DURATION_PRESET_META[key].wordRange[0]}–
                      {DURATION_PRESET_META[key].wordRange[1]}w
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              2. Meta Comercial &amp; Inyección CTA
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as ConversionGoal)}
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white font-sans"
              >
                {Object.entries(CONVERSION_GOAL_META).map(([k, m]) => (
                  <option key={k} value={k}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              <div className="flex justify-between">
                <span className="inline-flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                  Ritmo Oral (130–150 WPM)
                </span>
                <span className="text-cyan-300 font-bold">{wpm} WPM</span>
              </div>
              <input
                type="range"
                min={130}
                max={150}
                step={2}
                value={wpm}
                onChange={(e) => setWpm(Number(e.target.value))}
                className="mt-2.5 w-full"
              />
            </label>
          </div>
        </div>

        {/* Live Word Budget & Oral Duration Telemetry */}
        <div className="grid sm:grid-cols-4 gap-3 bg-slate-950/70 border border-slate-800 rounded-lg p-3 items-center">
          <div>
            <span className="text-[11px] text-slate-400">Palabras Totales</span>
            <div className="text-sm font-mono font-bold text-white">
              {timing.wordCount}{" "}
              <span className="text-xs font-normal text-slate-400">
                / {spec.wordRange[0]}–{spec.wordRange[1]} obj.
              </span>
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-400">Duración Oral Estimada</span>
            <div className="text-sm font-mono font-bold text-cyan-300 inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {timing.estimatedDurationSec}s{" "}
              <span className="text-xs font-normal text-slate-400">
                (Meta {spec.durationRange[0]}–{spec.durationRange[1]}s)
              </span>
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-400">Frecuencia de Cortes</span>
            <div className="text-sm font-mono text-slate-200">
              Cada {spec.cutInterval[0]}–{spec.cutInterval[1]}s
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Presupuesto Verbal</span>
              <span
                className={
                  timing.withinBudget ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"
                }
              >
                {timing.withinBudget ? "En Rango Óptimo" : "Revisar Longitud"}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  timing.withinBudget ? "bg-emerald-400" : "bg-amber-400"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Context Engine Editor */}
      {showContextDrawer && creatorProfile && (
        <form
          onSubmit={handleSaveContextEngine}
          className="bg-slate-900/90 border border-violet-500/40 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-violet-200 flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              Context Engine del Creador (`creator_profile.json`)
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Trigger Activo:{" "}
              {creatorProfile.conversion_goals_catalog[goal]?.trigger_word ?? "BLUEPRINT"}
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-xs text-slate-300">
              Nicho Estratégico
              <input
                type="text"
                value={nicheEdit}
                onChange={(e) => setNicheEdit(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white"
              />
            </label>
            <label className="text-xs text-slate-300">
              Avatar / Ideal Customer Profile (ICP)
              <input
                type="text"
                value={icpEdit}
                onChange={(e) => setIcpEdit(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-slate-950 text-xs font-semibold"
            >
              Persistir Perfil &amp; Lead Magnets
            </button>
          </div>
        </form>
      )}

      {/* Two-Column AV Script Table (modern-web-guidance: responsive-table) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 id={captionId} className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            Guión Técnico Audiovisual a Dos Columnas (Visual vs. Sonoro)
          </h3>
          <button
            type="button"
            onClick={handleAddBlock}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir Bloque AV
          </button>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby={captionId}
          className="table-wrapper bg-slate-950/60"
        >
          <table>
            <caption className="sr-only">
              Editor de Guión Audiovisual a Dos Columnas con cálculo en tiempo real
            </caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <th className="p-3 w-44 border-b border-slate-800">Bloque &amp; Tiempo</th>
                <th className="p-3 border-b border-slate-800">
                  Columna Visual (Planos, B-Roll, Texto en Pantalla)
                </th>
                <th className="p-3 border-b border-slate-800">
                  Columna Sonora (Locución, SFX, Ritmo {wpm} WPM)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {timing.blocks.map((blk, idx) => (
                <tr
                  key={blk.block_id}
                  className={blk.pacing_warning ? "bg-amber-950/20" : "hover:bg-slate-900/40"}
                >
                  <th className="p-3 align-top border-r border-slate-800/80 text-left">
                    <input
                      type="text"
                      value={blk.section_label}
                      onChange={(e) =>
                        handleUpdateBlock(idx, "section_label", e.target.value)
                      }
                      aria-label={`Nombre del bloque ${idx + 1}`}
                      className="w-full bg-transparent text-xs font-semibold text-white focus:outline-none border-b border-transparent focus:border-cyan-400 pb-0.5"
                    />
                    <input
                      type="text"
                      value={blk.timecode}
                      onChange={(e) =>
                        handleUpdateBlock(idx, "timecode", e.target.value)
                      }
                      aria-label={`Código de tiempo del bloque ${idx + 1}`}
                      className="mt-1 w-full bg-transparent text-[11px] font-mono text-cyan-300 focus:outline-none"
                    />
                    <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">
                        {blk.word_count}w · {blk.estimated_seconds}s
                      </span>
                      {blk.pacing_warning ? (
                        <span
                          title="Excede ventana de dinamismo"
                          className="inline-flex items-center gap-0.5 text-amber-400"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Lento
                        </span>
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                    {blocks.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setBlocks((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="mt-2 text-[11px] text-slate-500 hover:text-rose-400 inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Quitar
                      </button>
                    )}
                  </th>

                  <td data-label="Columna Visual" className="p-3 align-top space-y-2">
                    <textarea
                      rows={2}
                      value={blk.visual_direction}
                      onChange={(e) =>
                        handleUpdateBlock(idx, "visual_direction", e.target.value)
                      }
                      aria-label={`Dirección visual bloque ${idx + 1}`}
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                    />
                    <div className="grid sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={blk.b_roll_cue}
                        onChange={(e) =>
                          handleUpdateBlock(idx, "b_roll_cue", e.target.value)
                        }
                        placeholder="B-Roll"
                        aria-label={`B-Roll bloque ${idx + 1}`}
                        className="rounded bg-slate-900/80 border border-slate-800 px-2 py-1 text-[11px] text-slate-300"
                      />
                      <input
                        type="text"
                        value={blk.on_screen_text}
                        onChange={(e) =>
                          handleUpdateBlock(idx, "on_screen_text", e.target.value)
                        }
                        placeholder="Texto en pantalla"
                        aria-label={`Texto en pantalla bloque ${idx + 1}`}
                        className="rounded bg-slate-900/80 border border-slate-800 px-2 py-1 text-[11px] font-mono text-amber-300"
                      />
                    </div>
                  </td>

                  <td data-label="Columna Sonora" className="p-3 align-top space-y-2">
                    <textarea
                      rows={3}
                      value={blk.audio_voiceover}
                      onChange={(e) =>
                        handleUpdateBlock(idx, "audio_voiceover", e.target.value)
                      }
                      aria-label={`Locución bloque ${idx + 1}`}
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-white leading-relaxed focus:outline-none focus:border-cyan-400"
                    />
                    <div className="grid sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={blk.sfx_cue}
                        onChange={(e) =>
                          handleUpdateBlock(idx, "sfx_cue", e.target.value)
                        }
                        placeholder="SFX"
                        aria-label={`SFX bloque ${idx + 1}`}
                        className="rounded bg-slate-900/80 border border-slate-800 px-2 py-1 text-[11px] text-cyan-200"
                      />
                      <input
                        type="text"
                        value={blk.music_cue}
                        onChange={(e) =>
                          handleUpdateBlock(idx, "music_cue", e.target.value)
                        }
                        placeholder="Música / Ritmo"
                        aria-label={`Música bloque ${idx + 1}`}
                        className="rounded bg-slate-900/80 border border-slate-800 px-2 py-1 text-[11px] text-violet-200"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Packaging-First A/B Variants (1280x720) */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            Empaque A/B Packaging-First (Miniaturas 1280×720 px + Títulos Contrastantes)
          </h3>
          <span className="text-xs font-mono text-emerald-300">
            CTA Activa: {selectedDetail.script?.cta_text}
          </span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {selectedDetail.project.ab_variants.map((variant) => (
            <div
              key={variant.variant_label}
              className="rounded-xl border border-slate-800 bg-slate-950/90 p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold">
                  Variante {variant.variant_label}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {variant.thumbnail_dimensions}
                </span>
              </div>
              <div className="aspect-video rounded-lg border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/40 p-4 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400">
                  Preview Miniatura Test &amp; Compare
                </span>
                <p className="text-base font-bold text-white leading-tight">
                  {variant.title}
                </p>
                <p className="text-[11px] text-slate-300">{variant.thumbnail_concept}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
