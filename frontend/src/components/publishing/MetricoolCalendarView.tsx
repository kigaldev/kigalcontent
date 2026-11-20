"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  List as ListIcon,
  Plus,
  RefreshCw,
  Repeat,
  Trash2,
  WifiOff,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import {
  buildFallbackHeatmap,
  buildLocalDateTimeToUtcIso,
  COMMON_TIMEZONES,
  formatDateKey,
  formatFriendlyDateEs,
  formatTimeInTz,
  getHourInTz,
  getMonthGrid,
  getWeekDays,
  MONTH_NAMES_ES,
  shiftDateStr,
  TIMEZONE_LABELS,
} from "@/lib/scheduling";
import { copyPreservingLineBreaks } from "@/lib/unicodeFormat";
import { useEngineStore } from "@/store/useEngineStore";
import {
  AstryxBadge,
  AstryxButton,
  AstryxSwitch,
} from "@/components/ui/AstryxPrimitives";
import type {
  BestTimeHeatmapResponse,
  CalendarProjectedSlot,
  CreatorProfile,
  ProjectDetail,
  PublishingCalendarResponse,
  SocialChannel,
  SocialPost,
} from "@/types/engine";

export interface MetricoolCalendarViewProps {
  creatorProfile?: CreatorProfile | null;
  activeProject?: ProjectDetail | null;
  onOpenComposer: (opts: {
    initialDate?: string;
    initialTime?: string;
    editingPost?: SocialPost | null;
  }) => void;
  refreshTrigger?: number;
  onContextSync?: (ctx: {
    timezone: string;
    connectedChannels: PublishingCalendarResponse["connected_channels"];
    heatmap: BestTimeHeatmapResponse | null;
  }) => void;
}

type CalendarViewMode = "week" | "month" | "list";

const CHANNELS: SocialChannel[] = ["LinkedIn", "Instagram", "TikTok", "YouTube"];
const GRID_HOURS = Array.from({ length: 15 }, (_, idx) => idx + 8); // 08:00 .. 22:00

const CHANNEL_STYLE: Record<
  SocialChannel,
  {
    stripe: string;
    pillActive: string;
    dot: string;
    short: string;
  }
> = {
  LinkedIn: {
    stripe: "border-l-sky-400",
    pillActive: "border-sky-400/70 bg-sky-500/15 text-sky-200",
    dot: "bg-sky-400",
    short: "in",
  },
  Instagram: {
    stripe: "border-l-pink-400",
    pillActive: "border-pink-400/70 bg-pink-500/15 text-pink-200",
    dot: "bg-pink-400",
    short: "IG",
  },
  TikTok: {
    stripe: "border-l-cyan-400",
    pillActive: "border-cyan-400/70 bg-cyan-500/15 text-cyan-200",
    dot: "bg-cyan-400",
    short: "TT",
  },
  YouTube: {
    stripe: "border-l-rose-500",
    pillActive: "border-rose-400/70 bg-rose-500/15 text-rose-200",
    dot: "bg-rose-500",
    short: "YT",
  },
};

function getHeatmapClass(score: number): string {
  if (score >= 88) return "metricool-heatmap-cell-5";
  if (score >= 75) return "metricool-heatmap-cell-4";
  if (score >= 60) return "metricool-heatmap-cell-3";
  if (score >= 40) return "metricool-heatmap-cell-2";
  if (score >= 20) return "metricool-heatmap-cell-1";
  return "metricool-heatmap-cell-0";
}

function getPostStatusBadge(post: SocialPost): {
  label: string;
  variant: "success" | "error" | "neutral" | "warning" | "cyan";
} {
  const status = (post.publish_status ?? "DRAFT").toUpperCase();
  if (status === "PUBLISHED") {
    return { label: "Publicado", variant: "success" };
  }
  if (status === "FAILED") {
    return { label: "Error", variant: "error" };
  }
  if (status === "DRAFT") {
    return { label: "Borrador", variant: "neutral" };
  }
  if (status === "MANUAL_REMINDER" || post.auto_publish === false) {
    return { label: "Manual", variant: "warning" };
  }
  return { label: "Auto", variant: "cyan" };
}

