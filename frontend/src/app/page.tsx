"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Compass,
  Cpu,
  FileText,
  KanbanSquare,
  KeyRound,
  Megaphone,
  Plug,
  Send,
  Smartphone,
  Sparkles,
  Workflow,
  X,
  type LucideIcon,
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
import {
  useEngineStore,
  type ActiveStudioTab,
  type ConnectionsSubTab,
  type PublishingSubTab,
} from "@/store/useEngineStore";
import { StudioTopBar } from "@/components/navigation/StudioTopBar";
import { StudioNavigationDrawer } from "@/components/navigation/StudioNavigationDrawer";
import { ContentCreationGuideModal } from "@/components/guide/ContentCreationGuideModal";
import { KanbanPipelineBoard } from "@/components/KanbanPipelineBoard";
import { ScriptStudioView } from "@/components/ScriptStudioView";
import { MobileSafeZoneSimulator } from "@/components/MobileSafeZoneSimulator";
import { PublishingAndHitlView } from "@/components/PublishingAndHitlView";
import { AdsCampaignStudioView } from "@/components/AdsCampaignStudioView";
import { ClosedLoopAnalyticsView } from "@/components/ClosedLoopAnalyticsView";
import { CreatorProfileModal } from "@/components/CreatorProfileModal";
import type { CreatorModalTab } from "@/components/ProfileBubbleMenu";
import { BackendStatusModal } from "@/components/BackendStatusModal";
import { N8nWorkflowsHub } from "@/components/N8nWorkflowsHub";
import { SocialCredentialsSettings } from "@/components/SocialCredentialsSettings";

interface ToolMeta {
  title: string;
  description: string;
  icon: LucideIcon;
}

const TOOL_META: Record<ActiveStudioTab, ToolMeta> = {
  pipeline: {
    title: "Tablero de Contenido",
    description: "Organiza tus ideas por fase de producción y prioriza con IA.",
    icon: KanbanSquare,
  },
  "script-studio": {
    title: "Taller de Guiones y Copy",
    description: "Edita el guión maestro, ganchos, teleprompter y textos por red.",
    icon: FileText,
  },
  "mobile-simulator": {
    title: "Estudio Video 9:16 y Portadas",
    description: "Revisa zonas seguras, audio, huella nativa y crea tu miniatura.",
    icon: Smartphone,
  },
  "publishing-hitl": {
    title: "Distribución y Crecimiento",
    description: "Planificador visual, autolistas, KigalChat Auto-DM y publicación directa.",
    icon: Send,
  },
  "ads-studio": {
    title: "Estudio de Ads",
    description: "LinkedIn B2B, Radar Ads Library, Meta, Google RSA y YouTube Ads.",
    icon: Megaphone,
  },
  "analytics-rmta": {
    title: "Resultados y Retención",
    description: "Diagnóstico RMT-A, retención y pruebas Watch Time Share.",
    icon: BarChart3,
  },
  "automations-n8n": {
    title: "Automatizaciones n8n",
    description: "Catálogo de los 5 flujos n8n listos para importar y activar.",
    icon: Workflow,
  },
  "connections-apis": {
    title: "Conexiones Oficiales y LLM",
    description: "Modelos IA del MiniPC, tokens OAuth de redes y APIs visuales.",
    icon: Plug,
  },
};

