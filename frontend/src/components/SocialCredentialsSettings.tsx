"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Youtube,
  Instagram,
  Linkedin,
  ShieldCheck,
  ExternalLink,
  Key,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Cpu,
  Server,
  Cloud,
  Sparkles,
  Zap,
  Save,
  Search,
  RefreshCw,
} from "lucide-react";
import { AstryxBadge, AstryxButton } from "@/components/ui/AstryxPrimitives";
import { apiClient } from "@/lib/api";
import type { LinkedInAdLibraryStatusResponse } from "@/types/engine";

interface SocialChannelGuide {
  id: "youtube" | "instagram" | "tiktok" | "linkedin";
  name: string;
  icon: React.ReactNode;
  brandColor: string;
  badgeBg: string;
  credentialName: string;
  credentialPlaceholder: string;
  portalUrl: string;
  portalName: string;
  recommendedScopes: string[];
  steps: Array<{
    title: string;
    detail: string;
  }>;
  antiBanNotice: string;
}

const CHANNELS_GUIDE: SocialChannelGuide[] = [
  {
    id: "youtube",
    name: "YouTube",
    icon: <Youtube className="w-5 h-5 text-red-400" />,
    brandColor: "border-red-500/40 text-red-300",
    badgeBg: "bg-red-500/10 text-red-300 border-red-500/20",
    credentialName: "OAuth 2.0 Access Token / Refresh Token",
    credentialPlaceholder: "ya29.a0AfH6SM...",
    portalUrl: "https://console.cloud.google.com/apis/dashboard",
    portalName: "Google Cloud Console",
    recommendedScopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    steps: [
      {
        title: "1. Crear o seleccionar un Proyecto en Google Cloud",
        detail:
          "Inicia sesión en Google Cloud Console con la cuenta asociada a tu canal de YouTube y crea un nuevo proyecto llamado 'KigalContent Studio'.",
      },
      {
        title: "2. Activar la 'YouTube Data API v3'",
        detail:
          "En el menú lateral, dirígete a 'APIs y Servicios' > 'Biblioteca'. Busca 'YouTube Data API v3' y pulsa en 'Habilitar'.",
      },
      {
        title: "3. Configurar Pantalla de Consentimiento OAuth",
        detail:
          "Elige tipo de usuario 'Externo', introduce el nombre de la app y tu correo de soporte. En 'Permisos (Scopes)', agrega '.../auth/youtube.upload'.",
      },
      {
        title: "4. Crear Credenciales de Cliente OAuth",
        detail:
          "En 'Credenciales' > 'Crear Credencial' > 'ID de cliente de OAuth'. Selecciona tipo 'Aplicación web' o 'App de escritorio' y copia tu Token generado.",
      },
    ],
    antiBanNotice:
      "Google limita la cuota estándar a 10,000 unidades diarias. Subir un video consume 1,600 unidades (máximo 6 videos/día en cuota base).",
  },
  {
    id: "instagram",
    name: "Instagram Reels",
    icon: <Instagram className="w-5 h-5 text-pink-400" />,
    brandColor: "border-pink-500/40 text-pink-300",
    badgeBg: "bg-pink-500/10 text-pink-300 border-pink-500/20",
    credentialName: "Instagram Graph API User Access Token",
    credentialPlaceholder: "EAAO7XwYZBk8BA...",
    portalUrl: "https://developers.facebook.com/apps/",
    portalName: "Meta for Developers",
    recommendedScopes: [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
    ],
    steps: [
      {
        title: "1. Convertir cuenta de Instagram a Profesional / Creador",
        detail:
          "Tu cuenta debe ser de tipo 'Creador' o 'Empresa' y estar vinculada a una Página de Facebook pública en la app de Instagram.",
      },
      {
        title: "2. Crear una App en Meta for Developers",
        detail:
          "Regístrate en Meta for Developers, pulsa 'Crear aplicación' y selecciona el caso de uso 'Negocios' o 'Otro' (con permisos de Instagram Graph API).",
      },
      {
        title: "3. Abrir el 'Explorador de la API Graph'",
        detail:
          "Ve a 'Herramientas' > 'Explorador de la Graph API'. Selecciona tu App y agrega los permisos 'instagram_content_publish' y 'instagram_basic'.",
      },
      {
        title: "4. Generar Token de Larga Duración (60 días)",
        detail:
          "Pulsa 'Generate Access Token'. Luego, mediante el Access Token Debugger de Meta, extiende el token para que dure 60 días sin caducar.",
      },
    ],
    antiBanNotice:
      "Meta impone un límite de 50 publicaciones por cada 24 horas y exige que los videos sean estrictamente verticales (9:16) con audio activo.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: (
      <span className="w-5 h-5 flex items-center justify-center font-bold text-cyan-400">
        TT
      </span>
    ),
    brandColor: "border-cyan-500/40 text-cyan-300",
    badgeBg: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    credentialName: "TikTok Content Posting API Client Key / Bearer Token",
    credentialPlaceholder: "act.d7281bc98ef...",
    portalUrl: "https://developers.tiktok.com/",
    portalName: "TikTok for Developers Portal",
    recommendedScopes: ["video.publish", "video.upload", "user.info.basic"],
    steps: [
      {
        title: "1. Registrarse como Desarrollador en TikTok",
        detail:
          "Inicia sesión en developers.tiktok.com con tu cuenta de creador de TikTok y completa la verificación de perfil.",
      },
      {
        title: "2. Crear una App de 'Content Posting API'",
        detail:
          "Crea una aplicación y selecciona la categoría 'Content Creation'. Solicita los scopes 'video.publish' y 'video.upload'.",
      },
      {
        title: "3. Obtener Client Key & Client Secret",
        detail:
          "Copia la 'Client Key' y genera el Token de autenticación de tu usuario en la consola de testing de TikTok.",
      },
      {
        title: "4. Modo Direct Post o Share to Inbox",
        detail:
          "TikTok permite publicar directamente en el feed o enviar el video a la bandeja de entrada de tu app de TikTok para darle el OK con 1 tap.",
      },
    ],
    antiBanNotice:
      "TikTok penaliza cuentas con publicaciones automatizadas simultáneas sin variación de texto. El motor incluye rotación de ganchos para proteger tu cuenta.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: <Linkedin className="w-5 h-5 text-blue-400" />,
    brandColor: "border-blue-500/40 text-blue-300",
    badgeBg: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    credentialName: "OAuth 2.0 Bearer Access Token (Member / Organization)",
    credentialPlaceholder: "AQV-982_jkLqWz...",
    portalUrl: "https://www.linkedin.com/developers/apps",
    portalName: "LinkedIn Developer Portal",
    recommendedScopes: ["w_member_social", "r_liteprofile", "r_emailaddress"],
    steps: [
      {
        title: "1. Crear una Aplicación en LinkedIn Developers",
        detail:
          "Accede al portal de desarrolladores de LinkedIn y pulsa 'Create app'. Asocia tu Página de Empresa o perfil personal.",
      },
      {
        title: "2. Solicitar Acceso al Producto 'Share on LinkedIn'",
        detail:
          "En la pestaña 'Products' de tu aplicación, solicita 'Share on LinkedIn' y 'Sign In with LinkedIn using OpenID Connect'.",
      },
      {
        title: "3. Configurar URL de Redirección",
        detail:
          "En 'Auth', añade tu dominio o callback local. Autoriza a tu usuario y obtén el 'Access Token' con permiso 'w_member_social'.",
      },
      {
        title: "4. Pegar Token en KigalContent",
        detail:
          "Pega el token abajo. El motor programará las publicaciones cuidando la regla de 'enlaces en el primer comentario' para no restar visibilidad.",
      },
    ],
    antiBanNotice:
      "LinkedIn penaliza drásticamente los posts con enlaces externos en el texto principal. El motor los coloca automáticamente en el primer comentario.",
  },
];

