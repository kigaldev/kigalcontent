"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Cpu,
  FileText,
  KanbanSquare,
  Layers,
  Megaphone,
  Plug,
  Plus,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wifi,
  WifiOff,
  Workflow,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import {
  FALLBACK_ANALYTICS,
  FALLBACK_AUDIT_LOGS,
  FALLBACK_CREATOR_PROFILE,
  FALLBACK_PROJECTS,
  buildEmptyProjectDetail,
} from "@/lib/fallbackSeed";
import { HUMAN_STATE_LABELS } from "@/lib/utils";
import { useEngineStore, type ActiveStudioTab } from "@/store/useEngineStore";
import { KanbanPipelineBoard } from "@/components/KanbanPipelineBoard";
import { ScriptStudioView } from "@/components/ScriptStudioView";
import { MobileSafeZoneSimulator } from "@/components/MobileSafeZoneSimulator";
import { PublishingAndHitlView } from "@/components/PublishingAndHitlView";
import { AdsCampaignStudioView } from "@/components/AdsCampaignStudioView";
import { ClosedLoopAnalyticsView } from "@/components/ClosedLoopAnalyticsView";
import { HITLApprovalDialog } from "@/components/HITLApprovalDialog";
import { CreatorProfileModal } from "@/components/CreatorProfileModal";
import { ProfileBubbleMenu, type CreatorModalTab } from "@/components/ProfileBubbleMenu";
import { BackendStatusModal } from "@/components/BackendStatusModal";
import { N8nWorkflowsHub } from "@/components/N8nWorkflowsHub";
import { SocialCredentialsSettings } from "@/components/SocialCredentialsSettings";

interface TabDefinition {
  id: ActiveStudioTab;
  stepNumber: number;
  label: string;
  shortLabel: string;
  stepName: string;
  summary: string;
  icon: typeof KanbanSquare;
}

const PIPELINE_STEPS: TabDefinition[] = [
  {
    id: "pipeline",
    stepNumber: 1,
    label: "Ideas",
    shortLabel: "Ideas",
    stepName: "Ideas",
    summary: "Evalúa y prioriza las mejores ideas antes de crear.",
    icon: KanbanSquare,
  },
  {
    id: "script-studio",
    stepNumber: 2,
    label: "Guión / Publicación",
    shortLabel: "Borrador",
    stepName: "Guión / Publicación",
    summary: "Edita el guión o borrador de publicación, ganchos y formato visual.",
    icon: FileText,
  },
  {
    id: "mobile-simulator",
    stepNumber: 3,
    label: "Video 9:16",
    shortLabel: "Video",
    stepName: "Video 9:16",
    summary: "Revisa subtítulos, audio, huella nativa y crea tu portada o miniatura.",
    icon: Smartphone,
  },
  {
    id: "publishing-hitl",
    stepNumber: 4,
    label: "Publicar",
    shortLabel: "Publicar",
    stepName: "Publicar",
    summary: "Vista previa por red, KigalChat Auto-DM y autorización final.",
    icon: Send,
  },
];

const UTILITY_TABS: Array<{
  id: ActiveStudioTab;
  label: string;
  summary: string;
  icon: typeof Megaphone;
}> = [
  {
    id: "ads-studio",
    label: "Ads",
    summary: "Campañas de pago para Meta Ads, Google Ads y YouTube Ads.",
    icon: Megaphone,
  },
  {
    id: "analytics-rmta",
    label: "Resultados",
    summary: "Analiza la retención y el aprendizaje de tus publicaciones.",
    icon: BarChart3,
  },
];

const ALL_TABS: TabDefinition[] = [
  ...PIPELINE_STEPS,
  ...UTILITY_TABS.map((u, idx) => ({
    ...u,
    stepNumber: 5 + idx,
    shortLabel: u.label,
    stepName: u.label,
  })),
];

type DockTab = "n8n" | "apis";

const DOCK_TABS: Array<{ id: DockTab; label: string; icon: typeof Workflow }> = [
  { id: "n8n", label: "Automatizaciones n8n", icon: Workflow },
  { id: "apis", label: "Conexiones Oficiales APIs", icon: Plug },
];

