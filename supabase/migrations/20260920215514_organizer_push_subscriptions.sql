create table if not exists public.organizer_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizer_push_subscriptions_owner_idx
  on public.organizer_push_subscriptions(owner_id,enabled);

alter table public.organizer_push_subscriptions enable row level security;

create policy "owner manages own push subscriptions"
on public.organizer_push_subscriptions for all
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

revoke all on table public.organizer_push_subscriptions from anon;
grant select,insert,update,delete on table public.organizer_push_subscriptions to authenticated;
grant all on table public.organizer_push_subscriptions to service_role;
