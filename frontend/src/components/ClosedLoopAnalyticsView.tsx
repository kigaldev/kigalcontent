"use client";

import React, { useState } from "react";
import {
  Activity,
  BarChart3,
  Brain,
  FlaskConical,
  Layers,
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
    subtitle: "Alto Empaque + Alta Retención",
    style: "border-emerald-500/50 bg-emerald-950/20 text-emerald-300",
  },
  {
    key: "MEJORAR",
    title: "Mejorar (Empaque o Gancho)",
    subtitle: "Desajuste CTR vs Retención",
    style: "border-amber-500/50 bg-amber-950/20 text-amber-300",
  },
  {
    key: "PROBAR",
    title: "Probar (20% TAM)",
    subtitle: "Hipótesis de Expansión",
    style: "border-cyan-500/50 bg-cyan-950/20 text-cyan-300",
  },
  {
    key: "ABANDONAR",
    title: "Abandonar",
    subtitle: "3 Iteraciones Cuartil Inferior",
    style: "border-rose-500/50 bg-rose-950/20 text-rose-300",
  },
];

export function ClosedLoopAnalyticsView({
  onRefresh,
}: ClosedLoopAnalyticsViewProps) {
  const { analytics, selectedProjectId, backendOnline, showToast } =
    useEngineStore();

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

  // Build SVG polyline coordinates (viewBox 600x200)
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
          explanation: "Cálculo local Watch Time Share completado.",
        });
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error Watch Time Share");
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
          `Diagnóstico RMT-A (${res.rmta_classification}) guardado en learned_rules.json.`
        );
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error diagnóstico RMT-A");
    }
  };

  return (
    <div className="space-y-6">
      {/* Window Selector + Top KPI Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            Analítica de Bucle Cerrado (24h / 7d / 30d), Watch Time Share &amp; RMT-A
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Aislamiento causal en 4 capas (Idea, Empaque, Ejecución, Distribución) e inyección directa a `learned_rules.json`.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1">
          {(["24h", "7d", "30d"] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindowType(w)}
              className={`px-3 py-1 rounded text-xs font-mono font-semibold transition ${
                windowType === w
                  ? "bg-cyan-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Retention Curve & Watch Time Share A/B Calculator */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Second-by-Second Retention Curve */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Curva de Retención Segundo a Segundo ({windowType})
            </h3>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-emerald-300">
                Hold 3s: {activeSnap?.hold_rate_3s ?? 74}%
              </span>
              <span className="text-cyan-300">
                Outlier: {activeSnap?.outlier_multiplier ?? 3.4}x
              </span>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <svg viewBox="0 0 600 205" className="w-full h-52">
              {[25, 50, 75, 100].map((pct) => {
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
                    <text x="4" y={y + 4} fill="#64748b" fontSize="10">
                      {pct}%
                    </text>
                  </g>
                );
              })}
              {/* 3-second critical threshold vertical line */}
              <line
                x1={35 + (3 / maxSec) * 540}
                y1="25"
                x2={35 + (3 / maxSec) * 540}
                y2="175"
                stroke="#f59e0b"
                strokeDasharray="3 3"
              />
              <text
                x={39 + (3 / maxSec) * 540}
                y="34"
                fill="#fbbf24"
                fontSize="10"
              >
                3s Hook Gate
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
          </div>
        </div>

        {/* YouTube Test & Compare Watch Time Share Calculator */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-violet-400" />
              Watch Time Share (Test &amp; Compare)
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <span className="font-bold text-slate-300">Variante A (CTR Alto)</span>
              <label className="block text-[11px] text-slate-400">
                Impresiones
                <input
                  type="number"
                  value={impA}
                  onChange={(e) => setImpA(Number(e.target.value))}
                  className="mt-0.5 w-full rounded bg-slate-900 border border-slate-800 px-2 py-1 text-white font-mono"
                />
              </label>
              <label className="block text-[11px] text-slate-400">
                CTR (%)
                <input
                  type="number"
                  step="0.1"
                  value={ctrA}
                  onChange={(e) => setCtrA(Number(e.target.value))}
                  className="mt-0.5 w-full rounded bg-slate-900 border border-slate-800 px-2 py-1 text-white font-mono"
                />
              </label>
              <label className="block text-[11px] text-slate-400">
                AVD (seg)
                <input
                  type="number"
                  value={avdA}
                  onChange={(e) => setAvdA(Number(e.target.value))}
                  className="mt-0.5 w-full rounded bg-slate-900 border border-slate-800 px-2 py-1 text-white font-mono"
                />
              </label>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <span className="font-bold text-cyan-300">Variante B (Retención)</span>
              <label className="block text-[11px] text-slate-400">
                Impresiones
                <input
                  type="number"
                  value={impB}
                  onChange={(e) => setImpB(Number(e.target.value))}
                  className="mt-0.5 w-full rounded bg-slate-900 border border-slate-800 px-2 py-1 text-white font-mono"
                />
              </label>
              <label className="block text-[11px] text-slate-400">
                CTR (%)
                <input
                  type="number"
                  step="0.1"
                  value={ctrB}
                  onChange={(e) => setCtrB(Number(e.target.value))}
                  className="mt-0.5 w-full rounded bg-slate-900 border border-slate-800 px-2 py-1 text-white font-mono"
                />
              </label>
              <label className="block text-[11px] text-slate-400">
                AVD (seg)
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
            className="w-full py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-slate-950 font-semibold text-xs transition"
          >
            Calcular Ganador por Watch Time Share
          </button>

          {wtsResult && (
            <div className="rounded-xl bg-slate-950 border border-violet-500/40 p-3 text-xs space-y-1.5">
              <div className="flex justify-between font-mono font-bold">
                <span className="text-slate-300">A: {wtsResult.share_a_pct}%</span>
                <span className="text-emerald-300">
                  Ganador: Variante {wtsResult.winner}
                </span>
                <span className="text-cyan-300">B: {wtsResult.share_b_pct}%</span>
              </div>
              <p className="text-slate-400">{wtsResult.explanation}</p>
            </div>
          )}
        </div>
      </div>

      {/* 4-Layer Diagnostic & RMT-A Quadrant */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            Simulador Causal 4 Capas &amp; Inyección RMT-A
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="text-slate-300">
              Vistas ({windowType})
              <input
                type="number"
                value={views}
                onChange={(e) => setViews(Number(e.target.value))}
                className="mt-1 w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-white"
              />
            </label>
            <label className="text-slate-300">
              Media Histórica 90d
              <input
                type="number"
                value={baselineViews}
                onChange={(e) => setBaselineViews(Number(e.target.value))}
                className="mt-1 w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-white"
              />
            </label>
            <label className="text-slate-300">
              Hold Rate 3s (%)
              <input
                type="number"
                step="0.5"
                value={hold3s}
                onChange={(e) => setHold3s(Number(e.target.value))}
                className="mt-1 w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-white"
              />
            </label>
            <label className="text-slate-300">
              Completion / AVD (%)
              <input
                type="number"
                step="0.5"
                value={completion}
                onChange={(e) => setCompletion(Number(e.target.value))}
                className="mt-1 w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-white"
              />
            </label>
          </div>

          <label className="block text-xs text-slate-300">
            Sends per Reach (% Dark Social · Objetivo &gt;2.0%)
            <input
              type="number"
              step="0.1"
              value={sendsReach}
              onChange={(e) => setSendsReach(Number(e.target.value))}
              className="mt-1 w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 font-mono text-white"
            />
          </label>

          <button
            type="button"
            onClick={handleRunRmtaDiagnosis}
            className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition inline-flex items-center justify-center gap-1.5"
          >
            <TrendingUp className="w-4 h-4" />
            Evaluar RMT-A &amp; Guardar Regla en Memoria
          </button>

          {rmtaDiag && (
            <div className="bg-slate-950 border border-emerald-500/40 rounded-xl p-3 text-xs space-y-2">
              <div className="flex justify-between font-mono font-bold">
                <span className="text-emerald-300">{rmtaDiag.rmta_classification}</span>
                <span className="text-cyan-300">
                  {rmtaDiag.views_factor_vs_baseline}x baseline
                </span>
              </div>
              <p className="text-slate-300">{rmtaDiag.recommended_action}</p>
            </div>
          )}
        </div>

        {/* RMT-A Quadrant + Learned Rules + Hook Vault */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {RMTA_QUADRANTS.map((q) => {
              const isActive =
                (rmtaDiag?.rmta_classification ??
                  activeSnap?.rmta_classification ??
                  "REPETIR_FRANQUICIAR") === q.key;
              return (
                <div
                  key={q.key}
                  className={`rounded-xl border p-3.5 transition ${
                    isActive
                      ? `${q.style} ring-2 ring-cyan-400/60`
                      : "border-slate-800 bg-slate-900/60 text-slate-400"
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-wider">
                    {q.title}
                  </div>
                  <div className="text-[11px] opacity-85 mt-1">{q.subtitle}</div>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" />
              Memoria Episódica (`learned_rules.json` &amp; Hook Vault `pgvector`)
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(analytics?.learned_rules ?? []).map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-xs flex items-start justify-between gap-3"
                >
                  <div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 mr-2">
                      {rule.rmta_classification}
                    </span>
                    <span className="text-slate-200">{rule.rule_statement}</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-300 shrink-0">
                    w={rule.confidence_weight}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
