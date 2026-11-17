import { z } from "zod";

export const DurationPresetSchema = z.enum([
  "MICRO_SHORT",
  "STANDARD_SHORT",
  "EXTENDED_SHORT",
  "LONG_FORM",
]);
export type DurationPreset = z.infer<typeof DurationPresetSchema>;

export const ConversionGoalSchema = z.enum([
  "EMAIL_LEAD_CAPTURE",
  "B2B_INBOUND_CONVERSATION",
  "RELATIONAL_DISTRIBUTION_SHARES",
  "PLATFORM_RETENTION_LOOP",
]);
export type ConversionGoal = z.infer<typeof ConversionGoalSchema>;

export const FSMStateSchema = z.enum([
  "INIT",
  "CAPTURED",
  "RESEARCHED_TRIAGED",
  "SCRIPTED_PACKAGED",
  "HITL_PENDING_PRODUCTION",
  "PRODUCED_VALIDATED",
  "HITL_PENDING_PUBLISH",
  "PUBLISHED_LIVE",
  "AUDITED_CLOSED_LOOP",
  "REJECTED_REVISION",
  "ARCHIVED",
]);
export type FSMState = z.infer<typeof FSMStateSchema>;

export type SocialChannel = "YouTube" | "Instagram" | "TikTok" | "LinkedIn";

export interface TwoColumnScriptBlock {
  block_id: string;
  section_label: string;
  timecode: string;
  visual_direction: string;
  b_roll_cue: string;
  on_screen_text: string;
  audio_voiceover: string;
  sfx_cue: string;
  music_cue: string;
  pattern_interrupt_sec: number;
  word_count: number;
  estimated_seconds: number;
  pacing_warning: boolean;
}

export interface HookCandidate {
  category: string;
  hook_text: string;
  pattern_interrupt: string;
  estimated_hold_rate: number;
}

export interface ABPackagingVariant {
  variant_label: string;
  title: string;
  thumbnail_concept: string;
  thumbnail_dimensions: string;
  hypothesis: string;
}

export interface ScriptDocument {
  id: string;
  project_id: string;
  script_version: number;
  duration_preset: DurationPreset;
  conversion_goal: ConversionGoal;
  wpm_rate: number;
  two_column_blocks: TwoColumnScriptBlock[];
  hook_variants: HookCandidate[];
  selected_hook_index: number;
  cta_text: string;
  word_count: number;
  estimated_duration_sec: number;
  target_word_range: [number, number];
  target_duration_range_sec: [number, number];
  pattern_interrupt_interval_sec: [number, number];
  within_budget: boolean;
  created_at: string;
}

