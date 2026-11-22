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
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  Gauge,
  Hash,
  Image as ImageIcon,
  Instagram,
  Layers,
  PlaySquare,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Tv,
  Twitter,
  UserCheck,
  Wand2,
  Zap,
} from "lucide-react";
import { TeleprompterModal } from "@/components/TeleprompterModal";
import { ScriptExporterModal } from "@/components/ScriptExporterModal";
import { MasterScriptVisor } from "@/components/script-studio/MasterScriptVisor";
import { YouTubePlatformVisor } from "@/components/script-studio/YouTubePlatformVisor";
import { InstagramPlatformVisor } from "@/components/script-studio/InstagramPlatformVisor";
import { TikTokPlatformVisor } from "@/components/script-studio/TikTokPlatformVisor";
import { LinkedInPlatformVisor } from "@/components/script-studio/LinkedInPlatformVisor";
import { XPlatformVisor } from "@/components/script-studio/XPlatformVisor";
import { ScriptConfigPanel } from "@/components/script-studio/ScriptConfigPanel";
import { useEngineStore } from "@/store/useEngineStore";
import { apiClient } from "@/lib/api";
import { copyPreservingLineBreaks } from "@/lib/unicodeFormat";
import {
  CONVERSION_GOAL_META,
  DURATION_PRESET_META,
  computeLocalOralTiming,
} from "@/lib/utils";
import type {
  ConversionGoal,
  DurationPreset,
  HookCandidate,
  LinkedInVisualMode,
  ScriptTargetPlatform,
  TwoColumnScriptBlock,
} from "@/types/engine";

interface ScriptStudioViewProps {
  onRefresh: () => Promise<void>;
}

export type ScriptSubTabId =
  | "master"
  | "youtube"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "x"
  | "config";

