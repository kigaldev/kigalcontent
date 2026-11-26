"use client";

import React, { useState, useMemo } from "react";
import {
  Check,
  Clock,
  Copy,
  Hash,
  Layers,
  ListOrdered,
  PlaySquare,
  RefreshCw,
  Search,
  Sparkles,
  Tv,
  Video,
} from "lucide-react";
import { ThumbnailCoverStudio } from "@/components/ThumbnailCoverStudio";
import type { ABPackagingVariant, HookCandidate, TwoColumnScriptBlock } from "@/types/engine";

interface YouTubePlatformVisorProps {
  assetCode: string;
  projectTitle: string;
  abVariants: ABPackagingVariant[];
  blocks: TwoColumnScriptBlock[];
  activeHook: HookCandidate | null;
  videoTitle: string;
  videoDescription: string;
  seoKeywords: string[];
  leadMagnetKeyword: string;
  deliveryUrl: string;
  onUpdateTitle: (title: string) => void;
  onUpdateDescription: (desc: string) => void;
  onOpenTeleprompter: () => void;
  onCopy: (key: string, text: string, label: string) => Promise<void>;
  copiedKey: string | null;
  onSyncFromMaster: () => void;
}

export function YouTubePlatformVisor({
  assetCode,
  projectTitle,
  abVariants,
  blocks,
  activeHook,
  videoTitle,
  videoDescription,
  seoKeywords,
  leadMagnetKeyword,
  deliveryUrl,
  onUpdateTitle,
  onUpdateDescription,
  onOpenTeleprompter,
  onCopy,
  copiedKey,
  onSyncFromMaster,
}: YouTubePlatformVisorProps) {
  const [subFormat, setSubFormat] = useState<"shorts" | "long">("shorts");

  // Compute automatic YouTube chapter timestamps based on script blocks
  const generatedChapters = useMemo(() => {
    let elapsedSeconds = 0;
    const chapters: Array<{ time: string; label: string }> = [];

    // Always start with 00:00 Intro / Hook
    chapters.push({ time: "00:00", label: activeHook?.category ? `Gancho (${activeHook.category})` : "Introducción" });
    elapsedSeconds += 6; // Hook duration approx

    blocks.forEach((blk, idx) => {
      const mins = Math.floor(elapsedSeconds / 60);
      const secs = Math.floor(elapsedSeconds % 60);
      const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      chapters.push({
        time: timeStr,
        label: blk.section_label || `Punto Clave ${idx + 1}`,
      });
      elapsedSeconds += Math.max(10, Math.round((blk.audio_voiceover.split(/\s+/).length / 140) * 60));
    });

    return chapters;
  }, [blocks, activeHook]);

  const handleInsertChapters = () => {
    const chapterText = generatedChapters
      .map((c) => `${c.time} ${c.label}`)
      .join("\n");
    const updated = `${videoDescription.trim()}\n\n⏱️ Capítulos / Marcas de Tiempo:\n${chapterText}`;
    onUpdateDescription(updated);
  };

  const handleInsertLeadMagnetCta = () => {
    const ctaText = `🎁 Recursos Gratuitos & Plantillas:\nAccede a la plantilla oficial de este video aquí: ${deliveryUrl}\n(O comenta "${leadMagnetKeyword}" en los comentarios para enviártelo directo)`;
    const updated = `${videoDescription.trim()}\n\n${ctaText}`;
    onUpdateDescription(updated);
  };

  const formattedTagsString = useMemo(() => {
    return seoKeywords.map((k) => k.replace(/#/g, "")).join(", ");
  }, [seoKeywords]);

  return (
    <div className="space-y-5">
      {/* Header Bar with Platform KPI rules */}
      <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400 font-bold">
              <PlaySquare className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Visor Especializado: YouTube (Shorts &amp; Long-Form)
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[11px] font-semibold">
              SEO &lt;60c · Capítulos · Retención 30s
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Contenido empaquetado para el motor de recomendación y búsqueda de YouTube.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Format Toggle: Shorts vs Long */}
          <div className="inline-flex rounded-lg border border-slate-800 bg-[#020306] p-0.5">
            <button
              type="button"
              onClick={() => setSubFormat("shorts")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                subFormat === "shorts"
                  ? "bg-rose-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              Shorts (9:16)
            </button>
            <button
              type="button"
              onClick={() => setSubFormat("long")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                subFormat === "long"
                  ? "bg-rose-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <PlaySquare className="w-3.5 h-3.5" />
              Largo (16:9)
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenTeleprompter}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-slate-950 text-xs font-bold transition"
            title="Lanzar Teleprompter en pantalla completa"
          >
            <Tv className="w-3.5 h-3.5" />
            Teleprompter
          </button>

          <button
            type="button"
            onClick={onSyncFromMaster}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/80 hover:border-cyan-400 text-xs font-semibold text-slate-200 transition"
            title="Re-sincronizar desde los bloques del Guión Maestro"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            Sincronizar
          </button>
        </div>
      </div>

      {/* Main 2-Column Split: Script on Left, Meta & Packaging on Right */}
      <div className="grid lg:grid-cols-12 gap-5">
        {/* Left Column: Adapted YouTube Script (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <PlaySquare className="w-4 h-4 text-rose-400" />
                  Guión Adaptado para YouTube {subFormat === "shorts" ? "Shorts (9:16)" : "Video Largo (16:9)"}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {subFormat === "shorts"
                    ? "Gancho instantáneo en 0–2s + ritmo dinámico vertical"
                    : "Estructura por capítulos con gancho + promesa + solución + llamada a la acción"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const fullScriptText = blocks
                    .map((b) => `[${b.section_label}]\nAudio: ${b.audio_voiceover}\nPantalla: ${b.on_screen_text}`)
                    .join("\n\n");
                  void onCopy("yt-script", fullScriptText, "Guión YouTube");
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:border-rose-400 text-xs font-semibold text-slate-200 transition"
              >
                {copiedKey === "yt-script" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                Copiar
              </button>
            </div>

            {/* Hook callout */}
            {activeHook && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/15 p-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-rose-300">
                    Gancho de los Primeros 3 Segundos:
                  </span>
                  <span className="font-mono text-[10px] text-rose-400">
                    {activeHook.estimated_hold_rate
                      ? `Retención estimada: ${activeHook.estimated_hold_rate}%`
                      : "Sin estimación"}
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  &ldquo;{activeHook.hook_text}&rdquo;
                </p>
                <p className="text-[10px] font-mono text-slate-400">
                  Visual: {activeHook.pattern_interrupt}
                </p>
              </div>
            )}

            {/* Script Blocks */}
            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
              {blocks.map((block, idx) => (
                <div
                  key={block.block_id || idx}
                  className="rounded-lg border border-slate-800/80 bg-[#0b0e16] p-3 space-y-2 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-rose-300">
                      {idx + 1}. {block.section_label}
                    </span>
                    <span className="font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~{Math.round((block.audio_voiceover.split(/\s+/).length / 140) * 60)}s
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <p className="text-slate-100 leading-relaxed font-sans">
                      {block.audio_voiceover}
                    </p>
                    {block.on_screen_text && (
                      <div className="rounded bg-[#020306] border border-slate-800 px-2 py-1 text-[11px] font-mono text-cyan-300">
                        Overlay: {block.on_screen_text}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Title, Description, Tags & Cover Studio (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          {/* SEO Title & Description */}
          <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-cyan-400" />
                Metadatos y SEO para YouTube
              </h4>
              <button
                type="button"
                onClick={() =>
                  void onCopy(
                    "yt-title-desc",
                    `TÍTULO:\n${videoTitle}\n\nDESCRIPCIÓN:\n${videoDescription}\n\nTAGS:\n${formattedTagsString}`,
                    "Título y Descripción de YouTube"
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold transition"
              >
                {copiedKey === "yt-title-desc" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copiar Todo
              </button>
            </div>

            {/* Title with live character count */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="yt-title-input" className="font-semibold text-slate-200">
                  Título del Video (Recomendado &lt; 60 caracteres)
                </label>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    videoTitle.length <= 60
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}
                >
                  {videoTitle.length} / 60 chars {videoTitle.length > 60 && "(Se cortará en móviles)"}
                </span>
              </div>
              <input
                id="yt-title-input"
                type="text"
                value={videoTitle}
                onChange={(e) => onUpdateTitle(e.target.value)}
                placeholder="Escribe un título con gancho para YouTube..."
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between text-xs gap-1">
                <label htmlFor="yt-desc-input" className="font-semibold text-slate-200">
                  Descripción del Video
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleInsertChapters}
                    className="text-[11px] text-cyan-300 hover:text-cyan-200 underline font-mono flex items-center gap-1"
                    title="Añadir capítulos calculados desde el guión"
                  >
                    <ListOrdered className="w-3 h-3" />
                    + Capítulos
                  </button>
                  <button
                    type="button"
                    onClick={handleInsertLeadMagnetCta}
                    className="text-[11px] text-emerald-300 hover:text-emerald-200 underline font-mono flex items-center gap-1"
                    title="Insertar enlace del lead magnet"
                  >
                    <Sparkles className="w-3 h-3" />
                    + CTA Lead Magnet
                  </button>
                </div>
              </div>
              <textarea
                id="yt-desc-input"
                rows={7}
                value={videoDescription}
                onChange={(e) => onUpdateDescription(e.target.value)}
                placeholder="Descripción completa para YouTube con capítulos y enlaces..."
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-slate-100 leading-relaxed font-mono focus:outline-none focus:border-rose-400"
              />
            </div>

            {/* Tags / Keywords */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  Etiquetas / Tags para YouTube Studio
                </span>
                <button
                  type="button"
                  onClick={() => void onCopy("yt-tags", formattedTagsString, "Tags de YouTube")}
                  className="text-[11px] text-rose-300 hover:underline font-mono"
                >
                  {copiedKey === "yt-tags" ? "✓ Copiados" : "Copiar Tags"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-[#020306] border border-slate-800">
                {seoKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/30"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Dedicated Thumbnail Studio Embed */}
          <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                Miniaturas y Portadas A/B para YouTube ({subFormat === "shorts" ? "9:16 Shorts" : "16:9 Tradicional"})
              </h4>
              <span className="text-[10px] font-mono text-slate-400">
                CTR esperado: &gt;6.5%
              </span>
            </div>
            <ThumbnailCoverStudio
              assetCode={assetCode}
              projectTitle={projectTitle}
              abVariants={abVariants}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
