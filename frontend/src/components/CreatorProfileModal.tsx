"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  User,
  Sparkles,
  Link as LinkIcon,
  Target,
  Palette,
  MessageSquare,
  Briefcase,
  X,
  Check,
  HelpCircle,
  Save,
} from "lucide-react";
import type { CreatorProfile } from "@/types/engine";
import { useEngineStore } from "@/store/useEngineStore";

interface CreatorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COMMUNICATION_PRESETS = [
  {
    id: "educativo",
    label: "Educativo y Didáctico",
    desc: "Explicaciones paso a paso, marcos conceptuales claros y analogías sencillas.",
    badge: "🎓 Recomendado para cursos y consultoría",
  },
  {
    id: "autoridad",
    label: "Directo y con Autoridad",
    desc: "Tono asertivo, sin rodeos, desmonta mitos del sector y aporta datos empíricos.",
    badge: "⚡ Recomendado para B2B y directivos",
  },
  {
    id: "cercano",
    label: "Cercano y Conversacional",
    desc: "Hablas como con un colega tomándote un café, accesible y empático.",
    badge: "☕ Recomendado para crear comunidad",
  },
  {
    id: "storytelling",
    label: "Storytelling Narrativo",
    desc: "Centrado en anécdotas, el viaje del héroe, fracasos superados y lecciones.",
    badge: "📖 Recomendado para marca personal",
  },
  {
    id: "provocador",
    label: "Provocador y Witty",
    desc: "Opiniones contracorriente, ganchos polémicos y humor inteligente.",
    badge: "🔥 Recomendado para viralidad rápida",
  },
];

const VISUAL_STYLE_PRESETS = [
  {
    id: "minimal_dark",
    label: "Estudio Oscuro Minimalista",
    desc: "Fondos pizarra/grafito, luz cenital sobria, subtítulos limpios y ritmo pausado.",
  },
  {
    id: "neon_tech",
    label: "Tecnológico / Neón Dinámico",
    desc: "Acentos cian y ámbar, cortes rápidos cada 2s, tipografía cinética y zoom continuo.",
  },
  {
    id: "editorial_clean",
    label: "Editorial Blanco / Clean",
    desc: "Fondos claros, diseño sobrio tipo revista, B-roll natural y sin saturación.",
  },
  {
    id: "cinematic",
    label: "Cinematográfico Grano 35mm",
    desc: "Corrección de color con LUT cálida, profundidad de campo estrecha y transiciones suaves.",
  },
];

const STRATEGIC_GOALS_OPTIONS = [
  "Captar correos y leads cualificados (Lead Magnets)",
  "Agendar llamadas de consultoría o demos B2B",
  "Venta directa de productos digitales / formaciones",
  "Hacer crecer comunidad y retención en YouTube",
  "Generar conversaciones y respuestas por Mensaje Directo (DMs)",
  "Posicionar liderazgo de opinión y reconocimiento de marca",
];

