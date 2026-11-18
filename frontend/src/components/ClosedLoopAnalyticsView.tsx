"use client";

import React, { useState } from "react";
import {
  Activity,
  BarChart3,
  Brain,
  FlaskConical,
  HelpCircle,
  Layers,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useEngineStore } from "@/store/useEngineStore";
import { apiClient } from "@/lib/api";
import type { RMTADiagnosisResponse, WatchTimeShareResponse } from "@/types/engine";

interface ClosedLoopAnalyticsViewProps {
  onRefresh: () => Promise<void>;
}

const RMTA_QUADRANTS = [
  {
    key: "REPETIR_FRANQUICIAR",
    title: "Repetir / Franquiciar",
    subtitle: "¡Gran éxito! Crea una serie o parte 2 de este tema.",
    style: "border-emerald-500/50 bg-emerald-950/20 text-emerald-300",
  },
  {
    key: "MEJORAR",
    title: "Mejorar (Título o Gancho)",
    subtitle: "El video es bueno pero la miniatura o el gancho necesitan más fuerza.",
    style: "border-amber-500/50 bg-amber-950/20 text-amber-300",
  },
  {
    key: "PROBAR",
    title: "Probar Nuevos Temas",
    subtitle: "Idea experimental para explorar un nuevo público.",
    style: "border-cyan-500/50 bg-cyan-950/20 text-cyan-300",
  },
  {
    key: "ABANDONAR",
    title: "Abandonar Temática",
    subtitle: "Tras varios intentos no interesa a tu comunidad. Pasa a otro tema.",
    style: "border-rose-500/50 bg-rose-950/20 text-rose-300",
  },
];

