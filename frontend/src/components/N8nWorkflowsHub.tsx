"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Lock,
  RefreshCw,
  Save,
  Workflow,
  Zap,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useEngineStore } from "@/store/useEngineStore";
import type {
  N8nLiveStatusResponse,
  N8nLiveWorkflowStatus,
  N8nWorkflowTemplate,
} from "@/types/engine";

const FALLBACK_WORKFLOWS: N8nWorkflowTemplate[] = [
  {
    workflow_id: "01-radar-ideas-ice",
    filename: "01_radar_ideas_ice_matutino.json",
    name: "01 - Radar Matutino de Ideas ICE y Guionización IA",
    trigger_type: "Schedule / Cron",
    schedule_or_webhook: "Todos los días 08:00 AM",
    description:
      "Evalúa propuestas con ICE Score. Si supera 7.0, crea el proyecto en el tablero Kanban y redacta el guión AV con Ollama.",
    endpoints_used: [
      "POST /api/v1/ideas/radar-matutino",
      "POST /api/v1/projects",
      "POST /api/v1/scripts/generate",
    ],
    workflow_json: {},
  },
  {
    workflow_id: "02-drive-ffmpeg",
    filename: "02_ingesta_google_drive_ffmpeg.json",
    name: "02 - Ingesta Google Drive y Procesado FFmpeg (-14 LUFS)",
    trigger_type: "Webhook",
    schedule_or_webhook: "POST /webhook/ace-drive-ingest",
    description:
      "Escanea nuevas grabaciones en Google Drive, recorta silencios, normaliza el audio a EBU R128 (-14 LUFS) y genera subtítulos con Whisper.",
    endpoints_used: [
      "POST /api/v1/media/google-drive/scan",
      "POST /api/v1/media/google-drive/import",
    ],
    workflow_json: {},
  },
  {
    workflow_id: "03-hitl-alert",
    filename: "03_alerta_hitl_aprobacion_movil.json",
    name: "03 - Alerta al Móvil (Revisión antes de Publicar)",
    trigger_type: "Webhook",
    schedule_or_webhook: "POST /webhook/ace-hitl-alert",
    description:
      "Cuando un vídeo queda listo para publicar, envía un aviso a Telegram con el resumen y enlace directo a KigalContent Studio.",
    endpoints_used: ["Telegram Bot API"],
    workflow_json: {},
  },
  {
    workflow_id: "04-publish-multichannel",
    filename: "04_publicacion_multicanal_escalonada.json",
    name: "04 - Publicación Multicanal Automática",
    trigger_type: "Webhook",
    schedule_or_webhook: "POST /webhook/ace-publish-approved",
    description:
      "Publica simultáneamente en YouTube, Instagram, TikTok y LinkedIn cuando se dispara el webhook desde KigalContent.",
    endpoints_used: ["POST /api/v1/social/publish"],
    workflow_json: {},
  },
  {
    workflow_id: "05-rmta-weekly",
    filename: "05_auditoria_rmta_aprendizaje.json",
    name: "05 - Auditoría Semanal RMT-A y Memoria Episódica",
    trigger_type: "Schedule / Cron",
    schedule_or_webhook: "Lunes 09:00 AM",
    description:
      "Ejecuta diagnóstico de 4 capas (Hold Rate 3s, Retención, Envíos) y guarda las lecciones aprendidas para mejorar futuros guiones.",
    endpoints_used: ["POST /api/v1/analytics/diagnose-rmta"],
    workflow_json: {},
  },
  {
    workflow_id: "06-radar-reels-virales",
    filename: "06_radar_reels_virales_inspiracion.json",
    name: "06 - Radar Diario de Reels Virales (Inspiración del Tema del Día)",
    trigger_type: "Schedule / Cron",
    schedule_or_webhook: "Todos los días 08:15 AM",
    description:
      "Toma las temáticas recién capturadas por el Flujo 01, busca los Reels con más reproducciones y engagement vía Apify y adjunta los mejores enlaces y ganchos a cada proyecto del Kanban.",
    endpoints_used: [
      "GET /api/v1/projects",
      "POST /api/v1/radar/reels-inspiration",
    ],
    workflow_json: {},
  },
];

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
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