type LLMProviderMode = "auto" | "ollama" | "anthropic" | "openai_compatible" | "deterministic";

interface RecommendedLocalModel {
  tier_ram: string;
  model_id: string;
  pull_command: string;
  ram_usage_gb: string;
  role: string;
  spanish_quality: string;
  recommended: boolean;
}

interface LoadedSkillSpec {
  agent_id: string;
  filename: string;
  title: string;
  char_count: number;
  estimated_tokens: number;
}

const DEFAULT_LOCAL_MODELS: RecommendedLocalModel[] = [
  {
    tier_ram: "24GB",
    model_id: "qwen3:14b",
    pull_command: "ollama pull qwen3:14b",
    ram_usage_gb: "~9.5 GB",
    role: "Equilibrio ideal hoy: español natural, modo razonamiento y JSON estricto",
    spanish_quality: "Excelente",
    recommended: true,
  },
  {
    tier_ram: "24GB",
    model_id: "gemma3:12b",
    pull_command: "ollama pull gemma3:12b",
    ram_usage_gb: "~8.1 GB",
    role: "Ultraligero y veloz para ganchos virales cortos",
    spanish_quality: "Muy Buena",
    recommended: false,
  },
  {
    tier_ram: "24GB",
    model_id: "mistral-small3.1:24b",
    pull_command: "ollama pull mistral-small3.1:24b",
    ram_usage_gb: "~14.5 GB",
    role: "Especialista en agentes y JSON sin roturas (justo en 24 GB)",
    spanish_quality: "Muy Buena",
    recommended: false,
  },
  {
    tier_ram: "48GB",
    model_id: "qwen3:32b",
    pull_command: "ollama pull qwen3:32b",
    ram_usage_gb: "~22.0 GB",
    role: "Estrella en 48 GB: calidad narrativa nivel API comercial",
    spanish_quality: "Sobresaliente",
    recommended: true,
  },
  {
    tier_ram: "48GB",
    model_id: "mistral-small3.1:24b-instruct-2503-q8_0",
    pull_command: "ollama pull mistral-small3.1:24b-instruct-2503-q8_0",
    ram_usage_gb: "~25.0 GB",
    role: "Fidelidad Q8 casi sin compresión para cumplir reglas estrictas",
    spanish_quality: "Excelente",
    recommended: false,
  },
  {
    tier_ram: "48GB",
    model_id: "bge-m3",
    pull_command: "ollama pull bge-m3",
    ram_usage_gb: "~1.2 GB",
    role: "Embeddings locales gratuitos para la Bóveda de Ganchos",
    spanish_quality: "Nativo",
    recommended: true,
  },
];

