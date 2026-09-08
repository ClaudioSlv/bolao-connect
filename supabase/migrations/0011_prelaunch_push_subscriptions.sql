-- Bolão Connect: lembretes do temporizador antes de existir um bolão publicado.
create table if not exists public.prelaunch_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  enabled boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prelaunch_push_subscriptions_campaign_idx
  on public.prelaunch_push_subscriptions(campaign_key, enabled);

alter table public.prelaunch_push_subscriptions enable row level security;
revoke all on public.prelaunch_push_subscriptions from anon, authenticated;
