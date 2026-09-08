-- Push opt-in do temporizador antes do cadastro do participante.
-- A inscrição é reconhecida pelo endpoint do navegador/celular.

create table if not exists public.timer_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  enabled boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists timer_push_subscriptions_pool_idx
  on public.timer_push_subscriptions(pool_id, enabled);

alter table public.timer_push_subscriptions enable row level security;
revoke all on public.timer_push_subscriptions from anon, authenticated;
