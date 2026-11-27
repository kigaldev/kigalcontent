"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Sparkles,
  Zap,
  Save,
  Search,
  RefreshCw,
} from "lucide-react";
import { AstryxBadge, AstryxButton } from "@/components/ui/AstryxPrimitives";
import { apiClient } from "@/lib/api";
import { useEngineStore } from "@/store/useEngineStore";
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
    brandColor: "border-red-400 text-red-200",
    badgeBg: "bg-red-500/15 text-red-200 border-red-400/35",
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
    brandColor: "border-pink-400 text-pink-200",
    badgeBg: "bg-pink-500/15 text-pink-200 border-pink-400/35",
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
    brandColor: "border-cyan-400 text-cyan-200",
    badgeBg: "bg-cyan-500/15 text-cyan-200 border-cyan-400/35",
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
    brandColor: "border-blue-400 text-blue-200",
    badgeBg: "bg-blue-500/15 text-blue-200 border-blue-400/35",
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

type LLMProviderMode = "auto" | "ollama" | "openai_compatible" | "deterministic";

interface MiniPCModelSpec {
  model_id: string;
  size: string;
  badge: string;
  role: string;
}

const MINIPC_AVAILABLE_MODELS: MiniPCModelSpec[] = [
  {
    model_id: "qwen3.6:27b",
    size: "16.5 GB",
    badge: "Principal",
    role: "Guiones, copy multicanal y estrategia diaria",
  },
  {
    model_id: "qwen3.6-27b-64k:latest",
    size: "16.5 GB",
    badge: "64k Contexto",
    role: "Guiones largos, análisis de contexto completo y docs",
  },
  {
    model_id: "gemma3:27b",
    size: "16.2 GB",
    badge: "Alternativo",
    role: "Ganchos virales, ideas creativas y variantes rápidas",
  },
  {
    model_id: "qwen3-coder:30b",
    size: "17.3 GB",
    badge: "Código & JSON",
    role: "Estructuras estrictas JSON, flujos n8n y prompts técnicos",
  },
  {
    model_id: "qwen3-coder-64k:latest",
    size: "17.3 GB",
    badge: "Código 64k",
    role: "Revisión de repositorios extensos e integraciones",
  },
  {
    model_id: "laguna-xs-2.1:latest",
    size: "18.9 GB",
    badge: "Español Pro",
    role: "Redacción natural en español y tono editorial",
  },
  {
    model_id: "laguna-xs-64k:latest",
    size: "18.9 GB",
    badge: "Español 64k",
    role: "Redacción extensa en español con amplio contexto",
  },
];

interface LoadedSkillSpec {
  agent_id: string;
  filename: string;
  title: string;
  char_count: number;
  estimated_tokens: number;
}

type VisualAiChannel = "openai_gpt_images" | "gemini_nano_banana" | "canva";

const VISUAL_AI_PROVIDERS: Array<{
  channel: VisualAiChannel;
  title: string;
  subtitle: string;
  placeholder: string;
  portalUrl: string;
  portalLabel: string;
}> = [
  {
    channel: "openai_gpt_images",
    title: "🎨 OpenAI (GPT + GPT Images)",
    subtitle:
      "Generación de imágenes (GPT-Image-1 / DALL-E 3) + Redactor IA alternativo (GPT-4o-mini)",
    placeholder: "sk-proj-... (OpenAI API Key)",
    portalUrl: "https://platform.openai.com/api-keys",
    portalLabel: "Obtener API Key en OpenAI",
  },
  {
    channel: "gemini_nano_banana",
    title: "🍌 Google Gemini (Nano Banana)",
    subtitle:
      "Generación de imágenes/infografías (Gemini 2.5 Flash Image / Imagen 3) + Redactor IA rápido",
    placeholder: "AIzaSy... (Google AI Studio API Key)",
    portalUrl: "https://aistudio.google.com/apikey",
    portalLabel: "Obtener API Key en Google AI Studio",
  },
  {
    channel: "canva",
    title: "🧩 Canva Connect API",
    subtitle:
      "Verifica tu cuenta Canva Connect para integración directa de diseños y plantillas",
    placeholder: "OAuth 2.0 Access Token de Canva Connect",
    portalUrl: "https://www.canva.dev/",
    portalLabel: "Abrir Canva Developers",
  },
];

