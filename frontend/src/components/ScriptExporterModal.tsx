"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileCode2,
  FileText,
  Printer,
  Subtitles,
  X,
} from "lucide-react";
import type {
  ABPackagingVariant,
  DurationPreset,
  TwoColumnScriptBlock,
} from "@/types/engine";
import { DURATION_PRESET_META } from "@/lib/utils";

interface ScriptExporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetCode: string;
  title: string;
  preset: DurationPreset;
  wpm: number;
  blocks: TwoColumnScriptBlock[];
  selectedHookText?: string;
  ctaText?: string;
  abVariants?: ABPackagingVariant[];
}

type ExportTab = "pdf" | "markdown" | "voice_srt";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatSrtTime(totalSeconds: number): string {
  const msTotal = Math.max(0, Math.round(totalSeconds * 1000));
  const hours = Math.floor(msTotal / 3_600_000);
  const minutes = Math.floor((msTotal % 3_600_000) / 60_000);
  const seconds = Math.floor((msTotal % 60_000) / 1000);
  const ms = msTotal % 1000;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")},${ms
    .toString()
    .padStart(3, "0")}`;
}

function downloadBlobFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ScriptExporterModal({
  isOpen,
  onClose,
  assetCode,
  title,
  preset,
  wpm,
  blocks,
  selectedHookText,
  ctaText,
  abVariants = [],
}: ScriptExporterModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeOption, setActiveOption] = useState<ExportTab>("pdf");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const safeSlug = useMemo(() => {
    const clean = `${assetCode}_${title}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return clean || "guion-produccion";
  }, [assetCode, title]);

  const totalWords = useMemo(
    () => blocks.reduce((acc, b) => acc + (b.word_count || 0), 0),
    [blocks]
  );
  const totalSec = useMemo(
    () => Math.round(blocks.reduce((acc, b) => acc + (b.estimated_seconds || 0), 0)),
    [blocks]
  );

  // Opción 1: HTML imprimible / PDF
  const printableHtml = useMemo(() => {
    const rowsHtml = blocks
      .map(
        (b) => `
      <tr>
        <td class="col-scene">
          <strong>${escapeHtml(b.section_label)}</strong><br/>
          <span class="mono">${escapeHtml(b.timecode)}</span><br/>
          <small>${b.word_count} pal. · ${b.estimated_seconds}s</small>
        </td>
        <td class="col-visual">
          <div>${escapeHtml(b.visual_direction)}</div>
          ${b.b_roll_cue ? `<div class="tag">B-Roll: ${escapeHtml(b.b_roll_cue)}</div>` : ""}
          ${b.on_screen_text ? `<div class="tag-text">Texto pantalla: ${escapeHtml(b.on_screen_text)}</div>` : ""}
        </td>
        <td class="col-audio">
          <div class="voice">${escapeHtml(b.audio_voiceover)}</div>
          <div class="cues">
            ${b.sfx_cue ? `<span>SFX: ${escapeHtml(b.sfx_cue)}</span>` : ""}
            ${b.music_cue ? `<span>Música: ${escapeHtml(b.music_cue)}</span>` : ""}
          </div>
        </td>
      </tr>`
      )
      .join("\n");

    const variantsHtml =
      abVariants.length > 0
        ? `<div class="box">
            <h3>Variantes A/B de Portada y Título</h3>
            <ul>
              ${abVariants
                .map(
                  (v) =>
                    `<li><strong>Opción ${escapeHtml(v.variant_label)}:</strong> ${escapeHtml(
                      v.title
                    )} — <em>${escapeHtml(v.thumbnail_concept)}</em></li>`
                )
                .join("")}
            </ul>
          </div>`
        : "";

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Escaleta de Rodaje · ${escapeHtml(assetCode)} — ${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 28px; line-height: 1.45; }
    header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
    h1 { margin: 0; font-size: 20px; color: #0f172a; }
    .meta { font-size: 12px; color: #475569; margin-top: 4px; }
    .badge { background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 6px; font-family: monospace; }
    .box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; font-size: 13px; }
    .box h3 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; color: #0369a1; letter-spacing: 0.04em; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px; vertical-align: top; text-align: left; }
    th { background: #0f172a; color: #ffffff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    .col-scene { width: 17%; background: #f8fafc; }
    .col-visual { width: 38%; }
    .col-audio { width: 45%; }
    .mono { font-family: monospace; color: #0284c7; font-size: 11px; }
    .tag { margin-top: 6px; font-size: 11px; color: #334155; background: #e2e8f0; display: inline-block; padding: 2px 6px; border-radius: 4px; }
    .tag-text { margin-top: 4px; font-size: 11px; font-weight: 700; color: #b45309; background: #fef3c7; display: block; padding: 3px 6px; border-radius: 4px; }
    .voice { font-size: 14px; color: #0f172a; white-space: pre-wrap; }
    .cues { margin-top: 8px; font-size: 11px; color: #475569; display: flex; gap: 12px; flex-wrap: wrap; }
    @media print {
      body { margin: 12px; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">Formato: ${escapeHtml(
        DURATION_PRESET_META[preset].label
      )} · Ritmo: ${wpm} WPM · ${totalWords} palabras · Duración est: ${totalSec}s</div>
    </div>
    <span class="badge">${escapeHtml(assetCode)}</span>
  </header>
  ${
    selectedHookText
      ? `<div class="box"><h3>Gancho Inicial (Primeros 3s)</h3><div>${escapeHtml(selectedHookText)}</div></div>`
      : ""
  }
  <table>
    <thead>
      <tr>
        <th>Escena</th>
        <th>Visual / B-Roll / Texto</th>
        <th>Locución de Voz y Audio</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  ${
    ctaText
      ? `<div class="box" style="margin-top:14px;"><h3>Cierre y Llamada a la Acción (CTA)</h3><div>${escapeHtml(
          ctaText
        )}</div></div>`
      : ""
  }
  ${variantsHtml}
</body>
</html>`;
  }, [assetCode, title, preset, wpm, totalWords, totalSec, blocks, selectedHookText, ctaText, abVariants]);

  // Opción 2: Markdown / Notion / Google Docs
  const markdownDoc = useMemo(() => {
    const lines: string[] = [
      `# ${assetCode} — ${title}`,
      "",
      `- **Formato:** ${DURATION_PRESET_META[preset].label}`,
      `- **Velocidad objetivo:** ${wpm} palabras/minuto`,
      `- **Presupuesto:** ${totalWords} palabras (~${totalSec} segundos)`,
      "",
    ];

    if (selectedHookText) {
      lines.push(`> **Gancho seleccionado:** ${selectedHookText}`, "");
    }

    lines.push(
      "## Escaleta de Guión Audiovisual",
      "",
      "| Escena & Tiempo | Visual / B-Roll / Texto | Locución de Voz |",
      "| :--- | :--- | :--- |"
    );

    blocks.forEach((b) => {
      const visualParts = [
        b.visual_direction,
        b.b_roll_cue ? `**B-Roll:** ${b.b_roll_cue}` : "",
        b.on_screen_text ? `**En pantalla:** \`${b.on_screen_text}\`` : "",
      ]
        .filter(Boolean)
        .join("<br/>")
        .replaceAll("|", "\\|");

      const audioParts = [
        b.audio_voiceover,
        b.sfx_cue ? `_SFX: ${b.sfx_cue}_` : "",
        b.music_cue ? `_Música: ${b.music_cue}_` : "",
      ]
        .filter(Boolean)
        .join("<br/>")
        .replaceAll("|", "\\|");

      lines.push(
        `| **${b.section_label.replaceAll("|", "\\|")}**<br/>\`${b.timecode}\` (${b.word_count} pal.) | ${visualParts} | ${audioParts} |`
      );
    });

    if (ctaText) {
      lines.push("", "## Llamada a la Acción (CTA)", "", `> ${ctaText}`);
    }

    lines.push("", "## Checklist de B-Roll para Rodaje", "");
    blocks.forEach((b) => {
      if (b.b_roll_cue) {
        lines.push(`- [ ] **[${b.section_label}]** ${b.b_roll_cue}`);
      }
    });

    if (abVariants.length > 0) {
      lines.push("", "## Variantes A/B de Portada", "");
      abVariants.forEach((v) => {
        lines.push(`- **Opción ${v.variant_label}:** ${v.title} — _${v.thumbnail_concept}_`);
      });
    }

    return lines.join("\n");
  }, [assetCode, title, preset, wpm, totalWords, totalSec, blocks, selectedHookText, ctaText, abVariants]);

  // Opción 3A: Locución limpia (.txt)
  const cleanVoiceTxt = useMemo(() => {
    const header = `${assetCode} — ${title}\nRitmo: ${wpm} WPM | Duración estimada: ${totalSec}s\n${"=".repeat(
      50
    )}\n\n`;
    const body = blocks
      .map((b) => `[${b.section_label.toUpperCase()} · ${b.timecode}]\n${b.audio_voiceover.trim()}\n`)
      .join("\n");
    const footer = ctaText ? `\n[CTA FINAL]\n${ctaText}\n` : "";
    return header + body + footer;
  }, [assetCode, title, wpm, totalSec, blocks, ctaText]);

  // Opción 3B: Subtítulos SRT cronometrados según WPM
  const srtSubtitles = useMemo(() => {
    let cursorSec = 0;
    const entries: string[] = [];
    let index = 1;

    blocks.forEach((b) => {
      const words = b.audio_voiceover.trim().split(/\s+/).filter(Boolean);
      // Split each block into comfortable 7-word caption chunks
      for (let i = 0; i < words.length; i += 7) {
        const chunk = words.slice(i, i + 7);
        const chunkDuration = Math.max(1.2, (chunk.length / Math.max(80, wpm)) * 60);
        const start = cursorSec;
        const end = cursorSec + chunkDuration;
        entries.push(`${index}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${chunk.join(" ")}\n`);
        cursorSec = end;
        index += 1;
      }
    });

    return entries.join("\n");
  }, [blocks, wpm]);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      // Fallback noop if clipboard denied
    }
  };

  const handlePrintPdf = () => {
    const win = window.open("", "_blank", "width=960,height=780");
    if (!win) return;
    win.document.write(printableHtml);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 250);
  };

  return (
    <dialog
      ref={dialogRef}
      className="wide-dialog focus:outline-none overflow-hidden"
      aria-labelledby={titleId}
      onClose={onClose}
    >
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-bold text-white">
                Exportador de Guión y Producción (3 Formatos)
              </h2>
              <p className="text-xs text-slate-400">
                {assetCode} · {title} ({totalWords} palabras · ~{totalSec}s)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Cerrar exportador"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Option Cards Selector */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 grid sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            autoFocus
            onClick={() => setActiveOption("pdf")}
            className={`text-left rounded-xl border p-3 transition ${
              activeOption === "pdf"
                ? "bg-cyan-500/15 border-cyan-400 text-white"
                : "bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs mb-1">
              <Printer className="w-4 h-4 text-cyan-400" />
              1. Escaleta PDF / Imprimible
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Tabla visual AV con tiempos, B-Roll y locución lista para rodar o imprimir.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveOption("markdown")}
            className={`text-left rounded-xl border p-3 transition ${
              activeOption === "markdown"
                ? "bg-violet-500/15 border-violet-400 text-white"
                : "bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs mb-1">
              <FileCode2 className="w-4 h-4 text-violet-400" />
              2. Notion / Docs / Markdown
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Copia y pega directo en Notion, Obsidian o descarga archivo `.md` con checklist.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveOption("voice_srt")}
            className={`text-left rounded-xl border p-3 transition ${
              activeOption === "voice_srt"
                ? "bg-emerald-500/15 border-emerald-400 text-white"
                : "bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs mb-1">
              <Subtitles className="w-4 h-4 text-emerald-400" />
              3. Voz Limpia (.TXT) + .SRT
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Solo texto hablado o archivo de subtítulos `.srt` para CapCut, Premiere o DaVinci.
            </p>
          </button>
        </div>

        {/* Option Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-slate-950/30">
          {activeOption === "pdf" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-4">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Hoja de Rodaje A4 (Audio + Video + Notas)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Genera una versión maquetada con tu gancho, escenas y variantes A/B. Puedes guardarla como PDF desde la ventana de impresión o bajar el HTML autónomo.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handlePrintPdf}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir / Guardar PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadBlobFile(`${safeSlug}-escaleta.html`, printableHtml, "text/html")}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:border-cyan-400 text-xs font-semibold text-slate-200 transition"
                  >
                    <Download className="w-4 h-4" />
                    Descargar .HTML
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-white text-slate-900 p-4 max-h-72 overflow-y-auto text-xs space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <strong className="text-sm">{title}</strong>
                  <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-mono font-bold">
                    {assetCode}
                  </span>
                </div>
                {blocks.map((b) => (
                  <div key={b.block_id} className="grid grid-cols-12 gap-2 border-b border-slate-100 pb-2">
                    <div className="col-span-3 font-semibold text-slate-700">
                      {b.section_label}
                      <div className="text-[10px] font-mono text-sky-600">{b.timecode}</div>
                    </div>
                    <div className="col-span-4 text-slate-600">{b.visual_direction}</div>
                    <div className="col-span-5 text-slate-900 font-medium">{b.audio_voiceover}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeOption === "markdown" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-300">
                  Formato Markdown compatible con <strong>Notion, Google Docs, GitHub y Obsidian</strong>.
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy("md", markdownDoc)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-slate-950 text-xs font-bold transition"
                  >
                    {copiedKey === "md" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedKey === "md" ? "¡Copiado!" : "Copiar para Notion / Docs"}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadBlobFile(`${safeSlug}.md`, markdownDoc, "text/markdown")}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:border-violet-400 text-xs font-semibold text-slate-200 transition"
                  >
                    <Download className="w-4 h-4" />
                    Descargar .MD
                  </button>
                </div>
              </div>
              <pre className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-[11px] font-mono text-slate-200 overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap">
                {markdownDoc}
              </pre>
            </div>
          )}

          {activeOption === "voice_srt" && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    Guion Limpio de Locución (.TXT)
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopy("txt", cleanVoiceTxt)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200"
                    >
                      {copiedKey === "txt" ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadBlobFile(`${safeSlug}-locucion.txt`, cleanVoiceTxt, "text/plain")}
                      className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-bold"
                    >
                      Descargar .TXT
                    </button>
                  </div>
                </div>
                <pre className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-[11px] font-mono text-slate-300 h-56 overflow-y-auto whitespace-pre-wrap">
                  {cleanVoiceTxt}
                </pre>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Subtitles className="w-4 h-4 text-cyan-400" />
                    Subtítulos Cronometrados (.SRT)
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopy("srt", srtSubtitles)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200"
                    >
                      {copiedKey === "srt" ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadBlobFile(`${safeSlug}.srt`, srtSubtitles, "application/x-subrip")}
                      className="px-2.5 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-bold"
                    >
                      Descargar .SRT
                    </button>
                  </div>
                </div>
                <pre className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-[11px] font-mono text-cyan-200 h-56 overflow-y-auto whitespace-pre-wrap">
                  {srtSubtitles}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </dialog>
  );
}