export const SocialCredentialsSettings: React.FC = () => {
  const [activeChannelId, setActiveChannelId] = useState<"youtube" | "instagram" | "tiktok" | "linkedin">("linkedin");
  const [tokens, setTokens] = useState<Record<string, string>>({
    youtube: "",
    instagram: "",
    tiktok: "",
    linkedin: "",
  });
  const [linkedinPersonUrn, setLinkedinPersonUrn] = useState("");
  const [serverCreds, setServerCreds] = useState<
    Record<
      string,
      {
        configured: boolean;
        source: string;
        person_urn: string;
        account_name: string;
        masked_token: string;
      }
    >
  >({});
  const [savingCred, setSavingCred] = useState(false);
  const [testingCred, setTestingCred] = useState(false);
  const [credFeedback, setCredFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isSandboxMode, setIsSandboxMode] = useState(true);
  const [showTutorial, setShowTutorial] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // LinkedIn Ads Library status & optional dedicated token state
  const [adLibStatus, setAdLibStatus] = useState<LinkedInAdLibraryStatusResponse | null>(null);
  const [checkingAdLib, setCheckingAdLib] = useState(false);
  const [adLibError, setAdLibError] = useState<string | null>(null);
  const [showDedicatedAdsToken, setShowDedicatedAdsToken] = useState(false);
  const [linkedinAdsToken, setLinkedinAdsToken] = useState("");
  const [savingAdsCred, setSavingAdsCred] = useState(false);
  const [testingAdsCred, setTestingAdsCred] = useState(false);
  const [adsCredFeedback, setAdsCredFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Visual & AI generation providers (Nano Banana / Gemini, GPT Images / OpenAI, Canva)
  const [visualApiKeys, setVisualApiKeys] = useState<Record<string, string>>({
    gemini_nano_banana: "",
    openai_gpt_images: "",
    canva: "",
  });
  const [savingVisualKey, setSavingVisualKey] = useState<string | null>(null);
  const [testingVisualKey, setTestingVisualKey] = useState<string | null>(null);
  const [visualKeyFeedback, setVisualKeyFeedback] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});

  const VISUAL_AI_PROVIDERS = [
    {
      channel: "gemini_nano_banana" as const,
      title: "🍌 Nano Banana (Google Gemini)",
      subtitle: "Generación de imágenes/infografías (Gemini 2.5 Flash Image / Imagen 3) + Redactor IA LinkedIn (Gemini 2.5 Flash)",
      placeholder: "AIzaSy... (Google AI Studio API Key)",
      portalUrl: "https://aistudio.google.com/apikey",
      portalLabel: "Obtener API Key en Google AI Studio",
    },
    {
      channel: "openai_gpt_images" as const,
      title: "🎨 GPT Images (OpenAI)",
      subtitle: "Generación de imágenes (GPT-Image-1 / DALL-E 3) + Redactor IA LinkedIn (GPT-4o-mini)",
      placeholder: "sk-proj-... (OpenAI API Key)",
      portalUrl: "https://platform.openai.com/api-keys",
      portalLabel: "Obtener API Key en OpenAI",
    },
    {
      channel: "canva" as const,
      title: "🧩 Canva Connect API",
      subtitle: "Verifica tu cuenta Canva Connect para integración directa de diseños y plantillas",
      placeholder: "OAuth 2.0 Access Token de Canva Connect",
      portalUrl: "https://www.canva.dev/",
      portalLabel: "Abrir Canva Developers",
    },
  ];

  const handleSaveVisualKey = async (channel: "gemini_nano_banana" | "openai_gpt_images" | "canva") => {
    const rawKey = (visualApiKeys[channel] || "").trim();
    if (!rawKey) {
      setVisualKeyFeedback((prev) => ({
        ...prev,
        [channel]: { ok: false, message: "Pega tu API Key o Token antes de guardar." },
      }));
      return;
    }
    setSavingVisualKey(channel);
    try {
      await apiClient.saveSocialCredential({
        channel,
        access_token: rawKey,
      });
      setVisualApiKeys((prev) => ({ ...prev, [channel]: "" }));
      await loadSocialCredentials();
      setVisualKeyFeedback((prev) => ({
        ...prev,
        [channel]: {
          ok: true,
          message: `Clave guardada en PostgreSQL. Pulsa "Probar Conexión" para verificarla en vivo.`,
        },
      }));
    } catch (err) {
      setVisualKeyFeedback((prev) => ({
        ...prev,
        [channel]: {
          ok: false,
          message: err instanceof Error ? err.message : "No se pudo guardar la clave.",
        },
      }));
    } finally {
      setSavingVisualKey(null);
    }
  };

  const handleTestVisualKey = async (channel: "gemini_nano_banana" | "openai_gpt_images" | "canva") => {
    setTestingVisualKey(channel);
    try {
      const res = await apiClient.testSocialCredential({
        channel,
        access_token: (visualApiKeys[channel] || "").trim() || undefined,
      });
      await loadSocialCredentials();
      setVisualKeyFeedback((prev) => ({
        ...prev,
        [channel]: {
          ok: res.ok,
          message: res.message,
        },
      }));
    } catch (err) {
      setVisualKeyFeedback((prev) => ({
        ...prev,
        [channel]: {
          ok: false,
          message: err instanceof Error ? err.message : "Error al verificar la conexión.",
        },
      }));
    } finally {
      setTestingVisualKey(null);
    }
  };

  const loadSocialCredentials = async () => {
    try {
      const data = await apiClient.getSocialCredentials();
      if (data?.channels) {
        setServerCreds(data.channels);
        if (data.channels.linkedin?.person_urn) {
          setLinkedinPersonUrn(data.channels.linkedin.person_urn);
        }
        const anyConfigured = Object.values(data.channels).some((c) => c.configured);
        if (anyConfigured) setIsSandboxMode(false);
      }
    } catch {
      // silent offline fallback
    }
  };

  const checkLinkedInAdLibraryStatus = useCallback(async () => {
    setCheckingAdLib(true);
    setAdLibError(null);
    try {
      const status = await apiClient.getLinkedInAdLibraryStatus();
      setAdLibStatus(status);
    } catch (err) {
      setAdLibStatus(null);
      setAdLibError(
        err instanceof Error
          ? err.message
          : "No se pudo verificar el estado de LinkedIn Ads Library API."
      );
    } finally {
      setCheckingAdLib(false);
    }
  }, []);

  useEffect(() => {
    void loadSocialCredentials();
  }, []);

  useEffect(() => {
    if (activeChannelId === "linkedin") {
      void checkLinkedInAdLibraryStatus();
    }
  }, [activeChannelId, checkLinkedInAdLibraryStatus]);

  const handleSaveChannelToken = async () => {
    const tokenVal = tokens[activeChannelId]?.trim() || "";
    if (!tokenVal && !serverCreds[activeChannelId]?.configured) {
      setCredFeedback({
        ok: false,
        message: "Introduce primero tu Access Token oficial antes de guardar.",
      });
      return;
    }
    setSavingCred(true);
    setCredFeedback(null);
    try {
      await apiClient.saveSocialCredential({
        channel: activeChannelId,
        access_token: tokenVal,
        person_urn: activeChannelId === "linkedin" ? linkedinPersonUrn.trim() || undefined : undefined,
      });
      setTokens((prev) => ({ ...prev, [activeChannelId]: "" }));
      await loadSocialCredentials();
      if (activeChannelId === "linkedin") {
        await checkLinkedInAdLibraryStatus();
      }
      setCredFeedback({
        ok: true,
        message: `✅ Token de ${activeGuide.name} guardado en el servidor. Pulsa 'Probar Conexión' para verificar permisos en vivo.`,
      });
    } catch (err) {
      setCredFeedback({
        ok: false,
        message: err instanceof Error ? err.message : "Error guardando credencial en el servidor.",
      });
    } finally {
      setSavingCred(false);
    }
  };

  const handleTestChannelToken = async () => {
    setTestingCred(true);
    setCredFeedback(null);
    try {
      const res = await apiClient.testSocialCredential({
        channel: activeChannelId,
        access_token: tokens[activeChannelId]?.trim() || undefined,
        person_urn: activeChannelId === "linkedin" ? linkedinPersonUrn.trim() || undefined : undefined,
      });
      if (res.person_urn && activeChannelId === "linkedin") {
        setLinkedinPersonUrn(res.person_urn);
      }
      if (res.ok) {
        setTokens((prev) => ({ ...prev, [activeChannelId]: "" }));
        await loadSocialCredentials();
      }
      if (activeChannelId === "linkedin") {
        await checkLinkedInAdLibraryStatus();
      }
      setCredFeedback({ ok: res.ok, message: res.message });
    } catch (err) {
      setCredFeedback({
        ok: false,
        message: err instanceof Error ? err.message : "Error verificando conexión con la API oficial.",
      });
    } finally {
      setTestingCred(false);
    }
  };

  const handleSaveLinkedinAdsToken = async () => {
    const tokenVal = linkedinAdsToken.trim();
    if (!tokenVal) {
      setAdsCredFeedback({
        ok: false,
        message: "Pega un Access Token OAuth autorizado para LinkedIn Ad Library antes de guardar.",
      });
      return;
    }
    setSavingAdsCred(true);
    setAdsCredFeedback(null);
    try {
      await apiClient.saveSocialCredential({
        channel: "linkedin_ads",
        access_token: tokenVal,
      });
      setLinkedinAdsToken("");
      await loadSocialCredentials();
      await checkLinkedInAdLibraryStatus();
      setAdsCredFeedback({
        ok: true,
        message: "✅ Token dedicado para LinkedIn Ads Library guardado en el servidor.",
      });
    } catch (err) {
      setAdsCredFeedback({
        ok: false,
        message: err instanceof Error ? err.message : "Error guardando token dedicado de LinkedIn Ads.",
      });
    } finally {
      setSavingAdsCred(false);
    }
  };

  const handleTestLinkedinAdsToken = async () => {
    setTestingAdsCred(true);
    setAdsCredFeedback(null);
    try {
      const res = await apiClient.testSocialCredential({
        channel: "linkedin_ads",
        access_token: linkedinAdsToken.trim() || undefined,
      });
      if (res.ok) {
        setLinkedinAdsToken("");
        await loadSocialCredentials();
      }
      await checkLinkedInAdLibraryStatus();
      setAdsCredFeedback({ ok: res.ok, message: res.message });
    } catch (err) {
      setAdsCredFeedback({
        ok: false,
        message: err instanceof Error ? err.message : "Error probando el token de LinkedIn Ads Library.",
      });
    } finally {
      setTestingAdsCred(false);
    }
  };

  // Hybrid Skill-Aware LLM Router state
  const [llmProvider, setLlmProvider] = useState<LLMProviderMode>("auto");
  const [ramTier, setRamTier] = useState<"24GB" | "48GB">("24GB");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("qwen3:14b");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [anthropicKeyConfigured, setAnthropicKeyConfigured] = useState(false);
  const [openAiBaseUrl, setOpenAiBaseUrl] = useState("https://openrouter.ai/api/v1");
  const [openAiModel, setOpenAiModel] = useState("qwen/qwen-2.5-72b-instruct");
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [loadedSkills, setLoadedSkills] = useState<LoadedSkillSpec[]>([]);
  const [localModels, setLocalModels] = useState<RecommendedLocalModel[]>(DEFAULT_LOCAL_MODELS);
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<{
    reachable: boolean;
    provider: string;
    message: string;
    installed_models: string[];
    fallback_used: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/v1/llm/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.active_provider) setLlmProvider(data.active_provider);
        if (data.ollama_base_url) setOllamaBaseUrl(data.ollama_base_url);
        if (data.ollama_model) setOllamaModel(data.ollama_model);
        if (typeof data.anthropic_key_configured === "boolean") {
          setAnthropicKeyConfigured(data.anthropic_key_configured);
        }
        if (data.openai_compatible_base_url) setOpenAiBaseUrl(data.openai_compatible_base_url);
        if (data.openai_compatible_model) setOpenAiModel(data.openai_compatible_model);
        if (Array.isArray(data.loaded_skills)) setLoadedSkills(data.loaded_skills);
        if (Array.isArray(data.recommended_local_models) && data.recommended_local_models.length > 0) {
          setLocalModels(data.recommended_local_models);
        }
      })
      .catch(() => {
        // Fallback silently when running offline
      });
  }, []);

  const handleSaveLlmConfig = async () => {
    setLlmSaving(true);
    try {
      const res = await fetch("/api/v1/llm/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active_provider: llmProvider,
          ollama_base_url: ollamaBaseUrl.trim(),
          ollama_model: ollamaModel.trim(),
          anthropic_api_key: anthropicApiKey.trim() || undefined,
          openai_compatible_base_url: openAiBaseUrl.trim(),
          openai_compatible_model: openAiModel.trim(),
          openai_compatible_api_key: openAiApiKey.trim() || undefined,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAnthropicKeyConfigured(Boolean(updated.anthropic_key_configured));
        setAnthropicApiKey("");
        setOpenAiApiKey("");
        setLlmTestResult({
          reachable: true,
          provider: updated.effective_provider,
          message: "Configuración de motor IA y Skills guardada correctamente.",
          installed_models: [],
          fallback_used: false,
        });
      }
    } finally {
      setLlmSaving(false);
    }
  };

  const handleTestLlmConnection = async () => {
    setLlmTesting(true);
    try {
      const res = await fetch("/api/v1/llm/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: llmProvider,
          ollama_base_url: ollamaBaseUrl.trim(),
          ollama_model: ollamaModel.trim(),
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setLlmTestResult(result);
      }
    } catch {
      setLlmTestResult({
        reachable: false,
        provider: llmProvider,
        message: "Backend local no alcanzable desde el navegador. Se usará el fallback determinista.",
        installed_models: [],
        fallback_used: true,
      });
    } finally {
      setLlmTesting(false);
    }
  };

  const activeGuide = CHANNELS_GUIDE.find((c) => c.id === activeChannelId)!;

  const handleCopyScope = (scope: string) => {
    navigator.clipboard.writeText(scope);
    setCopiedKey(scope);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Hybrid Skill-Aware LLM Router Card (MiniPC Local Ollama vs Claude Prompt Caching) */}
      <div className="rounded-2xl border border-violet-500/30 bg-slate-900/90 p-5 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Motor de Inteligencia Artificial y Skills (MiniPC Local vs Cloud API)
                <span className="text-[10px] font-semibold bg-violet-500/20 text-violet-200 border border-violet-500/30 px-2 py-0.5 rounded-full">
                  {loadedSkills.length || 6} Skills Activas
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Inyecta automáticamente las reglas de los 6 agentes especialistas en modelos locales de tu MiniPC (coste 0,00 €) o en Claude API con Prompt Caching (-90% coste).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestLlmConnection}
              disabled={llmTesting}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:border-cyan-400 text-xs font-semibold text-cyan-300 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              {llmTesting ? "Probando..." : "Probar Conexión"}
            </button>
            <button
              type="button"
              onClick={handleSaveLlmConfig}
              disabled={llmSaving}
              className="px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {llmSaving ? "Guardando..." : "Guardar Motor IA"}
            </button>
          </div>
        </div>

        {/* 1-Click Provider Mode Selector */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            {
              id: "auto" as const,
              title: "Híbrido Inteligente (Auto)",
              sub: "Intenta MiniPC -> Cloud -> Instantáneo",
              icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
            },
            {
              id: "ollama" as const,
              title: "MiniPC Local (Ollama)",
              sub: "Coste 0,00 € · Privacidad total",
              icon: <Server className="w-4 h-4 text-emerald-400" />,
            },
            {
              id: "anthropic" as const,
              title: "Claude API (-90% Caché)",
              sub: "Prompt Caching activado en Skills",
              icon: <Cloud className="w-4 h-4 text-violet-400" />,
            },
            {
              id: "deterministic" as const,
              title: "Paramétrico Instantáneo",
              sub: "Sin llamadas LLM · 0 ms latencia",
              icon: <Zap className="w-4 h-4 text-amber-400" />,
            },
          ].map((opt) => (
            <button
              type="button"
              key={opt.id}
              onClick={() => setLlmProvider(opt.id)}
              className={`p-3 rounded-xl border text-left transition ${
                llmProvider === opt.id
                  ? "bg-slate-800/90 border-cyan-400 shadow-lg"
                  : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-white">
                {opt.icon}
                <span>{opt.title}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{opt.sub}</p>
            </button>
          ))}
        </div>

        {/* Configuration Fields + MiniPC Hardware Tier Selector */}
        <div className="grid lg:grid-cols-2 gap-4 text-xs">
          {/* Left: Endpoint & Keys */}
          <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <div className="font-bold text-slate-200 flex items-center justify-between">
              <span>Conexión a Ollama (MiniPC) o APIs Cloud</span>
              <span className="text-[10px] font-mono text-slate-400">
                {anthropicKeyConfigured ? "Claude Key guardada" : "Fallback seguro activo"}
              </span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">
                URL de Ollama (Local o Túnel Cloudflare hacia tu MiniPC)
              </label>
              <input
                type="url"
                value={ollamaBaseUrl}
                onChange={(e) => setOllamaBaseUrl(e.target.value)}
                placeholder="http://localhost:11434 o https://ollama.tudominio.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-400 mb-1">Modelo Activo en Ollama</label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  Claude API Key (Opcional · Prompt Caching)
                </label>
                <input
                  type="password"
                  value={anthropicApiKey}
                  onChange={(e) => setAnthropicApiKey(e.target.value)}
                  placeholder={anthropicKeyConfigured ? "•••••••• (guardada)" : "sk-ant-api03-..."}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-violet-400"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-2.5 pt-1 border-t border-slate-800/80">
              <div>
                <label className="block text-slate-400 mb-1">OpenRouter / Compatible URL</label>
                <input
                  type="url"
                  value={openAiBaseUrl}
                  onChange={(e) => setOpenAiBaseUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">OpenRouter API Key (Opcional)</label>
                <input
                  type="password"
                  value={openAiApiKey}
                  onChange={(e) => setOpenAiApiKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Right: Recommended Local Models by MiniPC RAM */}
          <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">
                Modelos Recomendados para tu MiniPC
              </span>
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                {(["24GB", "48GB"] as const).map((tier) => (
                  <button
                    type="button"
                    key={tier}
                    onClick={() => setRamTier(tier)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                      ramTier === tier
                        ? "bg-emerald-500 text-slate-950"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tier} RAM
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {localModels
                .filter((m) => m.tier_ram === ramTier)
                .map((m) => (
                  <div
                    key={m.model_id}
                    className={`p-2.5 rounded-lg border transition flex items-start justify-between gap-2 ${
                      ollamaModel === m.model_id
                        ? "bg-emerald-950/30 border-emerald-500/60"
                        : "bg-slate-900/70 border-slate-800"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOllamaModel(m.model_id)}
                          className="font-mono font-bold text-cyan-300 hover:underline text-left"
                        >
                          {m.model_id}
                        </button>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {m.ram_usage_gb}
                        </span>
                        {m.recommended && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                            Recomendado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">{m.role}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyScope(m.pull_command)}
                      title={`Copiar comando: ${m.pull_command}`}
                      className="px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-300 hover:border-cyan-400 flex items-center gap-1 shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedKey === m.pull_command ? "Copiado" : "pull"}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Connection Probe Output & Active Skills Badges */}
        {llmTestResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
              llmTestResult.reachable && !llmTestResult.fallback_used
                ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                : "bg-amber-950/30 border-amber-500/40 text-amber-200"
            }`}
          >
            <span>
              <strong>Estado ({llmTestResult.provider}):</strong> {llmTestResult.message}
            </span>
            {llmTestResult.installed_models.length > 0 && (
              <span className="font-mono text-[11px] text-emerald-300">
                Instalados: {llmTestResult.installed_models.slice(0, 4).join(", ")}
              </span>
            )}
          </div>
        )}

        {loadedSkills.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
            <span className="text-slate-400 font-semibold mr-1">Skills cargadas:</span>
            {loadedSkills.map((sk) => (
              <span
                key={sk.agent_id}
                title={`${sk.filename} (~${sk.estimated_tokens} tokens)`}
                className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-mono"
              >
                {sk.agent_id} ({sk.estimated_tokens}t)
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Header Banner with Sandbox / Production Toggle */}
      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Conexiones Oficiales y Credenciales de Redes Sociales
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  APIs Oficiales
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configura los accesos oficiales para que el motor publique automáticamente tras tu aprobación de seguridad humana.
              </p>
            </div>
          </div>

          {/* Sandbox Toggle Pill */}
          <div className="flex items-center gap-2.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setIsSandboxMode(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                isSandboxMode
                  ? "bg-cyan-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Modo Sandbox Seguro (Activo)
            </button>
            <button
              type="button"
              onClick={() => setIsSandboxMode(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                !isSandboxMode
                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Modo Producción en Vivo
            </button>
          </div>
        </div>

        {isSandboxMode && (
          <div className="mt-4 p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200 flex items-center gap-2.5">
            <span className="text-sm">🛡️</span>
            <p>
              <strong>Estás en Modo Sandbox / Pruebas:</strong> Puedes generar videos, guiones, textos y aprobar publicaciones de forma 100% segura. El sistema simulará la publicación real y verificará todas las reglas de formato sin publicar nada en tus cuentas reales hasta que decidas activar el modo producción.
            </p>
          </div>
        )}
      </div>

      {/* Social Network Channel Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {CHANNELS_GUIDE.map((ch) => {
          const isSelected = activeChannelId === ch.id;
          const serverInfo = serverCreds[ch.id];
          const hasToken = Boolean(serverInfo?.configured || tokens[ch.id]?.trim());
          return (
            <button
              type="button"
              key={ch.id}
              onClick={() => {
                setActiveChannelId(ch.id);
                setCredFeedback(null);
              }}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 ${
                isSelected
                  ? `bg-slate-850 ${ch.brandColor} border-2 shadow-lg`
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-white">
                  {ch.icon}
                  {ch.name}
                </div>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    serverInfo?.configured
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : hasToken
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {serverInfo?.configured ? "En Vivo" : hasToken ? "Sin Guardar" : "Sin Clave"}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 truncate">
                {serverInfo?.configured
                  ? serverInfo.account_name || `Conectado (${serverInfo.source})`
                  : "Simulación Sandbox"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Channel Detail Panel */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            {activeGuide.icon}
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Configuración de {activeGuide.name}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${activeGuide.badgeBg}`}>
                  Conector Oficial
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Publicación directa de Reels, Shorts, Videos largos y Artículos.
              </p>
            </div>
          </div>

          <a
            href={activeGuide.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-300 border border-slate-700 transition self-start sm:self-auto"
          >
            Abrir {activeGuide.portalName}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Credential Input */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              {activeGuide.credentialName}
            </span>
            <span className="text-[11px] font-normal">
              {serverCreds[activeChannelId]?.configured ? (
                <span className="text-emerald-300 font-semibold">
                  ✓ Guardado en servidor ({serverCreds[activeChannelId].masked_token})
                </span>
              ) : (
                <span className="text-amber-300">Sin token guardado en servidor</span>
              )}
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              type="password"
              value={tokens[activeChannelId]}
              onChange={(e) =>
                setTokens((prev) => ({ ...prev, [activeChannelId]: e.target.value }))
              }
              placeholder={
                serverCreds[activeChannelId]?.configured
                  ? "Deja vacío para mantener el token actual o pega uno nuevo para sustituirlo..."
                  : activeGuide.credentialPlaceholder
              }
              className="flex-1 min-w-[220px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            />
            <button
              type="button"
              onClick={() => void handleSaveChannelToken()}
              disabled={savingCred}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition inline-flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {savingCred ? "Guardando..." : "Guardar Token"}
            </button>
            <button
              type="button"
              onClick={() => void handleTestChannelToken()}
              disabled={testingCred}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-200 text-xs font-semibold border border-slate-700 transition inline-flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              {testingCred ? "Verificando..." : "Probar Conexión"}
            </button>
          </div>

          {activeChannelId === "linkedin" && (
            <label className="block text-xs text-slate-300 pt-1">
              <span className="text-[11px] font-semibold text-slate-300 block mb-1">
                LinkedIn Person URN (se rellena automáticamente al pulsar &ldquo;Probar Conexión&rdquo;)
              </span>
              <input
                type="text"
                value={linkedinPersonUrn}
                onChange={(e) => setLinkedinPersonUrn(e.target.value)}
                placeholder="urn:li:person:xxxxxxxx (opcional, auto-detectado)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-cyan-200 font-mono focus:outline-none focus:border-cyan-400"
              />
            </label>
          )}

          {credFeedback && (
            <div
              className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${
                credFeedback.ok
                  ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
                  : "border-rose-500/40 bg-rose-950/30 text-rose-200"
              }`}
            >
              {credFeedback.message}
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            🔒 Tu token se guarda en la base de datos PostgreSQL del servidor y se verifica en vivo contra la API oficial.
          </p>
        </div>

        {/* LinkedIn Ads Library API Status & Optional Dedicated Token */}
        {activeChannelId === "linkedin" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--kc-border-specular)] bg-[var(--kc-surface)] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Search className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      Estado de LinkedIn Ads Library API
                    </h4>
                    <AstryxBadge
                      label={
                        checkingAdLib
                          ? "Verificando..."
                          : adLibStatus?.live_verified
                          ? "Verificada en Vivo"
                          : adLibStatus?.status_code
                          ? `HTTP ${adLibStatus.status_code}`
                          : "Pendiente / Sin Acceso"
                      }
                      variant={
                        checkingAdLib
                          ? "info"
                          : adLibStatus?.live_verified
                          ? "success"
                          : "warning"
                      }
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Verifica si el token actual tiene acceso al producto oficial LinkedIn Ad Library para buscar anuncios B2B reales desde el Estudio Paid Ads.
                  </p>
                </div>

                <AstryxButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  label="Verificar Acceso Ads Library"
                  icon={
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${checkingAdLib ? "animate-spin" : ""}`}
                    />
                  }
                  isLoading={checkingAdLib}
                  onClick={() => void checkLinkedInAdLibraryStatus()}
                />
              </div>

              {/* Diagnostic Details */}
              <div className="rounded-lg border border-slate-800 bg-[#020306] p-3 text-xs space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200">
                    live_verified:{" "}
                    <strong
                      className={
                        adLibStatus?.live_verified
                          ? "text-emerald-400"
                          : "text-amber-300"
                      }
                    >
                      {adLibStatus ? String(adLibStatus.live_verified) : "—"}
                    </strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-200">
                    api_version_used:{" "}
                    <strong>{adLibStatus?.api_version_used || "—"}</strong>
                  </span>
                  {adLibStatus?.token_source && (
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      origen: <strong>{adLibStatus.token_source}</strong>
                    </span>
                  )}
                </div>

                <p
                  className={`text-xs leading-relaxed ${
                    adLibStatus?.live_verified
                      ? "text-emerald-200"
                      : "text-amber-200"
                  }`}
                >
                  {adLibError ||
                    adLibStatus?.message ||
                    "Pulsa «Verificar Acceso Ads Library» para comprobar el endpoint oficial en vivo."}
                </p>
              </div>
            </div>

            {/* Collapsible Optional Dedicated Token for LinkedIn Ads Library */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDedicatedAdsToken((prev) => !prev)}
                className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-slate-200 hover:bg-slate-900/60 transition"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <Key className="w-4 h-4 text-sky-400" />
                  <span>Token dedicado para LinkedIn Ads Library (opcional)</span>
                  {serverCreds.linkedin_ads?.configured ? (
                    <AstryxBadge
                      label={`Dedicado activo (${serverCreds.linkedin_ads.masked_token})`}
                      variant="success"
                    />
                  ) : (
                    <AstryxBadge
                      label="Reutilizando token principal"
                      variant="neutral"
                    />
                  )}
                </span>
                {showDedicatedAdsToken ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </button>

              {showDedicatedAdsToken && (
                <div className="p-4 border-t border-slate-800 space-y-3 text-xs">
                  <p className="text-slate-300 leading-relaxed">
                    Por defecto, KigalContent reutiliza automáticamente tu token principal de LinkedIn para consultar la API de Ads Library. Configura este campo únicamente si necesitas usar un token separado de una aplicación de Marketing / LinkedIn Ad Library.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <input
                      type="password"
                      value={linkedinAdsToken}
                      onChange={(e) => setLinkedinAdsToken(e.target.value)}
                      placeholder={
                        serverCreds.linkedin_ads?.configured
                          ? "Deja vacío para mantener el token dedicado actual o pega uno nuevo..."
                          : "AQV... (Token OAuth autorizado para LinkedIn Ad Library)"
                      }
                      className="flex-1 min-w-[220px] bg-[#020306] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                    />
                    <AstryxButton
                      type="button"
                      variant="primary"
                      size="sm"
                      label={savingAdsCred ? "Guardando..." : "Guardar Token Ads"}
                      icon={<Save className="w-3.5 h-3.5" />}
                      isLoading={savingAdsCred}
                      onClick={() => void handleSaveLinkedinAdsToken()}
                    />
                    <AstryxButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      label={testingAdsCred ? "Probando..." : "Probar Token Ads"}
                      icon={<Zap className="w-3.5 h-3.5" />}
                      isLoading={testingAdsCred}
                      onClick={() => void handleTestLinkedinAdsToken()}
                    />
                  </div>

                  {adsCredFeedback && (
                    <div
                      className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${
                        adsCredFeedback.ok
                          ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
                          : "border-rose-500/40 bg-rose-950/30 text-rose-200"
                      }`}
                    >
                      {adsCredFeedback.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Anti-Penalty Best Practices Notice */}
        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200/90 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Protección Algorítmica contra Penalizaciones:</strong> {activeGuide.antiBanNotice}
          </p>
        </div>

        {/* Collapsible Step-by-Step Tutorial */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTutorial(!showTutorial)}
            className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-slate-200 hover:bg-slate-900/60 transition"
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              Tutorial Paso a Paso: ¿Cómo conseguir esta credencial en {activeGuide.portalName}?
            </span>
            {showTutorial ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showTutorial && (
            <div className="p-4 border-t border-slate-800 space-y-4 text-xs text-slate-300">
              <div className="grid gap-3">
                {activeGuide.steps.map((st) => (
                  <div key={st.title} className="p-3 rounded-lg bg-slate-900 border border-slate-800/80">
                    <h4 className="font-bold text-white text-xs mb-1">{st.title}</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">{st.detail}</p>
                  </div>
                ))}
              </div>

              {/* Scopes Section */}
              <div className="pt-2">
                <span className="font-semibold text-slate-300 block mb-1.5">
                  Permisos (Scopes) necesarios que debes marcar en tu App:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeGuide.recommendedScopes.map((scope) => (
                    <button
                      type="button"
                      key={scope}
                      onClick={() => handleCopyScope(scope)}
                      title="Copiar permiso"
                      className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700/80 font-mono text-[11px] text-cyan-300 flex items-center gap-1.5 hover:border-cyan-400 transition"
                    >
                      {scope}
                      <Copy className="w-3 h-3 text-slate-400" />
                    </button>
                  ))}
                </div>
                {copiedKey && (
                  <span className="text-[10px] text-emerald-400 mt-1 block">
                    ¡Permiso copiado al portapapeles!
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* MOTORES VISUALES E IA (NANO BANANA · GPT IMAGES · CANVA)           */}
      {/* ================================================================= */}
      <div className="rounded-2xl border border-violet-500/30 bg-[#0b101d] p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              Motores Visuales e IA (Nano Banana · GPT Images · Canva)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
              Conecta tus API Keys de <strong>Google Gemini (Nano Banana)</strong>, <strong>OpenAI (GPT Images)</strong> o{" "}
              <strong>Canva Connect</strong> para generar imágenes e infografías directamente desde Paso 2. Además, al guardar una API Key de{" "}
              <strong className="text-cyan-300">Gemini</strong> o <strong className="text-cyan-300">OpenAI</strong>, el botón{" "}
              <em>&ldquo;✨ Redactar / Pulir con IA&rdquo;</em> reescribirá automáticamente tus borradores de LinkedIn con IA real.
            </p>
          </div>
          <AstryxBadge
            label="Guardado seguro en PostgreSQL"
            variant="info"
          />
        </div>

        <div className="grid gap-4">
          {VISUAL_AI_PROVIDERS.map((prov) => {
            const cred = serverCreds[prov.channel];
            const feedback = visualKeyFeedback[prov.channel];
            const isSaving = savingVisualKey === prov.channel;
            const isTesting = testingVisualKey === prov.channel;

            return (
              <div
                key={prov.channel}
                className="rounded-xl border border-slate-800 bg-[#070a13] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{prov.title}</h4>
                      {cred?.configured ? (
                        <AstryxBadge
                          label={`Conectado (${cred.masked_token || cred.source})`}
                          variant="success"
                        />
                      ) : (
                        <AstryxBadge label="Sin API Key" variant="neutral" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{prov.subtitle}</p>
                  </div>

                  <a
                    href={prov.portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:border-cyan-400 text-xs font-semibold text-cyan-300 transition"
                  >
                    <span>{prov.portalLabel}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    type="password"
                    value={visualApiKeys[prov.channel] || ""}
                    onChange={(e) =>
                      setVisualApiKeys((prev) => ({
                        ...prev,
                        [prov.channel]: e.target.value,
                      }))
                    }
                    placeholder={
                      cred?.configured
                        ? "Deja vacío para mantener la clave guardada o pega una nueva para sustituirla..."
                        : prov.placeholder
                    }
                    className="flex-1 min-w-[240px] bg-[#020306] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                  />
                  <AstryxButton
                    type="button"
                    variant="primary"
                    size="sm"
                    label={isSaving ? "Guardando..." : "Guardar Key"}
                    icon={<Save className="w-3.5 h-3.5" />}
                    isLoading={isSaving}
                    onClick={() => void handleSaveVisualKey(prov.channel)}
                  />
                  <AstryxButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    label={isTesting ? "Probando..." : "Probar Conexión"}
                    icon={<Zap className="w-3.5 h-3.5" />}
                    isLoading={isTesting}
                    onClick={() => void handleTestVisualKey(prov.channel)}
                  />
                </div>

                {feedback && (
                  <div
                    className={`rounded-xl border px-3.5 py-2 text-xs leading-relaxed ${
                      feedback.ok
                        ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
                        : "border-rose-500/40 bg-rose-950/30 text-rose-200"
                    }`}
                  >
                    {feedback.message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
