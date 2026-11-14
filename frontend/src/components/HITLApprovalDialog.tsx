"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEngineStore } from "@/store/useEngineStore";
import { apiClient } from "@/lib/api";

interface HITLApprovalDialogProps {
  onSuccessRefresh: () => Promise<void>;
}

export function HITLApprovalDialog({ onSuccessRefresh }: HITLApprovalDialogProps) {
  const { hitlModal, closeHitlModal, showToast, backendOnline } = useEngineStore();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [actor, setActor] = useState("creator");
  const [twoFactorCode, setTwoFactorCode] = useState("884210");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (hitlModal?.open) {
      setErrorMsg(null);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [hitlModal]);

  // Native close listener resetting returnValue per modern-web-guidance: dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = "";
      closeHitlModal();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [closeHitlModal]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hitlModal) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      if (!backendOnline) {
        showToast(
          "info",
          `Modo offline: token simulado para ${hitlModal.assetCode} -> ${hitlModal.targetState}`
        );
        dialogRef.current?.close();
        return;
      }

      const issued = await apiClient.issueHitlToken({
        project_id: hitlModal.projectId,
        tier: hitlModal.tier,
        action: hitlModal.action,
        actor,
        two_factor_code: hitlModal.tier === 3 ? twoFactorCode : undefined,
      });

      await apiClient.transitionProject(hitlModal.projectId, {
        target_state: hitlModal.targetState,
        agent_or_user: actor,
        hitl_token: issued.token,
        reason: `HITL Tier ${hitlModal.tier} signed via web governance console`,
      });

      await onSuccessRefresh();
      showToast(
        "success",
        `Firma HMAC verificada (${issued.token.slice(0, 28)}...). Transición completada.`
      );
      dialogRef.current?.close();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error verificando token HITL");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId}>
      {hitlModal && (
        <form onSubmit={handleConfirm} className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-lg border ${
                hitlModal.tier === 3
                  ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                  : "bg-amber-500/15 border-amber-500/40 text-amber-300"
              }`}
            >
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Gobernanza HITL · Tier {hitlModal.tier}
              </span>
              <h2 id={titleId} className="text-lg font-semibold text-white mt-0.5">
                Confirmación Criptográfica Requerida ({hitlModal.assetCode})
              </h2>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">{hitlModal.description}</p>

          <div className="grid gap-3 bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">Destino FSM:</span>
              <span className="text-cyan-300">{hitlModal.targetState}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Acción Auditada:</span>
              <span className="text-slate-200">{hitlModal.action}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Formato Firma:</span>
              <span className="text-emerald-300">HITL_AUTH_CREATOR_OK_[HMAC24]</span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-300">
              Identificador del Creador / Aprobador
              <input
                type="text"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                required
              />
            </label>

            {hitlModal.tier === 3 && (
              <label className="block text-xs font-medium text-slate-300">
                Código Doble Factor (2FA Tier 3 Irreversible)
                <div className="relative mt-1">
                  <KeyRound className="w-4 h-4 text-rose-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    minLength={4}
                    className="w-full rounded-lg bg-slate-950 border border-rose-500/40 pl-9 pr-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-rose-400"
                    required
                  />
                </div>
              </label>
            )}
          </div>

          {errorMsg && (
            <div className="rounded-lg bg-rose-950/70 border border-rose-500/50 px-3 py-2 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              autoFocus
              onClick={() => dialogRef.current?.close("cancel")}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                hitlModal.tier === 3
                  ? "bg-rose-600 hover:bg-rose-500 text-white"
                  : "bg-amber-500 hover:bg-amber-400 text-slate-950"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              {submitting ? "Firmando HMAC..." : `Firmar Token Tier ${hitlModal.tier}`}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
