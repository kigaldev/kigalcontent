import type {
  AnalyticsOverview,
  AuditLogEntry,
  ContentProject,
  ConversionGoal,
  CreatorProfile,
  DurationPreset,
  FSMState,
  MediaQCReport,
  N8nWorkflowTemplate,
  ProjectDetail,
  RMTADiagnosisResponse,
  ScriptDocument,
  SocialChannel,
  SocialPost,
  TwoColumnScriptBlock,
  WatchTimeShareResponse,
} from "@/types/engine";

/**
 * Resolves the API base URL depending on execution environment:
 * 1. Server-side runtime (Vercel Server Functions): Uses `process.env.BACKEND_URL`
 * 2. Client-side runtime: `process.env.NEXT_PUBLIC_API_URL` injected at build-time.
 * 3. Client override: `localStorage.getItem("ACE_BACKEND_URL")` for instant debugging/connection.
 * 4. Browser fallback: `window.location.origin` if not on vercel.app.
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

    if (!url && window.location?.origin && !window.location.hostname.includes("vercel.app")) {
      url = window.location.origin;
    }
  }

  if (!url) {
    url = "http://localhost:8000";
  }

  // Remove trailing slashes and redundant /api or /api/v1 paths
  return url.replace(/\/+$/, "").replace(/\/api\/v1$/, "").replace(/\/api$/, "");
}

export function setCustomBackendUrl(url: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (url && url.trim()) {
      window.localStorage.setItem("ACE_BACKEND_URL", url.trim());
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
    const cleanBase = rawBase.replace(/\/+$/, "").replace(/\/api\/v1$/, "").replace(/\/api$/, "");

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
  }) =>
    requestJson<ContentProject>("/projects", {
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
    two_factor_code?: string;
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
    }
  ) =>
    requestJson<SocialPost>(`/social/posts/${postId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  publishSocial: (payload: {
    project_id: string;
    channels: SocialChannel[];
    hitl_token: string;
    actor: string;
  }) =>
    requestJson<{
      status: string;
      project_id: string;
      publications: Array<Record<string, unknown>>;
    }>("/social/publish", {
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
};
