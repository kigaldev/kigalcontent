"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Eye,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Tv,
  X,
} from "lucide-react";
import type { TwoColumnScriptBlock } from "@/types/engine";

interface TeleprompterModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  assetCode: string;
  blocks: TwoColumnScriptBlock[];
  initialWpm: number;
  selectedHookText?: string;
  ctaText?: string;
}

type ThemeKey = "oled" | "amber" | "studio";
type ReadingWidth = "narrow" | "medium" | "wide";

interface ISpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface ISpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: ISpeechRecognitionAlternative;
}

interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: ISpeechRecognitionResult;
  };
}

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface FlatWord {
  globalIdx: number;
  normalized: string;
  display: string;
  blockIdx: number;
}

const THEME_STYLES: Record<
  ThemeKey,
  { label: string; bgClass: string; textClass: string; cueClass: string; activeWordClass: string }
> = {
  oled: {
    label: "Negro OLED",
    bgClass: "bg-black",
    textClass: "text-white",
    cueClass: "bg-zinc-900/90 border-zinc-700 text-cyan-300",
    activeWordClass: "bg-cyan-400/30 text-cyan-200 rounded px-1",
  },
  amber: {
    label: "Ámbar Nocturno",
    bgClass: "bg-[#0a0700]",
    textClass: "text-amber-200",
    cueClass: "bg-amber-950/70 border-amber-700/60 text-amber-300",
    activeWordClass: "bg-amber-400/30 text-white rounded px-1",
  },
  studio: {
    label: "Cian Estudio",
    bgClass: "bg-[#020617]",
    textClass: "text-slate-100",
    cueClass: "bg-slate-900/90 border-cyan-500/40 text-cyan-300",
    activeWordClass: "bg-cyan-500/35 text-white rounded px-1",
  },
};

const WIDTH_CLASSES: Record<ReadingWidth, { label: string; maxW: string }> = {
  narrow: { label: "Móvil (Estrecho)", maxW: "max-w-lg" },
  medium: { label: "Tablet (Medio)", maxW: "max-w-2xl" },
  wide: { label: "Monitor (Ancho)", maxW: "max-w-4xl" },
};

function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]/gi, "");
}

