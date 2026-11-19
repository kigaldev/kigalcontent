"use client";

import React, { useId } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  Gauge,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Tv,
  Wand2,
} from "lucide-react";
import type { DurationPreset, HookCandidate, TwoColumnScriptBlock } from "@/types/engine";

interface MasterScriptVisorProps {
  blocks: TwoColumnScriptBlock[];
  hookVariants: HookCandidate[];
  selectedHookIndex: number;
  preset: DurationPreset;
  wpm: number;
  wordCount: number;
  oralTimingSeconds: number;
  spec: {
    label: string;
    shortLabel: string;
    durationRange: [number, number];
    wordRange: [number, number];
  };
  timingDelta: number;
  isOverLimit: boolean;
  isUnderLimit: boolean;
  qualityAudit: {
    slopClean: boolean;
    slopMatches: string[];
    evidenceOk: boolean;
    evidenceCount: number;
  };
  antiSlopEnabled: boolean;
  onSelectHook: (index: number) => void;
  onUpdateBlock: (index: number, field: keyof TwoColumnScriptBlock, value: string | number) => void;
  onAddBlock: () => void;
  onRemoveBlock: (index: number) => void;
  onOpenTeleprompter: () => void;
  onOpenExporter: () => void;
  onCleanSlop: () => void;
  onCopy: (key: string, text: string, label: string) => Promise<void>;
  copiedKey: string | null;
}

