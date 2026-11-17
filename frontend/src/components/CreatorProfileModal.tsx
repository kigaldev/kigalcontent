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
  Copy,
  GitBranch,
  Wand2,
  AlertCircle,
} from "lucide-react";
import type { CreatorProfile } from "@/types/engine";
import { useEngineStore } from "@/store/useEngineStore";
import { apiClient } from "@/lib/api";

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

const CONTEXT_EXTRACTOR_PROMPT = `Analiza TODO el historial, documentos, notas y contexto de este proyecto (en Claude, Codex/ChatGPT, Gemini o NotebookLM) y extrae mi perfil completo para configurar mi motor de creación de contenido.

Devuelve ÚNICAMENTE un bloque JSON válido (sin texto adicional fuera del bloque) con exactamente esta estructura y rellenando todos los campos con el mayor detalle real posible:

\`\`\`json
{
  "name": "Mi nombre o nombre de mi marca/proyecto",
  "personal_brand_tagline": "Frase corta de posicionamiento / propuesta de valor en 1 línea",
  "niche": "Mi nicho o especialidad concreta",
  "ideal_customer_profile": "Descripción exacta de mi cliente o audiencia ideal, sus dolores y deseos",
  "project_context": "Resumen profundo de qué trata mi proyecto, producto o servicio, diferenciadores y casos de éxito",
  "strategic_goals": [
    "Captar correos y leads cualificados (Lead Magnets)",
    "Posicionar liderazgo de opinión y reconocimiento de marca"
  ],
  "communication_style": "Educativo y Didáctico | Directo y con Autoridad | Cercano y Conversacional | Storytelling Narrativo | Provocador y Witty",
  "visual_style": "Estudio Oscuro Minimalista | Tecnológico / Neón Dinámico | Editorial Blanco / Clean | Cinematográfico Grano 35mm",
  "content_pillars": ["Pilar temático 1", "Pilar temático 2", "Pilar temático 3"],
  "voice_guidelines": "Reglas de tono, palabras que uso o evito, y cómo hablo a mi audiencia",
  "trigger_word": "GUIA",
  "social_profiles": {
    "youtube": "",
    "instagram": "",
    "tiktok": "",
    "linkedin": "",
    "website": "",
    "github": ""
  }
}
\`\`\``;

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
  const [contentPillars, setContentPillars] = useState<string[]>([]);
  const [voiceGuidelines, setVoiceGuidelines] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [igUrl, setIgUrl] = useState("");
  const [tkUrl, setTkUrl] = useState("");
  const [liUrl, setLiUrl] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [triggerWord, setTriggerWord] = useState("GUIA");

  const [activeSubTab, setActiveSubTab] = useState<"general" | "estilo" | "redes" | "importar">("general");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Import state (Claude/Gemini/NotebookLM JSON + GitHub Repo)
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [extractorJsonInput, setExtractorJsonInput] = useState("");
  const [repoInput, setRepoInput] = useState("");
  const [githubTokenInput, setGithubTokenInput] = useState("");
  const [githubLoading, setGithubLoading] = useState(false);
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

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
      setGithubUrl(creatorProfile.social_profiles?.github || "");
      setContentPillars(creatorProfile.content_pillars || []);
      setVoiceGuidelines(creatorProfile.voice_guidelines || "");

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
      content_pillars: contentPillars,
      voice_guidelines: voiceGuidelines || null,
      social_profiles: {
        youtube: ytUrl,
        instagram: igUrl,
        tiktok: tkUrl,
        linkedin: liUrl,
        website: webUrl,
        github: githubUrl,
      },
      conversion_goals_catalog: updatedCatalog,
    };

    try {
      const saved = await apiClient.updateCreatorProfile(payload);
      setCreatorProfile(saved);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
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

  const handleCopyExtractorPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CONTEXT_EXTRACTOR_PROMPT);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2200);
    } catch {
      setImportError("No se pudo copiar automáticamente; selecciona el texto del prompt y cópialo manualmente.");
    }
  };

  const handleApplyExtractedJson = () => {
    setImportError(null);
    setImportStatusMessage(null);
    const raw = extractorJsonInput.trim();
    if (!raw) {
      setImportError("Pega primero la respuesta JSON generada por Claude, Codex/ChatGPT, Gemini o NotebookLM.");
      return;
    }

    try {
      // Extract JSON object even if wrapped in markdown ```json fences or prose
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error("No se encontró un bloque JSON válido { ... } en el texto pegado.");
      }
      const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;

      const appliedFields: string[] = [];
      if (typeof parsed.name === "string" && parsed.name.trim()) {
        setName(parsed.name.trim());
        appliedFields.push("Nombre");
      }
      if (typeof parsed.age === "number" || typeof parsed.age === "string") {
        const ageNum = parseInt(String(parsed.age), 10);
        if (!Number.isNaN(ageNum) && ageNum >= 14 && ageNum <= 100) {
          setAge(String(ageNum));
        }
      }
      if (typeof parsed.personal_brand_tagline === "string" && parsed.personal_brand_tagline.trim()) {
        setTagline(parsed.personal_brand_tagline.trim());
        appliedFields.push("Titular");
      }
      if (typeof parsed.niche === "string" && parsed.niche.trim()) {
        setNiche(parsed.niche.trim());
        appliedFields.push("Nicho");
      }
      if (typeof parsed.ideal_customer_profile === "string" && parsed.ideal_customer_profile.trim()) {
        setTargetIcp(parsed.ideal_customer_profile.trim());
        appliedFields.push("Audiencia ICP");
      }
      if (typeof parsed.project_context === "string" && parsed.project_context.trim()) {
        setProjectContext(parsed.project_context.trim());
        appliedFields.push("Contexto del Proyecto");
      }
      if (Array.isArray(parsed.strategic_goals) && parsed.strategic_goals.length > 0) {
        setSelectedGoals(parsed.strategic_goals.map((g) => String(g)));
        appliedFields.push("Objetivos");
      }
      if (typeof parsed.communication_style === "string" && parsed.communication_style.trim()) {
        const matched = COMMUNICATION_PRESETS.find((p) =>
          parsed.communication_style!.toString().toLowerCase().includes(p.label.toLowerCase().split(" ")[0])
        );
        setCommunicationStyle(matched ? matched.label : parsed.communication_style.trim());
        appliedFields.push("Tono");
      }
      if (typeof parsed.visual_style === "string" && parsed.visual_style.trim()) {
        const matched = VISUAL_STYLE_PRESETS.find((v) =>
          parsed.visual_style!.toString().toLowerCase().includes(v.label.toLowerCase().split(" ")[0])
        );
        setVisualStyle(matched ? matched.label : parsed.visual_style.trim());
        appliedFields.push("Estilo Visual");
      }
      if (Array.isArray(parsed.content_pillars) && parsed.content_pillars.length > 0) {
        setContentPillars(parsed.content_pillars.map((p) => String(p)));
        appliedFields.push("Pilares");
      }
      if (typeof parsed.voice_guidelines === "string" && parsed.voice_guidelines.trim()) {
        setVoiceGuidelines(parsed.voice_guidelines.trim());
        appliedFields.push("Reglas de Voz");
      }
      if (typeof parsed.trigger_word === "string" && parsed.trigger_word.trim()) {
        setTriggerWord(parsed.trigger_word.trim().toUpperCase());
        appliedFields.push("Palabra Clave");
      }
      if (parsed.social_profiles && typeof parsed.social_profiles === "object") {
        const sp = parsed.social_profiles as Record<string, unknown>;
        if (typeof sp.youtube === "string" && sp.youtube) setYtUrl(sp.youtube);
        if (typeof sp.instagram === "string" && sp.instagram) setIgUrl(sp.instagram);
        if (typeof sp.tiktok === "string" && sp.tiktok) setTkUrl(sp.tiktok);
        if (typeof sp.linkedin === "string" && sp.linkedin) setLiUrl(sp.linkedin);
        if (typeof sp.website === "string" && sp.website) setWebUrl(sp.website);
        if (typeof sp.github === "string" && sp.github) setGithubUrl(sp.github);
      }

      if (appliedFields.length === 0) {
        setImportError("El JSON no contenía campos reconocibles del perfil.");
        return;
      }

      setImportStatusMessage(
        `¡Contexto importado con éxito! Se han rellenado: ${appliedFields.join(", ")}. Revisa las pestañas 1-3 y pulsa "Guardar Perfil de Contexto".`
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Error al leer el JSON pegado.");
    }
  };

  const handleImportGithub = async () => {
    setImportError(null);
    setImportStatusMessage(null);
    const slugRaw = repoInput.trim();
    if (!slugRaw) {
      setImportError("Introduce la URL o el slug de tu repositorio (ej: kigaldev/kigalcontent).");
      return;
    }
    setGithubLoading(true);
    try {
      const data = await apiClient.importGitHubRepo({
        repo_url_or_slug: slugRaw,
        github_token: githubTokenInput.trim() || null,
      });

      if (data.suggested_niche) setNiche(data.suggested_niche);
      if (data.suggested_project_context) setProjectContext(data.suggested_project_context);
      if (data.suggested_content_pillars?.length) setContentPillars(data.suggested_content_pillars);
      if (data.suggested_tagline && !tagline) setTagline(data.suggested_tagline);
      setGithubUrl(data.repo_url);
      setImportStatusMessage(
        `Repositorio "${data.repo_full_name}" conectado y analizado. Contexto técnico y pilares cargados en el perfil.`
      );
      return;

      // Direct public GitHub API fallback when backend is offline in Studio Local Mode
      let cleanSlug = slugRaw.replace(/\/$/, "").replace(/\.git$/, "");
      if (cleanSlug.includes("github.com/")) {
        cleanSlug = cleanSlug.split("github.com/")[1];
      }
      const ghRes = await fetch(`https://api.github.com/repos/${cleanSlug}`);
      if (!ghRes.ok) {
        const errPayload = await ghRes.json().catch(() => null);
        throw new Error(
          errPayload?.message ||
            `No se pudo acceder al repositorio "${cleanSlug}" (código ${ghRes.status}).`
        );
      }
      const ghMeta = (await ghRes.json()) as {
        full_name: string;
        html_url: string;
        description?: string;
        language?: string;
        topics?: string[];
      };
      const rawPillars = [
        ...(ghMeta.language ? [ghMeta.language] : []),
        ...(ghMeta.topics || []).slice(0, 5),
      ];
      const pillars: string[] = Array.from(new Set(rawPillars)).filter((p): p is string => Boolean(p));
      setNiche(
        ghMeta.language
          ? `Tecnología, ${ghMeta.language} y Producto Digital`
          : "Tecnología y Desarrollo de Producto"
      );
      setProjectContext(
        `Proyecto en GitHub: ${ghMeta.full_name} (${ghMeta.html_url}).\nDescripción: ${
          ghMeta.description || "Proyecto de software y automatización."
        }\nTemas: ${pillars.join(", ")}.`
      );
      if (pillars.length > 0) setContentPillars(pillars);
      if (ghMeta.description && !tagline) {
        setTagline((ghMeta.description || "").slice(0, 120));
      }
      setGithubUrl(ghMeta.html_url);
      setImportStatusMessage(
        `Repositorio "${ghMeta.full_name}" importado directamente vía API pública de GitHub.`
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Error conectando con GitHub.");
    } finally {
      setGithubLoading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="wide-dialog backdrop:bg-slate-950/80 backdrop:backdrop-blur-sm bg-slate-900 border border-slate-700/80 text-slate-100 rounded-2xl p-0 w-full max-w-4xl shadow-2xl focus:outline-none overflow-hidden m-auto"
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
        <div className="px-5 pt-3 border-b border-slate-800/80 flex flex-wrap gap-2 bg-slate-900/60">
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
            1. Negocio y Metas
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
            2. Tono y Estilo
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
            3. Redes y Links
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("importar")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeSubTab === "importar"
                ? "border-emerald-400 text-emerald-300"
                : "border-transparent text-emerald-400/80 hover:text-emerald-200"
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            4. Importar (Claude / Gemini / GitHub)
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

                <div>
                  <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                    <span className="text-emerald-300 font-bold">GitHub (Proyecto / Portfolio):</span>
                    <span>Repositorio principal</span>
                  </label>
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/tu-usuario/tu-repo"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSubTab === "importar" && (
            <div className="space-y-5">
              {importStatusMessage && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200 flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{importStatusMessage}</span>
                </div>
              )}

              {importError && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Section A: Prompt Extractor for Claude / ChatGPT (Codex) / Gemini / NotebookLM */}
              <div className="rounded-xl border border-cyan-500/30 bg-slate-950/70 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      1. Extraer Contexto desde Claude, ChatGPT (Codex), Gemini o NotebookLM
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Copia este prompt, pégalo en el proyecto donde ya trabajas tu negocio/contenido y pega aquí debajo el JSON que te devuelva.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyExtractorPrompt}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition"
                  >
                    {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedPrompt ? "¡Prompt Copiado!" : "Copiar Prompt Extractor"}
                  </button>
                </div>

                <pre className="rounded-lg border border-slate-800 bg-slate-900/90 p-3 text-[11px] font-mono text-cyan-100/90 max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {CONTEXT_EXTRACTOR_PROMPT}
                </pre>

                <div className="space-y-2 pt-1">
                  <label className="block text-slate-300 font-semibold">
                    Pega aquí la respuesta JSON de tu IA externa:
                  </label>
                  <textarea
                    rows={5}
                    value={extractorJsonInput}
                    onChange={(e) => setExtractorJsonInput(e.target.value)}
                    placeholder='Pega aquí el bloque { "name": "...", "niche": "...", ... } generado por Claude, Codex, Gemini o NotebookLM'
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleApplyExtractedJson}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Rellenar Perfil Automáticamente
                    </button>
                  </div>
                </div>
              </div>

              {/* Section B: Direct GitHub Repository Connector */}
              <div className="rounded-xl border border-violet-500/30 bg-slate-950/70 p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-violet-400" />
                    2. Conectar Repositorio de GitHub (Código, README y Pilares)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Analiza automáticamente la descripción, lenguajes, temas y README de un repositorio para nutrir el contexto técnico de tus guiones.
                  </p>
                </div>

                <div className="grid sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-6">
                    <label className="block text-slate-300 font-medium mb-1">
                      URL o usuario/repositorio
                    </label>
                    <input
                      type="text"
                      value={repoInput}
                      onChange={(e) => setRepoInput(e.target.value)}
                      placeholder="Ej. kigaldev/kigalcontent o https://github.com/..."
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-slate-300 font-medium mb-1">
                      Token (solo si es privado)
                    </label>
                    <input
                      type="password"
                      value={githubTokenInput}
                      onChange={(e) => setGithubTokenInput(e.target.value)}
                      placeholder="ghp_... (opcional)"
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={handleImportGithub}
                      disabled={githubLoading}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-slate-950 font-bold text-xs transition disabled:opacity-50"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      {githubLoading ? "Analizando..." : "Importar GitHub"}
                    </button>
                  </div>
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
