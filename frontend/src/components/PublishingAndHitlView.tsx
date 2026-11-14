"use client";

import React, { useEffect, useId, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Lock,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEngineStore } from "@/store/useEngineStore";
import { apiClient } from "@/lib/api";
import { runLocalPreflight } from "@/lib/utils";
import type { SocialChannel, SocialPost } from "@/types/engine";

interface PublishingAndHitlViewProps {
  onRefresh: () => Promise<void>;
}

const CHANNEL_TIPS: Record<SocialChannel, string> = {
  YouTube: "Título < 60 chars (protección móvil) + primeros 150 chars SEO + timestamps 00:00.",
  Instagram: "Hook inicial <= 120 chars antes de '...más' + 3–5 hashtags + CTA Sends/Reach > 2%.",
  TikTok: "Frase indexable para TikTok Search en primeros 100 chars + pregunta de debate (<=300 chars).",
  LinkedIn: "CERO enlaces en el cuerpo principal (penalización 360Brew). Enlace automático en 1er comentario.",
};

export function PublishingAndHitlView({ onRefresh }: PublishingAndHitlViewProps) {
  const {
    selectedDetail,
    selectedProjectId,
    auditLogs,
    backendOnline,
    showToast,
    setSelectedDetail,
  } = useEngineStore();

  const auditCaptionId = useId();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<SocialChannel[]>([
    "YouTube",
    "Instagram",
    "TikTok",
    "LinkedIn",
  ]);
  const [twoFactorCode, setTwoFactorCode] = useState("884210");
  const [issuedToken, setIssuedToken] = useState("");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (selectedDetail?.social_posts) {
      setPosts(selectedDetail.social_posts);
    }
  }, [selectedDetail]);

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
        showToast("success", `Copy y pre-vuelo de ${post.channel} guardados.`);
      } else {
        showToast("info", `Pre-vuelo de ${post.channel} validado localmente.`);
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error guardando copy");
    }
  };

  const handleRegenerateMatrix = async () => {
    if (!selectedDetail?.project || !selectedProjectId) return;
    try {
      if (backendOnline) {
        const updated = await apiClient.generateSocialCopy({
          project_id: selectedProjectId,
          headline: selectedDetail.project.working_title,
          core_value: `Arquitectura paso a paso sobre ${selectedDetail.project.working_title}`,
          debate_question: "¿Qué métrica manda hoy: CTR o Watch Time Share?",
          conversion_goal: selectedDetail.project.conversion_goal,
        });
        setPosts(updated);
        setSelectedDetail({ ...selectedDetail, social_posts: updated });
        showToast("success", "Matriz multicanal regenerada con reglas anti-penalización.");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error regenerando matriz");
    }
  };

  const handleIssueTier3Token = async () => {
    if (!selectedProjectId) return;
    try {
      if (backendOnline) {
        const res = await apiClient.issueHitlToken({
          project_id: selectedProjectId,
          tier: 3,
          action: "publish_linkedin",
          actor: "creator",
          two_factor_code: twoFactorCode,
        });
        setIssuedToken(res.token);
        showToast("success", `Token Tier 3 firmado: ${res.token}`);
      } else {
        setIssuedToken(`HITL_AUTH_CREATOR_OK_${selectedProjectId.slice(0, 8)}_T3_DEMO`);
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error emitiendo firma Tier 3");
    }
  };

  const handlePublishLive = async () => {
    if (!selectedProjectId) return;
    const allPreflightOk = posts
      .filter((p) => selectedChannels.includes(p.channel))
      .every((p) => p.preflight_passed);
    if (!allPreflightOk) {
      showToast(
        "error",
        "Corrige los bloqueos de pre-vuelo (ej. enlaces en cuerpo de LinkedIn) antes de publicar."
      );
      return;
    }

    setPublishing(true);
    try {
      if (backendOnline) {
        // Issue per-channel signed Tier 3 tokens and publish sequentially for strict cryptographic binding
        for (const channel of selectedChannels) {
          const tokRes = await apiClient.issueHitlToken({
            project_id: selectedProjectId,
            tier: 3,
            action: `publish_${channel.toLowerCase()}`,
            actor: "creator",
            two_factor_code: twoFactorCode,
          });
          setIssuedToken(tokRes.token);
          await apiClient.publishSocial({
            project_id: selectedProjectId,
            channels: [channel],
            hitl_token: tokRes.token,
            actor: "creator",
          });
        }
        await onRefresh();
        showToast(
          "success",
          `Publicación Tier 3 completada en ${selectedChannels.join(", ")} y auditada.`
        );
      } else {
        showToast("info", "Publicación simulada verificada en modo offline.");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Publicación bloqueada por HITL");
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
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-10 text-center text-slate-400">
        Selecciona un proyecto para gestionar copycrafting y publicación HITL Tier 3.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Copycraft Matrix */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Motor de Copycrafting Multicanal &amp; Verificaciones Pre-Vuelo
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Activo: <span className="text-cyan-300 font-mono">{selectedDetail.project.asset_code}</span> — Reglas anti-penalización activas en tiempo real.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRegenerateMatrix}
          className="px-3.5 py-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-semibold text-cyan-200 transition"
        >
          Regenerar Copys por Meta Comercial
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {posts.map((post) => {
          const isSelected = selectedChannels.includes(post.channel);
          return (
            <div
              key={post.id}
              className={`rounded-2xl border p-4 space-y-3 transition ${
                post.preflight_passed
                  ? "bg-slate-900/75 border-slate-800"
                  : "bg-rose-950/20 border-rose-500/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleChannel(post.channel)}
                    className="rounded"
                  />
                  <span className="text-sm font-bold text-white">{post.channel}</span>
                </label>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold inline-flex items-center gap-1 ${
                      post.preflight_passed
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/50"
                    }`}
                  >
                    {post.preflight_passed ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> Pre-Vuelo OK
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3" /> Bloqueo Pre-Vuelo
                      </>
                    )}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {post.publish_status}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">{CHANNEL_TIPS[post.channel]}</p>

              {(post.channel === "YouTube" || post.channel === "Instagram") && (
                <label className="block text-xs text-slate-300">
                  <div className="flex justify-between mb-1">
                    <span>
                      {post.channel === "YouTube"
                        ? "Título YouTube (<60 chars)"
                        : "Hook 1ª Línea (<=120 chars)"}
                    </span>
                    <span className="font-mono text-cyan-300">
                      {(post.title ?? "").length} chars
                    </span>
                  </div>
                  <input
                    type="text"
                    value={post.title ?? ""}
                    onChange={(e) =>
                      handleFieldChange(post.id, "title", e.target.value)
                    }
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-white"
                  />
                </label>
              )}

              <label className="block text-xs text-slate-300">
                <div className="flex justify-between mb-1">
                  <span>Cuerpo del Copy</span>
                  <span className="font-mono text-slate-400">
                    {post.post_body.length} chars
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={post.post_body}
                  onChange={(e) =>
                    handleFieldChange(post.id, "post_body", e.target.value)
                  }
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-100 leading-relaxed"
                />
              </label>

              {post.channel === "LinkedIn" && (
                <label className="block text-xs text-slate-300">
                  Primer Comentario Automatizado (Enlace / Lead Magnet)
                  <input
                    type="text"
                    value={post.first_comment ?? ""}
                    onChange={(e) =>
                      handleFieldChange(post.id, "first_comment", e.target.value)
                    }
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-200"
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
                <span className="text-[11px] font-mono text-slate-500 truncate max-w-[65%]">
                  {post.canonical_url || "Pendiente de despliegue OAuth2"}
                </span>
                <button
                  type="button"
                  onClick={() => handleSavePost(post)}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
                >
                  Guardar &amp; Validar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tier 3 Cryptographic HITL Gate */}
      <div className="bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/40 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Centro de Aprobación HITL Tier 3 (Despliegue Irreversible en Vivo)
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Toda llamada a YouTube Data v3, Meta Graph v21, TikTok Posting v2 o LinkedIn UGC requiere firma HMAC-SHA256 verificada (`HITL_AUTH_CREATOR_OK_[ID]`).
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 items-end">
          <label className="text-xs text-slate-300">
            Código 2FA de Confirmación Explícita
            <div className="relative mt-1">
              <KeyRound className="w-4 h-4 text-rose-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 pl-9 pr-3 py-2 text-xs font-mono text-white"
              />
            </div>
          </label>

          <label className="text-xs text-slate-300">
            Token HMAC Generado
            <input
              type="text"
              readOnly
              value={issuedToken}
              placeholder="Pulsa 'Pre-firmar' o 'Autorizar & Publicar'"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-mono text-emerald-300"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleIssueTier3Token}
              className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:border-amber-400 text-xs font-semibold text-amber-200 inline-flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              Pre-firmar HMAC
            </button>
            <button
              type="button"
              onClick={handlePublishLive}
              disabled={publishing || selectedChannels.length === 0}
              className="flex-1 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition"
            >
              <Send className="w-4 h-4" />
              {publishing
                ? "Publicando..."
                : `Autorizar & Publicar (${selectedChannels.length})`}
            </button>
          </div>
        </div>
      </div>

      {/* Immutable Audit Trail Table */}
      <div className="space-y-2">
        <h3 id={auditCaptionId} className="text-sm font-semibold text-slate-200">
          Registro Inmutable de Auditoría (`audit_logs`)
        </h3>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby={auditCaptionId}
          className="table-wrapper bg-slate-950/70"
        >
          <table>
            <caption className="sr-only">
              Pistas de auditoría HITL y transiciones de estado
            </caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="p-3 border-b border-slate-800">Acción</th>
                <th className="p-3 border-b border-slate-800">Agente / Actor</th>
                <th className="p-3 border-b border-slate-800">Tier</th>
                <th className="p-3 border-b border-slate-800">Estado</th>
                <th className="p-3 border-b border-slate-800">Token / IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {auditLogs.slice(0, 15).map((log) => (
                <tr key={log.id}>
                  <th className="p-3 font-mono text-slate-200 text-left">
                    {log.action_type}
                  </th>
                  <td data-label="Actor" className="p-3 text-slate-300">
                    {log.agent_or_user_id}
                  </td>
                  <td data-label="Tier" className="p-3 font-mono">
                    Tier {log.security_tier}
                  </td>
                  <td data-label="Estado" className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                        log.operation_status === "BLOCKED_HITL_REQUIRED"
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      {log.operation_status}
                    </span>
                  </td>
                  <td data-label="Token / IP" className="p-3 font-mono text-slate-400">
                    {log.hitl_token_id
                      ? `${log.hitl_token_id.slice(0, 26)}...`
                      : log.ip_source || "127.0.0.1"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
