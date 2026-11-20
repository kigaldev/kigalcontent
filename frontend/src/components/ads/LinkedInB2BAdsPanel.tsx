"use client";

import React, { useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  Check,
  Copy,
  FileSpreadsheet,
  Globe,
  Image as ImageIcon,
  Layers,
  MapPin,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  Target,
  UserCheck,
  Users,
} from "lucide-react";
import { AstryxBadge, AstryxButton } from "@/components/ui/AstryxPrimitives";
import { copyPreservingLineBreaks } from "@/lib/unicodeFormat";
import { useEngineStore } from "@/store/useEngineStore";
import type { LinkedInAdsSpec } from "@/types/engine";

export interface LinkedInB2BAdsPanelProps {
  spec: LinkedInAdsSpec;
  topic: string;
  onTopicSuggestion?: () => void;
}

function charCounterTone(len: number, max: number): string {
  if (len <= max) return "text-emerald-400";
  return "text-rose-400";
}

export function LinkedInB2BAdsPanel({
  spec,
  topic,
  onTopicSuggestion,
}: LinkedInB2BAdsPanelProps) {
  const showToast = useEngineStore((s) => s.showToast);
  const setActiveTab = useEngineStore((s) => s.setActiveTab);

  const [draft, setDraft] = useState<LinkedInAdsSpec>(spec);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [previewThoughtLeader, setPreviewThoughtLeader] = useState(false);

  useEffect(() => {
    setDraft(spec);
  }, [spec]);

  const handleCopyBlock = async (key: string, text: string, label: string) => {
    const ok = await copyPreservingLineBreaks(text);
    if (ok) {
      setCopiedKey(key);
      showToast("success", `${label} copiado al portapapeles.`);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2200);
    } else {
      showToast("error", "No se pudo copiar al portapapeles.");
    }
  };

  const handleSendThoughtLeaderToPlanner = async () => {
    const tl = draft.thought_leader_ad;
    const combinedPost = [tl.intro_hook, tl.full_post_body, tl.cta_soft]
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n\n");

    const ok = await copyPreservingLineBreaks(combinedPost);
    if (ok) {
      setCopiedKey("tl-planner");
      setTimeout(() => {
        setCopiedKey((prev) => (prev === "tl-planner" ? null : prev));
      }, 2500);
    }

    showToast(
      "success",
      "Copy Thought Leader copiado. Pega y programa tu post orgánico en Planificador & HITL antes de patrocinarlo."
    );
    setActiveTab("publishing-hitl");
  };

  const tl = draft.thought_leader_ad;
  const single = draft.single_image_ad;
  const doc = draft.document_carousel_ad;
  const conv = draft.conversation_ad;
  const targeting = draft.targeting_blueprint;

  const leadGenFields =
    doc.lead_gen_form_fields && doc.lead_gen_form_fields.length > 0
      ? doc.lead_gen_form_fields
      : ["Nombre", "Email corporativo", "Empresa", "Cargo"];

  const tlCombinedCopy = [tl.intro_hook, tl.full_post_body, tl.cta_soft]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n");

  const singleCombinedCopy = `【Sponsored Content · Single Image Ad】\n\nIntro Text:\n${single.intro_text}\n\nTitular: ${single.headline}\nDescripción: ${single.description}\nCTA: ${single.cta_label}\n\nBrief Creativo Visual:\n${single.visual_brief}`;

  const docCombinedCopy = `【Document Ad · Carrusel PDF + Lead Gen Form】\n\nIntro Text:\n${doc.intro_text}\n\nTitular: ${doc.headline}\n\nEstructura 5 Slides:\n${doc.slides_outline
    .map((slide, idx) => `${idx + 1}. ${slide}`)
    .join("\n")}\n\nCampos Lead Gen Form: ${leadGenFields.join(", ")}\nMensaje Thank-You: ${doc.thank_you_message}`;

  const convCombinedCopy = `【Conversation Ad · InMail B2B Directo】\n\nAsunto: ${conv.subject}\n\nMensaje de Apertura:\n${conv.opening_message}\n\nBotones Quick-Reply:\n${conv.cta_buttons
    .map((btn, i) => `• Opción ${i + 1}: ${btn}`)
    .join("\n")}`;

  const targetingCombinedCopy = `【Targeting Blueprint B2B · LinkedIn Campaign Manager】\n\nCargos (Job Titles): ${targeting.job_titles.join(", ")}\nNiveles (Seniorities): ${targeting.seniorities.join(", ")}\nTamaño de Empresa: ${targeting.company_sizes.join(", ")}\nSectores (Industries): ${targeting.industries.join(", ")}\nGeografías: ${targeting.geographies.join(", ")}\nPresupuesto Diario Recomendado: ${targeting.recommended_daily_budget_eur}`;

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Studio B2B Header */}
      <div className="rounded-xl border border-[var(--kc-border-specular)] bg-[var(--kc-surface)] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Briefcase className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">
              Suite Completa LinkedIn Ads B2B &amp; Thought Leader
            </h3>
            <AstryxBadge label="B2B Campaign Manager" variant="blue" />
            {topic && <AstryxBadge label={topic} variant="cyan" />}
          </div>
          <p className="text-xs text-slate-400">
            Edita directamente el copy de cada formato nativo de LinkedIn Ads, vigila los límites de caracteres y copia o envía tu Thought Leader al Planificador.
          </p>
        </div>

        {onTopicSuggestion && (
          <AstryxButton
            type="button"
            variant="secondary"
            size="sm"
            label="Inspirarse en LinkedIn Ads Library"
            icon={<Search className="w-3.5 h-3.5" />}
            onClick={onTopicSuggestion}
          />
        )}
      </div>

      {/* High-Contrast 2-Column Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* 1. Thought Leader Ad */}
        <article className="rounded-xl border border-[var(--kc-border-specular)] bg-[var(--kc-surface)] p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-lg shadow-black/25">
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--kc-border)] pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-sm font-bold text-white">
                    1. Thought Leader Ad (Patrocinar Perfil Personal)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400">
                  Formato orgánico patrocinado desde perfil fundador para máximo CTR y confianza B2B.
                </p>
              </div>
              <AstryxBadge
                label={tl.estimated_ctr_benchmark || "1.5% – 2.8% CTR"}
                variant="cyan"
              />
            </div>

            {/* Hook (150 chars fold) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <label
                  htmlFor="li-tl-hook"
                  className="font-semibold text-slate-200"
                >
                  Gancho Inicial (antes del pliegue &ldquo;...ver más&rdquo;)
                </label>
                <span
                  className={`font-mono font-bold ${charCounterTone(
                    tl.intro_hook.length,
                    150
                  )}`}
                >
                  {tl.intro_hook.length} / 150
                </span>
              </div>
              <input
                id="li-tl-hook"
                type="text"
                value={tl.intro_hook}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    thought_leader_ad: {
                      ...prev.thought_leader_ad,
                      intro_hook: e.target.value,
                    },
                  }))
                }
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Organic Body (Editable or Preview) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <label
                  htmlFor="li-tl-body"
                  className="font-semibold text-slate-200"
                >
                  Cuerpo del Post Orgánico Patrocinado
                </label>
                <button
                  type="button"
                  onClick={() => setPreviewThoughtLeader((p) => !p)}
                  className="text-cyan-300 hover:text-cyan-200 font-semibold"
                >
                  {previewThoughtLeader ? "Modo Edición" : "Vista Previa Feed"}
                </button>
              </div>

              {previewThoughtLeader ? (
                <div className="rounded-lg border border-slate-800 bg-[#020306] p-3.5 text-xs text-slate-100 whitespace-pre-line leading-relaxed min-h-[172px]">
                  <p className="font-bold text-white mb-2">{tl.intro_hook}</p>
                  <p>{tl.full_post_body}</p>
                  {tl.cta_soft && (
                    <p className="mt-3 text-cyan-300 font-semibold">
                      {tl.cta_soft}
                    </p>
                  )}
                </div>
              ) : (
                <textarea
                  id="li-tl-body"
                  rows={7}
                  value={tl.full_post_body}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      thought_leader_ad: {
                        ...prev.thought_leader_ad,
                        full_post_body: e.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-cyan-400"
                />
              )}
            </div>

            {/* Soft CTA */}
            <div className="space-y-1">
              <label
                htmlFor="li-tl-cta"
                className="block text-[11px] font-semibold text-slate-200"
              >
                CTA Suave (Zero-Link en cuerpo)
              </label>
              <input
                id="li-tl-cta"
                type="text"
                value={tl.cta_soft}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    thought_leader_ad: {
                      ...prev.thought_leader_ad,
                      cta_soft: e.target.value,
                    },
                  }))
                }
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-1.5 text-xs text-emerald-300 focus:outline-none focus:border-emerald-400"
              />
            </div>

            {/* Audience Note */}
            <div className="rounded-lg border border-cyan-500/25 bg-cyan-950/20 px-3 py-2 text-[11px] text-cyan-200 flex items-start gap-2">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <span>{tl.target_audience_note}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--kc-border)] flex flex-wrap items-center justify-between gap-2">
            <AstryxButton
              type="button"
              variant="primary"
              size="sm"
              label="Enviar copy a Planificador"
              icon={<Send className="w-3.5 h-3.5" />}
              onClick={() => void handleSendThoughtLeaderToPlanner()}
            />

            <AstryxButton
              type="button"
              variant="secondary"
              size="sm"
              label={
                copiedKey === "tl-copy" ? "Copiado" : "Copiar Thought Leader"
              }
              icon={
                copiedKey === "tl-copy" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )
              }
              onClick={() =>
                void handleCopyBlock(
                  "tl-copy",
                  tlCombinedCopy,
                  "Thought Leader Ad"
                )
              }
            />
          </div>
        </article>

        {/* 2. Sponsored Content (Single Image Ad) */}
        <article className="rounded-xl border border-[var(--kc-border-specular)] bg-[var(--kc-surface)] p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-lg shadow-black/25">
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--kc-border)] pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-sky-400" />
                  <h4 className="text-sm font-bold text-white">
                    2. Sponsored Content (Single Image Ad)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400">
                  Anuncio estándar en el feed de LinkedIn con imagen única de alto impacto B2B.
                </p>
              </div>
              <AstryxBadge
                label={single.cta_label || "Más información"}
                variant="green"
              />
            </div>

            {/* Intro Text (/600) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <label
                  htmlFor="li-single-intro"
                  className="font-semibold text-slate-200"
                >
                  Texto Introductorio (Intro Text)
                </label>
                <span
                  className={`font-mono font-bold ${charCounterTone(
                    single.intro_text.length,
                    600
                  )}`}
                >
                  {single.intro_text.length} / 600
                </span>
              </div>
              <textarea
                id="li-single-intro"
                rows={4}
                value={single.intro_text}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    single_image_ad: {
                      ...prev.single_image_ad,
                      intro_text: e.target.value,
                    },
                  }))
                }
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Headline (/70) & Description (/100) */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <label
                    htmlFor="li-single-headline"
                    className="font-semibold text-slate-200"
                  >
                    Titular (Headline)
                  </label>
                  <span
                    className={`font-mono font-bold ${charCounterTone(
                      single.headline.length,
                      70
                    )}`}
                  >
                    {single.headline.length} / 70
                  </span>
                </div>
                <input
                  id="li-single-headline"
                  type="text"
                  value={single.headline}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      single_image_ad: {
                        ...prev.single_image_ad,
                        headline: e.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <label
                    htmlFor="li-single-cta"
                    className="font-semibold text-slate-200"
                  >
                    Botón CTA (Campaign Manager)
                  </label>
                </div>
                <input
                  id="li-single-cta"
                  type="text"
                  value={single.cta_label}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      single_image_ad: {
                        ...prev.single_image_ad,
                        cta_label: e.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-1.5 text-xs font-semibold text-emerald-300 focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <label
                  htmlFor="li-single-desc"
                  className="font-semibold text-slate-200"
                >
                  Descripción (bajo titular)
                </label>
                <span
                  className={`font-mono font-bold ${charCounterTone(
                    single.description.length,
                    100
                  )}`}
                >
                  {single.description.length} / 100
                </span>
              </div>
              <input
                id="li-single-desc"
                type="text"
                value={single.description}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    single_image_ad: {
                      ...prev.single_image_ad,
                      description: e.target.value,
                    },
                  }))
                }
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Visual Creative Brief */}
            <div className="space-y-1">
              <label
                htmlFor="li-single-brief"
                className="block text-[11px] font-semibold text-amber-300"
              >
                Brief Creativo Visual (1200×627 o 1080×1080)
              </label>
              <textarea
                id="li-single-brief"
                rows={3}
                value={single.visual_brief}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    single_image_ad: {
                      ...prev.single_image_ad,
                      visual_brief: e.target.value,
                    },
                  }))
                }
                className="w-full rounded-lg bg-[#020306] border border-amber-500/30 px-3 py-2 text-xs text-amber-100 leading-relaxed focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--kc-border)] flex items-center justify-end">
            <AstryxButton
              type="button"
              variant="secondary"
              size="sm"
              label={
                copiedKey === "single-copy"
                  ? "Copiado"
                  : "Copiar Sponsored Content"
              }
              icon={
                copiedKey === "single-copy" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )
              }
              onClick={() =>
                void handleCopyBlock(
                  "single-copy",
                  singleCombinedCopy,
                  "Sponsored Content (Single Image)"
                )
              }
            />
          </div>
        </article>

        {/* 3. Document Ad (Carrusel PDF + Lead Gen Form) */}
        <article className="rounded-xl border border-[var(--kc-border-specular)] bg-[var(--kc-surface)] p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-lg shadow-black/25">
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--kc-border)] pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-bold text-white">
                    3. Document Ad (Carrusel PDF + Lead Gen Form)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400">
                  Carrusel deslizable nativo conectado a formulario instantáneo de LinkedIn sin fricción.
                </p>
              </div>
              <AstryxBadge label="PDF 5 Slides + Form" variant="green" />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="li-doc-headline"
                  className="block text-[11px] font-semibold text-slate-200"
                >
                  Titular del Documento PDF
                </label>
                <input
                  id="li-doc-headline"
                  type="text"
                  value={doc.headline}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      document_carousel_ad: {
                        ...prev.document_carousel_ad,
                        headline: e.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <span className="block text-[11px] font-semibold text-slate-200">
                  Campos Lead Gen Form
                </span>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {leadGenFields.map((field) => (
                    <AstryxBadge key={field} label={field} variant="neutral" />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="li-doc-intro"
                className="block text-[11px] font-semibold text-slate-200"
              >
                Intro Text del Document Ad
              </label>
              <textarea
                id="li-doc-intro"
                rows={2}
                value={doc.intro_text}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    document_carousel_ad: {
                      ...prev.document_carousel_ad,
                      intro_text: e.target.value,
                    },
                  }))
                }
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* 5 Slides Outline */}
            <div className="space-y-1.5">
              <span className="block text-[11px] font-semibold text-cyan-300">
                Guión de 5 Slides del Carrusel PDF
              </span>
              <div className="space-y-1.5">
                {doc.slides_outline.slice(0, 5).map((slide, sIdx) => (
                  <div
                    key={`doc-slide-${sIdx}`}
                    className="flex items-center gap-2"
                  >
                    <span className="h-6 w-6 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-[11px] font-mono font-bold text-cyan-300 flex items-center justify-center shrink-0">
                      {sIdx + 1}
                    </span>
                    <input
                      type="text"
                      aria-label={`Slide ${sIdx + 1}`}
                      value={slide}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          document_carousel_ad: {
                            ...prev.document_carousel_ad,
                            slides_outline: prev.document_carousel_ad.slides_outline.map(
                              (item, i) => (i === sIdx ? e.target.value : item)
                            ),
                          },
                        }))
                      }
                      className="flex-1 rounded-lg bg-[#020306] border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Thank-you message */}
            <div className="space-y-1">
              <label
                htmlFor="li-doc-thanks"
                className="block text-[11px] font-semibold text-slate-200"
              >
                Mensaje de Confirmación (Thank-You Screen)
              </label>
              <textarea
                id="li-doc-thanks"
                rows={2}
                value={doc.thank_you_message}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    document_carousel_ad: {
                      ...prev.document_carousel_ad,
                      thank_you_message: e.target.value,
                    },
                  }))
                }
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-1.5 text-xs text-emerald-200 focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--kc-border)] flex items-center justify-end">
            <AstryxButton
              type="button"
              variant="secondary"
              size="sm"
              label={
                copiedKey === "doc-copy" ? "Copiado" : "Copiar Document Ad"
              }
              icon={
                copiedKey === "doc-copy" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )
              }
              onClick={() =>
                void handleCopyBlock(
                  "doc-copy",
                  docCombinedCopy,
                  "Document Ad (PDF + Lead Gen)"
                )
              }
            />
          </div>
        </article>

        {/* 4. Conversation Ad (InMail B2B Directo) */}
        <article className="rounded-xl border border-[var(--kc-border-specular)] bg-[var(--kc-surface)] p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-lg shadow-black/25">
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--kc-border)] pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  <h4 className="text-sm font-bold text-white">
                    4. Conversation Ad (InMail B2B Directo)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400">
                  Mensajería directa patrocinada en bandeja de entrada con respuestas rápidas interactivas.
                </p>
              </div>
              <AstryxBadge label="Sponsored Messaging" variant="purple" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <label
                  htmlFor="li-conv-subject"
                  className="font-semibold text-slate-200"
                >
                  Asunto (Subject Line)
                </label>
                <span
                  className={`font-mono font-bold ${charCounterTone(
                    conv.subject.length,
                    60
                  )}`}
                >
                  {conv.subject.length} / 60
                </span>
              </div>
              <input
                id="li-conv-subject"
                type="text"
                value={conv.subject}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    conversation_ad: {
                      ...prev.conversation_ad,
                      subject: e.target.value,
                    },
                  }))
                }
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="li-conv-opening"
                className="block text-[11px] font-semibold text-slate-200"
              >
                Mensaje de Apertura Personalizado
              </label>
              <textarea
                id="li-conv-opening"
                rows={7}
                value={conv.opening_message}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    conversation_ad: {
                      ...prev.conversation_ad,
                      opening_message: e.target.value,
                    },
                  }))
                }
                className="w-full rounded-lg bg-[#020306] border border-slate-700 px-3 py-2 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* CTA Quick-Reply Chips */}
            <div className="space-y-2">
              <span className="block text-[11px] font-semibold text-slate-200">
                Botones Quick-Reply (Opciones de Conversación)
              </span>
              <div className="flex flex-wrap gap-2">
                {conv.cta_buttons.map((btnLabel, bIdx) => (
                  <AstryxBadge
                    key={`conv-chip-${bIdx}`}
                    label={btnLabel}
                    variant={bIdx === 0 ? "cyan" : "neutral"}
                  />
                ))}
              </div>
              <div className="grid sm:grid-cols-3 gap-2 pt-1">
                {conv.cta_buttons.map((btnLabel, bIdx) => (
                  <input
                    key={`conv-btn-edit-${bIdx}`}
                    type="text"
                    aria-label={`Botón quick-reply ${bIdx + 1}`}
                    value={btnLabel}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        conversation_ad: {
                          ...prev.conversation_ad,
                          cta_buttons: prev.conversation_ad.cta_buttons.map(
                            (item, i) => (i === bIdx ? e.target.value : item)
                          ),
                        },
                      }))
                    }
                    className="rounded-lg bg-[#020306] border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-400"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--kc-border)] flex items-center justify-end">
            <AstryxButton
              type="button"
              variant="secondary"
              size="sm"
              label={
                copiedKey === "conv-copy" ? "Copiado" : "Copiar Conversation Ad"
              }
              icon={
                copiedKey === "conv-copy" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )
              }
              onClick={() =>
                void handleCopyBlock(
                  "conv-copy",
                  convCombinedCopy,
                  "Conversation Ad (InMail)"
                )
              }
            />
          </div>
        </article>

        {/* 5. Targeting Blueprint B2B (Campaign Manager) */}
        <article className="xl:col-span-2 rounded-xl border border-[var(--kc-border-specular)] bg-[var(--kc-surface)] p-4 sm:p-5 space-y-4 shadow-lg shadow-black/25">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--kc-border)] pb-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">
                  5. Targeting Blueprint B2B (LinkedIn Campaign Manager)
                </h4>
                <AstryxBadge
                  label={`Presupuesto: ${targeting.recommended_daily_budget_eur}`}
                  variant="green"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Segmentación recomendada por cargo, seniority, tamaño de compañía, industria y geografía para minimizar CPL B2B.
              </p>
            </div>

            <AstryxButton
              type="button"
              variant="primary"
              size="sm"
              label={
                copiedKey === "targeting-copy"
                  ? "Copiado"
                  : "Copiar Targeting Blueprint"
              }
              icon={
                copiedKey === "targeting-copy" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )
              }
              onClick={() =>
                void handleCopyBlock(
                  "targeting-copy",
                  targetingCombinedCopy,
                  "Targeting Blueprint B2B"
                )
              }
            />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-lg border border-slate-800 bg-[#020306] p-3 space-y-2">
              <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                Cargos (Job Titles)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {targeting.job_titles.map((jt) => (
                  <AstryxBadge key={jt} label={jt} variant="cyan" />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#020306] p-3 space-y-2">
              <span className="text-[11px] font-bold text-blue-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Seniorities
              </span>
              <div className="flex flex-wrap gap-1.5">
                {targeting.seniorities.map((sr) => (
                  <AstryxBadge key={sr} label={sr} variant="blue" />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#020306] p-3 space-y-2">
              <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Tamaño Empresa
              </span>
              <div className="flex flex-wrap gap-1.5">
                {targeting.company_sizes.map((cs) => (
                  <AstryxBadge key={cs} label={cs} variant="green" />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#020306] p-3 space-y-2">
              <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Sectores (Industries)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {targeting.industries.map((ind) => (
                  <AstryxBadge key={ind} label={ind} variant="purple" />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#020306] p-3 space-y-2">
              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Geografías &amp; Presupuesto
              </span>
              <div className="flex flex-wrap gap-1.5">
                {targeting.geographies.map((geo) => (
                  <span
                    key={geo}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-mono text-slate-200"
                  >
                    <Globe className="w-2.5 h-2.5 text-amber-300" />
                    {geo}
                  </span>
                ))}
              </div>
              <p className="text-[11px] font-mono font-bold text-emerald-300 pt-1 border-t border-slate-800">
                {targeting.recommended_daily_budget_eur}
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
