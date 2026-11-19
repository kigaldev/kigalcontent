"use client";

import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  Briefcase,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers,
  Link2,
  Loader2,
  MessageSquareOff,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import type {
  ABPackagingVariant,
  HookCandidate,
  LinkedInVisualMode,
  TwoColumnScriptBlock,
} from "@/types/engine";

interface LinkedInPlatformVisorProps {
  assetCode: string;
  projectTitle: string;
  authorName?: string;
  abVariants: ABPackagingVariant[];
  blocks: TwoColumnScriptBlock[];
  activeHook: HookCandidate | null;
  linkedInHook: string;
  linkedInBody: string;
  linkedInFirstComment: string;
  visualMode: LinkedInVisualMode;
  visualAssetUrl: string | null;
  saving?: boolean;
  onUpdateHook: (hook: string) => void;
  onUpdateBody: (body: string) => void;
  onUpdateFirstComment: (comment: string) => void;
  onChangeVisualMode: (mode: LinkedInVisualMode) => void;
  onUpdateVisualAssetUrl: (url: string | null) => void;
  onSave: (overrideMode?: LinkedInVisualMode, overrideUrl?: string | null) => Promise<void>;
  onCopy: (key: string, text: string, label: string) => Promise<void>;
  copiedKey: string | null;
  onSyncFromMaster: () => void;
}