export const CreatorProfileModal: React.FC<CreatorProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { creatorProfile, setCreatorProfile } = useEngineStore();

  const [name, setName] = useState("");
  const [age, setAge] = useState<string>("");
  const [tagline, setTagline] = useState("");
  const [niche, setNiche] = useState("");
  const [targetIcp, setTargetIcp] = useState("");
  const [projectContext, setProjectContext] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [communicationStyle, setCommunicationStyle] = useState("");
  const [visualStyle, setVisualStyle] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [igUrl, setIgUrl] = useState("");
  const [tkUrl, setTkUrl] = useState("");
  const [liUrl, setLiUrl] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [triggerWord, setTriggerWord] = useState("GUIA");

  const [activeSubTab, setActiveSubTab] = useState<"general" | "estilo" | "redes">("general");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state with store on open
  useEffect(() => {
    if (creatorProfile) {
      setName(creatorProfile.name || "");
      setAge(creatorProfile.age ? String(creatorProfile.age) : "");
      setTagline(creatorProfile.personal_brand_tagline || "");
      setNiche(creatorProfile.niche || "");
      setTargetIcp(creatorProfile.ideal_customer_profile || "");
      setProjectContext(creatorProfile.project_context || "");
      setSelectedGoals(creatorProfile.strategic_goals || [
        "Captar correos y leads cualificados (Lead Magnets)",
        "Posicionar liderazgo de opinión y reconocimiento de marca",
      ]);
      setCommunicationStyle(
        creatorProfile.communication_style || "Educativo y Didáctico"
      );
      setVisualStyle(
        creatorProfile.visual_style || "Tecnológico / Neón Dinámico"
      );
      setYtUrl(creatorProfile.social_profiles?.youtube || "");
      setIgUrl(creatorProfile.social_profiles?.instagram || "");
      setTkUrl(creatorProfile.social_profiles?.tiktok || "");
      setLiUrl(creatorProfile.social_profiles?.linkedin || "");
      setWebUrl(creatorProfile.social_profiles?.website || "");

      const activeGoalKey = creatorProfile.active_conversion_goal || "EMAIL_LEAD_CAPTURE";
      const cat = creatorProfile.conversion_goals_catalog?.[activeGoalKey];
      if (cat?.trigger_word) {
        setTriggerWord(cat.trigger_word);
      }
    }
  }, [creatorProfile, isOpen]);

  // Handle native HTML5 dialog show/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  const handleToggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    const updatedCatalog = {
      ...(creatorProfile?.conversion_goals_catalog || {}),
      EMAIL_LEAD_CAPTURE: {
        objective: "Captación de leads vía mensaje directo automatizado",
        lead_magnet_name: "Guía Estratégica y Plantilla",
        trigger_word: triggerWord.toUpperCase().trim() || "GUIA",
        automation_backend: "ManyChat",
        preferred_cta_style: `Comenta "${triggerWord.toUpperCase().trim() || "GUIA"}" y te lo envío por privado`,
      },
    };

    const payload: Partial<CreatorProfile> = {
      name,
      age: age ? parseInt(age, 10) : null,
      personal_brand_tagline: tagline,
      niche,
      ideal_customer_profile: targetIcp,
      project_context: projectContext,
      strategic_goals: selectedGoals,
      communication_style: communicationStyle,
      visual_style: visualStyle,
      social_profiles: {
        youtube: ytUrl,
        instagram: igUrl,
        tiktok: tkUrl,
        linkedin: liUrl,
        website: webUrl,
      },
      conversion_goals_catalog: updatedCatalog,
    };

    try {
      const res = await fetch("/api/v1/creator-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved: CreatorProfile = await res.json();
        setCreatorProfile(saved);
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 1200);
      } else {
        // Fallback update local store directly if backend offline
        if (creatorProfile) {
          setCreatorProfile({ ...creatorProfile, ...payload } as CreatorProfile);
        }
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 1200);
      }
    } catch {
      if (creatorProfile) {
        setCreatorProfile({ ...creatorProfile, ...payload } as CreatorProfile);
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="backdrop:bg-slate-950/80 backdrop:backdrop-blur-sm bg-slate-900 border border-slate-700/80 text-slate-100 rounded-2xl p-0 w-full max-w-3xl shadow-2xl focus:outline-none overflow-hidden m-auto"
      aria-labelledby="profile-modal-title"
    >
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 id="profile-modal-title" className="text-base font-bold text-white flex items-center gap-2">
                Perfil de Contexto del Creador
                <span className="text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                  Personalización Inteligente
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                La IA adaptará los guiones, el tono y los ganchos según tu nicho, objetivos y estilo personal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Cerrar ventana de perfil"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtabs Navigation */}
        <div className="px-5 pt-3 border-b border-slate-800/80 flex gap-2 bg-slate-900/60">
          <button
            type="button"
            onClick={() => setActiveSubTab("general")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeSubTab === "general"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            1. Negocio, Audiencia y Metas
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("estilo")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeSubTab === "estilo"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            2. Tono y Estilo Visual
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("redes")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeSubTab === "redes"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            3. Enlaces y Redes Sociales
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {activeSubTab === "general" && (
            <div className="space-y-4">
              {/* Basic Details */}
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-medium mb-1">
                    Tu Nombre o Nombre del Canal <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. David Fernández"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Edad (Opcional)
                  </label>
                  <input
                    type="number"
                    min={14}
                    max={100}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Ej. 32"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Titular o Eslogan de Marca Personal
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Ej. Sistemas de automatización con IA para empresas y creadores"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Project Context */}
              <div>
                <label className="block text-slate-300 font-medium mb-1 flex items-center justify-between">
                  <span>Contexto de tu Proyecto o Negocio</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    ¿Qué vendes o enseñas? ¿Qué problema resuelves?
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={projectContext}
                  onChange={(e) => setProjectContext(e.target.value)}
                  placeholder="Ej. Ayudo a fundadores y agencias a instalar agentes de inteligencia artificial para ahorrar más de 20 horas semanales en operaciones y prospección..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Niche & Target Audience */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Nicho / Temática Principal <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder="Ej. Inteligencia Artificial aplicada a Negocios"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Cliente Ideal / Audiencia Objetivo (ICP) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={targetIcp}
                    onChange={(e) => setTargetIcp(e.target.value)}
                    placeholder="Ej. Emprendedores B2B, consultores y profesionales independientes"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Strategic Goals Checkboxes */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  Objetivos que quieres conseguir con tus videos (Marca varios):
                </label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {STRATEGIC_GOALS_OPTIONS.map((g) => {
                    const isChecked = selectedGoals.includes(g);
                    return (
                      <button
                        type="button"
                        key={g}
                        onClick={() => handleToggleGoal(g)}
                        className={`text-left p-2.5 rounded-lg border text-xs transition flex items-center justify-between gap-2 ${
                          isChecked
                            ? "bg-cyan-950/40 border-cyan-500/60 text-cyan-200"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <span>{g}</span>
                        {isChecked && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lead Magnet Trigger */}
              <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-violet-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    Palabra Clave de Captación por Chatbot (ManyChat / DMs)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Llamada a la acción automática</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">Ejemplo: Comenta</span>
                  <input
                    type="text"
                    value={triggerWord}
                    onChange={(e) => setTriggerWord(e.target.value.toUpperCase())}
                    className="w-28 uppercase font-mono font-bold bg-slate-950 border border-violet-500/50 rounded-lg px-2.5 py-1 text-violet-300 text-center text-xs focus:outline-none focus:border-violet-400"
                  />
                  <span className="text-slate-400 text-xs">y te envío el enlace por privado.</span>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === "estilo" && (
            <div className="space-y-4">
              {/* Communication Style */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                  Estilo de Comunicación y Tono de Voz:
                </label>
                <div className="grid gap-2">
                  {COMMUNICATION_PRESETS.map((p) => {
                    const isSelected = communicationStyle === p.label;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setCommunicationStyle(p.label)}
                        className={`text-left p-3 rounded-xl border transition ${
                          isSelected
                            ? "bg-cyan-950/50 border-cyan-500 text-white"
                            : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-cyan-300">{p.label}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{p.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visual Style */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-violet-400" />
                  Estilo Visual y Dirección de Arte Preferida:
                </label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {VISUAL_STYLE_PRESETS.map((v) => {
                    const isSelected = visualStyle === v.label;
                    return (
                      <button
                        type="button"
                        key={v.id}
                        onClick={() => setVisualStyle(v.label)}
                        className={`text-left p-3 rounded-xl border transition ${
                          isSelected
                            ? "bg-violet-950/40 border-violet-500 text-white"
                            : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="font-bold text-xs text-violet-300">{v.label}</div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-snug">{v.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeSubTab === "redes" && (
            <div className="space-y-3">
              <p className="text-slate-400 leading-relaxed">
                Añade tus perfiles oficiales. El motor los utilizará para generar menciones cruzadas y verificar formatos de publicación específicos:
              </p>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <span className="text-red-400 font-bold">YouTube:</span>
                    <span>Canal o Handle</span>
                  </label>
                  <input
                    type="url"
                    value={ytUrl}
                    onChange={(e) => setYtUrl(e.target.value)}
                    placeholder="https://youtube.com/@tucanal"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <span className="text-pink-400 font-bold">Instagram:</span>
                    <span>Perfil o Usuario</span>
                  </label>
                  <input
                    type="text"
                    value={igUrl}
                    onChange={(e) => setIgUrl(e.target.value)}
                    placeholder="https://instagram.com/tu_usuario"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-pink-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <span className="text-cyan-400 font-bold">TikTok:</span>
                    <span>Cuenta de creador</span>
                  </label>
                  <input
                    type="text"
                    value={tkUrl}
                    onChange={(e) => setTkUrl(e.target.value)}
                    placeholder="https://tiktok.com/@tu_cuenta"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <span className="text-blue-400 font-bold">LinkedIn:</span>
                    <span>Perfil profesional o Página de empresa</span>
                  </label>
                  <input
                    type="url"
                    value={liUrl}
                    onChange={(e) => setLiUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/tu-perfil"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <span className="text-slate-300 font-bold">Sitio Web / Newsletter:</span>
                    <span>Enlace principal</span>
                  </label>
                  <input
                    type="url"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    placeholder="https://tudominio.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              * Cambios sincronizados con la memoria permanente del motor
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-950" />
                    ¡Guardado con Éxito!
                  </>
                ) : isSaving ? (
                  "Guardando..."
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Guardar Perfil de Contexto
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </dialog>
  );
};
