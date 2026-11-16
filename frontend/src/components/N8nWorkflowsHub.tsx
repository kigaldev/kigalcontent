"use client";

import React, { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Workflow,
  Zap,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useEngineStore } from "@/store/useEngineStore";
import type { N8nWorkflowTemplate } from "@/types/engine";

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
      "POST /api/v1/ideas/score-ice",
      "POST /api/v1/projects",
      "POST /api/v1/scripts/generate",
    ],
    workflow_json: {
      name: "01 - Radar Matutino de Ideas ICE y Guionización IA",
      nodes: [
        {
          id: "cron-matutino",
          name: "Cada Mañana 08:00",
          type: "n8n-nodes-base.scheduleTrigger",
          parameters: {
            rule: { interval: [{ field: "hours", hoursInterval: 24, triggerAtHour: 8 }] },
          },
          position: [220, 300],
        },
        {
          id: "http-eval-ice",
          name: "Evaluar Idea (ICE Scorer)",
          type: "n8n-nodes-base.httpRequest",
          parameters: {
            method: "POST",
            url: "={{ $env.ACE_BACKEND_API || 'http://ace-backend:8000/api/v1' }}/ideas/score-ice",
          },
          position: [440, 300],
        },
      ],
      connections: {},
      active: false,
    },
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
    workflow_json: {
      name: "02 - Ingesta Automática desde Google Drive y Procesado FFmpeg (-14 LUFS)",
      nodes: [
        {
          id: "webhook-drive",
          name: "Webhook Nueva Grabación",
          type: "n8n-nodes-base.webhook",
          parameters: { httpMethod: "POST", path: "ace-drive-ingest" },
          position: [220, 300],
        },
      ],
      connections: {},
      active: false,
    },
  },
  {
    workflow_id: "03-hitl-alert",
    filename: "03_alerta_hitl_aprobacion_movil.json",
    name: "03 - Alerta HITL al Móvil (Revisión antes de Publicar)",
    trigger_type: "Webhook",
    schedule_or_webhook: "POST /webhook/ace-hitl-alert",
    description:
      "Cuando un vídeo queda listo para publicar, envía un aviso a Telegram con el resumen y enlace directo para tu aprobación humana (Nivel 3).",
    endpoints_used: ["Telegram Bot API"],
    workflow_json: {
      name: "03 - Alerta HITL al Móvil (Revisión antes de Publicar)",
      nodes: [
        {
          id: "webhook-hitl",
          name: "Webhook Estado HITL Pendiente",
          type: "n8n-nodes-base.webhook",
          parameters: { httpMethod: "POST", path: "ace-hitl-alert" },
          position: [220, 300],
        },
      ],
      connections: {},
      active: false,
    },
  },
  {
    workflow_id: "04-publish-multichannel",
    filename: "04_publicacion_multicanal_escalonada.json",
    name: "04 - Publicación Multicanal Segura (Con Token HMAC)",
    trigger_type: "Webhook",
    schedule_or_webhook: "POST /webhook/ace-publish-approved",
    description:
      "Emite token criptográfico HITL Nivel 3 con verificación 2FA y publica simultáneamente en YouTube, Instagram, TikTok y LinkedIn.",
    endpoints_used: [
      "POST /api/v1/hitl/issue-token",
      "POST /api/v1/social/publish",
    ],
    workflow_json: {
      name: "04 - Publicación Multicanal Segura (Con Token HMAC)",
      nodes: [
        {
          id: "webhook-publish",
          name: "Webhook Publicación Autorizada",
          type: "n8n-nodes-base.webhook",
          parameters: { httpMethod: "POST", path: "ace-publish-approved" },
          position: [220, 300],
        },
      ],
      connections: {},
      active: false,
    },
  },
  {
    workflow_id: "05-rmta-weekly",
    filename: "05_auditoria_rmta_aprendizaje.json",
    name: "05 - Auditoría Semanal RMT-A y Memoria Episódica",
    trigger_type: "Schedule / Cron",
    schedule_or_webhook: "Lunes 09:00 AM",
    description:
      "Ejecuta diagnóstico de 4 capas (Hold Rate 3s, Retención, Envíos) y guarda las lecciones aprendidas en learned_rules.md para mejorar futuros guiones.",
    endpoints_used: ["POST /api/v1/analytics/diagnose-rmta"],
    workflow_json: {
      name: "05 - Auditoría Semanal RMT-A y Memoria Episódica",
      nodes: [
        {
          id: "cron-weekly",
          name: "Todos los Lunes 09:00",
          type: "n8n-nodes-base.scheduleTrigger",
          parameters: {
            rule: { interval: [{ field: "weeks", weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 9 }] },
          },
          position: [220, 300],
        },
      ],
      connections: {},
      active: false,
    },
  },
];

export function N8nWorkflowsHub() {
  const { backendOnline, showToast } = useEngineStore();
  const [workflows, setWorkflows] = useState<N8nWorkflowTemplate[]>(FALLBACK_WORKFLOWS);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

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
    return () => {
      active = false;
    };
  }, [backendOnline]);

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

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Workflow className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Ecosistema de Flujos Automáticos para n8n (MiniPC)
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                5 Plantillas Listas
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Descarga o copia estos 5 flujos oficiales e impórtalos en tu n8n local (<code>http://localhost:5678</code>) para automatizar ideas, Google Drive, avisos a Telegram y analítica semanal.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInstructions((v) => !v)}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:border-amber-400 text-xs font-medium text-slate-200 transition"
          >
            {showInstructions ? "Ocultar Guía Rápida" : "¿Cómo importarlos en n8n?"}
          </button>
          <a
            href="http://localhost:5678"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition"
          >
            Abrir n8n Local
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {showInstructions && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 text-xs text-slate-200 space-y-1.5">
          <p className="font-bold text-amber-300">Pasos para importar en 30 segundos en tu MiniPC:</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300">
            <li>
              Pulsa <strong>Copiar JSON</strong> o <strong>Descargar .JSON</strong> en cualquiera de los 5 flujos de abajo.
            </li>
            <li>
              Abre tu panel de n8n (<code>http://localhost:5678</code>), crea un nuevo flujo y pega con <code>Ctrl+V</code> (o menú <em>Import from File</em>).
            </li>
            <li>
              Los nodos ya apuntan automáticamente a <code>http://ace-backend:8000/api/v1</code> dentro de la red privada Docker del MiniPC.
            </li>
          </ol>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {workflows.map((wf) => {
          const isCron = wf.trigger_type.toLowerCase().includes("cron");
          return (
            <div
              key={wf.workflow_id}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isCron
                        ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                        : "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                    }`}
                  >
                    {isCron ? <Clock className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                    {wf.schedule_or_webhook}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-white leading-snug">{wf.name}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">{wf.description}</p>

                <div className="flex flex-wrap gap-1 pt-1">
                  {wf.endpoints_used.map((ep) => (
                    <span
                      key={ep}
                      className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300"
                    >
                      {ep}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyJson(wf)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 transition"
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
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-[11px] font-bold text-amber-300 transition"
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
