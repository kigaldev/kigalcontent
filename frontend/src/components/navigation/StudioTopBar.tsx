"use client";

import React, { useState } from "react";
import {
  ChevronRight,
  Compass,
  Cpu,
  Layers,
  Menu,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  useEngineStore,
  type ActiveStudioTab,
  type PublishingSubTab,
} from "@/store/useEngineStore";
import {
  ProfileBubbleMenu,
  type CreatorModalTab,
} from "@/components/ProfileBubbleMenu";
import { apiClient } from "@/lib/api";

interface StudioTopBarProps {
  onRefresh: () => Promise<void> | void;
  onOpenProfile: (tab?: CreatorModalTab) => void;
  onOpenBackendModal: () => void;
  onCreateNewIdea: () => void;
}

const TOOL_LABELS: Record<ActiveStudioTab, string> = {
  pipeline: "Tablero Kanban",
  "script-studio": "Taller de Guiones y Copy",
  "mobile-simulator": "Estudio Video 9:16",
  "publishing-hitl": "Distribución y Publicación",
  "ads-studio": "Estudio de Ads",
  "analytics-rmta": "Resultados y Retención",
  "automations-n8n": "Automatizaciones n8n",
  "connections-apis": "Conexiones Oficiales y LLM",
};

const PUBLISHING_SUBTAB_LABELS: Record<PublishingSubTab, string> = {
  planner: "Planificador Editorial",
  "copy-native": "Copy por Red y Huella",
  autolists: "Autolistas Evergreen",
  "kigalchat-dm": "KigalChat Auto-DM",
  "hitl-audit": "Publicación Directa",
};

export function StudioTopBar({
  onRefresh,
  onOpenProfile,
  onOpenBackendModal,
  onCreateNewIdea,
}: StudioTopBarProps) {
  const {
    activeTab,
    publishingSubTab,
    isNavDrawerOpen,
    setNavDrawerOpen,
    setCreationGuideOpen,
    navigateToTool,
    backendOnline,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    creatorProfile,
  } = useEngineStore();

  const [isProfileBubbleOpen, setIsProfileBubbleOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentToolLabel =
    activeTab === "publishing-hitl"
      ? PUBLISHING_SUBTAB_LABELS[publishingSubTab] ?? TOOL_LABELS[activeTab]
      : TOOL_LABELS[activeTab] ?? "Estudio";

  const handleRefreshClick = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const creatorInitial = creatorProfile?.name
    ? creatorProfile.name.trim().charAt(0).toUpperCase()
    : "C";

  return (
    <header className="sticky top-0 z-30 glass-topbar border-b border-white/10 bg-[#050811]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-2 px-3 sm:px-5">
        {/* Left: Drawer Trigger + Brand + Glassy Breadcrumb */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setNavDrawerOpen(true)}
            aria-label="Abrir menú de herramientas"
            aria-expanded={isNavDrawerOpen}
            className="glass-pill inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-200 transition hover:border-cyan-400/50 hover:bg-cyan-500/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title="Menú de herramientas"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => navigateToTool("pipeline")}
            className="group flex shrink-0 items-center gap-2 rounded-xl px-1.5 py-1 text-left transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title="Ir al Tablero Kanban (Inicio)"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/35 bg-gradient-to-br from-cyan-500/20 via-indigo-500/20 to-sky-500/15 shadow-inner shadow-cyan-500/15 backdrop-blur-md">
              <Cpu className="h-4 w-4 text-cyan-300 transition group-hover:scale-105" aria-hidden="true" />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-white sm:text-base">
                KigalContent
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-cyan-300">
                Studio OS
              </span>
            </span>
          </button>

          {activeTab !== "pipeline" && (
            <nav
              aria-label="Ruta actual"
              className="hidden md:flex min-w-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs backdrop-blur-md"
            >
              <button
                type="button"
                onClick={() => navigateToTool("pipeline")}
                className="text-slate-400 transition hover:text-cyan-300 focus:outline-none focus-visible:underline"
              >
                Inicio
              </button>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
              <span className="truncate max-w-[200px] font-semibold text-cyan-200">
                {currentToolLabel}
              </span>
            </nav>
          )}
        </div>

        {/* Right: Active Project, Quick Guide, Backend Status, Profile, Refresh */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {projects.length > 0 ? (
            <label className="glass-pill flex h-8 max-w-[118px] sm:max-w-[230px] items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-2 sm:px-2.5 text-xs backdrop-blur-md transition focus-within:border-cyan-400/60">
              <Layers className="h-3.5 w-3.5 shrink-0 text-indigo-300" aria-hidden="true" />
              <select
                aria-label="Seleccionar proyecto activo"
                value={selectedProjectId ?? ""}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full truncate bg-transparent text-xs font-medium text-slate-100 focus:outline-none cursor-pointer"
              >
                {projects.map((project) => (
                  <option
                    key={project.id}
                    value={project.id}
                    className="bg-slate-950 text-slate-100"
                  >
                    [{project.asset_code}] {project.working_title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <button
              type="button"
              onClick={onCreateNewIdea}
              className="glass-pill inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-cyan-400/50 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 hover:text-white"
              title="Crear tu primera idea"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Nueva Idea</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setCreationGuideOpen(true)}
            title="Abrir guía paso a paso"
            aria-label="Abrir guía paso a paso"
            className="glass-pill inline-flex h-8 items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 text-xs font-medium text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <Compass className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
            <span className="hidden sm:inline">Guía</span>
          </button>

          <button
            type="button"
            onClick={onOpenBackendModal}
            className={`glass-pill inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              backendOnline
                ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/35 bg-amber-500/10 text-amber-300 hover:border-amber-400/60"
            }`}
            title={
              backendOnline
                ? `Servidor conectado (${apiClient.apiBase}). Clic para ver detalles.`
                : "Backend sin conexión. Haz clic para revisar la conexión."
            }
          >
            <span
              className={`h-2 w-2 rounded-full ${
                backendOnline
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.75)]"
              }`}
              aria-hidden="true"
            />
            <span className="hidden lg:inline">
              {backendOnline ? "Online" : "Sin conexión"}
            </span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProfileBubbleOpen((prev) => !prev)}
              aria-expanded={isProfileBubbleOpen}
              aria-haspopup="dialog"
              aria-label="Abrir menú de perfil y Paso 0"
              title="Perfil de creador y Paso 0"
              className="glass-pill inline-flex h-8 items-center gap-1.5 rounded-full border border-cyan-400/40 bg-gradient-to-r from-cyan-950/70 to-violet-950/70 p-1 sm:pr-2.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 text-[11px] font-bold text-white shadow-sm">
                {creatorInitial}
              </span>
              <span className="hidden xl:inline max-w-[96px] truncate">
                {creatorProfile?.name || "Perfil"}
              </span>
            </button>

            <ProfileBubbleMenu
              isOpen={isProfileBubbleOpen}
              onClose={() => setIsProfileBubbleOpen(false)}
              creatorProfile={creatorProfile}
              onOpenPaso0={(tab = "general") => onOpenProfile(tab)}
            />
          </div>

          <button
            type="button"
            onClick={() => void handleRefreshClick()}
            aria-label="Actualizar datos"
            title="Actualizar datos"
            className="glass-pill inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 transition hover:border-cyan-400/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-cyan-300" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </header>
  );
}
