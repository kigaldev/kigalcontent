import type {
  AnalyticsOverview,
  AuditLogEntry,
  ContentProject,
  ConversionGoal,
  CreatorProfile,
  DurationPreset,
  FSMState,
  MediaQCReport,
  ProjectDetail,
  RMTADiagnosisResponse,
  ScriptDocument,
  SocialChannel,
  SocialPost,
  TwoColumnScriptBlock,
  WatchTimeShareResponse,
} from "@/types/engine";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000";
const V1 = `${API_BASE}/api/v1`;

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${V1}${path}`, {
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
  apiBase: API_BASE,

  health: async (): Promise<{ status: string }> => {
    const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    if (!res.ok) throw new Error("Backend offline");
    return res.json();
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
};