function inferFallbackConnectedChannels(
  creatorProfile?: CreatorProfile | null
): PublishingCalendarResponse["connected_channels"] {
  const sp = creatorProfile?.social_profiles ?? {};
  const accounts = creatorProfile?.social_accounts ?? [];

  const findAccountName = (ch: SocialChannel): string => {
    const match = accounts.find(
      (a) => a.platform.toLowerCase() === ch.toLowerCase()
    );
    if (match?.label) return match.label;
    if (ch === "LinkedIn") return sp.linkedin_vanity_name || creatorProfile?.name || "";
    if (ch === "Instagram") return sp.instagram_username || "";
    if (ch === "TikTok") return sp.tiktok_username || "";
    return sp.youtube_channel_id || "";
  };

  return {
    LinkedIn: {
      configured: false,
      account_name: findAccountName("LinkedIn"),
      source: "none",
      person_urn: "",
    },
    Instagram: {
      configured: false,
      account_name: findAccountName("Instagram"),
      source: "none",
      person_urn: "",
    },
    TikTok: {
      configured: false,
      account_name: findAccountName("TikTok"),
      source: "none",
      person_urn: "",
    },
    YouTube: {
      configured: false,
      account_name: findAccountName("YouTube"),
      source: "none",
      person_urn: "",
    },
  };
}

