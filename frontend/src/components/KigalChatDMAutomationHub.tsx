"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  FolderOpen,
  Inbox,
  Link2,
  MessageCircle,
  MessageSquareReply,
  Play,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Zap,
} from "lucide-react";
import { CreatorProfileModal } from "@/components/CreatorProfileModal";
import type { CreatorModalTab } from "@/components/ProfileBubbleMenu";
import { apiClient } from "@/lib/api";
import { useEngineStore } from "@/store/useEngineStore";
import type {
  CreatorProfile,
  KigalChatInteraction,
  LeadMagnetItem,
  ManyChatTriggerRule,
} from "@/types/engine";

interface KigalChatDMAutomationHubProps {
  onOpenPaso0?: (tab?: CreatorModalTab) => void;
}

interface SimulationPreview {
  matched: boolean;
  platform: string;
  username: string;
  comment_text: string;
  keyword: string;
  public_comment_reply: string;
  dm_reply_text: string;
  lead_magnet_title: string;
  delivery_url: string;
  triggers_count: number;
}

interface EffectiveRule {
  keyword: string;
  platform: string;
  dm_reply_template: string;
  lead_magnet: LeadMagnetItem | null;
}

const PUBLIC_REPLY_TEMPLATES = [
  "¡Enviado por privado, {username}! Revisa tu bandeja de mensajes 📩",
  "¡Listo, {username}! Te acabo de dejar el acceso por DM para no saturar los comentarios 🚀",
  "¡Hecho, {username}! Revisa tus mensajes directos, ahí tienes el recurso por comentar {keyword} ✨",
];

function buildAntiPenalizationPublicReply(
  username: string,
  keyword: string,
  seedIndex = 0
): string {
  const safeUser = username.startsWith("@") ? username : `@${username}`;
  const template = PUBLIC_REPLY_TEMPLATES[seedIndex % PUBLIC_REPLY_TEMPLATES.length];
  return template.replace("{username}", safeUser).replace("{keyword}", keyword);
}

