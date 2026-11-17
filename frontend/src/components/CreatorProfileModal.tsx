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
  Save,
  Copy,
  GitBranch,
  Wand2,
  AlertCircle,
  Plus,
  Trash2,
  FolderOpen,
  Zap,
  Globe,
  ExternalLink,
  Play,
  CheckCircle2,
} from "lucide-react";
import type {
  CreatorProfile,
  GitHubRepoItem,
  LeadMagnetItem,
  ManyChatTriggerRule,
  SocialAccountItem,
} from "@/types/engine";
import { useEngineStore } from "@/store/useEngineStore";
import { apiClient } from "@/lib/api";
import type { CreatorModalTab } from "@/components/ProfileBubbleMenu";

interface CreatorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: CreatorModalTab;
}

const COMMUNICATION_PRESETS = [
  {
    id: "educativo",
    label: "Educativo y Didáctico",
    desc: "Explicaciones paso a paso, marcos conceptuales claros y analogías sencillas.",
    badge: "🎓 Cursos y consultoría",
  },
  {
    id: "autoridad",
    label: "Directo y con Autoridad",
    desc: "Tono asertivo, sin rodeos, desmonta mitos del sector y aporta datos empíricos.",
    badge: "⚡ B2B y directivos",
  },
  {
    id: "cercano",
    label: "Cercano y Conversacional",
    desc: "Hablas como con un colega tomándote un café, accesible y empático.",
    badge: "☕ Comunidad",
  },
  {
    id: "storytelling",
    label: "Storytelling Narrativo",
    desc: "Centrado en anécdotas, el viaje del héroe, fracasos superados y lecciones.",
    badge: "📖 Marca personal",
  },
  {
    id: "provocador",
    label: "Provocador y Witty",
    desc: "Opiniones contracorriente, ganchos polémicos y humor inteligente.",
    badge: "🔥 Viralidad",
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

const SOCIAL_PLATFORM_OPTIONS = [
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "website", label: "Web / Landing" },
  { value: "github", label: "GitHub" },
  { value: "x", label: "X / Twitter" },
  { value: "other", label: "Otro Enlace" },
];

const LEAD_MAGNET_FORMATS = [
  "Guía PDF",
  "Repo GitHub / Open Source",
  "Plantilla / Notion",
  "Prompt Pack",
  "Checklist",
  "Video / Mini-Curso",
  "Enlace / Herramienta",
];

const CONTEXT_EXTRACTOR_PROMPT = `Analiza TODO el historial, documentos, notas y contexto de este proyecto (en Claude, Codex/ChatGPT, Gemini o NotebookLM) y extrae mi perfil completo para configurar mi motor de creación de contenido.

Devuelve ÚNICAMENTE un bloque JSON válido (sin texto adicional fuera del bloque) con exactamente esta estructura:

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
  initialTab = "general",
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { creatorProfile, setCreatorProfile, showToast } = useEngineStore();

  const [activeSubTab, setActiveSubTab] = useState<CreatorModalTab>(initialTab);

  // Core Profile Fields
  const [name, setName] = useState("");
  const [age, setAge] = useState<string>("");
  const [tagline, setTagline] = useState("");
  const [niche, setNiche] = useState("");
  const [targetIcp, setTargetIcp] = useState("");
  const [projectContext, setProjectContext] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [communicationStyle, setCommunicationStyle] = useState("Educativo y Didáctico");
  const [visualStyle, setVisualStyle] = useState("Tecnológico / Neón Dinámico");
  const [contentPillars, setContentPillars] = useState<string[]>([]);
  const [voiceGuidelines, setVoiceGuidelines] = useState("");

  // Multiple Social Accounts & Websites
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountItem[]>([]);

  // Up to 5 GitHub Repositories
  const [githubRepos, setGithubRepos] = useState<GitHubRepoItem[]>([]);
  const [repoSlugInputs, setRepoSlugInputs] = useState<string[]>([""]);
  const [githubTokenInput, setGithubTokenInput] = useState("");
  const [githubLoading, setGithubLoading] = useState(false);

  // Lead Magnets Folder & ManyChat Keyword Triggers
  const [leadMagnets, setLeadMagnets] = useState<LeadMagnetItem[]>([]);
  const [manychatTriggers, setManychatTriggers] = useState<ManyChatTriggerRule[]>([]);

  // New Lead Magnet Inline Form
  const [newLmTitle, setNewLmTitle] = useState("");
  const [newLmFormat, setNewLmFormat] = useState("Guía PDF");
  const [newLmUrl, setNewLmUrl] = useState("");
  const [newLmDesc, setNewLmDesc] = useState("");

  // New ManyChat Trigger Inline Form
  const [newTrigKeyword, setNewTrigKeyword] = useState("");
  const [newTrigLmId, setNewTrigLmId] = useState("");
  const [newTrigPlatform, setNewTrigPlatform] = useState("all");
  const [newTrigTemplate, setNewTrigTemplate] = useState("");

  // Live ManyChat Tester
  const [testComment, setTestComment] = useState("");
  const [testPlatform, setTestPlatform] = useState("instagram");
  const [testLoading, setTestLoading] = useState(false);
  const [testOutput, setTestOutput] = useState<{
    matched: boolean;
    dm_reply_text: string;
    delivery_url: string;
    lead_magnet_title?: string;
  } | null>(null);

  // AI Extractor
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [extractorJsonInput, setExtractorJsonInput] = useState("");
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setActiveSubTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!creatorProfile) return;
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
    setContentPillars(creatorProfile.content_pillars || []);
    setVoiceGuidelines(creatorProfile.voice_guidelines || "");

    // Hydrate multiple social accounts
    if (creatorProfile.social_accounts && creatorProfile.social_accounts.length > 0) {
      setSocialAccounts(creatorProfile.social_accounts);
    } else {
      const legacy = creatorProfile.social_profiles || {};
      const converted: SocialAccountItem[] = Object.entries(legacy)
        .filter(([, url]) => Boolean(url && url.trim()))
        .map(([platform, url], idx) => ({
          id: `legacy-${platform}-${idx}`,
          platform,
          label: "Principal",
          url,
        }));
      setSocialAccounts(converted);
    }

    // Hydrate GitHub repos (up to 5)
    const repos = creatorProfile.github_repos || [];
    setGithubRepos(repos);
    if (repos.length > 0) {
      setRepoSlugInputs(repos.map((r) => r.repo_full_name));
    } else if (creatorProfile.social_profiles?.github) {
      setRepoSlugInputs([creatorProfile.social_profiles.github]);
    } else {
      setRepoSlugInputs([""]);
    }

    // Hydrate Lead Magnets & ManyChat Triggers
    setLeadMagnets(creatorProfile.lead_magnets || []);
    setManychatTriggers(creatorProfile.manychat_triggers || []);
  }, [creatorProfile, isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CONTEXT_EXTRACTOR_PROMPT);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleApplyExtractorJson = () => {
    setImportError(null);
    setImportStatusMessage(null);
    if (!extractorJsonInput.trim()) {
      setImportError("Pega primero el JSON devuelto por Claude, Codex, Gemini o NotebookLM.");
      return;
    }

    try {
      let raw = extractorJsonInput.trim();
      const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) raw = codeBlockMatch[1].trim();
      const parsed = JSON.parse(raw) as Partial<CreatorProfile> & { trigger_word?: string };

      const appliedFields: string[] = [];
      if (parsed.name) { setName(parsed.name.trim()); appliedFields.push("Nombre"); }
      if (parsed.personal_brand_tagline) { setTagline(parsed.personal_brand_tagline.trim()); appliedFields.push("Tagline"); }
      if (parsed.niche) { setNiche(parsed.niche.trim()); appliedFields.push("Nicho"); }
      if (parsed.ideal_customer_profile) { setTargetIcp(parsed.ideal_customer_profile.trim()); appliedFields.push("Audiencia"); }
      if (parsed.project_context) { setProjectContext(parsed.project_context.trim()); appliedFields.push("Contexto"); }
      if (Array.isArray(parsed.strategic_goals) && parsed.strategic_goals.length > 0) {
        setSelectedGoals(parsed.strategic_goals.map(String));
        appliedFields.push("Objetivos");
      }
      if (parsed.communication_style) { setCommunicationStyle(parsed.communication_style); appliedFields.push("Tono"); }
      if (parsed.visual_style) { setVisualStyle(parsed.visual_style); appliedFields.push("Estilo Visual"); }
      if (Array.isArray(parsed.content_pillars) && parsed.content_pillars.length > 0) {
        setContentPillars(parsed.content_pillars.map(String));
        appliedFields.push("Pilares");
      }
      if (parsed.voice_guidelines) { setVoiceGuidelines(parsed.voice_guidelines); appliedFields.push("Reglas de Voz"); }

      if (parsed.social_profiles && typeof parsed.social_profiles === "object") {
        const newAccounts: SocialAccountItem[] = [...socialAccounts];
        Object.entries(parsed.social_profiles).forEach(([plat, url]) => {
          if (typeof url === "string" && url.trim() && !newAccounts.some((a) => a.url === url.trim())) {
            newAccounts.push({
              id: `ai-${plat}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              platform: plat,
              label: "Importado IA",
              url: url.trim(),
            });
          }
        });
        setSocialAccounts(newAccounts);
      }

      if (parsed.trigger_word) {
        const kw = parsed.trigger_word.trim().toUpperCase();
        if (kw && !manychatTriggers.some((t) => t.keyword === kw)) {
          setManychatTriggers([
            ...manychatTriggers,
            {
              id: `trig-${Date.now()}`,
              keyword: kw,
              lead_magnet_id: leadMagnets[0]?.id || null,
              platform: "all",
              dm_reply_template: `¡Hola! Aquí tienes tu recurso por comentar ${kw}:`,
              active: true,
              triggers_count: 0,
            },
          ]);
        }
      }

      setImportStatusMessage(
        `¡Contexto importado! Campos rellenados: ${appliedFields.join(", ")}. Puedes editarlos manualmente y guardar.`
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "JSON inválido.");
    }
  };

  // Multi-repo GitHub Batch Import (up to 5 repos)
  const handleImportGithubBatch = async () => {
    setImportError(null);
    setImportStatusMessage(null);
    const validRepos = repoSlugInputs.map((s) => s.trim()).filter(Boolean).slice(0, 5);
    if (validRepos.length === 0) {
      setImportError("Añade al menos 1 repositorio de GitHub (máximo 5).");
      return;
    }

    setGithubLoading(true);
    try {
      const data = await apiClient.importGitHubReposBatch({
        repos: validRepos.map((r) => ({
          repo_url_or_slug: r,
          github_token: githubTokenInput.trim() || null,
        })),
      });

      // Autocomplete ALL creator profile fields (leaving them fully editable)
      if (data.suggested_name && (!name || name === "Creador" || name === "David")) {
        setName(data.suggested_name);
      }
      if (data.suggested_tagline) setTagline(data.suggested_tagline);
      if (data.suggested_niche) setNiche(data.suggested_niche);
      if (data.suggested_icp) setTargetIcp(data.suggested_icp);
      if (data.suggested_project_context) setProjectContext(data.suggested_project_context);
      if (data.suggested_strategic_goals?.length) setSelectedGoals(data.suggested_strategic_goals);
      if (data.suggested_communication_style) setCommunicationStyle(data.suggested_communication_style);
      if (data.suggested_visual_style) setVisualStyle(data.suggested_visual_style);
      if (data.suggested_content_pillars?.length) setContentPillars(data.suggested_content_pillars);
      if (data.suggested_voice_guidelines) setVoiceGuidelines(data.suggested_voice_guidelines);

      setGithubRepos(data.imported_repos);

      // Merge suggested social accounts (GitHub repos + homepages) without duplicating URLs
      if (data.suggested_social_accounts?.length) {
        const mergedAccounts = [...socialAccounts];
        for (const acc of data.suggested_social_accounts) {
          if (!mergedAccounts.some((existing) => existing.url === acc.url)) {
            mergedAccounts.push(acc);
          }
        }
        setSocialAccounts(mergedAccounts);
      }

      // Merge extracted Lead Magnets into the Carpeta de Lead Magnets
      if (data.extracted_lead_magnets?.length) {
        const mergedLms = [...leadMagnets];
        let addedLms = 0;
        for (const lm of data.extracted_lead_magnets) {
          if (!mergedLms.some((existing) => existing.delivery_url === lm.delivery_url)) {
            mergedLms.push(lm);
            addedLms++;
          }
        }
        setLeadMagnets(mergedLms);
        setImportStatusMessage(
          `¡${data.imported_repos.length} repositorio(s) importados! Se autocompletaron todos los campos del perfil y se añadieron ${addedLms} Lead Magnet(s) a tu carpeta. Ya puedes revisarlos, editarlos manualmente y guardar.`
        );
      } else {
        setImportStatusMessage(
          `¡${data.imported_repos.length} repositorio(s) importados y perfil autocompletado! Puedes editar cualquier campo manualmente.`
        );
      }

      showToast("success", `${data.imported_repos.length} repo(s) de GitHub importados y perfil autocompletado`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Error al importar repositorios de GitHub.");
    } finally {
      setGithubLoading(false);
    }
  };

  // Social accounts CRUD
  const handleAddSocialAccount = () => {
    setSocialAccounts([
      ...socialAccounts,
      {
        id: `acc-${Date.now()}`,
        platform: "instagram",
        label: "Cuenta Secundaria",
        url: "",
      },
    ]);
  };

  // Lead Magnet Folder CRUD
  const handleAddLeadMagnet = () => {
    if (!newLmTitle.trim() || !newLmUrl.trim()) return;
    const item: LeadMagnetItem = {
      id: `lm-${Date.now()}`,
      title: newLmTitle.trim(),
      format: newLmFormat,
      delivery_url: newLmUrl.trim(),
      description: newLmDesc.trim(),
      source: "manual",
      created_at: new Date().toISOString(),
    };
    setLeadMagnets([...leadMagnets, item]);
    if (!newTrigLmId) setNewTrigLmId(item.id);
    setNewLmTitle("");
    setNewLmUrl("");
    setNewLmDesc("");
  };

  // ManyChat Trigger Rules CRUD
  const handleAddTriggerRule = () => {
    const kw = newTrigKeyword.trim().toUpperCase().replace(/\s+/g, "");
    if (!kw) return;
    const targetLm = leadMagnets.find((lm) => lm.id === newTrigLmId) || leadMagnets[0];
    const newRule: ManyChatTriggerRule = {
      id: `trig-${Date.now()}`,
      keyword: kw,
      lead_magnet_id: targetLm?.id || null,
      platform: newTrigPlatform,
      dm_reply_template:
        newTrigTemplate.trim() ||
        `¡Hola! Gracias por comentar ${kw}. Aquí tienes acceso a "${targetLm?.title || "tu recurso"}":`,
      active: true,
      triggers_count: 0,
    };
    setManychatTriggers([...manychatTriggers, newRule]);
    setNewTrigKeyword("");
    setNewTrigTemplate("");
  };

  const handleTestManyChatTrigger = async () => {
    if (!testComment.trim()) return;
    setTestLoading(true);
    setTestOutput(null);
    try {
      // Save first so backend has the latest triggers/lead magnets
      await persistProfile(false);
      const res = await apiClient.triggerManyChatKeyword({
        keyword: testComment.trim().split(/\s+/)[0],
        comment_text: testComment.trim(),
        platform: testPlatform,
        username: "@test_creator",
      });
      setTestOutput({
        matched: res.matched,
        dm_reply_text: res.dm_reply_text,
        delivery_url: res.delivery_url,
        lead_magnet_title: res.lead_magnet?.title,
      });
      if (res.matched) {
        setManychatTriggers((prev) =>
          prev.map((t) =>
            t.keyword.toUpperCase() === res.keyword.toUpperCase()
              ? { ...t, triggers_count: res.triggers_count }
              : t
          )
        );
        showToast("success", `Disparador "${res.keyword}" ejecutado correctamente`);
      } else {
        showToast("info", "Ninguna palabra clave activa coincidió con ese comentario.");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error al probar disparador");
    } finally {
      setTestLoading(false);
    }
  };

  const persistProfile = async (closeAfter = true) => {
    setIsSaving(true);
    setSaveSuccess(false);

    const flatProfiles: Record<string, string> = {};
    for (const acc of socialAccounts) {
      if (acc.url.trim() && !flatProfiles[acc.platform]) {
        flatProfiles[acc.platform] = acc.url.trim();
      }
    }

    const firstTrigger = manychatTriggers.find((t) => t.active);
    const updatedCatalog = {
      ...(creatorProfile?.conversion_goals_catalog || {}),
      EMAIL_LEAD_CAPTURE: {
        objective: "Captación de leads vía ManyChat / DM automatizado",
        lead_magnet_name:
          leadMagnets.find((lm) => lm.id === firstTrigger?.lead_magnet_id)?.title ||
          leadMagnets[0]?.title ||
          "Guía Estratégica",
        trigger_word: firstTrigger?.keyword || "GUIA",
        automation_backend: "ManyChat",
        preferred_cta_style: `Comenta "${firstTrigger?.keyword || "GUIA"}" y te lo envío por privado`,
      },
    };

    const payload: Partial<CreatorProfile> = {
      name: name || "Creador",
      age: age ? parseInt(age, 10) : null,
      personal_brand_tagline: tagline,
      niche: niche || "Tecnología y Contenido",
      ideal_customer_profile: targetIcp || "Profesionales y creadores digitales",
      project_context: projectContext,
      strategic_goals: selectedGoals,
      communication_style: communicationStyle,
      visual_style: visualStyle,
      content_pillars: contentPillars,
      voice_guidelines: voiceGuidelines || null,
      social_profiles: flatProfiles,
      social_accounts: socialAccounts.filter((a) => a.url.trim()),
      github_repos: githubRepos.slice(0, 5),
      lead_magnets: leadMagnets,
      manychat_triggers: manychatTriggers,
      conversion_goals_catalog: updatedCatalog,
    };

    try {
      const saved = await apiClient.updateCreatorProfile(payload);
      setCreatorProfile(saved);
      setSaveSuccess(true);
      if (closeAfter) {
        showToast("success", "Paso 0 guardado: Perfil, Repos, Lead Magnets y ManyChat actualizados.");
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 700);
      }
    } catch {
      if (creatorProfile) {
        setCreatorProfile({ ...creatorProfile, ...payload } as CreatorProfile);
      }
      setSaveSuccess(true);
      if (closeAfter) {
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 700);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistProfile(true);
  };

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/80 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 text-cyan-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-cyan-500/20 border border-cyan-500/40 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                  PASO 0
                </span>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Perfil de Creador, Repositorios y Lead Magnets
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Autocompleta desde hasta 5 repos de GitHub o edita manualmente. Todo se guarda para tus guiones y ManyChat.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 5 Clean Subtabs */}
        <div className="flex flex-wrap border-b border-slate-800 bg-slate-950/50 px-6 pt-2 gap-1.5">
          {[
            { id: "importar" as const, label: "Importar GitHub (5) / IA", icon: GitBranch },
            { id: "general" as const, label: "Identidad y Nicho", icon: User },
            { id: "estilo" as const, label: "Tono y Pilares", icon: Palette },
            { id: "redes" as const, label: `Redes y Webs (${socialAccounts.length})`, icon: Globe },
            {
              id: "lead-magnets" as const,
              label: `Carpeta Lead Magnets (${leadMagnets.length}) & ManyChat`,
              icon: FolderOpen,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
                  active
                    ? "border-cyan-400 text-cyan-300 bg-cyan-500/5 rounded-t-lg"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: IMPORTAR GITHUB (HASTA 5 REPOS) & IA */}
          {activeSubTab === "importar" && (
            <div className="space-y-6">
              {/* Multi-Repo GitHub Importer */}
              <div className="rounded-2xl border border-violet-500/30 bg-slate-950/60 p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
                      <GitBranch className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Importar desde GitHub (Hasta 5 Repositorios)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Autocompleta todo tu Perfil de Creador, webs, pilares y extrae Lead Magnets directamente de tus repositorios. Luego puedes editar cualquier campo manualmente.
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-bold text-violet-300">
                    {repoSlugInputs.length} / 5 repos
                  </span>
                </div>

                <div className="space-y-2.5">
                  {repoSlugInputs.map((val, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-6 text-center text-xs font-bold text-slate-500">
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const next = [...repoSlugInputs];
                          next[idx] = e.target.value;
                          setRepoSlugInputs(next);
                        }}
                        placeholder="https://github.com/usuario/repositorio o usuario/repositorio"
                        className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                      />
                      {repoSlugInputs.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setRepoSlugInputs(repoSlugInputs.filter((_, i) => i !== idx))
                          }
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition"
                          title="Quitar repositorio"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  {repoSlugInputs.length < 5 ? (
                    <button
                      type="button"
                      onClick={() => setRepoSlugInputs([...repoSlugInputs, ""])}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-violet-400 hover:text-white transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Añadir otro repo ({repoSlugInputs.length}/5)</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-amber-300">
                      Límite de 5 repositorios alcanzado.
                    </span>
                  )}

                  <input
                    type="password"
                    value={githubTokenInput}
                    onChange={(e) => setGithubTokenInput(e.target.value)}
                    placeholder="Token GitHub opcional (solo si algún repo es privado)"
                    className="w-full sm:w-72 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleImportGithubBatch}
                  disabled={githubLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2.5 text-xs font-bold text-white hover:opacity-95 transition disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>
                    {githubLoading
                      ? "Analizando repositorios y autocompletando perfil..."
                      : "Importar Repositorios y Autocompletar Perfil + Lead Magnets"}
                  </span>
                </button>

                {githubRepos.length > 0 && (
                  <div className="pt-2 border-t border-slate-800">
                    <p className="text-[11px] font-semibold text-slate-400 mb-2">
                      Repositorios conectados actualmente:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {githubRepos.map((r) => (
                        <a
                          key={r.repo_full_name}
                          href={r.repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200 hover:border-violet-400"
                        >
                          <GitBranch className="h-3 w-3" />
                          <span>{r.repo_full_name}</span>
                          <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Feedback */}
              {importStatusMessage && (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{importStatusMessage}</span>
                </div>
              )}
              {importError && (
                <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Universal Prompt Extractor (Claude / Gemini / Codex / NotebookLM) */}
              <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/60 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Wand2 className="h-4 w-4 text-cyan-400" />
                    <h3 className="text-xs font-bold text-white">
                      Extractor Universal (Claude, Codex, Gemini o NotebookLM)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1 text-[11px] font-bold text-slate-950 hover:bg-cyan-400 transition"
                  >
                    {copiedPrompt ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedPrompt ? "¡Prompt Copiado!" : "Copiar Prompt"}</span>
                  </button>
                </div>
                <textarea
                  value={extractorJsonInput}
                  onChange={(e) => setExtractorJsonInput(e.target.value)}
                  rows={4}
                  placeholder="Pega aquí el bloque JSON devuelto por Claude, ChatGPT/Codex, Gemini o NotebookLM..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs font-mono text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyExtractorJson}
                  disabled={!extractorJsonInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 transition disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Aplicar JSON al Perfil</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: IDENTIDAD & NICHO */}
          {activeSubTab === "general" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nombre o Marca Personal *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: David, KigalDev..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Edad (Opcional)
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Ej: 32"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Propuesta de Valor / Tagline
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Ej: Solopreneurship, automatización con IA y sistemas de contenido."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nicho Principal *
                  </label>
                  <input
                    type="text"
                    required
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder="Ej: IA, SaaS y Automatización"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cliente o Audiencia Ideal (ICP) *
                  </label>
                  <input
                    type="text"
                    required
                    value={targetIcp}
                    onChange={(e) => setTargetIcp(e.target.value)}
                    placeholder="Ej: Founders y desarrolladores que buscan escalar..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Contexto Profundo del Proyecto (Editable manualmente)
                </label>
                <textarea
                  value={projectContext}
                  onChange={(e) => setProjectContext(e.target.value)}
                  rows={4}
                  placeholder="Resumen de tu producto, repositorios, casos de éxito..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Objetivos Estratégicos
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STRATEGIC_GOALS_OPTIONS.map((goal) => {
                    const checked = selectedGoals.includes(goal);
                    return (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => toggleGoal(goal)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
                          checked
                            ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
                            : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <Briefcase className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1">{goal}</span>
                        {checked && <Check className="h-3.5 w-3.5 text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ESTILO Y PILARES */}
          {activeSubTab === "estilo" && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Estilo de Comunicación
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {COMMUNICATION_PRESETS.map((p) => {
                    const active = communicationStyle === p.label;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setCommunicationStyle(p.label)}
                        className={`rounded-xl border p-3 text-left transition ${
                          active
                            ? "border-cyan-500 bg-cyan-500/10 text-white"
                            : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span>{p.label}</span>
                          {active && <Check className="h-3.5 w-3.5 text-cyan-400" />}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">{p.desc}</p>
                        <span className="mt-1.5 inline-block text-[10px] text-cyan-300">
                          {p.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Estilo Visual
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {VISUAL_STYLE_PRESETS.map((v) => {
                    const active = visualStyle === v.label;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVisualStyle(v.label)}
                        className={`rounded-xl border p-3 text-left transition ${
                          active
                            ? "border-violet-500 bg-violet-500/10 text-white"
                            : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span>{v.label}</span>
                          {active && <Check className="h-3.5 w-3.5 text-violet-400" />}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">{v.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Pilares de Contenido (separados por comas)
                  </label>
                  <textarea
                    value={contentPillars.join(", ")}
                    onChange={(e) =>
                      setContentPillars(
                        e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    rows={3}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Reglas de Voz e Innegociables
                  </label>
                  <textarea
                    value={voiceGuidelines}
                    onChange={(e) => setVoiceGuidelines(e.target.value)}
                    rows={3}
                    placeholder="Qué decir, qué evitar..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MULTIPLES REDES SOCIALES Y WEBS */}
          {activeSubTab === "redes" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Globe className="h-4 w-4 text-cyan-400" />
                    <span>Múltiples Cuentas Sociales y Sitios Web</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Añade tantas cuentas de la misma red social o páginas web como necesites (ej. canal personal + canal de marca, varias landings).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddSocialAccount}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Añadir Cuenta o Web</span>
                </button>
              </div>

              {socialAccounts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-xs text-slate-400">
                  No hay cuentas añadidas todavía. Pulsa «Añadir Cuenta o Web» o importa tus repos de GitHub.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {socialAccounts.map((acc, idx) => (
                    <div
                      key={acc.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border border-slate-800 bg-slate-950/70 p-2.5"
                    >
                      <div className="sm:col-span-3">
                        <select
                          value={acc.platform}
                          onChange={(e) => {
                            const next = [...socialAccounts];
                            next[idx] = { ...acc, platform: e.target.value };
                            setSocialAccounts(next);
                          }}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                        >
                          {SOCIAL_PLATFORM_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-3">
                        <input
                          type="text"
                          value={acc.label}
                          onChange={(e) => {
                            const next = [...socialAccounts];
                            next[idx] = { ...acc, label: e.target.value };
                            setSocialAccounts(next);
                          }}
                          placeholder="Etiqueta (ej: Canal Sec.)"
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <input
                          type="url"
                          value={acc.url}
                          onChange={(e) => {
                            const next = [...socialAccounts];
                            next[idx] = { ...acc, url: e.target.value };
                            setSocialAccounts(next);
                          }}
                          placeholder="https://..."
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setSocialAccounts(socialAccounts.filter((_, i) => i !== idx))
                          }
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition"
                          title="Eliminar cuenta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CARPETA DE LEAD MAGNETS & DISPARADORES MANYCHAT */}
          {activeSubTab === "lead-magnets" && (
            <div className="space-y-6">
              {/* SECTION A: CARPETA DE LEAD MAGNETS */}
              <div className="rounded-2xl border border-amber-500/30 bg-slate-950/60 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Carpeta de Lead Magnets ({leadMagnets.length})
                      </h3>
                      <p className="text-xs text-slate-400">
                        Almacena y visualiza todos tus recursos gratuitos (manuales o extraídos de GitHub) para enlazarlos con tus palabras clave.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Add Lead Magnet Inline */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={newLmTitle}
                      onChange={(e) => setNewLmTitle(e.target.value)}
                      placeholder="Nombre del Lead Magnet (ej: Guía IA 2026)"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <select
                      value={newLmFormat}
                      onChange={(e) => setNewLmFormat(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                    >
                      {LEAD_MAGNET_FORMATS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="url"
                      value={newLmUrl}
                      onChange={(e) => setNewLmUrl(e.target.value)}
                      placeholder="URL de entrega (Notion, Drive, GitHub...)"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddLeadMagnet}
                      disabled={!newLmTitle.trim() || !newLmUrl.trim()}
                      className="flex w-full items-center justify-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Guardar</span>
                    </button>
                  </div>
                </div>

                {/* Folder Grid */}
                {leadMagnets.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-400">
                    Tu carpeta está vacía. Añade uno arriba o importa tus repositorios desde la pestaña «Importar GitHub».
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {leadMagnets.map((lm) => (
                      <div
                        key={lm.id}
                        className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-2 hover:border-amber-500/40 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                                {lm.format}
                              </span>
                              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                                {lm.source.startsWith("github:") ? `GitHub: ${lm.source.replace("github:", "")}` : "Manual"}
                              </span>
                            </div>
                            <h4 className="mt-1.5 text-xs font-bold text-white truncate">
                              {lm.title}
                            </h4>
                            {lm.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                                {lm.description}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setLeadMagnets(leadMagnets.filter((item) => item.id !== lm.id))
                            }
                            className="rounded p-1 text-slate-500 hover:text-rose-400"
                            title="Eliminar Lead Magnet"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                          <a
                            href={lm.delivery_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-400 hover:underline truncate max-w-[230px]"
                          >
                            <LinkIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{lm.delivery_url}</span>
                          </a>
                          <span className="text-[10px] font-mono text-slate-500">
                            {manychatTriggers.filter((t) => t.lead_magnet_id === lm.id).length} triggers
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION B: DISPARADORES MANYCHAT */}
              <div className="rounded-2xl border border-emerald-500/30 bg-slate-950/60 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Disparadores de ManyChat & Respuesta Automática DM
                    </h3>
                    <p className="text-xs text-slate-400">
                      Crea múltiples palabras clave (ej. GUIA, CODIGO, SISTEMA) y enlázalas a tus Lead Magnets para entregar el enlace automáticamente.
                    </p>
                  </div>
                </div>

                {/* Add Trigger Rule */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={newTrigKeyword}
                      onChange={(e) => setNewTrigKeyword(e.target.value.toUpperCase())}
                      placeholder="Palabra (GUIA)"
                      className="w-full rounded-lg border border-emerald-500/40 bg-slate-950 px-2.5 py-2 text-xs font-bold uppercase text-emerald-300 placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <select
                      value={newTrigLmId}
                      onChange={(e) => setNewTrigLmId(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">-- Enlazar Lead Magnet --</option>
                      {leadMagnets.map((lm) => (
                        <option key={lm.id} value={lm.id}>
                          {lm.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <select
                      value={newTrigPlatform}
                      onChange={(e) => setNewTrigPlatform(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="all">Todas las redes</option>
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="youtube">YouTube</option>
                      <option value="linkedin">LinkedIn</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={newTrigTemplate}
                      onChange={(e) => setNewTrigTemplate(e.target.value)}
                      placeholder="Mensaje DM opcional"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddTriggerRule}
                      disabled={!newTrigKeyword.trim()}
                      className="flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Crear</span>
                    </button>
                  </div>
                </div>

                {/* Trigger Rules List */}
                <div className="space-y-2">
                  {manychatTriggers.map((trig, idx) => {
                    const linkedLm = leadMagnets.find((lm) => lm.id === trig.lead_magnet_id);
                    return (
                      <div
                        key={trig.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-extrabold tracking-wider text-emerald-300">
                            {trig.keyword}
                          </span>
                          <span className="text-xs text-slate-400">→</span>
                          <select
                            value={trig.lead_magnet_id || ""}
                            onChange={(e) => {
                              const next = [...manychatTriggers];
                              next[idx] = { ...trig, lead_magnet_id: e.target.value || null };
                              setManychatTriggers(next);
                            }}
                            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
                          >
                            <option value="">Sin Lead Magnet</option>
                            {leadMagnets.map((lm) => (
                              <option key={lm.id} value={lm.id}>
                                {lm.title}
                              </option>
                            ))}
                          </select>
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase text-slate-300">
                            {trig.platform}
                          </span>
                          {linkedLm && (
                            <span className="text-[11px] text-cyan-400 truncate max-w-[180px]">
                              {linkedLm.delivery_url}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-400">
                            {trig.triggers_count} envíos
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...manychatTriggers];
                              next[idx] = { ...trig, active: !trig.active };
                              setManychatTriggers(next);
                            }}
                            className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                              trig.active
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-slate-800 text-slate-500"
                            }`}
                          >
                            {trig.active ? "ACTIVO" : "PAUSADO"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setManychatTriggers(manychatTriggers.filter((_, i) => i !== idx))
                            }
                            className="rounded p-1 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live Simulator & Webhook Info */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                      Probar Disparador ManyChat en Vivo
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Webhook: POST {apiClient.apiBase}/api/v1/manychat/webhook
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={testComment}
                      onChange={(e) => setTestComment(e.target.value)}
                      placeholder="Simula un comentario (ej: Quiero la GUIA)"
                      className="flex-1 min-w-[200px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                    <select
                      value={testPlatform}
                      onChange={(e) => setTestPlatform(e.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="youtube">YouTube</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleTestManyChatTrigger}
                      disabled={testLoading || !testComment.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                    >
                      <Play className="h-3 w-3" />
                      <span>{testLoading ? "Ejecutando..." : "Probar"}</span>
                    </button>
                  </div>
                  {testOutput && (
                    <div
                      className={`rounded-lg border p-2.5 text-xs ${
                        testOutput.matched
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-200"
                      }`}
                    >
                      {testOutput.matched ? (
                        <div>
                          <p className="font-bold">
                            ✅ Lead Magnet enviado ({testOutput.lead_magnet_title || "Recurso"}):
                          </p>
                          <p className="mt-1 font-mono text-[11px]">{testOutput.dm_reply_text}</p>
                        </div>
                      ) : (
                        <p>No hubo coincidencia con ninguna palabra clave activa.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Footer Save Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <span className="text-xs text-slate-400">
              {saveSuccess
                ? "✅ ¡Perfil de Paso 0 guardado correctamente!"
                : "Todos los campos son editables manualmente antes o después de importar."}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? "Guardando..." : "Guardar Paso 0"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </dialog>
  );
};
