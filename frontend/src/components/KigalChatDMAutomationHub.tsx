"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  FolderOpen,
  Inbox,
  Link2,
  Play,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Terminal,
  WifiOff,
} from "lucide-react";
import { CreatorProfileModal } from "@/components/CreatorProfileModal";
import type { CreatorModalTab } from "@/components/ProfileBubbleMenu";
import { apiClient } from "@/lib/api";
import { useEngineStore } from "@/store/useEngineStore";
import type {
  CreatorProfile,
  KigalChatInteraction,
  KigalChatStatus,
  LeadMagnetItem,
  ManyChatTriggerRule,
} from "@/types/engine";

interface KigalChatDMAutomationHubProps {
  onOpenPaso0?: (tab?: CreatorModalTab) => void;
}

interface RuleTestPreview {
  matched: boolean;
  platform: string;
  username: string;
  comment_text: string;
  keyword: string;
  public_comment_reply: string;
  dm_reply_text: string;
  lead_magnet_title: string;
  delivery_url: string;
}

interface EffectiveRule {
  keyword: string;
  platform: string;
}

type StatusFilter = "ALL" | "SENT" | "DELIVERED" | "MATCHED" | "PENDING" | "UNMATCHED";

function formatInteractionTime(iso: string): string {
  try {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return iso;
    return dt.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Only the rules Kike configured: no filler keywords or invented delivery links. */
function resolveEffectiveRules(profile: CreatorProfile | null): EffectiveRule[] {
  return (profile?.manychat_triggers ?? [])
    .filter((t) => t.active && t.keyword.trim())
    .map((rule) => ({
      keyword: rule.keyword.trim().toUpperCase(),
      platform: rule.platform.toLowerCase(),
    }));
}

const STATUS_BADGES: Record<
  string,
  { label: string; className: string; icon: "check" | "clock" | "alert" }
> = {
  SENT: {
    label: "Enviado",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    icon: "check",
  },
  DELIVERED: {
    label: "Entregado",
    className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    icon: "check",
  },
  MATCHED: {
    label: "Coincidencia",
    className: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    icon: "alert",
  },
  PENDING: {
    label: "Pendiente",
    className: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    icon: "clock",
  },
  UNMATCHED: {
    label: "Sin coincidencia",
    className: "border-slate-700 bg-slate-800 text-slate-300",
    icon: "alert",
  },
};

const KIND_LABELS: Record<string, string> = {
  prompt: "Botón enviado",
  not_following: "No sigue la cuenta",
  reward: "Enlace entregado",
  public: "Respuesta pública",
};

export function KigalChatDMAutomationHub({
  onOpenPaso0,
}: KigalChatDMAutomationHubProps) {
  const { creatorProfile, setCreatorProfile, backendOnline, showToast } =
    useEngineStore();

  const simPlatformId = useId();
  const simUsernameId = useId();
  const simCommentId = useId();
  const simErrorId = useId();
  const inboxSearchId = useId();
  const inboxStatusId = useId();
  const inboxCaptionId = useId();

  const [localPaso0Open, setLocalPaso0Open] = useState(false);

  const [interactions, setInteractions] = useState<KigalChatInteraction[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);

  const [botStatus, setBotStatus] = useState<KigalChatStatus | null>(null);
  const [botStatusError, setBotStatusError] = useState<string | null>(null);

  // Rule tester (backend only): checks keyword matching, never delivers anything
  const [simPlatform, setSimPlatform] = useState("instagram");
  const [simUsername, setSimUsername] = useState("");
  const [simComment, setSimComment] = useState("");
  const [simError, setSimError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simPreview, setSimPreview] = useState<RuleTestPreview | null>(null);

  // Inbox filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const configuredTriggers: ManyChatTriggerRule[] =
    creatorProfile?.manychat_triggers ?? [];
  const leadMagnets: LeadMagnetItem[] = creatorProfile?.lead_magnets ?? [];
  const effectiveRules = useMemo(
    () => resolveEffectiveRules(creatorProfile),
    [creatorProfile]
  );

  const loadInteractions = useCallback(async () => {
    if (!backendOnline) {
      setInteractions([]);
      setBotStatus(null);
      setInboxError(null);
      setBotStatusError(null);
      return;
    }
    setLoadingInbox(true);
    const [listResult, statusResult] = await Promise.allSettled([
      apiClient.listKigalChatInteractions(),
      apiClient.getKigalChatStatus(),
    ]);
    if (listResult.status === "fulfilled") {
      setInteractions(Array.isArray(listResult.value) ? listResult.value : []);
      setInboxError(null);
    } else {
      setInteractions([]);
      setInboxError(
        listResult.reason instanceof Error
          ? listResult.reason.message
          : "No se pudieron cargar las interacciones."
      );
    }
    if (statusResult.status === "fulfilled") {
      setBotStatus(statusResult.value ?? null);
      setBotStatusError(null);
    } else {
      setBotStatus(null);
      setBotStatusError(
        statusResult.reason instanceof Error
          ? statusResult.reason.message
          : "No se pudo leer el estado del bot."
      );
    }
    setLoadingInbox(false);
  }, [backendOnline]);

  useEffect(() => {
    void loadInteractions();
  }, [loadInteractions]);

  const handleOpenPaso0Click = () => {
    if (onOpenPaso0) {
      onOpenPaso0("lead-magnets");
    } else {
      setLocalPaso0Open(true);
    }
  };

  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backendOnline) {
      setSimError("Conecta el backend para probar tus reglas.");
      return;
    }
    const cleanedComment = simComment.trim();
    if (!cleanedComment) {
      setSimError("Escribe el texto de un comentario para probar la regla.");
      return;
    }
    setSimError(null);

    const rawUser = simUsername.trim();
    const normalizedUser = rawUser
      ? rawUser.startsWith("@")
        ? rawUser
        : `@${rawUser}`
      : "";
    const commentUpper = cleanedComment.toUpperCase();
    const matchedRule = effectiveRules.find(
      (r) =>
        (r.platform === "all" || r.platform === simPlatform.toLowerCase()) &&
        commentUpper.includes(r.keyword)
    );
    const extractedKeyword =
      matchedRule?.keyword ??
      cleanedComment.split(/\s+/).find((t) => t.length >= 3)?.toUpperCase() ??
      commentUpper;

    setSimulating(true);
    try {
      const res = await apiClient.triggerManyChatKeyword({
        keyword: extractedKeyword,
        platform: simPlatform,
        username: normalizedUser || undefined,
        comment_text: cleanedComment,
        dry_run: true,
      });

      setSimPreview({
        matched: res.matched,
        platform: res.platform,
        username: normalizedUser,
        comment_text: cleanedComment,
        keyword: res.keyword,
        public_comment_reply: res.public_comment_reply ?? "",
        dm_reply_text: res.dm_reply_text,
        lead_magnet_title: res.lead_magnet?.title ?? "",
        delivery_url: res.delivery_url,
      });

      void loadInteractions();
      if (res.matched) {
        void apiClient
          .getCreatorProfile()
          .then(setCreatorProfile)
          .catch(() => {});
      }

      showToast(
        "info",
        res.matched
          ? `Coincidencia con ${res.keyword}. Es solo una prueba: no se ha enviado ningún DM.`
          : "Ninguna palabra clave activa coincide con ese comentario."
      );
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Error al probar la regla"
      );
    } finally {
      setSimulating(false);
    }
  };

  const filteredInteractions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return interactions.filter((item) => {
      // Los envíos reales del bot llegan como SENT: el enlace entregado es kind=reward.
      const isDelivered = item.kind === "reward" || item.status === "DELIVERED";
      if (statusFilter === "DELIVERED" ? !isDelivered : statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return [
        item.username,
        item.platform,
        item.comment_text,
        item.matched_keyword,
        item.lead_magnet_title,
      ].some((field) => (field ?? "").toLowerCase().includes(q));
    });
  }, [interactions, searchQuery, statusFilter]);

  const deliveredCount = useMemo(
    () =>
      interactions.filter((i) => i.kind === "reward" || i.status === "DELIVERED").length,
    [interactions]
  );

  const funnelRows = Array.isArray(botStatus?.funnel_7d) ? botStatus.funnel_7d : [];
  const funnelTotals = funnelRows.reduce(
    (acc, row) => ({
      prompts: acc.prompts + toCount(row.prompts_sent),
      rewards: acc.rewards + toCount(row.rewards_sent),
    }),
    { prompts: 0, rewards: 0 }
  );
  const botConnected = botStatus?.bot_connected === true;

  return (
    <div className="rounded-2xl border border-emerald-500/35 bg-slate-900/85 p-5 sm:p-6 space-y-6 shadow-xl shadow-emerald-950/20">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-300">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-white">
                KigalChat Auto-DM
              </h2>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Bot de Instagram · comenta PALABRA → DM
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                {deliveredCount} entregados
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Interacciones reales del bot de Instagram: quien comenta una palabra clave recibe un botón por DM y, si sigue la cuenta, el enlace al recurso.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenPaso0Click}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-amber-400/60 hover:text-white transition"
          >
            <Settings2 className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            <span>Editar en Paso 0</span>
          </button>

          <button
            type="button"
            onClick={() => void loadInteractions()}
            disabled={loadingInbox || !backendOnline}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 transition disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingInbox ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>Actualizar estado</span>
          </button>
        </div>
      </div>

      {/* Bot status */}
      {!backendOnline ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/25 p-4 text-xs text-amber-100"
        >
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-200">Backend sin conexión</p>
            <p className="text-amber-100/80">
              Conecta el backend para ver el estado del bot, el embudo y las interacciones reales.
            </p>
          </div>
        </div>
      ) : botStatusError ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-xs text-slate-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-white">Estado del bot no disponible</p>
            <p className="text-slate-400">
              El backend no ha devuelto el estado del bot ({botStatusError}). Sin datos todavía.
            </p>
          </div>
        </div>
      ) : botStatus && !botConnected ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/25 p-4 text-xs text-amber-100"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-200">
              El bot de Instagram aún no está conectado
            </p>
            <p className="text-amber-100/80">
              Despliega <code className="font-mono text-amber-200">bot/</code> en Vercel y aplica sus migraciones en Supabase (pasos en{" "}
              <code className="font-mono text-amber-200">bot/README.md</code>).
            </p>
            {botStatus.detail && (
              <p className="text-[11px] text-amber-100/60">{botStatus.detail}</p>
            )}
          </div>
        </div>
      ) : botStatus ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-4 text-xs text-emerald-100"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
          <span className="font-semibold text-emerald-200">Bot de Instagram conectado</span>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-slate-300">
            {toCount(botStatus.accounts)} cuenta(s)
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-slate-300">
            {toCount(botStatus.active_rules)} regla(s) activa(s)
          </span>
        </div>
      ) : null}

      {/* Real 7-day funnel per bot rule */}
      {backendOnline && botStatus && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/65 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Embudo de los últimos 7 días
            </h3>
            {funnelRows.length > 0 && (
              <span className="text-[11px] font-mono text-slate-400">
                {funnelTotals.prompts} botones enviados → {funnelTotals.rewards} enlaces entregados
              </span>
            )}
          </div>

          {funnelRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">
              Sin datos todavía: el bot no ha enviado nada en los últimos 7 días.
            </p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {funnelRows.map((row, idx) => {
                const prompts = toCount(row.prompts_sent);
                const rewards = toCount(row.rewards_sent);
                const pct = prompts > 0 ? Math.round((rewards / prompts) * 100) : null;
                const keywordLabel =
                  row.keyword ||
                  (Array.isArray(row.keywords) ? row.keywords.join(", ") : "");
                return (
                  <div
                    key={String(row.rule_id ?? idx)}
                    className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-white">
                        {row.name || "Regla sin nombre"}
                      </span>
                      {keywordLabel && (
                        <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                          {keywordLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-300">
                      <span className="font-mono">{prompts}</span>
                      <span className="text-slate-500">botones enviados</span>
                      <span className="text-slate-600">→</span>
                      <span className="font-mono">{rewards}</span>
                      <span className="text-slate-500">enlaces entregados</span>
                    </div>
                    {pct !== null && (
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
                        aria-label={`${pct}% de botones convertidos en entregas`}
                      >
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
            <Terminal className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              Las reglas «comenta PALABRA» del bot se gestionan desde la terminal:{" "}
              <code className="font-mono text-slate-300">node bot\scripts\regla.mjs</code>{" "}
              (vista previa) y <code className="font-mono text-slate-300">--si</code> para aplicar.
            </span>
          </p>
        </div>
      )}

      {/* Active Keywords Linked to Lead Magnets */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/65 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <h3 className="text-xs font-bold text-white">
              Reglas del perfil de creador (ManyChat) ({configuredTriggers.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={handleOpenPaso0Click}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
          >
            <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Gestionar reglas y carpeta en Paso 0</span>
          </button>
        </div>

        {configuredTriggers.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-3.5">
            <div className="text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-amber-300">
                Sin disparadores personalizados guardados en Paso 0 todavía.
              </p>
              <p className="text-[11px] text-slate-400">
                Crea tus reglas en Paso 0 para enlazar cada palabra clave con su recurso.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenPaso0Click}
              className="shrink-0 rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition"
            >
              Configurar en Paso 0
            </button>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {configuredTriggers.map((rule) => {
              const linkedLm = leadMagnets.find(
                (lm) => lm.id === rule.lead_magnet_id
              );
              return (
                <div
                  key={rule.id}
                  className={`rounded-xl border p-3 space-y-2 transition ${
                    rule.active
                      ? "border-emerald-500/35 bg-slate-900/90"
                      : "border-slate-800 bg-slate-950/60 opacity-65"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSimComment(rule.keyword)
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-extrabold tracking-wider text-emerald-300 hover:bg-emerald-500/25 transition"
                      title="Usar esta palabra clave en el probador"
                    >
                      <span>{rule.keyword}</span>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">
                        {rule.platform}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          rule.active
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {rule.active ? "ACTIVO" : "PAUSADO"}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-300">
                    <span className="text-slate-500">Lead Magnet: </span>
                    <span className="font-semibold text-white">
                      {linkedLm ? linkedLm.title : "Sin recurso enlazado"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-1.5 text-[10px] text-slate-400">
                    {linkedLm?.delivery_url ? (
                      <a
                        href={linkedLm.delivery_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-400 hover:underline truncate max-w-[190px]"
                      >
                        <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{linkedLm.delivery_url}</span>
                      </a>
                    ) : (
                      <span>Sin URL de entrega</span>
                    )}
                    <span className="font-mono shrink-0">
                      {rule.triggers_count} coincidencias
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rule tester: only checks keyword matching via backend, never delivers */}
      <form
        onSubmit={handleSimulateSubmit}
        className="rounded-xl border border-cyan-500/30 bg-slate-950/75 p-4 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Play className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
              <span>Probar una regla (solo coincidencia)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Escribe un comentario y comprueba qué regla coincidiría. No se envía ningún DM ni respuesta real.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {effectiveRules.slice(0, 4).map((rule) => (
              <button
                key={rule.keyword}
                type="button"
                onClick={() => {
                  setSimComment(rule.keyword);
                  setSimError(null);
                }}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-bold text-cyan-300 hover:border-cyan-400 transition"
              >
                Probar {rule.keyword}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-12 items-end">
          <div className="md:col-span-3 space-y-1">
            <label
              htmlFor={simPlatformId}
              className="block text-[11px] font-medium text-slate-300"
            >
              Red Social
            </label>
            <select
              id={simPlatformId}
              name="platform"
              value={simPlatform}
              onChange={(e) => setSimPlatform(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>

          <div className="md:col-span-3 space-y-1">
            <label
              htmlFor={simUsernameId}
              className="block text-[11px] font-medium text-slate-300"
            >
              Usuario del comentario
            </label>
            <input
              id={simUsernameId}
              name="username"
              type="text"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={simUsername}
              onChange={(e) => setSimUsername(e.target.value)}
              placeholder="@usuario (opcional)"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="md:col-span-4 space-y-1">
            <label
              htmlFor={simCommentId}
              className="block text-[11px] font-medium text-slate-300"
            >
              Comentario entrante
            </label>
            <input
              id={simCommentId}
              name="comment_text"
              type="text"
              value={simComment}
              onChange={(e) => {
                setSimComment(e.target.value);
                if (simError && e.target.value.trim()) setSimError(null);
              }}
              aria-invalid={simError ? "true" : undefined}
              aria-describedby={simError ? simErrorId : undefined}
              placeholder="Ej.: Quiero PALABRA"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={simulating || !backendOnline}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 transition disabled:opacity-60"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{simulating ? "Comprobando..." : "Probar"}</span>
            </button>
          </div>
        </div>

        {!backendOnline && (
          <p className="text-[11px] text-slate-500">
            Conecta el backend para probar tus reglas.
          </p>
        )}

        {simError && (
          <p
            id={simErrorId}
            role="alert"
            className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-xs text-rose-200"
          >
            {simError}
          </p>
        )}

        {simPreview && (
          <div
            className={`rounded-xl border p-3.5 space-y-3 ${
              simPreview.matched
                ? "border-emerald-500/40 bg-emerald-950/20"
                : "border-amber-500/40 bg-amber-950/20"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                {simPreview.matched ? (
                  <>
                    <CheckCircle2
                      className="h-4 w-4 text-emerald-400"
                      aria-hidden="true"
                    />
                    <span>
                      Coincidencia: {simPreview.keyword} ({simPreview.platform})
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle
                      className="h-4 w-4 text-amber-400"
                      aria-hidden="true"
                    />
                    <span>Sin coincidencia con palabras clave activas</span>
                  </>
                )}
              </span>
              {simPreview.matched && simPreview.lead_magnet_title && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                  Lead Magnet: {simPreview.lead_magnet_title}
                </span>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2 text-xs">
              <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">
                  Respuesta pública que se usaría
                </span>
                <p className="text-slate-200">{simPreview.public_comment_reply || "—"}</p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  DM que se enviaría{simPreview.username ? ` (${simPreview.username})` : ""}
                </span>
                <p className="text-slate-200 font-mono text-[11px]">
                  {simPreview.dm_reply_text || "—"}
                </p>
                {simPreview.delivery_url && (
                  <a
                    href={simPreview.delivery_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    <span>{simPreview.delivery_url}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Live Interactions Inbox */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <h3 id={inboxCaptionId} className="text-sm font-bold text-white">
              Interacciones reales ({filteredInteractions.length})
            </h3>
          </div>

          <search className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500"
                aria-hidden="true"
              />
              <label htmlFor={inboxSearchId} className="sr-only">
                Buscar interacciones por usuario, red o palabra clave
              </label>
              <input
                id={inboxSearchId}
                type="search"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar usuario o palabra..."
                className="rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
              />
            </div>

            <label htmlFor={inboxStatusId} className="sr-only">
              Filtrar por estado de entrega
            </label>
            <select
              id={inboxStatusId}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
            >
              <option value="ALL">Todos los estados</option>
              <option value="SENT">Enviados por el bot</option>
              <option value="DELIVERED">Entregados (DM)</option>
              <option value="MATCHED">Coincidencia (sin entrega)</option>
              <option value="PENDING">Pendientes</option>
              <option value="UNMATCHED">Sin coincidencia</option>
            </select>

            <button
              type="button"
              onClick={() => void loadInteractions()}
              disabled={loadingInbox || !backendOnline}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-400 hover:text-white transition disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingInbox ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              <span>Actualizar</span>
            </button>
          </search>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-labelledby={inboxCaptionId}
          className="table-wrapper bg-slate-950/70"
        >
          <table>
            <caption className="sr-only">
              Interacciones reales registradas por el bot de Instagram y las reglas de KigalChat
            </caption>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                <th scope="col" className="p-3 border-b border-slate-800">
                  Usuario y Red
                </th>
                <th scope="col" className="p-3 border-b border-slate-800">
                  Comentario Entrante
                </th>
                <th scope="col" className="p-3 border-b border-slate-800">
                  Palabra Clave
                </th>
                <th scope="col" className="p-3 border-b border-slate-800">
                  Respuesta Pública Anti-Penalización
                </th>
                <th scope="col" className="p-3 border-b border-slate-800">
                  Lead Magnet y Estado DM
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {filteredInteractions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    {!backendOnline
                      ? "Conecta el backend para ver las interacciones."
                      : inboxError
                        ? `No se pudieron cargar las interacciones (${inboxError}).`
                        : interactions.length === 0
                          ? "Aún no hay interacciones registradas."
                          : "No hay interacciones que coincidan con el filtro actual."}
                  </td>
                </tr>
              ) : (
                filteredInteractions.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-slate-900/40">
                    <th
                      scope="row"
                      className="p-3 text-left font-semibold text-white whitespace-nowrap"
                    >
                      <div className="space-y-1">
                        <span className="block font-mono text-cyan-300">
                          {item.username || "—"}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 uppercase text-slate-300">
                            {item.platform}
                          </span>
                          <span className="text-slate-500 font-normal">
                            {formatInteractionTime(item.timestamp)}
                          </span>
                        </div>
                      </div>
                    </th>
                    <td
                      data-label="Comentario"
                      className="p-3 text-slate-200 max-w-[240px]"
                    >
                      {item.comment_text || "—"}
                    </td>
                    <td data-label="Palabra Clave" className="p-3 whitespace-nowrap">
                      {item.matched_keyword && item.matched_keyword !== "-" ? (
                        <span className="inline-block rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                          {item.matched_keyword}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td
                      data-label="Respuesta Pública"
                      className="p-3 text-slate-300 max-w-[260px]"
                    >
                      {item.public_comment_reply || "—"}
                    </td>
                    <td
                      data-label="Lead Magnet Entregado"
                      className="p-3 space-y-1.5 max-w-[280px]"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(() => {
                          const badge = STATUS_BADGES[item.status] ?? {
                            label: item.status,
                            className: "border-slate-700 bg-slate-800 text-slate-300",
                            icon: "alert" as const,
                          };
                          const Icon =
                            badge.icon === "check"
                              ? CheckCircle2
                              : badge.icon === "clock"
                                ? Clock
                                : AlertCircle;
                          return (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
                            >
                              <Icon className="h-3 w-3" aria-hidden="true" />
                              <span>{badge.label}</span>
                            </span>
                          );
                        })()}
                        {item.kind && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                            {KIND_LABELS[item.kind] ?? item.kind}
                          </span>
                        )}
                        {item.lead_magnet_title && item.lead_magnet_title !== "-" && (
                          <span className="font-semibold text-white">
                            {item.lead_magnet_title}
                          </span>
                        )}
                      </div>
                      {item.delivery_url && (
                        <a
                          href={item.delivery_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline break-all"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>{item.delivery_url}</span>
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Built-in Paso 0 Modal fallback when parent does not provide onOpenPaso0 */}
      {!onOpenPaso0 && localPaso0Open && (
        <CreatorProfileModal
          isOpen={localPaso0Open}
          onClose={() => setLocalPaso0Open(false)}
          initialTab="lead-magnets"
        />
      )}
    </div>
  );
}
