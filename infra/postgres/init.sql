-- Autonomous Content Engine Web - Enterprise PostgreSQL 16 + pgvector Schema
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Espacios de Trabajo (Multi-Tenant Workspaces)
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    plan_tier VARCHAR(50) NOT NULL DEFAULT 'PRO',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Perfil de Contexto del Creador (Context Engine)
CREATE TABLE IF NOT EXISTS creator_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    creator_code VARCHAR(50) NOT NULL DEFAULT 'CR-001',
    creator_name VARCHAR(255) NOT NULL,
    personal_brand_tagline TEXT,
    niche VARCHAR(255) NOT NULL,
    target_icp TEXT NOT NULL,
    active_goal VARCHAR(64) NOT NULL DEFAULT 'EMAIL_LEAD_CAPTURE',
    content_pillars JSONB NOT NULL DEFAULT '[]'::jsonb,
    conversion_goals_catalog JSONB NOT NULL DEFAULT '{}'::jsonb,
    lead_magnets JSONB NOT NULL DEFAULT '[]'::jsonb,
    social_profiles JSONB NOT NULL DEFAULT '{}'::jsonb,
    voice_guidelines TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bóveda de Ideas y Priorización Cuantitativa ICE
CREATE TABLE IF NOT EXISTS ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    concept_title TEXT NOT NULL,
    source_origin VARCHAR(100) NOT NULL DEFAULT 'manual',
    impact_score NUMERIC(4,1) NOT NULL CHECK (impact_score BETWEEN 1.0 AND 10.0),
    confidence_score NUMERIC(4,1) NOT NULL CHECK (confidence_score BETWEEN 1.0 AND 10.0),
    ease_score NUMERIC(4,1) NOT NULL CHECK (ease_score BETWEEN 1.0 AND 10.0),
    ice_score NUMERIC(4,2) GENERATED ALWAYS AS (ROUND(((impact_score + confidence_score + ease_score) / 3.0)::numeric, 2)) STORED,
    ice_multiplicative NUMERIC(7,2) GENERATED ALWAYS AS (ROUND((impact_score * confidence_score * ease_score)::numeric, 2)) STORED,
    tam_classification VARCHAR(50) NOT NULL DEFAULT 'CORE_80',
    triage_status VARCHAR(50) NOT NULL DEFAULT 'UNPRIORITIZED',
    research_dossier JSONB NOT NULL DEFAULT '{}'::jsonb,
    semantic_embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Proyectos de Contenido / Instancias FSM
CREATE TABLE IF NOT EXISTS content_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    idea_id UUID REFERENCES ideas(id) ON DELETE SET NULL,
    asset_code VARCHAR(50) UNIQUE NOT NULL,
    working_title VARCHAR(255) NOT NULL,
    target_duration VARCHAR(50) NOT NULL DEFAULT 'STANDARD_SHORT',
    conversion_goal VARCHAR(64) NOT NULL DEFAULT 'EMAIL_LEAD_CAPTURE',
    current_state VARCHAR(50) NOT NULL DEFAULT 'INIT',
    ice_score NUMERIC(4,2) NOT NULL DEFAULT 0.0,
    tam_classification VARCHAR(50) NOT NULL DEFAULT 'CORE_80',
    ab_variants JSONB NOT NULL DEFAULT '[]'::jsonb,
    state_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    temporal_workflow_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Guiones Audiovisuales a Dos Columnas y Empaque A/B
CREATE TABLE IF NOT EXISTS scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES content_projects(id) ON DELETE CASCADE,
    script_version INT NOT NULL DEFAULT 1,
    duration_preset VARCHAR(50) NOT NULL DEFAULT 'STANDARD_SHORT',
    conversion_goal VARCHAR(64) NOT NULL DEFAULT 'EMAIL_LEAD_CAPTURE',
    wpm_rate INT NOT NULL DEFAULT 140 CHECK (wpm_rate BETWEEN 130 AND 150),
    two_column_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    hook_variants JSONB NOT NULL DEFAULT '[]'::jsonb,
    selected_hook_index INT DEFAULT 0,
    cta_text TEXT NOT NULL DEFAULT '',
    word_count INT NOT NULL DEFAULT 0,
    estimated_duration_sec NUMERIC(6,1) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Activos de Video, Pipeline FFmpeg/Whisper y Control de Calidad