export function N8nWorkflowsHub() {
  const { backendOnline, showToast } = useEngineStore();
  const [workflows, setWorkflows] = useState<N8nWorkflowTemplate[]>(FALLBACK_WORKFLOWS);
  const [liveStatus, setLiveStatus] = useState<N8nLiveStatusResponse | null>(null);
  const [checkingLive, setCheckingLive] = useState(false);
  const [savingConn, setSavingConn] = useState(false);
  const [n8nBaseUrl, setN8nBaseUrl] = useState("http://127.0.0.1:5678");
  const [n8nApiKey, setN8nApiKey] = useState("");
  const [showConnConfig, setShowConnConfig] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const loadLiveStatus = useCallback(async () => {
    if (!backendOnline) return;
    setCheckingLive(true);
    try {
      const status = await apiClient.getN8nLiveStatus();
      setLiveStatus(status);
      if (status.n8n_base_url) {
        setN8nBaseUrl(status.n8n_base_url);
      }
      if (!status.api_key_configured) {
        setShowConnConfig(true);
      }
    } catch {
      // Keep UI clean if backend is unreachable
    } finally {
      setCheckingLive(false);
    }
  }, [backendOnline]);

  useEffect(() => {
    let active = true;
    if (!backendOnline) return;
    apiClient
      .listN8nWorkflows()
      .then((res) => {
        if (active && Array.isArray(res) && res.length > 0) {
          setWorkflows(res);
        }
      })
      .catch(() => {
        // Keep embedded templates cleanly on fallback
      });
    void loadLiveStatus();
    return () => {
      active = false;
    };
  }, [backendOnline, loadLiveStatus]);

  const liveByCatalogId = useMemo(() => {
    const map = new Map<string, N8nLiveWorkflowStatus>();
    for (const item of liveStatus?.workflows ?? []) {
      if (item.matched_catalog_id) {
        map.set(item.matched_catalog_id, item);
      }
    }
    return map;
  }, [liveStatus]);

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!n8nBaseUrl.trim()) {
      showToast("error", "Introduce la URL de tu servidor n8n.");
      return;
    }
    setSavingConn(true);
    try {
      const updated = await apiClient.saveN8nConnection({
        base_url: n8nBaseUrl.trim(),
        api_key: n8nApiKey.trim() || undefined,
      });
      setLiveStatus(updated);
      setN8nApiKey("");
      if (updated.reachable) {
        setShowConnConfig(false);
        showToast("success", updated.message);
      } else {
        showToast("error", updated.message);
      }
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Error guardando conexión con n8n."
      );
    } finally {
      setSavingConn(false);
    }
  };

  const handleDownloadJson = (wf: N8nWorkflowTemplate) => {
    const content = JSON.stringify(wf.workflow_json, null, 2);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = wf.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("success", `Workflow descargado: ${wf.filename}`);
  };

  const handleCopyJson = async (wf: N8nWorkflowTemplate) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(wf.workflow_json, null, 2));
      setCopiedId(wf.workflow_id);
      showToast("info", "JSON del flujo copiado. Pégalo directo en tu lienzo de n8n (Ctrl+V).");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast("error", "No se pudo copiar al portapapeles.");
    }
  };

  const n8nOpenUrl = liveStatus?.n8n_base_url || "http://localhost:5678";

  return (
    <div className="rounded-2xl border-2 border-amber-400/50 border-l-[6px] border-l-amber-400 bg-gradient-to-br from-amber-950/45 via-[#141009]/92 to-[#070911]/95 p-5 sm:p-6 shadow-2xl space-y-5 backdrop-blur-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-400/20 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 border-2 border-amber-400/45 flex items-center justify-center text-amber-300 shrink-0 shadow-lg shadow-amber-500/15">
            <Workflow className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex flex-wrap items-center gap-2">
              Ecosistema de Automatizaciones n8n (MiniPC)
              {liveStatus?.reachable ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Conectado · {liveStatus.active_count}/{workflows.length} activas
                  {liveStatus.error_count > 0 && ` · ${liveStatus.error_count} con error`}
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/35">
                  {workflows.length} Flujos Oficiales
                </span>
              )}
            </h3>
            <p className="text-xs text-amber-100/75 mt-0.5">
              Comprueba en vivo qué automatizaciones están activas en tu servidor n8n y detecta errores de ejecución sin tener que entrar manualmente.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadLiveStatus()}
            disabled={checkingLive}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-amber-400/40 bg-slate-950/80 hover:border-amber-300 text-xs font-bold text-amber-200 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingLive ? "animate-spin" : ""}`} />
            <span>{checkingLive ? "Comprobando..." : "Comprobar Estado n8n"}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowInstructions((v) => !v)}
            className="px-3 py-1.5 rounded-xl border border-white/15 bg-slate-950/70 hover:border-amber-400/50 text-xs font-medium text-slate-200 transition"
          >
            {showInstructions ? "Ocultar Guía" : "¿Cómo importar?"}
          </button>
          <a
            href={n8nOpenUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20"
          >
            Abrir n8n
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Collapsible n8n Live API Connection Bar */}
      <div className="rounded-xl border-2 border-amber-400/25 bg-[#090807]/80 overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setShowConnConfig((v) => !v)}
          aria-expanded={showConnConfig}
          className="w-full px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-left hover:bg-white/[0.03] transition cursor-pointer"
        >
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {liveStatus?.reachable ? (
              <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <KeyRound className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            )}
            <span className="font-bold text-slate-100">
              Monitorización en vivo del servidor n8n
            </span>
            {liveStatus?.reachable ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-200">
                API conectada · Protegida
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/35 text-amber-200">
                Requiere N8N API Key
              </span>
            )}
            {liveStatus?.message && (
              <span className="hidden lg:inline text-[11px] text-slate-400 truncate max-w-[420px]">
                {liveStatus.message}
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 shrink-0">
            <span>{showConnConfig ? "Ocultar conexión" : "Configurar API n8n"}</span>
            {showConnConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {showConnConfig && (
          <form
            onSubmit={(e) => void handleSaveConnection(e)}
            className="p-4 border-t border-white/10 space-y-3"
          >
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Para consultar en vivo qué flujos están activos y detectar errores de ejecución: abre tu{" "}
              <strong className="text-amber-200">n8n → Settings → n8n API → Create an API key</strong>, pega la clave aquí y guarda.
            </p>
            <div className="grid sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-5">
                <label className="block text-slate-300 font-medium mb-1">
                  URL del servidor n8n (local o Tailscale/dominio)
                </label>
                <input
                  type="text"
                  value={n8nBaseUrl}
                  onChange={(e) => setN8nBaseUrl(e.target.value)}
                  placeholder="http://127.0.0.1:5678 o 192.168.x.x:5678"
                  className="w-full bg-slate-950 border-2 border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="sm:col-span-5">
                <label className="block text-slate-300 font-medium mb-1">
                  N8N API Key (header X-N8N-API-KEY)
                </label>
                <input
                  type="password"
                  value={n8nApiKey}
                  onChange={(e) => setN8nApiKey(e.target.value)}
                  placeholder={
                    liveStatus?.api_key_configured
                      ? "•••••••• (guardada — deja vacío para mantener)"
                      : "eyJhbGciOiJIUzI1NiIs..."
                  }
                  className="w-full bg-slate-950 border-2 border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={savingConn}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-bold transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingConn ? "Conectando..." : "Conectar"}</span>
                </button>
              </div>
            </div>
            {liveStatus && !liveStatus.reachable && liveStatus.configured && (
              <div className="rounded-lg border border-rose-400/40 bg-rose-950/35 px-3 py-2 text-[11px] text-rose-200">
                {liveStatus.message}
              </div>
            )}
          </form>
        )}
      </div>

      {/* Error Summary Banner if any active/installed workflow has a recent error */}
      {liveStatus?.reachable && liveStatus.error_count > 0 && (
        <div className="rounded-xl border-2 border-rose-500/60 bg-rose-950/45 px-4 py-3 text-xs text-rose-100 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-rose-200">
              Se detectaron errores en {liveStatus.error_count} flujo(s) de n8n.
            </strong>{" "}
            Revisa el detalle del nodo fallido en las tarjetas marcadas en rojo abajo.
          </div>
        </div>
      )}

      {showInstructions && (
        <div className="rounded-xl border border-amber-400/35 bg-amber-950/25 p-3.5 text-xs text-slate-200 space-y-1.5">
          <p className="font-bold text-amber-300">Pasos para importar en 30 segundos en tu MiniPC:</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300">
            <li>
              Pulsa <strong>Copiar JSON</strong> o <strong>Descargar .JSON</strong> en cualquiera de los 5 flujos de abajo.
            </li>
            <li>
              Abre tu panel de n8n (<code>{n8nOpenUrl}</code>), crea un nuevo flujo y pega con <code>Ctrl+V</code> (o menú <em>Import from File</em>).
            </li>
            <li>
              Las URLs ya apuntan directamente al backend de producción sin usar variables <code>$env</code> bloqueadas en n8n 2.x.
            </li>
          </ol>
        </div>
      )}

      {/* Workflows Grid */}
      <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
        {workflows.map((wf) => {
          const isCron = wf.trigger_type.toLowerCase().includes("cron");
          const live = liveByCatalogId.get(wf.workflow_id);
          const hasError = live?.last_execution_status === "error";
          const isOk = live?.last_execution_status === "success";

          return (
            <div
              key={wf.workflow_id}
              className={`rounded-xl border-2 p-4 flex flex-col justify-between space-y-3 transition ${
                hasError
                  ? "border-rose-500/70 bg-rose-950/25 shadow-lg shadow-rose-950/30"
                  : live?.active
                  ? "border-emerald-400/45 bg-emerald-950/20"
                  : "border-white/10 bg-slate-950/75 hover:border-amber-400/40"
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isCron
                        ? "bg-violet-500/15 text-violet-200 border border-violet-400/35"
                        : "bg-cyan-500/15 text-cyan-200 border border-cyan-400/35"
                    }`}
                  >
                    {isCron ? <Clock className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                    {wf.schedule_or_webhook}
                  </span>

                  {/* Live n8n Active / Inactive Pill */}
                  {liveStatus?.reachable && (
                    live ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          live.active
                            ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/45"
                            : "bg-slate-800/80 text-slate-300 border-white/15"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            live.active ? "bg-emerald-400" : "bg-slate-500"
                          }`}
                        />
                        {live.active ? "Activa en n8n" : "Inactiva"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-200 border border-amber-400/30">
                        No importada
                      </span>
                    )
                  )}
                </div>

                <h4 className="text-xs font-bold text-white leading-snug">{wf.name}</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">{wf.description}</p>

                {/* Live Execution Feedback Box */}
                {live && hasError && (
                  <div className="rounded-lg border border-rose-400/50 bg-rose-950/60 p-2.5 text-[11px] text-rose-100 space-y-1">
                    <div className="flex items-center justify-between gap-1 font-bold text-rose-200">
                      <span className="inline-flex items-center gap-1 truncate">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        <span className="truncate">
                          Error{live.last_error_node ? ` en «${live.last_error_node}»` : ""}
                        </span>
                      </span>
                      {live.last_execution_at && (
                        <span className="text-[10px] font-mono text-rose-300/80 shrink-0">
                          {formatRelativeTime(live.last_execution_at)}
                        </span>
                      )}
                    </div>
                    {live.last_error_message && (
                      <p className="font-mono text-[10px] text-rose-200/90 break-words leading-snug">
                        {live.last_error_message}
                      </p>
                    )}
                  </div>
                )}

                {live && isOk && (
                  <div className="rounded-lg border border-emerald-400/35 bg-emerald-950/40 px-2.5 py-1.5 text-[11px] text-emerald-200 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Última ejecución OK
                    </span>
                    {live.last_execution_at && (
                      <span className="text-[10px] font-mono text-emerald-300/80">
                        {formatRelativeTime(live.last_execution_at)}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-1 pt-0.5">
                  {wf.endpoints_used.map((ep) => (
                    <span
                      key={ep}
                      className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 font-mono text-[10px] text-slate-300"
                    >
                      {ep}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2.5 border-t border-white/10 flex items-center gap-2">
                {live?.editor_url && (
                  <a
                    href={live.editor_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-[11px] font-semibold text-white transition"
                    title="Abrir este flujo directamente en n8n"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>n8n</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleCopyJson(wf)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 transition"
                >
                  {copiedId === wf.workflow_id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copiar JSON
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadJson(wf)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/45 text-[11px] font-bold text-amber-200 transition"
                >
                  <Download className="w-3.5 h-3.5" /> .JSON
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
