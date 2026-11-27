"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  Compass,
  Cpu,
  FileText,
  KanbanSquare,
  Megaphone,
  MessageCircleHeart,
  PenLine,
  Plug,
  Plus,
  Repeat,
  Rocket,
  Search,
  Smartphone,
  Sparkles,
  UserCircle2,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEngineStore,
  type ActiveStudioTab,
  type PublishingSubTab,
} from "@/store/useEngineStore";
import type { CreatorModalTab } from "@/components/ProfileBubbleMenu";

interface StudioNavigationDrawerProps {
  onOpenProfile: (tab?: CreatorModalTab) => void;
  onCreateNewIdea: () => void;
}

interface DrawerItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tab?: ActiveStudioTab;
  publishingSubTab?: PublishingSubTab;
  action?: "guide";
  badge?: string;
  badgeTone?: "cyan" | "muted";
}

interface DrawerGroup {
  id: string;
  label: string;
  items: DrawerItem[];
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function StudioNavigationDrawer({
  onOpenProfile,
  onCreateNewIdea,
}: StudioNavigationDrawerProps) {
  const {
    activeTab,
    publishingSubTab,
    isNavDrawerOpen,
    isCreationGuideOpen,
    setNavDrawerOpen,
    setCreationGuideOpen,
    navigateToTool,
    projects,
    selectedProjectId,
    selectedDetail,
    creatorProfile,
    backendOnline,
  } = useEngineStore();

  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeProject =
    projects.find((p) => p.id === selectedProjectId) ?? selectedDetail?.project ?? null;
  const isTextOnlyProject = activeProject?.content_format === "TEXT_ONLY";

  // Escape key & body scroll lock
  useEffect(() => {
    if (!isNavDrawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNavDrawerOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 60);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [isNavDrawerOpen, setNavDrawerOpen]);

  const groups: DrawerGroup[] = useMemo(
    () => [
      {
        id: "inicio",
        label: "Inicio",
        items: [
          {
            id: "kanban",
            title: "Tablero Kanban",
            description: "Vista principal de ideas y estados",
            icon: KanbanSquare,
            tab: "pipeline",
            badge: String(projects.length),
            badgeTone: "cyan",
          },
          {
            id: "guide",
            title: "Guía Paso a Paso",
            description: "Asistente interactivo para crear contenido",
            icon: Compass,
            action: "guide",
          },
        ],
      },
      {
        id: "creacion",
        label: "Creación de Contenido",
        items: [
          {
            id: "script-studio",
            title: "Taller de Guiones y Copy",
            description: "Guión maestro, ganchos, teleprompter y redes",
            icon: FileText,
            tab: "script-studio",
          },
          {
            id: "mobile-simulator",
            title: "Estudio Video 9:16 y Portadas",
            description: "Zonas seguras, subtítulos, huella nativa y miniaturas",
            icon: Smartphone,
            tab: "mobile-simulator",
            badge: isTextOnlyProject ? "Omitido en texto" : undefined,
            badgeTone: "muted",
          },
        ],
      },
      {
        id: "distribucion",
        label: "Distribución y Crecimiento",
        items: [
          {
            id: "pub-planner",
            title: "Planificador Editorial",
            description: "Calendario visual y mejores horas",
            icon: CalendarClock,
            tab: "publishing-hitl",
            publishingSubTab: "planner",
          },
          {
            id: "pub-copy",
            title: "Copy por Red y Huella Nativa",
            description: "Ajustes finales por plataforma",
            icon: PenLine,
            tab: "publishing-hitl",
            publishingSubTab: "copy-native",
          },
          {
            id: "pub-autolists",
            title: "Autolistas Evergreen",
            description: "Reciclaje automático de contenido",
            icon: Repeat,
            tab: "publishing-hitl",
            publishingSubTab: "autolists",
          },
          {
            id: "pub-dm",
            title: "KigalChat Auto-DM",
            description: "Respuestas automáticas por palabra clave",
            icon: MessageCircleHeart,
            tab: "publishing-hitl",
            publishingSubTab: "kigalchat-dm",
          },
          {
            id: "pub-direct",
            title: "Publicación Directa e Historial",
            description: "Publicar en 1 clic y registro",
            icon: Rocket,
            tab: "publishing-hitl",
            publishingSubTab: "hitl-audit",
          },
        ],
      },
      {
        id: "marketing",
        label: "Marketing y Analítica",
        items: [
          {
            id: "ads-studio",
            title: "Estudio de Ads",
            description: "LinkedIn B2B, Ads Library, Meta, Google RSA y YouTube Ads",
            icon: Megaphone,
            tab: "ads-studio",
          },
          {
            id: "analytics-rmta",
            title: "Resultados y Retención",
            description: "Diagnóstico RMT-A y pruebas Watch Time Share",
            icon: BarChart3,
            tab: "analytics-rmta",
          },
        ],
      },
      {
        id: "sistema",
        label: "Sistema y Conexiones",
        items: [
          {
            id: "automations-n8n",
            title: "Automatizaciones n8n",
            description: "Catálogo y gestión de los 5 flujos n8n",
            icon: Workflow,
            tab: "automations-n8n",
          },
          {
            id: "connections-apis",
            title: "Conexiones Oficiales y LLM",
            description: "Tokens de redes sociales y Ollama/IA",
            icon: Plug,
            tab: "connections-apis",
          },
        ],
      },
    ],
    [projects.length, isTextOnlyProject]
  );

  const normalizedQuery = normalizeSearchText(query.trim());

  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const haystack = normalizeSearchText(
            `${group.label} ${item.title} ${item.description}`
          );
          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, normalizedQuery]);