function formatInteractionTime(iso: string): string {
  try {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return iso;
    return dt.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function resolveEffectiveRules(profile: CreatorProfile | null): EffectiveRule[] {
  const magnets = profile?.lead_magnets ?? [];
  const activeTriggers = (profile?.manychat_triggers ?? []).filter((t) => t.active);

  if (activeTriggers.length > 0) {
    return activeTriggers.map((rule) => ({
      keyword: rule.keyword.trim().toUpperCase(),
      platform: rule.platform.toLowerCase(),
      dm_reply_template: rule.dm_reply_template,
      lead_magnet:
        magnets.find((lm) => lm.id === rule.lead_magnet_id) ?? magnets[0] ?? null,
    }));
  }

  const catalogRules: EffectiveRule[] = [];
  if (profile?.conversion_goals_catalog) {
    for (const spec of Object.values(profile.conversion_goals_catalog)) {
      if (spec.trigger_word) {
        const kw = spec.trigger_word.trim().toUpperCase();
        catalogRules.push({
          keyword: kw,
          platform: "all",
          dm_reply_template: `¡Hola! Aquí tienes acceso directo a ${
            spec.lead_magnet_name || "tu recurso"
          }:`,
          lead_magnet: magnets[0] ?? {
            id: `lm-cat-${kw}`,
            title: spec.lead_magnet_name || `Recurso ${kw}`,
            description: spec.objective,
            format: "Guía PDF",
            delivery_url: "https://kigalcontent.app/recursos/blueprint",
            source: "manual",
          },
        });
      }
    }
  }

  if (catalogRules.length > 0) {
    return catalogRules;
  }

  return [
    {
      keyword: "GUIA",
      platform: "all",
      dm_reply_template: "¡Hola! Aquí tienes acceso directo a tu recurso:",
      lead_magnet: magnets[0] ?? {
        id: "lm-default-guia",
        title: "Guía Práctica de Automatización y Contenido",
        description: "Recurso listo para entregar por DM desde la carpeta de Paso 0.",
        format: "Guía PDF",
        delivery_url: "https://kigalcontent.app/recursos/guia",
        source: "manual",
      },
    },
  ];
}

function buildSeedInteractions(profile: CreatorProfile | null): KigalChatInteraction[] {
  const rules = resolveEffectiveRules(profile);
  const firstRule = rules[0];
  const secondRule = rules[1] ?? rules[0];
  const now = Date.now();

  return [
    {
      id: "kc-seed-1",
      timestamp: new Date(now - 1000 * 60 * 14).toISOString(),
      platform: "Instagram",
      username: "@laura_sistemas",
      comment_text: `¡Me interesa muchísimo! Quiero ${firstRule.keyword}`,
      matched_keyword: firstRule.keyword,
      public_comment_reply: buildAntiPenalizationPublicReply(
        "@laura_sistemas",
        firstRule.keyword,
        0
      ),
      dm_reply_text: `${firstRule.dm_reply_template} ${
        firstRule.lead_magnet?.delivery_url ?? ""
      }`.trim(),
      lead_magnet_title: firstRule.lead_magnet?.title ?? "Lead Magnet Principal",
      delivery_url: firstRule.lead_magnet?.delivery_url ?? "",
      status: "DELIVERED",
    },
    {
      id: "kc-seed-2",
      timestamp: new Date(now - 1000 * 60 * 32).toISOString(),
      platform: "TikTok",
      username: "@carlos_growth",
      comment_text: `Envíame ${secondRule.keyword} por favor 🙌`,
      matched_keyword: secondRule.keyword,
      public_comment_reply: buildAntiPenalizationPublicReply(
        "@carlos_growth",
        secondRule.keyword,
        1
      ),
      dm_reply_text: `${secondRule.dm_reply_template} ${
        secondRule.lead_magnet?.delivery_url ?? ""
      }`.trim(),
      lead_magnet_title: secondRule.lead_magnet?.title ?? "Lead Magnet",
      delivery_url: secondRule.lead_magnet?.delivery_url ?? "",
      status: "DELIVERED",
    },
    {
      id: "kc-seed-3",
      timestamp: new Date(now - 1000 * 60 * 55).toISOString(),
      platform: "YouTube",
      username: "@dev_andres",
      comment_text: "¿Qué micrófono usas para grabar estos shorts?",
      matched_keyword: "-",
      public_comment_reply: "Sin respuesta automática (sin palabra clave configurada)",
      dm_reply_text: "",
      lead_magnet_title: "-",
      delivery_url: "",
      status: "UNMATCHED",
    },
  ];
}

function mergeInteractions(
  incoming: KigalChatInteraction[],
  existing: KigalChatInteraction[]
): KigalChatInteraction[] {
  const seen = new Map<string, KigalChatInteraction>();
  for (const item of [...incoming, ...existing]) {
    if (!seen.has(item.id)) {
      seen.set(item.id, item);
    }
  }
  return Array.from(seen.values());
}

export function KigalChatDMAutomationHub({
  onOpenPaso0,
}: KigalChatDMAutomationHubProps) {
  const { creatorProfile, setCreatorProfile, backendOnline, showToast } =
    useEngineStore();
  const creatorProfileRef = useRef(creatorProfile);
  useEffect(() => {
    creatorProfileRef.current = creatorProfile;
  }, [creatorProfile]);

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
  const [sweeping, setSweeping] = useState(false);
  const [lastSweepInfo, setLastSweepInfo] = useState<string | null>(null);

  // Simulator state
  const [simPlatform, setSimPlatform] = useState("instagram");
  const [simUsername, setSimUsername] = useState("@elena_founder");
  const [simComment, setSimComment] = useState("");
  const [simError, setSimError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simPreview, setSimPreview] = useState<SimulationPreview | null>(null);

  // Inbox filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "DELIVERED" | "PENDING" | "UNMATCHED"
  >("ALL");

  const configuredTriggers: ManyChatTriggerRule[] =
    creatorProfile?.manychat_triggers ?? [];
  const leadMagnets: LeadMagnetItem[] = creatorProfile?.lead_magnets ?? [];
  const effectiveRules = useMemo(
    () => resolveEffectiveRules(creatorProfile),
    [creatorProfile]
  );

  useEffect(() => {
    if (!simComment && effectiveRules[0]) {
      setSimComment(`¡Hola! Quiero ${effectiveRules[0].keyword} por favor`);
    }
  }, [effectiveRules, simComment]);

  const loadInteractions = useCallback(async () => {
    setLoadingInbox(true);
    try {
      if (backendOnline) {
        const list = await apiClient.listKigalChatInteractions();
        setInteractions(list);
      } else {
        setInteractions((prev) =>
          prev.length > 0 ? prev : buildSeedInteractions(creatorProfileRef.current)
        );
      }
    } catch {
      setInteractions((prev) =>
        prev.length > 0 ? prev : buildSeedInteractions(creatorProfileRef.current)
      );
    } finally {
      setLoadingInbox(false);
    }
  }, [backendOnline]);

  useEffect(() => {
    void loadInteractions();
  }, [loadInteractions]);

  useEffect(() => {
    if (!backendOnline && interactions.length === 0) {
      setInteractions(buildSeedInteractions(creatorProfile));
    }
  }, [backendOnline, creatorProfile, interactions.length]);

  const handleOpenPaso0Click = () => {
    if (onOpenPaso0) {
      onOpenPaso0("lead-magnets");
    } else {
      setLocalPaso0Open(true);
    }
  };

  const handleRunAutoSweep = async () => {
    setSweeping(true);
    try {
      if (backendOnline) {
        const res = await apiClient.runKigalChatAutoSweep();
        setInteractions((prev) => mergeInteractions(res.interactions, prev));
        setLastSweepInfo(
          `Último barrido: ${res.processed_count} comentario(s) procesado(s)`
        );
        void apiClient
          .getCreatorProfile()
          .then(setCreatorProfile)
          .catch(() => {});
        showToast(
          "success",
          `Barrido KigalChat completado: ${res.processed_count} comentario(s) procesado(s).`
        );
      } else {
        const ruleA = effectiveRules[0];
        const ruleB = effectiveRules[1] ?? effectiveRules[0];
        const ts = Date.now();
        const simulatedBatch: KigalChatInteraction[] = [
          {
            id: `kc-sweep-${ts}-1`,
            timestamp: new Date(ts).toISOString(),
            platform: "Instagram",
            username: "@sofia_ops",
            comment_text: `Necesito esto ya, envía ${ruleA.keyword} 🔥`,
            matched_keyword: ruleA.keyword,
            public_comment_reply: buildAntiPenalizationPublicReply(
              "@sofia_ops",
              ruleA.keyword,
              0
            ),
            dm_reply_text: `${ruleA.dm_reply_template} ${
              ruleA.lead_magnet?.delivery_url ?? ""
            }`.trim(),
            lead_magnet_title: ruleA.lead_magnet?.title ?? "Lead Magnet",
            delivery_url: ruleA.lead_magnet?.delivery_url ?? "",
            status: "DELIVERED",
          },
          {
            id: `kc-sweep-${ts}-2`,
            timestamp: new Date(ts - 15000).toISOString(),
            platform: "LinkedIn",
            username: "@javier_b2b",
            comment_text: `Gran enfoque. Me apunto con ${ruleB.keyword}`,
            matched_keyword: ruleB.keyword,
            public_comment_reply: buildAntiPenalizationPublicReply(
              "@javier_b2b",
              ruleB.keyword,
              1
            ),
            dm_reply_text: `${ruleB.dm_reply_template} ${
              ruleB.lead_magnet?.delivery_url ?? ""
            }`.trim(),
            lead_magnet_title: ruleB.lead_magnet?.title ?? "Lead Magnet",
            delivery_url: ruleB.lead_magnet?.delivery_url ?? "",
            status: "DELIVERED",
          },
          {
            id: `kc-sweep-${ts}-3`,
            timestamp: new Date(ts - 45000).toISOString(),
            platform: "TikTok",
            username: "@lucia_indie",
            comment_text: "Brutal el formato 9:16, ¿cómo editas los subtítulos?",
            matched_keyword: "-",
            public_comment_reply:
              "En cola de revisión manual (sin palabra clave disparadora)",
            dm_reply_text: "",
            lead_magnet_title: "-",
            delivery_url: "",
            status: "PENDING",
          },
        ];

        setInteractions((prev) => mergeInteractions(simulatedBatch, prev));
        setLastSweepInfo(
          `Último barrido local: ${simulatedBatch.length} comentarios analizados`
        );
        showToast(
          "info",
          `Barrido local completado: ${simulatedBatch.length} comentarios procesados (2 DMs entregados).`
        );
      }
    } catch (err) {
      showToast(
        "error",
        err instanceof Error
          ? err.message
          : "Error ejecutando barrido automático de comentarios"
      );
    } finally {
      setSweeping(false);
    }
  };

  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedComment = simComment.trim();
    if (!cleanedComment) {
      setSimError("Escribe un comentario simulado para ejecutar el flujo.");
      return;
    }
    setSimError(null);

    const normalizedUser = (simUsername.trim() || "@usuario").startsWith("@")
      ? simUsername.trim() || "@usuario"
      : `@${simUsername.trim()}`;
    const commentUpper = cleanedComment.toUpperCase();
    const matchedRule = effectiveRules.find(
      (r) =>
        (r.platform === "all" || r.platform === simPlatform.toLowerCase()) &&
        commentUpper.includes(r.keyword)
    );
    const extractedKeyword =
      matchedRule?.keyword ??
      cleanedComment.split(/\s+/).find((t) => t.length >= 3)?.toUpperCase() ??
      cleanedComment.toUpperCase();

    setSimulating(true);
    try {
      if (backendOnline) {
        const res = await apiClient.triggerManyChatKeyword({
          keyword: extractedKeyword,
          platform: simPlatform,
          username: normalizedUser,
          comment_text: cleanedComment,
        });

        const publicReply =
          res.public_comment_reply ||
          (res.matched
            ? buildAntiPenalizationPublicReply(normalizedUser, res.keyword, 0)
            : "Sin respuesta automática: el comentario no contiene una palabra clave activa.");

        const preview: SimulationPreview = {
          matched: res.matched,
          platform: res.platform,
          username: normalizedUser,
          comment_text: cleanedComment,
          keyword: res.keyword,
          public_comment_reply: publicReply,
          dm_reply_text: res.dm_reply_text,
          lead_magnet_title: res.lead_magnet?.title ?? (res.matched ? "Recurso" : "-"),
          delivery_url: res.delivery_url,
          triggers_count: res.triggers_count,
        };
        setSimPreview(preview);

        try {
          const fresh = await apiClient.listKigalChatInteractions();
          setInteractions(fresh);
        } catch {
          const fallbackEntry: KigalChatInteraction = {
            id: `kc-live-${Date.now()}`,
            timestamp: new Date().toISOString(),
            platform: res.platform,
            username: normalizedUser,
            comment_text: cleanedComment,
            matched_keyword: res.matched ? res.keyword : "-",
            public_comment_reply: publicReply,
            dm_reply_text: res.dm_reply_text,
            lead_magnet_title: res.lead_magnet?.title ?? "-",
            delivery_url: res.delivery_url,
            status: res.matched ? "DELIVERED" : "UNMATCHED",
          };
          setInteractions((prev) => mergeInteractions([fallbackEntry], prev));
        }

        if (res.matched) {
          void apiClient
            .getCreatorProfile()
            .then(setCreatorProfile)
            .catch(() => {});
        }

        showToast(
          res.matched ? "success" : "info",
          res.matched
            ? `KigalChat respondió públicamente y envió el DM con ${res.keyword}.`
            : "Simulación ejecutada: no coincidió ninguna palabra clave activa."
        );
      } else {
        const isMatched = Boolean(matchedRule);
        const kw = matchedRule?.keyword ?? "-";
        const publicReply = isMatched
          ? buildAntiPenalizationPublicReply(normalizedUser, kw, 2)
          : "Sin respuesta automática: ninguna palabra clave activa coincidió.";
        const lmTitle = matchedRule?.lead_magnet?.title ?? "-";
        const deliveryUrl = matchedRule?.lead_magnet?.delivery_url ?? "";
        const dmText = isMatched
          ? `${
              matchedRule?.dm_reply_template.trim() ||
              `¡Hola ${normalizedUser}! Aquí tienes acceso directo a ${lmTitle}:`
            } ${deliveryUrl}`.trim()
          : "";

        setSimPreview({
          matched: isMatched,
          platform: simPlatform,
          username: normalizedUser,
          comment_text: cleanedComment,
          keyword: kw,
          public_comment_reply: publicReply,
          dm_reply_text: dmText,
          lead_magnet_title: lmTitle,
          delivery_url: deliveryUrl,
          triggers_count: isMatched ? 1 : 0,
        });

        const simulatedEntry: KigalChatInteraction = {
          id: `kc-sim-${Date.now()}`,
          timestamp: new Date().toISOString(),
          platform: simPlatform,
          username: normalizedUser,
          comment_text: cleanedComment,
          matched_keyword: kw,
          public_comment_reply: publicReply,
          dm_reply_text: dmText,
          lead_magnet_title: lmTitle,
          delivery_url: deliveryUrl,
          status: isMatched ? "DELIVERED" : "UNMATCHED",
        };
        setInteractions((prev) => mergeInteractions([simulatedEntry], prev));
        showToast(
          isMatched ? "success" : "info",
          isMatched
            ? `Simulación local: DM enviado con "${lmTitle}".`
            : "Simulación local: el comentario no activó ninguna palabra clave."
        );
      }
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Error simulando flujo KigalChat"
      );
    } finally {
      setSimulating(false);
    }
  };

  const filteredInteractions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return interactions.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.username.toLowerCase().includes(q) ||
        item.platform.toLowerCase().includes(q) ||
        item.comment_text.toLowerCase().includes(q) ||
        item.matched_keyword.toLowerCase().includes(q) ||
        item.lead_magnet_title.toLowerCase().includes(q)
      );
    });
  }, [interactions, searchQuery, statusFilter]);

  const deliveredCount = useMemo(
    () => interactions.filter((i) => i.status === "DELIVERED").length,
    [interactions]
  );

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
                Motor Nativo · ManyChat / Chatwoot / Typebot
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                {deliveredCount} entregados
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Convierte comentarios con palabra clave en respuestas públicas seguras (sin enlaces que penalicen el alcance) y entrega automática por DM desde tu carpeta de Lead Magnets.
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
            onClick={handleRunAutoSweep}
            disabled={sweeping}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 hover:opacity-95 transition disabled:opacity-60"
          >
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {sweeping
                ? "Ejecutando barrido..."
                : "⚡ Ejecutar Barrido Automático de Comentarios"}
            </span>
          </button>
        </div>
      </div>

      {/* Visual 3-Step Flow */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Arquitectura de Conversión en 3 Pasos
          </h3>
          {lastSweepInfo && (
            <span className="text-[11px] font-medium text-emerald-300">
              {lastSweepInfo}
            </span>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {/* Step 1 */}
          <div className="relative rounded-xl border border-cyan-500/30 bg-slate-950/75 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300">
                <MessageCircle className="h-3 w-3" aria-hidden="true" />
                Paso 1
              </span>
              <ArrowRight
                className="hidden md:block h-4 w-4 text-slate-600"
                aria-hidden="true"
              />
            </div>
            <h4 className="text-xs font-bold text-white">
              1. Comentario entrante con Palabra Clave
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Escucha comentarios en Instagram, TikTok, YouTube y LinkedIn buscando disparadores activos (ej.{" "}
              <code className="text-cyan-300 font-mono">
                {effectiveRules[0]?.keyword || "GUIA"}
              </code>
              ).
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative rounded-xl border border-violet-500/30 bg-slate-950/75 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 px-2.5 py-0.5 text-[11px] font-bold text-violet-300">
                <MessageSquareReply className="h-3 w-3" aria-hidden="true" />
                Paso 2
              </span>
              <ArrowRight
                className="hidden md:block h-4 w-4 text-slate-600"
                aria-hidden="true"
              />
            </div>
            <h4 className="text-xs font-bold text-white">
              2. Respuesta Pública Anti-Penalización
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Contesta en el hilo público con copy rotativo natural y sin URLs externas, evitando castigos algorítmicos y duplicando la interacción.
            </p>
          </div>

          {/* Step 3 */}
          <div className="rounded-xl border border-emerald-500/30 bg-slate-950/75 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                <Send className="h-3 w-3" aria-hidden="true" />
                Paso 3
              </span>
              <FolderOpen className="h-4 w-4 text-amber-400" aria-hidden="true" />
            </div>
            <h4 className="text-xs font-bold text-white">
              3. Envío Automático por DM con Lead Magnet de la Carpeta
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Envía por mensaje privado el enlace exacto de{" "}
              <span className="text-amber-300 font-semibold">
                Carpeta Lead Magnets
              </span>{" "}
              y registra la entrega en tu bandeja en vivo.
            </p>
          </div>
        </div>
      </div>

      {/* Active Keywords Linked to Lead Magnets */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/65 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <h3 className="text-xs font-bold text-white">
              Palabras Clave Activas enlazadas a Lead Magnets ({configuredTriggers.length})
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
                El motor usará de respaldo la palabra clave del objetivo activo (
                <code className="font-mono text-cyan-300">
                  {effectiveRules[0]?.keyword}
                </code>
                ). Crea tus reglas en Paso 0 para personalizar mensajes y enlaces.
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
                        setSimComment(`¡Hola! Quiero ${rule.keyword} por favor`)
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-extrabold tracking-wider text-emerald-300 hover:bg-emerald-500/25 transition"
                      title="Usar esta palabra clave en el simulador"
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
                      {rule.triggers_count} envíos
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive Simulator: Comment -> Public Reply + Private DM */}
      <form
        onSubmit={handleSimulateSubmit}
        className="rounded-xl border border-cyan-500/30 bg-slate-950/75 p-4 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Play className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
              <span>Simulador Interactivo: Comentario → Respuesta Pública + DM Privado</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Prueba cómo reacciona KigalChat ante un comentario real antes de publicar tus campañas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {effectiveRules.slice(0, 4).map((rule) => (
              <button
                key={rule.keyword}
                type="button"
                onClick={() => {
                  setSimComment(`¡Quiero ${rule.keyword}! Envía info`);
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
              placeholder="@elena_founder"
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
              placeholder="Ej: ¡Me encanta! Quiero BLUEPRINT"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={simulating}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 transition disabled:opacity-60"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{simulating ? "Procesando..." : "Simular"}</span>
            </button>
          </div>
        </div>

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
                      Coincidencia detectada: {simPreview.keyword} ({simPreview.platform})
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
              {simPreview.matched && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                  Lead Magnet: {simPreview.lead_magnet_title}
                </span>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2 text-xs">
              <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">
                  Respuesta Pública Anti-Penalización
                </span>
                <p className="text-slate-200">{simPreview.public_comment_reply}</p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  DM Privado Entregado ({simPreview.username})
                </span>
                <p className="text-slate-200 font-mono text-[11px]">
                  {simPreview.dm_reply_text || "No se envió DM privado."}
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
              Bandeja de Interacciones en Vivo ({filteredInteractions.length})
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
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "ALL" | "DELIVERED" | "PENDING" | "UNMATCHED"
                )
              }
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
            >
              <option value="ALL">Todos los estados</option>
              <option value="DELIVERED">Entregados (DM)</option>
              <option value="PENDING">Pendientes</option>
              <option value="UNMATCHED">Sin coincidencia</option>
            </select>

            <button
              type="button"
              onClick={() => void loadInteractions()}
              disabled={loadingInbox}
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
              Historial en vivo de comentarios detectados, respuestas públicas y entregas por DM de KigalChat Auto-DM
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
                    No hay interacciones que coincidan con el filtro actual. Ejecuta un barrido automático o prueba el simulador.
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
                          {item.username}
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
                      {item.comment_text}
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
                        {item.status === "DELIVERED" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            <span>DELIVERED</span>
                          </span>
                        ) : item.status === "PENDING" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            <span>PENDING</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                            <AlertCircle className="h-3 w-3" aria-hidden="true" />
                            <span>UNMATCHED</span>
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
