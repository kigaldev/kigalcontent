"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Film,
  Image as ImageIcon,
  Monitor,
  Send,
  Smartphone,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import {
  onlyRealHeatmap,
  buildLocalDateTimeToUtcIso,
  COMMON_TIMEZONES,
  findNextBestSlot,
  formatDateKey,
  formatFriendlyDateEs,
  formatTimeInTz,
  TIMEZONE_LABELS,
} from "@/lib/scheduling";
import { copyPreservingLineBreaks } from "@/lib/unicodeFormat";
import { runLocalPreflight } from "@/lib/utils";
import { useEngineStore } from "@/store/useEngineStore";
import { RichTextToolbar } from "@/components/RichTextToolbar";
import {
  AstryxBadge,
  AstryxButton,
  AstryxSwitch,
} from "@/components/ui/AstryxPrimitives";
import type {
  BestTimeHeatmapResponse,
  CreatorProfile,
  PublishingCalendarResponse,
  SocialChannel,
  SocialPost,
} from "@/types/engine";

export type ComposerPublishMode =
  | "SCHEDULED"
  | "DRAFT"
  | "MANUAL_REMINDER"
  | "PUBLISH_NOW";

export type ComposerVisualMode =
  | "NONE"
  | "CAROUSEL_PDF"
  | "IMAGE_INFOGRAPHIC"
  | "VIDEO_9_16";

export interface MetricoolPostComposerModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  initialDate?: string;
  initialTime?: string;
  timezone?: string;
  editingPost?: SocialPost | null;
  connectedChannels?: PublishingCalendarResponse["connected_channels"];
  creatorProfile?: CreatorProfile | null;
  activeProjectId?: string | null;
  heatmap?: BestTimeHeatmapResponse | null;
  initialTitle?: string;
  initialBody?: string;
  initialFirstComment?: string;
  initialChannels?: SocialChannel[];
  initialPublishMode?: ComposerPublishMode;
}

const ALL_CHANNELS: SocialChannel[] = [
  "LinkedIn",
  "Instagram",
  "TikTok",
  "YouTube",
];

const VISUAL_MODES: Array<{
  id: ComposerVisualMode;
  label: string;
  icon: typeof FileText;
}> = [
  { id: "NONE", label: "Solo Texto", icon: FileText },
  { id: "CAROUSEL_PDF", label: "Carrusel PDF", icon: FileText },
  { id: "IMAGE_INFOGRAPHIC", label: "Imagen / Infografía", icon: ImageIcon },
  { id: "VIDEO_9_16", label: "Video 9:16", icon: Film },
];

interface ChannelOverrideDraft {
  title: string;
  post_body: string;
  first_comment: string;
}

function normalizeVisualMode(raw: unknown): ComposerVisualMode {
  if (
    raw === "NONE" ||
    raw === "CAROUSEL_PDF" ||
    raw === "IMAGE_INFOGRAPHIC" ||
    raw === "VIDEO_9_16"
  ) {
    return raw;
  }
  return "NONE";
}

function parseHashtagsInput(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
}