export const SocialCredentialsSettings: React.FC = () => {
  const { connectionsSubTab, setConnectionsSubTab } = useEngineStore();

  const [activeChannelId, setActiveChannelId] = useState<
    "youtube" | "instagram" | "tiktok" | "linkedin"
  >("instagram");
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
  const [credFeedback, setCredFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [isSandboxMode, setIsSandboxMode] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // LinkedIn Ads Library status & optional dedicated token state
  const [adLibStatus, setAdLibStatus] =
    useState<LinkedInAdLibraryStatusResponse | null>(null);
  const [checkingAdLib, setCheckingAdLib] = useState(false);
  const [adLibError, setAdLibError] = useState<string | null>(null);
  const [showDedicatedAdsToken, setShowDedicatedAdsToken] = useState(false);
  const [linkedinAdsToken, setLinkedinAdsToken] = useState("");
  const [savingAdsCred, setSavingAdsCred] = useState(false);
  const [testingAdsCred, setTestingAdsCred] = useState(false);
  const [adsCredFeedback, setAdsCredFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Visual & Cloud AI generation providers (OpenAI, Gemini/Nano Banana, Canva)
  const [visualApiKeys, setVisualApiKeys] = useState<Record<string, string>>({
    openai_gpt_images: "",
    gemini_nano_banana: "",
    canva: "",
  });
  const [savingVisualKey, setSavingVisualKey] = useState<string | null>(null);
  const [testingVisualKey, setTestingVisualKey] = useState<string | null>(null);
  const [visualKeyFeedback, setVisualKeyFeedback] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});

  // MiniPC Ollama + OpenAI Compatible LLM Router state
  const [llmProvider, setLlmProvider] = useState<LLMProviderMode>("auto");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("qwen3.6:27b");
  const [ollamaApiKey, setOllamaApiKey] = useState("");
  const [ollamaApiKeyConfigured, setOllamaApiKeyConfigured] = useState(false);
  const [ollamaReachable, setOllamaReachable] = useState(false);
  const [ollamaDetectedModels, setOllamaDetectedModels] = useState<string[]>([]);
  const [openAiBaseUrl, setOpenAiBaseUrl] = useState(
    "https://openrouter.ai/api/v1"
  );
  const [openAiModel, setOpenAiModel] = useState("qwen/qwen-2.5-72b-instruct");
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [loadedSkills, setLoadedSkills] = useState<LoadedSkillSpec[]>([]);
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<{
    reachable: boolean;
    provider: string;
    message: string;
    installed_models: string[];
    fallback_used: boolean;
  } | null>(null);

  const loadSocialCredentials = useCallback(async () => {
    try {
      const [data, llmCfg] = await Promise.allSettled([
        apiClient.getSocialCredentials(),
        apiClient.getLLMConfig(),
      ]);
      if (data.status === "fulfilled" && data.value?.channels) {
        setServerCreds(data.value.channels);
        if (data.value.channels.linkedin?.person_urn) {
          setLinkedinPersonUrn(data.value.channels.linkedin.person_urn);
        }
        const anyConfigured = Object.values(data.value.channels).some(
          (c) => c.configured
        );
        if (anyConfigured) setIsSandboxMode(false);
      }
      if (llmCfg.status === "fulfilled" && llmCfg.value) {
        const cfg = llmCfg.value as Record<string, unknown>;
        if (typeof cfg.active_provider === "string") {
          const ap = cfg.active_provider;
          setLlmProvider(
            ap === "anthropic" ? "auto" : (ap as LLMProviderMode)
          );
        }
        if (typeof cfg.ollama_base_url === "string") {
          setOllamaBaseUrl(cfg.ollama_base_url);
        }
        if (typeof cfg.ollama_model === "string" && cfg.ollama_model.trim()) {
          setOllamaModel(cfg.ollama_model);
        }
        if (typeof cfg.ollama_api_key_configured === "boolean") {
          setOllamaApiKeyConfigured(cfg.ollama_api_key_configured);
        }
        if (typeof cfg.ollama_reachable === "boolean") {
          setOllamaReachable(cfg.ollama_reachable);
        }
        if (Array.isArray(cfg.ollama_models_detected)) {
          setOllamaDetectedModels(cfg.ollama_models_detected as string[]);
        }
        if (typeof cfg.openai_compatible_base_url === "string") {
          setOpenAiBaseUrl(cfg.openai_compatible_base_url);
        }
        if (typeof cfg.openai_compatible_model === "string") {
          setOpenAiModel(cfg.openai_compatible_model);
        }
        if (Array.isArray(cfg.loaded_skills)) {
          setLoadedSkills(cfg.loaded_skills as LoadedSkillSpec[]);
        }
      }
    } catch {
      // silent offline fallback
    }
  }, []);

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
  }, [loadSocialCredentials]);

  useEffect(() => {
    if (
      connectionsSubTab === "social-apis" &&
      activeChannelId === "linkedin"
    ) {
      void checkLinkedInAdLibraryStatus();
    }
  }, [connectionsSubTab, activeChannelId, checkLinkedInAdLibraryStatus]);

  // Combine pre-configured MiniPC models with any live detected models from Ollama
  const combinedMiniPcModels = useMemo(() => {
    const knownIds = new Set(MINIPC_AVAILABLE_MODELS.map((m) => m.model_id));
    const extras: MiniPCModelSpec[] = ollamaDetectedModels
      .filter((id) => !knownIds.has(id))
      .map((id) => ({
        model_id: id,
        size: "Detectado",
        badge: "En vivo",
        role: "Modelo instalado detectado automáticamente en el MiniPC",
      }));
    return [...MINIPC_AVAILABLE_MODELS, ...extras];
  }, [ollamaDetectedModels]);

  const handleSaveVisualKey = async (channel: VisualAiChannel) => {
    const rawKey = (visualApiKeys[channel] || "").trim();
    if (!rawKey) {
      setVisualKeyFeedback((prev) => ({
        ...prev,
        [channel]: {
          ok: false,
          message: "Pega tu API Key o Token antes de guardar.",
        },
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
          message:
            'Clave guardada en PostgreSQL. Pulsa "Probar Conexión" para verificarla en vivo.',
        },
      }));
    } catch (err) {
      setVisualKeyFeedback((prev) => ({
        ...prev,
        [channel]: {
          ok: false,
          message:
            err instanceof Error
              ? err.message
              : "No se pudo guardar la clave.",
        },
      }));
    } finally {
      setSavingVisualKey(null);
    }
  };

  const handleTestVisualKey = async (channel: VisualAiChannel) => {
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
          message:
            err instanceof Error
              ? err.message
              : "Error al verificar la conexión.",
        },
      }));
    } finally {
      setTestingVisualKey(null);
    }
  };

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
        person_urn:
          activeChannelId === "linkedin"
            ? linkedinPersonUrn.trim() || undefined
            : undefined,
      });
      setTokens((prev) => ({ ...prev, [activeChannelId]: "" }));
      await loadSocialCredentials();
      if (activeChannelId === "linkedin") {
        await checkLinkedInAdLibraryStatus();
      }
      setCredFeedback({
        ok: true,
        message: `Token de ${activeGuide.name} guardado en el servidor. Pulsa 'Probar Conexión' para verificar permisos en vivo.`,
      });
    } catch (err) {
      setCredFeedback({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Error guardando credencial en el servidor.",
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
        person_urn:
          activeChannelId === "linkedin"
            ? linkedinPersonUrn.trim() || undefined
            : undefined,
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
        message:
          err instanceof Error
            ? err.message
            : "Error verificando conexión con la API oficial.",
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
        message:
          "Pega un Access Token OAuth autorizado para LinkedIn Ad Library antes de guardar.",
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
        message:
          "Token dedicado para LinkedIn Ads Library guardado en el servidor.",
      });
    } catch (err) {
      setAdsCredFeedback({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Error guardando token dedicado de LinkedIn Ads.",
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
        message:
          err instanceof Error
            ? err.message
            : "Error probando el token de LinkedIn Ads Library.",
      });
    } finally {
      setTestingAdsCred(false);
    }
  };

  const handleSaveLlmConfig = async (explicitModel?: string) => {
    const targetModel = (explicitModel ?? ollamaModel).trim();
    if (explicitModel) {
      setOllamaModel(explicitModel);
    }
    setLlmSaving(true);
    try {
      const updated = await apiClient.updateLLMConfig({
        active_provider: llmProvider,
        ollama_base_url: ollamaBaseUrl.trim(),
        ollama_model: targetModel,
        ollama_api_key: ollamaApiKey.trim() || undefined,
        openai_compatible_base_url: openAiBaseUrl.trim(),
        openai_compatible_model: openAiModel.trim(),
        openai_compatible_api_key: openAiApiKey.trim() || undefined,
      });
      setOllamaApiKeyConfigured(Boolean(updated.ollama_api_key_configured));
      setOllamaReachable(Boolean(updated.ollama_reachable));
      setOllamaDetectedModels(updated.ollama_models_detected ?? []);
      setOllamaApiKey("");
      setOpenAiApiKey("");
      setLlmTestResult({
        reachable: Boolean(
          updated.ollama_reachable || llmProvider !== "ollama"
        ),
        provider: updated.effective_provider,
        message: updated.ollama_reachable
          ? `Configuración guardada: ${targetModel} activo en MiniPC (${(updated.ollama_models_detected ?? []).length} modelos en vivo).`
          : `Modelo "${targetModel}" guardado en la configuración del motor IA.`,
        installed_models: updated.ollama_models_detected ?? [],
        fallback_used: !updated.ollama_reachable && llmProvider === "ollama",
      });
    } catch {
      setLlmTestResult({
        reachable: false,
        provider: llmProvider,
        message: "Error al guardar la configuración en el backend.",
        installed_models: [],
        fallback_used: true,
      });
    } finally {
      setLlmSaving(false);
    }
  };

  const handleTestLlmConnection = async () => {
    setLlmTesting(true);
    try {
      const result = await apiClient.testLLMConnection({
        provider: llmProvider,
        ollama_base_url: ollamaBaseUrl.trim(),
        ollama_model: ollamaModel.trim(),
        ollama_api_key: ollamaApiKey.trim() || undefined,
      });
      setOllamaReachable(Boolean(result.reachable));
      if (result.installed_models?.length) {
        setOllamaDetectedModels(result.installed_models);
      }
      setLlmTestResult(result);
    } catch {
      setLlmTestResult({
        reachable: false,
        provider: llmProvider,
        message:
          "Backend no alcanzable desde el navegador. Se usará el fallback determinista.",
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
      {/* ================================================================= */}
      {/* SECCIÓN 1: MOTOR IA & MINIPC OLLAMA (EMERALD DISTINCT THEME)       */}
      {/* ================================================================= */}
      {connectionsSubTab === "llm-minipc" && (
        <section
          aria-label="Motor IA y MiniPC"
          className="rounded-2xl border-2 border-l-8 border-emerald-500/75 bg-gradient-to-br from-emerald-950/65 via-[#071614]/90 to-[#050b0e]/95 p-5 sm:p-6 shadow-[0_0_45px_-12px_rgba(16,185,129,0.38)] backdrop-blur-xl space-y-6"
        >
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-emerald-500/30 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border-2 border-emerald-400/60 flex items-center justify-center text-emerald-300 shrink-0 shadow-inner">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-white">
                    Motor de Inteligencia Artificial · MiniPC Local (Ollama)
                  </h2>
                  <span className="text-[10px] font-bold bg-emerald-500/25 text-emerald-200 border border-emerald-400/50 px-2.5 py-0.5 rounded-full">
                    {loadedSkills.length || 6} Skills Activas
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      ollamaReachable
                        ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-200"
                        : "bg-amber-500/20 border-amber-400/50 text-amber-200"
                    }`}
                  >
                    {ollamaReachable
                      ? `GPU Online · ${(ollamaDetectedModels.length || MINIPC_AVAILABLE_MODELS.length)} modelos`
                      : "MiniPC sin sondear"}
                  </span>
                </div>
                <p className="text-xs text-emerald-100/75 mt-1">
                  Selecciona cualquiera de los modelos instalados en la GPU de tu MiniPC (0,00 €/mes · privacidad total) o ajusta el modo de ejecución.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTestLlmConnection}
                disabled={llmTesting}
                className="px-3.5 py-2 rounded-xl border-2 border-emerald-400/45 bg-emerald-950/60 hover:bg-emerald-900/70 text-xs font-semibold text-emerald-200 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-300" />
                {llmTesting ? "Probando..." : "Probar Conexión"}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveLlmConfig()}
                disabled={llmSaving}
                className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 shadow-lg shadow-emerald-500/25"
              >
                <Save className="w-3.5 h-3.5" />
                {llmSaving ? "Guardando..." : "Guardar Motor IA"}
              </button>
            </div>
          </div>

          {/* 1-Click Provider Mode Selector (No Claude) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                id: "auto" as const,
                title: "Híbrido Inteligente (Auto)",
                sub: "MiniPC Ollama primero -> OpenRouter -> Instantáneo",
                icon: <Sparkles className="w-4 h-4 text-emerald-300" />,
              },
              {
                id: "ollama" as const,
                title: "Solo MiniPC Local (Ollama)",
                sub: "Coste 0,00 € · 100% privado en tu GPU",
                icon: <Server className="w-4 h-4 text-emerald-400" />,
              },
              {
                id: "openai_compatible" as const,
                title: "OpenRouter / Compatible",
                sub: "Endpoint externo compatible con OpenAI",
                icon: <ExternalLink className="w-4 h-4 text-teal-300" />,
              },
              {
                id: "deterministic" as const,
                title: "Paramétrico Instantáneo",
                sub: "Sin llamadas LLM · 0 ms de latencia",
                icon: <Zap className="w-4 h-4 text-amber-300" />,
              },
            ].map((opt) => (
              <button
                type="button"
                key={opt.id}
                onClick={() => setLlmProvider(opt.id)}
                className={`p-3.5 rounded-xl border-2 text-left transition ${
                  llmProvider === opt.id
                    ? "bg-emerald-500/20 border-emerald-400 shadow-lg shadow-emerald-500/15"
                    : "bg-[#05100f]/75 border-emerald-500/25 hover:border-emerald-400/50"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs text-white">
                  {opt.icon}
                  <span>{opt.title}</span>
                </div>
                <p className="text-[11px] text-emerald-100/70 mt-1">
                  {opt.sub}
                </p>
              </button>
            ))}
          </div>

          {/* Configured MiniPC Models Grid (Ready to Use) */}
          <div className="space-y-3 rounded-xl border-2 border-emerald-500/35 bg-[#040f0e]/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  Modelos disponibles en tu MiniPC ({combinedMiniPcModels.length})
                </h3>
                <p className="text-[11px] text-emerald-100/70 mt-0.5">
                  Haz clic en cualquier modelo para seleccionarlo o pulsa «Activar» para guardarlo al instante en el servidor.
                </p>
              </div>
              <span className="font-mono text-xs px-2.5 py-1 rounded-lg border border-emerald-400/50 bg-emerald-500/15 text-emerald-200 font-bold">
                Activo: {ollamaModel}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {combinedMiniPcModels.map((m) => {
                const isSelected = ollamaModel === m.model_id;
                const isDetectedLive = ollamaDetectedModels.includes(
                  m.model_id
                );
                return (
                  <div
                    key={m.model_id}
                    onClick={() => setOllamaModel(m.model_id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOllamaModel(m.model_id);
                      }
                    }}
                    className={`rounded-xl border-2 p-3 text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? "border-emerald-400 bg-emerald-500/20 shadow-md shadow-emerald-500/15"
                        : "border-emerald-500/25 bg-emerald-950/25 hover:border-emerald-400/60"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-white truncate">
                          {m.model_id}
                        </span>
                        <span className="shrink-0 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                          {m.size}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-100/75 leading-snug">
                        {m.role}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-emerald-500/20">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-white/10 text-emerald-100">
                          {m.badge}
                        </span>
                        {isDetectedLive && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Instalado
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleSaveLlmConfig(m.model_id);
                        }}
                        disabled={llmSaving}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                          isSelected
                            ? "bg-emerald-400 text-slate-950"
                            : "border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-400 hover:text-slate-950"
                        }`}
                      >
                        {isSelected ? "Activo ✓" : "Activar"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Endpoint & Fallback Credentials */}
          <div className="grid lg:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3 rounded-xl border-2 border-emerald-500/30 bg-[#040f0e]/75 p-4">
              <div className="font-bold text-emerald-200 flex items-center justify-between">
                <span>Conexión al Servidor Ollama (MiniPC)</span>
                <span className="text-[10px] font-mono text-emerald-300/80">
                  {ollamaApiKeyConfigured ? "Tunnel Auth activo" : "Directo / Local"}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-emerald-100/75 mb-1">
                    URL de Ollama (Local o Túnel Cloudflare)
                  </label>
                  <input
                    type="url"
                    value={ollamaBaseUrl}
                    onChange={(e) => setOllamaBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434 o https://...trycloudflare.com"
                    className="w-full bg-slate-950/90 border border-emerald-500/35 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-emerald-100/75 mb-1">
                    Token Túnel Ollama (Opcional · Bearer)
                  </label>
                  <input
                    type="password"
                    value={ollamaApiKey}
                    onChange={(e) => setOllamaApiKey(e.target.value)}
                    placeholder={
                      ollamaApiKeyConfigured
                        ? "•••••••• (guardado)"
                        : "Token del túnel seguro del MiniPC"
                    }
                    className="w-full bg-slate-950/90 border border-emerald-500/35 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-emerald-100/75 mb-1">
                  Modelo Activo en Ollama
                </label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  className="w-full bg-slate-950/90 border border-emerald-500/35 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border-2 border-emerald-500/30 bg-[#040f0e]/75 p-4">
              <div className="font-bold text-emerald-200">
                Respaldo OpenRouter / API Compatible (Opcional)
              </div>
              <p className="text-[11px] text-emerald-100/70">
                Solo se utiliza si el MiniPC está apagado o seleccionas explícitamente el modo OpenRouter.
              </p>

              <div>
                <label className="block text-emerald-100/75 mb-1">
                  OpenRouter / Compatible Base URL
                </label>
                <input
                  type="url"
                  value={openAiBaseUrl}
                  onChange={(e) => setOpenAiBaseUrl(e.target.value)}
                  className="w-full bg-slate-950/90 border border-emerald-500/35 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-emerald-100/75 mb-1">
                    Modelo Cloud Compatible
                  </label>
                  <input
                    type="text"
                    value={openAiModel}
                    onChange={(e) => setOpenAiModel(e.target.value)}
                    className="w-full bg-slate-950/90 border border-emerald-500/35 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-emerald-100/75 mb-1">
                    OpenRouter API Key
                  </label>
                  <input
                    type="password"
                    value={openAiApiKey}
                    onChange={(e) => setOpenAiApiKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="w-full bg-slate-950/90 border border-emerald-500/35 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {llmTestResult && (
            <div
              className={`p-3.5 rounded-xl border-2 text-xs flex flex-wrap items-center justify-between gap-2 ${
                llmTestResult.reachable && !llmTestResult.fallback_used
                  ? "bg-emerald-950/60 border-emerald-400/60 text-emerald-100"
                  : "bg-amber-950/50 border-amber-400/60 text-amber-100"
              }`}
            >
              <span>
                <strong>Estado ({llmTestResult.provider}):</strong>{" "}
                {llmTestResult.message}
              </span>
              {llmTestResult.installed_models.length > 0 && (
                <span className="font-mono text-[11px] text-emerald-300">
                  En vivo: {llmTestResult.installed_models.slice(0, 4).join(", ")}
                </span>
              )}
            </div>
          )}

          {loadedSkills.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
              <span className="text-emerald-200/80 font-semibold mr-1">
                Skills cargadas:
              </span>
              {loadedSkills.map((sk) => (
                <span
                  key={sk.agent_id}
                  title={`${sk.filename} (~${sk.estimated_tokens} tokens)`}
                  className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/35 text-emerald-200 font-mono"
                >
                  {sk.agent_id} ({sk.estimated_tokens}t)
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ================================================================= */}
      {/* SECCIÓN 2: REDES SOCIALES OFICIALES (SKY/CYAN DISTINCT THEME)      */}
      {/* ================================================================= */}
      {connectionsSubTab === "social-apis" && (
        <section
          aria-label="Redes Sociales Oficiales"
          className="rounded-2xl border-2 border-l-8 border-sky-500/75 bg-gradient-to-br from-sky-950/65 via-[#081529]/90 to-[#050811]/95 p-5 sm:p-6 shadow-[0_0_45px_-12px_rgba(56,189,248,0.38)] backdrop-blur-xl space-y-6"
        >
          {/* Section Header + Sandbox Toggle */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-sky-500/30 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-sky-500/20 border-2 border-sky-400/60 flex items-center justify-center text-sky-300 shrink-0 shadow-inner">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-white">
                    Conexiones Oficiales de Redes Sociales
                  </h2>
                  <span className="text-[10px] font-bold bg-sky-500/25 text-sky-200 border border-sky-400/50 px-2.5 py-0.5 rounded-full">
                    APIs Oficiales OAuth
                  </span>
                </div>
                <p className="text-xs text-sky-100/75 mt-1">
                  Conecta YouTube, Instagram Reels, TikTok y LinkedIn para programar y publicar directamente sin intermediarios.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-sky-500/35 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setIsSandboxMode(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  isSandboxMode
                    ? "bg-sky-400 text-slate-950 shadow-md font-bold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Modo Pruebas
              </button>
              <button
                type="button"
                onClick={() => setIsSandboxMode(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  !isSandboxMode
                    ? "bg-emerald-400 text-slate-950 shadow-md font-bold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Producción en Vivo
              </button>
            </div>
          </div>

          {isSandboxMode && (
            <div className="p-3.5 rounded-xl bg-sky-900/35 border-2 border-sky-400/40 text-xs text-sky-100 flex items-center gap-2.5">
              <span className="text-sm">🛡️</span>
              <p>
                <strong>Modo seguro:</strong> un canal sin token guardado no publica nada; el servidor devuelve «Sin conectar» sin simular resultados falsos.
              </p>
            </div>
          )}

          {/* Social Network Channel Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CHANNELS_GUIDE.map((ch) => {
              const isSelected = activeChannelId === ch.id;
              const serverInfo = serverCreds[ch.id];
              const hasToken = Boolean(
                serverInfo?.configured || tokens[ch.id]?.trim()
              );
              return (
                <button
                  type="button"
                  key={ch.id}
                  onClick={() => {
                    setActiveChannelId(ch.id);
                    setCredFeedback(null);
                  }}
                  className={`p-3.5 rounded-xl border-2 text-left transition flex flex-col justify-between gap-2 ${
                    isSelected
                      ? `bg-sky-500/20 ${ch.brandColor} shadow-lg shadow-sky-500/15`
                      : "bg-[#061020]/75 border-sky-500/25 text-slate-300 hover:border-sky-400/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 font-bold text-xs text-white">
                      {ch.icon}
                      {ch.name}
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        serverInfo?.configured
                          ? "bg-emerald-500/25 text-emerald-200 border border-emerald-400/45"
                          : hasToken
                          ? "bg-amber-500/25 text-amber-200 border border-amber-400/45"
                          : "bg-white/10 text-slate-300"
                      }`}
                    >
                      {serverInfo?.configured
                        ? "En Vivo"
                        : hasToken
                        ? "Sin Guardar"
                        : "Sin Clave"}
                    </span>
                  </div>
                  <span className="text-[11px] text-sky-100/70 truncate">
                    {serverInfo?.configured
                      ? serverInfo.account_name ||
                        `Conectado (${serverInfo.source})`
                      : "Sin conectar"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Channel Configuration Panel */}
          <div className="rounded-xl border-2 border-sky-500/35 bg-[#050d1c]/85 p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-500/25 pb-4">
              <div className="flex items-center gap-3">
                {activeGuide.icon}
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Configuración de {activeGuide.name}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${activeGuide.badgeBg}`}
                    >
                      Conector Oficial
                    </span>
                  </h3>
                  <p className="text-xs text-sky-100/70">
                    Publicación directa de Reels, Carruseles, Shorts y Artículos.
                  </p>
                </div>
              </div>

              <a
                href={activeGuide.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-xs font-semibold text-sky-200 border border-sky-400/40 transition self-start sm:self-auto"
              >
                Abrir {activeGuide.portalName}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Credential Input */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-sky-400" />
                  {activeGuide.credentialName}
                </span>
                <span className="text-[11px] font-normal">
                  {serverCreds[activeChannelId]?.configured ? (
                    <span className="text-emerald-300 font-semibold">
                      ✓ Guardado en servidor ({serverCreds[activeChannelId].masked_token})
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      Sin token guardado en servidor
                    </span>
                  )}
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <input
                  type="password"
                  value={tokens[activeChannelId]}
                  onChange={(e) =>
                    setTokens((prev) => ({
                      ...prev,
                      [activeChannelId]: e.target.value,
                    }))
                  }
                  placeholder={
                    serverCreds[activeChannelId]?.configured
                      ? "Deja vacío para mantener el token actual o pega uno nuevo..."
                      : activeGuide.credentialPlaceholder
                  }
                  className="flex-1 min-w-[220px] bg-slate-950/90 border border-sky-500/35 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-400"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveChannelToken()}
                  disabled={savingCred}
                  className="px-4 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-950 text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingCred ? "Guardando..." : "Guardar Token"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleTestChannelToken()}
                  disabled={testingCred}
                  className="px-4 py-2 rounded-xl bg-sky-950/80 hover:bg-sky-900 disabled:opacity-50 text-sky-200 text-xs font-semibold border border-sky-400/40 transition inline-flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 text-sky-300" />
                  {testingCred ? "Verificando..." : "Probar Conexión"}
                </button>
              </div>

              {activeChannelId === "linkedin" && (
                <label className="block text-xs text-slate-300 pt-1">
                  <span className="text-[11px] font-semibold text-sky-200 block mb-1">
                    LinkedIn Person URN (se rellena automáticamente al pulsar &ldquo;Probar Conexión&rdquo;)
                  </span>
                  <input
                    type="text"
                    value={linkedinPersonUrn}
                    onChange={(e) => setLinkedinPersonUrn(e.target.value)}
                    placeholder="urn:li:person:xxxxxxxx (opcional, auto-detectado)"
                    className="w-full bg-slate-950/90 border border-sky-500/35 rounded-xl px-3 py-2 text-xs text-sky-200 font-mono focus:outline-none focus:border-sky-400"
                  />
                </label>
              )}

              {credFeedback && (
                <div
                  className={`rounded-xl border-2 px-3.5 py-2.5 text-xs leading-relaxed ${
                    credFeedback.ok
                      ? "border-emerald-400/60 bg-emerald-950/40 text-emerald-100"
                      : "border-rose-400/60 bg-rose-950/40 text-rose-100"
                  }`}
                >
                  {credFeedback.message}
                </div>
              )}
            </div>

            {/* LinkedIn Ads Library API Status & Optional Dedicated Token */}
            {activeChannelId === "linkedin" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-sky-500/30 bg-sky-950/25 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Search className="w-4 h-4 text-sky-400" />
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
                      <p className="text-[11px] text-slate-300">
                        Verifica si el token actual tiene acceso a LinkedIn Ad Library para buscar anuncios B2B reales desde el Estudio de Ads.
                      </p>
                    </div>

                    <AstryxButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      label="Verificar Acceso Ads Library"
                      icon={
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            checkingAdLib ? "animate-spin" : ""
                          }`}
                        />
                      }
                      isLoading={checkingAdLib}
                      onClick={() => void checkLinkedInAdLibraryStatus()}
                    />
                  </div>

                  <div className="rounded-lg border border-sky-500/25 bg-slate-950/80 p-3 text-xs space-y-2">
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
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-sky-200">
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

                <div className="rounded-xl border border-sky-500/25 bg-slate-950/60 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowDedicatedAdsToken((prev) => !prev)}
                    className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-slate-200 hover:bg-sky-950/30 transition"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <Key className="w-4 h-4 text-sky-400" />
                      <span>
                        Token dedicado para LinkedIn Ads Library (opcional)
                      </span>
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
                    <div className="p-4 border-t border-sky-500/25 space-y-3 text-xs">
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="password"
                          value={linkedinAdsToken}
                          onChange={(e) => setLinkedinAdsToken(e.target.value)}
                          placeholder={
                            serverCreds.linkedin_ads?.configured
                              ? "Deja vacío para mantener el token dedicado actual..."
                              : "AQV... (Token OAuth autorizado para LinkedIn Ad Library)"
                          }
                          className="flex-1 min-w-[220px] bg-slate-950 border border-sky-500/35 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-400"
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
            <div className="p-3.5 rounded-xl bg-amber-950/25 border border-amber-400/35 text-xs text-amber-100/90 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Protección Algorítmica:</strong> {activeGuide.antiBanNotice}
              </p>
            </div>

            {/* Collapsible Step-by-Step Tutorial */}
            <div className="rounded-xl border border-sky-500/25 bg-slate-950/60 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTutorial(!showTutorial)}
                className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-sky-100 hover:bg-sky-950/30 transition"
              >
                <span className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-sky-400" />
                  Tutorial Paso a Paso: ¿Cómo conseguir esta credencial en {activeGuide.portalName}?
                </span>
                {showTutorial ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showTutorial && (
                <div className="p-4 border-t border-sky-500/25 space-y-4 text-xs text-slate-300">
                  <div className="grid gap-3">
                    {activeGuide.steps.map((st) => (
                      <div
                        key={st.title}
                        className="p-3 rounded-lg bg-slate-900/90 border border-sky-500/20"
                      >
                        <h4 className="font-bold text-white text-xs mb-1">
                          {st.title}
                        </h4>
                        <p className="text-slate-300 text-xs leading-relaxed">
                          {st.detail}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <span className="font-semibold text-sky-100 block mb-1.5">
                      Permisos (Scopes) necesarios:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeGuide.recommendedScopes.map((scope) => (
                        <button
                          type="button"
                          key={scope}
                          onClick={() => handleCopyScope(scope)}
                          title="Copiar permiso"
                          className="px-2.5 py-1 rounded bg-slate-900 border border-sky-500/30 font-mono text-[11px] text-sky-200 flex items-center gap-1.5 hover:border-sky-400 transition"
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
        </section>
      )}

      {/* ================================================================= */}
      {/* SECCIÓN 3: MOTORES VISUALES E IA CLOUD (FUCHSIA DISTINCT THEME)   */}
      {/* ================================================================= */}
      {connectionsSubTab === "visual-ai" && (
        <section
          aria-label="Motores Visuales e IA"
          className="rounded-2xl border-2 border-l-8 border-fuchsia-500/75 bg-gradient-to-br from-fuchsia-950/65 via-[#170a26]/90 to-[#090512]/95 p-5 sm:p-6 shadow-[0_0_45px_-12px_rgba(217,70,239,0.38)] backdrop-blur-xl space-y-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-fuchsia-500/30 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-fuchsia-500/20 border-2 border-fuchsia-400/60 flex items-center justify-center text-fuchsia-300 shrink-0 shadow-inner">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-white">
                    Motores Visuales e IA en la Nube
                  </h2>
                  <AstryxBadge
                    label="Guardado seguro en PostgreSQL"
                    variant="info"
                  />
                </div>
                <p className="text-xs text-fuchsia-100/75 leading-relaxed max-w-3xl">
                  Conecta tus claves para generar portadas, miniaturas, infografías y copy alternativo con{" "}
                  <strong>OpenAI</strong>, <strong>Google Gemini (Nano Banana)</strong> y{" "}
                  <strong>Canva Connect</strong>. El motor de texto principal funciona con los modelos locales de tu{" "}
                  <button
                    type="button"
                    onClick={() => setConnectionsSubTab("llm-minipc")}
                    className="font-bold text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                  >
                    MiniPC (Ollama)
                  </button>
                  .
                </p>
              </div>
            </div>
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
                  className="rounded-xl border-2 border-fuchsia-500/30 bg-[#0d0718]/80 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-white">
                          {prov.title}
                        </h3>
                        {cred?.configured ? (
                          <AstryxBadge
                            label={`Conectado (${cred.masked_token || cred.source})`}
                            variant="success"
                          />
                        ) : (
                          <AstryxBadge label="Sin API Key" variant="neutral" />
                        )}
                      </div>
                      <p className="text-xs text-fuchsia-100/70 mt-0.5">
                        {prov.subtitle}
                      </p>
                    </div>

                    <a
                      href={prov.portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-fuchsia-400/40 bg-fuchsia-950/60 hover:bg-fuchsia-900/70 text-xs font-semibold text-fuchsia-200 transition"
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
                          ? "Deja vacío para mantener la clave guardada o pega una nueva..."
                          : prov.placeholder
                      }
                      className="flex-1 min-w-[240px] bg-slate-950/90 border border-fuchsia-500/35 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-fuchsia-400"
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
                      className={`rounded-xl border-2 px-3.5 py-2 text-xs leading-relaxed ${
                        feedback.ok
                          ? "border-emerald-400/60 bg-emerald-950/40 text-emerald-100"
                          : "border-rose-400/60 bg-rose-950/40 text-rose-100"
                      }`}
                    >
                      {feedback.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
