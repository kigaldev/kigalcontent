"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  CheckCircle2,
  Copy,
  Fingerprint,
  HelpCircle,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import { useEngineStore } from "@/store/useEngineStore";
import { apiClient } from "@/lib/api";
import { runLocalPreflight } from "@/lib/utils";
import { copyPreservingLineBreaks } from "@/lib/unicodeFormat";
import { RichTextToolbar } from "@/components/RichTextToolbar";
import type {
  BestTimeHeatmapResponse,
  PublishingCalendarResponse,
  SocialChannel,
  SocialPost,
} from "@/types/engine";
import { KigalChatDMAutomationHub } from "@/components/KigalChatDMAutomationHub";
import { MetricoolCalendarView } from "@/components/publishing/MetricoolCalendarView";
import {
  MetricoolPostComposerModal,
  type ComposerPublishMode,
} from "@/components/publishing/MetricoolPostComposerModal";
import { MetricoolAutolistsView } from "@/components/publishing/MetricoolAutolistsView";
import { AstryxButton } from "@/components/ui/AstryxPrimitives";

interface PublishingAndHitlViewProps {
  onRefresh: () => Promise<void>;
}

type PublishingSubTab =
  | "planner"
  | "copy-native"
  | "autolists"
  | "kigalchat-dm"
  | "hitl-audit";

const SUB_TABS: Array<{
  id: PublishingSubTab;
  label: string;
  shortLabel: string;
}> = [
  {
    id: "planner",
    label: "1. 📅 Planificador Editorial",
    shortLabel: "1. 📅 Planificador",
  },
  {
    id: "copy-native",
    label: "2. ✍️ Copy por Red & Huella Nativa",
    shortLabel: "2. ✍️ Copy & Huella",
  },
  {
    id: "autolists",
    label: "3. ♻️ Autolistas Evergreen",
    shortLabel: "3. ♻️ Autolistas",
  },
  {
    id: "kigalchat-dm",
    label: "4. 💬 KigalChat Auto-DM (Motor ManyChat Nativo)",
    shortLabel: "4. 💬 KigalChat DM",
  },
  {
    id: "hitl-audit",
    label: "5. 🚀 Publicación Directa & Historial",
    shortLabel: "5. 🚀 Publicar & Historial",
  },
];

const CHANNEL_TIPS: Record<SocialChannel, string> = {
  YouTube:
    "Título corto (<60 caracteres) para que no se corte en el móvil + marcas de tiempo (00:00).",
  Instagram:
    "Gancho inicial en menos de 120 caracteres antes del botón '...más' + 3 a 5 hashtags.",
  TikTok:
    "Palabras clave en los primeros 100 caracteres para búsquedas en TikTok + pregunta para abrir debate.",
  LinkedIn:
    "Sin enlaces en el texto (LinkedIn reduce alcance un 60%). El enlace va en el 1er comentario.",
};

const NATIVE_SIGNATURE_BY_CHANNEL: Record<
  SocialChannel,
  {
    editorLabel: string;
    supportsEditorSignature: boolean;
  }
> = {
  Instagram: {
    editorLabel: "Instagram Edits 1.4.0 / iPhone 16 Pro",
    supportsEditorSignature: true,
  },
  TikTok: {
    editorLabel: "CapCut 13.8.0 / TikTok Native Studio",
    supportsEditorSignature: true,
  },
  YouTube: {
    editorLabel: "YouTube Create 2.1.0",
    supportsEditorSignature: true,
  },
  LinkedIn: {
    editorLabel: "Master MP4 Limpio (-map_metadata -1 · bt709)",
    supportsEditorSignature: false,
  },
};

function inferAppliedSignaturePlatform(
  profile: Record<string, string> | undefined,
  explicitPlatform?: unknown
): "Instagram" | "TikTok" | "YouTube" | null {
  if (typeof explicitPlatform === "string") {
    const low = explicitPlatform.toLowerCase();
    if (low.includes("instagram")) return "Instagram";
    if (low.includes("tiktok")) return "TikTok";
    if (low.includes("youtube")) return "YouTube";
  }
  if (!profile) return null;
  const haystack = `${profile.encoder ?? ""} ${profile.comment ?? ""}`.toLowerCase();
  if (haystack.includes("instagram") || haystack.includes("ig_edits")) return "Instagram";
  if (haystack.includes("tiktok") || haystack.includes("capcut")) return "TikTok";
  if (haystack.includes("youtube") || haystack.includes("yt_create")) return "YouTube";
  return null;
}