const CONNECTIONS_SECTIONS: Array<{
  id: ConnectionsSubTab;
  label: string;
  icon: LucideIcon;
  activeClass: string;
  idleClass: string;
}> = [
  {
    id: "llm-minipc",
    label: "Motor IA y MiniPC",
    icon: Cpu,
    activeClass:
      "border-2 border-emerald-400 bg-emerald-500/20 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.28)]",
    idleClass:
      "border border-emerald-500/25 bg-emerald-950/25 text-emerald-300/80 hover:border-emerald-400/50 hover:text-white",
  },
  {
    id: "social-apis",
    label: "Redes Sociales",
    icon: KeyRound,
    activeClass:
      "border-2 border-sky-400 bg-sky-500/20 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.28)]",
    idleClass:
      "border border-sky-500/25 bg-sky-950/25 text-sky-300/80 hover:border-sky-400/50 hover:text-white",
  },
  {
    id: "visual-ai",
    label: "Motores Visuales",
    icon: Sparkles,
    activeClass:
      "border-2 border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-100 shadow-[0_0_20px_rgba(217,70,239,0.28)]",
    idleClass:
      "border border-fuchsia-500/25 bg-fuchsia-950/25 text-fuchsia-300/80 hover:border-fuchsia-400/50 hover:text-white",
  },
];

interface NextStepShortcut {
  tab: ActiveStudioTab;
  publishingSubTab?: PublishingSubTab;
  label: string;
}

function getNextStepShortcut(
  activeTab: ActiveStudioTab,
  isTextOnlyProject: boolean
): NextStepShortcut | null {
  switch (activeTab) {
    case "script-studio":
      return isTextOnlyProject
        ? {
            tab: "publishing-hitl",
            publishingSubTab: "planner",
            label: "Siguiente: Planificador",
          }
        : { tab: "mobile-simulator", label: "Siguiente: Estudio 9:16" };
    case "mobile-simulator":
      return {
        tab: "publishing-hitl",
        publishingSubTab: "planner",
        label: "Siguiente: Planificador",
      };
    case "publishing-hitl":
      return { tab: "analytics-rmta", label: "Siguiente: Resultados" };
    case "ads-studio":
      return {
        tab: "publishing-hitl",
        publishingSubTab: "planner",
        label: "Ir a Planificador",
      };
    default:
      return null;
  }
}

