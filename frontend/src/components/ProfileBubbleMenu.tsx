"use client";

import React, { useEffect, useRef } from "react";
import {
  CheckCircle2,
  ChevronRight,
  FolderOpen,
  GitBranch,
  Globe,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { useEngineStore } from "@/store/useEngineStore";
import type { CreatorProfile } from "@/types/engine";

export type CreatorModalTab =
  | "importar"
  | "general"
  | "estilo"
  | "redes"
  | "lead-magnets";

interface ProfileBubbleMenuProps {
  isOpen: boolean;
  onClose: () => void;
  creatorProfile: CreatorProfile | null;
  onOpenPaso0: (initialTab?: CreatorModalTab) => void;
}

export function ProfileBubbleMenu({
  isOpen,
  onClose,
  creatorProfile,
  onOpenPaso0,
}: ProfileBubbleMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const { setActiveTab } = useEngineStore();

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const reposCount = creatorProfile?.github_repos?.length ?? 0;
  const leadMagnetsCount = creatorProfile?.lead_magnets?.length ?? 0;
  const triggersCount =
    creatorProfile?.manychat_triggers?.filter((t) => t.active).length ?? 0;
  const accountsCount =
    creatorProfile?.social_accounts?.length ??
    Object.values(creatorProfile?.social_profiles || {}).filter(Boolean).length;

  const handleSelect = (tab: CreatorModalTab) => {
    onClose();
    onOpenPaso0(tab);
  };

  return (
    <div
      ref={menuRef}
      role="dialog"
      aria-label="Globo de Perfil - Paso 0"
      className="absolute right-0 top-full mt-2 w-80 sm:w-[400px] z-50 rounded-2xl border border-white/15 bg-slate-950/85 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl animate-in fade-in slide-in-from-top-2"
    >
      {/* Bubble Pointer */}
      <div className="absolute -top-2 right-6 h-4 w-4 rotate-45 border-l border-t border-white/15 bg-slate-950/85 backdrop-blur-2xl" />

      <div className="max-h-[82vh] overflow-y-auto p-4">
        {/* Header */}
        <div className="relative flex items-start gap-3 border-b border-white/10 pb-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-violet-600 text-sm font-bold text-white shadow-md shadow-sky-500/20">
            {creatorProfile?.name ? creatorProfile.name.charAt(0).toUpperCase() : "C"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-white">
                {creatorProfile?.name || "Creador"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/15 border border-sky-400/30 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                Paso 0
              </span>
            </div>
            <p className="truncate text-xs text-slate-400 mt-0.5">
              {creatorProfile?.niche || "Configura tu nicho y contexto"}
            </p>
          </div>
        </div>

        {/* Mini Stats Grid */}
        <div className="grid grid-cols-2 gap-2 py-3 border-b border-white/10">
          <button
            type="button"
            onClick={() => handleSelect("importar")}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.07] hover:border-violet-400/40 transition"
          >
            <div>
              <p className="text-[10px] text-slate-400">Repos GitHub</p>
              <p className="text-xs font-bold text-white">{reposCount} / 5</p>
            </div>
            <GitBranch className="h-4 w-4 text-violet-400" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => handleSelect("lead-magnets")}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.07] hover:border-amber-400/40 transition"
          >
            <div>
              <p className="text-[10px] text-slate-400">Lead Magnets</p>
              <p className="text-xs font-bold text-white">{leadMagnetsCount} en carpeta</p>
            </div>
            <FolderOpen className="h-4 w-4 text-amber-400" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => handleSelect("lead-magnets")}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.07] hover:border-emerald-400/40 transition"
          >
            <div>
              <p className="text-[10px] text-slate-400">ManyChat</p>
              <p className="text-xs font-bold text-white">{triggersCount} disparadores</p>
            </div>
            <Zap className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => handleSelect("redes")}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.07] hover:border-sky-400/40 transition"
          >
            <div>
              <p className="text-[10px] text-slate-400">Redes y Webs</p>
              <p className="text-xs font-bold text-white">{accountsCount} cuentas</p>
            </div>
            <Globe className="h-4 w-4 text-sky-400" aria-hidden="true" />
          </button>
        </div>

        {/* Quick Navigation List */}
        <div className="pt-1 space-y-1.5">
          <button
            type="button"
            onClick={() => handleSelect("general")}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.06] transition"
          >
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 text-sky-400" aria-hidden="true" />
              Editar Perfil e Identidad (Paso 0)
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => handleSelect("importar")}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.06] transition"
          >
            <span className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-violet-400" aria-hidden="true" />
              Importar desde GitHub (hasta 5 repos) / IA
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => handleSelect("redes")}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.06] transition"
          >
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-sky-400" aria-hidden="true" />
              Gestionar Múltiples Redes y Webs
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => handleSelect("lead-magnets")}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.06] transition"
          >
            <span className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-amber-400" aria-hidden="true" />
              Carpeta Lead Magnets &amp; ManyChat
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </button>
        </div>

        {/* Primary CTA */}
        <div className="mt-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => handleSelect("general")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-500/20 hover:opacity-95 transition"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Abrir Paso 0: Contexto Completo</span>
          </button>
          {creatorProfile?.niche && (
            <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-emerald-400">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Perfil activo en la generación de guiones
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