export function PublishingAndHitlView({ onRefresh }: PublishingAndHitlViewProps) {
  const {
    selectedDetail,
    selectedProjectId,
    creatorProfile,
    auditLogs,
    backendOnline,
    showToast,
    setSelectedDetail,
  } = useEngineStore();

  const auditCaptionId = useId();
  const tabBaseId = useId();
  const subTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [activeSubTab, setActiveSubTab] = useState<PublishingSubTab>("planner");
  const [showTips, setShowTips] = useState(false);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<SocialChannel[]>([
    "YouTube",
    "Instagram",
    "TikTok",
    "LinkedIn",
  ]);
  const [publishing, setPublishing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const bodyTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Metricool Composer Modal + Calendar Sync State
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerOpts, setComposerOpts] = useState<{
    initialDate?: string;
    initialTime?: string;
    editingPost?: SocialPost | null;
    initialPublishMode?: ComposerPublishMode;
  }>({});
  const [calendarRefreshTick, setCalendarRefreshTick] = useState(0);
  const [calendarContext, setCalendarContext] = useState<{
    timezone: string;
    connectedChannels?: PublishingCalendarResponse["connected_channels"];
    heatmap: BestTimeHeatmapResponse | null;
  }>({
    timezone: "Europe/Madrid",
    connectedChannels: undefined,
    heatmap: null,
  });

  const handleCalendarContextSync = useCallback(
    (ctx: {
      timezone: string;
      connectedChannels: PublishingCalendarResponse["connected_channels"];
      heatmap: BestTimeHeatmapResponse | null;
    }) => {
      setCalendarContext(ctx);
    },
    []
  );

  const handleOpenComposer = useCallback(
    (opts: {
      initialDate?: string;
      initialTime?: string;
      editingPost?: SocialPost | null;
      initialPublishMode?: ComposerPublishMode;
    }) => {
      setComposerOpts(opts);
      setComposerOpen(true);
    },
    []
  );

  const handleCopyFormatted = async (key: string, text: string, label: string) => {
    const ok = await copyPreservingLineBreaks(text);
    if (ok) {
      setCopiedKey(key);
      showToast("success", `✅ ${label} copiado conservando saltos de línea y formato.`);
      setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 2500);
    } else {
      showToast("error", "No se pudo copiar al portapapeles.");
    }
  };

  useEffect(() => {
    if (selectedDetail?.social_posts) {
      setPosts(selectedDetail.social_posts);
    } else {
      setPosts([]);
    }
    if (selectedDetail?.project?.target_platforms?.length) {
      const allowed = selectedDetail.project.target_platforms.filter((p): p is SocialChannel =>
        ["YouTube", "Instagram", "TikTok", "LinkedIn"].includes(p)
      );
      if (allowed.length > 0) {
        setSelectedChannels(allowed);
      }
    }
  }, [selectedDetail]);

  const handleSubTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex = index;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % SUB_TABS.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + SUB_TABS.length) % SUB_TABS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = SUB_TABS.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const nextTab = SUB_TABS[nextIndex];
    setActiveSubTab(nextTab.id);
    subTabRefs.current[nextIndex]?.focus();
    subTabRefs.current[nextIndex]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  };

  const handleFieldChange = (
    postId: string,
    field: "title" | "post_body" | "first_comment",
    val: string
  ) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const updated = { ...p, [field]: val };
        const pf = runLocalPreflight(
          updated.channel,
          updated.title,
          updated.post_body,
          updated.hashtags,
          updated.first_comment
        );
        return {
          ...updated,
          preflight_passed: pf.passed,
          preflight_warnings: pf.messages,
        };
      })
    );
  };

  const handleSavePost = async (post: SocialPost) => {
    try {
      if (backendOnline) {
        const updated = await apiClient.updateSocialPost(post.id, {
          title: post.title,
          post_body: post.post_body,
          first_comment: post.first_comment,
          hashtags: post.hashtags,
        });
        setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
        setCalendarRefreshTick((t) => t + 1);
        showToast("success", `Texto para ${post.channel} guardado y validado.`);
      } else {
        showToast("error", "Backend sin conexión: el texto no se ha guardado.");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error guardando texto");
    }
  };

  const handleRegenerateMatrix = async () => {
    if (!selectedDetail?.project || !selectedProjectId) return;
    try {
      if (backendOnline) {
        const updated = await apiClient.generateSocialCopy({
          project_id: selectedProjectId,
          headline: selectedDetail.project.working_title,
          core_value: `Claves prácticas sobre ${selectedDetail.project.working_title}`,
          debate_question:
            "¿Qué métrica te parece más importante: clics o tiempo de retención?",
          conversion_goal: selectedDetail.project.conversion_goal,
        });
        setPosts(updated);
        setSelectedDetail({ ...selectedDetail, social_posts: updated });
        setCalendarRefreshTick((t) => t + 1);
        showToast("success", "Textos adaptados a cada red social con éxito.");
      } else {
        showToast("error", "Backend sin conexión: conecta el backend para regenerar los textos.");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error regenerando textos");
    }
  };

  const handlePublishLive = async () => {
    if (!selectedProjectId) return;
    setPublishing(true);
    try {
      if (!backendOnline) {
        showToast(
          "error",
          "Backend sin conexión: no se ha publicado nada. Conecta el backend para publicar."
        );
        return;
      }

      const res = await apiClient.publishSocial({
        project_id: selectedProjectId,
        channels: selectedChannels,
        actor: "creator",
      });
      await onRefresh();
      setCalendarRefreshTick((t) => t + 1);
      const pubs = res.publications ?? [];
      const channelsWhere = (pred: (p: (typeof pubs)[number]) => boolean) =>
        pubs
          .filter(pred)
          .map((p) => p.channel)
          .filter(Boolean);
      const isFailed = (p: (typeof pubs)[number]) =>
        (p.status ?? "").toUpperCase() === "FAILED";
      const isNotConfigured = (p: (typeof pubs)[number]) =>
        (p.status ?? "").toUpperCase() === "NOT_CONFIGURED" ||
        p.mode === "not_configured";
      const liveChannels = channelsWhere(
        (p) => p.mode === "live_oauth2" && !isFailed(p) && !isNotConfigured(p)
      );
      const notConnectedChannels = channelsWhere(
        (p) => !isFailed(p) && (isNotConfigured(p) || p.mode !== "live_oauth2")
      );
      const failedChannels = channelsWhere(isFailed);

      const parts: string[] = [];
      if (liveChannels.length > 0) {
        parts.push(`Publicado en: ${liveChannels.join(", ")}.`);
      }
      if (notConnectedChannels.length > 0) {
        parts.push(
          `Sin conectar (no se ha publicado): ${notConnectedChannels.join(", ")}. Guarda el token en 'Automatizaciones y APIs → Conexiones Oficiales'.`
        );
      }
      if (failedChannels.length > 0) {
        parts.push(`Error al publicar en: ${failedChannels.join(", ")}.`);
      }
      if (parts.length === 0) {
        parts.push("El servidor no ha devuelto ninguna publicación.");
      }
      const allLive =
        liveChannels.length > 0 &&
        notConnectedChannels.length === 0 &&
        failedChannels.length === 0;
      showToast(
        allLive ? "success" : liveChannels.length > 0 ? "info" : "error",
        parts.join(" ")
      );
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error en publicación");
    } finally {
      setPublishing(false);
    }
  };

  const toggleChannel = (ch: SocialChannel) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const qcReport = selectedDetail?.video_asset?.qc_report as
    | Record<string, unknown>
    | undefined;
  const qcNativeProfile = qcReport?.native_signature_profile as
    | Record<string, string>
    | undefined;
  const appliedSignaturePlatform = inferAppliedSignaturePlatform(
    qcNativeProfile,
    qcReport?.target_platform_signature ??
      qcNativeProfile?.target_platform ??
      qcNativeProfile?.platform
  );

  return (
    <div className="space-y-5">
      {/* Step Header */}
      <div className="nle-panel flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950">
              4
            </span>
            {selectedDetail?.project ? (
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold">
                {selectedDetail.project.asset_code}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 font-mono text-[11px] font-semibold">
                METRICOOL STUDIO
              </span>
            )}
            <h2 className="text-base font-bold text-white">
              Paso 4: Planificador Editorial, Copy Multicanal, Autolistas y Publicación
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Programa en el calendario visual con mapa de mejores horas, adapta el copy con huella nativa, activa Autolistas evergreen y publica directamente en tus redes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTips((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-[var(--kc-canvas)] text-slate-300 hover:text-white text-xs font-medium transition"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>{showTips ? "Ocultar Reglas" : "Ver Reglas por Red Social"}</span>
          </button>

          {selectedDetail?.project ? (
            <button
              type="button"
              onClick={handleRegenerateMatrix}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              Regenerar Textos con IA
            </button>
          ) : (
            <AstryxButton
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4" />}
              label="Nueva Publicación"
              onClick={() => handleOpenComposer({})}
            />
          )}
        </div>
      </div>

      {/* Explanatory Banner on Rules */}
      {showTips && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-xs text-slate-200 space-y-2">
          <div className="font-bold text-cyan-300 text-sm flex items-center gap-2">
            💡 ¿Por qué adaptamos el texto para cada red social?
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <div className="bg-[var(--kc-panel)] border border-[var(--kc-border)] rounded-lg p-3">
              <strong className="text-white block mb-1">YouTube:</strong>
              Los títulos de más de 60 caracteres se cortan en pantallas de móviles. Incluye marcas de tiempo para que el espectador navegue por capítulos.
            </div>
            <div className="bg-[var(--kc-panel)] border border-[var(--kc-border)] rounded-lg p-3">
              <strong className="text-white block mb-1">Instagram Reels:</strong>
              El usuario solo ve los primeros 120 caracteres antes de pulsar &quot;...más&quot;. El gancho debe ir al inicio y usar entre 3 y 5 hashtags bien elegidos.
            </div>
            <div className="bg-[var(--kc-panel)] border border-[var(--kc-border)] rounded-lg p-3">
              <strong className="text-white block mb-1">TikTok:</strong>
              TikTok funciona como un buscador: las primeras 100 palabras deben contener términos que la gente busque y una pregunta para incentivar comentarios.
            </div>
            <div className="bg-[var(--kc-panel)] border border-[var(--kc-border)] rounded-lg p-3">
              <strong className="text-white block mb-1">LinkedIn:</strong>
              Si incluyes enlaces en el texto principal, el algoritmo de LinkedIn reduce las visualizaciones un 60%. Ponemos el enlace en el primer comentario.
            </div>
          </div>
        </div>
      )}

      {/* 5 Sub-Tabs Navigation (single row, no dimension shifts on selected state) */}
      <div className="nle-panel px-2 sm:px-3 pt-1">
        <div
          role="tablist"
          aria-label="Subsecciones de Planificador, Copy, Autolistas, KigalChat Auto-DM y Publicación"
          className="flex items-center gap-1 sm:gap-2"
        >
          {SUB_TABS.map((tab, index) => {
            const isSelected = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  subTabRefs.current[index] = el;
                }}
                id={`${tabBaseId}-tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => {
                  setActiveSubTab(tab.id);
                  subTabRefs.current[index]?.scrollIntoView({
                    block: "nearest",
                    inline: "nearest",
                  });
                }}
                onKeyDown={(e) => handleSubTabKeyDown(e, index)}
                className={`inline-flex items-center gap-2 px-3 py-3 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                  isSelected
                    ? "text-cyan-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span className="hidden xl:inline">{tab.label}</span>
                <span className="xl:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-Tab 1: Planificador Editorial (Default, works with or without active project) */}
      <div
        role="tabpanel"
        id={`${tabBaseId}-panel-planner`}
        aria-labelledby={`${tabBaseId}-tab-planner`}
        hidden={activeSubTab !== "planner"}
      >
        <div>
          <MetricoolCalendarView
            creatorProfile={creatorProfile}
            activeProject={selectedDetail}
            onOpenComposer={handleOpenComposer}
            refreshTrigger={calendarRefreshTick}
            onContextSync={handleCalendarContextSync}
          />
        </div>
      </div>

      {/* Sub-Tab 2: Copy por Red & Huella Nativa */}
      <div
        role="tabpanel"
        id={`${tabBaseId}-panel-copy-native`}
        aria-labelledby={`${tabBaseId}-tab-copy-native`}
        hidden={activeSubTab !== "copy-native"}
      >
        <div className="space-y-5">
          {!selectedDetail?.project ? (
            <div className="nle-panel p-10 text-center space-y-3 text-slate-400">
              <p className="text-sm text-slate-300">
                Selecciona un proyecto en el Paso 1 para editar el copy multiplataforma con huella nativa, o crea una publicación directa en el Planificador.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <AstryxButton
                  variant="primary"
                  label="+ Crear Publicación en Planificador"
                  onClick={() => handleOpenComposer({})}
                />
                <AstryxButton
                  variant="secondary"
                  label="Ir al Planificador"
                  onClick={() => setActiveSubTab("planner")}
                />
              </div>
            </div>
          ) : (
            (() => {
              const targetPlats = selectedDetail.project.target_platforms ?? [];
              const visiblePosts =
                targetPlats.length > 0
                  ? posts.filter((p) =>
                      targetPlats.some((tp) => tp.toLowerCase() === p.channel.toLowerCase())
                    )
                  : posts;
              const isTextOnly = selectedDetail.project.content_format === "TEXT_ONLY";

              return (
                <>
                  <div
                    className={`grid gap-5 ${
                      visiblePosts.length === 1 ? "lg:grid-cols-12" : "md:grid-cols-2"
                    }`}
                  >
                    {visiblePosts.map((post) => {
                      const isSelected = selectedChannels.includes(post.channel);
                      const sigMeta = NATIVE_SIGNATURE_BY_CHANNEL[post.channel];
                      const isVideoProcessed = Boolean(selectedDetail.video_asset?.qc_passed);
                      const isExactNativeMatch = Boolean(
                        isVideoProcessed &&
                          appliedSignaturePlatform &&
                          appliedSignaturePlatform.toLowerCase() === post.channel.toLowerCase()
                      );
                      const isGenericVerified = Boolean(
                        isVideoProcessed && !appliedSignaturePlatform
                      );
                      const visualMode = String(
                        post.metadata_payload?.visual_mode || "CAROUSEL_PDF"
                      );
                      const visualAssetUrl = post.metadata_payload?.visual_asset_url as
                        | string
                        | undefined;

                      return (
                        <React.Fragment key={post.id}>
                          <div
                            className={`nle-panel p-4 space-y-3 transition ${
                              visiblePosts.length === 1 ? "lg:col-span-6" : ""
                            } ${
                              isSelected
                                ? "border-cyan-500/50 shadow-lg shadow-cyan-500/5"
                                : "opacity-75"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleChannel(post.channel)}
                                  className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-400"
                                />
                                <span className="text-sm font-bold text-white">
                                  {post.channel}
                                </span>
                              </label>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 ${
                                    post.preflight_passed
                                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                                      : "bg-rose-500/20 text-rose-300 border border-rose-500/50"
                                  }`}
                                >
                                  {post.preflight_passed ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" /> Reglas cumplidas
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle className="w-3 h-3" /> Requiere ajuste
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>

                            {/* Native Fingerprint Verification Badge (hidden on TEXT_ONLY) */}
                            {!isTextOnly && (
                              <div
                                className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                                  isExactNativeMatch ||
                                  (!sigMeta.supportsEditorSignature && isVideoProcessed)
                                    ? "border-emerald-500/35 bg-emerald-950/25 text-emerald-300"
                                    : isGenericVerified
                                    ? "border-cyan-500/30 bg-cyan-950/20 text-cyan-200"
                                    : "border-[var(--kc-border)] bg-[var(--kc-canvas)]/70 text-slate-400"
                                }`}
                              >
                                <span className="inline-flex items-center gap-1.5 min-w-0">
                                  <Fingerprint className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                                  <span className="truncate font-medium">
                                    {isExactNativeMatch
                                      ? `Huella Nativa Aplicada: ${
                                          qcNativeProfile?.encoder || sigMeta.editorLabel
                                        }`
                                      : !sigMeta.supportsEditorSignature && isVideoProcessed
                                      ? `Huella limpia (-map_metadata -1 · Rec.709)`
                                      : isVideoProcessed && appliedSignaturePlatform
                                      ? `MP4 limpio (-map_metadata -1) · Perfil activo: ${appliedSignaturePlatform}`
                                      : isGenericVerified
                                      ? `Master bt709 listo · Firma sugerida: ${sigMeta.editorLabel}`
                                      : `Sin procesar · Firma objetivo: ${sigMeta.editorLabel}`}
                                  </span>
                                </span>
                                <span className="font-mono text-[10px] shrink-0 opacity-85">
                                  {isExactNativeMatch ? "VERIFICADA" : "bt709"}
                                </span>
                              </div>
                            )}

                            <p className="text-[11px] text-slate-400">
                              {CHANNEL_TIPS[post.channel]}
                            </p>

                            {(post.channel === "YouTube" ||
                              post.channel === "Instagram" ||
                              post.channel === "LinkedIn") && (
                              <label className="block text-xs text-slate-300">
                                <div className="flex justify-between mb-1">
                                  <span>
                                    {post.channel === "YouTube"
                                      ? "Título en YouTube (menos de 60 letras)"
                                      : post.channel === "LinkedIn"
                                      ? "Gancho de apertura (antes de '...ver más')"
                                      : "Gancho primera línea (menos de 120 letras)"}
                                  </span>
                                  <span className="font-mono text-cyan-300 font-bold">
                                    {(post.title ?? "").length} caracteres
                                  </span>
                                </div>
                                <input
                                  type="text"
                                  value={post.title ?? ""}
                                  onChange={(e) =>
                                    handleFieldChange(post.id, "title", e.target.value)
                                  }
                                  className="w-full rounded-lg bg-[var(--kc-canvas)] border border-[var(--kc-border)] px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                                />
                              </label>
                            )}

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs text-slate-300">
                                <span>Texto de la publicación (Copy)</span>
                                <span className="font-mono text-slate-400">
                                  {post.post_body.length} caracteres
                                </span>
                              </div>
                              <RichTextToolbar
                                value={post.post_body}
                                onChange={(nextVal) =>
                                  handleFieldChange(post.id, "post_body", nextVal)
                                }
                                inputRef={{
                                  get current() {
                                    return bodyTextareaRefs.current[post.id] ?? null;
                                  },
                                }}
                              />
                              <textarea
                                ref={(el) => {
                                  bodyTextareaRefs.current[post.id] = el;
                                }}
                                rows={7}
                                value={post.post_body}
                                onChange={(e) =>
                                  handleFieldChange(post.id, "post_body", e.target.value)
                                }
                                className="w-full rounded-lg bg-[var(--kc-canvas)] border border-[var(--kc-border)] px-3 py-2 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-cyan-400"
                              />
                            </div>

                            {post.channel === "LinkedIn" && (
                              <label className="block text-xs text-slate-300">
                                Primer Comentario Automático (Enlace a tu web o recurso)
                                <input
                                  type="text"
                                  value={post.first_comment ?? ""}
                                  onChange={(e) =>
                                    handleFieldChange(
                                      post.id,
                                      "first_comment",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Ej. Descarga el recurso gratis aquí: https://..."
                                  className="mt-1 w-full rounded-lg bg-[var(--kc-canvas)] border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-200"
                                />
                              </label>
                            )}

                            {post.preflight_warnings.length > 0 && (
                              <ul className="space-y-1 text-xs text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded-lg p-2.5">
                                {post.preflight_warnings.map((w, idx) => (
                                  <li key={idx}>• {w}</li>
                                ))}
                              </ul>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              <span className="text-[11px] text-slate-500">
                                {isSelected ? "Seleccionada para publicar" : "No marcada"}
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenComposer({
                                      editingPost: post,
                                      initialPublishMode: "SCHEDULED",
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-xs font-semibold text-cyan-200 transition"
                                >
                                  <CalendarPlus className="w-3.5 h-3.5" />
                                  <span>📅 Programar en Planificador</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const fullText =
                                      post.title && !post.post_body.startsWith(post.title)
                                        ? `${post.title}\n\n${post.post_body}`
                                        : post.post_body;
                                    void handleCopyFormatted(
                                      `copy-card-${post.id}`,
                                      fullText,
                                      `Publicación de ${post.channel}`
                                    );
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-xs font-semibold text-sky-200 transition"
                                >
                                  {copiedKey === `copy-card-${post.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                  <span>Copiar con Formato</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSavePost(post)}
                                  className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 transition"
                                >
                                  Guardar Cambios
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Live Visual Feed Preview when single channel (e.g. LinkedIn only) */}
                          {visiblePosts.length === 1 && (
                            <div className="lg:col-span-6 nle-panel p-5 space-y-4 border-sky-500/30">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                                <div>
                                  <h4 className="text-sm font-bold text-white">
                                    Borrador Visual en {post.channel}
                                  </h4>
                                  <p className="text-[11px] text-slate-400">
                                    Copia el texto tal como se ve aquí (conserva saltos de línea, negritas y emojis).
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-bold">
                                    {visualMode === "NONE"
                                      ? "Solo Texto"
                                      : visualMode === "IMAGE_INFOGRAPHIC"
                                      ? "Con Imagen / Infografía"
                                      : "Con Carrusel PDF"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const fullText =
                                        post.title && !post.post_body.startsWith(post.title)
                                          ? `${post.title}\n\n${post.post_body}`
                                          : post.post_body;
                                      void handleCopyFormatted(
                                        `preview-copy-${post.id}`,
                                        fullText,
                                        `Borrador de ${post.channel}`
                                      );
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition shadow"
                                  >
                                    {copiedKey === `preview-copy-${post.id}` ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                    <span>
                                      {copiedKey === `preview-copy-${post.id}`
                                        ? "¡Copiado!"
                                        : "Copiar Publicación"}
                                    </span>
                                  </button>
                                </div>
                              </div>

                              <div className="rounded-xl border border-slate-700/90 bg-[#0d121d] p-4 space-y-3 shadow-xl">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                    K
                                  </div>
                                  <div>
                                    <div className="text-xs font-bold text-white">
                                      Kike Gallego · Tú
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      Ahora · 🌐 Público
                                    </div>
                                  </div>
                                </div>

                                <div className="text-xs text-slate-100 whitespace-pre-line leading-relaxed space-y-2">
                                  {post.title && (
                                    <p className="font-semibold text-white">{post.title}</p>
                                  )}
                                  <p>{post.post_body}</p>
                                </div>

                                {visualMode === "IMAGE_INFOGRAPHIC" && visualAssetUrl && (
                                  <div className="rounded-lg border border-slate-700 overflow-hidden bg-[#020306] flex justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={visualAssetUrl}
                                      alt="Preview visual"
                                      className="max-h-[260px] w-auto object-contain"
                                    />
                                  </div>
                                )}

                                {visualMode === "CAROUSEL_PDF" && (
                                  <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 px-3 py-2.5 text-[11px] text-sky-200 flex items-center justify-between">
                                    <span>
                                      📄 Documento adjunto: Carrusel de 5 diapositivas (PDF)
                                    </span>
                                    <span className="font-mono text-[10px] text-sky-400">
                                      4:5
                                    </span>
                                  </div>
                                )}

                                {post.first_comment && (
                                  <div className="border-t border-slate-800 pt-2.5 text-[11px] text-slate-300">
                                    <span className="text-[10px] font-bold text-cyan-400 block mb-0.5">
                                      💬 Primer comentario programado:
                                    </span>
                                    {post.first_comment}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveSubTab("kigalchat-dm")}
                      className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 transition"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Configurar KigalChat Auto-DM →
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab("hitl-audit")}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 transition"
                    >
                      <Send className="w-4 h-4" />
                      Ir a Publicar ahora →
                    </button>
                  </div>
                </>
              );
            })()
          )}
        </div>
      </div>

      {/* Sub-Tab 3: Autolistas Evergreen */}
      <div
        role="tabpanel"
        id={`${tabBaseId}-panel-autolists`}
        aria-labelledby={`${tabBaseId}-tab-autolists`}
        hidden={activeSubTab !== "autolists"}
      >
        <div>
          <MetricoolAutolistsView
            onAutolistChanged={() => setCalendarRefreshTick((t) => t + 1)}
          />
        </div>
      </div>

      {/* Sub-Tab 4: KigalChat Auto-DM (Motor ManyChat Nativo) */}
      <div
        role="tabpanel"
        id={`${tabBaseId}-panel-kigalchat-dm`}
        aria-labelledby={`${tabBaseId}-tab-kigalchat-dm`}
        hidden={activeSubTab !== "kigalchat-dm"}
      >
        <div className="space-y-4">
          <KigalChatDMAutomationHub />
        </div>
      </div>

      {/* Sub-Tab 5: Publicación Directa & Historial */}
      <div
        role="tabpanel"
        id={`${tabBaseId}-panel-hitl-audit`}
        aria-labelledby={`${tabBaseId}-tab-hitl-audit`}
        hidden={activeSubTab !== "hitl-audit"}
      >
        <div className="space-y-6">
          {/* Direct Publishing Panel */}
          <div className="nle-panel bg-gradient-to-r from-emerald-950/35 via-[var(--kc-panel)] to-[var(--kc-panel)] border-emerald-500/40 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Publicación Directa en Redes
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Publica en un solo clic en los canales activos seleccionados para este proyecto.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-400">Canales activos:</span>
                {selectedChannels.length > 0 ? (
                  selectedChannels.map((ch) => (
                    <span
                      key={ch}
                      className="rounded-md border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 font-semibold text-cyan-200"
                    >
                      {ch}
                    </span>
                  ))
                ) : (
                  <span className="text-rose-300 font-semibold">
                    Ninguno seleccionado
                  </span>
                )}
              </div>
            </div>

            {!selectedDetail?.project ? (
              <div className="rounded-lg border border-slate-700 bg-[var(--kc-canvas)]/70 p-4 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3">
                <span>
                  Selecciona un proyecto en el Paso 1 para publicar sus canales en lote, o programa directamente desde el Planificador.
                </span>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handlePublishLive}
                  disabled={publishing || selectedChannels.length === 0}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  {publishing
                    ? "Publicando en vivo..."
                    : `Publicar ahora (${selectedChannels.length} redes)`}
                </button>
              </div>
            )}
          </div>

          {/* Audit History Table */}
          <div className="nle-panel p-5 space-y-3">
            <h3 id={auditCaptionId} className="text-sm font-semibold text-slate-200">
              Historial de Publicaciones y Acciones Registradas
            </h3>
            <div
              tabIndex={0}
              role="region"
              aria-labelledby={auditCaptionId}
              className="table-wrapper bg-[var(--kc-canvas)]/70"
            >
              <table>
                <caption className="sr-only">
                  Historial de publicaciones y acciones registradas
                </caption>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="p-3 border-b border-[var(--kc-border)]">
                      Acción realizada
                    </th>
                    <th className="p-3 border-b border-[var(--kc-border)]">
                      Usuario / Sistema
                    </th>
                    <th className="p-3 border-b border-[var(--kc-border)]">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--kc-border)] text-xs">
                  {auditLogs.slice(0, 10).map((log) => (
                    <tr key={log.id}>
                      <th className="p-3 text-slate-200 font-semibold text-left">
                        {log.action_type}
                      </th>
                      <td data-label="Usuario" className="p-3 text-slate-300">
                        {log.agent_or_user_id}
                      </td>
                      <td data-label="Estado" className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                            log.operation_status === "FAILED"
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {log.operation_status === "FAILED"
                            ? "Error"
                            : "Completado"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Native <dialog> Split-Screen Metricool Post Composer */}
      <MetricoolPostComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSaved={async () => {
          setCalendarRefreshTick((t) => t + 1);
          await onRefresh();
        }}
        initialDate={composerOpts.initialDate}
        initialTime={composerOpts.initialTime}
        editingPost={composerOpts.editingPost}
        initialPublishMode={composerOpts.initialPublishMode}
        timezone={calendarContext.timezone}
        connectedChannels={calendarContext.connectedChannels}
        creatorProfile={creatorProfile}
        activeProjectId={selectedProjectId}
        heatmap={calendarContext.heatmap}
      />
    </div>
  );
}