export function MetricoolPostComposerModal({
  open,
  onClose,
  onSaved,
  initialDate,
  initialTime,
  timezone: propTimezone = "Europe/Madrid",
  editingPost = null,
  connectedChannels,
  creatorProfile,
  activeProjectId,
  heatmap,
  initialTitle,
  initialBody,
  initialFirstComment,
  initialChannels,
  initialPublishMode,
}: MetricoolPostComposerModalProps) {
  const {
    backendOnline,
    showToast,
  } = useEngineStore();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  // Form state
  const [selectedChannels, setSelectedChannels] = useState<SocialChannel[]>([
    "LinkedIn",
  ]);
  const [customizePerChannel, setCustomizePerChannel] = useState(false);
  const [activeEditorChannel, setActiveEditorChannel] =
    useState<SocialChannel>("LinkedIn");

  const [masterTitle, setMasterTitle] = useState("");
  const [masterBody, setMasterBody] = useState("");
  const [masterFirstComment, setMasterFirstComment] = useState("");
  const [overrides, setOverrides] = useState<
    Partial<Record<SocialChannel, ChannelOverrideDraft>>
  >({});

  const [autoFirstComment, setAutoFirstComment] = useState(true);
  const [hashtagsRaw, setHashtagsRaw] = useState("");
  const [visualMode, setVisualMode] = useState<ComposerVisualMode>("NONE");
  const [mediaUrl, setMediaUrl] = useState("");

  const [publishMode, setPublishMode] =
    useState<ComposerPublishMode>("SCHEDULED");
  const [dateStr, setDateStr] = useState(() =>
    formatDateKey(new Date(), propTimezone)
  );
  const [timeStr, setTimeStr] = useState("09:00");
  const [timezone, setTimezone] = useState(propTimezone);
  const [autoPublish, setAutoPublish] = useState(true);

  // Preview state
  const [previewChannel, setPreviewChannel] =
    useState<SocialChannel>("LinkedIn");
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">(
    "desktop"
  );
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [findingBestSlot, setFindingBestSlot] = useState(false);
  const [bestSlotScore, setBestSlotScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Native <dialog> open/close sync (modern-web-guidance: dialog)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Pointer-based light-dismiss fallback for browsers lacking <dialog closedby="any">
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if ("closedBy" in HTMLDialogElement.prototype) return;

    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (!dialog.open) return;
      pressedOutside = isOutside(e);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!dialog.open) return;
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener("pointerdown", handlePointerDown);
    dialog.addEventListener("pointerup", handlePointerUp);
    return () => {
      dialog.removeEventListener("pointerdown", handlePointerDown);
      dialog.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  // Re-initialize composer fields whenever modal opens or target editingPost changes
  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setBestSlotScore(null);
    const activeTz = editingPost?.timezone || propTimezone || "Europe/Madrid";
    setTimezone(activeTz);

    if (editingPost) {
      setSelectedChannels([editingPost.channel]);
      setActiveEditorChannel(editingPost.channel);
      setPreviewChannel(editingPost.channel);
      setCustomizePerChannel(false);
      setOverrides({});

      setMasterTitle(editingPost.title ?? "");
      setMasterBody(editingPost.post_body ?? "");
      setMasterFirstComment(editingPost.first_comment ?? "");
      setAutoFirstComment(
        Boolean(editingPost.first_comment?.trim()) ||
          editingPost.channel === "LinkedIn"
      );
      setHashtagsRaw((editingPost.hashtags ?? []).join(" "));

      const meta = editingPost.metadata_payload ?? {};
      setVisualMode(normalizeVisualMode(meta.visual_mode));
      setMediaUrl(
        typeof meta.visual_asset_url === "string"
          ? meta.visual_asset_url
          : typeof meta.media_url === "string"
          ? meta.media_url
          : ""
      );

      const statusUpper = (editingPost.publish_status ?? "").toUpperCase();
      if (initialPublishMode) {
        setPublishMode(initialPublishMode);
        setAutoPublish(
          initialPublishMode === "SCHEDULED"
            ? editingPost.auto_publish ?? true
            : initialPublishMode === "PUBLISH_NOW"
        );
      } else if (
        statusUpper === "MANUAL_REMINDER" ||
        (statusUpper !== "DRAFT" && editingPost.auto_publish === false)
      ) {
        setPublishMode("MANUAL_REMINDER");
        setAutoPublish(false);
      } else if (statusUpper === "DRAFT" && !editingPost.scheduled_at) {
        setPublishMode("DRAFT");
        setAutoPublish(false);
      } else {
        setPublishMode("SCHEDULED");
        setAutoPublish(editingPost.auto_publish ?? true);
      }

      if (editingPost.scheduled_at) {
        setDateStr(formatDateKey(editingPost.scheduled_at, activeTz));
        setTimeStr(formatTimeInTz(editingPost.scheduled_at, activeTz));
      } else {
        setDateStr(initialDate || formatDateKey(new Date(), activeTz));
        setTimeStr(initialTime || "09:00");
      }
    } else {
      const chans: SocialChannel[] =
        initialChannels && initialChannels.length > 0
          ? initialChannels
          : ["LinkedIn"];
      setSelectedChannels(chans);
      setActiveEditorChannel(chans[0]);
      setPreviewChannel(chans[0]);
      setCustomizePerChannel(false);
      setOverrides({});

      setMasterTitle(initialTitle ?? "");
      setMasterBody(initialBody ?? "");
      setMasterFirstComment(initialFirstComment ?? "");
      setAutoFirstComment(true);
      setHashtagsRaw("");
      setVisualMode("NONE");
      setMediaUrl("");

      setPublishMode(initialPublishMode ?? "SCHEDULED");
      setAutoPublish(
        initialPublishMode === "DRAFT" || initialPublishMode === "MANUAL_REMINDER"
          ? false
          : true
      );
      setDateStr(initialDate || formatDateKey(new Date(), activeTz));
      setTimeStr(initialTime || "09:00");
    }
  }, [
    editingPost,
    initialBody,
    initialChannels,
    initialDate,
    initialFirstComment,
    initialPublishMode,
    initialTime,
    initialTitle,
    open,
    propTimezone,
  ]);

  const handleDialogClose = () => {
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.returnValue = "";
    }
    onClose();
  };

  const toggleChannel = (ch: SocialChannel) => {
    if (editingPost) return; // Keep existing post bound to its channel
    setSelectedChannels((prev) => {
      const next = prev.includes(ch)
        ? prev.length > 1
          ? prev.filter((c) => c !== ch)
          : prev
        : [...prev, ch];
      if (!next.includes(activeEditorChannel)) {
        setActiveEditorChannel(next[0]);
      }
      if (!next.includes(previewChannel)) {
        setPreviewChannel(next[0]);
      }
      return next;
    });
  };

  // Current editor values (Master Copy vs Per-Channel Override)
  const currentEditorValues = useMemo(() => {
    if (!customizePerChannel) {
      return {
        title: masterTitle,
        post_body: masterBody,
        first_comment: masterFirstComment,
      };
    }
    const ov = overrides[activeEditorChannel];
    return {
      title: ov?.title ?? masterTitle,
      post_body: ov?.post_body ?? masterBody,
      first_comment: ov?.first_comment ?? masterFirstComment,
    };
  }, [
    activeEditorChannel,
    customizePerChannel,
    masterBody,
    masterFirstComment,
    masterTitle,
    overrides,
  ]);

  const updateCurrentEditorField = (
    field: "title" | "post_body" | "first_comment",
    value: string
  ) => {
    if (!customizePerChannel) {
      if (field === "title") setMasterTitle(value);
      else if (field === "post_body") setMasterBody(value);
      else setMasterFirstComment(value);
      return;
    }

    setOverrides((prev) => {
      const existing = prev[activeEditorChannel] ?? {
        title: masterTitle,
        post_body: masterBody,
        first_comment: masterFirstComment,
      };
      return {
        ...prev,
        [activeEditorChannel]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const parsedHashtags = useMemo(
    () => parseHashtagsInput(hashtagsRaw),
    [hashtagsRaw]
  );

  const preflight = useMemo(
    () =>
      runLocalPreflight(
        activeEditorChannel,
        currentEditorValues.title || null,
        currentEditorValues.post_body,
        parsedHashtags,
        autoFirstComment ? currentEditorValues.first_comment || null : null
      ),
    [
      activeEditorChannel,
      autoFirstComment,
      currentEditorValues.first_comment,
      currentEditorValues.post_body,
      currentEditorValues.title,
      parsedHashtags,
    ]
  );

  const previewValues = useMemo(() => {
    if (!customizePerChannel) {
      return {
        title: masterTitle,
        post_body: masterBody,
        first_comment: masterFirstComment,
      };
    }
    const ov = overrides[previewChannel];
    return {
      title: ov?.title ?? masterTitle,
      post_body: ov?.post_body ?? masterBody,
      first_comment: ov?.first_comment ?? masterFirstComment,
    };
  }, [
    customizePerChannel,
    masterBody,
    masterFirstComment,
    masterTitle,
    overrides,
    previewChannel,
  ]);

  const handleFindNextBestSlot = async () => {
    setFindingBestSlot(true);
    try {
      let hm: BestTimeHeatmapResponse;
      if (heatmap && heatmap.channel === activeEditorChannel && heatmap.timezone === timezone) {
        hm = heatmap;
      } else {
        hm = await apiClient.getBestTimes(activeEditorChannel, timezone);
      }
      hm = onlyRealHeatmap(hm, activeEditorChannel, timezone);
      const best = findNextBestSlot(hm, timezone);
      if (best.score <= 0) {
        showToast(
          "info",
          `Aún no hay datos de tus publicaciones en ${activeEditorChannel} para sugerir una hora. Elígela tú.`
        );
        return;
      }
      setDateStr(best.dateStr);
      setTimeStr(best.timeStr);
      setBestSlotScore(best.score);
      if (publishMode === "DRAFT" || publishMode === "PUBLISH_NOW") {
        setPublishMode("SCHEDULED");
      }
      showToast(
        "info",
        `⚡ Mejor slot para ${activeEditorChannel}: ${formatFriendlyDateEs(
          best.dateStr
        )} a las ${best.timeStr} (${best.score}% afinidad).`
      );
    } finally {
      setFindingBestSlot(false);
    }
  };

  const handleCopyPreview = async () => {
    const fullText =
      previewValues.title && !previewValues.post_body.startsWith(previewValues.title)
        ? `${previewValues.title}\n\n${previewValues.post_body}`
        : previewValues.post_body;
    const ok = await copyPreservingLineBreaks(fullText);
    if (ok) {
      setCopiedPreview(true);
      showToast("success", `Copy de ${previewChannel} copiado con formato.`);
      setTimeout(() => setCopiedPreview(false), 2200);
    } else {
      showToast("error", "No se pudo copiar al portapapeles.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!masterBody.trim() && !currentEditorValues.post_body.trim()) {
      setErrorMsg("Escribe el texto de la publicación antes de guardar.");
      return;
    }

    const effectiveAutoPublish =
      publishMode === "DRAFT" || publishMode === "MANUAL_REMINDER"
        ? false
        : publishMode === "PUBLISH_NOW"
        ? true
        : autoPublish;

    const scheduledUtc =
      publishMode === "DRAFT"
        ? null
        : publishMode === "PUBLISH_NOW"
        ? new Date().toISOString()
        : buildLocalDateTimeToUtcIso(dateStr, timeStr, timezone);

    setSubmitting(true);
    try {
      if (!backendOnline) {
        showToast(
          "error",
          "Backend sin conexión: la publicación no se ha guardado."
        );
        return;
      }

      if (editingPost) {
        await apiClient.updateSocialPost(editingPost.id, {
          title: currentEditorValues.title.trim() || null,
          post_body: currentEditorValues.post_body,
          first_comment: autoFirstComment
            ? currentEditorValues.first_comment.trim() || null
            : null,
          hashtags: parsedHashtags,
          metadata_payload: {
            ...(editingPost.metadata_payload ?? {}),
            visual_mode: visualMode,
            visual_asset_url: mediaUrl.trim() || undefined,
          },
        });

        await apiClient.rescheduleSocialPost(editingPost.id, {
          scheduled_at: scheduledUtc,
          timezone,
          auto_publish: effectiveAutoPublish,
          publish_status:
            publishMode === "PUBLISH_NOW" ? "SCHEDULED" : publishMode,
        });

        if (publishMode === "PUBLISH_NOW" && editingPost.project_id) {
          await apiClient.publishSocial({
            project_id: editingPost.project_id,
            channels: [editingPost.channel],
            actor: "creator",
          });
        }

        showToast(
          "success",
          publishMode === "PUBLISH_NOW"
            ? `🚀 Publicación de ${editingPost.channel} enviada.`
            : `✅ Publicación de ${editingPost.channel} actualizada en el planificador.`
        );
      } else {
        const perChannelOverridesPayload: Record<
          string,
          { title?: string; post_body?: string; first_comment?: string }
        > = {};

        if (customizePerChannel) {
          for (const ch of selectedChannels) {
            const ov = overrides[ch];
            if (ov) {
              perChannelOverridesPayload[ch] = {
                title: ov.title || undefined,
                post_body: ov.post_body || masterBody,
                first_comment: autoFirstComment ? ov.first_comment : undefined,
              };
            }
          }
        }

        const res = await apiClient.createComposerPost({
          project_id: activeProjectId ?? null,
          channels: selectedChannels,
          title: masterTitle.trim() || null,
          post_body: masterBody.trim() || currentEditorValues.post_body,
          per_channel_overrides: customizePerChannel
            ? perChannelOverridesPayload
            : undefined,
          first_comment: autoFirstComment
            ? masterFirstComment.trim() || null
            : null,
          hashtags: parsedHashtags,
          media_url: mediaUrl.trim() || null,
          visual_mode: visualMode,
          publish_mode: publishMode,
          scheduled_at: scheduledUtc,
          timezone,
          auto_publish: effectiveAutoPublish,
        });

        showToast(
          "success",
          publishMode === "PUBLISH_NOW"
            ? `🚀 Publicado en ${res.created_count} canal(es).`
            : publishMode === "DRAFT"
            ? `📝 Borrador guardado para ${selectedChannels.join(", ")}.`
            : `📅 ${res.created_count} publicación(es) programada(s) para ${formatFriendlyDateEs(
                dateStr
              )} ${timeStr}.`
        );
      }

      await onSaved();
      dialogRef.current?.close();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error al guardar la publicación."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const authorName = creatorProfile?.name?.trim() || "Kike Gallego";
  const authorInitial = authorName.charAt(0).toUpperCase() || "K";
  const foldLimit =
    previewChannel === "LinkedIn"
      ? 135
      : previewChannel === "Instagram"
      ? 120
      : 100;

  const fullPreviewText = useMemo(() => {
    const t = previewValues.title?.trim();
    const b = previewValues.post_body ?? "";
    if (t && !b.startsWith(t)) {
      return `${t}\n\n${b}`.trim();
    }
    return b;
  }, [previewValues.post_body, previewValues.title]);

  const submitLabel =
    publishMode === "DRAFT"
      ? "Guardar Borrador"
      : publishMode === "MANUAL_REMINDER"
      ? "Guardar Recordatorio"
      : publishMode === "PUBLISH_NOW"
      ? "Publicar Ahora"
      : editingPost
      ? "Guardar Cambios"
      : "Programar Publicación";

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby={titleId}
      onClose={handleDialogClose}
      className="composer-dialog"
    >
      {open && (
        <form
          onSubmit={handleSubmit}
          className="flex max-h-[90dvh] flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-[var(--kc-border)] bg-[var(--kc-surface)] px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="text-sm sm:text-base font-bold text-white truncate"
                >
                  {editingPost
                    ? `Editar Publicación · ${editingPost.channel}`
                    : "Compositor Multicanal Metricool Studio"}
                </h2>
                <p className="text-[11px] text-slate-400 truncate">
                  {editingPost
                    ? "Edita el copy, primer comentario o reprograma la fecha de salida."
                    : "Redacta una vez o personaliza por red con vista previa en vivo y publicación directa."}
                </p>
              </div>
              {activeProjectId && (
                <AstryxBadge label="Vinculado a Proyecto" variant="cyan" />
              )}
            </div>

            <button
              type="button"
              onClick={() => dialogRef.current?.close("cancel")}
              aria-label="Cerrar compositor"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Split-Screen Content */}
          <div className="grid lg:grid-cols-12 flex-1 min-h-0 overflow-y-auto">
            {/* LEFT COLUMN: Editor */}
            <div className="lg:col-span-7 p-5 space-y-4 border-b lg:border-b-0 lg:border-r border-[var(--kc-border)]">
              {/* Channel Multi-Select Toggles */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Canales de destino
                  </span>
                  {!editingPost && (
                    <AstryxSwitch
                      label="Personalizar texto por red"
                      value={customizePerChannel}
                      onChange={setCustomizePerChannel}
                      size="sm"
                    />
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {ALL_CHANNELS.map((ch) => {
                    const selected = selectedChannels.includes(ch);
                    const info = connectedChannels?.[ch];
                    const isLive = Boolean(info?.configured);
                    return (
                      <button
                        key={ch}
                        type="button"
                        disabled={Boolean(editingPost)}
                        onClick={() => toggleChannel(ch)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          selected
                            ? "border-cyan-400 bg-cyan-500/15 text-cyan-200"
                            : "border-[var(--kc-border)] bg-[var(--kc-canvas)] text-slate-400 hover:text-slate-200"
                        } ${editingPost ? "cursor-default" : ""}`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isLive ? "bg-emerald-400" : "bg-slate-500"
                          }`}
                        />
                        <span>{ch}</span>
                        <span className="text-[10px] opacity-75">
                          {isLive
                            ? info?.account_name || "En Vivo"
                            : "Sin conectar"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Per-Channel Tabs when customizePerChannel is ON */}
              {customizePerChannel && !editingPost && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] p-1">
                  {selectedChannels.map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => {
                        setActiveEditorChannel(ch);
                        setPreviewChannel(ch);
                      }}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                        activeEditorChannel === ch
                          ? "bg-cyan-500 text-slate-950"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      Editando: {ch}
                    </button>
                  ))}
                </div>
              )}

              {/* Title / Hook Input */}
              <label className="block space-y-1 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span>
                    {activeEditorChannel === "YouTube"
                      ? "Título en YouTube (<60 caracteres)"
                      : "Título / Gancho inicial (Hook)"}
                  </span>
                  <span className="font-mono text-[11px] text-cyan-300">
                    {currentEditorValues.title.length} chars
                  </span>
                </div>
                <input
                  type="text"
                  autoFocus
                  value={currentEditorValues.title}
                  onChange={(e) =>
                    updateCurrentEditorField("title", e.target.value)
                  }
                  placeholder="Ej. Por qué el 80% de los equipos B2B pierden demos en el primer mensaje"
                  className="w-full rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </label>

              {/* RichTextToolbar + Copy Textarea + Preflight */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-300 font-medium">
                    Texto de la publicación (Copy)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-400">
                      {currentEditorValues.post_body.length} caracteres
                    </span>
                    <AstryxBadge
                      label={
                        preflight.passed ? "Reglas cumplidas" : "Requiere ajuste"
                      }
                      variant={preflight.passed ? "success" : "warning"}
                    />
                  </div>
                </div>

                <RichTextToolbar
                  value={currentEditorValues.post_body}
                  onChange={(nextVal) =>
                    updateCurrentEditorField("post_body", nextVal)
                  }
                  inputRef={bodyTextareaRef}
                />

                <textarea
                  ref={bodyTextareaRef}
                  rows={7}
                  value={currentEditorValues.post_body}
                  onChange={(e) =>
                    updateCurrentEditorField("post_body", e.target.value)
                  }
                  placeholder="Escribe aquí tu publicación. Usa la barra superior para negritas Unicode, viñetas y emojis compatibles con LinkedIn..."
                  className="w-full rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-3 py-2.5 text-xs leading-relaxed text-slate-100 focus:outline-none focus:border-cyan-400"
                />

                {preflight.messages.length > 0 && (
                  <ul className="space-y-1 rounded-lg border border-amber-500/35 bg-amber-950/30 p-2.5 text-[11px] text-amber-200">
                    {preflight.messages.map((msg, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
                        <span>{msg}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Hashtags */}
              <label className="block space-y-1 text-xs text-slate-300">
                <span>Hashtags (separados por espacio o coma)</span>
                <input
                  type="text"
                  value={hashtagsRaw}
                  onChange={(e) => setHashtagsRaw(e.target.value)}
                  placeholder="#B2B #Growth #Automatizacion"
                  className="w-full rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </label>

              {/* LinkedIn First Comment Section (Zero-Link protection) */}
              {selectedChannels.includes("LinkedIn") && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-emerald-200">
                      Primer Comentario Automático (Protección Zero-Link -60% alcance)
                    </span>
                    <AstryxSwitch
                      label="Publicar primer comentario automático"
                      value={autoFirstComment}
                      onChange={setAutoFirstComment}
                      size="sm"
                    />
                  </div>
                  {autoFirstComment && (
                    <input
                      type="text"
                      value={currentEditorValues.first_comment}
                      onChange={(e) =>
                        updateCurrentEditorField("first_comment", e.target.value)
                      }
                      placeholder="Ej. Descarga la guía completa y plantilla aquí: https://..."
                      className="w-full rounded-lg border border-emerald-500/35 bg-[var(--kc-canvas)] px-3 py-2 text-xs text-emerald-100 focus:outline-none focus:border-emerald-400"
                    />
                  )}
                </div>
              )}

              {/* Visual Mode Pills */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">
                  Formato visual adjunto
                </span>
                <div className="flex flex-wrap gap-2">
                  {VISUAL_MODES.map((vm) => {
                    const Icon = vm.icon;
                    const active = visualMode === vm.id;
                    return (
                      <button
                        key={vm.id}
                        type="button"
                        onClick={() => setVisualMode(vm.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                            : "border-[var(--kc-border)] bg-[var(--kc-canvas)] text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{vm.label}</span>
                      </button>
                    );
                  })}
                </div>

                {visualMode !== "NONE" && (
                  <input
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="URL de imagen, PDF o video 9:16 (opcional)"
                    className="w-full rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                )}
              </div>

              {/* Bottom Scheduling Bar */}
              <div className="rounded-xl border border-[var(--kc-border)] bg-[var(--kc-surface)] p-3.5 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: "SCHEDULED", label: "Programar", icon: Calendar },
                      { id: "DRAFT", label: "Borrador", icon: FileText },
                      {
                        id: "MANUAL_REMINDER",
                        label: "Recordatorio Manual",
                        icon: Clock,
                      },
                      { id: "PUBLISH_NOW", label: "Publicar Ahora", icon: Send },
                    ] as const
                  ).map((m) => {
                    const Icon = m.icon;
                    const active = publishMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setPublishMode(m.id);
                          if (m.id === "MANUAL_REMINDER" || m.id === "DRAFT") {
                            setAutoPublish(false);
                          } else {
                            setAutoPublish(true);
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                          active
                            ? "border-cyan-400 bg-cyan-500 text-slate-950"
                            : "border-[var(--kc-border)] bg-[var(--kc-canvas)] text-slate-300 hover:text-white"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                {(publishMode === "SCHEDULED" ||
                  publishMode === "MANUAL_REMINDER") && (
                  <div className="grid gap-2.5 sm:grid-cols-12 items-end">
                    <label className="sm:col-span-4 text-[11px] text-slate-300 space-y-1">
                      <span>Fecha</span>
                      <input
                        type="date"
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                        className="w-full rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                        required
                      />
                    </label>
                    <label className="sm:col-span-3 text-[11px] text-slate-300 space-y-1">
                      <span>Hora ({timezone.split("/").pop()})</span>
                      <input
                        type="time"
                        value={timeStr}
                        onChange={(e) => setTimeStr(e.target.value)}
                        className="w-full rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                        required
                      />
                    </label>
                    <label className="sm:col-span-5 text-[11px] text-slate-300 space-y-1">
                      <span>Zona horaria</span>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                      >
                        {COMMON_TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>
                            {TIMEZONE_LABELS[tz] ?? tz}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="sm:col-span-12 flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleFindNextBestSlot}
                        disabled={findingBestSlot}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition"
                      >
                        <Zap className="h-3.5 w-3.5 text-cyan-400" />
                        <span>
                          {findingBestSlot
                            ? "Calculando..."
                            : "⚡ Próxima Mejor Hora"}
                        </span>
                      </button>
                      {bestSlotScore !== null && (
                        <span className="text-[11px] font-semibold text-emerald-300">
                          ✓ Slot óptimo ({bestSlotScore}% afinidad) aplicado
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Auto-Publish */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--kc-border)] pt-3">
                  <AstryxSwitch
                    label="Auto-publicar en API"
                    description="Publicación automática en la fecha y hora programadas"
                    value={autoPublish}
                    onChange={(val) => {
                      setAutoPublish(val);
                      if (!val && publishMode === "SCHEDULED") {
                        setPublishMode("MANUAL_REMINDER");
                      } else if (val && publishMode === "MANUAL_REMINDER") {
                        setPublishMode("SCHEDULED");
                      }
                    }}
                    size="sm"
                  />
                </div>

                {errorMsg && (
                  <div className="rounded-lg border border-rose-500/50 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
                    {errorMsg}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <AstryxButton
                    variant="ghost"
                    size="md"
                    label="Cancelar"
                    onClick={() => dialogRef.current?.close("cancel")}
                  />
                  <AstryxButton
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={submitting}
                    label={submitLabel}
                  />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Live Social Feed Preview */}
            <div className="lg:col-span-5 bg-[#04060c] p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                {/* Preview Channel + Viewport Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--kc-border)] pb-3">
                  <div className="flex flex-wrap gap-1">
                    {selectedChannels.map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setPreviewChannel(ch)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                          previewChannel === ch
                            ? "bg-sky-500/20 border border-sky-400/60 text-sky-200"
                            : "text-slate-400 hover:text-white border border-transparent"
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex rounded-lg border border-[var(--kc-border)] bg-[var(--kc-panel)] p-0.5">
                    <button
                      type="button"
                      onClick={() => setPreviewViewport("desktop")}
                      aria-label="Vista previa escritorio"
                      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition ${
                        previewViewport === "desktop"
                          ? "bg-slate-800 text-cyan-300"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                      <span>Desktop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewViewport("mobile")}
                      aria-label="Vista previa móvil"
                      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition ${
                        previewViewport === "mobile"
                          ? "bg-slate-800 text-cyan-300"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      <span>Móvil</span>
                    </button>
                  </div>
                </div>

                {/* Feed Card Preview */}
                <div
                  className={`rounded-2xl border border-slate-700/90 bg-[#0d121d] p-4 space-y-3 shadow-xl transition-all ${
                    previewViewport === "mobile" ? "max-w-[330px] mx-auto" : "w-full"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white">
                        {authorInitial}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {authorName} · Tú
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {publishMode === "SCHEDULED"
                            ? `${formatFriendlyDateEs(dateStr)} · ${timeStr} · 🌐 ${previewChannel}`
                            : `Ahora · 🌐 ${previewChannel}`}
                        </div>
                      </div>
                    </div>
                    <AstryxBadge label={previewChannel} variant="info" />
                  </div>

                  {/* Post Text with Fold Cutoff Marker */}
                  <div className="text-xs text-slate-100 whitespace-pre-line leading-relaxed space-y-2">
                    {!fullPreviewText ? (
                      <p className="text-slate-500 italic">
                        Empieza a escribir en el editor izquierdo para ver la previsualización exacta en {previewChannel}...
                      </p>
                    ) : fullPreviewText.length <= foldLimit ? (
                      <p>{fullPreviewText}</p>
                    ) : (
                      <div>
                        <span>{fullPreviewText.slice(0, foldLimit)}</span>
                        <span className="mx-1 inline-flex items-center rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 font-mono text-[10px] font-bold text-amber-300">
                          {previewChannel === "LinkedIn"
                            ? `...ver más (${foldLimit} chars)`
                            : `...más (${foldLimit} chars)`}
                        </span>
                        <span className="text-slate-300">
                          {fullPreviewText.slice(foldLimit)}
                        </span>
                      </div>
                    )}
                    {parsedHashtags.length > 0 && (
                      <p className="text-sky-300 text-[11px]">
                        {parsedHashtags.join(" ")}
                      </p>
                    )}
                  </div>

                  {/* Attached Visual Mode Badge & Media Preview */}
                  {visualMode !== "NONE" && (
                    <div className="space-y-2">
                      {mediaUrl.trim() && visualMode === "IMAGE_INFOGRAPHIC" ? (
                        <div className="overflow-hidden rounded-lg border border-slate-700 bg-[#020306] flex justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={mediaUrl.trim()}
                            alt="Vista previa adjunta"
                            className="max-h-48 w-auto object-contain"
                          />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 px-3 py-2.5 text-[11px] text-sky-200 flex items-center justify-between">
                          <span>
                            {visualMode === "CAROUSEL_PDF"
                              ? "📄 Documento adjunto: Carrusel PDF"
                              : visualMode === "IMAGE_INFOGRAPHIC"
                              ? "🖼️ Imagen / Infografía adjunta"
                              : "🎬 Video Vertical 9:16 adjunto"}
                          </span>
                          <span className="font-mono text-[10px] text-sky-400">
                            {visualMode === "VIDEO_9_16" ? "9:16" : "4:5"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* First Comment Preview (LinkedIn) */}
                  {previewChannel === "LinkedIn" &&
                    autoFirstComment &&
                    previewValues.first_comment.trim() && (
                      <div className="border-t border-slate-800 pt-2.5 text-[11px] text-slate-300">
                        <span className="text-[10px] font-bold text-emerald-400 block mb-0.5">
                          💬 Primer comentario automático:
                        </span>
                        <span className="text-emerald-100">
                          {previewValues.first_comment}
                        </span>
                      </div>
                    )}
                </div>
              </div>

              {/* Copy Preserving Line Breaks Footer */}
              <div className="flex items-center justify-between gap-2 border-t border-[var(--kc-border)] pt-3">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Conserva saltos de línea y Unicode</span>
                </div>
                <AstryxButton
                  variant="secondary"
                  size="sm"
                  icon={
                    copiedPreview ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )
                  }
                  label={copiedPreview ? "¡Copiado!" : "Copiar con Formato"}
                  onClick={handleCopyPreview}
                />
              </div>
            </div>
          </div>
        </form>
      )}
    </dialog>
  );
}
