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

export type ScriptTargetPlatform = "YouTube" | "Instagram" | "TikTok" | "LinkedIn" | "X";
export type ContentFormat = "TEXT_AND_VIDEO" | "TEXT_ONLY" | "VIDEO_ONLY";

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
  context_notes?: string | null;
  source_origin?: string;
  target_platforms?: ScriptTargetPlatform[];
  content_format?: ContentFormat;
}

export interface IdeaChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export interface IdeaChatRefineRequest {
  messages: IdeaChatMessage[];
  current_title?: string;
  current_context?: string;
  target_platforms?: ScriptTargetPlatform[];
  preferred_format?: ContentFormat;
}

export interface IdeaChatRefineResponse {
  reply: string;
  suggested_title?: string;
  suggested_context_notes?: string;
  suggested_format: ContentFormat;
  suggested_platforms: ScriptTargetPlatform[];
  suggested_hooks: HookCandidate[];
  calculated_ice?: number;
  tam_recommendation: "CORE_80" | "EXPANSION_20";
  ready_to_create: boolean;
}

export interface IdeaAIEvaluationRequest {
  concept_title: string;
  context_notes?: string;
  creator_niche?: string;
  creator_icp?: string;
  target_platforms?: ScriptTargetPlatform[];
}

export interface IdeaAIEvaluationResponse {
  impact: number;
  confidence: number;
  ease: number;
  ice_score: number;
  tam_classification: "CORE_80" | "EXPANSION_20";
  rationale: string;
  suggested_platforms: ScriptTargetPlatform[];
  hook_candidates: HookCandidate[];
  estimated_hold_rate: number;
}

export interface RadarMatutinoIngestRequest {
  concept_title: string;
  context_notes?: string;
  source_url?: string;
  source_origin?: string;
  target_platforms?: ScriptTargetPlatform[];
  target_duration?: DurationPreset;
  conversion_goal?: ConversionGoal;
  auto_evaluate_ai?: boolean;
  auto_create_project?: boolean;
}