CREATE TABLE IF NOT EXISTS video_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES content_projects(id) ON DELETE CASCADE,
    raw_media_url TEXT NOT NULL,
    master_media_url TEXT,
    thumbnail_a_url TEXT,
    thumbnail_b_url TEXT,
    s3_upload_id VARCHAR(255),
    probe_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    transcription_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    silence_segments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    silences_trimmed INT DEFAULT 0,
    measured_lufs NUMERIC(5,2),
    true_peak_dbfs NUMERIC(5,2),
    ass_subtitles TEXT,
    qc_passed BOOLEAN DEFAULT FALSE,
    qc_report JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Publicaciones Multicanal y Verificación Pre-Vuelo
CREATE TABLE IF NOT EXISTS social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES content_projects(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    external_platform_id VARCHAR(255),
    canonical_url TEXT,
    title VARCHAR(255),
    post_body TEXT NOT NULL,
    first_comment TEXT,
    hashtags JSONB DEFAULT '[]'::jsonb,
    metadata_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    preflight_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    preflight_passed BOOLEAN NOT NULL DEFAULT TRUE,
    publish_status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    hitl_approval_token VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Métricas Temporales de Bucle Cerrado (24h, 7d, 30d)
CREATE TABLE IF NOT EXISTS performance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    social_post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    window_type VARCHAR(10) NOT NULL CHECK (window_type IN ('24h', '7d', '30d')),
    view_count BIGINT DEFAULT 0,
    hold_rate_3s NUMERIC(5,2),
    completion_rate NUMERIC(5,2),
    watch_time_share NUMERIC(5,2),
    sends_per_reach NUMERIC(5,2),
    dwell_time_seconds NUMERIC(6,1),
    outlier_multiplier NUMERIC(5,2),
    retention_curve JSONB NOT NULL DEFAULT '[]'::jsonb,
    diagnosis_layer VARCHAR(100),
    rmta_classification VARCHAR(50),
    recommended_action TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Bóveda de Ganchos Validada (Hook Vault + pgvector)
CREATE TABLE IF NOT EXISTS hook_vault (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    hook_text TEXT NOT NULL,
    hook_type VARCHAR(100) NOT NULL,
    verdict VARCHAR(50) NOT NULL DEFAULT 'TEST',
    observed_hold_rate NUMERIC(5,2),
    semantic_vector vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Reglas Aprendidas de Bucle Cerrado (Learned Rules Memory)
CREATE TABLE IF NOT EXISTS learned_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES content_projects(id) ON DELETE SET NULL,
    rmta_classification VARCHAR(50) NOT NULL,
    diagnosis_layer VARCHAR(100) NOT NULL,
    rule_statement TEXT NOT NULL,
    confidence_weight NUMERIC(4,2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Pistas de Auditoría Inmutables (HITL & Governance Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES content_projects(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    agent_or_user_id VARCHAR(255) NOT NULL,
    security_tier INT NOT NULL CHECK (security_tier IN (1, 2, 3)),
    operation_status VARCHAR(50) NOT NULL,
    hitl_token_id VARCHAR(255),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_source VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vistas de compatibilidad con nomenclatura del Dossier
CREATE OR REPLACE VIEW content_assets AS SELECT * FROM content_projects;
CREATE OR REPLACE VIEW media_productions AS SELECT * FROM video_assets;
CREATE OR REPLACE VIEW publications AS SELECT * FROM social_posts;

-- Índices de Rendimiento y Búsqueda Vectorial
CREATE INDEX IF NOT EXISTS idx_content_projects_state ON content_projects(workspace_id, current_state);
CREATE INDEX IF NOT EXISTS idx_social_posts_channel_status ON social_posts(channel, publish_status);
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_window ON performance_snapshots(social_post_id, window_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hook_vault_vector ON hook_vault USING hnsw (semantic_vector vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_ideas_vector ON ideas USING hnsw (semantic_embedding vector_cosine_ops);
