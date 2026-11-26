"use client";

import React, { useState, useMemo } from "react";
import {
  Check,
  Clock,
  Copy,
  Hash,
  Instagram,
  Layers,
  MessageCircle,
  RefreshCw,
  Send,
  Smartphone,
  Sparkles,
  Tv,
} from "lucide-react";
import type { ABPackagingVariant, HookCandidate, TwoColumnScriptBlock } from "@/types/engine";

interface InstagramPlatformVisorProps {
  assetCode: string;
  projectTitle: string;
  abVariants: ABPackagingVariant[];
  blocks: TwoColumnScriptBlock[];
  activeHook: HookCandidate | null;
  reelCaption: string;
  manychatKeyword: string;
  hashtags: string[];
  onUpdateCaption: (caption: string) => void;
  onOpenTeleprompter: () => void;
  onCopy: (key: string, text: string, label: string) => Promise<void>;
  copiedKey: string | null;
  onSyncFromMaster: () => void;
}

export function InstagramPlatformVisor({
  assetCode,
  projectTitle,
  abVariants,
  blocks,
  activeHook,
  reelCaption,
  manychatKeyword,
  hashtags,
  onUpdateCaption,
  onOpenTeleprompter,
  onCopy,
  copiedKey,
  onSyncFromMaster,
}: InstagramPlatformVisorProps) {
  const [coverTitleA, setCoverTitleA] = useState(
    abVariants[0]?.title || projectTitle || "Título Portada A"
  );
  const [coverTitleB, setCoverTitleB] = useState(
    abVariants[1]?.title || "El error que nadie te cuenta"
  );
  const [activeCoverVariant, setActiveCoverVariant] = useState<"A" | "B">("A");
  const [showProfileGridBox, setShowProfileGridBox] = useState(true);

  // Split first line (hook visible before "...más") vs body
  const lines = reelCaption.split("\n");
  const firstLine = lines[0] || "";
  const remainingBody = lines.slice(1).join("\n");

  const formattedHashtags = useMemo(() => {
    return hashtags
      .slice(0, 5)
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .join(" ");
  }, [hashtags]);

  const handleInsertManyChatCta = () => {
    const ctaText = `\n\n💬 Comenta "${manychatKeyword}" y te envío el recurso completo directo a tus mensajes privados (DM).`;
    onUpdateCaption(`${reelCaption.trim()}${ctaText}`);
  };

  const handleInsertHashtags = () => {
    onUpdateCaption(`${reelCaption.trim()}\n\n.\n.\n.\n${formattedHashtags}`);
  };

  const currentCoverTitle = activeCoverVariant === "A" ? coverTitleA : coverTitleB;

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/20 border border-pink-500/40 text-pink-400 font-bold">
              <Instagram className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Visor Especializado: Instagram (Reels 9:16 &amp; KigalChat)
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 font-mono text-[11px] font-semibold">
              Zona Segura · Trigger DM · Grid 1:1 Perfil
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Formato vertical de alta retención optimizado con disparador de lead magnet por mensaje privado.
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

      {/* Main Grid: Script Left, Copy & 1:1 Profile Cover Right */}
      <div className="grid lg:grid-cols-12 gap-5">
        {/* Left: Reel Script (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-pink-400" />
                  Guión de Reel en Zona Segura (9:16)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Texto en pantalla y cortes respetando márgenes de likes (derecha) y audio (abajo).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const fullText = blocks
                    .map((b) => `[${b.section_label}]\n${b.audio_voiceover}${b.on_screen_text ? `\n(Texto: ${b.on_screen_text})` : ""}`)
                    .join("\n\n");
                  void onCopy("ig-script", fullText, "Guión de Reels");
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:border-pink-400 text-xs font-semibold text-slate-200 transition"
              >
                {copiedKey === "ig-script" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                Copiar
              </button>
            </div>

            {/* Hook Callout */}
            {activeHook && (
              <div className="rounded-lg border border-pink-500/30 bg-pink-950/15 p-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-pink-300">
                    Gancho 0–3s de Ruptura de Scroll:
                  </span>
                  <span className="font-mono text-[10px] text-pink-400">
                    {activeHook.estimated_hold_rate
                      ? `Retención estimada por IA: ${activeHook.estimated_hold_rate}%`
                      : "Sin estimación"}
                  </span>
                </div>
                <p className="text-xs text-slate-200 font-medium">
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
                    <span className="font-mono font-bold text-pink-300">
                      {idx + 1}. {block.section_label}
                    </span>
                    <span className="font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~{Math.round((block.audio_voiceover.split(/\s+/).length / 140) * 60)}s
                    </span>
                  </div>
                  <p className="text-xs text-slate-100 leading-relaxed">
                    {block.audio_voiceover}
                  </p>
                  {block.on_screen_text && (
                    <div className="rounded bg-[#020306] border border-pink-500/20 px-2 py-1 text-[11px] font-mono text-pink-200 flex items-center justify-between">
                      <span>Texto Seguro: &ldquo;{block.on_screen_text}&rdquo;</span>
                      <span className="text-[9px] text-slate-500 font-sans">Centro 9:16</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Caption + ManyChat DM & Profile Grid Cover (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          {/* Caption & ManyChat */}
          <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-pink-400" />
                  Copy de la Publicación &amp; Disparador DM
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Línea 1 visible antes del &ldquo;...más&rdquo; + keyword de Manychat/KigalChat.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onCopy("ig-caption", reelCaption, "Copy de Instagram")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-400 text-slate-950 text-xs font-bold transition"
              >
                {copiedKey === "ig-caption" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copiar Copy
              </button>
            </div>

            {/* Hook line check */}
            <div className="rounded-lg border border-slate-800 bg-[#020306] p-2.5 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-300">
                  Línea de Apertura (visible en feed sin expandir):
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  {firstLine.length} chars (Óptimo &lt; 125)
                </span>
              </div>
              <p className="text-xs text-pink-200 font-medium italic">
                {firstLine || "Escribe el gancho de la primera línea..."}
              </p>
            </div>

            {/* Caption Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="ig-caption-input" className="font-semibold text-slate-200">
                  Texto Completo del Post
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleInsertManyChatCta}
                    className="text-[11px] text-emerald-300 hover:underline font-mono flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    + CTA &ldquo;{manychatKeyword}&rdquo;
                  </button>
                  <button
                    type="button"
                    onClick={handleInsertHashtags}
                    className="text-[11px] text-pink-300 hover:underline font-mono flex items-center gap-1"
                  >
                    <Hash className="w-3 h-3" />
                    + Hashtags
                  </button>
                </div>
              </div>
              <textarea
                id="ig-caption-input"
                rows={7}
                value={reelCaption}
                onChange={(e) => onUpdateCaption(e.target.value)}
                placeholder="Escribe el copy para Instagram Reels con saltos de línea..."
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-slate-100 leading-relaxed font-sans focus:outline-none focus:border-pink-400"
              />
            </div>

            {/* ManyChat Trigger Live Pill */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-950/20 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-300">Disparador KigalChat activo:</span>
                <strong className="font-mono text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40">
                  {manychatKeyword}
                </strong>
              </div>
              <span className="text-[11px] text-slate-400">
                Responde por DM automáticamente
              </span>
            </div>
          </div>

          {/* Reel Cover Designer with 1:1 Profile Feed Preview */}
          <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-pink-400" />
                  Diseñador de Portada Reel A/B (con Guía 1:1 de Perfil)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Verifica que el título no quede cortado en la cuadrícula cuadrada de tu feed de Instagram.
                </p>
              </div>

              {/* Variant A/B selector */}
              <div className="inline-flex rounded-lg border border-slate-800 bg-[#020306] p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveCoverVariant("A")}
                  className={`px-2.5 py-1 text-xs font-bold rounded ${
                    activeCoverVariant === "A" ? "bg-pink-500 text-slate-950" : "text-slate-400"
                  }`}
                >
                  Variante A
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCoverVariant("B")}
                  className={`px-2.5 py-1 text-xs font-bold rounded ${
                    activeCoverVariant === "B" ? "bg-pink-500 text-slate-950" : "text-slate-400"
                  }`}
                >
                  Variante B
                </button>
              </div>
            </div>

            {/* Inputs for Title A / B */}
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Titular Portada A
                </label>
                <input
                  type="text"
                  value={coverTitleA}
                  onChange={(e) => setCoverTitleA(e.target.value)}
                  className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-pink-400"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Titular Portada B
                </label>
                <input
                  type="text"
                  value={coverTitleB}
                  onChange={(e) => setCoverTitleB(e.target.value)}
                  className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-pink-400"
                />
              </div>
            </div>

            {/* Interactive Visual Simulator of 9:16 Reel Cover + 1:1 Profile Box */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4 rounded-xl bg-[#020306] border border-slate-800">
              {/* 9:16 Frame */}
              <div className="relative w-[180px] h-[320px] rounded-2xl overflow-hidden border-2 border-slate-700 bg-gradient-to-b from-slate-900 via-pink-950/40 to-slate-950 shadow-2xl flex flex-col justify-between p-3">
                {/* Top safe zone tag */}
                <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono">
                  <span>Reel 9:16</span>
                  <span className="text-pink-400 font-bold">Variante {activeCoverVariant}</span>
                </div>

                {/* 1:1 Profile Feed Overlay Box */}
                {showProfileGridBox && (
                  <div className="absolute inset-x-2 top-[70px] h-[164px] border-2 border-dashed border-cyan-400/80 bg-cyan-500/10 rounded-lg flex flex-col items-center justify-center p-2 text-center pointer-events-none">
                    <span className="text-[9px] font-mono font-bold text-cyan-300 uppercase tracking-wider mb-1">
                      Recorte Feed Perfil 1:1
                    </span>
                    <p className="text-xs font-black text-white leading-tight uppercase drop-shadow-md">
                      {currentCoverTitle}
                    </p>
                  </div>
                )}

                {/* Bottom UI bar simulation */}
                <div className="flex justify-between items-end text-[9px] text-slate-400">
                  <div className="space-y-0.5">
                    <div className="h-1.5 w-16 bg-slate-700 rounded-full" />
                    <div className="h-1.5 w-10 bg-slate-800 rounded-full" />
                  </div>
                  <div className="h-4 w-4 rounded-full bg-pink-500/30 flex items-center justify-center text-[8px] text-pink-300 font-bold">
                    ♪
                  </div>
                </div>
              </div>

              {/* Controls and advice */}
              <div className="space-y-3 text-xs max-w-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showProfileGridBox}
                    onChange={(e) => setShowProfileGridBox(e.target.checked)}
                    className="accent-pink-400 rounded"
                  />
                  <span className="text-slate-300 font-medium">
                    Mostrar guía de recorte 1:1 para feed de perfil
                  </span>
                </label>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  💡 <strong>Regla de oro:</strong> Mantén el texto principal centrado entre el 25% y 75% vertical del Reel. Así lucirá nítido tanto a pantalla completa como en la cuadrícula de tu cuenta.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    void onCopy(
                      "ig-cover-prompt",
                      `Prompt para Portada Reel Instagram: Fotografía editorial ultra nítida, iluminación dramática de estudio, fondo oscuro obsidiana, espacio negativo central para titular: "${currentCoverTitle}", estilo moderno y profesional.`,
                      "Prompt Portada Reel"
                    )
                  }
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-pink-500/40 bg-pink-500/10 text-pink-300 hover:bg-pink-500/20 text-xs font-semibold transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Copiar Prompt para Imagen de Portada
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