export interface RadarMatutinoIngestResponse {
  status: string;
  concept_title: string;
  source_origin: string;
  ice_score: number;
  threshold_met: boolean;
  project_id?: string | null;
  asset_code?: string | null;
  idea_id?: string | null;
  target_platforms: ScriptTargetPlatform[];
  context_notes?: string | null;
  evaluation?: IdeaAIEvaluationResponse;
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
  native_signature_profile?: Record<string, string>;
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
  scheduled_at?: string | null;
  published_at: string | null;
  auto_publish?: boolean;
  timezone?: string;
  publish_error?: string | null;
  autolist_id?: string | null;
  project_title?: string | null;
  asset_code?: string | null;
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

export interface KigalChatInteraction {
  id: string;
  timestamp: string;
  platform: string;
  username: string;
  comment_text: string;
  matched_keyword: string;
  public_comment_reply: string;
  dm_reply_text: string;
  lead_magnet_title: string;
  delivery_url: string;
  /** SENT = message sent by the Instagram bot (see kind); MATCHED = keyword match only, nothing delivered. */
  status: "SENT" | "DELIVERED" | "MATCHED" | "PENDING" | "UNMATCHED" | (string & {});
  kind?: "prompt" | "not_following" | "reward" | "public" | (string & {}) | null;
  account_username?: string | null;
  rule_id?: number | null;
}

export interface KigalChatFunnelRow {
  rule_id?: number | string | null;
  account_id?: string;
  name?: string;
  keyword?: string | null;
  keywords?: string[];
  enabled?: boolean | null;
  prompts_sent?: number;
  rewards_sent?: number;
  conversion_pct?: number | null;
}

export interface KigalChatStatus {
  bot_connected?: boolean;
  accounts?: number;
  active_rules?: number;
  funnel_7d?: KigalChatFunnelRow[];
  detail?: string;
}

export interface AdCampaignGenerateRequest {
  project_id?: string | null;
  topic: string;
  platforms: string[];
  objective: string;
  target_url?: string;
  trigger_keyword?: string;
}

export interface AdCreativeVariant {
  variant_id: string;
  angle_name: string;
  framework: string;
  primary_text: string;
  headline: string;
  description: string;
  cta_button: string;
  remotion_916_storyboard: Array<{
    timecode: string;
    visual: string;
    copy_overlay: string;
    audio: string;
  }>;
}

export interface LinkedInThoughtLeaderAd {
  intro_hook: string;
  full_post_body: string;
  cta_soft: string;
  target_audience_note: string;
  estimated_ctr_benchmark: string;
}

export interface LinkedInSponsoredSingleImageAd {
  intro_text: string;
  headline: string;
  description: string;
  cta_label: string;
  visual_brief: string;
}

export interface LinkedInDocumentAd {
  intro_text: string;
  headline: string;
  slides_outline: string[];
  lead_gen_form_fields: string[];
  thank_you_message: string;
}

export interface LinkedInConversationAd {
  subject: string;
  opening_message: string;
  cta_buttons: string[];
}

export interface LinkedInTargetingBlueprint {
  job_titles: string[];
  seniorities: string[];
  company_sizes: string[];
  industries: string[];
  geographies: string[];
  recommended_daily_budget_eur: string;
}

export interface LinkedInAdsSpec {
  thought_leader_ad: LinkedInThoughtLeaderAd;
  single_image_ad: LinkedInSponsoredSingleImageAd;
  document_carousel_ad: LinkedInDocumentAd;
  conversation_ad: LinkedInConversationAd;
  targeting_blueprint: LinkedInTargetingBlueprint;
}

export interface LinkedInAdLibraryItem {
  ad_id: string;
  ad_url?: string | null;
  format: string;
  status: string;
  advertiser_name: string;
  advertiser_url?: string | null;
  payer_name?: string | null;
  body_text: string;
  headline?: string | null;
  description?: string | null;
  landing_page_url?: string | null;
  creative_urls: string[];
  first_shown_date?: string | null;
  last_shown_date?: string | null;
  impressions_range?: string | null;
  top_countries: string[];
  targeting_included: string[];
}

export interface LinkedInAdLibrarySearchRequest {
  keyword?: string;
  advertiser?: string;
  countries?: string[];
  date_start?: string;
  date_end?: string;
  count?: number;
}

export interface LinkedInAdLibrarySearchResponse {
  live: boolean;
  source: "linkedin_live_api" | "error" | "not_configured";
  status_code?: number | null;
  needs_token_refresh?: boolean;
  message: string;
  api_version_used?: string | null;
  total_returned: number;
  items: LinkedInAdLibraryItem[];
  insights: {
    top_formats: Array<{ format: string; count: number }>;
    avg_copy_chars: number;
    detected_angles: string[];
  };
}

export interface LinkedInAdLibraryStatusResponse {
  configured: boolean;
  live_verified: boolean;
  token_source: string;
  account_name: string;
  api_version_used?: string | null;
  status_code?: number | null;
  needs_token_refresh?: boolean;
  message: string;
}

export interface BestTimeSlot {
  day_of_week: number;
  day_label: string;
  hour: number;
  score: number;
  label: string;
}

export interface BestTimeHeatmapResponse {
  channel: string;
  timezone: string;
  source: "analytics" | "benchmark";
  peak_slot: { day_label: string; hour: number; score: number };
  grid: BestTimeSlot[];
}

export interface AutolistItemRecord {
  id: string;
  autolist_id: string;
  project_id?: string | null;
  title?: string | null;
  post_body: string;
  first_comment?: string | null;
  media_url?: string | null;
  position: number;
  last_published_at?: string | null;
  times_published: number;
}

export interface AutolistRecord {
  id: string;
  name: string;
  description: string;
  channels: string[];
  schedule_slots: Array<{ day_of_week: number; time: string }>;
  timezone: string;
  is_active: boolean;
  repeat_loop: boolean;
  items: AutolistItemRecord[];
  created_at: string;
}

export interface CalendarProjectedSlot {
  id: string;
  autolist_id: string;
  autolist_name: string;
  channel: string;
  scheduled_at: string;
  title: string;
  post_body: string;
  is_projected: true;
}

export interface PublishingCalendarResponse {
  posts: SocialPost[];
  projected_autolist_slots: CalendarProjectedSlot[];
  connected_channels: Record<
    string,
    {
      configured: boolean;
      account_name: string;
      source: string;
      person_urn: string;
    }
  >;
  timezone: string;
}

export interface ComposerPostCreateRequest {
  project_id?: string | null;
  channels: SocialChannel[];
  title?: string | null;
  post_body: string;
  per_channel_overrides?: Record<
    string,
    { title?: string; post_body?: string; first_comment?: string }
  >;
  first_comment?: string | null;
  hashtags?: string[];
  media_url?: string | null;
  visual_mode?: string;
  publish_mode: "DRAFT" | "SCHEDULED" | "MANUAL_REMINDER" | "PUBLISH_NOW";
  scheduled_at?: string | null;
  timezone?: string;
  auto_publish?: boolean;
  hitl_token?: string | null;
}

export interface AdCampaignResponse {
  topic: string;
  objective: string;
  platforms: string[];
  variants: AdCreativeVariant[];
  google_rsa: {
    headlines: string[];
    descriptions: string[];
    search_keywords_exact: string[];
    search_keywords_phrase: string[];
    search_keywords_negative: string[];
    youtube_5s_hook: string;
  };
  linkedin_ads?: LinkedInAdsSpec | null;
  ga4_utm_links: Array<{
    platform: string;
    utm_url?: string;
    url?: string;
    variant_id?: string;
  }>;
}

export type LinkedInVisualMode = "CAROUSEL_PDF" | "IMAGE_INFOGRAPHIC" | "NONE";

export interface SocialVisualGenerateRequest {
  title: string;
  body: string;
  visual_type: "INFOGRAPHIC" | "IMAGE";
  provider: "nano_banana" | "gpt_images" | "svg_local";
  prompt?: string;
  author_name?: string;
}

export interface SocialVisualGenerateResponse {
  image_url: string;
  provider: string;
  visual_type: string;
  prompt: string;
  note: string;
}
