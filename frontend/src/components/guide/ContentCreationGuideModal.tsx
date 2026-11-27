"use client";

import React, { useEffect } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Compass,
  FileText,
  KanbanSquare,
  Layers,
  Megaphone,
  MessageCircleHeart,
  Plus,
  Rocket,
  Smartphone,
  Sparkles,
  UserCircle2,
  X,
} from "lucide-react";
import { useEngineStore } from "@/store/useEngineStore";
import type { CreatorModalTab } from "@/components/ProfileBubbleMenu";
import type { FSMState } from "@/types/engine";
import { HUMAN_STATE_LABELS } from "@/lib/utils";

interface ContentCreationGuideModalProps {
  onOpenProfile: (tab?: CreatorModalTab) => void;
  onCreateNewIdea: () => void;
}

function getRecommendedStepFromState(
  state: FSMState | undefined,
  hasProfileNiche: boolean
): number {
  if (!state) {
    return hasProfileNiche ? 1 : 0;
  }
  switch (state) {
    case "CAPTURED":
    case "RESEARCHED_TRIAGED":
      return 1;
    case "SCRIPTED_PACKAGED":
    case "REJECTED_REVISION":
      return 2;
    case "HITL_PENDING_PRODUCTION":
      return 3;
    case "PRODUCED_VALIDATED":
    case "HITL_PENDING_PUBLISH":
      return 4;
    case "PUBLISHED_LIVE":
    case "AUDITED_CLOSED_LOOP":
      return 5;
    case "INIT":
    case "ARCHIVED":
    default:
      return hasProfileNiche ? 1 : 0;
  }
}