export function LinkedInPlatformVisor({
  assetCode,
  projectTitle,
  authorName = "Kike Gallego",
  abVariants,
  blocks,
  activeHook,
  linkedInHook,
  linkedInBody,
  linkedInFirstComment,
  visualMode,
  visualAssetUrl,
  saving = false,
  onUpdateHook,
  onUpdateBody,
  onUpdateFirstComment,
  onChangeVisualMode,
  onUpdateVisualAssetUrl,
  onSave,
  onCopy,
  copiedKey,
  onSyncFromMaster,
}: LinkedInPlatformVisorProps) {
  const [visualProvider, setVisualProvider] = useState<"svg_local" | "nano_banana" | "gpt_images">("svg_local");
  const [visualType, setVisualType] = useState<"INFOGRAPHIC" | "IMAGE">("INFOGRAPHIC");
  const [visualPrompt, setVisualPrompt] = useState("");
  const [generatingVisual, setGeneratingVisual] = useState(false);
  const [visualNote, setVisualNote] = useState<string | null>(null);

  // Check for external URLs in body
  const bodyHasExternalUrl = useMemo(() => {
    return /https?:\/\/\S+/i.test(linkedInBody);
  }, [linkedInBody]);

  // Dynamically generate 5-slide carousel directly from the current edited hook & body paragraphs
  const carouselSlides = useMemo(() => {
    const cleanParagraphs = linkedInBody
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    // Filter out duplicated hook if user typed it in body
    const bodyParas = cleanParagraphs.filter(
      (p) => p.toLowerCase() !== linkedInHook.trim().toLowerCase()
    );

    const pickPara = (idx: number, fallback: string) => {
      if (bodyParas[idx]) {
        const text = bodyParas[idx];
        return text.length > 180 ? `${text.slice(0, 177)}…` : text;
      }
      return fallback;
    };

    const extractShortTitle = (text: string, fallback: string) => {
      if (!text) return fallback;
      const firstSentence = text.split(/[.!?]/)[0]?.trim() || text;
      return firstSentence.length > 48 ? `${firstSentence.slice(0, 45)}…` : firstSentence;
    };

    const p0 = pickPara(0, blocks[0]?.audio_voiceover || "Contexto inicial del problema o aprendizaje.");
    const p1 = pickPara(1, blocks[1]?.audio_voiceover || "El punto de inflexión y la decisión tomada.");
    const p2 = pickPara(2, blocks[2]?.audio_voiceover || "La solución práctica o proyecto actual.");
    const pLast = bodyParas.length > 3
      ? bodyParas[bodyParas.length - 1]
      : "Déjame tu opinión en comentarios o escríbeme por mensaje directo.";

    return [
      {
        num: 1,
        title: linkedInHook || projectTitle || "Portada de la Publicación",
        type: "PORTADA",
        desc: "Gancho de apertura visible en el feed. Diseñado para detener el scroll.",
      },
      {
        num: 2,
        title: extractShortTitle(p0, "Contexto"),
        type: "CONTEXTO",
        desc: p0,
      },
      {
        num: 3,
        title: extractShortTitle(p1, "Aprendizaje"),
        type: "CLAVE",
        desc: p1,
      },
      {
        num: 4,
        title: extractShortTitle(p2, "Propuesta"),
        type: "SOLUCIÓN",
        desc: p2,
      },
      {
        num: 5,
        title: "¿Hablamos?",
        type: "CTA FINAL",
        desc: pLast.length > 180 ? `${pLast.slice(0, 177)}…` : pLast,
      },
    ];
  }, [linkedInHook, linkedInBody, projectTitle, blocks]);

  const [activeSlide, setActiveSlide] = useState(0);

  const handleGenerateVisual = async () => {
    setGeneratingVisual(true);
    setVisualNote(null);
    try {
      const res = await apiClient.generateSocialVisual({
        title: linkedInHook || projectTitle,
        body: linkedInBody,
        visual_type: visualType,
        provider: visualProvider,
        prompt: visualPrompt.trim() || undefined,
        author_name: authorName,
      });
      onUpdateVisualAssetUrl(res.image_url);
      setVisualNote(res.note);
      await onSave("IMAGE_INFOGRAPHIC", res.image_url);
    } catch {
      setVisualNote("No se pudo conectar con el servidor para generar el visual.");
    } finally {
      setGeneratingVisual(false);
    }
  };

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
              Borrador LinkedIn (Edición, Formato Visual &amp; Zero-Link)
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono text-[11px] font-semibold">
              {assetCode} · Hook &lt;135c · Sin enlaces en cuerpo
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Edita tu publicación a tu tono natural, guarda los cambios y elige el formato visual (Carrusel PDF, Imagen/Infografía o Solo Texto).
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
            Regenerar Borrador
          </button>

          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 text-xs font-bold transition shadow"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Guardando..." : "Guardar Cambios"}
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

        {/* Right: Visual Companion Selector (Carrusel PDF / Imagen o Infografía / Sin Imagen) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#07090e] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
            {/* Visual Mode Selector Tabs */}
            <div className="space-y-2 border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  Complemento Visual de la Publicación
                </h4>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onChangeVisualMode("CAROUSEL_PDF")}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition ${
                    visualMode === "CAROUSEL_PDF"
                      ? "bg-sky-500/20 border-sky-400 text-sky-200 shadow-sm"
                      : "bg-[#020306] border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Carrusel PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeVisualMode("IMAGE_INFOGRAPHIC")}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition ${
                    visualMode === "IMAGE_INFOGRAPHIC"
                      ? "bg-violet-500/20 border-violet-400 text-violet-200 shadow-sm"
                      : "bg-[#020306] border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Imagen / Infografía</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeVisualMode("NONE")}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition ${
                    visualMode === "NONE"
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-sm"
                      : "bg-[#020306] border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <MessageSquareOff className="w-3.5 h-3.5" />
                  <span>Sin Imagen</span>
                </button>
              </div>
            </div>

            {/* MODE 1: CAROUSEL PDF */}
            {visualMode === "CAROUSEL_PDF" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-400">
                    Sincronizado automáticamente con tu <strong>Gancho</strong> y <strong>Cuerpo Estructurado</strong> actual (5 slides).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const carouselText = carouselSlides
                        .map((s) => `[SLIDE ${s.num}: ${s.type}]\n${s.title}\n${s.desc}`)
                        .join("\n\n");
                      void onCopy("li-carousel-text", carouselText, "Estructura del Carrusel");
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 text-xs font-semibold transition shrink-0"
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
                  <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-[#020306] via-[#090d18] to-slate-900 p-6 flex flex-col justify-between min-h-[250px] shadow-lg">
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
                      <span>{authorName} · KigalContent</span>
                      <span>Desliza para ver más →</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODE 2: IMAGE OR INFOGRAPHIC */}
            {visualMode === "IMAGE_INFOGRAPHIC" && (
              <div className="space-y-3.5">
                <div className="grid sm:grid-cols-2 gap-2">
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Tipo de Visual
                    <select
                      value={visualType}
                      onChange={(e) => setVisualType(e.target.value as "INFOGRAPHIC" | "IMAGE")}
                      className="mt-1 w-full rounded-lg bg-[#020306] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="INFOGRAPHIC">📊 Infografía Estructurada</option>
                      <option value="IMAGE">🖼️ Imagen Editorial</option>
                    </select>
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Motor / Conector Visual
                    <select
                      value={visualProvider}
                      onChange={(e) => setVisualProvider(e.target.value as "svg_local" | "nano_banana" | "gpt_images")}
                      className="mt-1 w-full rounded-lg bg-[#020306] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="svg_local">⚡ Infografía Instantánea (Nativa SVG)</option>
                      <option value="nano_banana">🍌 Nano Banana (Google Gemini Imagen)</option>
                      <option value="gpt_images">🎨 GPT Images (OpenAI DALL-E / GPT-Image)</option>
                    </select>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Instrucción Visual (Opcional — si lo dejas vacío usa tu borrador actual)
                  </label>
                  <input
                    type="text"
                    value={visualPrompt}
                    onChange={(e) => setVisualPrompt(e.target.value)}
                    placeholder="Ej. Infografía limpia fondo oscuro comparando métricas vacías vs engagement real..."
                    className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleGenerateVisual()}
                    disabled={generatingVisual}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white text-xs font-bold transition shadow disabled:opacity-50"
                  >
                    {generatingVisual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>{generatingVisual ? "Generando Visual..." : "✨ Generar Imagen / Infografía"}</span>
                  </button>

                  <a
                    href="https://www.canva.com/create/linkedin-posts/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:border-cyan-400 text-xs font-semibold text-slate-200 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                    Abrir en Canva
                  </a>

                  {visualAssetUrl && (
                    <a
                      href={visualAssetUrl}
                      download={`${assetCode}_linkedin_visual.svg`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-semibold text-emerald-300 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar
                    </a>
                  )}
                </div>

                {visualNote && (
                  <p className="text-[11px] text-cyan-300 bg-cyan-950/30 border border-cyan-500/30 rounded-lg px-2.5 py-1.5">
                    {visualNote}
                  </p>
                )}

                {visualAssetUrl ? (
                  <div className="rounded-xl border border-slate-700 bg-[#020306] p-2 overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={visualAssetUrl}
                      alt="Vista previa visual LinkedIn"
                      className="max-h-[340px] w-auto rounded-lg object-contain"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-[#020306] p-8 text-center text-xs text-slate-500">
                    Haz clic en <strong>&ldquo;✨ Generar Imagen / Infografía&rdquo;</strong> para crear el gráfico directamente a partir del texto de tu publicación.
                  </div>
                )}
              </div>
            )}

            {/* MODE 3: NO IMAGE (PURE TEXT) */}
            {visualMode === "NONE" && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/15 p-5 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Publicación Solo Texto (Sin Imagen ni Carrusel)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Excelente elección para publicaciones personales, reflexiones honestas o anuncios de etapa profesional. En LinkedIn, los posts de texto puro sin enlaces salientes suelen generar un ratio más alto de comentarios y conversación directa porque se leen como una nota auténtica y no como un anuncio.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