export interface ContentProject {
  id: string;
  asset_code: string;
  working_title: string;
  target_duration: DurationPreset;
  conversion_goal: ConversionGoal;
  current_state: FSMState;
  ice_score: number;
  tam_classification: "CORE_80" | "EXPANSION_20";
  ab_variants: ABPackagingVariant[];
  state_history: Array<Record<string, unknown>>;
  temporal_workflow_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WordTimestamp {
  word: string;
  start_ms: number;
  end_ms: number;
  confidence: number;
}

export interface VideoAssetQC {
  id?: string;
  raw_media_url: string;
  master_media_url: string | null;
  thumbnail_a_url: string | null;
  thumbnail_b_url: string | null;
  silences_trimmed: number;
  silence_segments_json: Array<{ start: number; end: number; duration: number }>;
  measured_lufs: number | null;
  true_peak_dbfs: number | null;
  transcription_json: WordTimestamp[];
  ass_subtitles: string | null;
  qc_passed: boolean;
  qc_report: Record<string, unknown>;
}

export interface MediaQCReport {
  video_asset_id?: string | null;
  project_id: string;
  raw_media_url: string;
  master_media_url: string;
  thumbnail_a_url?: string | null;
  thumbnail_b_url?: string | null;
  silences_trimmed: number;
  silence_intervals: Array<{ start: number; end: number; duration: number }>;
  measured_lufs: number;
  true_peak_dbfs: number;
  lufs_within_ebu_r128: boolean;
  resolution: string;
  fps: number;
  transcription_words: WordTimestamp[];
  ass_subtitles_preview: string;
  qc_passed: boolean;
}

export interface SocialPost {
  id: string;
  project_id: string;
  channel: SocialChannel;
  external_platform_id: string | null;
  canonical_url: string | null;
  title: string | null;
  post_body: string;
  first_comment: string | null;
  hashtags: string[];
  metadata_payload: Record<string, unknown>;
  preflight_warnings: string[];
  preflight_passed: boolean;
  publish_status: string;
  hitl_approval_token: string | null;
  published_at: string | null;
}

export interface ProjectDetail {
  project: ContentProject;
  script: ScriptDocument | null;
  video_asset: VideoAssetQC | null;
  social_posts: SocialPost[];
}

export interface SocialAccountItem {
  id: string;
  platform: string;
  label: string;
  url: string;
}

export interface GitHubRepoItem {
  repo_full_name: string;
  repo_url: string;
  description: string;
  primary_language?: string | null;
  topics: string[];
  homepage?: string | null;
  added_at?: string | null;
}

export interface LeadMagnetItem {
  id: string;
  title: string;
  description: string;
  format: string;
  delivery_url: string;
  source: string;
  created_at?: string | null;
}

export interface ManyChatTriggerRule {
  id: string;
  keyword: string;
  lead_magnet_id?: string | null;
  platform: string;
  dm_reply_template: string;
  manychat_flow_id?: string | null;
  active: boolean;
  triggers_count: number;
}

export interface CreatorProfile {
  creator_id: string;
  name: string;
  age?: number | null;
  personal_brand_tagline: string | null;
  niche: string;
  ideal_customer_profile: string;
  project_context?: string | null;
  strategic_goals?: string[];
  communication_style?: string | null;
  visual_style?: string | null;
  content_pillars: string[];
  active_conversion_goal: ConversionGoal;
  conversion_goals_catalog: Record<
    string,
    {
      objective: string;
      lead_magnet_name?: string;
      trigger_word?: string;
      automation_backend?: string;
      preferred_cta_style: string;
    }
  >;
  social_profiles: Record<string, string>;
  social_accounts?: SocialAccountItem[];
  github_repos?: GitHubRepoItem[];
  lead_magnets?: LeadMagnetItem[];
  manychat_triggers?: ManyChatTriggerRule[];
  voice_guidelines?: string | null;
}

export interface AuditLogEntry {
  id: string;
  project_id: string | null;
  action_type: string;
  agent_or_user_id: string;
  security_tier: number;
  operation_status: string;
  hitl_token_id: string | null;
  payload: Record<string, unknown>;
  ip_source: string | null;
  created_at: string;
}

export interface WatchTimeShareResponse {
  variant_a_watch_time_seconds: number;
  variant_b_watch_time_seconds: number;
  share_a_pct: number;
  share_b_pct: number;
  winner: string;
  delta_pct: number;
  explanation: string;
}

export interface RMTADiagnosisResponse {
  views_factor_vs_baseline: number;
  is_outlier_positive: boolean;
  is_outlier_negative: boolean;
  diagnosis_layer: string;
  rmta_classification: string;
  recommended_action: string;
  sends_social_value_sufficient: boolean;
  four_layer_breakdown: Record<
    string,
    { status: string; metric: string; note: string }
  >;
  learned_rule_statement: string;
}

export interface AnalyticsOverview {
  snapshots: Array<{
    id: string;
    social_post_id: string;
    window_type: "24h" | "7d" | "30d";
    view_count: number;
    hold_rate_3s: number;
    completion_rate: number;
    watch_time_share: number;
    sends_per_reach: number;
    dwell_time_seconds: number;
    outlier_multiplier: number;
    retention_curve: Array<{ sec: number; pct: number }>;
    diagnosis_layer: string;
    rmta_classification: string;
    recommended_action: string;
  }>;
  learned_rules: Array<{
    id: string;
    rmta_classification: string;
    diagnosis_layer: string;
    rule_statement: string;
    confidence_weight: number;
    created_at: string;
  }>;
  hook_vault: Array<{
    id: string;
    hook_text: string;
    hook_type: string;
    verdict: string;
    observed_hold_rate: number;
  }>;
}

export interface N8nWorkflowTemplate {
  workflow_id: string;
  filename: string;
  name: string;
  trigger_type: string;
  schedule_or_webhook: string;
  description: string;
  endpoints_used: string[];
  workflow_json: Record<string, unknown>;
}
