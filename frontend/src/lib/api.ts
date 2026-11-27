import type {
  AdCampaignGenerateRequest,
  AdCampaignResponse,
  AnalyticsOverview,
  AuditLogEntry,
  AutolistItemRecord,
  AutolistRecord,
  BestTimeHeatmapResponse,
  ComposerPostCreateRequest,
  ContentProject,
  ContentFormat,
  ConversionGoal,
  CreatorProfile,
  DurationPreset,
  FSMState,
  GitHubRepoItem,
  IdeaAIEvaluationRequest,
  IdeaAIEvaluationResponse,
  IdeaChatRefineRequest,
  IdeaChatRefineResponse,
  KigalChatInteraction,
  KigalChatStatus,
  LeadMagnetItem,
  LinkedInAdLibrarySearchRequest,
  LinkedInAdLibrarySearchResponse,
  LinkedInAdLibraryStatusResponse,
  MediaQCReport,
  N8nWorkflowTemplate,
  ProjectDetail,
  PublishingCalendarResponse,
  RadarMatutinoIngestRequest,
  RadarMatutinoIngestResponse,
  RMTADiagnosisResponse,
  ScriptDocument,
  ScriptTargetPlatform,
  SocialAccountItem,
  SocialChannel,
  SocialPost,
  TwoColumnScriptBlock,
  WatchTimeShareResponse,
} from "@/types/engine";

export const DEFAULT_PRODUCTION_BACKEND_URL =
  "https://autonomous-content-engine-backend-production.up.railway.app";

export function normalizeBackendUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) {
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url);
    url = `${isLocal ? "http" : "https"}://${url.replace(/^\/+/, "")}`;
  }
  return url.replace(/\/+$/, "").replace(/\/api\/v1$/, "").replace(/\/api$/, "");
}

/**
 * Resolves the API base URL depending on execution environment:
 * 1. Build/runtime env: `NEXT_PUBLIC_API_URL` or `BACKEND_URL`.
 * 2. Client override: `localStorage.getItem("ACE_BACKEND_URL")` for instant debugging/connection.
 * 3. Vercel deployment fallback: production Railway backend so every browser works out of the box.
 * 4. Self-hosted browser fallback: `window.location.origin` on non-localhost origins.
 * 5. Local development fallback: `http://localhost:8000`.
 */
export function getApiBaseUrl(): string {
  let url = "";

  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
    url = process.env.NEXT_PUBLIC_API_URL;
  } else if (typeof process !== "undefined" && process.env.BACKEND_URL) {
    url = process.env.BACKEND_URL;
  }

  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("ACE_BACKEND_URL");
      if (stored && stored.trim()) {
        url = stored.trim();
      }
    } catch {
      // localStorage restricted/unavailable
    }

    if (!url && window.location?.hostname) {
      const host = window.location.hostname;
      if (host.includes("vercel.app")) {
        url = DEFAULT_PRODUCTION_BACKEND_URL;
      } else if (host !== "localhost" && host !== "127.0.0.1") {
        url = window.location.origin;
      }
    }
  } else if (!url && typeof process !== "undefined" && process.env.VERCEL) {
    url = DEFAULT_PRODUCTION_BACKEND_URL;
  }

  if (!url) {
    url = "http://localhost:8000";
  }

  return normalizeBackendUrl(url);
}

export function setCustomBackendUrl(url: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (url && url.trim()) {
      window.localStorage.setItem("ACE_BACKEND_URL", normalizeBackendUrl(url));
    } else {
      window.localStorage.removeItem("ACE_BACKEND_URL");
    }
  } catch {
    // ignore
  }
}