export function TeleprompterModal({
  isOpen,
  onClose,
  title,
  assetCode,
  blocks,
  initialWpm,
  selectedHookText,
  ctaText,
}: TeleprompterModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const scrollAccumRef = useRef<number>(0);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const wordRefs = useRef<Record<number, HTMLSpanElement | null>>({});

  // Playback & controls state
  const [isPlaying, setIsPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [wpm, setWpm] = useState<number>(initialWpm || 140);
  const [fontSize, setFontSize] = useState<number>(44);
  const [mirrorH, setMirrorH] = useState(false);
  const [mirrorV, setMirrorV] = useState(false);
  const [showEyeline, setShowEyeline] = useState(true);
  const [showCues, setShowCues] = useState(true);
  const [theme, setTheme] = useState<ThemeKey>("oled");
  const [readingWidth, setReadingWidth] = useState<ReadingWidth>("medium");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Voice tracking state (Voumellis/smart-teleprompter & wlphi/prompter pattern)
  const [voiceFollow, setVoiceFollow] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [activeWordIdx, setActiveWordIdx] = useState<number>(-1);

  // Build flat word index across blocks for accurate timing & voice matching
  const { blockWordOffsets, totalWords, flatWordList } = useMemo(() => {
    const words: FlatWord[] = [];
    const offsets: number[] = [];
    let counter = 0;

    blocks.forEach((blk, bIdx) => {
      offsets.push(counter);
      const rawTokens = blk.audio_voiceover.trim().split(/\s+/).filter(Boolean);
      rawTokens.forEach((tok) => {
        words.push({
          globalIdx: counter,
          normalized: normalizeWord(tok),
          display: tok,
          blockIdx: bIdx,
        });
        counter += 1;
      });
    });

    return {
      blockWordOffsets: offsets,
      totalWords: words.length,
      flatWordList: words,
    };
  }, [blocks]);

  const activeWordIdxRef = useRef(-1);
  useEffect(() => {
    activeWordIdxRef.current = activeWordIdx;
  }, [activeWordIdx]);

  // Sync WPM prop when opening
  useEffect(() => {
    if (initialWpm) {
      setWpm(Math.min(260, Math.max(80, initialWpm)));
    }
  }, [initialWpm]);

  // Detect Web Speech API support on client
  useEffect(() => {
    if (typeof window !== "undefined") {
      const win = window as unknown as {
        SpeechRecognition?: new () => ISpeechRecognition;
        webkitSpeechRecognition?: new () => ISpeechRecognition;
      };
      setVoiceSupported(Boolean(win.SpeechRecognition || win.webkitSpeechRecognition));
    }
  }, []);

  // Native <dialog> open/close lifecycle (modern-web-guidance: dialog)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      setIsPlaying(false);
      setCountdown(null);
      setActiveWordIdx(-1);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
        scrollAccumRef.current = 0;
        setScrollProgress(0);
      }
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Stop voice & animation on close or unmount
  const stopVoiceRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors if already ended
      }
      recognitionRef.current = null;
    }
    setVoiceFollow(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      setCountdown(null);
      stopVoiceRecognition();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
  }, [isOpen, stopVoiceRecognition]);

  // Countdown 3-2-1 effect before starting playback
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      setIsPlaying(true);
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((c) => (c !== null ? c - 1 : null));
    }, 900);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Smooth 60fps WPM-calibrated scroll loop
  useEffect(() => {
    if (!isPlaying || voiceFollow) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    scrollAccumRef.current = container.scrollTop;
    lastFrameTimeRef.current = performance.now();

    const step = (now: number) => {
      const dt = Math.min((now - lastFrameTimeRef.current) / 1000, 0.1);
      lastFrameTimeRef.current = now;

      const el = scrollContainerRef.current;
      if (!el) return;

      const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
      // Estimate scroll speed so entire readable text finishes in totalWords / (wpm / 60) seconds
      const estimatedSeconds = Math.max(8, (Math.max(20, totalWords) / wpm) * 60);
      const pxPerSecond = maxScroll / estimatedSeconds;

      // Boost gently if font size is very large
      const adjustedPxPerSec = Math.max(22, pxPerSecond);

      scrollAccumRef.current += adjustedPxPerSec * dt;
      el.scrollTop = scrollAccumRef.current;

      const pct = Math.min(100, Math.round((el.scrollTop / maxScroll) * 100));
      setScrollProgress(pct);

      if (el.scrollTop >= maxScroll - 2) {
        setIsPlaying(false);
        return;
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, voiceFollow, wpm, totalWords, fontSize, readingWidth, showCues]);

  // Voice Recognition handler (lookahead fuzzy progression)
  const toggleVoiceFollow = () => {
    setVoiceError(null);
    if (voiceFollow) {
      stopVoiceRecognition();
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => ISpeechRecognition;
      webkitSpeechRecognition?: new () => ISpeechRecognition;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceError("Tu navegador no soporta seguimiento por voz; usa el scroll WPM automático.");
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "es-ES";

      rec.onresult = (event: ISpeechRecognitionEvent) => {
        let spokenChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          spokenChunk += " " + event.results[i][0].transcript;
        }
        const spokenTokens = spokenChunk
          .trim()
          .split(/\s+/)
          .map(normalizeWord)
          .filter((t) => t.length >= 2);

        if (spokenTokens.length === 0) return;

        // Lookahead 16 words from current position
        const current = activeWordIdxRef.current;
        const startSearch = Math.max(0, current + 1);
        const endSearch = Math.min(flatWordList.length - 1, startSearch + 18);

        let matchedIdx = -1;
        for (const spokenTok of spokenTokens.slice(-3)) {
          for (let j = startSearch; j <= endSearch; j++) {
            const target = flatWordList[j]?.normalized;
            if (
              target &&
              (target === spokenTok ||
                (target.length >= 4 && spokenTok.length >= 4 && target.startsWith(spokenTok.slice(0, 4))))
            ) {
              matchedIdx = j;
            }
          }
        }

        if (matchedIdx > current) {
          setActiveWordIdx(matchedIdx);
          const spanEl = wordRefs.current[matchedIdx];
          if (spanEl && scrollContainerRef.current) {
            spanEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      };

      rec.onerror = (ev) => {
        if (ev.error === "not-allowed") {
          setVoiceError("Permiso de micrófono denegado. Usa el modo automático por WPM.");
          stopVoiceRecognition();
        }
      };

      rec.onend = () => {
        // Auto-restart if voice mode is still intentionally active
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {
            setVoiceFollow(false);
          }
        }
      };

      recognitionRef.current = rec;
      rec.start();
      setVoiceFollow(true);
      setIsPlaying(false);
      setCountdown(null);
      if (activeWordIdx < 0 && flatWordList.length > 0) {
        setActiveWordIdx(0);
      }
    } catch {
      setVoiceError("No se pudo iniciar el micrófono; usando desplazamiento automático WPM.");
      stopVoiceRecognition();
    }
  };

  const handleTogglePlay = useCallback(() => {
    if (voiceFollow) {
      stopVoiceRecognition();
    }
    if (isPlaying) {
      setIsPlaying(false);
      setCountdown(null);
      return;
    }
    if (countdown !== null) {
      setCountdown(null);
      setIsPlaying(true);
      return;
    }
    setCountdown(3);
  }, [isPlaying, countdown, voiceFollow, stopVoiceRecognition]);

  const handleResetScroll = useCallback(() => {
    setIsPlaying(false);
    setCountdown(null);
    setActiveWordIdx(-1);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      scrollAccumRef.current = 0;
      setScrollProgress(0);
    }
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && dialogRef.current?.requestFullscreen) {
        await dialogRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Ignore fullscreen denial on iOS Safari where native dialog already spans 100dvh
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Keyboard shortcuts while open (no Escape override, native <dialog> closes cleanly)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setWpm((v) => Math.min(260, v + 10));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setWpm((v) => Math.max(80, v - 10));
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleResetScroll();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setMirrorH((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleTogglePlay, handleResetScroll]);

  const activeTheme = THEME_STYLES[theme];
  const estimatedMinutes = useMemo(() => {
    const totalSecs = Math.round((Math.max(1, totalWords) / wpm) * 60);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, [totalWords, wpm]);

  const mirrorTransform = [
    mirrorH ? "scaleX(-1)" : "",
    mirrorV ? "scaleY(-1)" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <dialog
      ref={dialogRef}
      className={`teleprompter-dialog ${activeTheme.bgClass} ${activeTheme.textClass} focus:outline-none`}
      aria-labelledby={titleId}
      onClose={onClose}
    >
      <div className="flex flex-col h-full w-full overflow-hidden select-none">
        {/* Top Control Bar - Mobile & Desktop Adaptive */}
        <header className="shrink-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-3 sm:px-5 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Tv className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 id={titleId} className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-2">
                  <span>Teleprompter · {assetCode}</span>
                  <span className="hidden sm:inline font-normal text-slate-400 truncate">
                    — {title}
                  </span>
                </h2>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span>{totalWords} pal.</span>
                  <span>·</span>
                  <span>Duración est: {estimatedMinutes}</span>
                  <span>·</span>
                  <span className="text-cyan-400">{scrollProgress}% leído</span>
                </div>
              </div>
            </div>

            {/* Primary Playback & Mode Actions */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                autoFocus
                onClick={handleTogglePlay}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition shadow-sm ${
                  isPlaying
                    ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                    : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                }`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4" /> Pausar
                  </>
                ) : countdown !== null ? (
                  <>
                    <Play className="w-4 h-4" /> Ya ({countdown})
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Empezar (3s)
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleResetScroll}
                className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:border-slate-500 transition"
                title="Volver al inicio (Tecla R)"
                aria-label="Reiniciar posición del texto"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={toggleVoiceFollow}
                disabled={!voiceSupported}
                className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold border transition ${
                  voiceFollow
                    ? "bg-rose-500/20 border-rose-400 text-rose-200 animate-pulse"
                    : voiceSupported
                    ? "bg-slate-900 border-slate-700 text-slate-200 hover:border-cyan-400"
                    : "bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed"
                }`}
                title={
                  voiceSupported
                    ? "Avanza el guion automáticamente siguiendo tu voz"
                    : "Reconocimiento de voz no disponible en este navegador"
                }
              >
                {voiceFollow ? <Mic className="w-4 h-4 text-rose-400" /> : <MicOff className="w-4 h-4" />}
                <span className="hidden md:inline">
                  {voiceFollow ? "Escuchando voz..." : "Por Voz"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="hidden sm:inline-flex p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 hover:text-white transition"
                title="Pantalla Completa"
                aria-label="Alternar pantalla completa"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-600 text-white text-xs font-bold transition"
                aria-label="Cerrar Teleprompter"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>

          {/* Secondary Configuration Strip */}
          <div className="mt-2 pt-2 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            {/* Speed (WPM) */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
              <span className="text-slate-400 font-semibold">Velocidad:</span>
              <button
                type="button"
                onClick={() => setWpm((v) => Math.max(80, v - 10))}
                className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
                aria-label="Reducir velocidad WPM"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono font-bold text-cyan-300 w-16 text-center">
                {wpm} WPM
              </span>
              <button
                type="button"
                onClick={() => setWpm((v) => Math.min(260, v + 10))}
                className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
                aria-label="Aumentar velocidad WPM"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Font Size */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
              <span className="text-slate-400 font-semibold">Letra:</span>
              <button
                type="button"
                onClick={() => setFontSize((v) => Math.max(24, v - 4))}
                className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
                aria-label="Reducir tamaño de letra"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono font-bold text-white w-10 text-center">
                {fontSize}px
              </span>
              <button
                type="button"
                onClick={() => setFontSize((v) => Math.min(76, v + 4))}
                className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
                aria-label="Aumentar tamaño de letra"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mirror & Camera Eye-line toggles */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMirrorH((v) => !v)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-medium transition ${
                  mirrorH
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600"
                }`}
                title="Espejo horizontal para cristal de teleprompter (Tecla M)"
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                Espejo H
              </button>
              <button
                type="button"
                onClick={() => setMirrorV((v) => !v)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-medium transition ${
                  mirrorV
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600"
                }`}
                title="Volteo vertical"
              >
                <FlipVertical className="w-3.5 h-3.5" />
                Espejo V
              </button>
              <button
                type="button"
                onClick={() => setShowEyeline((v) => !v)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-medium transition ${
                  showEyeline
                    ? "bg-amber-500/20 border-amber-400 text-amber-200"
                    : "bg-slate-900 border-slate-800 text-slate-300"
                }`}
                title="Muestra una franja guía para mantener la mirada hacia la cámara"
              >
                <Eye className="w-3.5 h-3.5" />
                Guía Lente
              </button>
              <button
                type="button"
                onClick={() => setShowCues((v) => !v)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-medium transition ${
                  showCues
                    ? "bg-violet-500/20 border-violet-400 text-violet-200"
                    : "bg-slate-900 border-slate-800 text-slate-300"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Notas B-Roll
              </button>
            </div>

            {/* Device Reading Width & Contrast Theme */}
            <div className="hidden lg:flex items-center gap-1.5">
              {(Object.keys(WIDTH_CLASSES) as ReadingWidth[]).map((wk) => (
                <button
                  key={wk}
                  type="button"
                  onClick={() => setReadingWidth(wk)}
                  className={`px-2 py-1 rounded border text-[11px] transition ${
                    readingWidth === wk
                      ? "bg-slate-800 border-cyan-400 text-white font-semibold"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                >
                  {WIDTH_CLASSES[wk].label}
                </button>
              ))}
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeKey)}
                aria-label="Tema de alto contraste del teleprompter"
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-white"
              >
                {(Object.keys(THEME_STYLES) as ThemeKey[]).map((tk) => (
                  <option key={tk} value={tk}>
                    {THEME_STYLES[tk].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {voiceError && (
            <div className="mt-2 rounded bg-amber-950/60 border border-amber-500/40 px-3 py-1 text-[11px] text-amber-200">
              {voiceError}
            </div>
          )}
        </header>

        {/* Progress Bar */}
        <div className="h-1 w-full bg-slate-900 shrink-0">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-150"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>

        {/* Reading Stage Area */}
        <div className="relative flex-1 overflow-hidden">
          {/* Camera Eye-Line Marker Band (upper third for mobile/tablet near lens) */}
          {showEyeline && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-[22%] h-24 sm:h-28 z-20 border-y-2 border-cyan-400/35 bg-cyan-400/[0.04] flex items-center justify-between px-2 sm:px-6"
            >
              <span className="text-cyan-400 font-bold text-xl sm:text-2xl">▶</span>
              <span className="text-cyan-400 font-bold text-xl sm:text-2xl">◀</span>
            </div>
          )}

          {/* 3-2-1 Countdown Overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm">
              <span className="text-xs uppercase tracking-widest text-cyan-300 font-bold mb-2">
                Prepárate mirando a la lente
              </span>
              <div className="text-8xl sm:text-9xl font-black text-white tabular-nums animate-pulse">
                {countdown}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCountdown(null);
                  setIsPlaying(true);
                }}
                className="mt-6 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
              >
                Empezar Ya
              </button>
            </div>
          )}

          {/* Scrollable Text Stage */}
          <div
            ref={scrollContainerRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              scrollAccumRef.current = el.scrollTop;
              const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
              setScrollProgress(Math.min(100, Math.round((el.scrollTop / maxScroll) * 100)));
            }}
            className="h-full w-full overflow-y-auto px-4 sm:px-8 scroll-smooth"
          >
            <div
              style={{ transform: mirrorTransform || undefined }}
              className={`mx-auto ${WIDTH_CLASSES[readingWidth].maxW} pt-[24vh] pb-[65vh] space-y-8 transition-transform duration-200`}
            >
              {selectedHookText && (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/25 p-4 text-sm text-cyan-200">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-cyan-400 mb-1">
                    Gancho Principal Seleccionado
                  </span>
                  <p className="font-semibold text-base sm:text-lg leading-snug">
                    {selectedHookText}
                  </p>
                </div>
              )}

              {blocks.map((blk, bIdx) => {
                const startOffset = blockWordOffsets[bIdx] ?? 0;
                const tokens = blk.audio_voiceover.trim().split(/\s+/).filter(Boolean);

                return (
                  <section key={blk.block_id} className="space-y-3">
                    {/* Optional Director Cue Strip */}
                    {showCues && (
                      <div
                        className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${activeTheme.cueClass}`}
                      >
                        <span className="font-bold uppercase tracking-wider">
                          {blk.section_label} ({blk.timecode})
                        </span>
                        {blk.visual_direction && (
                          <span className="opacity-85">· 🎥 {blk.visual_direction}</span>
                        )}
                        {blk.on_screen_text && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-bold text-amber-300">
                            TXT: {blk.on_screen_text}
                          </span>
                        )}
                      </div>
                    )}

                    {/* High-Legibility Spoken Script */}
                    <p
                      style={{ fontSize: `${fontSize}px`, lineHeight: 1.42 }}
                      className="font-bold tracking-tight break-words"
                    >
                      {tokens.map((tok, tIdx) => {
                        const globalWordIndex = startOffset + tIdx;
                        const isActive = globalWordIndex === activeWordIdx;
                        return (
                          <React.Fragment key={`${blk.block_id}-${tIdx}`}>
                            <span
                              ref={(el) => {
                                wordRefs.current[globalWordIndex] = el;
                              }}
                              onClick={() => {
                                if (voiceFollow) {
                                  setActiveWordIdx(globalWordIndex);
                                }
                              }}
                              className={isActive ? activeTheme.activeWordClass : undefined}
                            >
                              {tok}
                            </span>{" "}
                          </React.Fragment>
                        );
                      })}
                    </p>
                  </section>
                );
              })}

              {ctaText && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-center">
                  <span className="block text-xs uppercase tracking-widest text-emerald-400 font-bold mb-1">
                    Cierre / Llamada a la Acción (CTA)
                  </span>
                  <p className="text-xl sm:text-2xl font-bold text-white">{ctaText}</p>
                </div>
              )}

              <div className="pt-8 text-center text-sm font-mono text-slate-500">
                — FIN DEL GUIÓN ({assetCode}) —
              </div>
            </div>
          </div>
        </div>

        {/* Footer Keyboard Shortcuts Help */}
        <footer className="hidden sm:flex shrink-0 items-center justify-between px-5 py-1.5 bg-slate-950 border-t border-slate-800/80 text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">Espacio</kbd>{" "}
              Play / Pausa
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">↑</kbd>/
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">↓</kbd>{" "}
              Velocidad WPM
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">M</kbd>{" "}
              Modo Espejo
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">R</kbd>{" "}
              Reiniciar
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">Esc</kbd>{" "}
              Salir
            </span>
          </div>
          <span>Optimizado para Móvil, Tablet y Monitores · Coste 0€</span>
        </footer>
      </div>
    </dialog>
  );
}