export function MasterScriptVisor({
  blocks,
  hookVariants,
  selectedHookIndex,
  preset,
  wpm,
  wordCount,
  oralTimingSeconds,
  spec,
  timingDelta,
  isOverLimit,
  isUnderLimit,
  qualityAudit,
  antiSlopEnabled,
  onSelectHook,
  onUpdateBlock,
  onAddBlock,
  onRemoveBlock,
  onOpenTeleprompter,
  onOpenExporter,
  onCleanSlop,
  onCopy,
  copiedKey,
}: MasterScriptVisorProps) {
  const tableCaptionId = useId();
  const targetSeconds = Math.round((spec.durationRange[0] + spec.durationRange[1]) / 2);

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-bold">
              <FileText className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Guión Maestro Audiovisual (Base de Producción 2 Columnas)
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] font-semibold">
              Audio Oral + Video Pantalla + Interrupciones
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Fuente de verdad del proyecto. De aquí se adaptan y derivan automáticamente todos los visores de redes sociales.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenTeleprompter}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-slate-950 text-xs font-bold transition shadow-sm"
          >
            <Tv className="w-3.5 h-3.5" />
            Modo Teleprompter
          </button>
          <button
            type="button"
            onClick={onOpenExporter}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:border-cyan-400 text-xs font-semibold text-slate-200 transition"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Exportar (PDF / Notion / SRT)
          </button>
        </div>
      </div>

      {/* Oral Timing Bar & Quality Status */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl border border-slate-800 bg-[#07090e] space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span>Duración Oral Estimada</span>
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <p className="text-lg font-mono font-bold text-white">
            {oralTimingSeconds} seg{" "}
            <span className="text-xs font-normal text-slate-400">
              (Obj: {targetSeconds}s)
            </span>
          </p>
          <p className="text-[10px] font-mono text-slate-400">
            {wordCount} palabras a {wpm} WPM
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-800 bg-[#07090e] space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span>Ajuste de Tiempo</span>
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p
            className={`text-lg font-mono font-bold ${
              isOverLimit ? "text-rose-400" : isUnderLimit ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {timingDelta > 0 ? `+${timingDelta.toFixed(1)}s` : `${timingDelta.toFixed(1)}s`}
          </p>
          <p className="text-[10px] text-slate-400">
            {isOverLimit
              ? "Excede tiempo: recorta locución"
              : isUnderLimit
              ? "Corto: añade un ejemplo"
              : "Calce perfecto en duración"}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-800 bg-[#07090e] space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span>Filtro Anti-Slop</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p
            className={`text-lg font-mono font-bold ${
              qualityAudit.slopClean ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {qualityAudit.slopClean ? "Limpio (PASS)" : `${qualityAudit.slopMatches.length} Detectadas`}
          </p>
          <p className="text-[10px] text-slate-400">
            {qualityAudit.slopClean ? "Cero clichés genéricos" : "Muletillas IA encontradas"}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-800 bg-[#07090e] space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span>Datos Verificables</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <p
            className={`text-lg font-mono font-bold ${
              qualityAudit.evidenceOk ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {qualityAudit.evidenceCount} Cifras / Datos
          </p>
          <p className="text-[10px] text-slate-400">
            {qualityAudit.evidenceOk ? "Sustento numérico OK" : "Agrega números o métricas"}
          </p>
        </div>
      </div>

      {/* HookLab: 3 Alternative Opening Hooks */}
      <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              HookLab: Selector de Ganchos de Apertura (0–3 Segundos)
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Elige el ángulo que abrirá todos los videos y publicaciones de este proyecto.
            </p>
          </div>
          <span className="text-[10px] font-mono text-violet-300 bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 rounded">
            Hold Rate Proyectado: &gt;70%
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {hookVariants.map((hook, idx) => {
            const isSelected = selectedHookIndex === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectHook(idx)}
                className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between gap-3 ${
                  isSelected
                    ? "border-violet-500 bg-violet-950/25 shadow-sm shadow-violet-500/20"
                    : "border-slate-800 bg-[#020306] hover:border-slate-700 text-slate-300"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-violet-300 font-mono">
                      {hook.category}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">
                      ~{hook.estimated_hold_rate}% Hold
                    </span>
                  </div>
                  <p className="text-xs text-white leading-relaxed font-medium">
                    &ldquo;{hook.hook_text}&rdquo;
                  </p>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-2 flex items-center justify-between">
                  <span className="truncate">Visual: {hook.pattern_interrupt}</span>
                  {isSelected && <span className="text-violet-400 font-bold">Activo ✓</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-Column AV Script Table */}
      <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Bloques del Guión Audiovisual (2 Columnas)
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Columna izquierda: lo que dices (locución). Columna derecha: lo que se ve en pantalla.
            </p>
          </div>

          <div className="flex items-center gap-2">
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
            <button
              type="button"
              onClick={onAddBlock}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir Bloque
            </button>
          </div>
        </div>

        {/* Script Table */}
        <div className="space-y-3">
          {blocks.map((block, idx) => (
            <div
              key={block.block_id || idx}
              className="rounded-xl border border-slate-800 bg-[#020306] p-4 space-y-3 hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={block.section_label}
                    onChange={(e) => onUpdateBlock(idx, "section_label", e.target.value)}
                    placeholder="Etiqueta (ej: Gancho, Problema, Solución)"
                    className="rounded bg-transparent border-0 font-semibold text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 px-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400">
                    ~{Math.round((block.audio_voiceover.split(/\s+/).length / wpm) * 60)}s
                  </span>
                  {blocks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemoveBlock(idx)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition"
                      title="Eliminar bloque"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-12 gap-3 text-xs">
                {/* Audio / Voiceover (7 cols) */}
                <div className="md:col-span-7 space-y-1">
                  <label className="font-semibold text-slate-300 block">
                    🎙️ Audio / Locución Oral
                  </label>
                  <textarea
                    rows={3}
                    value={block.audio_voiceover}
                    onChange={(e) => onUpdateBlock(idx, "audio_voiceover", e.target.value)}
                    placeholder="Lo que dirás frente a la cámara o micrófono..."
                    className="w-full rounded-lg bg-[#07090e] border border-slate-800 px-3 py-2 text-xs text-slate-100 leading-relaxed font-sans focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Video / On-screen & Pattern Interrupt (5 cols) */}
                <div className="md:col-span-5 space-y-2">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">
                      📺 En Pantalla (Texto Seguro)
                    </label>
                    <input
                      type="text"
                      value={block.on_screen_text}
                      onChange={(e) => onUpdateBlock(idx, "on_screen_text", e.target.value)}
                      placeholder="Texto superpuesto en el video..."
                      className="w-full rounded-lg bg-[#07090e] border border-slate-800 px-3 py-1.5 text-xs text-cyan-200 font-mono focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 block">
                      ⚡ Dirección Visual / Edición
                    </label>
                    <input
                      type="text"
                      value={block.visual_direction}
                      onChange={(e) => onUpdateBlock(idx, "visual_direction", e.target.value)}
                      placeholder="Ej: Zoom punch 115%, corte seco, sonido pop..."
                      className="w-full rounded-lg bg-[#07090e] border border-slate-800 px-3 py-1.5 text-[11px] text-slate-400 font-mono focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