interface SubTabSpec {
  id: ScriptSubTabId;
  label: string;
  shortLabel: string;
  badge?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

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

function sanitizePromptArtifacts(text: string): string {
  const cleaned = text
    .replace(/^Contexto afinado por Copiloto Estratega:\s*/i, "")
    .replace(/^Publicaci[oó]n en LinkedIn sobre[^:\n]*:\s*/i, "")
    .replace(
      /^La idea es\s+(?:comentar|explicar|hablar|contar|redactar|escribir)\s+(?:c[oó]mo\s+|que\s+|sobre\s+)?/i,
      ""
    )
    .replace(
      /^(redactar|crear|escribir|hacer|quiero|necesito|prepara|genera)\s+(un\s+)?(post|publicaci[oó]n|video|hilo|guion)\s+(en|para|sobre)?\s*(linkedin|instagram|tiktok|youtube|x|twitter)?\s*(indicando|explicando|hablando|que|sobre)?\s*/i,
      ""
    )
    .trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "";
}

function isTemplateSlopHook(text: string): boolean {
  const low = text.toLowerCase();
  return (
    low.startsWith("deja de publicar más en") ||
    low.startsWith("deja de escalar horas en") ||
    low.startsWith("el patrón oculto detrás de") ||
    low.startsWith("estás perdiendo el 80%") ||
    low.startsWith("redactar un post")
  );
}

function extractDynamicLinkedInHashtags(title: string, notes: string): string[] {
  const corpus = `${title} ${notes}`.toLowerCase();
  const rules: Array<[string, string[]]> = [
    ["#HERO24", ["hero24", "heroe", "héroe"]],
    ["#Servicios", ["fontanero", "electricista", "reforma", "servicios", "profesionales", "albañil", "mudanza"]],
    ["#Productividad", ["horas", "tiempo", "optimiz", "productividad", "factur", "contabilidad"]],
    ["#CaptacionClientes", ["clientes", "captación", "captacion", "presupuesto", "boca-oreja"]],
    ["#PymesEspaña", ["españa", "pyme", "negocio", "empresa"]],
    ["#B2B", ["b2b", "ventas", "leads", "inbound", "growth"]],
    ["#IA", ["inteligencia artificial", " ia ", "automatiz"]],
    ["#Liderazgo", ["liderazgo", "equipo", "estrategia", "crecimiento"]],
  ];
  const tags: string[] = [];
  for (const [tag, keywords] of rules) {
    if (keywords.some((k) => corpus.includes(k)) && !tags.includes(tag)) {
      tags.push(tag);
    }
    if (tags.length >= 5) break;
  }
  for (const fb of ["#Crecimiento", "#Negocios", "#Estrategia"]) {
    if (tags.length >= 3) break;
    if (!tags.includes(fb)) tags.push(fb);
  }
  return tags;
}

function buildLinkedInDraft(params: {
  title: string;
  hookText: string;
  blocks: TwoColumnScriptBlock[];
  keyword: string;
  deliveryUrl: string;
  antiSlop: boolean;
  contextNotes?: string | null;
}) {
  const { title, hookText, blocks, keyword, deliveryUrl, antiSlop, contextNotes } = params;
  const cleanTitle = sanitizePromptArtifacts(title);
  const cleanHookCandidate = sanitizePromptArtifacts(hookText);

  const hook =
    cleanHookCandidate && !isTemplateSlopHook(cleanHookCandidate)
      ? clampText(stripUrls(cleanHookCandidate), 132)
      : clampText(stripUrls(cleanTitle || "Lo que cambia cuando aplicas criterio real frente al volumen."), 132);

  if (contextNotes && contextNotes.trim().length > 30) {
    const rawNotes = contextNotes.trim();
    const paragraphs = rawNotes
      .split(/\n\s*\n+/)
      .map((p) =>
        sanitizePromptArtifacts(
          stripUrls(
            p.replace(
              /^[-•]\s*(Objetivo|Tesis|Llamada a la acci[oó]n|Reflexi[oó]n transparente|Nuevo enfoque|Anuncio|CTA B2B):\s*/gim,
              ""
            )
          )
        )
      )
      .filter(Boolean);

    const formatted = paragraphs.map((para, idx) => {
      if (
        idx === paragraphs.length - 1 &&
        /(dm|mensaje|escrib|coment|contact)/i.test(para)
      ) {
        return `👉 ${para}`;
      }
      return para;
    });

    const hashtags = extractDynamicLinkedInHashtags(cleanTitle, rawNotes);
    const hasQuestion = formatted.some((p) => p.includes("?"));
    const bodyLines: string[] = [];
    for (const p of formatted) {
      bodyLines.push(p, "");
    }
    if (!hasQuestion) {
      bodyLines.push(
        "💬 ¿Te encuentras con esta misma situación en tu sector? Te leo en comentarios.",
        ""
      );
    }
    bodyLines.push(hashtags.join(" "));

    const wantsDm = /(dm|mensaje|escrib|registr)/i.test(rawNotes);
    const firstComment = wantsDm
      ? "Si quieres que lo comentemos para tu caso concreto, escríbeme por mensaje directo o deja un comentario aquí abajo y te respondo personalmente."
      : `👇 Acceso o más detalles sobre esta publicación: ${deliveryUrl || "https://contentengine.local/recurso"}`;

    return {
      hook,
      body: bodyLines.join("\n").trim(),
      firstComment,
    };
  }

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
    : `Análisis operativo sobre ${clampText(cleanTitle, 65)}:`;

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
  return copyPreservingLineBreaks(text);
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

  const subTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeSubTab, setActiveSubTab] = useState<ScriptSubTabId>("master");

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

  // Lead magnet keyword from Paso 0
  const [leadMagnetKeyword, setLeadMagnetKeyword] = useState("BLUEPRINT");

  // Quality controls
  const [antiSlopEnabled, setAntiSlopEnabled] = useState(true);
  const [contrarianHookEnabled, setContrarianHookEnabled] = useState(true);
  const [requireVerifiableData, setRequireVerifiableData] = useState(true);

  // Platform-specific content states
  // YouTube
  const [ytSeoTitle, setYtSeoTitle] = useState("");
  const [ytDescription, setYtDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);

  // Instagram
  const [igReelCaption, setIgReelCaption] = useState("");

  // TikTok
  const [tiktokSearchHook, setTiktokSearchHook] = useState("");
  const [tiktokCaption, setTiktokCaption] = useState("");

  // LinkedIn
  const [linkedInHook, setLinkedInHook] = useState("");
  const [linkedInBody, setLinkedInBody] = useState("");
  const [linkedInFirstComment, setLinkedInFirstComment] = useState("");
  const [linkedInVisualMode, setLinkedInVisualMode] = useState<LinkedInVisualMode>("CAROUSEL_PDF");
  const [linkedInVisualUrl, setLinkedInVisualUrl] = useState<string | null>(null);
  const [savingLinkedIn, setSavingLinkedIn] = useState(false);

