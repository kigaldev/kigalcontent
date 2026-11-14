"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FileText,
  KanbanSquare,
  Layers,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Wifi,
  WifiOff,
  X,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import {
  FALLBACK_ANALYTICS,
  FALLBACK_AUDIT_LOGS,
  FALLBACK_CREATOR_PROFILE,
  FALLBACK_DETAIL,
  FALLBACK_PROJECTS,
} from "@/lib/fallbackSeed";
import { HUMAN_STATE_LABELS } from "@/lib/utils";
import { useEngineStore, type ActiveStudioTab } from "@/store/useEngineStore";
import { KanbanPipelineBoard } from "@/components/KanbanPipelineBoard";
import { ScriptStudioView } from "@/components/ScriptStudioView";
import { MobileSafeZoneSimulator } from "@/components/MobileSafeZoneSimulator";
import { PublishingAndHitlView } from "@/components/PublishingAndHitlView";
import { ClosedLoopAnalyticsView } from "@/components/ClosedLoopAnalyticsView";
import { HITLApprovalDialog } from "@/components/HITLApprovalDialog";

interface TabDefinition {
  id: ActiveStudioTab;
  stepNumber: number;
  label: string;
  shortLabel: string;
  stepName: string;
  summary: string;
  icon: typeof KanbanSquare;
}

const STUDIO_TABS: TabDefinition[] = [
  {
    id: "pipeline",
    stepNumber: 1,
    label: "Paso 1: Ideas y Prioridades",
    shortLabel: "1. Ideas",
    stepName: "Ideas y Prioridades",
    summary: "Evalúa y selecciona las mejores ideas antes de grabar.",
    icon: KanbanSquare,
  },
  {
    id: "script-studio",
    stepNumber: 2,
    label: "Paso 2: Taller de Guiones",
    shortLabel: "2. Guión",
    stepName: "Taller de Guiones",
    summary: "Escribe y ajusta el guión calculando el tiempo de lectura.",
    icon: FileText,
  },
  {
    id: "mobile-simulator",
    stepNumber: 3,
    label: "Paso 3: Video y Audio (9:16)",
    shortLabel: "3. Video 9:16",
    stepName: "Revisión de Video y Audio",
    summary: "Revisa subtítulos en el simulador móvil y limpia el audio.",
    icon: Smartphone,
  },
  {
    id: "publishing-hitl",
    stepNumber: 4,
    label: "Paso 4: Textos y Publicación",
    shortLabel: "4. Publicar",
    stepName: "Textos y Publicación",
    summary: "Prepara los textos por red social y autoriza la publicación.",
    icon: Send,
  },
  {
    id: "analytics-rmta",
    stepNumber: 5,
    label: "Paso 5: Resultados y Aprendizaje",
    shortLabel: "5. Resultados",
    stepName: "Resultados y Aprendizaje",
    summary: "Descubre qué videos retuvieron más tiempo para mejorar.",
    icon: BarChart3,
  },
];

