"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Dices,
  FolderOpen,
  GitBranch,
  Globe,
  KeyRound,
  Lock,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { apiClient } from "@/lib/api";
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

function legacyCopyText(text: string): boolean {
  if (typeof document === "undefined") return false;
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

export function ProfileBubbleMenu({
  isOpen,
  onClose,
  creatorProfile,
  onOpenPaso0,
}: ProfileBubbleMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCopyStatusRef = useRef("");
  const pinInputId = useId();
  const pinHintId = useId();
  const pinErrorId = useId();
  const tokenOutputId = useId();

  const {
    backendOnline,
    selectedProjectId,
    creatorSecurityPin,
    setCreatorSecurityPin,
    activeHitlToken,
    setActiveHitlToken,
    setActiveTab,
    showToast,
  } = useEngineStore();

  const [issuingToken, setIssuingToken] = useState(false);
  const [tokenSource, setTokenSource] = useState<"server" | "local" | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [copiedState, setCopiedState] = useState<"idle" | "copied" | "failed">("idle");
  const [copyStatusText, setCopyStatusText] = useState("");

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

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

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

  const handleGenerateRandomPin = () => {
    const randomPin = String(Math.floor(100000 + Math.random() * 900000));
    setCreatorSecurityPin(randomPin);
    setPinError(null);
  };

  const handleGeneratePublishToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPin = creatorSecurityPin.trim();
    if (cleanedPin.length < 4) {
      setPinError("Introduce un PIN de seguridad de al menos 4 caracteres.");
      return;
    }

    setPinError(null);
    setIssuingToken(true);
    const projectId = selectedProjectId || "CR-001";

    try {
      if (backendOnline) {
        const res = await apiClient.issueHitlToken({
          project_id: projectId,
          tier: 3,
          action: "publish_all_channels",
          actor: "creator",
          two_factor_code: cleanedPin,
        });
        setActiveHitlToken(res.token);
        setTokenSource("server");
        showToast("success", "Clave de publicación Nivel 3 lista para la pestaña Publicar.");
      } else {
        const projectTag = projectId.replace(/_/g, "-").slice(0, 8);
        const pinTag = cleanedPin.slice(-4);
        const localToken = `HITL_AUTH_CREATOR_OK_${projectTag}_T3_LOCAL_${pinTag}`;
        setActiveHitlToken(localToken);
        setTokenSource("local");
        showToast("info", "Clave local generada y sincronizada para la pestaña Publicar.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error generando clave de publicación";
      setPinError(msg);
      showToast("error", msg);
    } finally {
      setIssuingToken(false);
    }
  };

  const handleCopyToken = async () => {
    if (!activeHitlToken) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(activeHitlToken);
      ok = true;
    } catch {
      ok = legacyCopyText(activeHitlToken);
    }

    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }

    let message = ok ? "Copiado" : "Error al copiar";
    if (message === lastCopyStatusRef.current) {
      message += "\u00A0";
    }
    lastCopyStatusRef.current = message;

    setCopiedState(ok ? "copied" : "failed");
    setCopyStatusText(message);

    copyTimerRef.current = setTimeout(() => {
      setCopiedState("idle");
      setCopyStatusText("");
    }, 2200);
  };

  return (
    <div
      ref={menuRef}
      role="dialog"
      aria-label="Globo de Perfil - Paso 0"
      className="absolute right-0 top-full mt-2 w-80 sm:w-[400px] z-50 rounded-2xl border border-cyan-500/40 bg-slate-900/95 shadow-2xl shadow-black/60 backdrop-blur-xl animate-in fade-in slide-in-from-top-2"
    >
      {/* Bubble Pointer */}
      <div className="absolute -top-2 right-6 h-4 w-4 rotate-45 border-l border-t border-cyan-500/40 bg-slate-900" />

      <div className="max-h-[82vh] overflow-y-auto p-4">
        {/* Header */}
        <div className="relative flex items-start gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 text-sm font-bold text-white shadow-md">
            {creatorProfile?.name ? creatorProfile.name.charAt(0).toUpperCase() : "C"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-white">
                {creatorProfile?.name || "Creador"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                Paso 0
              </span>
            </div>
            <p className="truncate text-xs text-slate-400 mt-0.5">
              {creatorProfile?.niche || "Configura tu nicho y contexto"}
            </p>
          </div>
        </div>

        {/* Mini Stats Grid */}
        <div className="grid grid-cols-2 gap-2 py-3 border-b border-slate-800">
          <button
            type="button"
            onClick={() => handleSelect("importar")}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-left hover:border-violet-500/40 transition"
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
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-left hover:border-amber-500/40 transition"
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
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-left hover:border-emerald-500/40 transition"
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
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-left hover:border-cyan-500/40 transition"
          >
            <div>
              <p className="text-[10px] text-slate-400">Redes y Webs</p>
              <p className="text-xs font-bold text-white">{accountsCount} cuentas</p>
            </div>
            <Globe className="h-4 w-4 text-cyan-400" aria-hidden="true" />
          </button>
        </div>

        {/* Dedicated HITL Security Key Section */}
        <form
          onSubmit={handleGeneratePublishToken}
          className="my-3 rounded-xl border border-rose-500/35 bg-gradient-to-br from-rose-950/35 via-slate-950/80 to-slate-950 p-3 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Lock className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
              <span>🔐 Clave de Seguridad para Publicar</span>
            </h3>
            <span className="rounded bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
              Nivel 3 HITL
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor={pinInputId}
                className="text-[11px] font-medium text-slate-300"
              >
                PIN del Creador (mín. 4 dígitos)
              </label>
              <span id={pinHintId} className="text-[10px] text-slate-500">
                Proyecto: {(selectedProjectId || "CR-001").slice(0, 8)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <KeyRound
                  className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-rose-400"
                  aria-hidden="true"
                />
                <input
                  id={pinInputId}
                  name="creator_security_pin"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={12}
                  value={creatorSecurityPin}
                  onChange={(e) => {
                    setCreatorSecurityPin(e.target.value);
                    if (pinError && e.target.value.trim().length >= 4) {
                      setPinError(null);
                    }
                  }}
                  aria-invalid={pinError ? "true" : undefined}
                  aria-describedby={pinError ? `${pinHintId} ${pinErrorId}` : pinHintId}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-8 pr-2.5 py-1.5 text-xs font-mono tracking-widest text-white focus:border-rose-400 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleGenerateRandomPin}
                className="inline-flex items-center gap-1 min-h-[30px] rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-rose-400/60 hover:text-white transition"
                title="Generar PIN aleatorio de 6 dígitos"
              >
                <Dices className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                <span>6 dígitos</span>
              </button>
            </div>
          </div>

          {pinError && (
            <p
              id={pinErrorId}
              role="alert"
              className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-2.5 py-1.5 text-[11px] text-rose-200"
            >
              {pinError}
            </p>
          )}

          <button
            type="submit"
            disabled={issuingToken}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-60"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {issuingToken ? "Generando clave..." : "Generar Clave de Publicación"}
            </span>
          </button>

          {activeHitlToken && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={tokenOutputId}
                  className="text-[10px] font-bold uppercase tracking-wide text-emerald-300"
                >
                  Clave generada ({tokenSource === "local" ? "Modo local" : "HMAC Nivel 3"})
                </label>
                <div className="relative flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    aria-label="Copiar clave de publicación"
                    className="inline-flex min-h-[26px] min-w-[26px] items-center gap-1 rounded border border-emerald-500/40 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 hover:border-emerald-400 hover:text-white transition"
                  >
                    {copiedState === "copied" ? (
                      <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3 w-3 text-emerald-300" aria-hidden="true" />
                    )}
                    <span>{copiedState === "copied" ? "Copiado" : "Copiar"}</span>
                  </button>
                  <span
                    role="status"
                    className={`text-[10px] font-semibold transition-opacity ${
                      copyStatusText
                        ? copiedState === "failed"
                          ? "opacity-100 text-rose-300"
                          : "opacity-100 text-emerald-300"
                        : "opacity-0 sr-only"
                    }`}
                  >
                    {copyStatusText}
                  </span>
                </div>
              </div>

              <input
                id={tokenOutputId}
                type="text"
                readOnly
                value={activeHitlToken}
                className="w-full rounded border border-emerald-500/30 bg-slate-950 px-2 py-1 text-[11px] font-mono text-emerald-200 focus:outline-none"
              />

              <div className="flex items-center justify-between gap-2 text-[10px] text-emerald-300">
                <span className="inline-flex items-center gap-1 font-medium">
                  <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>Lista y sincronizada para la pestaña Publicar.</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("publishing-hitl");
                    onClose();
                  }}
                  className="shrink-0 font-bold text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                >
                  Ir a Publicar
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Quick Navigation List */}
        <div className="pt-1 space-y-1.5">
          <button
            type="button"
            onClick={() => handleSelect("general")}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/80 transition"
          >
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 text-cyan-400" aria-hidden="true" />
              Editar Perfil e Identidad (Paso 0)
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => handleSelect("importar")}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/80 transition"
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
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/80 transition"
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
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/80 transition"
          >
            <span className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-amber-400" aria-hidden="true" />
              Carpeta Lead Magnets &amp; ManyChat
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </button>
        </div>

        {/* Primary CTA */}
        <div className="mt-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => handleSelect("general")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:opacity-95 transition"
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