  const handleItemClick = (item: DrawerItem) => {
    if (item.action === "guide") {
      setNavDrawerOpen(false);
      setCreationGuideOpen(true);
      setQuery("");
      return;
    }
    if (item.tab) {
      navigateToTool(
        item.tab,
        item.publishingSubTab
          ? { publishingSubTab: item.publishingSubTab }
          : undefined
      );
      setQuery("");
    }
  };

  const isItemActive = (item: DrawerItem): boolean => {
    if (item.action === "guide") return isCreationGuideOpen;
    if (!item.tab) return false;
    if (item.tab === "publishing-hitl") {
      return (
        activeTab === "publishing-hitl" &&
        publishingSubTab === item.publishingSubTab
      );
    }
    return activeTab === item.tab;
  };

  return (
    <div
      aria-hidden={!isNavDrawerOpen}
      className={`fixed inset-0 z-50 transition-[visibility] duration-200 ${
        isNavDrawerOpen ? "visible" : "invisible pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div
        onClick={() => setNavDrawerOpen(false)}
        className={`absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-200 ${
          isNavDrawerOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Slide-over Frosted Glass Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menú de herramientas de KigalContent"
        className={`glass-drawer relative flex h-full w-full max-w-[350px] flex-col border-r border-white/15 bg-[#070b14]/90 text-slate-100 shadow-2xl shadow-black/80 backdrop-blur-2xl transition-transform duration-200 ease-out ${
          isNavDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top Brand + Close + Search */}
        <div className="border-b border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/35 bg-gradient-to-br from-cyan-500/20 via-indigo-500/20 to-sky-500/15">
                <Cpu className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold tracking-tight text-white">
                    KigalContent
                  </span>
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                    Studio OS
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Centro de navegación
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setNavDrawerOpen(false)}
              aria-label="Cerrar menú de herramientas"
              className="glass-pill inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 transition hover:border-cyan-400/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar herramienta..."
                aria-label="Buscar herramienta"
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2 pl-8 pr-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:bg-white/[0.08] focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setNavDrawerOpen(false);
                onCreateNewIdea();
              }}
              title="Crear nueva idea de contenido"
              className="inline-flex h-[34px] shrink-0 items-center gap-1 rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-2.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Idea</span>
            </button>
          </div>
        </div>

        {/* Scrollable Groups */}
        <nav
          aria-label="Herramientas del estudio"
          className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-5"
        >
          {filteredGroups.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
              <p className="text-xs font-medium text-slate-300">
                No hay herramientas que coincidan con &ldquo;{query}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-2 text-xs font-semibold text-cyan-300 hover:underline"
              >
                Mostrar todas las herramientas
              </button>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.id} className="space-y-1.5">
                <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleItemClick(item)}
                        className={`group relative flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                          active
                            ? "border-sky-400/45 bg-sky-500/15 text-white shadow-sm shadow-sky-500/10"
                            : "border-transparent bg-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
                        }`}
                      >
                        {active && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.85)]"
                          />
                        )}

                        <span
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
                            active
                              ? "border-cyan-400/40 bg-cyan-500/20 text-cyan-200"
                              : "border-white/10 bg-white/[0.04] text-slate-400 group-hover:border-white/20 group-hover:text-cyan-300"
                          }`}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-semibold">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  item.badgeTone === "cyan"
                                    ? "border border-cyan-400/30 bg-cyan-500/15 text-cyan-200"
                                    : "border border-white/10 bg-white/[0.06] text-slate-400"
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-slate-400 group-hover:text-slate-300">
                            {item.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </nav>

        {/* Footer: Paso 0 Profile Card + Backend Status */}
        <div className="border-t border-white/10 p-3 space-y-2.5 bg-black/20">
          <button
            type="button"
            onClick={() => {
              setNavDrawerOpen(false);
              onOpenProfile("general");
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-cyan-400/25 bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-violet-500/10 p-2.5 text-left transition hover:border-cyan-400/50 hover:from-cyan-500/20 hover:to-violet-500/20"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 text-xs font-bold text-white shadow">
              {creatorProfile?.name ? (
                creatorProfile.name.trim().charAt(0).toUpperCase()
              ) : (
                <UserCircle2 className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-semibold text-white">
                  Perfil y Contexto
                </span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                  Paso 0
                </span>
              </div>
              <p className="truncate text-[11px] text-slate-400">
                {creatorProfile?.name
                  ? `${creatorProfile.name} · ${creatorProfile.niche || "Configurar nicho"}`
                  : "Marca, tono, GitHub y Lead Magnets"}
              </p>
            </div>
          </button>

          <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  backendOnline
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.75)]"
                }`}
                aria-hidden="true"
              />
              <span>
                {backendOnline ? "Backend conectado" : "Modo local / sin conexión"}
              </span>
            </span>
            <span className="text-[10px] text-slate-500">Esc para cerrar</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
