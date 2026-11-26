"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useEngineStore } from "@/store/useEngineStore";
import { apiClient } from "@/lib/api";
import { HUMAN_STATE_LABELS } from "@/lib/utils";

interface HITLApprovalDialogProps {
  onSuccessRefresh: () => Promise<void>;
}

export function HITLApprovalDialog({ onSuccessRefresh }: HITLApprovalDialogProps) {
  const { hitlModal, closeHitlModal, showToast, backendOnline } = useEngineStore();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [actor, setActor] = useState("Creador");
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
        setErrorMsg(
          "Backend sin conexión: la aprobación no se ha registrado. Conecta el backend y vuelve a intentarlo."
        );
        return;
      }

      const issued = await apiClient.issueHitlToken({
        project_id: hitlModal.projectId,
        tier: hitlModal.tier,
        action: hitlModal.action,
        actor,
      });

      await apiClient.transitionProject(hitlModal.projectId, {
        target_state: hitlModal.targetState,
        agent_or_user: actor,
        hitl_token: issued.token,
        reason: `Autorización de seguridad de nivel ${hitlModal.tier} confirmada por el usuario`,
      });

      await onSuccessRefresh();
      showToast(
        "success",
        `Autorización verificada con éxito. El video avanzó a la siguiente fase.`
      );
      dialogRef.current?.close();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al procesar la autorización");
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
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                {hitlModal.tier === 3
                  ? "Paso Crítico: Publicación Definitiva"
                  : "Revisión y Aprobación de Guión"}
              </span>
              <h2 id={titleId} className="text-lg font-bold text-white mt-0.5">
                Confirmación de Seguridad Requerida
              </h2>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">{hitlModal.description}</p>

          <div className="rounded-lg border border-cyan-500/20 bg-slate-950 p-3 text-xs text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Video:</span>
              <span className="text-white font-semibold">{hitlModal.assetCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Siguiente Fase:</span>
              <span className="text-cyan-300 font-semibold">
                {HUMAN_STATE_LABELS[hitlModal.targetState] ?? hitlModal.targetState}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              Nombre de quien autoriza
              <input
                type="text"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                required
              />
            </label>
          </div>

          {hitlModal.tier === 3 && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/60 bg-rose-950/60 px-3 py-2.5 text-xs text-rose-100 leading-relaxed"
            >
              Vas a publicar {hitlModal.assetCode} en tus redes ahora mismo. Se verá en tu perfil y no se puede deshacer desde aquí.
            </div>
          )}

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
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm ${
                hitlModal.tier === 3
                  ? "bg-rose-600 hover:bg-rose-500 text-white"
                  : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              {submitting
                ? "Confirmando..."
                : hitlModal.tier === 3
                ? "Sí, publicar ahora"
                : "Confirmar y Continuar"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
