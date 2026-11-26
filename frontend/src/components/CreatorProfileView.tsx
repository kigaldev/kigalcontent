"use client";

import React, { useEffect, useState } from "react";
import {
  User,
  Sparkles,
  Link as LinkIcon,
  Target,
  Palette,
  Briefcase,
  Check,
  Save,
  Copy,
  GitBranch,
  Wand2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import type { CreatorProfile } from "@/types/engine";
import { useEngineStore } from "@/store/useEngineStore";
import { apiClient } from "@/lib/api";

interface CreatorProfileViewProps {
  onRefresh: () => void;
  onProceedToNextStep: () => void;
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

export function CreatorProfileView({ onRefresh, onProceedToNextStep }: CreatorProfileViewProps) {
  const { creatorProfile, setCreatorProfile, backendOnline, showToast } = useEngineStore();

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

  const [activeSubTab, setActiveSubTab] = useState<"importar" | "general" | "estilo" | "redes">("importar");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Extractor / GitHub state
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [extractorJsonInput, setExtractorJsonInput] = useState("");
  const [repoInput, setRepoInput] = useState("");
  const [githubTokenInput, setGithubTokenInput] = useState("");
  const [githubLoading, setGithubLoading] = useState(false);
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (creatorProfile) {
      setName(creatorProfile.name || "");
      setAge(creatorProfile.age ? String(creatorProfile.age) : "");
      setTagline(creatorProfile.personal_brand_tagline || "");
      setNiche(creatorProfile.niche || "");
      setTargetIcp(creatorProfile.ideal_customer_profile || "");
      setProjectContext(creatorProfile.project_context || "");
      setSelectedGoals(
        creatorProfile.strategic_goals || [
          "Captar correos y leads cualificados (Lead Magnets)",
          "Posicionar liderazgo de opinión y reconocimiento de marca",
        ]
      );
      setCommunicationStyle(creatorProfile.communication_style || "Educativo y Didáctico");
      setVisualStyle(creatorProfile.visual_style || "Tecnológico / Neón Dinámico");
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
  }, [creatorProfile]);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CONTEXT_EXTRACTOR_PROMPT);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleApplyExtractorJson = () => {
    setImportError(null);
    setImportStatusMessage(null);
    if (!extractorJsonInput.trim()) {
      setImportError("Pega el JSON devuelto por Claude, Codex, Gemini o NotebookLM.");
      return;
    }

    try {
      let raw = extractorJsonInput.trim();
      const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        raw = codeBlockMatch[1].trim();
      }

      const parsed = JSON.parse(raw) as Partial<CreatorProfile> & {
        trigger_word?: string;
      };

      const appliedFields: string[] = [];

      if (parsed.name && typeof parsed.name === "string") {
        setName(parsed.name.trim());
        appliedFields.push("Nombre");
      }
      if (parsed.personal_brand_tagline && typeof parsed.personal_brand_tagline === "string") {
        setTagline(parsed.personal_brand_tagline.trim());
        appliedFields.push("Propuesta");
      }
      if (parsed.niche && typeof parsed.niche === "string") {
        setNiche(parsed.niche.trim());
        appliedFields.push("Nicho");
      }
      if (parsed.ideal_customer_profile && typeof parsed.ideal_customer_profile === "string") {
        setTargetIcp(parsed.ideal_customer_profile.trim());
        appliedFields.push("Cliente Ideal");
      }
      if (parsed.project_context && typeof parsed.project_context === "string") {
        setProjectContext(parsed.project_context.trim());
        appliedFields.push("Contexto");
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
        `¡Contexto importado con éxito! Se rellenaron: ${appliedFields.join(", ")}. Revisa las pestañas y pulsa "Guardar Perfil de Creador".`
      );
      showToast("success", `Perfil auto-rellenado desde tu IA (${appliedFields.length} campos)`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Error al procesar el JSON pegado.");
    }
  };

  const handleImportGithub = async () => {
    setImportError(null);
    setImportStatusMessage(null);
    const slugRaw = repoInput.trim();
    if (!slugRaw) {
      setImportError("Introduce la URL o slug de tu repositorio (ej: usuario/repositorio).");
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
        `Repositorio "${data.repo_full_name}" importado. Se extrajo el nicho, pilares de contenido y contexto técnico del README.`
      );
      showToast("success", `Contexto de GitHub importado para ${data.repo_full_name}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Error al importar el repositorio de GitHub.");
    } finally {
      setGithubLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      if (backendOnline) {
        const saved = await apiClient.updateCreatorProfile(payload);
        setCreatorProfile(saved);
      } else {
        throw new Error("Backend sin conexión: el perfil no se ha guardado.");
      }

      setSaveSuccess(true);
      showToast("success", "¡Perfil de creador y directrices de estilo guardados correctamente!");
      onRefresh();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error al guardar el perfil");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 0 Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 p-6 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>Paso 0: Fundamentos & Contexto de Creación</span>
            </div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">
              Perfil del Creador & Contexto Inteligente
            </h1>
            <p className="max-w-3xl text-xs sm:text-sm text-slate-300 leading-relaxed">
              El motor autónomo necesita conocer tu voz, tu nicho, tu cliente ideal y tus reglas innegociables para redactar guiones hiperpersonalizados y alinear la estrategia de conversión sin alucinaciones.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? "Guardando..." : "Guardar Perfil"}</span>
            </button>

            <button
              type="button"
              onClick={onProceedToNextStep}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-slate-950/80 hover:bg-slate-900 px-4 py-2.5 text-xs font-bold text-cyan-300 transition"
            >
              <span>Continuar a Paso 1: Ideas</span>
              <ArrowRight className="h-4 w-4 text-cyan-400" />
            </button>
          </div>
        </div>

        {/* Subtabs Selector */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-800/80 pt-4">
          <button
            type="button"
            onClick={() => setActiveSubTab("importar")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeSubTab === "importar"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md"
                : "border border-slate-800 bg-slate-950/60 text-slate-300 hover:text-white hover:border-slate-700"
            }`}
          >
            <Wand2 className="h-3.5 w-3.5" />
            <span>🌟 Importar desde IA o GitHub</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("general")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeSubTab === "general"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md"
                : "border border-slate-800 bg-slate-950/60 text-slate-300 hover:text-white hover:border-slate-700"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Identidad & Nicho</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("estilo")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeSubTab === "estilo"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md"
                : "border border-slate-800 bg-slate-950/60 text-slate-300 hover:text-white hover:border-slate-700"
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>Tono, Estilo & Directrices</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("redes")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeSubTab === "redes"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md"
                : "border border-slate-800 bg-slate-950/60 text-slate-300 hover:text-white hover:border-slate-700"
            }`}
          >
            <LinkIcon className="h-3.5 w-3.5" />
            <span>Redes & Lead Magnets</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: EXTRACTOR & GITHUB IMPORTER */}
      {activeSubTab === "importar" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Claude / Gemini / Codex Universal Extractor */}
          <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Extractor Universal desde Claude, Codex o Gemini
                </h3>
                <p className="text-xs text-slate-400">
                  ¿Ya tienes un Proyecto en Claude, ChatGPT/Codex o NotebookLM con todo tu contexto?
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2 text-xs text-slate-300">
              <p className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <span>1. Copia este prompt y pégalo en tu chat o proyecto habitual:</span>
              </p>
              <div className="relative">
                <pre className="max-h-32 overflow-y-auto rounded-lg bg-slate-900 p-2.5 text-[11px] text-slate-300 font-mono border border-slate-800">
                  {CONTEXT_EXTRACTOR_PROMPT}
                </pre>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-md bg-cyan-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-cyan-400 transition"
                >
                  {copiedPrompt ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedPrompt ? "¡Copiado!" : "Copiar Prompt"}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>2. Pega aquí el JSON devuelto por tu IA:</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Rellena instantáneamente todos los campos del perfil
                </span>
              </label>
              <textarea
                value={extractorJsonInput}
                onChange={(e) => setExtractorJsonInput(e.target.value)}
                placeholder='Pega aquí el bloque ```json ... ``` devuelto por Claude o ChatGPT'
                rows={5}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleApplyExtractorJson}
                disabled={!extractorJsonInput.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                <span>Auto-rellenar Perfil con el Contexto</span>
              </button>
            </div>
          </div>

          {/* GitHub Repo Context Importer */}
          <div className="rounded-2xl border border-violet-500/30 bg-slate-900/80 p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
                <GitBranch className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Importador de Contexto desde GitHub
                </h3>
                <p className="text-xs text-slate-400">
                  Analiza el README, arquitectura y descripción de tu repositorio
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Si tu contenido está enfocado en programación, SaaS, startups o herramientas técnicas, puedes extraer automáticamente la propuesta de valor y los pilares de tu propio repo.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Repositorio de GitHub (URL o slug usuario/repo)
                </label>
                <input
                  type="text"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="https://github.com/kigaldev/kigalcontent o kigaldev/kigalcontent"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  GitHub Personal Access Token (Opcional, solo si el repo es privado)
                </label>
                <input
                  type="password"
                  value={githubTokenInput}
                  onChange={(e) => setGithubTokenInput(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (dejar vacío si es público)"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleImportGithub}
                disabled={githubLoading || !repoInput.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-xs font-bold text-white transition disabled:opacity-50"
              >
                <GitBranch className="h-4 w-4" />
                <span>{githubLoading ? "Extrayendo README y contexto..." : "Escanear e Importar Repo"}</span>
              </button>
            </div>
          </div>

          {/* Feedback messages */}
          {(importStatusMessage || importError) && (
            <div className="lg:col-span-2">
              {importStatusMessage && (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{importStatusMessage}</span>
                </div>
              )}
              {importError && (
                <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: IDENTIDAD & NICHO */}
      {activeSubTab === "general" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Nombre del Creador o Marca Personal *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: David, Alex Hormozi, Kigal..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Edad (Opcional - para calibrar modismos generacionales)
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Ej: 32"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Tagline o Propuesta de Valor en una frase *
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Ej: Enseño a fundadores solopreneurs a multiplicar su tracción mediante IA y sistemas de contenido."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Nicho Principal / Industria *
              </label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Ej: Solopreneurship, IA para negocios, Desarrollo Web, No-Code..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Cliente o Audiencia Ideal (ICP) *
              </label>
              <input
                type="text"
                value={targetIcp}
                onChange={(e) => setTargetIcp(e.target.value)}
                placeholder="Ej: Emprendedores y creadores con poco tiempo que buscan monetizar su conocimiento."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Contexto Profundo del Proyecto o Negocio
            </label>
            <p className="text-[11px] text-slate-400 mb-1.5">
              Describe aquí qué vendes, tus casos de éxito, tus frameworks propietarios o metodologías para que los guiones hablen de tus soluciones reales.
            </p>
            <textarea
              value={projectContext}
              onChange={(e) => setProjectContext(e.target.value)}
              rows={4}
              placeholder="Ej: Tenemos una academia con más de 200 alumnos, usamos el framework 3T (Tráfico, Tracción, Transacción), ofrecemos plantillas listas para producción..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Objetivos Estratégicos Principales del Contenido
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STRATEGIC_GOALS_OPTIONS.map((goal) => {
                const isChecked = selectedGoals.includes(goal);
                return (
                  <label
                    key={goal}
                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs transition cursor-pointer ${
                      isChecked
                        ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
                        : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGoals([...selectedGoals, goal]);
                        } else {
                          setSelectedGoals(selectedGoals.filter((g) => g !== goal));
                        }
                      }}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/20"
                    />
                    <span>{goal}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: TONO & ESTILO VISUAL */}
      {activeSubTab === "estilo" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl space-y-6">
          {/* Communication Style */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Estilo de Comunicación y Personalidad Frente a Cámara
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {COMMUNICATION_PRESETS.map((style) => {
                const isSelected = communicationStyle === style.label;
                return (
                  <div
                    key={style.id}
                    onClick={() => setCommunicationStyle(style.label)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition space-y-1.5 ${
                      isSelected
                        ? "border-cyan-500 bg-cyan-500/10 text-white shadow-md shadow-cyan-500/10"
                        : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{style.label}</span>
                      {isSelected && <Check className="h-4 w-4 text-cyan-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{style.desc}</p>
                    <span className="inline-block text-[10px] text-cyan-300/80 font-medium">
                      {style.badge}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visual Style */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Estilo Visual de Video & Portadas
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {VISUAL_STYLE_PRESETS.map((vs) => {
                const isSelected = visualStyle === vs.label;
                return (
                  <div
                    key={vs.id}
                    onClick={() => setVisualStyle(vs.label)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition space-y-1.5 ${
                      isSelected
                        ? "border-violet-500 bg-violet-500/10 text-white shadow-md shadow-violet-500/10"
                        : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{vs.label}</span>
                      {isSelected && <Check className="h-4 w-4 text-violet-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{vs.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pillars and Voice Guidelines */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Pilares Temáticos de Contenido (Separados por comas)
              </label>
              <textarea
                value={contentPillars.join(", ")}
                onChange={(e) =>
                  setContentPillars(
                    e.target.value
                      .split(",")
                      .map((p) => p.trim())
                      .filter(Boolean)
                  )
                }
                rows={3}
                placeholder="Ej: Automatizaciones No-Code, Prompt Engineering, Monetización Solopreneur, Productividad Radical"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Directrices de Voz e Innegociables
              </label>
              <textarea
                value={voiceGuidelines}
                onChange={(e) => setVoiceGuidelines(e.target.value)}
                rows={3}
                placeholder="Ej: Nunca uses jerga corporativa vacía. Evita el tono de vendedor de humo. Usa ejemplos con números concretos siempre que sea posible."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: REDES Y CONVERSION */}
      {activeSubTab === "redes" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl space-y-6">
          <div>
            <h4 className="text-xs font-bold text-white mb-1">
              Enlaces Públicos de tus Redes Sociales
            </h4>
            <p className="text-[11px] text-slate-400 mb-4">
              Se utilizarán para enlazar tus perfiles en las descripciones y publicaciones preparadas por la IA.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">YouTube</label>
                <input
                  type="url"
                  value={ytUrl}
                  onChange={(e) => setYtUrl(e.target.value)}
                  placeholder="https://youtube.com/@tu_canal"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Instagram</label>
                <input
                  type="url"
                  value={igUrl}
                  onChange={(e) => setIgUrl(e.target.value)}
                  placeholder="https://instagram.com/tu_perfil"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">TikTok</label>
                <input
                  type="url"
                  value={tkUrl}
                  onChange={(e) => setTkUrl(e.target.value)}
                  placeholder="https://tiktok.com/@tu_usuario"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">LinkedIn</label>
                <input
                  type="url"
                  value={liUrl}
                  onChange={(e) => setLiUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/tu_perfil"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Sitio Web Oficial</label>
                <input
                  type="url"
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  placeholder="https://tuweb.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">GitHub / Portfolio</label>
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/tu_usuario"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Target className="h-4 w-4 text-cyan-400" />
              <span>Palabra Disparadora de Conversión (ManyChat / Lead Magnet)</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Esta es la palabra que tus guiones invitarán a comentar a la audiencia en los últimos 3 segundos para que tu bot de automatización les envíe el recurso por mensaje privado.
            </p>
            <div className="max-w-xs">
              <input
                type="text"
                value={triggerWord}
                onChange={(e) => setTriggerWord(e.target.value.toUpperCase())}
                placeholder="GUIA"
                className="w-full rounded-xl border border-cyan-500/50 bg-slate-900 px-3 py-2 text-xs font-bold text-cyan-300 tracking-wider focus:outline-none uppercase"
              />
            </div>
          </div>
        </div>
      )}

      {/* Global Bottom Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>
            {saveSuccess
              ? "¡Cambios guardados con éxito!"
              : "Los cambios se aplicarán a todos los nuevos guiones generados."}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-5 py-2.5 text-xs font-bold text-slate-950 transition shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Guardando..." : "Guardar Perfil de Creador"}</span>
          </button>

          <button
            type="button"
            onClick={onProceedToNextStep}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/50 bg-slate-950 hover:bg-slate-900 px-5 py-2.5 text-xs font-bold text-cyan-300 transition"
          >
            <span>Ir al Paso 1: Ideas y Prioridades</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