export function ContentCreationGuideModal({
  onOpenProfile,
  onCreateNewIdea,
}: ContentCreationGuideModalProps) {
  const {
    isCreationGuideOpen,
    setCreationGuideOpen,
    navigateToTool,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    selectedDetail,
    creatorProfile,
  } = useEngineStore();

  const activeProject =
    projects.find((p) => p.id === selectedProjectId) ?? selectedDetail?.project ?? null;
  const isTextOnly = activeProject?.content_format === "TEXT_ONLY";
  const hasProfileNiche = Boolean(creatorProfile?.niche?.trim());
  const currentStep = getRecommendedStepFromState(
    activeProject?.current_state,
    hasProfileNiche
  );

  useEffect(() => {
    if (!isCreationGuideOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCreationGuideOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCreationGuideOpen, setCreationGuideOpen]);

  if (!isCreationGuideOpen) return null;

  const closeAndNavigate = (
    tab: Parameters<typeof navigateToTool>[0],
    options?: Parameters<typeof navigateToTool>[1]
  ) => {
    setCreationGuideOpen(false);
    navigateToTool(tab, options);
  };

  const handleNewIdeaClick = () => {
    setCreationGuideOpen(false);
    onCreateNewIdea();
  };

  const handleOpenPaso0 = () => {
    setCreationGuideOpen(false);
    onOpenProfile("general");
  };

  const stepLabels = [
    "Paso 0 · Marca",
    "Paso 1 · Idea",
    "Paso 2 · Guión",
    "Paso 3 · Video",
    "Paso 4 · Publicar",
    "Paso 5 · Medir",
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="creation-guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
    >
      {/* Frosted Backdrop */}
      <div
        onClick={() => setCreationGuideOpen(false)}
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
      />

      {/* Glass Modal Container */}
      <div className="glass-panel relative flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#070b14]/92 text-slate-100 shadow-2xl shadow-black/80 backdrop-blur-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/35 bg-cyan-500/15 text-cyan-300">
              <Compass className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="creation-guide-title"
                className="text-sm font-bold tracking-tight text-white sm:text-base"
              >
                Guía Paso a Paso · Crea tu Contenido
              </h2>
              <p className="text-xs text-slate-400">
                Sigue el flujo recomendado según el estado del proyecto activo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {projects.length > 0 && (
              <label className="glass-pill flex h-8 max-w-[230px] items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-2.5 text-xs">
                <Layers className="h-3.5 w-3.5 shrink-0 text-indigo-300" aria-hidden="true" />
                <select
                  aria-label="Proyecto activo en la guía"
                  value={selectedProjectId ?? ""}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full truncate bg-transparent text-xs font-medium text-slate-100 focus:outline-none cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-950 text-slate-100">
                      [{p.asset_code}] {p.working_title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              type="button"
              onClick={handleNewIdeaClick}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-cyan-400/45 bg-gradient-to-r from-cyan-500/25 to-sky-500/20 px-3 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Nueva Idea</span>
            </button>

            <button
              type="button"
              onClick={() => setCreationGuideOpen(false)}
              aria-label="Cerrar guía paso a paso"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-300 transition hover:border-cyan-400/50 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Smart Progress Tracker Bar */}
        <div className="border-b border-white/10 bg-white/[0.02] px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/35 bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-200">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Progreso inteligente
              </span>
              {activeProject ? (
                <span className="text-slate-300">
                  Estado actual:{" "}
                  <strong className="text-white">
                    {HUMAN_STATE_LABELS[activeProject.current_state] ??
                      activeProject.current_state}
                  </strong>
                </span>
              ) : (
                <span className="text-slate-400">
                  Sin proyecto seleccionado — empieza configurando tu marca o creando una idea.
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-cyan-300">
              Recomendado: {stepLabels[currentStep]}
            </span>
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {stepLabels.map((label, idx) => {
              const isCurrent = idx === currentStep;
              const isCompleted = idx < currentStep;
              return (
                <div
                  key={label}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                    isCurrent
                      ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100 shadow-sm shadow-cyan-500/10"
                      : isCompleted
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-white/10 bg-white/[0.02] text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        isCurrent ? "bg-cyan-400" : "bg-slate-600"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 6 Interactive Step Cards */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {/* Paso 0 */}
            <StepCard
              stepNumber={0}
              title="Contexto de Marca"
              description="Define tu nicho, tono de voz, repos de GitHub y Lead Magnets para que la IA escriba como tú."
              icon={UserCircle2}
              isCurrent={currentStep === 0}
              isCompleted={currentStep > 0 && hasProfileNiche}
            >
              <button
                type="button"
                onClick={handleOpenPaso0}
                className="inline-flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
              >
                <span>Configurar Perfil (Paso 0)</span>
                <ArrowRight className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
              </button>
            </StepCard>

            {/* Paso 1 */}
            <StepCard
              stepNumber={1}
              title="Idea y Priorización IA"
              description="Captura ideas, evalúa su ICE Score con IA y organízalas en el tablero Kanban."
              icon={KanbanSquare}
              isCurrent={currentStep === 1}
              isCompleted={currentStep > 1}
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => closeAndNavigate("pipeline")}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
                >
                  <span>Ir al Tablero Kanban</span>
                </button>
                <button
                  type="button"
                  onClick={handleNewIdeaClick}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Añadir Nueva Idea</span>
                </button>
              </div>
            </StepCard>

            {/* Paso 2 */}
            <StepCard
              stepNumber={2}
              title="Guión / Borrador Multicanal"
              description="Genera ganchos de retención, guión en dos columnas, teleprompter y adaptaciones por red."
              icon={FileText}
              isCurrent={currentStep === 2}
              isCompleted={currentStep > 2}
            >
              <button
                type="button"
                onClick={() => closeAndNavigate("script-studio")}
                className="inline-flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
              >
                <span>Abrir Taller de Guiones</span>
                <ArrowRight className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
              </button>
            </StepCard>

            {/* Paso 3 */}
            <StepCard
              stepNumber={3}
              title="Video 9:16 y Huella Nativa"
              description="Verifica zonas seguras de Reels/Shorts/TikTok, subtítulos, audio LUFS y portadas A/B."
              icon={Smartphone}
              isCurrent={currentStep === 3}
              isCompleted={currentStep > 3}
              muted={isTextOnly}
              extraBadge={isTextOnly ? "Opcional / Solo Video" : undefined}
            >
              <button
                type="button"
                onClick={() => closeAndNavigate("mobile-simulator")}
                className="inline-flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
              >
                <span>Abrir Estudio Video 9:16</span>
                <ArrowRight className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
              </button>
            </StepCard>

            {/* Paso 4 */}
            <StepCard
              stepNumber={4}
              title="Planificar, Auto-DM y Publicar"
              description="Programa en el calendario, activa disparadores KigalChat por comentario o publica al instante."
              icon={Rocket}
              isCurrent={currentStep === 4}
              isCompleted={currentStep > 4}
            >
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    closeAndNavigate("publishing-hitl", {
                      publishingSubTab: "planner",
                    })
                  }
                  className="inline-flex flex-col items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/[0.06] px-2 py-2 text-[11px] font-semibold text-slate-100 transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
                >
                  <CalendarClock className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
                  <span className="truncate">Planificador</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    closeAndNavigate("publishing-hitl", {
                      publishingSubTab: "kigalchat-dm",
                    })
                  }
                  className="inline-flex flex-col items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/[0.06] px-2 py-2 text-[11px] font-semibold text-slate-100 transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
                >
                  <MessageCircleHeart className="h-3.5 w-3.5 text-pink-300" aria-hidden="true" />
                  <span className="truncate">KigalChat Auto-DM</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    closeAndNavigate("publishing-hitl", {
                      publishingSubTab: "hitl-audit",
                    })
                  }
                  className="inline-flex flex-col items-center justify-center gap-1 rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-2 py-2 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/25 hover:text-white"
                >
                  <Rocket className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
                  <span className="truncate">Publicar Ahora</span>
                </button>
              </div>
            </StepCard>

            {/* Paso 5 */}
            <StepCard
              stepNumber={5}
              title="Medir y Amplificar"
              description="Evalúa retención RMT-A, Watch Time Share y convierte ganadores en campañas de Ads."
              icon={BarChart3}
              isCurrent={currentStep === 5}
              isCompleted={false}
            >
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => closeAndNavigate("analytics-rmta")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-2.5 py-2 text-xs font-semibold text-white transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
                >
                  <BarChart3 className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                  <span>Ver Resultados</span>
                </button>
                <button
                  type="button"
                  onClick={() => closeAndNavigate("ads-studio")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-2.5 py-2 text-xs font-semibold text-white transition hover:border-violet-400/50 hover:bg-violet-500/15"
                >
                  <Megaphone className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />
                  <span>Estudio de Ads</span>
                </button>
              </div>
            </StepCard>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StepCardProps {
  stepNumber: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isCurrent: boolean;
  isCompleted: boolean;
  muted?: boolean;
  extraBadge?: string;
  children: React.ReactNode;
}

function StepCard({
  stepNumber,
  title,
  description,
  icon: Icon,
  isCurrent,
  isCompleted,
  muted = false,
  extraBadge,
  children,
}: StepCardProps) {
  return (
    <section
      className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
        isCurrent
          ? "border-cyan-400/60 bg-gradient-to-b from-cyan-500/15 to-white/[0.04] shadow-lg shadow-cyan-500/10"
          : muted
          ? "border-white/10 bg-white/[0.02] opacity-65"
          : "border-white/10 bg-white/[0.03] hover:border-white/20"
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                isCurrent
                  ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-200"
                  : isCompleted
                  ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-300"
                  : "border-white/10 bg-white/[0.05] text-slate-300"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Paso {stepNumber}
              </span>
              <h3 className="text-sm font-bold text-white leading-snug">
                {title}
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1">
            {isCurrent && (
              <span className="rounded-full border border-cyan-400/45 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                Paso actual
              </span>
            )}
            {!isCurrent && isCompleted && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Listo
              </span>
            )}
            {extraBadge && (
              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                {extraBadge}
              </span>
            )}
          </div>
        </div>

        <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
          {description}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-white/10">{children}</div>
    </section>
  );
}