export function ClosedLoopAnalyticsView({
  onRefresh,
}: ClosedLoopAnalyticsViewProps) {
  const { analytics, selectedProjectId, backendOnline, showToast } =
    useEngineStore();

  const [showExplanation, setShowExplanation] = useState(false);
  const [windowType, setWindowType] = useState<"24h" | "7d" | "30d">("7d");

  // Watch Time Share A/B state
  const [impA, setImpA] = useState(10000);
  const [ctrA, setCtrA] = useState(8.0);
  const [avdA, setAvdA] = useState(40);
  const [impB, setImpB] = useState(10000);
  const [ctrB, setCtrB] = useState(5.0);
  const [avdB, setAvdB] = useState(180);
  const [wtsResult, setWtsResult] = useState<WatchTimeShareResponse | null>(null);

  // RMT-A Diagnostic Simulator state
  const [views, setViews] = useState(46800);
  const [baselineViews, setBaselineViews] = useState(14000);
  const [hold3s, setHold3s] = useState(74);
  const [completion, setCompletion] = useState(56.5);
  const [sendsReach, setSendsReach] = useState(3.1);
  const [rmtaDiag, setRmtaDiag] = useState<RMTADiagnosisResponse | null>(null);

  const activeSnap =
    analytics?.snapshots.find((s) => s.window_type === windowType) ??
    analytics?.snapshots[0];
  const retentionPoints = activeSnap?.retention_curve ?? [
    { sec: 0, pct: 100 },
    { sec: 3, pct: 74 },
    { sec: 15, pct: 65 },
    { sec: 30, pct: 61 },
    { sec: 60, pct: 54 },
  ];

  // Build SVG polyline coordinates
  const maxSec = Math.max(...retentionPoints.map((p) => p.sec), 60);
  const svgPoints = retentionPoints
    .map((pt) => {
      const x = 35 + (pt.sec / maxSec) * 540;
      const y = 175 - (pt.pct / 100) * 145;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const handleComputeWatchTimeShare = async () => {
    try {
      if (backendOnline) {
        const res = await apiClient.calculateWatchTimeShare({
          variant_a: { impressions: impA, ctr_pct: ctrA, avd_seconds: avdA },
          variant_b: { impressions: impB, ctr_pct: ctrB, avd_seconds: avdB },
        });
        setWtsResult(res);
      } else {
        const wA = impA * (ctrA / 100) * avdA;
        const wB = impB * (ctrB / 100) * avdB;
        const tot = wA + wB || 1;
        const sA = Math.round((wA / tot) * 10000) / 100;
        const sB = Math.round((wB / tot) * 10000) / 100;
        setWtsResult({
          variant_a_watch_time_seconds: wA,
          variant_b_watch_time_seconds: wB,
          share_a_pct: sA,
          share_b_pct: sB,
          winner: sA > sB ? "A" : "B",
          delta_pct: Math.abs(sA - sB),
          explanation: `La Opción ${sA > sB ? "A" : "B"} retiene un ${Math.abs(sA - sB).toFixed(1)}% más de tiempo de visualización total.`,
        });
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error calculando retención");
    }
  };

  const handleRunRmtaDiagnosis = async () => {
    try {
      if (backendOnline) {
        const res = await apiClient.diagnoseRmta({
          project_id: selectedProjectId ?? undefined,
          window_type: windowType,
          views,
          baseline_views: baselineViews,
          hold_rate_3s: hold3s,
          completion_rate: completion,
          sends_per_reach: sendsReach,
          dwell_time_seconds: 44.5,
          watch_time_share: wtsResult?.share_b_pct ?? 71.8,
          consecutive_bottom_quartile_iterations: 0,
          persist_rule: true,
        });
        setRmtaDiag(res);
        await onRefresh();
        showToast(
          "success",
          `Decisión generada: ${res.rmta_classification} — ${res.recommended_action}`
        );
      } else {
        const isRepeat = views > baselineViews * 1.5 && hold3s > 70;
        setRmtaDiag({
          views_factor_vs_baseline: Math.round((views / baselineViews) * 10) / 10,
          is_outlier_positive: isRepeat,
          is_outlier_negative: false,
          diagnosis_layer: isRepeat ? "Ejecución" : "Empaque",
          rmta_classification: isRepeat ? "REPETIR_FRANQUICIAR" : "MEJORAR",
          recommended_action: isRepeat
            ? "¡Gran rendimiento! Convierte este tema en una serie recurrente de videos."
            : "Ajusta la miniatura y los primeros 3 segundos para subir la retención inicial.",
          sends_social_value_sufficient: sendsReach >= 2.0,
          four_layer_breakdown: {
            Idea: { status: "Excelente", metric: `${views} visitas`, note: "Tema de alto interés" },
            Empaque: { status: "Aceptable", metric: `${hold3s}% a los 3s`, note: "Gancho inicial correcto" },
            Ejecución: { status: "Óptima", metric: `${completion}% completado`, note: "Buen ritmo" },
            Distribución: { status: "Alta", metric: `${sendsReach}% compartido`, note: "Viral en mensajes" },
          },
          learned_rule_statement: "Los videos con demostración práctica retienen 40% más que los explicativos teóricos.",
        });
        showToast("info", "Evaluación simulada localmente.");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error en diagnóstico");
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950">
              5
            </span>
            <h2 className="text-base font-bold text-white">
              Paso 5: Resultados, Retención y Aprendizaje Continuo
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Analiza qué videos mantuvieron a la audiencia atenta y aprende qué temas y formatos funcionan mejor para tus siguientes videos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowExplanation((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-300 hover:text-white text-xs font-medium transition"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>{showExplanation ? "Ocultar Guía" : "¿Cómo interpretar estos datos?"}</span>
          </button>

          {/* Timeframe Selector */}
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-1 text-xs font-semibold">
            {(["24h", "7d", "30d"] as const).map((win) => (
              <button
                key={win}
                type="button"
                onClick={() => setWindowType(win)}
                className={`px-3 py-1 rounded-md transition ${
                  windowType === win
                    ? "bg-cyan-500 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {win === "24h" ? "Primeras 24h" : win === "7d" ? "Últimos 7 días" : "Últimos 30 días"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Explanatory Banner */}
      {showExplanation && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-xs text-slate-200 space-y-2">
          <div className="font-bold text-cyan-300 text-sm flex items-center gap-2">
            💡 Guía de Métricas: Más allá de las visitas
          </div>
          <div className="grid sm:grid-cols-3 gap-3 pt-1">
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
              <strong className="text-white block mb-1">1. Retención a los 3 segundos:</strong>
              Mide cuántas personas decidieron quedarse tras el gancho inicial. Si es superior al 70%, el inicio de tu video es excelente.
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
              <strong className="text-white block mb-1">2. Tiempo Real de Visualización:</strong>
              Un video con menos clics pero visto completo es mucho más premiado por los algoritmos que uno con muchos clics que la gente abandona al instante.
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
              <strong className="text-white block mb-1">3. Compartidos por Mensaje:</strong>
              Cuando las personas envían tu video por WhatsApp o DM, las redes lo identifican como contenido de máximo valor y aumentan su difusión.
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400">Visualizaciones Totales</span>
          <div className="text-2xl font-bold text-white mt-1">
            {activeSnap ? activeSnap.view_count.toLocaleString() : "0"}
          </div>
          <span className="text-[11px] text-slate-400 font-semibold mt-1 inline-block">
            {activeSnap ? `+${(activeSnap.view_count / (baselineViews || 1)).toFixed(1)}x sobre la media` : "Sin publicaciones aún"}
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400">Retención inicial (3 seg)</span>
          <div className="text-2xl font-bold text-cyan-300 mt-1">
            {activeSnap ? `${activeSnap.hold_rate_3s}%` : "--"}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 inline-block">
            Meta recomendada: &gt;70%
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400">Vieron el video completo</span>
          <div className="text-2xl font-bold text-violet-300 mt-1">
            {activeSnap ? `${activeSnap.completion_rate}%` : "--"}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 inline-block">
            Meta en shorts: &gt;50%
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400">Compartidos por Mensaje</span>
          <div className="text-2xl font-bold text-emerald-300 mt-1">
            {activeSnap ? `${activeSnap.sends_per_reach}%` : "--"}
          </div>
          <span className="text-[11px] text-slate-400 font-semibold mt-1 inline-block">
            {activeSnap ? (activeSnap.sends_per_reach >= 2.0 ? "Contenido muy viral" : "Normal") : "Meta: >2.0%"}
          </span>
        </div>
      </div>

      {/* Retention Curve + Watch Time Share Comparison */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left: Second-by-Second Retention Curve */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Curva de Retención Segundo a Segundo
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Muestra qué porcentaje de personas continúa viendo el video a medida que pasan los segundos.
              </p>
            </div>
            <span className="text-xs font-bold text-cyan-300">
              {retentionPoints[retentionPoints.length - 1]?.pct ?? 54}% al final
            </span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-hidden">
            {activeSnap ? (
              <svg
                viewBox="0 0 600 200"
                className="w-full h-44 overflow-visible"
                aria-label="Gráfico de retención de video"
              >
                {/* Grid Lines */}
                {[100, 75, 50, 25].map((pct) => {
                  const y = 175 - (pct / 100) * 145;
                  return (
                    <g key={pct}>
                      <line
                        x1="35"
                        y1={y}
                        x2="575"
                        y2={y}
                        stroke="#1e293b"
                        strokeDasharray="4 4"
                      />
                      <text x="5" y={y + 3} fill="#64748b" fontSize="10">
                        {pct}%
                      </text>
                    </g>
                  );
                })}

                {/* 3-Second Critical Hook Marker */}
                <line
                  x1={35 + (3 / maxSec) * 540}
                  y1="25"
                  x2={35 + (3 / maxSec) * 540}
                  y2="175"
                  stroke="#fbbf24"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <text
                  x={39 + (3 / maxSec) * 540}
                  y="34"
                  fill="#fbbf24"
                  fontSize="10"
                  fontWeight="bold"
                >
                  Gancho (3 seg)
                </text>

                <polyline
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="3"
                  points={svgPoints}
                />
                {retentionPoints.map((pt) => {
                  const x = 35 + (pt.sec / maxSec) * 540;
                  const y = 175 - (pt.pct / 100) * 145;
                  return (
                    <g key={pt.sec}>
                      <circle cx={x} cy={y} r="4" fill="#10b981" />
                      <text
                        x={x - 6}
                        y="194"
                        fill="#94a3b8"
                        fontSize="10"
                      >
                        {pt.sec}s
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-xs text-slate-500">
                <BarChart3 className="w-8 h-8 text-slate-700 mb-2" />
                <p className="font-semibold text-slate-400">Sin datos de retención todavía</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                  Publica tu primer video en redes para ver aquí la curva de retención segundo a segundo.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Watch Time Comparison */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-violet-400" />
              Comparador de Retención Real (A vs B)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Calcula qué versión generó más minutos vistos en total, en vez de fijarse solo en los clics.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <span className="font-bold text-slate-200 block border-b border-slate-800 pb-1">
                Opción A (Más Clics)
              </span>
              <label className="block text-[11px] text-slate-400">
                Clics (CTR %)
                <input
                  type="number"
                  step="0.1"
                  value={ctrA}
                  onChange={(e) => setCtrA(Number(e.target.value))}
                  className="mt-0.5 w-full rounded bg-slate-900 border border-slate-800 px-2 py-1 text-white font-mono"
                />
              </label>
              <label className="block text-[11px] text-slate-400">
                Segundos vistos de media
                <input
                  type="number"
                  value={avdA}
                  onChange={(e) => setAvdA(Number(e.target.value))}
                  className="mt-0.5 w-full rounded bg-slate-900 border border-slate-800 px-2 py-1 text-white font-mono"
                />
              </label>
            </div>

            <div className="bg-slate-950 border border-cyan-500/40 rounded-xl p-3 space-y-2">
              <span className="font-bold text-cyan-300 block border-b border-slate-800 pb-1">
                Opción B (Más Retención)
              </span>
              <label className="block text-[11px] text-slate-400">
                Clics (CTR %)
                <input
                  type="number"
                  step="0.1"
                  value={ctrB}
                  onChange={(e) => setCtrB(Number(e.target.value))}
                  className="mt-0.5 w-full rounded bg-slate-900 border border-slate-800 px-2 py-1 text-white font-mono"
                />
              </label>
              <label className="block text-[11px] text-slate-400">
                Segundos vistos de media
                <input
                  type="number"
                  value={avdB}
                  onChange={(e) => setAvdB(Number(e.target.value))}
                  className="mt-0.5 w-full rounded bg-slate-900 border border-slate-800 px-2 py-1 text-white font-mono"
                />
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={handleComputeWatchTimeShare}
            className="w-full py-2.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-slate-950 font-bold text-xs transition"
          >
            Comparar Tiempo Real de Visualización
          </button>

          {wtsResult && (
            <div className="rounded-xl bg-slate-950 border border-violet-500/40 p-3 text-xs space-y-1.5">
              <div className="flex justify-between font-bold">
                <span className="text-slate-300">A: {wtsResult.share_a_pct}% del tiempo</span>
                <span className="text-emerald-300">
                  Ganadora: Opción {wtsResult.winner}
                </span>
                <span className="text-cyan-300">B: {wtsResult.share_b_pct}% del tiempo</span>
              </div>
              <p className="text-slate-400">{wtsResult.explanation}</p>
            </div>
          )}
        </div>
      </div>

      {/* Decision Quadrant (RMT-A) */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Evaluar y Decidir Siguiente Acción
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Introduce o ajusta los resultados del video para obtener la recomendación automática de qué hacer.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="text-slate-300">
              Visualizaciones
              <input
                type="number"
                value={views}
                onChange={(e) => setViews(Number(e.target.value))}
                className="mt-1 w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-white"
              />
            </label>
            <label className="text-slate-300">
              Media habitual de tu canal
              <input
                type="number"
                value={baselineViews}
                onChange={(e) => setBaselineViews(Number(e.target.value))}
                className="mt-1 w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-white"
              />
            </label>
            <label className="text-slate-300">
              Retención a los 3s (%)
              <input
                type="number"
                value={hold3s}
                onChange={(e) => setHold3s(Number(e.target.value))}
                className="mt-1 w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-white"
              />
            </label>
            <label className="text-slate-300">
              Completado hasta el final (%)
              <input
                type="number"
                value={completion}
                onChange={(e) => setCompletion(Number(e.target.value))}
                className="mt-1 w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-white"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={handleRunRmtaDiagnosis}
            className="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-sm"
          >
            Obtener Recomendación de Contenido
          </button>
        </div>

        {/* 4 Decision Quadrants */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {RMTA_QUADRANTS.map((quad) => {
              const isActive =
                rmtaDiag?.rmta_classification === quad.key ||
                activeSnap?.rmta_classification === quad.key;
              return (
                <div
                  key={quad.key}
                  className={`rounded-2xl border p-4 space-y-1.5 transition ${
                    isActive
                      ? "ring-2 ring-cyan-400 shadow-xl " + quad.style
                      : "bg-slate-900/60 border-slate-800 text-slate-300 opacity-80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold">{quad.title}</h4>
                    {isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950">
                        Acción Recomendada
                      </span>
                    )}
                  </div>
                  <p className="text-xs opacity-90 leading-snug">{quad.subtitle}</p>
                </div>
              );
            })}
          </div>

          {rmtaDiag && (
            <div className="rounded-2xl border border-cyan-500/40 bg-slate-900/90 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-white text-sm">
                <span>Acción Recomendada: {rmtaDiag.rmta_classification}</span>
                <span className="text-cyan-300">
                  {rmtaDiag.views_factor_vs_baseline}x sobre la media
                </span>
              </div>
              <p className="text-slate-200">{rmtaDiag.recommended_action}</p>
              <div className="pt-2 border-t border-slate-800 text-slate-300 flex items-start gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Regla aprendida:</strong> {rmtaDiag.learned_rule_statement}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rules Learned Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400" />
          Aprendizajes Guardados para Futuros Guiones
        </h3>
        <p className="text-xs text-slate-400">
          Cada vez que analizas un video, el sistema recuerda qué fórmulas funcionaron mejor para aplicarlas automáticamente al redactar los próximos guiones en el Paso 2.
        </p>

        {analytics?.learned_rules && analytics.learned_rules.length > 0 ? (
          <div className="grid gap-2">
            {analytics.learned_rules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-200 flex items-center justify-between gap-3"
              >
                <span>{rule.rule_statement}</span>
                <span className="text-[11px] font-semibold text-emerald-300 shrink-0">
                  Confianza: {Math.round(rule.confidence_weight * 100)}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-slate-950/60 border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
            Aún no hay aprendizajes automáticos guardados. El motor RMT-A analizará el rendimiento de tus videos cuando comiences a publicar.
          </div>
        )}
      </div>
    </div>
  );
}
