-- Bot «comenta una palabra y te lo mando». Multicuenta.
-- Comparte la base de datos de kigalcontent (esquema public): todas las tablas llevan el prefijo bot_.
-- account_id = user_id de la cuenta profesional de Instagram (el de GET /me?fields=user_id, NO "id").
-- igsid = id de la persona que comenta o escribe (Instagram-scoped id).
-- Idempotente: se puede ejecutar más de una vez.

create table if not exists bot_accounts (
  account_id text primary key,
  username text not null,
  proyecto text,                       -- carpeta de kigalcontent/studio/proyectos/
  access_token text not null,
  token_refreshed_at timestamptz not null default now(),
  paused_until timestamptz,            -- pausa de los FRENOS; null = funcionando
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists bot_rules (
  id serial primary key,
  account_id text not null references bot_accounts(account_id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  keywords text[] not null,            -- ej. {GUIA}
  post_id text,                        -- null = todas las publicaciones de la cuenta
  require_follow boolean not null default true,
  follow_prompts text[] not null,      -- 1.er privado, con el botón
  not_following_replies text[] not null,
  reward_messages text[] not null,     -- lo prometido, con el enlace
  public_replies text[] not null,      -- respuesta bajo su comentario
  created_at timestamptz not null default now(),
  constraint bot_follow_prompts_3 check (array_length(follow_prompts, 1) >= 3),
  constraint bot_not_following_3 check (array_length(not_following_replies, 1) >= 3),
  constraint bot_reward_3 check (array_length(reward_messages, 1) >= 3),
  constraint bot_public_10 check (array_length(public_replies, 1) >= 10)
);
create index if not exists bot_rules_account on bot_rules(account_id) where enabled;

create table if not exists bot_processed_comments (
  comment_id text primary key,
  account_id text not null,
  igsid text,
  username text,
  rule_id int,
  created_at timestamptz not null default now()
);

create table if not exists bot_pending_follow (
  account_id text not null,
  igsid text not null,
  rule_id int not null references bot_rules(id) on delete cascade,
  username text,
  created_at timestamptz not null default now(),
  primary key (account_id, igsid)
);

create table if not exists bot_sent (
  id bigserial primary key,
  account_id text not null,
  igsid text not null,
  username text,
  rule_id int not null,
  kind text not null check (kind in ('prompt', 'not_following', 'reward', 'public')),
  created_at timestamptz not null default now()
);
create index if not exists bot_sent_account_time on bot_sent(account_id, created_at desc);
create index if not exists bot_sent_user_time on bot_sent(account_id, igsid, created_at desc);

create table if not exists bot_retry_comments (
  comment_id text primary key,
  account_id text not null,
  igsid text,
  username text,
  rule_id int,
  comment_created_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Solo entra el servidor con la service role: RLS activado y sin políticas.
alter table bot_accounts enable row level security;
alter table bot_rules enable row level security;
alter table bot_processed_comments enable row level security;
alter table bot_pending_follow enable row level security;
alter table bot_sent enable row level security;
alter table bot_retry_comments enable row level security;

-- Consulta para el SQL Editor: por regla, últimos 7 días, cuántos recibieron el botón y cuántos el enlace.
create or replace view bot_embudo_7d with (security_invoker = true) as
select r.account_id, r.name, r.keywords,
  count(*) filter (where s.kind = 'prompt') as botones,
  count(*) filter (where s.kind = 'reward') as enlaces,
  round(100.0 * count(*) filter (where s.kind = 'reward') / nullif(count(*) filter (where s.kind = 'prompt'), 0), 1) as conversion_pct,
  r.id as rule_id, r.enabled
from bot_rules r left join bot_sent s on s.rule_id = r.id and s.created_at > now() - interval '7 days'
group by r.id order by botones desc;
