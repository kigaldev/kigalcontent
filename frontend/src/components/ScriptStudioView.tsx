"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  Gauge,
  Hash,
  Image as ImageIcon,
  KeyRound,
  Layers,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Tv,
  UserCheck,
  Wand2,
  Zap,
} from "lucide-react";
import { TeleprompterModal } from "@/components/TeleprompterModal";
import { ScriptExporterModal } from "@/components/ScriptExporterModal";
import { ThumbnailCoverStudio } from "@/components/ThumbnailCoverStudio";
import { useEngineStore } from "@/store/useEngineStore";
import { apiClient } from "@/lib/api";
import {
  CONVERSION_GOAL_META,
  DURATION_PRESET_META,
  computeLocalOralTiming,
} from "@/lib/utils";
import type {
  ConversionGoal,
  DurationPreset,
  HookCandidate,
  ScriptTargetPlatform,
  TwoColumnScriptBlock,
} from "@/types/engine";

interface ScriptStudioViewProps {
  onRefresh: () => Promise<void>;
}

type ScriptSubTabId = "config" | "av-script" | "written-posts" | "thumbnails";

interface SubTabSpec {
  id: ScriptSubTabId;
  label: string;
  shortLabel: string;
}

const SCRIPT_SUBTABS: SubTabSpec[] = [
  { id: "config", label: "1. Formato y Redes", shortLabel: "1. Formato" },
  { id: "av-script", label: "2. Guión 2 Columnas", shortLabel: "2. Guión" },
  {
    id: "written-posts",
    label: "3. LinkedIn, X / Twitter y SEO",
    shortLabel: "3. LinkedIn / X / SEO",
  },
  { id: "thumbnails", label: "4. Portadas A/B", shortLabel: "4. Portadas" },
];

const PLATFORM_OPTIONS: Array<{
  id: ScriptTargetPlatform;
  label: string;
  hint: string;
  accent: string;
}> = [
  {
    id: "YouTube",
    label: "YouTube",
    hint: "16:9 & Shorts · SEO <60c",
    accent: "border-rose-500/60 bg-rose-500/15 text-rose-200",
  },
  {
    id: "Instagram",
    label: "Instagram",
    hint: "Reels 9:16 · DM Trigger",
    accent: "border-pink-500/60 bg-pink-500/15 text-pink-200",
  },
  {
    id: "TikTok",
    label: "TikTok",
    hint: "Search 100c · Loop rápido",
    accent: "border-cyan-500/60 bg-cyan-500/15 text-cyan-200",
  },
  {
    id: "LinkedIn",
    label: "LinkedIn",
    hint: "Sin links (-60%) · 1er Com.",
    accent: "border-sky-500/60 bg-sky-500/15 text-sky-200",
  },
  {
    id: "X",
    label: "X",
    hint: "Tweet <=280c & Hilo 4–5",
    accent: "border-amber-500/60 bg-amber-500/15 text-amber-200",
  },
];

const AI_SLOP_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: "En el mundo actual...", regex: /en el mundo actual/gi },
  { label: "Hoy en día...", regex: /hoy en d[ií]a/gi },
  { label: "Sin lugar a dudas...", regex: /sin lugar a dudas/gi },
  { label: "¿Alguna vez te has preguntado...?", regex: /¿?alguna vez te has preguntado/gi },
  { label: "En este video te voy a...", regex: /en este video te voy a/gi },
  { label: "Descubre el secreto...", regex: /descubre el secreto/gi },
  { label: "Lleva tu negocio al siguiente nivel", regex: /siguiente nivel/gi },
  { label: "Revoluciona tu...", regex: /revoluciona tu/gi },
  { label: "No te lo puedes perder", regex: /no te lo puedes perder/gi },
  { label: "Quédate hasta el final", regex: /qu[eé]date hasta el final/gi },
  { label: "Cabe destacar que...", regex: /cabe destacar que/gi },
  { label: "Game changer", regex: /game changer/gi },
];

function stripUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/gi, "").replace(/\s{2,}/g, " ").trim();
}

function clampText(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  const sliced = clean.slice(0, maxLen - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > maxLen * 0.55 ? sliced.slice(0, lastSpace) : sliced).trim() + "…";
}

function extractSentences(blocks: TwoColumnScriptBlock[]): string[] {
  return blocks
    .map((b) => stripUrls(b.audio_voiceover))
    .filter(Boolean)
    .map((s) => s.trim());
}

function buildLinkedInDraft(params: {
  title: string;
  hookText: string;
  blocks: TwoColumnScriptBlock[];
  keyword: string;
  deliveryUrl: string;
  antiSlop: boolean;
}) {
  const { title, hookText, blocks, keyword, deliveryUrl, antiSlop } = params;
  const rawHook = hookText || title || "Por qué tu sistema de contenido no convierte.";
  const hook = clampText(stripUrls(rawHook), 132);

  const takeaways = blocks
    .slice(0, 4)
    .map((blk) => {
      const cleanVoice = stripUrls(blk.audio_voiceover);
      const firstSentence = cleanVoice.split(/(?<=[.!?])\s+/)[0] || cleanVoice;
      const point = clampText(firstSentence, 125);
      return `→ ${blk.section_label}: ${point}`;
    })
    .filter(Boolean);

  const openingLine = antiSlop
    ? `La mayoría mide volumen; los equipos rentables miden retención y sistema.`
    : `Análisis operativo sobre ${clampText(title, 65)}:`;

  const bodyLines = [
    openingLine,
    "",
    ...takeaways,
    "",
    `Si quieres el paso a paso sin fricción, comenta "${keyword}" abajo y te envío el recurso por mensaje privado.`,
    "",
    "¿Qué cuello de botella te frena más hoy al publicar: guión, edición o distribución?",
  ];

  const body = stripUrls(bodyLines.join("\n"));
  const firstComment = `👇 Recurso completo del sistema (o comenta ${keyword} para recibirlo por DM): ${
    deliveryUrl || "https://contentengine.local/recurso"
  }`;

  return { hook, body, firstComment };
}

function buildXDraft(params: {
  title: string;
  hookText: string;
  blocks: TwoColumnScriptBlock[];
  keyword: string;
  niche: string;
}) {
  const { title, hookText, blocks, keyword, niche } = params;
  const lead = clampText(hookText || title, 145);
  const coreBlock = blocks[1]?.audio_voiceover || blocks[0]?.audio_voiceover || title;
  const coreSnippet = clampText(coreBlock, 90);
  const singleTweet = clampText(
    `${lead}\n\n${coreSnippet}\n\nComenta "${keyword}" y te paso el blueprint.`,
    278
  );

  const thread: string[] = [];
  thread.push(
    clampText(
      `1/ ${lead}\n\nHilo corto basado en datos reales sobre ${clampText(title, 65)} 🧵👇`,
      276
    )
  );

  const midBlocks = blocks.slice(0, 3);
  midBlocks.forEach((blk, idx) => {
    const clean = stripUrls(blk.audio_voiceover);
    const visualBadge = blk.on_screen_text ? `[${blk.on_screen_text}] ` : "";
    thread.push(
      clampText(
        `${idx + 2}/ ${blk.section_label}: ${visualBadge}${clean}`,
        276
      )
    );
  });

  while (thread.length < 4) {
    thread.push(
      clampText(
        `${thread.length + 1}/ Regla práctica en ${clampText(niche || "tu nicho", 45)}: valida el gancho de 3 segundos y mide retención antes de escalar producción.`,
        276
      )
    );
  }

  const finalIdx = thread.length + 1;
  thread.push(
    clampText(
      `${finalIdx}/ Si quieres implementar esto esta semana:\n\nGuarda este hilo y comenta "${keyword}" para recibir la plantilla y checklist técnico por DM.`,
      276
    )
  );

  return { singleTweet, thread: thread.slice(0, 5) };
}

