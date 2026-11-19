"use client";

import React, { useState } from "react";
import { Bold, Eraser, Italic, Smile } from "lucide-react";
import {
  applyUnicodeStyle,
  EMOJI_CATEGORIES,
  stripUnicodeFormatting,
} from "@/lib/unicodeFormat";

interface RichTextToolbarProps {
  value: string;
  onChange: (nextValue: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  compact?: boolean;
}

export function RichTextToolbar({
  value,
  onChange,
  inputRef,
  compact = false,
}: RichTextToolbarProps) {
  const [showEmojis, setShowEmojis] = useState(false);

  const transformSelection = (
    transformer: (selected: string) => string,
    fallbackText?: string
  ) => {
    const el = inputRef.current;
    if (!el) {
      if (fallbackText) onChange(value + fallbackText);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;

    if (start === end) {
      if (fallbackText) {
        const next = value.slice(0, start) + fallbackText + value.slice(end);
        onChange(next);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start + fallbackText.length, start + fallbackText.length);
        });
      }
      return;
    }

    const selected = value.slice(start, end);
    const transformed = transformer(selected);
    const next = value.slice(0, start) + transformed + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + transformed.length);
    });
  };

  const insertAtCursor = (snippet: string) => {
    const el = inputRef.current;
    if (!el) {
      onChange(value + snippet);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + snippet + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  };

  return (
    <div className="relative flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#04060c] px-2 py-1">
      <button
        type="button"
        onClick={() => transformSelection((s) => applyUnicodeStyle(s, "bold"))}
        title="Negrita compatible con LinkedIn y X (selecciona primero el texto)"
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800 hover:text-cyan-300 transition"
      >
        <Bold className="w-3.5 h-3.5" />
        {!compact && <span className="hidden sm:inline">Negrita</span>}
      </button>

      <button
        type="button"
        onClick={() => transformSelection((s) => applyUnicodeStyle(s, "italic"))}
        title="Cursiva compatible con LinkedIn y X (selecciona primero el texto)"
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] italic text-slate-200 hover:bg-slate-800 hover:text-cyan-300 transition"
      >
        <Italic className="w-3.5 h-3.5" />
        {!compact && <span className="hidden sm:inline">Cursiva</span>}
      </button>

      <button
        type="button"
        onClick={() => transformSelection((s) => stripUnicodeFormatting(s))}
        title="Quitar formato Unicode al texto seleccionado"
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-white transition"
      >
        <Eraser className="w-3.5 h-3.5" />
        {!compact && <span className="hidden md:inline">Normal</span>}
      </button>

      <span className="h-4 w-px bg-slate-800 mx-0.5" aria-hidden="true" />

      {!compact && (
        <>
          <button
            type="button"
            onClick={() => insertAtCursor("• ")}
            title="Insertar viñeta"
            className="rounded px-1.5 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-800 hover:text-cyan-300 transition"
          >
            • Lista
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("→ ")}
            title="Insertar flecha"
            className="rounded px-1.5 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-800 hover:text-cyan-300 transition"
          >
            → Punto
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("✅ ")}
            title="Insertar check"
            className="rounded px-1.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-emerald-300 transition"
          >
            ✅
          </button>
          <span className="h-4 w-px bg-slate-800 mx-0.5" aria-hidden="true" />
        </>
      )}

      <button
        type="button"
        onClick={() => setShowEmojis((v) => !v)}
        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition ${
          showEmojis
            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
            : "text-amber-300 hover:bg-slate-800"
        }`}
        title="Abrir selector de emojis"
      >
        <Smile className="w-3.5 h-3.5" />
        <span>Emojis</span>
      </button>

      {showEmojis && (
        <div className="absolute left-0 top-full mt-1.5 z-40 w-72 rounded-xl border border-slate-700 bg-[#0b101d] p-3 shadow-2xl space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-[11px] font-bold text-slate-200">
              Insertar Emoji en el cursor
            </span>
            <button
              type="button"
              onClick={() => setShowEmojis(false)}
              className="text-[10px] text-slate-400 hover:text-white"
            >
              Cerrar
            </button>
          </div>
          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.label} className="space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 block">
                {cat.label}
              </span>
              <div className="flex flex-wrap gap-1">
                {cat.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      insertAtCursor(`${emoji} `);
                      setShowEmojis(false);
                    }}
                    className="h-7 w-7 rounded-lg bg-[#04060c] hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 flex items-center justify-center text-sm transition"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
