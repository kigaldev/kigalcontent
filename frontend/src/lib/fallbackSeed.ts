import type {
  AnalyticsOverview,
  AuditLogEntry,
  ContentProject,
  CreatorProfile,
  ProjectDetail,
} from "@/types/engine";

export const FALLBACK_CREATOR_PROFILE: CreatorProfile = {
  creator_id: "CR-001",
  name: "Creador",
  age: 30,
  personal_brand_tagline: "",
  niche: "",
  ideal_customer_profile: "",
  project_context: "",
  strategic_goals: [
    "Captar correos y leads cualificados (Lead Magnets)",
    "Posicionar liderazgo de opinión y reconocimiento de marca",
  ],
  communication_style: "Educativo y Directo",
  visual_style: "Tecnológico / Minimalista",
  content_pillars: [],
  active_conversion_goal: "EMAIL_LEAD_CAPTURE",
  conversion_goals_catalog: {
    EMAIL_LEAD_CAPTURE: {
      objective: "Migrar audiencia alquilada a lista de correo propia mediante Lead Magnet.",
      lead_magnet_name: "Recurso / Plantilla de Alto Valor",
      trigger_word: "RECURSO",
      automation_backend: "ManyChat DM / KigalChat",
      preferred_cta_style: "Comenta [TRIGGER_WORD] y te envío el recurso completo por privado.",
    },
    B2B_INBOUND_CONVERSATION: {
      objective: "Iniciar conversaciones cualificadas 1 a 1 para consultoría o implementación.",
      trigger_word: "SISTEMAS",
      automation_backend: "LinkedIn / Instagram Inbound DMs",
      preferred_cta_style:
        "Si quieres auditar tus procesos, envíame DM con la palabra [TRIGGER_WORD].",
    },
    RELATIONAL_DISTRIBUTION_SHARES: {
      objective: "Maximizar envíos por mensaje directo (Dark Social / Sends per Reach > 2%).",
      preferred_cta_style:
        "Envíale este video a ese colega o socio que necesita ver este sistema.",
    },
    PLATFORM_RETENTION_LOOP: {
      objective: "Encadenar sesiones en YouTube mediante pantalla final o siguiente video.",
      preferred_cta_style:
        "Haz clic en el video en pantalla para ver la implementación técnica completa.",
    },
  },
  social_profiles: {
    youtube_channel_id: "",
    instagram_username: "",
    tiktok_username: "",
    linkedin_vanity_name: "",
  },
  github_repos: [],
  lead_magnets: [],
  manychat_triggers: [],
};

// Pure clean initial state: 0 dummy projects, ready for user's real content
export const FALLBACK_PROJECTS: ContentProject[] = [];

export function buildEmptyProjectDetail(proj: ContentProject): ProjectDetail {
  return {
    project: proj,
    script: {
      id: `script-${proj.id}`,
      project_id: proj.id,
      script_version: 1,
      duration_preset: proj.target_duration,
      conversion_goal: proj.conversion_goal,
      wpm_rate: 140,
      two_column_blocks: [
        {
          block_id: `blk-${proj.id}-1`,
          section_label: "Gancho (0-3s)",
          timecode: "00:00 - 00:03",
          visual_direction: "Primer plano a cámara, zoom punch 115%",
          b_roll_cue: "",
          on_screen_text: "GANCHO",
          audio_voiceover: `Explica el gancho principal sobre ${proj.working_title}.`,
          sfx_cue: "",
          music_cue: "",
          pattern_interrupt_sec: 3,
          word_count: 10,
          estimated_seconds: 4,
          pacing_warning: false,
        },
      ],
      hook_variants: [
        {
          category: "Contrarian",
          hook_text: `La mayoría se equivoca con "${proj.working_title}": esto es lo que funciona.`,
          pattern_interrupt: "Zoom punch 115%",
          estimated_hold_rate: 73.5,
        },
      ],
      selected_hook_index: 0,
      cta_text: "Comenta abajo para recibir el recurso.",
      word_count: 10,
      estimated_duration_sec: 4,
      target_word_range: [110, 150],
      target_duration_range_sec: [45, 60],
      pattern_interrupt_interval_sec: [3, 5],
      within_budget: true,
      created_at: new Date().toISOString(),
    },
    video_asset: null,
    social_posts: [],
  };
}

export const FALLBACK_DETAIL: ProjectDetail | null = null;

export const FALLBACK_AUDIT_LOGS: AuditLogEntry[] = [];

export const FALLBACK_ANALYTICS: AnalyticsOverview = {
  snapshots: [],
  learned_rules: [],
  hook_vault: [],
};