function extractSeoKeywords(
  title: string,
  niche: string,
  pillars: string[],
  blocks: TwoColumnScriptBlock[]
): string[] {
  const rawSources = [
    title,
    niche,
    ...pillars.slice(0, 3),
    ...blocks.map((b) => b.on_screen_text),
    ...blocks.map((b) => b.section_label),
  ];

  const stopWords = new Set([
    "para",
    "como",
    "cómo",
    "sobre",
    "entre",
    "desde",
    "hasta",
    "donde",
    "cuando",
    "porque",
    "pero",
    "esto",
    "esta",
    "este",
    "unos",
    "unas",
    "bloque",
    "escena",
    "gancho",
    "punto",
    "clave",
    "paso",
    "guion",
    "guión",
  ]);

  const seen = new Set<string>();
  const results: string[] = [];

  for (const src of rawSources) {
    const cleaned = src
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .trim();
    if (!cleaned) continue;
    if (cleaned.length >= 5 && cleaned.length <= 34 && !seen.has(cleaned)) {
      seen.add(cleaned);
      results.push(cleaned);
    }
    for (const token of cleaned.split(/\s+/)) {
      if (token.length >= 4 && !stopWords.has(token) && !seen.has(token)) {
        seen.add(token);
        results.push(token);
      }
    }
  }

  return results.slice(0, 10);
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function ScriptStudioView({ onRefresh }: ScriptStudioViewProps) {
  const {
    selectedDetail,
    selectedProjectId,
    creatorProfile,
    setCreatorProfile,
    setSelectedDetail,
    backendOnline,
    showToast,
  } = useEngineStore();

  const captionId = useId();
  const subTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeSubTab, setActiveSubTab] = useState<ScriptSubTabId>("config");

  const [targetPlatforms, setTargetPlatforms] = useState<ScriptTargetPlatform[]>([
    "YouTube",
    "Instagram",
    "LinkedIn",
  ]);
  const [preset, setPreset] = useState<DurationPreset>("STANDARD_SHORT");
  const [goal, setGoal] = useState<ConversionGoal>("EMAIL_LEAD_CAPTURE");
  const [wpm, setWpm] = useState(140);
  const [blocks, setBlocks] = useState<TwoColumnScriptBlock[]>([]);
  const [selectedHookIndex, setSelectedHookIndex] = useState(0);

  // Lead magnet keyword from Paso 0 (manychat_triggers)
  const [leadMagnetKeyword, setLeadMagnetKeyword] = useState("BLUEPRINT");

  // Quality controls (Anti-Slop + HookLab)
  const [antiSlopEnabled, setAntiSlopEnabled] = useState(true);
  const [contrarianHookEnabled, setContrarianHookEnabled] = useState(true);
  const [requireVerifiableData, setRequireVerifiableData] = useState(true);

  // LinkedIn, X & OpenSEO state
  const [linkedInHook, setLinkedInHook] = useState("");
  const [linkedInBody, setLinkedInBody] = useState("");
  const [linkedInFirstComment, setLinkedInFirstComment] = useState("");
  const [xSingleTweet, setXSingleTweet] = useState("");
  const [xThreadTweets, setXThreadTweets] = useState<string[]>([]);
  const [ytSeoTitle, setYtSeoTitle] = useState("");
  const [tiktokSearchHook, setTiktokSearchHook] = useState("");
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);
  const [customKeywordInput, setCustomKeywordInput] = useState("");

  // UI & modals state
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [showExporter, setShowExporter] = useState(false);
  const [nicheEdit, setNicheEdit] = useState("");
  const [icpEdit, setIcpEdit] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const manychatTriggers = useMemo(
    () => creatorProfile?.manychat_triggers ?? [],
    [creatorProfile]
  );

  const leadMagnets = useMemo(
    () => creatorProfile?.lead_magnets ?? [],
    [creatorProfile]
  );

  const activeLeadMagnetDeliveryUrl = useMemo(() => {
    const matchedTrigger = manychatTriggers.find(
      (t) => t.keyword.toUpperCase() === leadMagnetKeyword.toUpperCase()
    );
    if (matchedTrigger?.lead_magnet_id) {
      const lm = leadMagnets.find((item) => item.id === matchedTrigger.lead_magnet_id);
      if (lm?.delivery_url) return lm.delivery_url;
    }
    return leadMagnets[0]?.delivery_url || "https://contentengine.local/blueprint";
  }, [manychatTriggers, leadMagnets, leadMagnetKeyword]);

  const hookVariants: HookCandidate[] = useMemo(() => {
    const existing = selectedDetail?.script?.hook_variants ?? [];
    if (existing.length > 0) return existing;
    const title = selectedDetail?.project?.working_title || "tu sistema de contenido";
    return [
      {
        category: "Contrarian",
        hook_text: `Deja de publicar más en "${clampText(title, 42)}": corrige los primeros 3 segundos.`,
        pattern_interrupt: "Zoom punch 115% + texto grande en zona segura",
        estimated_hold_rate: 74.2,
      },
      {
        category: "Dolor / Pérdida",
        hook_text: `El fallo invisible de 400ms que hunde tu retención antes del segundo 5.`,
        pattern_interrupt: "Corte seco + overlay métrica",
        estimated_hold_rate: 71.4,
      },
      {
        category: "Dato Verificable",
        hook_text: `3.4x más Watch Time Share aplicando guión en 2 columnas y -14 LUFS.`,
        pattern_interrupt: "Captura antes/después en pantalla",
        estimated_hold_rate: 72.9,
      },
    ];
  }, [selectedDetail]);

  const activeHook =
    hookVariants[selectedHookIndex] ?? hookVariants[0] ?? null;

  // Sync script state when selected project changes
  useEffect(() => {
    if (selectedDetail?.script) {
      setPreset(selectedDetail.script.duration_preset);
      setGoal(selectedDetail.script.conversion_goal);
      setWpm(selectedDetail.script.wpm_rate);
      setBlocks(selectedDetail.script.two_column_blocks);
      setSelectedHookIndex(selectedDetail.script.selected_hook_index ?? 0);
    } else if (selectedDetail?.project) {
      setPreset(selectedDetail.project.target_duration);
      setGoal(selectedDetail.project.conversion_goal);
    }
  }, [selectedDetail]);

  // Sync creator profile & default lead magnet keyword
  useEffect(() => {
    if (!creatorProfile) return;
    setNicheEdit(creatorProfile.niche);
    setIcpEdit(creatorProfile.ideal_customer_profile);
    const activeTrigger =
      creatorProfile.manychat_triggers?.find((t) => t.active)?.keyword ??
      creatorProfile.manychat_triggers?.[0]?.keyword ??
      creatorProfile.conversion_goals_catalog?.[goal]?.trigger_word;
    if (activeTrigger) {
      setLeadMagnetKeyword(activeTrigger);
    }
  }, [creatorProfile, goal]);

  const regenerateWrittenPosts = useCallback(
    (
      overrideBlocks?: TwoColumnScriptBlock[],
      overrideHook?: string,
      overrideKeyword?: string
    ) => {
      if (!selectedDetail?.project) return;
      const workingBlocks = overrideBlocks ?? blocks;
      const hookStr = overrideHook ?? activeHook?.hook_text ?? selectedDetail.project.working_title;
      const kw = overrideKeyword ?? leadMagnetKeyword;

      const li = buildLinkedInDraft({
        title: selectedDetail.project.working_title,
        hookText: hookStr,
        blocks: workingBlocks,
        keyword: kw,
        deliveryUrl: activeLeadMagnetDeliveryUrl,
        antiSlop: antiSlopEnabled,
      });
      setLinkedInHook(li.hook);
      setLinkedInBody(li.body);
      setLinkedInFirstComment(li.firstComment);

      const xDraft = buildXDraft({
        title: selectedDetail.project.working_title,
        hookText: hookStr,
        blocks: workingBlocks,
        keyword: kw,
        niche: creatorProfile?.niche ?? "",
      });
      setXSingleTweet(xDraft.singleTweet);
      setXThreadTweets(xDraft.thread);

      setYtSeoTitle(clampText(selectedDetail.project.working_title, 58));
      setTiktokSearchHook(
        clampText(
          `${selectedDetail.project.working_title}: ${workingBlocks[0]?.audio_voiceover ?? ""}`,
          100
        )
      );
      setSeoKeywords(
        extractSeoKeywords(
          selectedDetail.project.working_title,
          creatorProfile?.niche ?? "",
          creatorProfile?.content_pillars ?? [],
          workingBlocks
        )
      );
    },
    [
      selectedDetail,
      blocks,
      activeHook,
      leadMagnetKeyword,
      activeLeadMagnetDeliveryUrl,
      antiSlopEnabled,
      creatorProfile,
    ]
  );

  // Auto-populate LinkedIn / X / OpenSEO when project detail loads
  const projectKey = selectedDetail?.project?.id;
  useEffect(() => {
    if (!projectKey) return;
    regenerateWrittenPosts(
      selectedDetail?.script?.two_column_blocks ?? [],
      selectedDetail?.script?.hook_variants?.[selectedDetail?.script?.selected_hook_index ?? 0]
        ?.hook_text ?? selectedDetail?.project?.working_title
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey]);

  const timing = useMemo(
    () => computeLocalOralTiming(blocks, wpm, preset),
    [blocks, wpm, preset]
  );

  const spec = DURATION_PRESET_META[preset];
  const progressPct = Math.min(
    100,
    Math.round((timing.wordCount / spec.wordRange[1]) * 100)
  );

  // Live Anti-Slop & Verifiable Data audit
  const qualityAudit = useMemo(() => {
    const allVoiceText = extractSentences(blocks).join(" ");
    const slopMatches: string[] = [];
    for (const pat of AI_SLOP_PATTERNS) {
      if (pat.regex.test(allVoiceText)) {
        slopMatches.push(pat.label);
      }
      pat.regex.lastIndex = 0;
    }

    const numericEvidence =
      allVoiceText.match(
        /\b\d+(?:[.,]\d+)?\s*(?:%|x|s|seg|ms|min|h|lufs|db|dbfs|\$|€|k|m|t\$)?\b/gi
      ) ?? [];

    return {
      slopMatches,
      slopClean: slopMatches.length === 0,
      evidenceCount: numericEvidence.length,
      evidenceOk: numericEvidence.length >= 1,
    };
  }, [blocks]);

  const linkedInHasExternalUrl = /https?:\/\/\S+/i.test(
    `${linkedInHook}\n${linkedInBody}`
  );

  const handleCopy = async (key: string, value: string, label: string) => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopiedKey(key);
      showToast("success", `${label} copiado al portapapeles.`);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2200);
    } else {
      showToast("error", "No se pudo copiar automáticamente al portapapeles.");
    }
  };

  const handleTogglePlatform = (platform: ScriptTargetPlatform) => {
    setTargetPlatforms((prev) => {
      if (prev.includes(platform)) {
        if (prev.length === 1) {
          showToast("info", "Mantén al menos 1 plataforma objetivo activa.");
          return prev;
        }
        return prev.filter((p) => p !== platform);
      }
      return [...prev, platform];
    });
  };

  const selectSubTab = (tabId: ScriptSubTabId, idx?: number) => {
    setActiveSubTab(tabId);
    const resolvedIdx =
      typeof idx === "number"
        ? idx
        : SCRIPT_SUBTABS.findIndex((t) => t.id === tabId);
    if (resolvedIdx >= 0) {
      subTabRefs.current[resolvedIdx]?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  };

  const handleSubTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIdx = index;
    if (e.key === "ArrowRight") {
      nextIdx = (index + 1) % SCRIPT_SUBTABS.length;
    } else if (e.key === "ArrowLeft") {
      nextIdx = (index - 1 + SCRIPT_SUBTABS.length) % SCRIPT_SUBTABS.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = SCRIPT_SUBTABS.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const target = SCRIPT_SUBTABS[nextIdx];
    selectSubTab(target.id, nextIdx);
    subTabRefs.current[nextIdx]?.focus();
  };

  const handleUpdateBlock = (
    idx: number,
    field: keyof TwoColumnScriptBlock,
    value: string
  ) => {
    setBlocks((prev) =>
      prev.map((blk, i) => (i === idx ? { ...blk, [field]: value } : blk))
    );
  };

  const handleAddBlock = () => {
    setBlocks((prev) => [
      ...prev,
      {
        block_id: `blk-${prev.length + 1}`,
        section_label: `Bloque ${prev.length + 1}`,
        timecode: "00:45 - 00:55",
        visual_direction: "Plano medio + B-roll de refuerzo.",
        b_roll_cue: "Captura de dashboard / métrica",
        on_screen_text: "PUNTO CLAVE",
        audio_voiceover:
          "Añade aquí la locución estructurada para este segmento audiovisual.",
        sfx_cue: "Click sutil",
        music_cue: "Continuar bed (-22 dB)",
        pattern_interrupt_sec: spec.cutInterval[0],
        word_count: 10,
        estimated_seconds: 4.3,
        pacing_warning: false,
      },
    ]);
  };

  const handleCleanSlopInBlocks = () => {
    setBlocks((prev) =>
      prev.map((blk) => {
        let cleaned = blk.audio_voiceover;
        for (const pat of AI_SLOP_PATTERNS) {
          cleaned = cleaned.replace(pat.regex, "").replace(/\s{2,}/g, " ").trim();
          pat.regex.lastIndex = 0;
        }
        if (cleaned && cleaned !== blk.audio_voiceover) {
          cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        }
        return { ...blk, audio_voiceover: cleaned || blk.audio_voiceover };
      })
    );
    showToast("success", "Muletillas genéricas limpiadas en los bloques del guión.");
  };

  const handleApplyHookToBlock1 = (hookText: string) => {
    if (blocks.length === 0) return;
    setBlocks((prev) =>
      prev.map((blk, i) =>
        i === 0
          ? {
              ...blk,
              audio_voiceover: hookText,
              on_screen_text: clampText(hookText.toUpperCase(), 32),
            }
          : blk
      )
    );
    showToast("success", "Gancho ganador aplicado al Bloque 1 del guión.");
  };

  const handleRegenerateScript = async () => {
    if (!selectedProjectId) return;
    setRegenerating(true);
    try {
      if (backendOnline) {
        const updated = await apiClient.generateScript({
          project_id: selectedProjectId,
          duration_preset: preset,
          conversion_goal: goal,
          wpm_rate: wpm,
        });
        setBlocks(updated.two_column_blocks);
        setSelectedHookIndex(updated.selected_hook_index ?? 0);
        await onRefresh();
        regenerateWrittenPosts(
          updated.two_column_blocks,
          updated.hook_variants?.[updated.selected_hook_index ?? 0]?.hook_text
        );
        showToast(
          "success",
          `Guión regenerado para ${spec.label} (${targetPlatforms.join(", ")}).`
        );
      } else {
        regenerateWrittenPosts();
        showToast(
          "info",
          `Parámetros aplicados localmente (${targetPlatforms.join(", ")} · ${spec.shortLabel}).`
        );
      }
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Error regenerando guión"
      );
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveScript = async () => {
    if (!selectedDetail?.script) return;
    setSaving(true);
    try {
      if (backendOnline) {
        const updated = await apiClient.updateScript(selectedDetail.script.id, {
          duration_preset: preset,
          conversion_goal: goal,
          wpm_rate: wpm,
          two_column_blocks: timing.blocks,
          selected_hook_index: selectedHookIndex,
        });
        setSelectedDetail({ ...selectedDetail, script: updated });
        await onRefresh();
        showToast(
          "success",
          `Guión v${updated.script_version} guardado (${updated.word_count} palabras · ${updated.estimated_duration_sec}s a ${wpm} WPM).`
        );
      } else {
        setSelectedDetail({
          ...selectedDetail,
          script: {
            ...selectedDetail.script,
            duration_preset: preset,
            conversion_goal: goal,
            wpm_rate: wpm,
            two_column_blocks: timing.blocks,
            selected_hook_index: selectedHookIndex,
            word_count: timing.wordCount,
            estimated_duration_sec: timing.estimatedDurationSec,
            within_budget: timing.withinBudget,
          },
        });
        showToast("info", "Cambios del guión guardados en memoria local.");
      }
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Error guardando guión"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContextEngine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorProfile) return;
    try {
      if (backendOnline) {
        const updated = await apiClient.updateCreatorProfile({
          niche: nicheEdit,
          ideal_customer_profile: icpEdit,
          active_conversion_goal: goal,
        });
        setCreatorProfile(updated);
      } else {
        setCreatorProfile({
          ...creatorProfile,
          niche: nicheEdit,
          ideal_customer_profile: icpEdit,
          active_conversion_goal: goal,
        });
      }
      showToast("success", "Context Engine (creator_profile.json) actualizado.");
      setShowContextDrawer(false);
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Error actualizando perfil"
      );
    }
  };

  const handleAddSeoKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customKeywordInput.trim().toLowerCase();
    if (!cleaned) return;
    if (!seoKeywords.includes(cleaned)) {
      setSeoKeywords((prev) => [...prev, cleaned]);
    }
    setCustomKeywordInput("");
  };

  if (!selectedDetail?.project) {
    return (
      <div className="bg-[#0b0e14] border border-slate-800 rounded-xl p-10 text-center text-slate-400">
        Selecciona un video en el Paso 1 para redactar su guión multiplataforma, posts y portadas.
      </div>
    );
  }

  const activeSubTabIndex = SCRIPT_SUBTABS.findIndex((t) => t.id === activeSubTab);
  const prevSubTab = activeSubTabIndex > 0 ? SCRIPT_SUBTABS[activeSubTabIndex - 1] : null;
  const nextSubTab =
    activeSubTabIndex < SCRIPT_SUBTABS.length - 1
      ? SCRIPT_SUBTABS[activeSubTabIndex + 1]
      : null;

  const isWrittenChannelSelected =
    targetPlatforms.includes("LinkedIn") || targetPlatforms.includes("X");

  return (
    <div className="space-y-4">
      {/* Pro Dark NLE Studio Header + Subtab Navigation */}
      <div className="bg-[#0b0e14] border border-slate-800/90 rounded-xl overflow-hidden shadow-xl shadow-black/30">
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950">
                2
              </span>
              <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold">
                {selectedDetail.project.asset_code}
              </span>
              <h2 className="text-base font-bold text-white tracking-tight">
                Estudio de Guiones Multiplataforma
              </h2>
              <div className="flex flex-wrap items-center gap-1 ml-1">
                {targetPlatforms.map((plat) => (
                  <span
                    key={plat}
                    className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-mono font-semibold text-cyan-300"
                  >
                    {plat}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Proyecto:{" "}
              <strong className="text-slate-200">
                {selectedDetail.project.working_title}
              </strong>{" "}
              <span className="text-slate-500">·</span>{" "}
              <span className="font-mono text-slate-300">{spec.shortLabel}</span>{" "}
              <span className="text-slate-500">·</span>{" "}
              <span className="text-emerald-300 font-mono">
                Trigger: {leadMagnetKeyword}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTeleprompter(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-slate-950 text-xs font-bold transition shadow-sm"
              title="Abrir modo grabación a pantalla completa para móvil, tablet o monitor"
            >
              <Tv className="w-3.5 h-3.5" />
              Modo Teleprompter
            </button>

            <button
              type="button"
              onClick={() => setShowExporter(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 hover:border-cyan-400 text-xs font-semibold text-slate-200 transition"
              title="Exportar en PDF imprimible, Notion/Markdown o TXT/SRT"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              Exportar (3 Formatos)
            </button>

            <button
              type="button"
              onClick={() => setShowContextDrawer((v) => !v)}
              aria-expanded={showContextDrawer}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 hover:border-violet-400 text-xs font-medium text-slate-200 transition"
              title="Ajustar tono, nicho y audiencia del creador"
            >
              <UserCheck className="w-3.5 h-3.5 text-violet-400" />
              Perfil ({creatorProfile?.name ?? "Creador"})
            </button>

            <button
              type="button"
              onClick={handleSaveScript}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Guardando..." : "Guardar Guión"}
            </button>
          </div>
        </div>

        {/* 4 Clean Subtabs (tablist pattern: identical sizing/border regardless of selection + ::after bottom indicator) */}
        <div
          role="tablist"
          aria-label="Subpasos del Estudio de Guiones"
          className="bg-slate-950/80 px-2 sm:px-4 border-b border-slate-800/80 gap-1"
        >
          {SCRIPT_SUBTABS.map((tab, idx) => {
            const isSelected = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  subTabRefs.current[idx] = el;
                }}
                id={`script-subtab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => selectSubTab(tab.id, idx)}
                onKeyDown={(e) => handleSubTabKeyDown(e, idx)}
                className={`inline-flex items-center gap-2 px-3.5 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 focus-visible:outline-offset-[-2px] ${
                  isSelected
                    ? "text-cyan-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                {tab.id === "written-posts" && isWrittenChannelSelected && (
                  <span className="rounded-full bg-sky-500/20 border border-sky-500/40 px-1.5 py-0.5 text-[10px] font-mono text-sky-300">
                    Activo
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsible Context Engine Drawer */}
      {showContextDrawer && creatorProfile && (
        <form
          onSubmit={handleSaveContextEngine}
          className="bg-[#0b0e14] border border-violet-500/40 rounded-xl p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-violet-200 flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              Context Engine del Creador (Nicho, ICP y Trigger)
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Keyword activa:{" "}
              <strong className="text-emerald-300">{leadMagnetKeyword}</strong>
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-xs text-slate-300">
              Nicho o Temática Principal
              <input
                type="text"
                value={nicheEdit}
                onChange={(e) => setNicheEdit(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
              />
            </label>
            <label className="text-xs text-slate-300">
              Audiencia Objetivo / Cliente Ideal (ICP)
              <input
                type="text"
                value={icpEdit}
                onChange={(e) => setIcpEdit(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-slate-950 text-xs font-bold transition"
            >
              Guardar Perfil
            </button>
          </div>
        </form>
      )}

      {/* =================================================================== */}
      {/* SUBTAB 1: 1. Formato y Redes                                        */}
      {/* =================================================================== */}
      <div
        role="tabpanel"
        id="script-panel-config"
        aria-labelledby="script-subtab-config"
        hidden={activeSubTab !== "config"}
      >
        <div className="space-y-5">
          {/* Multi-Platform Toggle Pills */}
          <div className="bg-[#0b0e14] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  1. Selector Múltiple de Plataformas Objetivo
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Marca una o varias redes para adaptar duración, ganchos, copies de LinkedIn/X y SEO.
                </p>
              </div>
              <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-2.5 py-1">
                {targetPlatforms.length} / {PLATFORM_OPTIONS.length} activas
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {PLATFORM_OPTIONS.map((plat) => {
                const active = targetPlatforms.includes(plat.id);
                return (
                  <button
                    key={plat.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleTogglePlatform(plat.id)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      active
                        ? `${plat.accent} shadow-sm`
                        : "border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{plat.label}</span>
                      <span
                        className={`h-2 w-2 rounded-full ${
                          active ? "bg-emerald-400" : "bg-slate-700"
                        }`}
                      />
                    </div>
                    <p className="text-[10px] opacity-80 mt-1 font-mono truncate">
                      {plat.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration, Conversion Goal + ManyChat Trigger Keyword, WPM */}
          <div className="bg-[#0b0e14] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-5">
            <div className="grid gap-5 lg:grid-cols-12">
              {/* Duration Selector */}
              <div className="lg:col-span-5">
                <span className="block text-xs font-bold text-slate-200 mb-2">
                  2. Duración del Formato
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(DURATION_PRESET_META) as DurationPreset[]).map(
                    (key) => {
                      const active = preset === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setPreset(key)}
                          className={`px-3 py-2.5 rounded-lg border text-left transition ${
                            active
                              ? "bg-cyan-500/15 border-cyan-400 text-cyan-200"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600"
                          }`}
                        >
                          <div className="text-xs font-bold">
                            {DURATION_PRESET_META[key].shortLabel}
                          </div>
                          <div className="text-[10px] font-mono opacity-80 mt-0.5">
                            {DURATION_PRESET_META[key].wordRange[0]}–
                            {DURATION_PRESET_META[key].wordRange[1]} pal. · corte{" "}
                            {DURATION_PRESET_META[key].cutInterval[0]}s
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Conversion Goal + Lead Magnet Trigger Keyword */}
              <div className="lg:col-span-4 space-y-3">
                <label className="block text-xs font-bold text-slate-200">
                  3. Objetivo de Conversión
                  <select
                    value={goal}
                    onChange={(e) => setGoal(e.target.value as ConversionGoal)}
                    className="mt-1.5 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white font-sans focus:outline-none focus:border-cyan-400"
                  >
                    {Object.entries(CONVERSION_GOAL_META).map(([k, m]) => (
                      <option key={k} value={k}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="script-lead-magnet-select"
                      className="text-[11px] font-bold text-emerald-300 inline-flex items-center gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      Palabra Clave Lead Magnet (Paso 0)
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      {manychatTriggers.length} reglas
                    </span>
                  </div>

                  {manychatTriggers.length > 0 ? (
                    <select
                      id="script-lead-magnet-select"
                      value={leadMagnetKeyword}
                      onChange={(e) => setLeadMagnetKeyword(e.target.value)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
                    >
                      {!manychatTriggers.some(
                        (rule) => rule.keyword === leadMagnetKeyword
                      ) &&
                        leadMagnetKeyword && (
                          <option value={leadMagnetKeyword}>
                            {leadMagnetKeyword} — Personalizada
                          </option>
                        )}
                      {manychatTriggers.map((rule) => {
                        const linkedLm = leadMagnets.find(
                          (lm) => lm.id === rule.lead_magnet_id
                        );
                        return (
                          <option key={rule.id} value={rule.keyword}>
                            {rule.keyword} ({rule.platform})
                            {linkedLm ? ` — ${linkedLm.title}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      id="script-lead-magnet-select"
                      type="text"
                      value={leadMagnetKeyword}
                      onChange={(e) =>
                        setLeadMagnetKeyword(e.target.value.toUpperCase())
                      }
                      placeholder="Ej. BLUEPRINT"
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-emerald-300 font-mono uppercase focus:outline-none focus:border-emerald-400"
                    />
                  )}

                  <p className="text-[11px] text-slate-400 leading-snug">
                    CTA:{" "}
                    <span className="text-slate-200">
                      &ldquo;Comenta {leadMagnetKeyword} y te envío el recurso por privado.&rdquo;
                    </span>
                  </p>
                </div>
              </div>

              {/* WPM Slider + Regenerate Action */}
              <div className="lg:col-span-3 flex flex-col justify-between gap-3">
                <label className="block text-xs font-bold text-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="inline-flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                      Velocidad Oral (WPM)
                    </span>
                    <span className="font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded px-1.5 py-0.5">
                      {wpm} pal/min
                    </span>
                  </div>
                  <input
                    type="range"
                    min={130}
                    max={150}
                    step={2}
                    value={wpm}
                    onChange={(e) => setWpm(Number(e.target.value))}
                    className="mt-3 w-full"
                  />
                  <span className="text-[11px] text-slate-400 block mt-1.5 font-normal">
                    140 WPM es el ritmo óptimo para retención sin fatiga auditiva.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleRegenerateScript}
                  disabled={regenerating}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-cyan-500/50 bg-cyan-500/15 hover:bg-cyan-500/25 text-xs font-bold text-cyan-200 transition disabled:opacity-60"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`}
                  />
                  {regenerating
                    ? "Adaptando Guión..."
                    : "Adaptar Guión a Configuración"}
                </button>
              </div>
            </div>
          </div>

          {/* Quality Controls: Anti-Slop + HookLab */}
          <div className="bg-[#0b0e14] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Controles de Calidad Editorial (Anti-Slop + HookLab)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Reglas activas aplicadas al guión audiovisual y a las piezas escritas de LinkedIn / X.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {antiSlopEnabled && !qualityAudit.slopClean && (
                  <button
                    type="button"
                    onClick={handleCleanSlopInBlocks}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50 hover:bg-amber-500/30 text-xs font-bold text-amber-200 transition"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Limpiar {qualityAudit.slopMatches.length} muletilla(s)
                  </button>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              {/* Switch 1: Anti-Slop */}
              <label className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 cursor-pointer hover:border-slate-700 transition">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Filtro Anti-Slop IA</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        antiSlopEnabled
                          ? qualityAudit.slopClean
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {antiSlopEnabled
                        ? qualityAudit.slopClean
                          ? "PASS"
                          : `${qualityAudit.slopMatches.length} ALERTA`
                        : "OFF"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Evita muletillas genéricas (&ldquo;en el mundo actual&rdquo;, &ldquo;descubre el secreto&rdquo;, &ldquo;siguiente nivel&rdquo;).
                  </p>
                </div>
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked={antiSlopEnabled}
                  {...({ switch: "" } as Record<string, string>)}
                  checked={antiSlopEnabled}
                  onChange={(e) => setAntiSlopEnabled(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-cyan-400 focus-visible:outline-offset-2"
                />
              </label>

              {/* Switch 2: Contrarian Hook */}
              <label className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 cursor-pointer hover:border-slate-700 transition">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Gancho Contraintuitivo</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        contrarianHookEnabled
                          ? "bg-violet-500/20 text-violet-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {contrarianHookEnabled ? "HOOKLAB ON" : "OFF"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Prioriza ruptura de patrón en 0–3s y tesis contraria al consenso del nicho.
                  </p>
                </div>
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked={contrarianHookEnabled}
                  {...({ switch: "" } as Record<string, string>)}
                  checked={contrarianHookEnabled}
                  onChange={(e) => setContrarianHookEnabled(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-cyan-400 focus-visible:outline-offset-2"
                />
              </label>

              {/* Switch 3: Verifiable Data */}
              <label className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 cursor-pointer hover:border-slate-700 transition">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Exigir Datos Verificables</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        requireVerifiableData
                          ? qualityAudit.evidenceOk
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {requireVerifiableData
                        ? `${qualityAudit.evidenceCount} CIFRAS`
                        : "OFF"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Verifica métricas, porcentajes, tiempos o benchmarks reales dentro de la locución.
                  </p>
                </div>
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked={requireVerifiableData}
                  {...({ switch: "" } as Record<string, string>)}
                  checked={requireVerifiableData}
                  onChange={(e) => setRequireVerifiableData(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-cyan-400 focus-visible:outline-offset-2"
                />
              </label>
            </div>

            {antiSlopEnabled && qualityAudit.slopMatches.length > 0 && (
              <div
                role="status"
                className="rounded-lg border border-amber-500/40 bg-amber-950/20 px-3.5 py-2.5 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2"
              >
                <span className="inline-flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  Muletillas IA detectadas en guión:{" "}
                  <strong className="font-mono">
                    {qualityAudit.slopMatches.join(", ")}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => selectSubTab("av-script")}
                  className="text-amber-300 underline hover:text-white font-semibold"
                >
                  Revisar en Guión 2 Columnas →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SUBTAB 2: 2. Guión 2 Columnas                                       */}
      {/* =================================================================== */}
      <div
        role="tabpanel"
        id="script-panel-av-script"
        aria-labelledby="script-subtab-av-script"
        hidden={activeSubTab !== "av-script"}
      >
        <div className="space-y-4">
          {/* Compact NLE Telemetry Bar */}
          <div className="bg-[#0b0e14] border border-slate-800/90 rounded-xl p-3.5 sm:p-4 space-y-3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
              <div className="rounded-lg bg-slate-950/90 border border-slate-800 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                  Palabras Totales
                </span>
                <div className="text-sm font-bold text-white font-mono mt-0.5">
                  {timing.wordCount}{" "}
                  <span className="text-[11px] font-normal text-slate-400">
                    / meta {spec.wordRange[0]}–{spec.wordRange[1]}
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-slate-950/90 border border-slate-800 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                  Duración ({wpm} WPM)
                </span>
                <div className="text-sm font-bold text-cyan-300 font-mono inline-flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  {timing.estimatedDurationSec}s{" "}
                  <span className="text-[11px] font-normal text-slate-400">
                    / {spec.durationRange[0]}–{spec.durationRange[1]}s
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-slate-950/90 border border-slate-800 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                  Ritmo de Corte
                </span>
                <div className="text-sm font-bold text-slate-100 font-mono mt-0.5">
                  Cada {spec.cutInterval[0]}–{spec.cutInterval[1]}s
                </div>
              </div>

              <div className="rounded-lg bg-slate-950/90 border border-slate-800 px-3 py-2">
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-slate-400">Presupuesto Oral</span>
                  <span
                    className={
                      timing.withinBudget
                        ? "text-emerald-400 font-bold"
                        : "text-amber-400 font-bold"
                    }
                  >
                    {timing.withinBudget ? "Longitud Óptima" : "Ajustar longitud"}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      timing.withinBudget ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Action Toolbar inside AV Script */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  id={captionId}
                  className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-cyan-400" />
                  Guión Audiovisual a 2 Columnas (Pantalla vs. Voz)
                </h3>
                {antiSlopEnabled && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                      qualityAudit.slopClean
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {qualityAudit.slopClean
                      ? "Anti-Slop PASS"
                      : `${qualityAudit.slopMatches.length} muletillas`}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTeleprompter(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-400/50 hover:bg-violet-500/30 text-xs font-semibold text-violet-200 transition"
                >
                  <Tv className="w-3.5 h-3.5" />
                  Teleprompter
                </button>
                <button
                  type="button"
                  onClick={() => setShowExporter(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:border-cyan-400 text-xs font-semibold text-slate-200 transition"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  Exportar (3 Formatos)
                </button>
                <button
                  type="button"
                  onClick={handleAddBlock}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Añadir Escena
                </button>
                <button
                  type="button"
                  onClick={handleSaveScript}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>

          {/* Two-Column AV Script Table (responsive-table pattern from globals.css) */}
          <div
            tabIndex={0}
            role="region"
            aria-labelledby={captionId}
            className="table-wrapper bg-[#0b0e14]"
          >
            <table>
              <caption className="sr-only">
                Editor de Guión Audiovisual a Dos Columnas con cálculo de tiempo
              </caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <th className="p-3 w-44 border-b border-slate-800">
                    Escena &amp; Tiempo
                  </th>
                  <th className="p-3 border-b border-slate-800">
                    Qué se ve (Cámara, Pantalla y Textos)
                  </th>
                  <th className="p-3 border-b border-slate-800">
                    Qué se dice (Locución de voz, música y efectos)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {timing.blocks.map((blk, idx) => (
                  <tr
                    key={blk.block_id}
                    className={
                      blk.pacing_warning
                        ? "bg-amber-950/20"
                        : "hover:bg-slate-900/40"
                    }
                  >
                    <th
                      scope="row"
                      className="p-3 align-top border-r border-slate-800/80 text-left"
                    >
                      <input
                        type="text"
                        value={blk.section_label}
                        onChange={(e) =>
                          handleUpdateBlock(idx, "section_label", e.target.value)
                        }
                        aria-label={`Nombre de la escena ${idx + 1}`}
                        className="w-full bg-transparent text-xs font-bold text-white focus:outline-none border-b border-transparent focus:border-cyan-400 pb-0.5"
                      />
                      <input
                        type="text"
                        value={blk.timecode}
                        onChange={(e) =>
                          handleUpdateBlock(idx, "timecode", e.target.value)
                        }
                        aria-label={`Tiempo escena ${idx + 1}`}
                        className="mt-1 w-full bg-transparent text-[11px] font-mono text-cyan-300 focus:outline-none"
                      />
                      <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400">
                          {blk.word_count} pal. · {blk.estimated_seconds}s
                        </span>
                        {blk.pacing_warning ? (
                          <span
                            title="Demasiado texto para una sola escena sin cambiar de plano"
                            className="inline-flex items-center gap-0.5 text-amber-400 font-semibold"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Largo
                          </span>
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </div>
                      {blocks.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setBlocks((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="mt-2 text-[11px] text-slate-500 hover:text-rose-400 inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Eliminar
                        </button>
                      )}
                    </th>

                    <td data-label="Columna Visual" className="p-3 align-top space-y-2">
                      <textarea
                        rows={2}
                        value={blk.visual_direction}
                        onChange={(e) =>
                          handleUpdateBlock(idx, "visual_direction", e.target.value)
                        }
                        placeholder="Ej. Mirando a cámara en plano medio."
                        aria-label={`Dirección visual escena ${idx + 1}`}
                        className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                      />
                      <div className="grid sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={blk.b_roll_cue}
                          onChange={(e) =>
                            handleUpdateBlock(idx, "b_roll_cue", e.target.value)
                          }
                          placeholder="Plano de apoyo / B-roll"
                          aria-label={`Plano de apoyo escena ${idx + 1}`}
                          className="rounded bg-slate-900/80 border border-slate-800 px-2 py-1 text-[11px] text-slate-300"
                        />
                        <input
                          type="text"
                          value={blk.on_screen_text}
                          onChange={(e) =>
                            handleUpdateBlock(idx, "on_screen_text", e.target.value)
                          }
                          placeholder="Texto en pantalla"
                          aria-label={`Texto en pantalla escena ${idx + 1}`}
                          className="rounded bg-slate-900/80 border border-slate-800 px-2 py-1 text-[11px] font-bold text-amber-300"
                        />
                      </div>
                    </td>

                    <td data-label="Columna Sonora" className="p-3 align-top space-y-2">
                      <textarea
                        rows={3}
                        value={blk.audio_voiceover}
                        onChange={(e) =>
                          handleUpdateBlock(idx, "audio_voiceover", e.target.value)
                        }
                        placeholder="Locución exacta..."
                        aria-label={`Locución escena ${idx + 1}`}
                        className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-white leading-relaxed focus:outline-none focus:border-cyan-400"
                      />
                      <div className="grid sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={blk.sfx_cue}
                          onChange={(e) =>
                            handleUpdateBlock(idx, "sfx_cue", e.target.value)
                          }
                          placeholder="Efecto de sonido"
                          aria-label={`Efecto de sonido escena ${idx + 1}`}
                          className="rounded bg-slate-900/80 border border-slate-800 px-2 py-1 text-[11px] text-cyan-200"
                        />
                        <input
                          type="text"
                          value={blk.music_cue}
                          onChange={(e) =>
                            handleUpdateBlock(idx, "music_cue", e.target.value)
                          }
                          placeholder="Música de fondo"
                          aria-label={`Música escena ${idx + 1}`}
                          className="rounded bg-slate-900/80 border border-slate-800 px-2 py-1 text-[11px] text-violet-200"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SUBTAB 3: 3. LinkedIn, X / Twitter y SEO                            */}
      {/* =================================================================== */}
      <div
        role="tabpanel"
        id="script-panel-written-posts"
        aria-labelledby="script-subtab-written-posts"
        hidden={activeSubTab !== "written-posts"}
      >
        <div className="space-y-5">
          {/* Context & Sync Bar */}
          <div className="bg-[#0b0e14] border border-slate-800/90 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-sky-400" />
                  Adaptación Multiplataforma: LinkedIn, X / Twitter, OpenSEO &amp; HookLab
                </h3>
                {!isWrittenChannelSelected && (
                  <span className="text-[11px] rounded-full bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 text-amber-200">
                    Tip: Activa LinkedIn o X si los publicarás esta semana
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Extraído automáticamente de los bloques del guión, tu Gancho Activo y el trigger{" "}
                <span className="font-mono text-emerald-300">{leadMagnetKeyword}</span>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!targetPlatforms.includes("LinkedIn") && (
                <button
                  type="button"
                  onClick={() => handleTogglePlatform("LinkedIn")}
                  className="px-2.5 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition"
                >
                  + Activar LinkedIn
                </button>
              )}
              {!targetPlatforms.includes("X") && (
                <button
                  type="button"
                  onClick={() => handleTogglePlatform("X")}
                  className="px-2.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition"
                >
                  + Activar X
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  regenerateWrittenPosts();
                  showToast("success", "Posts de LinkedIn, hilo de X y OpenSEO sincronizados desde el guión.");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/50 hover:bg-cyan-500/25 text-xs font-bold text-cyan-200 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerar desde Guión
              </button>
            </div>
          </div>

          <div className="grid xl:grid-cols-2 gap-5">
            {/* LinkedIn Post Generator */}
            <section
              aria-label="Generador de Publicación para LinkedIn"
              className="bg-[#0b0e14] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-sky-300">
                    Publicación Ejecutiva LinkedIn (Zero-Link)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Gancho &lt;135 chars antes de &ldquo;...ver más&rdquo; + cuerpo sin URLs (-60% penalty) + 1er comentario.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void handleCopy(
                      "linkedin-post",
                      `${linkedInHook}\n\n${linkedInBody}`,
                      "Post de LinkedIn"
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition"
                >
                  {copiedKey === "linkedin-post" ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copiar Post LinkedIn
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label
                      htmlFor="linkedin-hook-input"
                      className="font-semibold text-slate-200"
                    >
                      Gancho de Apertura (&lt;135 caracteres)
                    </label>
                    <span
                      className={`font-mono text-[11px] font-bold ${
                        linkedInHook.length <= 135
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {linkedInHook.length} / 135 chars
                    </span>
                  </div>
                  <input
                    id="linkedin-hook-input"
                    type="text"
                    value={linkedInHook}
                    onChange={(e) => setLinkedInHook(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label
                      htmlFor="linkedin-body-input"
                      className="font-semibold text-slate-200"
                    >
                      Cuerpo Estructurado (Sin enlaces externos)
                    </label>
                    <span
                      className={`font-mono text-[11px] font-semibold ${
                        linkedInHasExternalUrl
                          ? "text-rose-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {linkedInHasExternalUrl
                        ? "⚠ Enlace detectado (-60% alcance)"
                        : "✓ Limpio (0 enlaces)"}
                    </span>
                  </div>
                  <textarea
                    id="linkedin-body-input"
                    rows={8}
                    value={linkedInBody}
                    onChange={(e) => setLinkedInBody(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-sky-400"
                  />
                  {linkedInHasExternalUrl && (
                    <div className="mt-1.5 flex items-center justify-between rounded-lg border border-rose-500/40 bg-rose-950/30 px-2.5 py-1.5 text-[11px] text-rose-200">
                      <span>
                        LinkedIn penaliza hasta un -60% los enlaces dentro del cuerpo principal.
                      </span>
                      <button
                        type="button"
                        onClick={() => setLinkedInBody((b) => stripUrls(b))}
                        className="underline font-bold text-rose-300 hover:text-white ml-2 shrink-0"
                      >
                        Quitar URLs
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label
                      htmlFor="linkedin-first-comment"
                      className="font-semibold text-emerald-300"
                    >
                      Primer Comentario (Palabra Clave + URL Lead Magnet)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopy(
                          "linkedin-comment",
                          linkedInFirstComment,
                          "1er Comentario LinkedIn"
                        )
                      }
                      className="text-[11px] text-cyan-300 hover:text-white inline-flex items-center gap-1 font-semibold"
                    >
                      {copiedKey === "linkedin-comment" ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      Copiar 1er Comentario
                    </button>
                  </div>
                  <textarea
                    id="linkedin-first-comment"
                    rows={2}
                    value={linkedInFirstComment}
                    onChange={(e) => setLinkedInFirstComment(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-100 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            </section>

            {/* X / Twitter Single Tweet + 4-5 Tweet Thread */}
            <section
              aria-label="Generador de Tweet e Hilo para X"
              className="bg-[#0b0e14] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-amber-300">
                    X / Twitter: Tweet Impacto + Hilo (4–5 Tweets)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Límite estricto de 280 caracteres por publicación con contador en vivo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void handleCopy(
                      "x-thread",
                      xThreadTweets.join("\n\n---\n\n"),
                      "Hilo completo de X"
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition"
                >
                  {copiedKey === "x-thread" ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copiar Hilo
                </button>
              </div>

              {/* Single High-Impact Tweet */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="x-single-tweet"
                    className="font-bold text-slate-200"
                  >
                    Tweet Único de Alto Impacto (&le;280)
                  </label>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[11px] font-bold ${
                        xSingleTweet.length <= 280
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {xSingleTweet.length} / 280
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopy("x-single", xSingleTweet, "Tweet único")
                      }
                      className="text-[11px] text-cyan-300 hover:text-white inline-flex items-center gap-1 font-semibold"
                    >
                      {copiedKey === "x-single" ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      Copiar
                    </button>
                  </div>
                </div>
                <textarea
                  id="x-single-tweet"
                  rows={3}
                  value={xSingleTweet}
                  onChange={(e) => setXSingleTweet(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white leading-relaxed focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* 4-5 Tweet Thread */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    Hilo Estructurado ({xThreadTweets.length} tweets)
                  </span>
                  {xThreadTweets.length < 6 && (
                    <button
                      type="button"
                      onClick={() =>
                        setXThreadTweets((prev) => [
                          ...prev,
                          `${prev.length + 1}/ Punto extra derivado del sistema: comenta "${leadMagnetKeyword}" para ver el flujo completo.`,
                        ])
                      }
                      className="text-[11px] text-amber-300 hover:text-white inline-flex items-center gap-1 font-semibold"
                    >
                      <Plus className="w-3 h-3" />
                      Añadir Tweet
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {xThreadTweets.map((tweet, idx) => {
                    const overLimit = tweet.length > 280;
                    return (
                      <div
                        key={`tweet-${idx}`}
                        className={`rounded-lg border p-2.5 space-y-1.5 ${
                          overLimit
                            ? "border-rose-500/60 bg-rose-950/20"
                            : "border-slate-800 bg-slate-950/80"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-bold text-amber-300">
                            Tweet {idx + 1} / {xThreadTweets.length}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono font-bold ${
                                overLimit ? "text-rose-400" : "text-emerald-400"
                              }`}
                            >
                              {tweet.length} / 280
                            </span>
                            {xThreadTweets.length > 3 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setXThreadTweets((prev) =>
                                    prev.filter((_, i) => i !== idx)
                                  )
                                }
                                aria-label={`Eliminar tweet ${idx + 1}`}
                                className="text-slate-500 hover:text-rose-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          value={tweet}
                          onChange={(e) =>
                            setXThreadTweets((prev) =>
                              prev.map((t, i) => (i === idx ? e.target.value : t))
                            )
                          }
                          aria-label={`Texto del tweet ${idx + 1}`}
                          className="w-full rounded bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* OpenSEO & HookLab Section */}
          <div className="grid xl:grid-cols-12 gap-5">
            {/* HookLab Selector */}
            <section
              aria-label="HookLab Selector de Gancho"
              className="xl:col-span-6 bg-[#0b0e14] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-violet-300 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    HookLab: Variantes de Gancho (Elige Ganador)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    El gancho seleccionado alimenta el Teleprompter, Exportador y tus posts.
                  </p>
                </div>
                {contrarianHookEnabled && (
                  <span className="px-2 py-0.5 rounded bg-violet-500/20 border border-violet-500/40 text-[10px] font-mono text-violet-200">
                    Prioridad Contrarian
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                {hookVariants.map((hook, idx) => {
                  const isWinner = selectedHookIndex === idx;
                  return (
                    <div
                      key={`${hook.category}-${idx}`}
                      className={`rounded-xl border p-3 transition ${
                        isWinner
                          ? "border-violet-400 bg-violet-500/10"
                          : "border-slate-800 bg-slate-950/80 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono font-bold text-cyan-300">
                            {hook.category}
                          </span>
                          <span className="text-[11px] font-mono text-emerald-300">
                            Hold 3s est.: {hook.estimated_hold_rate}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedHookIndex(idx);
                              regenerateWrittenPosts(blocks, hook.hook_text);
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                              isWinner
                                ? "bg-violet-400 text-slate-950"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            {isWinner ? "✓ Ganador Activo" : "Elegir Ganador"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyHookToBlock1(hook.hook_text)}
                            className="px-2 py-1 rounded-md border border-slate-700 bg-slate-900 text-[11px] text-slate-300 hover:border-cyan-400 hover:text-white transition"
                            title="Copiar este gancho al Bloque 1 del guión"
                          >
                            Usar en Bloque 1
                          </button>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-white leading-snug">
                        &ldquo;{hook.hook_text}&rdquo;
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Pattern Interrupt:{" "}
                        <span className="text-slate-300">{hook.pattern_interrupt}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* OpenSEO YouTube & TikTok */}
            <section
              aria-label="OpenSEO YouTube y TikTok"
              className="xl:col-span-6 bg-[#0b0e14] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    OpenSEO: Keywords YouTube &amp; TikTok Search
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Indexación semántica en los primeros 60 chars (YouTube móvil) y 100 chars (TikTok).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void handleCopy(
                      "seo-keywords",
                      seoKeywords.join(", "),
                      "Keywords OpenSEO"
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-bold text-emerald-200 transition"
                >
                  {copiedKey === "seo-keywords" ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copiar Keywords
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label
                      htmlFor="openseo-yt-title"
                      className="font-semibold text-slate-200"
                    >
                      Título YouTube Móvil (&lt;60 chars)
                    </label>
                    <span
                      className={`font-mono text-[11px] font-bold ${
                        ytSeoTitle.length < 60
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {ytSeoTitle.length} / 60
                    </span>
                  </div>
                  <input
                    id="openseo-yt-title"
                    type="text"
                    value={ytSeoTitle}
                    onChange={(e) => setYtSeoTitle(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label
                      htmlFor="openseo-tiktok-hook"
                      className="font-semibold text-slate-200"
                    >
                      Primeros 100 chars (TikTok Search SEO)
                    </label>
                    <span className="font-mono text-[11px] text-cyan-300">
                      {tiktokSearchHook.length} / 100
                    </span>
                  </div>
                  <input
                    id="openseo-tiktok-hook"
                    type="text"
                    value={tiktokSearchHook}
                    onChange={(e) => setTiktokSearchHook(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-200 mb-2">
                    Keywords SEO Sugeridas
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {seoKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] font-mono text-cyan-200"
                      >
                        <Hash className="w-3 h-3 text-emerald-400" />
                        {kw}
                        <button
                          type="button"
                          onClick={() =>
                            setSeoKeywords((prev) => prev.filter((k) => k !== kw))
                          }
                          aria-label={`Quitar keyword ${kw}`}
                          className="text-slate-500 hover:text-rose-400 ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  <form onSubmit={handleAddSeoKeyword} className="mt-2.5 flex gap-2">
                    <input
                      type="text"
                      value={customKeywordInput}
                      onChange={(e) => setCustomKeywordInput(e.target.value)}
                      placeholder="Añadir keyword SEO (ej. automatización b2b)..."
                      aria-label="Nueva keyword SEO"
                      className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                    >
                      Añadir
                    </button>
                  </form>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SUBTAB 4: 4. Portadas A/B                                           */}
      {/* =================================================================== */}
      <div
        role="tabpanel"
        id="script-panel-thumbnails"
        aria-labelledby="script-subtab-thumbnails"
        hidden={activeSubTab !== "thumbnails"}
      >
        <div className="space-y-5">
          {/* Packaging-First A/B Variants (1280x720) */}
          <div className="bg-[#0b0e14] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-cyan-400" />
                  Miniaturas y Títulos Alternativos (Variantes A / B · 1280×720)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Contrasta dos hipótesis visuales antes de exportar para maximizar Watch Time Share en YouTube Test &amp; Compare.
                </p>
              </div>
              {selectedDetail.script?.cta_text && (
                <span className="text-xs rounded bg-slate-950 border border-slate-800 px-2.5 py-1 text-emerald-300 font-mono">
                  CTA: {selectedDetail.script.cta_text}
                </span>
              )}
            </div>

            {selectedDetail.project.ab_variants.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4 pt-1">
                {selectedDetail.project.ab_variants.map((variant) => (
                  <div
                    key={variant.variant_label}
                    className="rounded-xl border border-slate-800 bg-slate-950/90 p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-xs">
                        Opción {variant.variant_label}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {variant.thumbnail_dimensions} · {variant.hypothesis || "Test A/B"}
                      </span>
                    </div>
                    <div className="aspect-video rounded-lg border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/40 p-4 flex flex-col justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-semibold">
                        Concepto de Miniatura
                      </span>
                      <p className="text-base font-bold text-white leading-tight">
                        {variant.title}
                      </p>
                      <p className="text-[11px] text-slate-300">
                        {variant.thumbnail_concept}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/50 p-6 text-center text-xs text-slate-400">
                <Sparkles className="w-4 h-4 text-cyan-400 mx-auto mb-1.5" />
                Este proyecto aún no tiene variantes A/B guardadas; usa el Estudio de Portadas Canvas abajo para generar tus portadas 16:9 y 9:16.
              </div>
            )}
          </div>

          {/* Interactive HD Canvas Cover & Thumbnail Studio (9:16 + 16:9) */}
          <ThumbnailCoverStudio
            assetCode={selectedDetail.project.asset_code}
            projectTitle={selectedDetail.project.working_title}
            abVariants={selectedDetail.project.ab_variants}
          />
        </div>
      </div>

      {/* Quick Substep Navigation Footer */}
      <div className="bg-[#0b0e14] border border-slate-800/90 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={!prevSubTab}
          onClick={() => {
            if (prevSubTab) selectSubTab(prevSubTab.id);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white disabled:opacity-40 disabled:pointer-events-none"
        >
          <span>
            ← Subpaso anterior
            {prevSubTab ? `: ${prevSubTab.shortLabel}` : ""}
          </span>
        </button>

        <span className="text-[11px] font-mono text-slate-400">
          Subpaso {activeSubTabIndex + 1} de {SCRIPT_SUBTABS.length}
        </span>

        <button
          type="button"
          disabled={!nextSubTab}
          onClick={() => {
            if (nextSubTab) selectSubTab(nextSubTab.id);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/50 bg-cyan-500/15 hover:bg-cyan-500/25 px-3.5 py-2 text-xs font-bold text-cyan-200 transition disabled:opacity-40 disabled:pointer-events-none"
        >
          <span>
            Siguiente subpaso →
            {nextSubTab ? `: ${nextSubTab.shortLabel}` : ""}
          </span>
        </button>
      </div>

      {/* Fullscreen Teleprompter Dialog */}
      <TeleprompterModal
        isOpen={showTeleprompter}
        onClose={() => setShowTeleprompter(false)}
        title={selectedDetail.project.working_title}
        assetCode={selectedDetail.project.asset_code}
        blocks={timing.blocks}
        initialWpm={wpm}
        selectedHookText={activeHook?.hook_text}
        ctaText={selectedDetail.script?.cta_text}
      />

      {/* 3-in-1 Script Exporter Dialog (PDF/HTML, Notion/MD, TXT+SRT) */}
      <ScriptExporterModal
        isOpen={showExporter}
        onClose={() => setShowExporter(false)}
        assetCode={selectedDetail.project.asset_code}
        title={selectedDetail.project.working_title}
        preset={preset}
        wpm={wpm}
        blocks={timing.blocks}
        selectedHookText={activeHook?.hook_text}
        ctaText={selectedDetail.script?.cta_text}
        abVariants={selectedDetail.project.ab_variants}
      />
    </div>
  );
}
