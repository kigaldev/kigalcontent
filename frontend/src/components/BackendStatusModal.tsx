"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Server,
  X,
} from "lucide-react";
import { apiClient, getApiBaseUrl, getCustomBackendUrl, setCustomBackendUrl } from "@/lib/api";

interface BackendStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReconnected: () => void;
  backendOnline: boolean;
}

export function BackendStatusModal({
  isOpen,
  onClose,
  onReconnected,
  backendOnline,
}: BackendStatusModalProps) {
  const [currentUrl, setCurrentUrl] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const activeUrl = getApiBaseUrl();
      const customUrl = getCustomBackendUrl();
      setCurrentUrl(activeUrl);
      setInputUrl(customUrl || activeUrl);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    const target = inputUrl.trim();
    if (!target) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiClient.health(target);
      setTestResult({
        success: true,
        message: "¡Conexión exitosa con el backend!",
        details: `Estado: ${res.status} · URL probada: ${target}`,
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: "No se pudo conectar al endpoint.",
        details: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleApplyAndConnect = async () => {
    const target = inputUrl.trim();
    setCustomBackendUrl(target);
    setCurrentUrl(getApiBaseUrl());
    await handleTestConnection();
    onReconnected();
  };

  const handleResetDefault = () => {
    setCustomBackendUrl(null);
    const def = getApiBaseUrl();
    setCurrentUrl(def);
    setInputUrl(def);
    setTestResult(null);
    onReconnected();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                backendOnline
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400"
              }`}
            >
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Estado y Conexión del Backend
              </h2>
              <p className="text-xs text-slate-400">
                Verifica la conexión entre Vercel y tu servidor Railway / MiniPC
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Status Badge */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-3 w-3 rounded-full ${
                  backendOnline
                    ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse"
                    : "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]"
                }`}
              />
              <span className="text-sm font-medium text-slate-200">
                {backendOnline ? "Servidor Online y Operativo" : "Modo Local / Desconectado"}
              </span>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {backendOnline ? "HTTP 200 OK" : "Sin respuesta"}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400 font-mono break-all bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
            URL actual en uso: <span className="text-cyan-300 font-semibold">{currentUrl}</span>
          </div>
        </div>

        {/* Manual URL Input */}
        <div className="mt-4 space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>URL de la API Backend (Railway o Local)</span>
            <span className="text-[11px] text-slate-500 font-normal">
              Ej: https://tudominio.up.railway.app
            </span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://autonomous-content-engine-backend-production.up.railway.app"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !inputUrl.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-700 transition disabled:opacity-50"
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
              ) : (
                <Activity className="h-3.5 w-3.5 text-cyan-400" />
              )}
              Probar
            </button>
          </div>

          {/* Test feedback */}
          {testResult && (
            <div
              className={`rounded-xl border p-3 text-xs ${
                testResult.success
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200"
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
              {testResult.details && (
                <p className="mt-1 text-[11px] opacity-80 font-mono break-all">
                  {testResult.details}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Informative Help Box */}
        <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-xs text-cyan-200/90 leading-relaxed">
          <p className="font-semibold text-cyan-300 mb-1 flex items-center gap-1.5">
            💡 ¿Por qué aparece &quot;Modo Local&quot; en Vercel?
          </p>
          <p className="text-[11px] text-slate-300">
            En Next.js, la variable <code className="text-cyan-300 font-mono">NEXT_PUBLIC_API_URL</code> se incrusta en el código durante la compilación (<code className="text-cyan-300 font-mono">next build</code>). Si añadiste la variable en los Ajustes de Vercel después del último despliegue:
          </p>
          <ol className="list-decimal list-inside text-[11px] text-slate-300 mt-1.5 space-y-1">
            <li>Ve a tu proyecto en <strong>Vercel &gt; Deployments</strong>.</li>
            <li>En el último despliegue, haz clic en los <strong>tres puntos (&hellip;) &gt; Redeploy</strong>.</li>
            <li>O simplemente pega la URL de Railway arriba y pulsa <strong>Guardar y Conectar</strong> para que se conecte de inmediato en tu navegador sin esperar.</li>
          </ol>
        </div>

        {/* Modal Actions */}
        <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={handleResetDefault}
            className="text-xs text-slate-400 hover:text-slate-200 transition underline underline-offset-4"
          >
            Restablecer por defecto
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleApplyAndConnect}
              disabled={testing || !inputUrl.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Guardar y Conectar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