export default function KigalContentStudioPage() {
  const {
    activeTab,
    connectionsSubTab,
    setActiveTab,
    setConnectionsSubTab,
    setNavDrawerOpen,
    setCreationGuideOpen,
    navigateToTool,
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
  const [profileModalTab, setProfileModalTab] = useState<CreatorModalTab>("general");
  const [isBackendModalOpen, setIsBackendModalOpen] = useState(false);
  const [createIdeaSignal, setCreateIdeaSignal] = useState(0);

  const isBootstrappingRef = useRef(false);

  const activeProject =
    projects.find((p) => p.id === selectedProjectId) ?? selectedDetail?.project ?? null;
  const isTextOnlyProject = activeProject?.content_format === "TEXT_ONLY";
  const currentToolMeta = TOOL_META[activeTab] ?? TOOL_META.pipeline;
  const CurrentToolIcon = currentToolMeta.icon;
  const nextShortcut = getNextStepShortcut(activeTab, isTextOnlyProject);

  const handleOpenProfile = useCallback((tab: CreatorModalTab = "general") => {
    setProfileModalTab(tab);
    setIsProfileModalOpen(true);
  }, []);

  const handleCreateNewIdea = useCallback(() => {
    setNavDrawerOpen(false);
    setCreationGuideOpen(false);
    setActiveTab("pipeline");
    setCreateIdeaSignal((n) => n + 1);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [setActiveTab, setCreationGuideOpen, setNavDrawerOpen]);

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
      setSelectedProjectId,
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

  return (
    <div className="min-h-screen flex flex-col text-slate-100">
      {/* Single-Row Glassy TopBar */}
      <StudioTopBar
        onRefresh={() => loadWorkspaceData(selectedProjectId ?? undefined)}
        onOpenProfile={handleOpenProfile}
        onOpenBackendModal={() => setIsBackendModalOpen(true)}
        onCreateNewIdea={handleCreateNewIdea}
      />

      {/* Left Slide-Over Hamburger Navigation Drawer */}
      <StudioNavigationDrawer
        onOpenProfile={handleOpenProfile}
        onCreateNewIdea={handleCreateNewIdea}
      />

      {/* Interactive Step-by-Step Guide Modal */}
      <ContentCreationGuideModal
        onOpenProfile={handleOpenProfile}
        onCreateNewIdea={handleCreateNewIdea}
      />

      {/* Main Workspace Area */}
      <main className="mx-auto w-full max-w-[1640px] flex-1 px-4 py-5 sm:px-6 space-y-5">
        {/* Subtle Live Activity Strip (only when real events arrive) */}
        {liveEvents.length > 0 && (
          <div className="glass-pill flex items-center gap-2.5 overflow-x-auto rounded-xl px-3.5 py-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5 font-semibold text-sky-300 shrink-0">
              <Activity className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
              En vivo:
            </span>
            {liveEvents.slice(0, 3).map((ev, idx) => (
              <span
                key={`${ev.timestamp}-${idx}`}
                className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-200 truncate max-w-[280px] shrink-0"
              >
                {ev.summary}
              </span>
            ))}
          </div>
        )}

        {/* Slim Contextual Tool Bar inside sub-tools */}
        {activeTab !== "pipeline" && (
          <div className="glass-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setActiveTab("pipeline")}
                className="glass-pill inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-sky-400/40 hover:text-white transition"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                <span>Volver al Tablero</span>
              </button>

              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-400/30 bg-sky-500/15 text-sky-300">
                  <CurrentToolIcon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-white truncate">
                      {currentToolMeta.title}
                    </h2>
                    {activeProject &&
                      activeTab !== "automations-n8n" &&
                      activeTab !== "connections-apis" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[11px] text-slate-200 max-w-[260px] truncate">
                          <span className="font-mono font-bold text-sky-300">
                            {activeProject.asset_code}
                          </span>
                          <span className="truncate">{activeProject.working_title}</span>
                        </span>
                      )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {currentToolMeta.description}
                  </p>
                </div>
              </div>
            </div>

            {activeTab === "connections-apis" && (
              <div
                role="tablist"
                aria-label="Secciones de Conexiones Oficiales y LLM"
                className="flex flex-wrap items-center gap-2"
              >
                {CONNECTIONS_SECTIONS.map((sec) => {
                  const SIcon = sec.icon;
                  const isSelected = connectionsSubTab === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setConnectionsSubTab(sec.id)}
                      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                        isSelected ? sec.activeClass : sec.idleClass
                      }`}
                    >
                      <SIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{sec.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCreationGuideOpen(true)}
                className="glass-pill inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-sky-200 hover:border-sky-400/40 hover:text-white transition"
              >
                <Compass className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                <span>Guía paso a paso</span>
              </button>

              {nextShortcut && (
                <button
                  type="button"
                  onClick={() =>
                    navigateToTool(nextShortcut.tab, {
                      publishingSubTab: nextShortcut.publishingSubTab,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition shadow-sm"
                >
                  <span>{nextShortcut.label}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active Tool View */}
        <section aria-label={currentToolMeta.title} className="space-y-6">
          {activeTab === "pipeline" && (
            <KanbanPipelineBoard
              onRefresh={() => loadWorkspaceData(selectedProjectId ?? undefined)}
              openCreateFormSignal={createIdeaSignal}
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
          {activeTab === "ads-studio" && (
            <AdsCampaignStudioView
              onRefresh={() => loadWorkspaceData(selectedProjectId ?? undefined)}
            />
          )}
          {activeTab === "analytics-rmta" && (
            <ClosedLoopAnalyticsView
              onRefresh={() => loadWorkspaceData(selectedProjectId ?? undefined)}
            />
          )}
          {activeTab === "automations-n8n" && <N8nWorkflowsHub />}
          {activeTab === "connections-apis" && <SocialCredentialsSettings />}
        </section>
      </main>

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
          className="glass-panel fixed bottom-5 right-5 z-50 flex max-w-md items-start gap-3 p-4 text-sm"
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
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