export function getCustomBackendUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("ACE_BACKEND_URL");
  } catch {
    return null;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const targetUrl = `${base}/api/v1${normalizedPath}`;

  const res = await fetch(targetUrl, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      message = err.detail || message;
    } catch {
      // ignore json parse failure
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  get apiBase(): string {
    return getApiBaseUrl();
  },

  health: async (customUrl?: string): Promise<{ status: string }> => {
    const rawBase = customUrl || getApiBaseUrl();
    const cleanBase = normalizeBackendUrl(rawBase);

    const candidateEndpoints = [
      `${cleanBase}/health`,
      `${cleanBase}/api/health`,
      `${cleanBase}/api/v1/health`,
    ];

    let lastError: Error | null = null;
    for (const ep of candidateEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(ep, {
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw new Error(lastError?.message || `Servidor no responde en ${cleanBase}`);
  },

  listProjects: () => requestJson<ContentProject[]>("/projects"),

  getProjectDetail: (projectId: string) =>
    requestJson<ProjectDetail>(`/projects/${projectId}`),

  createProject: (payload: {
    working_title: string;
    target_duration: DurationPreset;
    conversion_goal: ConversionGoal;
    tam_classification: "CORE_80" | "EXPANSION_20";
    impact: number;
    confidence: number;
    ease: number;
    context_notes?: string;
    source_origin?: string;
    target_platforms?: ScriptTargetPlatform[];
    content_format?: ContentFormat;
  }) =>
    requestJson<ContentProject>("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteProject: (projectId: string) =>
    requestJson<{ deleted: boolean; project_id: string; asset_code: string }>(
      `/projects/${projectId}`,
      { method: "DELETE" }
    ),

  chatRefineIdea: (payload: IdeaChatRefineRequest) =>
    requestJson<IdeaChatRefineResponse>("/ideas/chat-refine", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  evaluateIdeaWithAI: (payload: IdeaAIEvaluationRequest) =>
    requestJson<IdeaAIEvaluationResponse>("/ideas/ai-evaluate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  ingestRadarMatutino: (payload: RadarMatutinoIngestRequest) =>
    requestJson<RadarMatutinoIngestResponse>("/ideas/radar-matutino", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  transitionProject: (
    projectId: string,
    payload: {
      target_state: FSMState;
      agent_or_user: string;
      hitl_token?: string;
      reason?: string;
    }
  ) =>
    requestJson<ContentProject>(`/projects/${projectId}/transition`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  issueHitlToken: (payload: {
    project_id: string;
    tier: 2 | 3;
    action: string;
    actor: string;
  }) =>
    requestJson<{
      token: string;
      project_id: string;
      tier: number;
      action: string;
      expires_at: number;
    }>("/hitl/issue-token", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getCreatorProfile: () => requestJson<CreatorProfile>("/creator-profile"),

  updateCreatorProfile: (payload: Partial<CreatorProfile>) =>
    requestJson<CreatorProfile>("/creator-profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  importGitHubRepo: (payload: { repo_url_or_slug: string; github_token?: string | null }) =>
    requestJson<{
      repo_full_name: string;
      repo_url: string;
      suggested_niche: string;
      suggested_project_context: string;
      suggested_content_pillars: string[];
      suggested_tagline: string;
      suggested_name?: string;
      suggested_icp?: string;
      suggested_strategic_goals?: string[];
      suggested_communication_style?: string;
      suggested_visual_style?: string;
      suggested_voice_guidelines?: string;
      homepage?: string | null;
      extracted_lead_magnets?: LeadMagnetItem[];
    }>("/creator-profile/import-github", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  importGitHubReposBatch: (payload: {
    repos: Array<{ repo_url_or_slug: string; github_token?: string | null }>;
  }) =>
    requestJson<{
      imported_repos: GitHubRepoItem[];
      suggested_name: string;
      suggested_tagline: string;
      suggested_niche: string;
      suggested_icp: string;
      suggested_project_context: string;
      suggested_strategic_goals: string[];
      suggested_communication_style: string;
      suggested_visual_style: string;
      suggested_content_pillars: string[];
      suggested_voice_guidelines: string;
      suggested_social_accounts: SocialAccountItem[];
      extracted_lead_magnets: LeadMagnetItem[];
    }>("/creator-profile/import-github-batch", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  triggerManyChatKeyword: (payload: {
    keyword: string;
    platform?: string;
    username?: string;
    comment_text?: string;
    /** true: solo comprueba la coincidencia; no suma contadores ni registra nada. */
    dry_run?: boolean;
  }) =>
    requestJson<{
      matched: boolean;
      keyword: string;
      platform: string;
      lead_magnet: LeadMagnetItem | null;
      public_comment_reply?: string;
      dm_reply_text: string;
      delivery_url: string;
      manychat_flow_id?: string | null;
      triggers_count: number;
    }>("/manychat/trigger", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  generateScript: (payload: {
    project_id: string;
    duration_preset: DurationPreset;
    conversion_goal: ConversionGoal;
    wpm_rate: number;
    topic_override?: string;
  }) =>
    requestJson<ScriptDocument>("/scripts/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateScript: (
    scriptId: string,
    payload: {
      duration_preset: DurationPreset;
      conversion_goal: ConversionGoal;
      wpm_rate: number;
      two_column_blocks: TwoColumnScriptBlock[];
      selected_hook_index: number;
    }
  ) =>
    requestJson<ScriptDocument>(`/scripts/${scriptId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  initS3Multipart: (payload: {
    project_id: string;
    filename: string;
    part_count: number;
  }) =>
    requestJson<{
      upload_id: string;
      object_key: string;
      bucket: string;
      presigned_part_urls: Array<{ part_number: number; presigned_url: string }>;
      download_url: string;
    }>("/media/s3/multipart-init", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  processMedia: (payload: {
    project_id: string;
    raw_media_url: string;
    silence_noise_db: number;
    min_silence_duration_sec: number;
    target_lufs: number;
    subtitle_y_percent: number;
    target_platform_signature?: string;
  }) =>
    requestJson<MediaQCReport>("/media/process", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  generateSocialCopy: (payload: {
    project_id: string;
    headline: string;
    core_value: string;
    debate_question: string;
    conversion_goal: ConversionGoal;
  }) =>
    requestJson<SocialPost[]>("/social/copycraft", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateSocialPost: (
    postId: string,
    payload: {
      title?: string | null;
      post_body?: string;
      first_comment?: string | null;
      hashtags?: string[];
      metadata_payload?: Record<string, unknown>;
    }
  ) =>
    requestJson<SocialPost>(`/social/posts/${postId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  generateSocialVisual: (payload: {
    title: string;
    body: string;
    visual_type: "INFOGRAPHIC" | "IMAGE";
    provider: "nano_banana" | "gpt_images" | "svg_local";
    prompt?: string;
    author_name?: string;
  }) =>
    requestJson<{
      image_url: string;
      provider: string;
      visual_type: string;
      prompt: string;
      note: string;
    }>("/social/generate-visual", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  polishLinkedInPost: (payload: {
    title: string;
    body?: string;
    context_notes?: string;
    project_id?: string | null;
    preferred_engine?: "auto" | "ollama_local" | "anthropic" | "gemini" | "openai";
  }) =>
    requestJson<{
      hook: string;
      post_body: string;
      first_comment: string;
      hashtags: string[];
      engine: string;
      used_ai_llm: boolean;
      note: string;
    }>("/social/polish-linkedin", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getLLMConfig: () =>
    requestJson<{
      active_provider: string;
      effective_provider: string;
      ollama_base_url: string;
      ollama_model: string;
      ollama_api_key_configured?: boolean;
      ollama_reachable: boolean;
      ollama_models_detected: string[];
      anthropic_model: string;
      anthropic_key_configured: boolean;
      openai_compatible_base_url: string;
      openai_compatible_model: string;
      openai_compatible_key_configured: boolean;
    }>("/llm/config"),

  updateLLMConfig: (payload: {
    active_provider?: string;
    ollama_base_url?: string;
    ollama_model?: string;
    ollama_api_key?: string;
    anthropic_api_key?: string;
    openai_compatible_base_url?: string;
    openai_compatible_model?: string;
    openai_compatible_api_key?: string;
  }) =>
    requestJson<{
      active_provider: string;
      effective_provider: string;
      ollama_base_url: string;
      ollama_model: string;
      ollama_api_key_configured?: boolean;
      ollama_reachable: boolean;
      ollama_models_detected: string[];
      anthropic_model: string;
      anthropic_key_configured: boolean;
      openai_compatible_base_url: string;
      openai_compatible_model: string;
      openai_compatible_key_configured: boolean;
    }>("/llm/config", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  testLLMConnection: (payload: {
    provider?: string;
    ollama_base_url?: string;
    ollama_model?: string;
    ollama_api_key?: string;
  }) =>
    requestJson<{
      reachable: boolean;
      provider: string;
      active_model: string;
      installed_models: string[];
      latency_ms: number;
      sample_output: string;
      fallback_used: boolean;
      message: string;
    }>("/llm/test-connection", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  publishSocial: (payload: {
    project_id: string;
    channels: SocialChannel[];
    hitl_token?: string;
    actor: string;
  }) =>
    requestJson<{
      status: string;
      project_id: string;
      publications: Array<{
        status?: string;
        mode?: string;
        message?: string;
        channel?: string;
        external_platform_id?: string;
        canonical_url?: string;
      }>;
    }>("/social/publish", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getSocialCredentials: () =>
    requestJson<{
      channels: Record<
        string,
        {
          channel: string;
          configured: boolean;
          source: "database" | "env" | "none";
          person_urn: string;
          account_name: string;
          masked_token: string;
        }
      >;
    }>("/social/credentials"),

  saveSocialCredential: (payload: {
    channel: string;
    access_token: string;
    person_urn?: string;
  }) =>
    requestJson<{
      saved: boolean;
      channel: string;
      configured: boolean;
      person_urn: string;
      account_name: string;
    }>("/social/credentials", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  testSocialCredential: (payload: {
    channel: string;
    access_token?: string;
    person_urn?: string;
  }) =>
    requestJson<{
      ok: boolean;
      channel: string;
      account_name?: string;
      person_urn?: string;
      message: string;
    }>("/social/credentials/test", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listAuditLogs: () => requestJson<AuditLogEntry[]>("/audit-logs"),

  getAnalyticsOverview: () => requestJson<AnalyticsOverview>("/analytics/overview"),

  calculateWatchTimeShare: (payload: {
    variant_a: { impressions: number; ctr_pct: number; avd_seconds: number };
    variant_b: { impressions: number; ctr_pct: number; avd_seconds: number };
  }) =>
    requestJson<WatchTimeShareResponse>("/analytics/watch-time-share", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  diagnoseRmta: (payload: {
    project_id?: string;
    window_type: "24h" | "7d" | "30d";
    views: number;
    baseline_views: number;
    hold_rate_3s: number;
    completion_rate: number;
    sends_per_reach: number;
    dwell_time_seconds: number;
    watch_time_share: number;
    consecutive_bottom_quartile_iterations: number;
    persist_rule: boolean;
  }) =>
    requestJson<RMTADiagnosisResponse>("/analytics/diagnose-rmta", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  mcpHealthcheck: () => requestJson<Record<string, unknown>>("/mcp/healthcheck"),

  listN8nWorkflows: () => requestJson<N8nWorkflowTemplate[]>("/n8n/workflows"),

  listKigalChatInteractions: () =>
    requestJson<KigalChatInteraction[]>("/kigalchat/interactions"),

  getKigalChatStatus: () => requestJson<KigalChatStatus>("/kigalchat/status"),

  generateAdCampaign: (payload: AdCampaignGenerateRequest) =>
    requestJson<AdCampaignResponse>("/ads/generate-campaign", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // --- Metricool-style Publishing Scheduler, Best Times & Autolists ---

  getPublishingCalendar: (params?: { start?: string; end?: string; channel?: string }) => {
    const qs = new URLSearchParams();
    if (params?.start) qs.set("start", params.start);
    if (params?.end) qs.set("end", params.end);
    if (params?.channel) qs.set("channel", params.channel);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return requestJson<PublishingCalendarResponse>(`/publishing/calendar${suffix}`);
  },

  createComposerPost: (payload: ComposerPostCreateRequest) =>
    requestJson<{
      created_count: number;
      posts: SocialPost[];
      publications?: Array<Record<string, unknown>>;
    }>("/publishing/posts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  rescheduleSocialPost: (
    postId: string,
    payload: {
      scheduled_at?: string | null;
      timezone?: string;
      auto_publish?: boolean;
      publish_status?: string;
      hitl_token?: string | null;
    }
  ) =>
    requestJson<SocialPost>(`/publishing/schedule/${postId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteSocialPost: (postId: string) =>
    requestJson<{ deleted: boolean; post_id: string }>(`/publishing/posts/${postId}`, {
      method: "DELETE",
    }),

  getBestTimes: (channel: string, timezone = "Europe/Madrid") =>
    requestJson<BestTimeHeatmapResponse>(
      `/publishing/best-times?channel=${encodeURIComponent(channel)}&timezone=${encodeURIComponent(timezone)}`
    ),

  listAutolists: () => requestJson<AutolistRecord[]>("/publishing/autolists"),

  createAutolist: (payload: {
    name: string;
    description?: string;
    channels: string[];
    schedule_slots: Array<{ day_of_week: number; time: string }>;
    timezone?: string;
    is_active?: boolean;
    repeat_loop?: boolean;
  }) =>
    requestJson<AutolistRecord>("/publishing/autolists", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateAutolist: (
    id: string,
    payload: Partial<{
      name: string;
      description: string;
      channels: string[];
      schedule_slots: Array<{ day_of_week: number; time: string }>;
      timezone: string;
      is_active: boolean;
      repeat_loop: boolean;
    }>
  ) =>
    requestJson<AutolistRecord>(`/publishing/autolists/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteAutolist: (id: string) =>
    requestJson<{ deleted: boolean; autolist_id: string }>(`/publishing/autolists/${id}`, {
      method: "DELETE",
    }),

  addAutolistItem: (
    id: string,
    payload: {
      project_id?: string | null;
      title?: string | null;
      post_body: string;
      first_comment?: string | null;
      media_url?: string | null;
    }
  ) =>
    requestJson<AutolistItemRecord>(`/publishing/autolists/${id}/items`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteAutolistItem: (id: string, itemId: string) =>
    requestJson<{ deleted: boolean; item_id: string }>(
      `/publishing/autolists/${id}/items/${itemId}`,
      { method: "DELETE" }
    ),

  // --- LinkedIn Ads Library API & Idea Conversion ---

  getLinkedInAdLibraryStatus: () =>
    requestJson<LinkedInAdLibraryStatusResponse>("/ads/linkedin-library/status"),

  searchLinkedInAdLibrary: (payload: LinkedInAdLibrarySearchRequest) =>
    requestJson<LinkedInAdLibrarySearchResponse>("/ads/linkedin-library/search", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  importLinkedInAdToIdea: (payload: {
    advertiser_name: string;
    headline?: string | null;
    body_text: string;
    format: string;
    landing_page_url?: string | null;
  }) =>
    requestJson<{
      imported: boolean;
      project_id: string;
      asset_code: string;
      working_title: string;
    }>("/ads/linkedin-library/to-idea", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
