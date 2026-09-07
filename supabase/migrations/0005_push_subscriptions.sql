-- Participant push subscriptions for payment-deadline reminders.
-- Safe to run more than once.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  enabled boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(endpoint)
);

create index if not exists push_subscriptions_participant_idx
  on public.push_subscriptions(participant_id, enabled);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