  // X / Twitter
  const [xSingleTweet, setXSingleTweet] = useState("");
  const [xThreadTweets, setXThreadTweets] = useState<string[]>([]);

  // UI state
  const [saving, setSaving] = useState(false);
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

  const activeHook = hookVariants[selectedHookIndex] ?? hookVariants[0] ?? null;

  // Sync script state and platforms when selected project changes
  useEffect(() => {
    if (
      selectedDetail?.project?.target_platforms &&
      selectedDetail.project.target_platforms.length > 0
    ) {
      setTargetPlatforms(selectedDetail.project.target_platforms);
    }
    if (selectedDetail?.project?.content_format === "TEXT_ONLY") {
      if (selectedDetail.project.target_platforms?.includes("LinkedIn")) {
        setActiveSubTab("linkedin");
      } else if (selectedDetail.project.target_platforms?.includes("X")) {
        setActiveSubTab("x");
      }
    }
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

  // Regenerate all platform adapted materials from master script blocks
  const regeneratePlatformContents = useCallback(
    (
      overrideBlocks?: TwoColumnScriptBlock[],
      overrideHook?: string,
      overrideKeyword?: string
    ) => {
      if (!selectedDetail?.project) return;
      const workingBlocks = overrideBlocks ?? blocks;
      const hookStr = overrideHook ?? activeHook?.hook_text ?? selectedDetail.project.working_title;
      const kw = overrideKeyword ?? leadMagnetKeyword;
      const title = selectedDetail.project.working_title;

      // YouTube
      setYtSeoTitle(clampText(title, 58));
      const ytDescIntro = `${hookStr}\n\nEn este video analizamos cómo dominar ${title} con un enfoque operativo y datos reales.`;
      setYtDescription(ytDescIntro);
      const keywords = extractSeoKeywords(
        title,
        creatorProfile?.niche ?? "",
        creatorProfile?.content_pillars ?? [],
        workingBlocks
      );
      setSeoKeywords(keywords);

      // Instagram Reels
      const igLines = [
        hookStr,
        "",
        ...workingBlocks.slice(0, 3).map((b) => `• ${b.section_label}: ${clampText(b.audio_voiceover, 90)}`),
        "",
        `💬 Comenta "${kw}" y te envío el recurso completo directo a tus mensajes privados (DM).`,
      ];
      setIgReelCaption(igLines.join("\n"));

      // TikTok
      setTiktokSearchHook(
        clampText(`${title}: ${workingBlocks[0]?.audio_voiceover ?? ""}`, 95)
      );
      setTiktokCaption(`${clampText(hookStr, 90)} #aprendeentiktok #creadordecontenido #${creatorProfile?.niche?.toLowerCase().replace(/\s+/g, "") || "techtok"}`);

      // LinkedIn
      const li = buildLinkedInDraft({
        title,
        hookText: hookStr,
        blocks: workingBlocks,
        keyword: kw,
        deliveryUrl: activeLeadMagnetDeliveryUrl,
        antiSlop: antiSlopEnabled,
        contextNotes: selectedDetail.project.context_notes,
      });
      setLinkedInHook(li.hook);
      setLinkedInBody(li.body);
      setLinkedInFirstComment(li.firstComment);

      // X
      const xDraft = buildXDraft({
        title,
        hookText: hookStr,
        blocks: workingBlocks,
        keyword: kw,
        niche: creatorProfile?.niche ?? "",
      });
      setXSingleTweet(xDraft.singleTweet);
      setXThreadTweets(xDraft.thread);
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

  // Auto-populate when project detail loads (prefer saved SocialPost over template regeneration)
  const projectKey = selectedDetail?.project?.id;
  useEffect(() => {
    if (!projectKey) return;
    regeneratePlatformContents(
      selectedDetail?.script?.two_column_blocks ?? [],
      selectedDetail?.script?.hook_variants?.[selectedDetail?.script?.selected_hook_index ?? 0]
        ?.hook_text ?? selectedDetail?.project?.working_title
    );

    const savedLi = selectedDetail?.social_posts?.find((p) => p.channel === "LinkedIn");
    if (savedLi) {
      const cleanSavedHook = sanitizePromptArtifacts(savedLi.title || "");
      let cleanSavedBody = savedLi.post_body || "";
      if (cleanSavedHook && cleanSavedBody.startsWith(cleanSavedHook)) {
        cleanSavedBody = cleanSavedBody.slice(cleanSavedHook.length).replace(/^\s+/, "");
      }
      if (cleanSavedHook && !isTemplateSlopHook(cleanSavedHook)) {
        setLinkedInHook(cleanSavedHook);
      }
      if (cleanSavedBody.trim()) {
        setLinkedInBody(cleanSavedBody);
      }
      if (savedLi.first_comment) {
        setLinkedInFirstComment(savedLi.first_comment);
      }
      const savedMode = savedLi.metadata_payload?.visual_mode as LinkedInVisualMode | undefined;
      if (savedMode) setLinkedInVisualMode(savedMode);
      const savedUrl = savedLi.metadata_payload?.visual_asset_url as string | undefined;
      setLinkedInVisualUrl(savedUrl ?? null);
    } else {
      setLinkedInVisualMode("CAROUSEL_PDF");
      setLinkedInVisualUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey]);

  const timing = useMemo(
    () => computeLocalOralTiming(blocks, wpm, preset),
    [blocks, wpm, preset]
  );

  const spec = DURATION_PRESET_META[preset];

  // Quality audit
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
      const exists = prev.includes(platform);
      if (exists) {
        if (prev.length <= 1) {
          showToast("error", "Debes mantener al menos una red social activa.");
          return prev;
        }
        return prev.filter((p) => p !== platform);
      }
      return [...prev, platform];
    });
  };

  const handleCleanSlopInBlocks = () => {
    let replacedCount = 0;
    const cleaned = blocks.map((blk) => {
      let voice = blk.audio_voiceover;
      for (const pat of AI_SLOP_PATTERNS) {
        if (pat.regex.test(voice)) {
          replacedCount++;
          voice = voice.replace(pat.regex, "").replace(/\s{2,}/g, " ").trim();
        }
        pat.regex.lastIndex = 0;
      }
      return { ...blk, audio_voiceover: voice };
    });

    if (replacedCount === 0) {
      showToast("info", "No se encontraron muletillas IA en los bloques de locución.");
      return;
    }

    setBlocks(cleaned);
    showToast("success", `Se eliminaron ${replacedCount} muletilla(s) IA de la locución.`);
    regeneratePlatformContents(cleaned);
  };

  // Block handlers
  const handleUpdateBlock = (
    index: number,
    field: keyof TwoColumnScriptBlock,
    value: string | number
  ) => {
    setBlocks((prev) => {
      const clone = [...prev];
      const target = { ...clone[index] };
      if (
        field === "pattern_interrupt_sec" ||
        field === "word_count" ||
        field === "estimated_seconds"
      ) {
        (target[field] as number) = Number(value) || 0;
      } else if (field === "pacing_warning") {
        (target[field] as boolean) = Boolean(value);
      } else {
        (target[field] as string) = String(value);
      }
      clone[index] = target;
      return clone;
    });
  };

  const handleAddBlock = () => {
    setBlocks((prev) => [
      ...prev,
      {
        block_id: `blk-${Date.now()}-${prev.length + 1}`,
        section_label: `Paso ${prev.length + 1}`,
        timecode: "00:00",
        visual_direction: "Zoom sutil 105%",
        b_roll_cue: "",
        on_screen_text: "PUNTO CLAVE",
        audio_voiceover: "Explica aquí tu siguiente punto con claridad y sin rodeos.",
        sfx_cue: "",
        music_cue: "",
        pattern_interrupt_sec: 3,
        word_count: 10,
        estimated_seconds: 5,
        pacing_warning: false,
      },
    ]);
  };

  const handleRemoveBlock = (index: number) => {
    if (blocks.length <= 1) {
      showToast("error", "El guión debe tener al menos un bloque.");
      return;
    }
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveLinkedInDraft = async (
    overrideVisualMode?: LinkedInVisualMode,
    overrideVisualUrl?: string | null
  ) => {
    if (!selectedDetail?.project) return;
    setSavingLinkedIn(true);
    const modeToSave = overrideVisualMode ?? linkedInVisualMode;
    const urlToSave = overrideVisualUrl !== undefined ? overrideVisualUrl : linkedInVisualUrl;
    const fullPostBody = linkedInBody.trim();

    try {
      const existingLi = selectedDetail.social_posts?.find((p) => p.channel === "LinkedIn");
      if (backendOnline) {
        let updatedPost = existingLi;
        if (existingLi) {
          updatedPost = await apiClient.updateSocialPost(existingLi.id, {
            title: linkedInHook.trim(),
            post_body: fullPostBody,
            first_comment: linkedInFirstComment.trim(),
            metadata_payload: {
              visual_mode: modeToSave,
              visual_asset_url: urlToSave,
            },
          });
        } else {
          const createdPosts = await apiClient.generateSocialCopy({
            project_id: selectedDetail.project.id,
            headline: linkedInHook.trim() || selectedDetail.project.working_title,
            core_value: fullPostBody,
            debate_question: "¿Qué opinas al respecto?",
            conversion_goal: goal,
          });
          const createdLi = createdPosts.find((p) => p.channel === "LinkedIn");
          if (createdLi) {
            updatedPost = await apiClient.updateSocialPost(createdLi.id, {
              title: linkedInHook.trim(),
              post_body: fullPostBody,
              first_comment: linkedInFirstComment.trim(),
              metadata_payload: {
                visual_mode: modeToSave,
                visual_asset_url: urlToSave,
              },
            });
          }
        }
        if (updatedPost) {
          const nextPosts = selectedDetail.social_posts?.some((p) => p.id === updatedPost!.id)
            ? selectedDetail.social_posts.map((p) => (p.id === updatedPost!.id ? updatedPost! : p))
            : [...(selectedDetail.social_posts ?? []), updatedPost];
          setSelectedDetail({ ...selectedDetail, social_posts: nextPosts });
        }
        await onRefresh();
        showToast("success", "✅ Cambios de LinkedIn y formato visual guardados en el proyecto.");
      } else {
        const localPosts = (selectedDetail.social_posts ?? []).map((p) =>
          p.channel === "LinkedIn"
            ? {
                ...p,
                title: linkedInHook.trim(),
                post_body: fullPostBody,
                first_comment: linkedInFirstComment.trim(),
                metadata_payload: {
                  ...(p.metadata_payload ?? {}),
                  visual_mode: modeToSave,
                  visual_asset_url: urlToSave,
                },
              }
            : p
        );
        setSelectedDetail({ ...selectedDetail, social_posts: localPosts });
        showToast("info", "✅ Borrador de LinkedIn guardado localmente.");
      }
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Error al guardar el borrador de LinkedIn"
      );
    } finally {
      setSavingLinkedIn(false);
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

  // Dynamic Subtabs List based on selected platforms
  const subTabSpecs = useMemo<SubTabSpec[]>(() => {
    const list: SubTabSpec[] = [
      {
        id: "master",
        label: "📋 Guión Maestro (A/V)",
        shortLabel: "Guión A/V",
        icon: FileText,
      },
    ];

    if (targetPlatforms.includes("YouTube")) {
      list.push({
        id: "youtube",
        label: "🎬 YouTube",
        shortLabel: "YouTube",
        badge: "Shorts & 16:9",
        icon: PlaySquare,
      });
    }

    if (targetPlatforms.includes("Instagram")) {
      list.push({
        id: "instagram",
        label: "📸 Instagram",
        shortLabel: "Instagram",
        badge: "Reels & Grid 1:1",
        icon: Instagram,
      });
    }

    if (targetPlatforms.includes("TikTok")) {
      list.push({
        id: "tiktok",
        label: "🎵 TikTok",
        shortLabel: "TikTok",
        badge: "SEO & Loop",
        icon: Zap,
      });
    }

    if (targetPlatforms.includes("LinkedIn")) {
      list.push({
        id: "linkedin",
        label: "💼 LinkedIn",
        shortLabel: "LinkedIn",
        badge: "Zero-Link & PDF",
        icon: Briefcase,
      });
    }

    if (targetPlatforms.includes("X")) {
      list.push({
        id: "x",
        label: "🐦 X (Twitter)",
        shortLabel: "X",
        badge: "Hilo Viral",
        icon: Twitter,
      });
    }

    list.push({
      id: "config",
      label: "⚙️ Configuración & Redes",
      shortLabel: "Configuración",
      icon: Sliders,
    });

    return list;
  }, [targetPlatforms]);

  // Ensure activeSubTab is always valid
  useEffect(() => {
    const isValid = subTabSpecs.some((s) => s.id === activeSubTab);
    if (!isValid) {
      setActiveSubTab("master");
    }
  }, [subTabSpecs, activeSubTab]);

  const selectSubTab = (id: ScriptSubTabId, idx: number) => {
    setActiveSubTab(id);
    subTabRefs.current[idx]?.focus();
  };

  const handleSubTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    const count = subTabSpecs.length;
    let targetIndex = currentIndex;
    if (e.key === "ArrowRight") {
      targetIndex = (currentIndex + 1) % count;
    } else if (e.key === "ArrowLeft") {
      targetIndex = (currentIndex - 1 + count) % count;
    } else if (e.key === "Home") {
      targetIndex = 0;
    } else if (e.key === "End") {
      targetIndex = count - 1;
    } else {
      return;
    }
    e.preventDefault();
    selectSubTab(subTabSpecs[targetIndex].id, targetIndex);
  };

  if (!selectedDetail?.project) {
    return (
      <div className="bg-[#07090e] border border-slate-800 rounded-xl p-10 text-center text-slate-400">
        Selecciona un video en el Paso 1 para redactar su guión multiplataforma, posts y portadas.
      </div>
    );
  }

  const targetSeconds = Math.round((spec.durationRange[0] + spec.durationRange[1]) / 2);
  const timingDelta = timing.estimatedDurationSec - targetSeconds;
  const isOverLimit = timingDelta > 5;
  const isUnderLimit = timingDelta < -8;

  return (
    <div className="space-y-4">
      {/* Studio Header + Dynamic Navigation Bar */}
      <div className="bg-[#07090e] border border-slate-800/90 rounded-xl overflow-hidden shadow-xl shadow-black/40">
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
              {/* Quick platform badges */}
              <div className="flex flex-wrap items-center gap-1.5 ml-2">
                {targetPlatforms.map((plat) => (
                  <span
                    key={plat}
                    className="px-2 py-0.5 rounded-full bg-[#020306] border border-slate-700 text-[10px] font-mono font-semibold text-cyan-300"
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
                Trigger DM: {leadMagnetKeyword}
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

        {/* Dynamic Subtabs Navigation (Visores Especializados) */}
        <div
          role="tablist"
          aria-label="Visores por Red Social y Guión Maestro"
          className="bg-[#020306] px-2 sm:px-4 border-b border-slate-800/80 gap-1 overflow-x-auto flex"
        >
          {subTabSpecs.map((tab, idx) => {
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
                className={`inline-flex items-center gap-2 px-3.5 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                  isSelected
                    ? "text-cyan-300 border-cyan-400 bg-cyan-950/20"
                    : "text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-800"
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="rounded-full bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[9px] font-mono text-slate-300">
                    {tab.badge}
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
          className="bg-[#07090e] border border-violet-500/40 rounded-xl p-4 space-y-3"
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
                className="mt-1 w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
              />
            </label>
            <label className="text-xs text-slate-300">
              Audiencia Objetivo / Cliente Ideal (ICP)
              <input
                type="text"
                value={icpEdit}
                onChange={(e) => setIcpEdit(e.target.value)}
                className="mt-1 w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
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
      {/* 1. VISOR: GUIÓN MAESTRO (A/V)                                       */}
      {/* =================================================================== */}
      <div
        role="tabpanel"
        id="script-panel-master"
        aria-labelledby="script-subtab-master"
        hidden={activeSubTab !== "master"}
      >
        {activeSubTab === "master" && (
          <MasterScriptVisor
            blocks={blocks}
            hookVariants={hookVariants}
            selectedHookIndex={selectedHookIndex}
            preset={preset}
            wpm={wpm}
            wordCount={timing.wordCount}
            oralTimingSeconds={timing.estimatedDurationSec}
            spec={spec}
            timingDelta={timingDelta}
            isOverLimit={isOverLimit}
            isUnderLimit={isUnderLimit}
            qualityAudit={qualityAudit}
            antiSlopEnabled={antiSlopEnabled}
            onSelectHook={(idx) => {
              setSelectedHookIndex(idx);
              regeneratePlatformContents(blocks, hookVariants[idx]?.hook_text);
            }}
            onUpdateBlock={handleUpdateBlock}
            onAddBlock={handleAddBlock}
            onRemoveBlock={handleRemoveBlock}
            onOpenTeleprompter={() => setShowTeleprompter(true)}
            onOpenExporter={() => setShowExporter(true)}
            onCleanSlop={handleCleanSlopInBlocks}
            onCopy={handleCopy}
            copiedKey={copiedKey}
          />
        )}
      </div>

      {/* =================================================================== */}
      {/* 2. VISOR: YOUTUBE                                                   */}
      {/* =================================================================== */}
      {targetPlatforms.includes("YouTube") && (
        <div
          role="tabpanel"
          id="script-panel-youtube"
          aria-labelledby="script-subtab-youtube"
          hidden={activeSubTab !== "youtube"}
        >
          {activeSubTab === "youtube" && (
            <YouTubePlatformVisor
              assetCode={selectedDetail.project.asset_code}
              projectTitle={selectedDetail.project.working_title}
              abVariants={selectedDetail.project.ab_variants ?? []}
              blocks={blocks}
              activeHook={activeHook}
              videoTitle={ytSeoTitle}
              videoDescription={ytDescription}
              seoKeywords={seoKeywords}
              leadMagnetKeyword={leadMagnetKeyword}
              deliveryUrl={activeLeadMagnetDeliveryUrl}
              onUpdateTitle={setYtSeoTitle}
              onUpdateDescription={setYtDescription}
              onOpenTeleprompter={() => setShowTeleprompter(true)}
              onCopy={handleCopy}
              copiedKey={copiedKey}
              onSyncFromMaster={() => {
                regeneratePlatformContents();
                showToast("success", "Visor de YouTube sincronizado desde el Guión Maestro.");
              }}
            />
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. VISOR: INSTAGRAM                                                 */}
      {/* =================================================================== */}
      {targetPlatforms.includes("Instagram") && (
        <div
          role="tabpanel"
          id="script-panel-instagram"
          aria-labelledby="script-subtab-instagram"
          hidden={activeSubTab !== "instagram"}
        >
          {activeSubTab === "instagram" && (
            <InstagramPlatformVisor
              assetCode={selectedDetail.project.asset_code}
              projectTitle={selectedDetail.project.working_title}
              abVariants={selectedDetail.project.ab_variants ?? []}
              blocks={blocks}
              activeHook={activeHook}
              reelCaption={igReelCaption}
              manychatKeyword={leadMagnetKeyword}
              hashtags={seoKeywords}
              onUpdateCaption={setIgReelCaption}
              onOpenTeleprompter={() => setShowTeleprompter(true)}
              onCopy={handleCopy}
              copiedKey={copiedKey}
              onSyncFromMaster={() => {
                regeneratePlatformContents();
                showToast("success", "Visor de Instagram sincronizado desde el Guión Maestro.");
              }}
            />
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. VISOR: TIKTOK                                                    */}
      {/* =================================================================== */}
      {targetPlatforms.includes("TikTok") && (
        <div
          role="tabpanel"
          id="script-panel-tiktok"
          aria-labelledby="script-subtab-tiktok"
          hidden={activeSubTab !== "tiktok"}
        >
          {activeSubTab === "tiktok" && (
            <TikTokPlatformVisor
              assetCode={selectedDetail.project.asset_code}
              projectTitle={selectedDetail.project.working_title}
              abVariants={selectedDetail.project.ab_variants ?? []}
              blocks={blocks}
              activeHook={activeHook}
              tiktokCaption={tiktokCaption}
              searchHook={tiktokSearchHook}
              hashtags={seoKeywords}
              onUpdateCaption={setTiktokCaption}
              onUpdateSearchHook={setTiktokSearchHook}
              onOpenTeleprompter={() => setShowTeleprompter(true)}
              onCopy={handleCopy}
              copiedKey={copiedKey}
              onSyncFromMaster={() => {
                regeneratePlatformContents();
                showToast("success", "Visor de TikTok sincronizado desde el Guión Maestro.");
              }}
            />
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. VISOR: LINKEDIN                                                  */}
      {/* =================================================================== */}
      {targetPlatforms.includes("LinkedIn") && (
        <div
          role="tabpanel"
          id="script-panel-linkedin"
          aria-labelledby="script-subtab-linkedin"
          hidden={activeSubTab !== "linkedin"}
        >
          {activeSubTab === "linkedin" && (
            <LinkedInPlatformVisor
              assetCode={selectedDetail.project.asset_code}
              projectTitle={selectedDetail.project.working_title}
              authorName={creatorProfile?.name || "Kike Gallego"}
              abVariants={selectedDetail.project.ab_variants ?? []}
              blocks={blocks}
              activeHook={activeHook}
              linkedInHook={linkedInHook}
              linkedInBody={linkedInBody}
              linkedInFirstComment={linkedInFirstComment}
              visualMode={linkedInVisualMode}
              visualAssetUrl={linkedInVisualUrl}
              saving={savingLinkedIn}
              onUpdateHook={setLinkedInHook}
              onUpdateBody={setLinkedInBody}
              onUpdateFirstComment={setLinkedInFirstComment}
              onChangeVisualMode={setLinkedInVisualMode}
              onUpdateVisualAssetUrl={setLinkedInVisualUrl}
              onSave={handleSaveLinkedInDraft}
              onCopy={handleCopy}
              copiedKey={copiedKey}
              onSyncFromMaster={() => {
                regeneratePlatformContents();
                showToast("success", "Visor de LinkedIn sincronizado desde el Guión Maestro.");
              }}
            />
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. VISOR: X / TWITTER                                               */}
      {/* =================================================================== */}
      {targetPlatforms.includes("X") && (
        <div
          role="tabpanel"
          id="script-panel-x"
          aria-labelledby="script-subtab-x"
          hidden={activeSubTab !== "x"}
        >
          {activeSubTab === "x" && (
            <XPlatformVisor
              assetCode={selectedDetail.project.asset_code}
              projectTitle={selectedDetail.project.working_title}
              abVariants={selectedDetail.project.ab_variants ?? []}
              blocks={blocks}
              activeHook={activeHook}
              singleTweet={xSingleTweet}
              threadTweets={xThreadTweets}
              leadMagnetKeyword={leadMagnetKeyword}
              onUpdateSingleTweet={setXSingleTweet}
              onUpdateThreadTweet={(index, val) => {
                setXThreadTweets((prev) => {
                  const clone = [...prev];
                  clone[index] = val;
                  return clone;
                });
              }}
              onAddThreadTweet={() => {
                setXThreadTweets((prev) => [
                  ...prev,
                  `${prev.length + 1}/ Añade tu siguiente punto clave aquí.`,
                ]);
              }}
              onRemoveThreadTweet={(index) => {
                setXThreadTweets((prev) => prev.filter((_, i) => i !== index));
              }}
              onCopy={handleCopy}
              copiedKey={copiedKey}
              onSyncFromMaster={() => {
                regeneratePlatformContents();
                showToast("success", "Visor de X sincronizado desde el Guión Maestro.");
              }}
            />
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 7. VISOR: CONFIGURACIÓN & REDES                                     */}
      {/* =================================================================== */}
      <div
        role="tabpanel"
        id="script-panel-config"
        aria-labelledby="script-subtab-config"
        hidden={activeSubTab !== "config"}
      >
        {activeSubTab === "config" && (
          <ScriptConfigPanel
            targetPlatforms={targetPlatforms}
            preset={preset}
            goal={goal}
            wpm={wpm}
            leadMagnetKeyword={leadMagnetKeyword}
            manychatTriggers={manychatTriggers}
            antiSlopEnabled={antiSlopEnabled}
            contrarianHookEnabled={contrarianHookEnabled}
            requireVerifiableData={requireVerifiableData}
            qualityAudit={qualityAudit}
            onTogglePlatform={handleTogglePlatform}
            onSetPreset={setPreset}
            onSetGoal={setGoal}
            onSetWpm={setWpm}
            onSetLeadMagnetKeyword={setLeadMagnetKeyword}
            onSetAntiSlop={setAntiSlopEnabled}
            onSetContrarianHook={setContrarianHookEnabled}
            onSetRequireVerifiableData={setRequireVerifiableData}
            onCleanSlop={handleCleanSlopInBlocks}
          />
        )}
      </div>

      {/* Full-Screen Teleprompter Modal */}
      <TeleprompterModal
        isOpen={showTeleprompter}
        onClose={() => setShowTeleprompter(false)}
        title={selectedDetail.project.working_title}
        assetCode={selectedDetail.project.asset_code}
        blocks={blocks}
        initialWpm={wpm}
        selectedHookText={activeHook?.hook_text}
      />

      {/* Multi-Format Script Exporter Modal */}
      <ScriptExporterModal
        isOpen={showExporter}
        onClose={() => setShowExporter(false)}
        title={selectedDetail.project.working_title}
        assetCode={selectedDetail.project.asset_code}
        preset={preset}
        wpm={wpm}
        blocks={blocks}
        selectedHookText={activeHook?.hook_text}
        abVariants={selectedDetail.project.ab_variants ?? []}
      />
    </div>
  );
}