export default function AutonomousContentEnginePage() {
  const {
    activeTab,
    setActiveTab,
    backendOnline,
    setBackendOnline,
    projects,
    setProjects,
    selectedProjectId,
    setSelectedProjectId,
    selectedDetail,
    setSelectedDetail,
    creatorProfile,
    setCreatorProfile,
    setAuditLogs,
    setAnalytics,
    liveEvents,
    pushLiveEvent,
    toastMessage,
    clearToast,
  } = useEngineStore();

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isBootstrappingRef = useRef(false);

  const currentTabIndex = STUDIO_TABS.findIndex((t) => t.id === activeTab);
  const currentTab = STUDIO_TABS[currentTabIndex] ?? STUDIO_TABS[0];
  const prevTab = currentTabIndex > 0 ? STUDIO_TABS[currentTabIndex - 1] : null;
  const nextTab =
    currentTabIndex < STUDIO_TABS.length - 1 ? STUDIO_TABS[currentTabIndex + 1] : null;

  const loadWorkspaceData = useCallback(
    async (explicitProjectId?: string) => {
      if (isBootstrappingRef.current) return;
      isBootstrappingRef.current = true;

      try {
        await apiClient.health();
        setBackendOnline(true);

        const [fetchedProjects, fetchedProfile, fetchedLogs, fetchedAnalytics] =
          await Promise.all([
            apiClient.listProjects(),
            apiClient.getCreatorProfile(),
            apiClient.listAuditLogs(),
            apiClient.getAnalyticsOverview(),
          ]);

        setProjects(fetchedProjects);
        setCreatorProfile(fetchedProfile);
        setAuditLogs(fetchedLogs);
        setAnalytics(fetchedAnalytics);

        const targetId =
          explicitProjectId ??
          useEngineStore.getState().selectedProjectId ??
          fetchedProjects[0]?.id;

        if (targetId) {
          const detail = await apiClient.getProjectDetail(targetId);
          setSelectedDetail(detail);
        }
      } catch {
        setBackendOnline(false);
        const currentProjects = useEngineStore.getState().projects;
        if (currentProjects.length === 0) {
          setProjects(FALLBACK_PROJECTS);
        }
        if (!useEngineStore.getState().creatorProfile) {
          setCreatorProfile(FALLBACK_CREATOR_PROFILE);
        }
        if (useEngineStore.getState().auditLogs.length === 0) {
          setAuditLogs(FALLBACK_AUDIT_LOGS);
        }
        if (!useEngineStore.getState().analytics) {
          setAnalytics(FALLBACK_ANALYTICS);
        }
        const activeId =
          explicitProjectId ??
          useEngineStore.getState().selectedProjectId ??
          FALLBACK_PROJECTS[0]?.id;
        if (activeId && !useEngineStore.getState().selectedDetail) {
          setSelectedDetail({
            ...FALLBACK_DETAIL,
            project:
              (currentProjects.length > 0 ? currentProjects : FALLBACK_PROJECTS).find(
                (p) => p.id === activeId
              ) ?? FALLBACK_DETAIL.project,
          });
        }
      } finally {
        isBootstrappingRef.current = false;
      }
    },
    [
      setAnalytics,
      setAuditLogs,
      setBackendOnline,
      setCreatorProfile,
      setProjects,
      setSelectedDetail,
    ]
  );

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Sync selected project detail
  useEffect(() => {
    if (!selectedProjectId) return;
    let cancelled = false;

    async function syncDetail() {
      if (!selectedProjectId) return;
      if (backendOnline) {
        try {
          const detail = await apiClient.getProjectDetail(selectedProjectId);
          if (!cancelled) {
            setSelectedDetail(detail);
          }
          return;
        } catch {
          // fallback below
        }
      }
      const matched = projects.find((p) => p.id === selectedProjectId);
      if (matched && !cancelled) {
        setSelectedDetail({
          ...FALLBACK_DETAIL,
          project: matched,
        });
      }
    }

    void syncDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, backendOnline, projects, setSelectedDetail]);

  // WebSocket telemetry feed
  useEffect(() => {
    if (!backendOnline || typeof window === "undefined") return;
    const wsUrl = apiClient.apiBase.replace(/^http/, "ws") + "/ws/events";
    let socket: WebSocket | null = null;

    try {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as {
            event?: string;
            timestamp?: string;
            payload?: Record<string, unknown>;
          };
          const eventName = parsed.event ?? "actividad";
          const summary =
            parsed.payload?.working_title
              ? `${String(parsed.payload.working_title)}`
              : parsed.payload?.to_state
              ? `${String(parsed.payload.from_state ?? "")} -> ${String(parsed.payload.to_state)}`
              : JSON.stringify(parsed.payload ?? {}).slice(0, 80);

          pushLiveEvent({
            event: eventName,
            timestamp: parsed.timestamp ?? new Date().toISOString(),
            summary,
          });
        } catch {
          // ignore non-json frames
        }
      };
    } catch {
      // ignore ws handshake errors in local/fallback mode
    }

    return () => {
      socket?.close();
    };
  }, [backendOnline, pushLiveEvent]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      clearToast();
    }, 5500);
    return () => clearTimeout(timer);
  }, [toastMessage, clearToast]);

  const handleTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex = index;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % STUDIO_TABS.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + STUDIO_TABS.length) % STUDIO_TABS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = STUDIO_TABS.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const targetTab = STUDIO_TABS[nextIndex];
    setActiveTab(targetTab.id);
    tabRefs.current[nextIndex]?.focus();
  };

  const activeProject =
    projects.find((p) => p.id === selectedProjectId) ?? selectedDetail?.project ?? null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4 py-3.5">
            {/* Brand + Clean Subtitle */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 via-indigo-500/20 to-emerald-500/20 border border-cyan-500/30 shadow-inner">
                <Cpu className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                    Autonomous Content Engine
                  </h1>
                  <span className="hidden rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-cyan-300 sm:inline-block">
                    Estudio de Creación
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {creatorProfile
                    ? `${creatorProfile.name} · ${creatorProfile.niche}`
                    : "Plataforma guiada paso a paso para crear, revisar y publicar videos de alto impacto"}
                </p>
              </div>
            </div>

            {/* Project Selector & Status */}
            <div className="flex flex-wrap items-center gap-2.5">
              {projects.length > 0 && (
                <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-xs">
                  <Layers className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  <span className="text-slate-400 hidden md:inline">Video Activo:</span>
                  <select
                    aria-label="Seleccionar video activo"
                    value={selectedProjectId ?? ""}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="max-w-[260px] truncate bg-transparent font-semibold text-slate-100 focus:outline-none"
                  >
                    {projects.map((project) => (
                      <option
                        key={project.id}
                        value={project.id}
                        className="bg-slate-900 text-slate-100"
                      >
                        [{project.asset_code}] {project.working_title} — {HUMAN_STATE_LABELS[project.current_state] ?? project.current_state}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                  backendOnline
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                }`}
                title={
                  backendOnline
                    ? `Servidor conectado (${apiClient.apiBase})`
                    : "Modo local: puedes redactar guiones y probar el simulador sin necesidad de servidor"
                }
              >
                {backendOnline ? (
                  <Wifi className="h-3.5 w-3.5" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5" />
                )}
                <span>{backendOnline ? "Servidor Online" : "Modo Local"}</span>
              </div>

              <button
                type="button"
                onClick={() => void loadWorkspaceData(selectedProjectId ?? undefined)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-500/50 hover:text-white"
                title="Actualizar datos del proyecto"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Actualizar</span>
              </button>
            </div>
          </div>

          {/* Stepper Navigation Tabs (5 Steps) */}
          <div className="flex items-center justify-between gap-4 border-t border-slate-900 pt-1">
            <div
              role="tablist"
              aria-label="Pasos de creación de contenido"
              className="gap-1 sm:gap-2"
            >
              {STUDIO_TABS.map((tab, index) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[index] = el;
                    }}
                    id={`tab-${tab.id}`}
                    role="tab"
                    type="button"
                    aria-selected={isSelected}
                    aria-controls={`panel-${tab.id}`}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, index)}
                    className={`inline-flex items-center gap-2 px-3 py-2.5 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                      isSelected
                        ? "text-cyan-300"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                        isSelected
                          ? "bg-cyan-400 text-slate-950"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {tab.stepNumber}
                    </span>
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {activeProject && (
              <div className="hidden xl:flex items-center gap-2 text-xs text-slate-400 pb-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Fase actual:</span>
                <span className="rounded bg-slate-900 border border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
                  {HUMAN_STATE_LABELS[activeProject.current_state] ?? activeProject.current_state}
                </span>
                <span className="text-slate-600">|</span>
                <span title="Prioridad calculada de 1 a 10">Prioridad:</span>
                <span className="font-mono font-bold text-white">
                  {activeProject.ice_score.toFixed(1)}/10
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Visual Step-by-Step Flow Bar */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 py-2.5">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 font-bold text-cyan-300 text-[11px]">
                {currentTab.label}
              </span>
              <span className="text-slate-400">—</span>
              <span className="text-slate-300">{currentTab.summary}</span>
            </div>

            {/* Quick Next / Prev Actions */}
            <div className="flex items-center gap-2">
              {prevTab && (
                <button
                  type="button"
                  onClick={() => setActiveTab(prevTab.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1 text-slate-400 transition hover:border-slate-700 hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Anterior: {prevTab.stepName}</span>
                </button>
              )}
              {nextTab && (
                <button
                  type="button"
                  onClick={() => setActiveTab(nextTab.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 font-semibold text-cyan-200 transition hover:bg-cyan-500/20 hover:text-white"
                >
                  <span>Siguiente: {nextTab.stepName}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Activity Ticker (if any) */}
      {liveEvents.length > 0 && (
        <div className="border-b border-slate-800/70 bg-slate-900/30">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3 overflow-x-auto px-4 py-1.5 text-xs text-slate-300 sm:px-6">
            <span className="inline-flex items-center gap-1.5 font-semibold text-cyan-400 shrink-0">
              <Activity className="h-3.5 w-3.5 animate-pulse" />
              Actividad en vivo:
            </span>
            {liveEvents.slice(0, 3).map((ev, idx) => (
              <span
                key={`${ev.timestamp}-${idx}`}
                className="inline-flex items-center gap-1.5 rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-[11px] shrink-0"
              >
                <span className="text-slate-300 truncate max-w-[280px]">{ev.summary}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Workspace Area */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">
        <section
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="space-y-6"
        >
          {activeTab === "pipeline" && (
            <KanbanPipelineBoard
              onRefresh={() => loadWorkspaceData(selectedProjectId ?? undefined)}
            />
          )}
          {activeTab === "script-studio" && (
            <ScriptStudioView
              onRefresh={() => loadWorkspaceData(selectedProjectId ?? undefined)}
            />
          )}
          {activeTab === "mobile-simulator" && (
            <MobileSafeZoneSimulator
              onRefresh={() => loadWorkspaceData(selectedProjectId ?? undefined)}
            />
          )}
          {activeTab === "publishing-hitl" && (
            <PublishingAndHitlView
              onRefresh={() => loadWorkspaceData(selectedProjectId ?? undefined)}
            />
          )}
          {activeTab === "analytics-rmta" && (
            <ClosedLoopAnalyticsView
              onRefresh={() => loadWorkspaceData(selectedProjectId ?? undefined)}
            />
          )}
        </section>

        {/* Step-by-Step Bottom Footer Navigation */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div>
            <span className="text-xs font-semibold text-cyan-400">
              {currentTab.label}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">{currentTab.summary}</p>
          </div>

          <div className="flex items-center gap-3">
            {prevTab && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab(prevTab.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Paso Anterior: {prevTab.stepName}</span>
              </button>
            )}
            {nextTab && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab(nextTab.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/50 bg-cyan-500 hover:bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 transition"
              >
                <span>Siguiente Paso: {nextTab.stepName}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Global HITL Approval Native Dialog */}
      <HITLApprovalDialog
        onSuccessRefresh={() => loadWorkspaceData(selectedProjectId ?? undefined)}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex max-w-md items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/95 p-4 text-sm shadow-2xl backdrop-blur"
        >
          {toastMessage.type === "error" ? (
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          )}
          <p className="flex-1 text-slate-100 leading-snug">{toastMessage.text}</p>
          <button
            type="button"
            onClick={clearToast}
            aria-label="Cerrar notificación"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
