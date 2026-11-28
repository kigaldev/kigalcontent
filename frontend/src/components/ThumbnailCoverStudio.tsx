"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Image as ImageIcon,
  Layers,
  Loader2,
  Monitor,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import type { ABPackagingVariant } from "@/types/engine";

interface ThumbnailCoverStudioProps {
  assetCode: string;
  projectTitle: string;
  abVariants: ABPackagingVariant[];
}

type FormatAspect = "9:16" | "16:9";
type TemplatePreset = "impact-yellow" | "cyber-cyan" | "editorial-clean" | "vs-split";

const TEMPLATE_META: Record<
  TemplatePreset,
  { name: string; desc: string; swatch: string }
> = {
  "impact-yellow": {
    name: "Alto Impacto",
    desc: "Amarillo + blanco sobre fondo oscuro dramático",
    swatch: "from-zinc-900 via-slate-900 to-amber-500/30 border-amber-400/60",
  },
  "cyber-cyan": {
    name: "Autoridad Tech",
    desc: "Azul profundo, acento neón y marco limpio",
    swatch: "from-slate-950 via-cyan-950 to-sky-600/30 border-cyan-400/60",
  },
  "editorial-clean": {
    name: "Editorial Clean",
    desc: "Fondo claro tipo revista con titular negro rotundo",
    swatch: "from-slate-100 via-white to-slate-200 border-slate-400",
  },
  "vs-split": {
    name: "Contraste A vs B",
    desc: "División cromática para comparativas o mitos",
    swatch: "from-rose-900 via-slate-950 to-emerald-800 border-rose-400/60",
  },
};

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = `${currentLine} ${words[i]}`;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function ThumbnailCoverStudio({
  assetCode,
  projectTitle,
  abVariants,
}: ThumbnailCoverStudioProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aspect, setAspect] = useState<FormatAspect>("9:16");
  const [template, setTemplate] = useState<TemplatePreset>("impact-yellow");
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number>(0);

  const [badgeText, setBadgeText] = useState("GUÍA PRÁCTICA");
  const [headline, setHeadline] = useState(
    abVariants[0]?.title || projectTitle || "El Error #1 Que Frena Tu Crecimiento"
  );
  const [subtitle, setSubtitle] = useState(
    abVariants[0]?.thumbnail_concept || "Paso a paso comprobado sin complicarte"
  );
  const [bgDimming, setBgDimming] = useState(55);
  const [showInstagramFeedGuide, setShowInstagramFeedGuide] = useState(true);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgFileName, setBgFileName] = useState<string | null>(null);
  const [generatingBg, setGeneratingBg] = useState(false);
  const [bgGenNotice, setBgGenNotice] = useState<string | null>(null);

  const width = aspect === "9:16" ? 1080 : 1280;
  const height = aspect === "9:16" ? 1920 : 720;

  const handleLoadVariant = (idx: number) => {
    setSelectedVariantIdx(idx);
    const v = abVariants[idx];
    if (v) {
      setHeadline(v.title);
      setSubtitle(v.thumbnail_concept);
      setBadgeText(`OPCIÓN ${v.variant_label}`);
      if (v.thumbnail_dimensions.includes("1280")) {
        setAspect("16:9");
      }
    }
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => setBgImage(img);
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateZImageBg = async () => {
    setGeneratingBg(true);
    setBgGenNotice(null);
    try {
      const genW = aspect === "9:16" ? 576 : 960;
      const genH = aspect === "9:16" ? 1024 : 576;
      const prompt = `Cinematic editorial background image without any text, letters or watermarks, modern tech & business studio aesthetic, dramatic lighting, topic: ${headline}. ${subtitle}`;
      const res = await apiClient.generateSocialVisual({
        title: headline,
        body: subtitle,
        visual_type: "IMAGE",
        provider: "z_image",
        prompt,
        width: genW,
        height: genH,
        steps: 8,
      });
      const img = new Image();
      img.onload = () => {
        setBgImage(img);
        setBgFileName(`zimage_${assetCode}.png`);
      };
      img.src = res.image_url;
      setBgGenNotice(res.note);
    } catch (err) {
      setBgGenNotice(
        err instanceof Error ? err.message : "No se pudo generar el fondo con Z-Image-Turbo."
      );
    } finally {
      setGeneratingBg(false);
    }
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = width;
    const H = height;
    const isVertical = aspect === "9:16";

    ctx.clearRect(0, 0, W, H);

    // 1. Background Template Layer
    if (template === "editorial-clean") {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "#f8fafc");
      grad.addColorStop(1, "#e2e8f0");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (template === "cyber-cyan") {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "#020617");
      grad.addColorStop(0.55, "#082f49");
      grad.addColorStop(1, "#0f172a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Subtle glow orb
      const rad = ctx.createRadialGradient(W * 0.5, H * 0.35, 20, W * 0.5, H * 0.35, W * 0.65);
      rad.addColorStop(0, "rgba(34, 211, 238, 0.28)");
      rad.addColorStop(1, "rgba(34, 211, 238, 0)");
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, W, H);
    } else if (template === "vs-split") {
      ctx.fillStyle = "#450a0a";
      ctx.fillRect(0, 0, isVertical ? W : W / 2, isVertical ? H / 2 : H);
      ctx.fillStyle = "#022c22";
      ctx.fillRect(
        isVertical ? 0 : W / 2,
        isVertical ? H / 2 : 0,
        isVertical ? W : W / 2,
        isVertical ? H / 2 : H
      );
      // Divider bar
      ctx.fillStyle = "#facc15";
      if (isVertical) {
        ctx.fillRect(0, H / 2 - 5, W, 10);
      } else {
        ctx.fillRect(W / 2 - 5, 0, 10, H);
      }
    } else {
      // impact-yellow
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#09090b");
      grad.addColorStop(0.6, "#18181b");
      grad.addColorStop(1, "#020617");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Optional User Background Photo (object-fit: cover)
    if (bgImage) {
      const imgRatio = bgImage.width / bgImage.height;
      const canvasRatio = W / H;
      let drawW = W;
      let drawH = H;
      let offsetX = 0;
      let offsetY = 0;

      if (imgRatio > canvasRatio) {
        drawH = H;
        drawW = H * imgRatio;
        offsetX = -(drawW - W) / 2;
      } else {
        drawW = W;
        drawH = W / imgRatio;
        offsetY = -(drawH - H) / 2;
      }

      ctx.drawImage(bgImage, offsetX, offsetY, drawW, drawH);

      // Contrast scrim overlay
      const alpha = Math.min(0.92, Math.max(0.1, bgDimming / 100));
      ctx.fillStyle =
        template === "editorial-clean"
          ? `rgba(248, 250, 252, ${alpha})`
          : `rgba(2, 6, 23, ${alpha})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 3. Subtle Grid / Accent Border
    ctx.strokeStyle =
      template === "editorial-clean"
        ? "rgba(15, 23, 42, 0.12)"
        : "rgba(34, 211, 238, 0.25)";
    ctx.lineWidth = isVertical ? 8 : 6;
    ctx.strokeRect(isVertical ? 36 : 24, isVertical ? 36 : 24, W - (isVertical ? 72 : 48), H - (isVertical ? 72 : 48));

    // Safe vertical anchor (keep inside Instagram 4:5 crop in center of 9:16)
    const contentTopY = isVertical ? H * 0.28 : H * 0.14;
    const maxTextWidth = isVertical ? W - 150 : W - 180;
    const centerX = W / 2;

    // 4. Top Badge Pill
    let cursorY = contentTopY;
    if (badgeText.trim()) {
      const badgeFontSize = isVertical ? 38 : 28;
      ctx.font = `900 ${badgeFontSize}px system-ui, -apple-system, sans-serif`;
      const textMetrics = ctx.measureText(badgeText.toUpperCase());
      const pillW = Math.min(maxTextWidth, textMetrics.width + 64);
      const pillH = isVertical ? 74 : 56;
      const pillX = centerX - pillW / 2;

      if (template === "impact-yellow") {
        ctx.fillStyle = "#ef4444";
      } else if (template === "cyber-cyan") {
        ctx.fillStyle = "#06b6d4";
      } else if (template === "editorial-clean") {
        ctx.fillStyle = "#0f172a";
      } else {
        ctx.fillStyle = "#facc15";
      }

      drawRoundRect(ctx, pillX, cursorY, pillW, pillH, 16);
      ctx.fill();

      ctx.fillStyle =
        template === "cyber-cyan" || template === "vs-split" ? "#020617" : "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badgeText.toUpperCase(), centerX, cursorY + pillH / 2 + 2);
      cursorY += pillH + (isVertical ? 64 : 38);
    }

    // 5. Main Headline (Multi-line with punchy shadow / highlight)
    const headlineSize = isVertical ? 96 : 74;
    ctx.font = `900 ${headlineSize}px system-ui, -apple-system, sans-serif`;
    const headlineLines = wrapCanvasLines(ctx, headline || projectTitle, maxTextWidth).slice(0, 5);

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const lineHeight = headlineSize * 1.15;

    headlineLines.forEach((line, i) => {
      const isHighlightLine = i === headlineLines.length - 1 || i === 0;
      if (template === "editorial-clean") {
        ctx.fillStyle = i === headlineLines.length - 1 ? "#0284c7" : "#0f172a";
        ctx.shadowColor = "transparent";
      } else if (template === "impact-yellow") {
        ctx.fillStyle = isHighlightLine ? "#facc15" : "#ffffff";
        ctx.shadowColor = "rgba(0,0,0,0.85)";
        ctx.shadowBlur = 18;
      } else if (template === "cyber-cyan") {
        ctx.fillStyle = isHighlightLine ? "#22d3ee" : "#ffffff";
        ctx.shadowColor = "rgba(8, 145, 178, 0.65)";
        ctx.shadowBlur = 22;
      } else {
        ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#fde047";
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 18;
      }

      ctx.fillText(line.toUpperCase(), centerX, cursorY);
      cursorY += lineHeight;
    });

    ctx.shadowBlur = 0;
    cursorY += isVertical ? 48 : 28;

    // 6. Subtitle / Concept Box
    if (subtitle.trim()) {
      const subSize = isVertical ? 44 : 30;
      ctx.font = `600 ${subSize}px system-ui, -apple-system, sans-serif`;
      const subLines = wrapCanvasLines(ctx, subtitle, maxTextWidth - 60).slice(0, 3);
      const boxH = subLines.length * (subSize * 1.35) + 44;
      const boxW = maxTextWidth;
      const boxX = centerX - boxW / 2;

      ctx.fillStyle =
        template === "editorial-clean"
          ? "rgba(15, 23, 42, 0.08)"
          : "rgba(15, 23, 42, 0.72)";
      drawRoundRect(ctx, boxX, cursorY, boxW, boxH, 24);
      ctx.fill();

      ctx.strokeStyle =
        template === "editorial-clean"
          ? "rgba(15, 23, 42, 0.15)"
          : "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = template === "editorial-clean" ? "#1e293b" : "#e2e8f0";
      subLines.forEach((sLine, idx) => {
        ctx.fillText(sLine, centerX, cursorY + 24 + idx * (subSize * 1.35));
      });
    }

    // 7. Subtle Asset Watermark Footer (above safe bottom zone)
    ctx.font = `700 ${isVertical ? 26 : 20}px monospace`;
    ctx.fillStyle =
      template === "editorial-clean"
        ? "rgba(15, 23, 42, 0.45)"
        : "rgba(255, 255, 255, 0.45)";
    ctx.fillText(`${assetCode} · STUDIO COVER`, centerX, H - (isVertical ? 260 : 54));
  }, [width, height, aspect, template, badgeText, headline, subtitle, projectTitle, bgImage, bgDimming, assetCode]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${assetCode.toLowerCase()}-portada-${aspect.replace(":", "x")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-cyan-400" />
            Estudio Generador de Miniaturas y Portadas (Canvas HD)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Diseña y descarga tu carátula vertical 9:16 (Reels/TikTok/Shorts) o miniatura 16:9 (YouTube) con zonas seguras reales.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadPng}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-sm"
        >
          <Download className="w-4 h-4" />
          Descargar PNG ({width}×{height})
        </button>
      </div>

      {/* Interactive Split: Controls Left + Real-Time Canvas Preview Right */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-7 space-y-4">
          {/* Format + Variant Loaders */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="block text-[11px] font-semibold text-slate-300">
                1. Formato de Salida
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAspect("9:16")}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                    aspect === "9:16"
                      ? "bg-cyan-500/15 border-cyan-400 text-cyan-200"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  9:16 Vertical
                </button>
                <button
                  type="button"
                  onClick={() => setAspect("16:9")}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                    aspect === "16:9"
                      ? "bg-cyan-500/15 border-cyan-400 text-cyan-200"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  16:9 YouTube
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-[11px] font-semibold text-slate-300">
                2. Cargar Variante A / B del Guión
              </span>
              <div className="grid grid-cols-2 gap-2">
                {abVariants.slice(0, 2).map((v, idx) => (
                  <button
                    key={v.variant_label}
                    type="button"
                    onClick={() => handleLoadVariant(idx)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                      selectedVariantIdx === idx
                        ? "bg-violet-500/20 border-violet-400 text-violet-200"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Usar Opción {v.variant_label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4 CTR Style Presets */}
          <div className="space-y-1.5">
            <span className="block text-[11px] font-semibold text-slate-300">
              3. Estilo Visual de Portada
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(TEMPLATE_META) as TemplatePreset[]).map((key) => {
                const meta = TEMPLATE_META[key];
                const active = template === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTemplate(key)}
                    className={`text-left rounded-xl border p-2.5 transition bg-gradient-to-br ${
                      meta.swatch
                    } ${active ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900" : "opacity-80 hover:opacity-100"}`}
                  >
                    <div
                      className={`text-xs font-bold ${
                        key === "editorial-clean" ? "text-slate-900" : "text-white"
                      }`}
                    >
                      {meta.name}
                    </div>
                    <div
                      className={`text-[10px] leading-tight mt-0.5 ${
                        key === "editorial-clean" ? "text-slate-600" : "text-slate-300"
                      }`}
                    >
                      {meta.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text Fields */}
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-xs text-slate-300">
              Etiqueta Superior
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder="Ej. NUEVO MÉTODO"
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
              />
            </label>
            <label className="text-xs text-slate-300 sm:col-span-2">
              Titular Grande en Portada
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Titular corto de máximo 5-6 palabras"
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white font-semibold focus:border-cyan-400 focus:outline-none"
              />
            </label>
          </div>

          <label className="block text-xs text-slate-300">
            Subtítulo / Gancho Secundario
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Ej. Cómo ahorrar 10h a la semana sin pagar suscripciones"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
            />
          </label>

          {/* Optional Background Image + Dark Scrim */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Layers className="w-4 h-4 text-cyan-400" />
                Foto o Fotograma de Fondo (Opcional)
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadImage}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {bgFileName ? "Cambiar Imagen" : "Subir Foto"}
                </button>
                <button
                  type="button"
                  disabled={generatingBg}
                  onClick={() => void handleGenerateZImageBg()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/45 text-xs font-bold text-cyan-200 transition disabled:opacity-50"
                  title="Genera un fondo personalizado con Z-Image-Turbo en tu MiniPC (0 €)"
                >
                  {generatingBg ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{generatingBg ? "Generando fondo..." : "Fondo IA (Z-Image)"}</span>
                </button>
                {bgImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setBgImage(null);
                      setBgFileName(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Quitar
                  </button>
                )}
              </div>
            </div>

            {bgGenNotice && (
              <p className="text-[11px] text-cyan-200 bg-cyan-950/35 border border-cyan-400/30 rounded-lg px-2.5 py-1.5">
                {bgGenNotice}
              </p>
            )}

            {bgImage && (
              <label className="block text-[11px] text-slate-400">
                Oscurecimiento de contraste ({bgDimming}%)
                <input
                  type="range"
                  min={15}
                  max={90}
                  value={bgDimming}
                  onChange={(e) => setBgDimming(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </label>
            )}

            {aspect === "9:16" && (
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={showInstagramFeedGuide}
                  onChange={(e) => setShowInstagramFeedGuide(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500"
                />
                <span>
                  Mostrar guía de recorte <strong>4:5 del Feed de Instagram</strong> (no se incluye en la descarga)
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Live Canvas Preview Column */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-950/70 border border-slate-800 rounded-xl p-4">
          <div className="relative inline-flex items-center justify-center max-w-full">
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className={`rounded-xl border border-slate-700 shadow-2xl bg-black ${
                aspect === "9:16" ? "w-[240px] h-[426px]" : "w-full max-w-[440px] aspect-video"
              }`}
            />

            {/* CSS Overlay showing exact 4:5 Feed Safe Crop inside 9:16 */}
            {aspect === "9:16" && showInstagramFeedGuide && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[70.3%] border-y-2 border-dashed border-amber-400/80 bg-amber-400/[0.03] flex items-end justify-center pb-1.5"
              >
                <span className="px-2 py-0.5 rounded bg-slate-950/90 text-[10px] font-bold text-amber-300 border border-amber-400/40">
                  Zona Visible en Grid 4:5 Instagram
                </span>
              </div>
            )}
          </div>
          <span className="mt-2 text-[11px] font-mono text-slate-400">
            Resolución real al descargar: {width} × {height} px (PNG)
          </span>
        </div>
      </div>
    </div>
  );
}
