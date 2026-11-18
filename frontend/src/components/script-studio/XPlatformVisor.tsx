"use client";

import React, { useState } from "react";
import {
  Check,
  Copy,
  Layers,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Twitter,
} from "lucide-react";
import type { ABPackagingVariant, HookCandidate, TwoColumnScriptBlock } from "@/types/engine";

interface XPlatformVisorProps {
  assetCode: string;
  projectTitle: string;
  abVariants: ABPackagingVariant[];
  blocks: TwoColumnScriptBlock[];
  activeHook: HookCandidate | null;
  singleTweet: string;
  threadTweets: string[];
  leadMagnetKeyword: string;
  onUpdateSingleTweet: (tweet: string) => void;
  onUpdateThreadTweet: (index: number, tweet: string) => void;
  onAddThreadTweet: () => void;
  onRemoveThreadTweet: (index: number) => void;
  onCopy: (key: string, text: string, label: string) => Promise<void>;
  copiedKey: string | null;
  onSyncFromMaster: () => void;
}

export function XPlatformVisor({
  assetCode,
  projectTitle,
  abVariants,
  blocks,
  activeHook,
  singleTweet,
  threadTweets,
  leadMagnetKeyword,
  onUpdateSingleTweet,
  onUpdateThreadTweet,
  onAddThreadTweet,
  onRemoveThreadTweet,
  onCopy,
  copiedKey,
  onSyncFromMaster,
}: XPlatformVisorProps) {
  const [mode, setMode] = useState<"thread" | "single">("thread");
  const [bannerTitleA, setBannerTitleA] = useState(
    abVariants[0]?.title || projectTitle || "Título de Tarjeta A"
  );
  const [bannerTitleB, setBannerTitleB] = useState(
    abVariants[1]?.title || "Blueprint Paso a Paso"
  );
  const [activeBannerVariant, setActiveBannerVariant] = useState<"A" | "B">("A");

  const currentBannerTitle = activeBannerVariant === "A" ? bannerTitleA : bannerTitleB;

  const handleCopyThreadAll = () => {
    const fullThread = threadTweets.join("\n\n---\n\n");
    void onCopy("x-full-thread", fullThread, "Hilo completo de X");
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold">
              <Twitter className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Visor Especializado: X / Twitter (Tweet Individual &amp; Hilo Viral)
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-semibold">
              ≤280 chars/tweet · Hilo 🧵 · Bookmark Prompt
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Formato de alto impacto y síntesis extrema con control estricto de límite de caracteres.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="inline-flex rounded-lg border border-slate-800 bg-[#020306] p-0.5">
            <button
              type="button"
              onClick={() => setMode("thread")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                mode === "thread"
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Hilo Viral (Thread)
            </button>
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                mode === "single"
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Tweet Único (≤280c)
            </button>
          </div>

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

      {/* Main Grid: Thread/Tweet Left, 16:9 Banner Card Right */}
      <div className="grid lg:grid-cols-12 gap-5">
        {/* Left: Tweets Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Twitter className="w-4 h-4 text-amber-400" />
                  {mode === "thread"
                    ? `Hilo Viral en X (${threadTweets.length} Tweets)`
                    : "Tweet Único de Alto Impacto"}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Cada tweet está limitado a un máximo estricto de 280 caracteres.
                </p>
              </div>

              {mode === "thread" ? (
                <button
                  type="button"
                  onClick={handleCopyThreadAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition"
                >
                  {copiedKey === "x-full-thread" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  Copiar Hilo Completo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void onCopy("x-single-tweet", singleTweet, "Tweet único")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition"
                >
                  {copiedKey === "x-single-tweet" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  Copiar Tweet
                </button>
              )}
            </div>

            {/* Mode: Single Tweet */}
            {mode === "single" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="x-single-input" className="font-semibold text-slate-200">
                    Contenido del Tweet
                  </label>
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      singleTweet.length <= 280 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {singleTweet.length} / 280 chars {singleTweet.length > 280 && "(Excede el límite)"}
                  </span>
                </div>
                <textarea
                  id="x-single-input"
                  rows={6}
                  value={singleTweet}
                  onChange={(e) => onUpdateSingleTweet(e.target.value)}
                  className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-slate-100 leading-relaxed font-sans focus:outline-none focus:border-amber-400"
                />
              </div>
            )}

            {/* Mode: Thread Tweets */}
            {mode === "thread" && (
              <div className="space-y-4 max-h-[660px] overflow-y-auto pr-1">
                {threadTweets.map((tweet, idx) => {
                  const isHookTweet = idx === 0;
                  const isFinalCta = idx === threadTweets.length - 1;
                  const overLimit = tweet.length > 280;

                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-800 bg-[#020306] p-3.5 space-y-2 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-200">
                            {isHookTweet
                              ? "Tweet 1: Gancho + Promesa del Hilo 🧵👇"
                              : isFinalCta
                              ? "Tweet Final: CTA + Disparador DM"
                              : `Tweet ${idx + 1}: Puntos Clave & Argumento`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[11px] font-bold ${
                              !overLimit ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {tweet.length} / 280 chars
                          </span>
                          <button
                            type="button"
                            onClick={() => void onCopy(`x-tweet-${idx}`, tweet, `Tweet ${idx + 1}`)}
                            className="p-1 text-slate-400 hover:text-white"
                            title="Copiar este tweet"
                          >
                            {copiedKey === `x-tweet-${idx}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {threadTweets.length > 2 && (
                            <button
                              type="button"
                              onClick={() => onRemoveThreadTweet(idx)}
                              className="p-1 text-slate-500 hover:text-rose-400"
                              title="Eliminar este tweet"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <textarea
                        rows={3}
                        value={tweet}
                        onChange={(e) => onUpdateThreadTweet(idx, e.target.value)}
                        className={`w-full rounded-lg bg-[#07090e] border px-3 py-2 text-xs text-slate-100 leading-relaxed font-sans focus:outline-none ${
                          overLimit ? "border-rose-500" : "border-slate-800 focus:border-amber-400"
                        }`}
                      />
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={onAddThreadTweet}
                  className="w-full py-2.5 rounded-lg border border-dashed border-slate-700 hover:border-amber-400/80 text-xs font-semibold text-slate-300 hover:text-amber-300 transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Añadir Tweet al Hilo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: 16:9 Banner Image Packaging (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  Tarjeta Visual 16:9 para Tweet 1
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Las imágenes adjuntas al tweet inicial aumentan los retweets en un 150%.
                </p>
              </div>

              {/* A/B Selector */}
              <div className="inline-flex rounded-lg border border-slate-800 bg-[#020306] p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveBannerVariant("A")}
                  className={`px-2 py-0.5 text-xs font-bold rounded ${
                    activeBannerVariant === "A" ? "bg-amber-500 text-slate-950" : "text-slate-400"
                  }`}
                >
                  Card A
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBannerVariant("B")}
                  className={`px-2 py-0.5 text-xs font-bold rounded ${
                    activeBannerVariant === "B" ? "bg-amber-500 text-slate-950" : "text-slate-400"
                  }`}
                >
                  Card B
                </button>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-2 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Titular de Tarjeta A
                </label>
                <input
                  type="text"
                  value={bannerTitleA}
                  onChange={(e) => setBannerTitleA(e.target.value)}
                  className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Titular de Tarjeta B
                </label>
                <input
                  type="text"
                  value={bannerTitleB}
                  onChange={(e) => setBannerTitleB(e.target.value)}
                  className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Visual 16:9 Banner Mockup */}
            <div className="rounded-xl border border-slate-700 bg-gradient-to-r from-[#020306] via-amber-950/20 to-slate-900 p-4 aspect-video flex flex-col justify-between shadow-xl">
              <div className="flex justify-between items-center text-[10px] text-amber-400 font-mono">
                <span className="uppercase">Twitter / X Card 16:9</span>
                <span>Variante {activeBannerVariant}</span>
              </div>
              <div className="my-auto text-center space-y-1">
                <p className="text-sm sm:text-base font-black text-white uppercase tracking-tight leading-tight">
                  {currentBannerTitle}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {projectTitle}
                </p>
              </div>
              <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono">
                <span>Auto-Content Engine</span>
                <span>🧵 Hilo en comentarios</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void onCopy(
                  "x-banner-prompt",
                  `Prompt para Tarjeta X (16:9): Fondo oscuro obsidiana (#020306), gráficos vectoriales de alta precisión tecnológica, titular centrado con alta legibilidad: "${currentBannerTitle}", estética minimalista moderna para Twitter.`,
                  "Prompt Tarjeta X"
                )
              }
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Copiar Prompt para Imagen de X
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
