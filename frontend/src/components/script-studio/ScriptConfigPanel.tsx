"use client";

import React from "react";
import {
  Clock,
  Gauge,
  KeyRound,
  Layers,
  Send,
  ShieldCheck,
  Sliders,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  CONVERSION_GOAL_META,
  DURATION_PRESET_META,
} from "@/lib/utils";
import type {
  ConversionGoal,
  DurationPreset,
  ScriptTargetPlatform,
} from "@/types/engine";

interface ScriptConfigPanelProps {
  targetPlatforms: ScriptTargetPlatform[];
  preset: DurationPreset;
  goal: ConversionGoal;
  wpm: number;
  leadMagnetKeyword: string;
  manychatTriggers: Array<{ keyword: string; lead_magnet_id?: string | null }>;
  antiSlopEnabled: boolean;
  contrarianHookEnabled: boolean;
  requireVerifiableData: boolean;
  qualityAudit: {
    slopClean: boolean;
    slopMatches: string[];
    evidenceOk: boolean;
    evidenceCount: number;
  };
  onTogglePlatform: (plat: ScriptTargetPlatform) => void;
  onSetPreset: (preset: DurationPreset) => void;
  onSetGoal: (goal: ConversionGoal) => void;
  onSetWpm: (wpm: number) => void;
  onSetLeadMagnetKeyword: (kw: string) => void;
  onSetAntiSlop: (val: boolean) => void;
  onSetContrarianHook: (val: boolean) => void;
  onSetRequireVerifiableData: (val: boolean) => void;
  onCleanSlop: () => void;
}

const PLATFORM_OPTIONS: Array<{
  id: ScriptTargetPlatform;
  label: string;
  hint: string;
  accent: string;
}> = [
  {
    id: "YouTube",
    label: "YouTube",
    hint: "Shorts & Long · Capítulos SEO",
    accent: "border-rose-500/60 bg-rose-500/15 text-rose-200",
  },
  {
    id: "Instagram",
    label: "Instagram",
    hint: "Reels 9:16 · Disparador DM · Grid 1:1",
    accent: "border-pink-500/60 bg-pink-500/15 text-pink-200",
  },
  {
    id: "TikTok",
    label: "TikTok",
    hint: "Search SEO · Bucle Infinito",
    accent: "border-cyan-500/60 bg-cyan-500/15 text-cyan-200",
  },
  {
    id: "LinkedIn",
    label: "LinkedIn",
    hint: "Zero-Link (-60% penalty) · Carrusel",
    accent: "border-sky-500/60 bg-sky-500/15 text-sky-200",
  },
  {
    id: "X",
    label: "X",
    hint: "≤280c Tweet & Hilo 4–5",
    accent: "border-amber-500/60 bg-amber-500/15 text-amber-200",
  },
];

