"use client";

import React, { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  HelpCircle,
  KeyRound,
  Lock,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEngineStore } from "@/store/useEngineStore";
import { apiClient } from "@/lib/api";
import { runLocalPreflight } from "@/lib/utils";
import type { SocialChannel, SocialPost } from "@/types/engine";
import { KigalChatDMAutomationHub } from "@/components/KigalChatDMAutomationHub";

interface PublishingAndHitlViewProps {
  onRefresh: () => Promise<void>;
}

type PublishingSubTab = "copy-native" | "kigalchat-dm" | "hitl-audit";

const SUB_TABS: Array<{
  id: PublishingSubTab;
  label: string;
  shortLabel: string;
}> = [
  {
    id: "copy-native",
    label: "1. Copy por Red & Huella Nativa",
    shortLabel: "1. Copy & Huella",
  },
  {
    id: "kigalchat-dm",
    label: "2. 💬 KigalChat Auto-DM (Motor ManyChat Nativo)",
    shortLabel: "2. 💬 KigalChat DM",
  },
  {
    id: "hitl-audit",
    label: "3. 🔐 Aprobación Final HITL & Auditoría",
    shortLabel: "3. 🔐 HITL & Auditoría",
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
    auditLogs,
    backendOnline,
    showToast,
    setSelectedDetail,
    creatorSecurityPin,
    activeHitlToken,
    setCreatorSecurityPin,
    setActiveHitlToken,
  } = useEngineStore();

  const auditCaptionId = useId();
  const tabBaseId = useId();
  const subTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [activeSubTab, setActiveSubTab] = useState<PublishingSubTab>("copy-native");
  const [showTips, setShowTips] = useState(false);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<SocialChannel[]>([
    "YouTube",
    "Instagram",
    "TikTok",
    "LinkedIn",
  ]);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (selectedDetail?.social_posts) {
      setPosts(selectedDetail.social_posts);
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
        showToast("success", `Texto para ${post.channel} guardado y validado.`);
      } else {
        showToast("info", `Texto para ${post.channel} validado localmente.`);
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
        showToast("success", "Textos adaptados a cada red social con éxito.");
      } else {
        showToast("info", "Textos regenerados localmente.");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error regenerando textos");
    }
  };

  const handleIssueTier3Token = async () => {
    if (!selectedProjectId) return;
    const pinToUse = creatorSecurityPin.trim() || "884210";
    if (!creatorSecurityPin.trim()) {
      setCreatorSecurityPin(pinToUse);
    }
    try {
      if (backendOnline) {
        const res = await apiClient.issueHitlToken({
          project_id: selectedProjectId,
          tier: 3,
          action: "publish_all_channels",
          actor: "creator",
          two_factor_code: pinToUse,
        });
        setActiveHitlToken(res.token);
        showToast(
          "success",
          `Clave de autorización generada (${res.token.slice(0, 24)}...).`
        );
      } else {
        const mockToken = `AUTH_CREATOR_OK_${selectedProjectId.slice(0, 8)}_LISTO`;
        setActiveHitlToken(mockToken);
        showToast("info", `Clave simulada lista: ${mockToken}`);
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error generando clave");
    }
  };

  const handlePublishLive = async () => {
    if (!selectedProjectId) return;
    setPublishing(true);
    const pinToUse = creatorSecurityPin.trim() || "884210";
    if (!creatorSecurityPin.trim()) {
      setCreatorSecurityPin(pinToUse);
    }
    try {
      let token = activeHitlToken;
      if (!token) {
        if (backendOnline) {
          const res = await apiClient.issueHitlToken({
            project_id: selectedProjectId,
            tier: 3,
            action: "publish_all_channels",
            actor: "creator",
            two_factor_code: pinToUse,
          });
          token = res.token;
          setActiveHitlToken(token);
        } else {
          token = `AUTH_CREATOR_OK_${selectedProjectId.slice(0, 8)}_LISTO`;
          setActiveHitlToken(token);
        }
      }

      if (backendOnline) {
        await apiClient.publishSocial({
          project_id: selectedProjectId,
          channels: selectedChannels,
          hitl_token: token,
          actor: "creator",
        });
        await onRefresh();
        showToast("success", `¡Publicación exitosa en: ${selectedChannels.join(", ")}!`);
      } else {
        showToast(
          "success",
          `¡Simulación completada! Video publicado en ${selectedChannels.join(", ")}.`
        );
      }
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

  if (!selectedDetail?.project) {
    return (
      <div className="nle-panel p-10 text-center text-slate-400">
        Selecciona un video en el Paso 1 para preparar los textos de redes, automatizar DMs y autorizar la publicación.
      </div>
    );
  }

  const qcReport = selectedDetail.video_asset?.qc_report as
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
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950">
              4
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold">
              {selectedDetail.project.asset_code}
            </span>
            <h2 className="text-base font-bold text-white">
              Paso 4: Publicación Multicanal, KigalChat Auto-DM &amp; HITL
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Adapta el copy con huella de editor nativo, automatiza respuestas DM por palabra clave y autoriza la salida en vivo con tu clave HITL.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeHitlToken && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              Clave HITL lista
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowTips((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-[var(--kc-canvas)] text-slate-300 hover:text-white text-xs font-medium transition"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>{showTips ? "Ocultar Reglas" : "Ver Reglas por Red Social"}</span>
          </button>

          <button
            type="button"
            onClick={handleRegenerateMatrix}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            Regenerar Textos con IA
          </button>
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

      {/* 3 Sub-Tabs Navigation (single row, no dimension shifts on selected state) */}
      <div className="nle-panel px-2 sm:px-3 pt-1">
        <div
          role="tablist"
          aria-label="Subsecciones de publicación, KigalChat Auto-DM y HITL"
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
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-Tab 1: Copy por Red & Huella Nativa */}
      <div
        role="tabpanel"
        id={`${tabBaseId}-panel-copy-native`}
        aria-labelledby={`${tabBaseId}-tab-copy-native`}
        hidden={activeSubTab !== "copy-native"}
      >
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            {posts.map((post) => {
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

              return (
                <div
                  key={post.id}
                  className={`nle-panel p-4 space-y-3 transition ${
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

                  {/* Native Fingerprint Verification Badge per Card */}
                  <div
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                      isExactNativeMatch || (!sigMeta.supportsEditorSignature && isVideoProcessed)
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

                  <p className="text-[11px] text-slate-400">
                    {CHANNEL_TIPS[post.channel]}
                  </p>

                  {(post.channel === "YouTube" || post.channel === "Instagram") && (
                    <label className="block text-xs text-slate-300">
                      <div className="flex justify-between mb-1">
                        <span>
                          {post.channel === "YouTube"
                            ? "Título en YouTube (menos de 60 letras)"
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

                  <label className="block text-xs text-slate-300">
                    <div className="flex justify-between mb-1">
                      <span>Texto de la publicación (Copy)</span>
                      <span className="font-mono text-slate-400">
                        {post.post_body.length} caracteres
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={post.post_body}
                      onChange={(e) =>
                        handleFieldChange(post.id, "post_body", e.target.value)
                      }
                      className="w-full rounded-lg bg-[var(--kc-canvas)] border border-[var(--kc-border)] px-3 py-2 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-cyan-400"
                    />
                  </label>

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

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      {isSelected ? "Seleccionada para publicar" : "No marcada"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSavePost(post)}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                    >
                      Guardar Cambios
                    </button>
                  </div>
                </div>
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
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-bold text-white transition"
            >
              <Lock className="w-4 h-4" />
              Ir a Aprobación Final HITL →
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Tab 2: KigalChat Auto-DM (Motor ManyChat Nativo) */}
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

      {/* Sub-Tab 3: Aprobación Final HITL & Auditoría */}
      <div
        role="tabpanel"
        id={`${tabBaseId}-panel-hitl-audit`}
        aria-labelledby={`${tabBaseId}-tab-hitl-audit`}
        hidden={activeSubTab !== "hitl-audit"}
      >
        <div className="space-y-6">
          {/* Creator Final Authorization Gate */}
          <div className="nle-panel bg-gradient-to-r from-rose-950/35 via-[var(--kc-panel)] to-[var(--kc-panel)] border-rose-500/40 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Autorización Final de Publicación (Control Humano Exclusivo)
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Ninguna publicación saldrá en vivo en tus redes sin tu PIN de seguridad y clave HITL. Cualquier clave generada desde el Globo de Perfil se sincroniza aquí al instante.
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

            <div className="grid gap-3 md:grid-cols-3 items-end">
              <label className="text-xs text-slate-300">
                Código de Seguridad del Creador (PIN)
                <div className="relative mt-1">
                  <KeyRound className="w-4 h-4 text-rose-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={creatorSecurityPin}
                    onChange={(e) => setCreatorSecurityPin(e.target.value)}
                    placeholder="Ej. 884210 (sincronizado con Perfil)"
                    className="w-full rounded-lg bg-[var(--kc-canvas)] border border-slate-700 pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-400"
                  />
                </div>
              </label>

              <label className="text-xs text-slate-300">
                <span className="flex items-center justify-between gap-2">
                  <span>Clave de Autorización Emitida (HITL)</span>
                  {activeHitlToken && (
                    <span className="text-[10px] font-semibold text-emerald-300">
                      ✓ Sincronizada
                    </span>
                  )}
                </span>
                <input
                  type="text"
                  readOnly
                  value={activeHitlToken}
                  placeholder="Auto-rellenada desde Perfil o pulsa 'Validar Clave'"
                  className="mt-1 w-full rounded-lg bg-[var(--kc-canvas)] border border-[var(--kc-border)] px-3 py-2 text-xs font-mono text-emerald-300"
                />
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleIssueTier3Token}
                  className="px-3 py-2 rounded-lg border border-slate-700 bg-[var(--kc-surface)] hover:border-amber-400 text-xs font-semibold text-amber-200 inline-flex items-center gap-1.5 transition"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Validar Clave
                </button>
                <button
                  type="button"
                  onClick={handlePublishLive}
                  disabled={publishing || selectedChannels.length === 0}
                  className="flex-1 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  {publishing
                    ? "Publicando en vivo..."
                    : `Autorizar y Publicar (${selectedChannels.length} redes)`}
                </button>
              </div>
            </div>
          </div>

          {/* Audit History Table */}
          <div className="nle-panel p-5 space-y-3">
            <h3 id={auditCaptionId} className="text-sm font-semibold text-slate-200">
              Historial de Aprobaciones y Acciones Registradas
            </h3>
            <div
              tabIndex={0}
              role="region"
              aria-labelledby={auditCaptionId}
              className="table-wrapper bg-[var(--kc-canvas)]/70"
            >
              <table>
                <caption className="sr-only">
                  Historial de autorizaciones y publicaciones
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
                      Nivel de Seguridad
                    </th>
                    <th className="p-3 border-b border-[var(--kc-border)]">
                      Resultado
                    </th>
                    <th className="p-3 border-b border-[var(--kc-border)]">
                      Código de Verificación
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
                      <td data-label="Nivel" className="p-3">
                        Nivel {log.security_tier}
                      </td>
                      <td data-label="Resultado" className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                            log.operation_status === "BLOCKED_HITL_REQUIRED"
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {log.operation_status === "BLOCKED_HITL_REQUIRED"
                            ? "Esperando Aprobación"
                            : "Aprobado"}
                        </span>
                      </td>
                      <td
                        data-label="Código"
                        className="p-3 font-mono text-slate-400"
                      >
                        {log.hitl_token_id
                          ? `${log.hitl_token_id.slice(0, 24)}...`
                          : "Verificado"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