export function MetricoolCalendarView({
  creatorProfile,
  activeProject,
  onOpenComposer,
  refreshTrigger = 0,
  onContextSync,
}: MetricoolCalendarViewProps) {
  const { backendOnline, showToast } = useEngineStore();

  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [timezone, setTimezone] = useState<string>("Europe/Madrid");
  const [channelFilter, setChannelFilter] = useState<SocialChannel | "ALL">("ALL");
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [heatmapChannel, setHeatmapChannel] = useState<SocialChannel>("LinkedIn");

  const [calendarData, setCalendarData] = useState<PublishingCalendarResponse>(() => ({
    posts: activeProject?.social_posts ?? [],
    projected_autolist_slots: [],
    connected_channels: inferFallbackConnectedChannels(creatorProfile),
    timezone: "Europe/Madrid",
  }));
  const [heatmapData, setHeatmapData] = useState<BestTimeHeatmapResponse>(() =>
    buildFallbackHeatmap("LinkedIn", "Europe/Madrid")
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [isOfflineFallback, setIsOfflineFallback] = useState<boolean>(false);
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
  const [dragOverCellKey, setDragOverCellKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const weekDays = useMemo(
    () => getWeekDays(anchorDate, timezone),
    [anchorDate, timezone]
  );

  const monthGrid = useMemo(
    () => getMonthGrid(anchorDate, timezone),
    [anchorDate, timezone]
  );

  const dateRangeBounds = useMemo(() => {
    if (viewMode === "week") {
      const first = weekDays[0]?.dateStr ?? formatDateKey(anchorDate, timezone);
      const last = weekDays[6]?.dateStr ?? first;
      return {
        start: buildLocalDateTimeToUtcIso(first, "00:00:00", timezone),
        end: buildLocalDateTimeToUtcIso(last, "23:59:59", timezone),
      };
    }
    if (viewMode === "month") {
      const first = monthGrid[0]?.dateStr ?? formatDateKey(anchorDate, timezone);
      const last =
        monthGrid[monthGrid.length - 1]?.dateStr ?? formatDateKey(anchorDate, timezone);
      return {
        start: buildLocalDateTimeToUtcIso(first, "00:00:00", timezone),
        end: buildLocalDateTimeToUtcIso(last, "23:59:59", timezone),
      };
    }
    const baseKey = formatDateKey(anchorDate, timezone);
    return {
      start: buildLocalDateTimeToUtcIso(shiftDateStr(baseKey, -14), "00:00:00", timezone),
      end: buildLocalDateTimeToUtcIso(shiftDateStr(baseKey, 30), "23:59:59", timezone),
    };
  }, [anchorDate, monthGrid, timezone, viewMode, weekDays]);

  const loadCalendarAndHeatmap = useCallback(async () => {
    setLoading(true);
    try {
      const [calRes, hmRes] = await Promise.all([
        apiClient.getPublishingCalendar({
          start: dateRangeBounds.start,
          end: dateRangeBounds.end,
          channel: channelFilter === "ALL" ? undefined : channelFilter,
        }),
        apiClient.getBestTimes(heatmapChannel, timezone),
      ]);
      setCalendarData(calRes);
      setHeatmapData(hmRes);
      setIsOfflineFallback(false);
    } catch {
      const fallbackPosts = (activeProject?.social_posts ?? []).filter((p) =>
        channelFilter === "ALL" ? true : p.channel === channelFilter
      );
      setCalendarData({
        posts: fallbackPosts,
        projected_autolist_slots: [],
        connected_channels: inferFallbackConnectedChannels(creatorProfile),
        timezone,
      });
      setHeatmapData(buildFallbackHeatmap(heatmapChannel, timezone));
      setIsOfflineFallback(true);
    } finally {
      setLoading(false);
    }
  }, [
    activeProject?.social_posts,
    channelFilter,
    creatorProfile,
    dateRangeBounds.end,
    dateRangeBounds.start,
    heatmapChannel,
    timezone,
  ]);

  useEffect(() => {
    void loadCalendarAndHeatmap();
  }, [loadCalendarAndHeatmap, refreshTrigger, backendOnline]);

  useEffect(() => {
    onContextSync?.({
      timezone,
      connectedChannels: calendarData.connected_channels,
      heatmap: heatmapData,
    });
  }, [calendarData.connected_channels, heatmapData, onContextSync, timezone]);

  const heatmapLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const slot of heatmapData.grid ?? []) {
      map.set(`${slot.day_of_week}-${slot.hour}`, slot.score);
    }
    return map;
  }, [heatmapData]);

  const handleNavigate = (direction: -1 | 0 | 1) => {
    if (direction === 0) {
      setAnchorDate(new Date());
      return;
    }
    const next = new Date(anchorDate);
    if (viewMode === "month") {
      next.setDate(1);
      next.setMonth(next.getMonth() + direction);
    } else if (viewMode === "list") {
      next.setDate(next.getDate() + direction * 14);
    } else {
      next.setDate(next.getDate() + direction * 7);
    }
    setAnchorDate(next);
  };

  const rangeHeaderText = useMemo(() => {
    if (viewMode === "month") {
      const center = monthGrid[15]?.dateStr ?? formatDateKey(anchorDate, timezone);
      const [y, m] = center.split("-").map(Number);
      return `${MONTH_NAMES_ES[(m || 1) - 1]} ${y}`;
    }
    const first = weekDays[0]?.dateStr ?? "";
    const last = weekDays[6]?.dateStr ?? "";
    if (!first || !last) return "";
    return `${formatFriendlyDateEs(first)} — ${formatFriendlyDateEs(last)}`;
  }, [anchorDate, monthGrid, timezone, viewMode, weekDays]);

  // Bucket scheduled posts & projected autolist slots by dateStr and hour
  const { scheduledBySlot, offHoursPosts, unscheduledDrafts, projectedBySlot } =
    useMemo(() => {
      const bySlot = new Map<string, SocialPost[]>();
      const offHours = new Map<string, SocialPost[]>();
      const drafts: SocialPost[] = [];
      const projSlot = new Map<string, CalendarProjectedSlot[]>();

      for (const post of calendarData.posts ?? []) {
        if (channelFilter !== "ALL" && post.channel !== channelFilter) continue;
        if (!post.scheduled_at) {
          drafts.push(post);
          continue;
        }
        const dKey = formatDateKey(post.scheduled_at, timezone);
        const h = getHourInTz(post.scheduled_at, timezone);
        if (h < 8 || h > 22) {
          const list = offHours.get(dKey) ?? [];
          list.push(post);
          offHours.set(dKey, list);
        } else {
          const key = `${dKey}__${h}`;
          const list = bySlot.get(key) ?? [];
          list.push(post);
          bySlot.set(key, list);
        }
      }

      for (const slot of calendarData.projected_autolist_slots ?? []) {
        if (channelFilter !== "ALL" && slot.channel !== channelFilter) continue;
        const dKey = formatDateKey(slot.scheduled_at, timezone);
        const h = getHourInTz(slot.scheduled_at, timezone);
        const clampedH = Math.max(8, Math.min(22, h));
        const key = `${dKey}__${clampedH}`;
        const list = projSlot.get(key) ?? [];
        list.push(slot);
        projSlot.set(key, list);
      }

      return {
        scheduledBySlot: bySlot,
        offHoursPosts: offHours,
        unscheduledDrafts: drafts,
        projectedBySlot: projSlot,
      };
    }, [calendarData, channelFilter, timezone]);

  const postsByDate = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const post of calendarData.posts ?? []) {
      if (channelFilter !== "ALL" && post.channel !== channelFilter) continue;
      if (!post.scheduled_at) continue;
      const dKey = formatDateKey(post.scheduled_at, timezone);
      const list = map.get(dKey) ?? [];
      list.push(post);
      map.set(dKey, list);
    }
    return map;
  }, [calendarData.posts, channelFilter, timezone]);

  const projectedByDate = useMemo(() => {
    const map = new Map<string, CalendarProjectedSlot[]>();
    for (const slot of calendarData.projected_autolist_slots ?? []) {
      if (channelFilter !== "ALL" && slot.channel !== channelFilter) continue;
      const dKey = formatDateKey(slot.scheduled_at, timezone);
      const list = map.get(dKey) ?? [];
      list.push(slot);
      map.set(dKey, list);
    }
    return map;
  }, [calendarData.projected_autolist_slots, channelFilter, timezone]);

  const handleDropToSlot = async (
    e: React.DragEvent,
    targetDateStr: string,
    targetHour: number
  ) => {
    e.preventDefault();
    setDragOverCellKey(null);
    const transferredId = e.dataTransfer.getData("text/plain") || draggedPostId;
    setDraggedPostId(null);
    if (!transferredId) return;

    const post = calendarData.posts.find((p) => p.id === transferredId);
    if (!post) return;

    const hourStr = `${String(targetHour).padStart(2, "0")}:00`;
    const newUtcIso = buildLocalDateTimeToUtcIso(targetDateStr, hourStr, timezone);

    const previousPosts = calendarData.posts;
    const nextStatus =
      post.publish_status === "DRAFT"
        ? post.auto_publish
          ? "SCHEDULED"
          : "MANUAL_REMINDER"
        : post.publish_status;

    // Optimistic UI update
    setCalendarData((prev) => ({
      ...prev,
      posts: prev.posts.map((p) =>
        p.id === transferredId
          ? {
              ...p,
              scheduled_at: newUtcIso,
              timezone,
              publish_status: nextStatus,
            }
          : p
      ),
    }));

    try {
      if (!isOfflineFallback && backendOnline) {
        const updated = await apiClient.rescheduleSocialPost(transferredId, {
          scheduled_at: newUtcIso,
          timezone,
          ...(post.publish_status === "DRAFT" ? { publish_status: nextStatus } : {}),
        });
        setCalendarData((prev) => ({
          ...prev,
          posts: prev.posts.map((p) => (p.id === transferredId ? updated : p)),
        }));
      }
      showToast(
        "success",
        `Reprogramado en ${post.channel} para ${formatFriendlyDateEs(
          targetDateStr
        )} a las ${hourStr} (${timezone}).`
      );
    } catch (err) {
      setCalendarData((prev) => ({ ...prev, posts: previousPosts }));
      showToast(
        "error",
        err instanceof Error ? err.message : "No se pudo reprogramar la publicación."
      );
    }
  };

  const handleCopyPost = async (post: SocialPost, e: React.MouseEvent) => {
    e.stopPropagation();
    const fullText =
      post.title && !post.post_body.startsWith(post.title)
        ? `${post.title}\n\n${post.post_body}`
        : post.post_body;
    const ok = await copyPreservingLineBreaks(fullText);
    if (ok) {
      setCopiedId(post.id);
      showToast("success", `Copy de ${post.channel} copiado con saltos de línea.`);
      setTimeout(() => setCopiedId((cur) => (cur === post.id ? null : cur)), 2000);
    } else {
      showToast("error", "No se pudo copiar al portapapeles.");
    }
  };

  const handleDeletePost = async (post: SocialPost, e: React.MouseEvent) => {
    e.stopPropagation();
    const prevPosts = calendarData.posts;
    setCalendarData((prev) => ({
      ...prev,
      posts: prev.posts.filter((p) => p.id !== post.id),
    }));
    try {
      if (!isOfflineFallback && backendOnline) {
        await apiClient.deleteSocialPost(post.id);
      }
      showToast("success", `Publicación de ${post.channel} eliminada.`);
    } catch (err) {
      setCalendarData((prev) => ({ ...prev, posts: prevPosts }));
      showToast(
        "error",
        err instanceof Error ? err.message : "Error al eliminar la publicación."
      );
    }
  };

  const sortedListPosts = useMemo(() => {
    return [...(calendarData.posts ?? [])]
      .filter((p) => (channelFilter === "ALL" ? true : p.channel === channelFilter))
      .sort((a, b) => {
        if (!a.scheduled_at && !b.scheduled_at) return 0;
        if (!a.scheduled_at) return 1;
        if (!b.scheduled_at) return -1;
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      });
  }, [calendarData.posts, channelFilter]);

  const renderPostCard = (post: SocialPost, compact = false) => {
    const chStyle = CHANNEL_STYLE[post.channel] ?? CHANNEL_STYLE.LinkedIn;
    const badge = getPostStatusBadge(post);
    const timeLabel = post.scheduled_at
      ? formatTimeInTz(post.scheduled_at, timezone)
      : "Sin hora";
    const previewText = (post.title || post.post_body || "Sin texto").trim();

    return (
      <div
        key={post.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", post.id);
          e.dataTransfer.effectAllowed = "move";
          setDraggedPostId(post.id);
        }}
        onDragEnd={() => {
          setDraggedPostId(null);
          setDragOverCellKey(null);
        }}
        className={`group relative rounded-lg border border-slate-700/80 border-l-[3px] ${chStyle.stripe} bg-[#090e1a]/95 hover:border-cyan-500/60 transition shadow-sm ${
          draggedPostId === post.id ? "opacity-45 scale-[0.98]" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => onOpenComposer({ editingPost: post })}
          className={`w-full text-left block focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-lg ${
            compact ? "px-2 py-1" : "p-2"
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-1 pr-10">
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-slate-200">
              <span className={`h-1.5 w-1.5 rounded-full ${chStyle.dot}`} />
              <span>{chStyle.short}</span>
              <span className="text-slate-400">· {timeLabel}</span>
            </span>
          </div>

          <div className="mb-1">
            <AstryxBadge label={badge.label} variant={badge.variant} />
          </div>

          <p className="text-[11px] font-medium text-slate-100 line-clamp-2 leading-snug">
            {previewText}
          </p>
        </button>

        {/* Quick hover/focus actions (kept sibling to card button, never nested) */}
        <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => handleCopyPost(post, e)}
            title="Copiar con formato"
            aria-label={`Copiar publicación de ${post.channel}`}
            className="rounded p-1 bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/50 transition"
          >
            {copiedId === post.id ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => handleDeletePost(post, e)}
            title="Eliminar publicación"
            aria-label={`Eliminar publicación de ${post.channel}`}
            className="rounded p-1 bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-rose-400 hover:border-rose-500/50 transition"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  };

  const renderProjectedSlot = (slot: CalendarProjectedSlot) => {
    const ch = (CHANNELS.includes(slot.channel as SocialChannel)
      ? slot.channel
      : "LinkedIn") as SocialChannel;
    const timeLabel = formatTimeInTz(slot.scheduled_at, timezone);
    return (
      <button
        key={slot.id}
        type="button"
        onClick={() =>
          onOpenComposer({
            initialDate: formatDateKey(slot.scheduled_at, timezone),
            initialTime: timeLabel,
          })
        }
        title={`Slot proyectado de Autolista: ${slot.autolist_name}`}
        className="w-full text-left rounded-lg border border-dashed border-violet-500/65 bg-violet-950/30 hover:bg-violet-900/35 px-2 py-1.5 transition"
      >
        <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-violet-300">
          <span className="inline-flex items-center gap-1 truncate">
            <Repeat className="h-3 w-3 shrink-0" />
            <span>Autolista</span>
          </span>
          <span className="font-mono text-violet-200">{timeLabel}</span>
        </div>
        <div className="text-[10px] text-violet-200/80 truncate mt-0.5">
          {ch} · {slot.title || slot.autolist_name}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Connected Channels Strip (Metricool top bar) */}
      <div className="nle-panel p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
            Canales:
          </span>
          <button
            type="button"
            onClick={() => setChannelFilter("ALL")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              channelFilter === "ALL"
                ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                : "border-[var(--kc-border)] bg-[var(--kc-canvas)] text-slate-300 hover:border-slate-600"
            }`}
          >
            <span>Todos</span>
            <span className="font-mono text-[10px] opacity-80">
              ({calendarData.posts?.length ?? 0})
            </span>
          </button>

          {CHANNELS.map((ch) => {
            const info = calendarData.connected_channels?.[ch];
            const isActive = channelFilter === ch;
            const style = CHANNEL_STYLE[ch];
            const isLive = Boolean(info?.configured);
            const accountHint = info?.account_name?.trim();
            return (
              <button
                key={ch}
                type="button"
                onClick={() => {
                  const next = isActive ? "ALL" : ch;
                  setChannelFilter(next);
                  if (next !== "ALL") {
                    setHeatmapChannel(next);
                  }
                }}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? style.pillActive
                    : "border-[var(--kc-border)] bg-[var(--kc-canvas)] text-slate-300 hover:border-slate-600"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                <span>{ch}</span>
                {isLive ? (
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.2 text-[10px] font-bold text-emerald-300">
                    {accountHint ? `En Vivo · ${accountHint}` : "En Vivo"}
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-400">
                    {accountHint ? `${accountHint} · Sandbox` : "Sandbox"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {isOfflineFallback && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300">
              <WifiOff className="h-3 w-3" />
              Vista local
            </span>
          )}
          <button
            type="button"
            onClick={() => void loadCalendarAndHeatmap()}
            disabled={loading}
            title="Actualizar calendario y mejores horas"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-2.5 py-1.5 text-xs text-slate-300 hover:text-white transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>
        </div>
      </div>

      {/* Main Toolbar */}
      <div className="nle-panel p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        {/* Left: View Switcher + Date Nav */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] p-0.5">
            {(
              [
                { id: "week", label: "Semana", icon: CalendarIcon },
                { id: "month", label: "Mes", icon: CalendarIcon },
                { id: "list", label: "Lista", icon: ListIcon },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = viewMode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setViewMode(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-cyan-500 text-slate-950 shadow-sm"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleNavigate(-1)}
              aria-label="Periodo anterior"
              className="rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] p-1.5 text-slate-300 hover:text-white transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleNavigate(0)}
              className="rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-500/50 transition"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => handleNavigate(1)}
              aria-label="Periodo siguiente"
              className="rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] p-1.5 text-slate-300 hover:text-white transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="ml-2 text-sm font-bold text-white capitalize">
              {rangeHeaderText}
            </span>
          </div>
        </div>

        {/* Right: Timezone, Heatmap Toggle + Channel, Create Button */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-300">
            <Globe className="h-3.5 w-3.5 text-cyan-400" />
            <select
              aria-label="Zona horaria del planificador"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {TIMEZONE_LABELS[tz] ?? tz}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2 rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-2.5 py-1">
            <AstryxSwitch
              label="Mejores Horas"
              value={showHeatmap}
              onChange={setShowHeatmap}
              size="sm"
            />
            {showHeatmap && (
              <select
                aria-label="Red para mapa de calor de mejores horas"
                value={heatmapChannel}
                onChange={(e) => setHeatmapChannel(e.target.value as SocialChannel)}
                className="rounded border border-slate-700 bg-[var(--kc-panel)] px-2 py-0.5 text-[11px] text-cyan-300 focus:outline-none"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            )}
          </div>

          <AstryxButton
            variant="primary"
            size="md"
            label="+ Crear Publicación"
            onClick={() => onOpenComposer({})}
          />
        </div>
      </div>

      {/* Heatmap Legend Bar */}
      {showHeatmap && viewMode === "week" && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <Flame className="h-3.5 w-3.5 text-cyan-400" />
            <span>
              Mapa de audiencia <strong className="text-slate-200">{heatmapChannel}</strong>{" "}
              ({heatmapData.source === "analytics" ? "Datos históricos reales" : "Curva calibrada B2B/Creador"})
            </span>
            <span className="hidden sm:inline text-slate-500">·</span>
            <span className="text-cyan-300 font-medium">
              Pico semanal: {heatmapData.peak_slot?.day_label}{" "}
              {String(heatmapData.peak_slot?.hour ?? 9).padStart(2, "0")}:00 (
              {heatmapData.peak_slot?.score ?? 94}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Menor</span>
            {[0, 1, 2, 3, 4, 5].map((lvl) => (
              <span
                key={lvl}
                className={`h-3 w-5 rounded border border-slate-700/70 metricool-heatmap-cell-${lvl}`}
              />
            ))}
            <span>Óptimo (80%+)</span>
          </div>
        </div>
      )}

      {/* Unscheduled Drafts Tray (draggable onto any slot) */}
      {unscheduledDrafts.length > 0 && viewMode !== "list" && (
        <div className="nle-panel p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">
              📝 Borradores sin fecha ({unscheduledDrafts.length}) — arrastra uno a cualquier franja del calendario o haz clic para editar
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {unscheduledDrafts.map((post) => renderPostCard(post, true))}
          </div>
        </div>
      )}

      {/* VIEW 1: WEEK GRID VIEW */}
      {viewMode === "week" && (
        <div className="nle-panel overflow-x-auto">
          <div className="min-w-[840px]">
            {/* Sticky Day Header */}
            <div className="grid grid-cols-[68px_repeat(7,minmax(0,1fr))] border-b border-[var(--kc-border)] bg-[var(--kc-surface)]">
              <div className="p-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-center border-r border-[var(--kc-border)]">
                Hora
              </div>
              {weekDays.map((day) => (
                <div
                  key={day.dateStr}
                  className={`p-2.5 text-center border-r last:border-r-0 border-[var(--kc-border)] ${
                    day.isToday ? "bg-cyan-500/10" : ""
                  }`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {day.dayName}
                  </div>
                  <div
                    className={`mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                      day.isToday
                        ? "bg-cyan-400 text-slate-950"
                        : "text-slate-100"
                    }`}
                  >
                    {day.dayNumber}
                  </div>
                </div>
              ))}
            </div>

            {/* Off-hours scheduled posts (00:00-07:59 or 23:00-23:59) if any exist */}
            {Array.from(offHoursPosts.values()).some((arr) => arr.length > 0) && (
              <div className="grid grid-cols-[68px_repeat(7,minmax(0,1fr))] border-b border-[var(--kc-border)] bg-[#060911]">
                <div className="p-2 text-[10px] font-mono text-slate-400 flex items-center justify-center border-r border-[var(--kc-border)]">
                  Otras h
                </div>
                {weekDays.map((day) => {
                  const list = offHoursPosts.get(day.dateStr) ?? [];
                  return (
                    <div
                      key={`off-${day.dateStr}`}
                      className="p-1.5 border-r last:border-r-0 border-[var(--kc-border)] space-y-1.5"
                    >
                      {list.map((p) => renderPostCard(p))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Hour Rows: 08:00 - 22:00 */}
            {GRID_HOURS.map((hour) => {
              const hourStr = `${String(hour).padStart(2, "0")}:00`;
              return (
                <div
                  key={hour}
                  className="grid grid-cols-[68px_repeat(7,minmax(0,1fr))] border-b last:border-b-0 border-[var(--kc-border)]"
                >
                  <div className="p-2 text-[11px] font-mono text-slate-400 flex items-start justify-center border-r border-[var(--kc-border)] bg-[var(--kc-panel)]">
                    {hourStr}
                  </div>

                  {weekDays.map((day) => {
                    const cellKey = `${day.dateStr}__${hour}`;
                    const cellPosts = scheduledBySlot.get(cellKey) ?? [];
                    const cellProjected = projectedBySlot.get(cellKey) ?? [];
                    const score =
                      heatmapLookup.get(`${day.weekdayIdx}-${hour}`) ?? 0;
                    const heatmapClass = showHeatmap
                      ? getHeatmapClass(score)
                      : "bg-[var(--kc-canvas)]/40";
                    const isDragTarget = dragOverCellKey === cellKey;
                    const isEmpty = cellPosts.length === 0 && cellProjected.length === 0;

                    return (
                      <div
                        key={cellKey}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverCellKey !== cellKey) {
                            setDragOverCellKey(cellKey);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverCellKey === cellKey) {
                            setDragOverCellKey(null);
                          }
                        }}
                        onDrop={(e) => void handleDropToSlot(e, day.dateStr, hour)}
                        className={`group relative min-h-[78px] p-1.5 border-r last:border-r-0 border-[var(--kc-border)] transition ${heatmapClass} ${
                          day.isToday ? "ring-1 ring-inset ring-cyan-500/15" : ""
                        } ${
                          isDragTarget
                            ? "ring-2 ring-inset ring-cyan-400 bg-cyan-950/50"
                            : ""
                        }`}
                      >
                        {/* Top-right heatmap score badge for peak slots (>= 80%) */}
                        {showHeatmap && score >= 80 && (
                          <span
                            className="pointer-events-none absolute top-1 right-1 z-0 rounded bg-cyan-400/20 border border-cyan-400/40 px-1 py-0.5 font-mono text-[9px] font-bold text-cyan-200"
                            title={`Puntuación de audiencia: ${score}%`}
                          >
                            {score}%
                          </span>
                        )}

                        {isEmpty ? (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenComposer({
                                initialDate: day.dateStr,
                                initialTime: hourStr,
                              })
                            }
                            className="relative z-10 flex h-full min-h-[64px] w-full items-center justify-center rounded-md border border-dashed border-transparent text-[11px] font-semibold text-cyan-300 opacity-0 group-hover:opacity-100 group-hover:border-cyan-500/40 group-hover:bg-slate-950/60 focus-visible:opacity-100 focus-visible:border-cyan-400 transition"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Programar
                          </button>
                        ) : (
                          <div className="relative z-10 space-y-1.5">
                            {cellPosts.map((p) => renderPostCard(p))}
                            {cellProjected.map((slot) => renderProjectedSlot(slot))}
                            <button
                              type="button"
                              onClick={() =>
                                onOpenComposer({
                                  initialDate: day.dateStr,
                                  initialTime: hourStr,
                                })
                              }
                              title="Añadir otra publicación en esta franja"
                              className="w-full rounded border border-dashed border-slate-700/70 py-0.5 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 hover:border-cyan-500/50 hover:text-cyan-300 transition"
                            >
                              + Añadir aquí
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: MONTH VIEW */}
      {viewMode === "month" && (
        <div className="nle-panel overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[var(--kc-border)] bg-[var(--kc-surface)]">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <div
                key={d}
                className="p-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-r last:border-r-0 border-[var(--kc-border)]"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {monthGrid.map((cell) => {
              const dayPosts = postsByDate.get(cell.dateStr) ?? [];
              const dayProj = projectedByDate.get(cell.dateStr) ?? [];
              const isDragTarget = dragOverCellKey === `month-${cell.dateStr}`;

              return (
                <div
                  key={cell.dateStr}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverCellKey(`month-${cell.dateStr}`);
                  }}
                  onDragLeave={() => {
                    if (dragOverCellKey === `month-${cell.dateStr}`) {
                      setDragOverCellKey(null);
                    }
                  }}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData("text/plain") || draggedPostId;
                    const existing = calendarData.posts.find((p) => p.id === id);
                    const keepHour = existing?.scheduled_at
                      ? getHourInTz(existing.scheduled_at, timezone)
                      : 9;
                    void handleDropToSlot(e, cell.dateStr, keepHour);
                  }}
                  className={`group min-h-[126px] border-b border-r border-[var(--kc-border)] p-2 space-y-1.5 transition ${
                    cell.inMonth
                      ? "bg-[var(--kc-canvas)]/70"
                      : "bg-[#030408] opacity-55"
                  } ${isDragTarget ? "ring-2 ring-inset ring-cyan-400 bg-cyan-950/35" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                        cell.isToday
                          ? "bg-cyan-400 text-slate-950"
                          : cell.inMonth
                          ? "text-slate-200"
                          : "text-slate-500"
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenComposer({
                          initialDate: cell.dateStr,
                          initialTime: "09:00",
                        })
                      }
                      aria-label={`Crear publicación el ${cell.dateStr}`}
                      className="rounded p-1 text-slate-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-slate-800 hover:text-cyan-300 transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {dayPosts.slice(0, 3).map((p) => renderPostCard(p, true))}
                    {dayPosts.length > 3 && (
                      <div className="text-[10px] font-semibold text-cyan-300 px-1">
                        +{dayPosts.length - 3} más
                      </div>
                    )}
                    {dayProj.slice(0, 2).map((slot) => renderProjectedSlot(slot))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: LIST VIEW */}
      {viewMode === "list" && (
        <div className="nle-panel p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--kc-border)] pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              Cola Cronológica de Publicaciones ({sortedListPosts.length})
            </h3>
            <AstryxButton
              variant="secondary"
              size="sm"
              label="+ Nueva Publicación"
              onClick={() => onOpenComposer({})}
            />
          </div>

          {sortedListPosts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--kc-border)] p-8 text-center space-y-3">
              <p className="text-sm text-slate-300">
                No hay publicaciones programadas o borradores en este filtro.
              </p>
              <AstryxButton
                variant="primary"
                label="Programar primera publicación"
                onClick={() => onOpenComposer({})}
              />
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedListPosts.map((post) => {
                const style = CHANNEL_STYLE[post.channel] ?? CHANNEL_STYLE.LinkedIn;
                const badge = getPostStatusBadge(post);
                const dateLabel = post.scheduled_at
                  ? `${formatFriendlyDateEs(
                      formatDateKey(post.scheduled_at, timezone)
                    )} · ${formatTimeInTz(post.scheduled_at, timezone)}`
                  : "Borrador sin fecha";

                return (
                  <div
                    key={post.id}
                    className={`rounded-xl border border-[var(--kc-border)] border-l-4 ${style.stripe} bg-[var(--kc-canvas)]/80 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-cyan-500/40 transition`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                          {post.channel}
                        </span>
                        <span className="font-mono text-[11px] text-cyan-300">
                          {dateLabel}
                        </span>
                        <AstryxBadge label={badge.label} variant={badge.variant} />
                        {post.asset_code && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                            {post.asset_code}
                          </span>
                        )}
                      </div>

                      {post.title && (
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {post.title}
                        </div>
                      )}
                      <p className="text-xs text-slate-400 line-clamp-2 whitespace-pre-line">
                        {post.post_body}
                      </p>

                      {post.publish_error && (
                        <div className="rounded bg-rose-950/50 border border-rose-500/40 px-2.5 py-1 text-[11px] text-rose-200">
                          Error API: {post.publish_error}
                        </div>
                      )}

                      {post.canonical_url && (
                        <a
                          href={post.canonical_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:underline"
                        >
                          Ver publicación real <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <AstryxButton
                        variant="secondary"
                        size="sm"
                        label="Editar"
                        onClick={() => onOpenComposer({ editingPost: post })}
                      />
                      <button
                        type="button"
                        onClick={(e) => handleCopyPost(post, e)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 hover:border-cyan-400 transition"
                      >
                        {copiedId === post.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>Copiar</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeletePost(post, e)}
                        aria-label={`Eliminar publicación de ${post.channel}`}
                        className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