export default function KigalContentStudioPage() {
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

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileBubbleOpen, setIsProfileBubbleOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<CreatorModalTab>("general");
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
  const [dockTab, setDockTab] = useState<DockTab>("n8n");

  const dockBaseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dockTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dockDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const isBootstrappingRef = useRef(false);

  const activeProject =
    projects.find((p) => p.id === selectedProjectId) ?? selectedDetail?.project ?? null;
  const isTextOnlyProject = activeProject?.content_format === "TEXT_ONLY";

  const effectiveSteps = isTextOnlyProject
    ? PIPELINE_STEPS.filter((s) => s.id !== "mobile-simulator")
    : PIPELINE_STEPS;

  const currentTab =
    ALL_TABS.find((t) => t.id === activeTab) ?? PIPELINE_STEPS[0];
  const currentStepIndex = effectiveSteps.findIndex((t) => t.id === activeTab);
  const prevTab =
    currentStepIndex > 0 ? effectiveSteps[currentStepIndex - 1] : null;
  const nextTab =
    currentStepIndex >= 0 && currentStepIndex < effectiveSteps.length - 1
      ? effectiveSteps[currentStepIndex + 1]
      : null;

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

        const candidateId =
          explicitProjectId ?? useEngineStore.getState().selectedProjectId;
        const targetId = fetchedProjects.some((p) => p.id === candidateId)
          ? candidateId
          : fetchedProjects[0]?.id;

        if (targetId) {
          if (targetId !== useEngineStore.getState().selectedProjectId) {
            setSelectedProjectId(targetId);
          }
          const detail = await apiClient.getProjectDetail(targetId);
          setSelectedDetail(detail);
        } else {
          setSelectedProjectId(null);
          setSelectedDetail(null);
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
          useEngineStore.getState().selectedProjectId;
        if (activeId && !useEngineStore.getState().selectedDetail) {
          const matched = currentProjects.find((p) => p.id === activeId);
          if (matched) {
            setSelectedDetail(buildEmptyProjectDetail(matched));
          }
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
        setSelectedDetail(buildEmptyProjectDetail(matched));
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
          const rawMessage = String(parsed.payload?.message ?? "");
          // Ignore noisy connection/subscription handshakes when idle
          if (
            eventName === "system" ||
            rawMessage.toLowerCase().includes("subscribed to")
          ) {
            return;
          }

          let summary = "";
          if (eventName === "project_created" && parsed.payload?.working_title) {
            summary = `Nueva idea creada: ${String(parsed.payload.working_title)}`;
          } else if (eventName === "project_deleted" && parsed.payload?.asset_code) {
            summary = `Idea ${String(parsed.payload.asset_code)} eliminada`;
          } else if (parsed.payload?.to_state) {
            const dest = String(parsed.payload.to_state);
            summary = `Proyecto movido a ${HUMAN_STATE_LABELS[dest as keyof typeof HUMAN_STATE_LABELS] ?? dest}`;
          } else if (parsed.payload?.working_title) {
            summary = `Actualizado: ${String(parsed.payload.working_title)}`;
          } else if (rawMessage) {
            summary = rawMessage;
          }

          if (!summary) return;

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
      nextIndex = (index + 1) % PIPELINE_STEPS.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + PIPELINE_STEPS.length) % PIPELINE_STEPS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = PIPELINE_STEPS.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const targetTab = PIPELINE_STEPS[nextIndex];
    setActiveTab(targetTab.id);
    tabRefs.current[nextIndex]?.focus();
    tabRefs.current[nextIndex]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  };

  const handleDockTabKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex = index;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % DOCK_TABS.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + DOCK_TABS.length) % DOCK_TABS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = DOCK_TABS.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    setDockTab(DOCK_TABS[nextIndex].id);
    dockTabRefs.current[nextIndex]?.focus();
    dockTabRefs.current[nextIndex]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  };

  const handleOpenAutomationDock = () => {
    if (dockDetailsRef.current) {
      dockDetailsRef.current.open = true;
      dockDetailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kc-canvas)] text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--kc-border)] bg-[var(--kc-canvas)]/92 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            {/* Brand + Pro Studio OS Badge */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 via-indigo-500/20 to-emerald-500/20 border border-cyan-500/35 shadow-inner">
                <Cpu className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                    KigalContent
                  </h1>
                  <span className="inline-flex items-center rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-cyan-300">
                    Pro Studio OS
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {creatorProfile
                    ? `${creatorProfile.name} · ${creatorProfile.niche}`
                    : "Estudio profesional todo-en-uno de contenido, video 9:16 y Ads"}
                </p>
              </div>
            </div>

            {/* Project Selector, Status, Profile & Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {projects.length > 0 ? (
                <label className="flex items-center gap-2 rounded-lg border border-[var(--kc-border)] bg-[var(--kc-panel)] px-2.5 py-1.5 text-xs">
                  <Layers className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  <span className="text-slate-400 hidden md:inline">Video Activo:</span>
                  <select
                    aria-label="Seleccionar video activo"
                    value={selectedProjectId ?? ""}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="max-w-[240px] truncate bg-transparent font-semibold text-slate-100 focus:outline-none"
                  >
                    {projects.map((project) => (
                      <option
                        key={project.id}
                        value={project.id}
                        className="bg-[var(--kc-panel)] text-slate-100"
                      >
                        [{project.asset_code}] {project.working_title} —{" "}
                        {HUMAN_STATE_LABELS[project.current_state] ?? project.current_state}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab("pipeline")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition cursor-pointer"
                  title="Crea tu primer video en el Paso 1: Ideas"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Crear Primera Idea</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsBackendModalOpen(true)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition cursor-pointer hover:opacity-90 ${
                  backendOnline
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:border-amber-400"
                }`}
                title={
                  backendOnline
                    ? `Servidor conectado (${apiClient.apiBase}). Clic para ver detalles.`
                    : "Modo local: Clic aquí para conectar con tu servidor de Railway o MiniPC."
                }
              >
                {backendOnline ? (
                  <Wifi className="h-3.5 w-3.5" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5" />
                )}
                <span>{backendOnline ? "Servidor Online" : "Modo Local"}</span>
              </button>

              {/* Top-Right Profile Bubble (Paso 0) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileBubbleOpen((prev) => !prev)}
                  aria-expanded={isProfileBubbleOpen}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-500/50 bg-gradient-to-r from-cyan-950/70 to-violet-950/70 pl-1.5 pr-3 py-1 text-xs font-semibold text-cyan-200 hover:border-cyan-400 hover:text-white transition shadow-sm shadow-cyan-500/10"
                  title="Paso 0: Perfil, Repos GitHub, Lead Magnets y ManyChat"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-[11px] text-white font-bold">
                    {creatorProfile?.name ? creatorProfile.name.charAt(0).toUpperCase() : "C"}
                  </div>
                  <span className="hidden sm:inline">
                    {creatorProfile?.name || "Perfil"}
                  </span>
                  <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                    Paso 0
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                </button>

                <ProfileBubbleMenu
                  isOpen={isProfileBubbleOpen}
                  onClose={() => setIsProfileBubbleOpen(false)}
                  creatorProfile={creatorProfile}
                  onOpenPaso0={(tab = "general") => {
                    setProfileModalTab(tab);
                    setIsProfileModalOpen(true);
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => void loadWorkspaceData(selectedProjectId ?? undefined)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--kc-border)] bg-[var(--kc-panel)] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-500/50 hover:text-white"
                title="Actualizar datos del proyecto"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Actualizar</span>
              </button>

              <div className="inline-flex items-center rounded-full border border-violet-500/40 bg-violet-950/30 p-0.5 gap-0.5">
                {UTILITY_TABS.map((ut) => {
                  const UIcon = ut.icon;
                  const active = activeTab === ut.id;
                  return (
                    <button
                      key={ut.id}
                      type="button"
                      onClick={() => setActiveTab(ut.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? "bg-violet-500 text-slate-950 shadow-sm"
                          : "text-violet-200 hover:bg-violet-500/20 hover:text-white"
                      }`}
                      title={ut.summary}
                    >
                      <UIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{ut.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleOpenAutomationDock}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--kc-border)] bg-[var(--kc-surface)] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-500/50 hover:text-white"
                title="Abrir dock de Automatizaciones n8n y Conexiones Oficiales APIs"
              >
                <Settings className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
                <span className="hidden lg:inline">Automatizaciones y APIs</span>
                <span className="lg:hidden">APIs</span>
              </button>
            </div>
          </div>

          {/* 4-Step Content Creation Navigation */}
          <div className="flex items-center justify-between gap-4 border-t border-[var(--kc-border)]/70 pt-1">
            <div
              role="tablist"
              aria-label="Pasos de creación de contenido"
              className="flex items-center gap-1 sm:gap-2"
            >
              {PIPELINE_STEPS.map((tab, index) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                const isSkippedStep = isTextOnlyProject && tab.id === "mobile-simulator";
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
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => {
                      setActiveTab(tab.id);
                      tabRefs.current[index]?.scrollIntoView({
                        block: "nearest",
                        inline: "nearest",
                      });
                    }}
                    onKeyDown={(e) => handleTabKeyDown(e, index)}
                    className={`inline-flex items-center gap-2 px-3 py-2.5 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                      isSelected
                        ? "text-cyan-300"
                        : isSkippedStep
                        ? "text-slate-600 hover:text-slate-400 line-through decoration-slate-600/60"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    title={
                      isSkippedStep
                        ? "Omitido automáticamente en publicaciones de Solo Texto (puedes abrirlo si decides añadir video)"
                        : tab.summary
                    }
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                        isSelected
                          ? "bg-cyan-400 text-slate-950"
                          : isSkippedStep
                          ? "bg-slate-900 text-slate-600 border border-slate-800"
                          : "bg-[var(--kc-surface)] text-slate-300 border border-[var(--kc-border)]"
                      }`}
                    >
                      {tab.stepNumber}
                    </span>
                    <Icon
                      className="h-3.5 w-3.5 hidden sm:inline shrink-0 opacity-85"
                      aria-hidden="true"
                    />
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.shortLabel}</span>
                    {isSkippedStep && (
                      <span className="hidden lg:inline rounded bg-slate-800/80 px-1.5 py-0.5 text-[9px] text-slate-500 no-underline">
                        Omitido
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {activeProject && (
              <div className="hidden xl:flex items-center gap-2 text-xs text-slate-400 pb-1 shrink-0">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Fase actual:</span>
                <span className="rounded bg-[var(--kc-panel)] border border-[var(--kc-border)] px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
                  {HUMAN_STATE_LABELS[activeProject.current_state] ??
                    activeProject.current_state}
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

      {/* Visual Step-by-Step Flow Bar (non-sticky for content-first focus) */}
      <div className="border-b border-[var(--kc-border)]/80 bg-[var(--kc-panel)]/70 py-2.5">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 font-bold text-cyan-300 text-[11px]">
                {currentTab.stepNumber}. {currentTab.label}
              </span>
              <span className="text-slate-500">—</span>
              <span className="text-slate-300">{currentTab.summary}</span>
            </div>

            {/* Quick Next / Prev Actions */}
            <div className="flex items-center gap-2">
              {prevTab && (
                <button
                  type="button"
                  onClick={() => setActiveTab(prevTab.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-2.5 py-1 text-slate-400 transition hover:border-slate-600 hover:text-white"
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
        <div className="border-b border-[var(--kc-border)]/60 bg-[var(--kc-panel)]/40">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3 overflow-x-auto px-4 py-1.5 text-xs text-slate-300 sm:px-6">
            <span className="inline-flex items-center gap-1.5 font-semibold text-cyan-400 shrink-0">
              <Activity className="h-3.5 w-3.5 animate-pulse" />
              Actividad en vivo:
            </span>
            {liveEvents.slice(0, 3).map((ev, idx) => (
              <span
                key={`${ev.timestamp}-${idx}`}
                className="inline-flex items-center gap-1.5 rounded bg-[var(--kc-surface)] border border-[var(--kc-border)] px-2 py-0.5 text-[11px] shrink-0"
              >
                <span className="text-slate-300 truncate max-w-[280px]">
                  {ev.summary}
                </span>
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
          {activeTab === "ads-studio" && <AdsCampaignStudioView />}
          {activeTab === "analytics-rmta" && (
            <ClosedLoopAnalyticsView
              onRefresh={() => loadWorkspaceData(selectedProjectId ?? undefined)}
            />
          )}
        </section>

        {/* Step-by-Step Bottom Footer Navigation */}
        <div className="nle-panel mt-10 flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <span className="text-xs font-semibold text-cyan-400">
              {currentTab.stepNumber}. {currentTab.label}
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
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--kc-border)] bg-[var(--kc-canvas)] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:text-white"
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

        {/* Bottom Collapsible Dock: Automatizaciones n8n & Conexiones Oficiales (APIs) */}
        <details
          ref={dockDetailsRef}
          className="nle-panel mt-6 overflow-hidden scroll-mt-24"
        >
          <summary className="flex items-center justify-between gap-3 px-4 py-3.5 text-xs sm:text-sm font-semibold text-slate-100 hover:bg-white/[0.02] transition select-none">
            <span className="flex items-center gap-2.5 min-w-0">
              <ChevronDown
                className="accordion-chevron h-4 w-4 text-cyan-400"
                aria-hidden="true"
              />
              <span className="truncate">
                ⚡ Automatizaciones n8n &amp; 🔌 Conexiones Oficiales (APIs)
              </span>
            </span>
            <span className="hidden md:inline-flex items-center gap-2 text-[11px] font-normal text-slate-400 shrink-0">
              5 flujos n8n · LLM Router · Credenciales de redes
            </span>
          </summary>

          <div className="border-t border-[var(--kc-border)] p-4 sm:p-5 space-y-5">
            {/* 2-Tab Switcher inside Collapsible Dock */}
            <div className="border-b border-[var(--kc-border)]">
              <div
                role="tablist"
                aria-label="Automatizaciones y Conexiones Oficiales"
                className="flex items-center gap-2"
              >
                {DOCK_TABS.map((dTab, index) => {
                  const Icon = dTab.icon;
                  const isSelected = dockTab === dTab.id;
                  return (
                    <button
                      key={dTab.id}
                      ref={(el) => {
                        dockTabRefs.current[index] = el;
                      }}
                      id={`${dockBaseId}-tab-${dTab.id}`}
                      role="tab"
                      type="button"
                      aria-selected={isSelected}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => {
                        setDockTab(dTab.id);
                        dockTabRefs.current[index]?.scrollIntoView({
                          block: "nearest",
                          inline: "nearest",
                        });
                      }}
                      onKeyDown={(e) => handleDockTabKeyDown(e, index)}
                      className={`inline-flex items-center gap-2 px-3 py-2.5 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                        isSelected
                          ? "text-cyan-300"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{dTab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dock Tab Panels (no padding/borders on role="tabpanel" itself per modern-web-guidance: tabs) */}
            <div
              role="tabpanel"
              id={`${dockBaseId}-panel-n8n`}
              aria-labelledby={`${dockBaseId}-tab-n8n`}
              hidden={dockTab !== "n8n"}
            >
              <div>
                <N8nWorkflowsHub />
              </div>
            </div>

            <div
              role="tabpanel"
              id={`${dockBaseId}-panel-apis`}
              aria-labelledby={`${dockBaseId}-tab-apis`}
              hidden={dockTab !== "apis"}
            >
              <div>
                <SocialCredentialsSettings />
              </div>
            </div>
          </div>
        </details>
      </main>

      {/* Global HITL Approval Native Dialog */}
      <HITLApprovalDialog
        onSuccessRefresh={() => loadWorkspaceData(selectedProjectId ?? undefined)}
      />

      {/* Creator Context Engine Profile Modal (Paso 0) */}
      <CreatorProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        initialTab={profileModalTab}
      />

      {/* Backend Connection Diagnostics & Custom URL Modal */}
      <BackendStatusModal
        isOpen={isBackendModalOpen}
        onClose={() => setIsBackendModalOpen(false)}
        onReconnected={() => {
          setIsBackendModalOpen(false);
          void loadWorkspaceData(selectedProjectId ?? undefined);
        }}
        backendOnline={backendOnline}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="nle-panel fixed bottom-5 right-5 z-50 flex max-w-md items-start gap-3 p-4 text-sm backdrop-blur"
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
