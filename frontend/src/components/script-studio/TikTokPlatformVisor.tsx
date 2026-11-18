"use client";

import React, { useState, useMemo } from "react";
import {
  Check,
  Clock,
  Copy,
  Hash,
  Layers,
  RefreshCw,
  Repeat,
  Search,
  Sparkles,
  Tv,
  Zap,
} from "lucide-react";
import type { ABPackagingVariant, HookCandidate, TwoColumnScriptBlock } from "@/types/engine";

interface TikTokPlatformVisorProps {
  assetCode: string;
  projectTitle: string;
  abVariants: ABPackagingVariant[];
  blocks: TwoColumnScriptBlock[];
  activeHook: HookCandidate | null;
  tiktokCaption: string;
  searchHook: string;
  hashtags: string[];
  onUpdateCaption: (caption: string) => void;
  onUpdateSearchHook: (searchHook: string) => void;
  onOpenTeleprompter: () => void;
  onCopy: (key: string, text: string, label: string) => Promise<void>;
  copiedKey: string | null;
  onSyncFromMaster: () => void;
}

export function TikTokPlatformVisor({
  assetCode,
  projectTitle,
  abVariants,
  blocks,
  activeHook,
  tiktokCaption,
  searchHook,
  hashtags,
  onUpdateCaption,
  onUpdateSearchHook,
  onOpenTeleprompter,
  onCopy,
  copiedKey,
  onSyncFromMaster,
}: TikTokPlatformVisorProps) {
  const [coverTextA, setCoverTextA] = useState(
    abVariants[0]?.title || projectTitle || "El Secreto Oculto"
  );
  const [coverTextB, setCoverTextB] = useState(
    abVariants[1]?.title || "No cometas este error"
  );
  const [activeCoverVariant, setActiveCoverVariant] = useState<"A" | "B">("A");

  // Determine loop connection: last block voiceover connecting to first hook
  const firstSentence = useMemo(() => {
    return activeHook?.hook_text || blocks[0]?.audio_voiceover || "";
  }, [activeHook, blocks]);

  const lastSentence = useMemo(() => {
    const last = blocks[blocks.length - 1];
    return last?.audio_voiceover || "";
  }, [blocks]);

  const formattedHashtags = useMemo(() => {
    return hashtags
      .slice(0, 4)
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .join(" ");
  }, [hashtags]);

  const currentCoverText = activeCoverVariant === "A" ? coverTextA : coverTextB;

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-bold">
              <Zap className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Visor Especializado: TikTok (Search SEO &amp; Bucle Infinito)
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] font-semibold">
              Search &lt;100c · Loop infinito · Ritmo 1.5s
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Optimizada para el motor de búsqueda de TikTok y para superar el 100% de retención con estructura en bucle.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      {/* Main Grid: Script Left, SEO & Cover Right */}
      <div className="grid lg:grid-cols-12 gap-5">
        {/* Left: TikTok Script with Loop Indicator (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  Guión de Alta Retención y Pacing TikTok
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Frases directas, sin rodeos, con interrupciones visuales en pantalla cada 2 segundos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const fullText = blocks
                    .map((b) => `${b.audio_voiceover}`)
                    .join("\n\n");
                  void onCopy("tiktok-script", fullText, "Guión de TikTok");
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:border-cyan-400 text-xs font-semibold text-slate-200 transition"
              >
                {copiedKey === "tiktok-script" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                Copiar
              </button>
            </div>

            {/* Seamless Loop Box */}
            <div className="rounded-lg border border-cyan-500/40 bg-cyan-950/20 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5" />
                  Conexión de Bucle Perfecto (Seamless Loop):
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  Retención &gt; 100%
                </span>
              </div>
              <div className="text-[11px] space-y-1">
                <p className="text-slate-300">
                  <span className="text-slate-500">Cierre:</span> &ldquo;{lastSentence || "Y es por eso que..."}&rdquo;
                </p>
                <p className="text-cyan-200 font-semibold">
                  <span className="text-slate-500">→ Empalma con el inicio:</span> &ldquo;{firstSentence}&rdquo;
                </p>
              </div>
            </div>

            {/* Blocks */}
            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
              {blocks.map((block, idx) => (
                <div
                  key={block.block_id || idx}
                  className="rounded-lg border border-slate-800/80 bg-[#0b0e16] p-3 space-y-2 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-cyan-300">
                      Paso {idx + 1}: {block.section_label}
                    </span>
                    <span className="font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~{Math.round((block.audio_voiceover.split(/\s+/).length / 140) * 60)}s
                    </span>
                  </div>
                  <p className="text-xs text-slate-100 leading-relaxed font-sans">
                    {block.audio_voiceover}
                  </p>
                  {block.on_screen_text && (
                    <div className="rounded bg-[#020306] border border-cyan-500/20 px-2 py-1 text-[11px] font-mono text-cyan-200">
                      Texto pantalla: &ldquo;{block.on_screen_text}&rdquo;
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: TikTok Search SEO, Caption & Cover (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          {/* SEO Search Hook & Caption */}
          <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-cyan-400" />
                  TikTok Search SEO &amp; Caption
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Indexación en la barra de búsqueda de TikTok con términos exactos de intención.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  void onCopy(
                    "tiktok-meta",
                    `SEARCH HOOK (SEO):\n${searchHook}\n\nCAPTION:\n${tiktokCaption}`,
                    "TikTok SEO y Copy"
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition"
              >
                {copiedKey === "tiktok-meta" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copiar Todo
              </button>
            </div>

            {/* TikTok Search Bar Hook Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="tiktok-search-hook" className="font-semibold text-slate-200">
                  Frase de Búsqueda (TikTok Search Bar &lt;100 chars)
                </label>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    searchHook.length <= 100 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {searchHook.length} / 100 chars
                </span>
              </div>
              <input
                id="tiktok-search-hook"
                type="text"
                value={searchHook}
                onChange={(e) => onUpdateSearchHook(e.target.value)}
                placeholder="Ej: como editar videos con inteligencia artificial en 2026..."
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-cyan-200 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Caption Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="tiktok-caption" className="font-semibold text-slate-200">
                  Descripción Corta &amp; Hashtags
                </label>
                <button
                  type="button"
                  onClick={() => onUpdateCaption(`${tiktokCaption.trim()} ${formattedHashtags}`)}
                  className="text-[11px] text-cyan-300 hover:underline font-mono"
                >
                  + Añadir Hashtags
                </button>
              </div>
              <textarea
                id="tiktok-caption"
                rows={4}
                value={tiktokCaption}
                onChange={(e) => onUpdateCaption(e.target.value)}
                placeholder="Copy rápido para TikTok con gancho y hashtags de nicho..."
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* TikTok Grid Cover Studio */}
          <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Portada de Cuadrícula TikTok (Video Cover)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Texto flotante grande para la pestaña de videos de tu perfil de TikTok.
                </p>
              </div>

              {/* A/B Selector */}
              <div className="inline-flex rounded-lg border border-slate-800 bg-[#020306] p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveCoverVariant("A")}
                  className={`px-2.5 py-1 text-xs font-bold rounded ${
                    activeCoverVariant === "A" ? "bg-cyan-500 text-slate-950" : "text-slate-400"
                  }`}
                >
                  Texto A
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCoverVariant("B")}
                  className={`px-2.5 py-1 text-xs font-bold rounded ${
                    activeCoverVariant === "B" ? "bg-cyan-500 text-slate-950" : "text-slate-400"
                  }`}
                >
                  Texto B
                </button>
              </div>
            </div>

            {/* Inputs */}
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Texto de Portada A
                </label>
                <input
                  type="text"
                  value={coverTextA}
                  onChange={(e) => setCoverTextA(e.target.value)}
                  className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Texto de Portada B
                </label>
                <input
                  type="text"
                  value={coverTextB}
                  onChange={(e) => setCoverTextB(e.target.value)}
                  className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Visual Cover Simulation */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4 rounded-xl bg-[#020306] border border-slate-800">
              <div className="relative w-[160px] h-[240px] rounded-xl overflow-hidden border-2 border-slate-700 bg-gradient-to-t from-slate-950 via-cyan-950/40 to-slate-900 flex flex-col justify-end p-2.5 shadow-xl">
                {/* Simulated TikTok thumbnail card */}
                <div className="rounded bg-black/80 border border-cyan-400/40 px-2 py-1 text-center mb-4">
                  <span className="text-[11px] font-black text-cyan-300 uppercase leading-tight tracking-wide">
                    {currentCoverText}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                  <span>▶ 42.5K</span>
                  <span>TikTok</span>
                </div>
              </div>

              <div className="space-y-2 text-xs max-w-xs">
                <p className="text-[11px] text-slate-300 font-semibold">
                  📌 Recomendación de diseño TikTok:
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Usa entre 3 y 5 palabras de contraste alto (amarillo sobre negro o cian sobre negro) para que el espectador que visita tu perfil entienda de inmediato el valor de cada video.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    void onCopy("tiktok-cover-text", currentCoverText, "Texto de portada TikTok")
                  }
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-xs font-semibold transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Texto para Portada de TikTok
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
