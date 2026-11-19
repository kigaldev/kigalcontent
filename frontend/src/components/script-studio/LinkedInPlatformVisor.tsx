"use client";

import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  Briefcase,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Layers,
  Link2,
  MessageSquare,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { ABPackagingVariant, HookCandidate, TwoColumnScriptBlock } from "@/types/engine";

interface LinkedInPlatformVisorProps {
  assetCode: string;
  projectTitle: string;
  abVariants: ABPackagingVariant[];
  blocks: TwoColumnScriptBlock[];
  activeHook: HookCandidate | null;
  linkedInHook: string;
  linkedInBody: string;
  linkedInFirstComment: string;
  onUpdateHook: (hook: string) => void;
  onUpdateBody: (body: string) => void;
  onUpdateFirstComment: (comment: string) => void;
  onCopy: (key: string, text: string, label: string) => Promise<void>;
  copiedKey: string | null;
  onSyncFromMaster: () => void;
}

export function LinkedInPlatformVisor({
  assetCode,
  projectTitle,
  abVariants,
  blocks,
  activeHook,
  linkedInHook,
  linkedInBody,
  linkedInFirstComment,
  onUpdateHook,
  onUpdateBody,
  onUpdateFirstComment,
  onCopy,
  copiedKey,
  onSyncFromMaster,
}: LinkedInPlatformVisorProps) {
  // Check for external URLs in body
  const bodyHasExternalUrl = useMemo(() => {
    return /https?:\/\/\S+/i.test(linkedInBody);
  }, [linkedInBody]);

  // Generate 5-slide carousel blueprint from script blocks or contextual narrative
  const carouselSlides = useMemo(() => {
    const isHeroOrPersonal =
      linkedInBody.toLowerCase().includes("hero24") ||
      linkedInBody.toLowerCase().includes("artificial") ||
      projectTitle.toLowerCase().includes("hero24") ||
      projectTitle.toLowerCase().includes("nueva etapa");

    if (isHeroOrPersonal) {
      return [
        {
          num: 1,
          title: linkedInHook || "Por qué dejé de publicar contenido 100% IA",
          type: "PORTADA",
          desc: "La lección honesta sobre visitas vacías vs conversaciones reales.",
        },
        {
          num: 2,
          title: "El error de la IA sin criterio",
          type: "APRENDIZAJE",
          desc: "Tuvimos miles de visualizaciones, pero exactamente cero engagement y un resultado artificial.",
        },
        {
          num: 3,
          title: "Mi nueva etapa profesional",
          type: "ENFOQUE",
          desc: "Volver al contenido natural, humano y cercano, compartiendo aprendizajes de trinchera.",
        },
        {
          num: 4,
          title: "HERO24 en España",
          type: "PROYECTO",
          desc: "Como Growth Country Lead, digitalizamos y abrimos un nuevo canal de captación para empresas de servicios.",
        },
        {
          num: 5,
          title: "¿Tienes una empresa de servicios?",
          type: "COLABORACIÓN",
          desc: "Escríbeme por DM para sumarte al canal gratuito o hablemos en comentarios.",
        },
      ];
    }

    const slides = [
      {
        num: 1,
        title: linkedInHook || projectTitle || "Título del Carrusel",
        type: "PORTADA",
        desc: "Gancho visual contraintuitivo. Debe detener el scroll de ejecutivos.",
      },
      {
        num: 2,
        title: blocks[0]?.section_label || "El Mito Tradicional",
        type: "PROBLEMA",
        desc: blocks[0]?.audio_voiceover.slice(0, 140) || "La mayoría sigue midiendo volumen en vez de retención.",
      },
      {
        num: 3,
        title: blocks[1]?.section_label || "El Sistema Operativo",
        type: "SOLUCIÓN",
        desc: blocks[1]?.audio_voiceover.slice(0, 140) || "Paso a paso para estructurar un flujo automatizado.",
      },
      {
        num: 4,
        title: blocks[2]?.section_label || "Datos & Resultados Reales",
        type: "EVIDENCIA",
        desc: blocks[2]?.audio_voiceover.slice(0, 140) || "Métricas comparativas de impacto directo en conversión.",
      },
      {
        num: 5,
        title: "Checklist & Siguiente Paso",
        type: "CTA FINAL",
        desc: "Comenta abajo o revisa el primer comentario para recibir el documento completo.",
      },
    ];
    return slides;
  }, [linkedInHook, projectTitle, blocks, linkedInBody]);

  const [activeSlide, setActiveSlide] = useState(0);

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-400 font-bold">
              <Briefcase className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Visor Especializado: LinkedIn (Zero-Link &amp; Carrusel PDF)
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono text-[11px] font-semibold">
              Zero-Link (-60% penalty) · Hook &lt;135c · 1er Comentario
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Formato profesional adaptado a la psicología de LinkedIn: sin enlaces salientes en el cuerpo y formato carrusel de alto dwell time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      {/* Main Grid: Post Left, Carousel & First Comment Right */}
      <div className="grid lg:grid-cols-12 gap-5">
        {/* Left: Structured Post Editor (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-sky-400" />
                  Publicación Escrita para LinkedIn
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Línea de apertura visible antes de &ldquo;...ver más&rdquo; + cuerpo en viñetas limpias.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  void onCopy(
                    "li-post",
                    `${linkedInHook}\n\n${linkedInBody}`,
                    "Publicación de LinkedIn"
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition"
              >
                {copiedKey === "li-post" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copiar Post
              </button>
            </div>

            {/* Hook Input (<135 chars) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="li-hook-input" className="font-semibold text-slate-200">
                  Gancho de Apertura (visible antes del botón &ldquo;...ver más&rdquo;)
                </label>
                <span
                  className={`font-mono text-[11px] font-bold ${
                    linkedInHook.length <= 135 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {linkedInHook.length} / 135 chars
                </span>
              </div>
              <input
                id="li-hook-input"
                type="text"
                value={linkedInHook}
                onChange={(e) => onUpdateHook(e.target.value)}
                placeholder="La mayoría mide volumen; los equipos rentables miden retención..."
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
              />
            </div>

            {/* Body Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="li-body-input" className="font-semibold text-slate-200">
                  Cuerpo Estructurado
                </label>
                <span
                  className={`font-mono text-[11px] font-bold flex items-center gap-1 ${
                    bodyHasExternalUrl ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {bodyHasExternalUrl ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Penalización: Enlace detectado (-60% alcance)
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Zero-Link Limpio (100% alcance)
                    </>
                  )}
                </span>
              </div>
              <textarea
                id="li-body-input"
                rows={11}
                value={linkedInBody}
                onChange={(e) => onUpdateBody(e.target.value)}
                placeholder="Cuerpo de la publicación en viñetas y lecciones..."
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-slate-100 leading-relaxed font-sans focus:outline-none focus:border-sky-400"
              />
            </div>

            {/* First Comment Strategy Box */}
            <div className="rounded-lg border border-slate-800 bg-[#020306] p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-sky-300 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  Estrategia del Primer Comentario (Donde va el enlace):
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void onCopy("li-first-comment", linkedInFirstComment, "Primer comentario")
                  }
                  className="text-[11px] text-sky-300 hover:underline font-mono"
                >
                  {copiedKey === "li-first-comment" ? "✓ Copiado" : "Copiar 1er Comentario"}
                </button>
              </div>
              <textarea
                rows={2}
                value={linkedInFirstComment}
                onChange={(e) => onUpdateFirstComment(e.target.value)}
                className="w-full rounded bg-[#07090e] border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>
        </div>

        {/* Right: Carousel PDF Blueprint & Slides (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-400" />
                  Carrusel de Diapositivas LinkedIn (Documento PDF)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Estructura de 5 diapositivas para maximizar el tiempo de retención (Dwell Time).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const carouselText = carouselSlides
                    .map((s) => `[SLIDE ${s.num}: ${s.type}]\n${s.title}\n${s.desc}`)
                    .join("\n\n");
                  void onCopy("li-carousel-text", carouselText, "Estructura del Carrusel");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 text-xs font-semibold transition"
              >
                {copiedKey === "li-carousel-text" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copiar 5 Slides
              </button>
            </div>

            {/* Slide Navigation Thumbnails */}
            <div className="grid grid-cols-5 gap-2">
              {carouselSlides.map((slide, idx) => (
                <button
                  key={slide.num}
                  type="button"
                  onClick={() => setActiveSlide(idx)}
                  className={`rounded-lg p-2 text-center border transition ${
                    activeSlide === idx
                      ? "border-sky-400 bg-sky-500/20 text-sky-200"
                      : "border-slate-800 bg-[#020306] text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className="text-[10px] font-mono block font-bold">
                    S{slide.num}
                  </span>
                  <span className="text-[9px] truncate block opacity-75">
                    {slide.type}
                  </span>
                </button>
              ))}
            </div>

            {/* Slide Visual Card Preview */}
            {carouselSlides[activeSlide] && (
              <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-[#020306] via-[#090d18] to-slate-900 p-6 flex flex-col justify-between min-h-[260px] shadow-lg">
                <div className="flex items-center justify-between text-xs font-mono text-sky-400">
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/40">
                    SLIDE {carouselSlides[activeSlide].num} · {carouselSlides[activeSlide].type}
                  </span>
                  <span className="text-slate-500 font-sans">Formato 4:5 o 1:1</span>
                </div>

                <div className="space-y-3 my-4">
                  <h5 className="text-base sm:text-lg font-black text-white leading-tight">
                    {carouselSlides[activeSlide].title}
                  </h5>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {carouselSlides[activeSlide].desc}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-[10px] text-slate-500 font-mono">
                  <span>KigalContent Creator Studio</span>
                  <span>Desliza para ver más →</span>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-slate-800 bg-[#020306] p-3 text-xs text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300 block">
                💡 Consejo operativo para LinkedIn:
              </span>
              <p className="text-[11px] leading-relaxed">
                Guarda este contenido en tu herramienta de diseño (Canva, Figma o Illustrator), expórtalo como PDF y súbelo a LinkedIn eligiendo la opción &ldquo;Añadir documento&rdquo;. Genera un 300% más de impresiones que una publicación solo de texto.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