export function ScriptConfigPanel({
  targetPlatforms,
  preset,
  goal,
  wpm,
  leadMagnetKeyword,
  manychatTriggers,
  antiSlopEnabled,
  contrarianHookEnabled,
  requireVerifiableData,
  qualityAudit,
  onTogglePlatform,
  onSetPreset,
  onSetGoal,
  onSetWpm,
  onSetLeadMagnetKeyword,
  onSetAntiSlop,
  onSetContrarianHook,
  onSetRequireVerifiableData,
  onCleanSlop,
}: ScriptConfigPanelProps) {
  return (
    <div className="space-y-5">
      {/* Platform Multi-Selector */}
      <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              1. Selección de Redes Sociales Objetivo
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Al marcar cada plataforma, se habilitará automáticamente su pestaña y visor especializado arriba.
            </p>
          </div>
          <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-2.5 py-1">
            {targetPlatforms.length} de {PLATFORM_OPTIONS.length} activadas
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {PLATFORM_OPTIONS.map((plat) => {
            const active = targetPlatforms.includes(plat.id);
            return (
              <button
                key={plat.id}
                type="button"
                aria-pressed={active}
                onClick={() => onTogglePlatform(plat.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  active
                    ? `${plat.accent} shadow-sm`
                    : "border-slate-800 bg-[#020306] text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{plat.label}</span>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      active ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-slate-700"
                    }`}
                  />
                </div>
                <p className="text-[10px] opacity-80 mt-1 font-mono truncate">
                  {plat.hint}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration & Conversion Goal */}
      <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            2. Duración del Video &amp; Objetivo de Conversión
          </h3>
        </div>

        <div className="grid gap-5 lg:grid-cols-12">
          {/* Duration Preset (6 cols) */}
          <div className="lg:col-span-6 space-y-2">
            <span className="block text-xs font-bold text-slate-200">
              Formato de Duración
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(DURATION_PRESET_META) as DurationPreset[]).map((key) => {
                const active = preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSetPreset(key)}
                    className={`rounded-lg border p-2.5 text-left text-xs transition ${
                      active
                        ? "border-cyan-400 bg-cyan-950/30 text-white font-bold"
                        : "border-slate-800 bg-[#020306] text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-semibold">{DURATION_PRESET_META[key].label}</div>
                    <div className="text-[10px] opacity-75 font-mono">
                      ~{DURATION_PRESET_META[key].wordRange[0]}–{DURATION_PRESET_META[key].wordRange[1]} palabras
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Goal & Keyword (6 cols) */}
          <div className="lg:col-span-6 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-200 block">
                Objetivo de Conversión
              </label>
              <select
                value={goal}
                onChange={(e) => onSetGoal(e.target.value as ConversionGoal)}
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                {(Object.keys(CONVERSION_GOAL_META) as ConversionGoal[]).map((g) => (
                  <option key={g} value={g} className="bg-[#0b0e16] text-slate-100">
                    {CONVERSION_GOAL_META[g].label} ({CONVERSION_GOAL_META[g].badge})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                <span>Palabra Clave Disparadora (ManyChat / KigalChat)</span>
                {manychatTriggers.length > 0 && (
                  <span className="text-[10px] font-mono text-emerald-400">
                    {manychatTriggers.length} disparador(es) en Paso 0
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={leadMagnetKeyword}
                  onChange={(e) => onSetLeadMagnetKeyword(e.target.value.toUpperCase())}
                  placeholder="Ej: BLUEPRINT, SISTEMA, REGALO..."
                  className="w-full rounded-lg bg-[#020306] border border-slate-700 pl-3 pr-20 py-2 text-xs font-mono font-bold uppercase text-emerald-300 focus:outline-none focus:border-emerald-400"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500">
                  DM TRIGGER
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* WPM Slider */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              Velocidad de Habla (Words Per Minute):
            </span>
            <span className="font-mono text-cyan-300 font-bold">{wpm} WPM</span>
          </div>
          <input
            type="range"
            min={110}
            max={180}
            step={5}
            value={wpm}
            onChange={(e) => onSetWpm(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
            <span>110 WPM (Pausado)</span>
            <span>140 WPM (Estándar Pro)</span>
            <span>180 WPM (Ultra Rápido)</span>
          </div>
        </div>
      </div>

      {/* Quality Controls */}
      <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              3. Controles de Calidad Editorial (Anti-Slop &amp; HookLab)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Reglas de redacción aplicadas a todos los guiones y publicaciones.
            </p>
          </div>
          {!qualityAudit.slopClean && antiSlopEnabled && (
            <button
              type="button"
              onClick={onCleanSlop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50 hover:bg-amber-500/30 text-xs font-bold text-amber-200 transition"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Limpiar {qualityAudit.slopMatches.length} Cliché(s)
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <label className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-[#020306] p-3.5 cursor-pointer hover:border-slate-700 transition">
            <div className="space-y-1">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Filtro Anti-Slop IA</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    antiSlopEnabled
                      ? qualityAudit.slopClean
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {antiSlopEnabled ? (qualityAudit.slopClean ? "PASS" : "ALERTA") : "OFF"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Elimina frases vacías como &ldquo;en el mundo actual&rdquo; o &ldquo;lleva tu negocio al siguiente nivel&rdquo;.
              </p>
            </div>
            <input
              type="checkbox"
              checked={antiSlopEnabled}
              onChange={(e) => onSetAntiSlop(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400 cursor-pointer rounded"
            />
          </label>

          <label className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-[#020306] p-3.5 cursor-pointer hover:border-slate-700 transition">
            <div className="space-y-1">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Gancho Contraintuitivo</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">
                  {contrarianHookEnabled ? "ON" : "OFF"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Prioriza rupturas de patrón en 0–3s y tesis contraria al consenso del nicho.
              </p>
            </div>
            <input
              type="checkbox"
              checked={contrarianHookEnabled}
              onChange={(e) => onSetContrarianHook(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400 cursor-pointer rounded"
            />
          </label>

          <label className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-[#020306] p-3.5 cursor-pointer hover:border-slate-700 transition">
            <div className="space-y-1">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Datos Verificables</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                  {requireVerifiableData ? `${qualityAudit.evidenceCount} CIFRAS` : "OFF"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Exige métricas, porcentajes o benchmarks dentro de las afirmaciones del guión.
              </p>
            </div>
            <input
              type="checkbox"
              checked={requireVerifiableData}
              onChange={(e) => onSetRequireVerifiableData(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400 cursor-pointer rounded"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
