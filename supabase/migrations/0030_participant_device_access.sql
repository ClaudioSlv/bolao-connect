-- Autoriza um aparelho/navegador após confirmação dos últimos 4 dígitos do WhatsApp.
-- As sessões usam token aleatório com hash salvo no banco; o valor bruto fica apenas em cookie HttpOnly.

create table if not exists public.participant_device_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  session_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists participant_device_sessions_lookup_idx
  on public.participant_device_sessions(participant_id, session_hash);

create index if not exists participant_device_sessions_expiry_idx
  on public.participant_device_sessions(expires_at);

alter table public.participant_device_sessions enable row level security;
revoke all on public.participant_device_sessions from anon, authenticated;

create table if not exists public.participant_access_attempts (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.participant_access_attempts enable row level security;
revoke all on public.participant_access_attempts from anon, authenticated;

comment on table public.participant_device_sessions is
  'Sessões de aparelhos autorizados a abrir um painel individual de participante.';
comment on table public.participant_access_attempts is
  'Controle simples de tentativas de confirmação de acesso por participante.';
