-- Regras por bolão, aceite versionado e créditos de prêmios.

alter table public.pools
  add column if not exists rules_text text,
  add column if not exists rules_version integer not null default 1;

create table if not exists public.pool_rule_acceptances (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  rules_version integer not null,
  rules_text text not null,
  accepted_at timestamptz not null default now(),
  unique(pool_id, participant_id, rules_version)
);

create table if not exists public.participant_credits (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  source_pool_id uuid not null references public.pools(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  remaining_cents bigint not null check (remaining_cents >= 0),
  source text not null default 'prize',
  status text not null default 'available' check (status in ('available','used','paid_pix','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pool_rule_acceptances_participant_idx on public.pool_rule_acceptances(participant_id, accepted_at desc);
create index if not exists participant_credits_participant_status_idx on public.participant_credits(participant_id, status, created_at desc);

alter table public.pool_rule_acceptances enable row level security;
alter table public.participant_credits enable row level security;

-- These tables are written/read by server-side service-role flows. No anon grants.
revoke all on public.pool_rule_acceptances from anon;
revoke all on public.participant_credits from anon;
