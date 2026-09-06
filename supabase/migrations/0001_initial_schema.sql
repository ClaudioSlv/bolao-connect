create extension if not exists pgcrypto;

create type public.pool_status as enum ('draft','open','payment_closed','drawn','archived');
create type public.participant_status as enum ('invited','confirmed','waitlist','cancelled');
create type public.payment_status as enum ('pending','partial','confirmed','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.pools (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  title text not null,
  lottery text not null,
  contest_number integer,
  estimated_prize_cents bigint,
  share_price_cents bigint not null check (share_price_cents >= 0),
  total_shares integer not null check (total_shares > 0),
  payment_deadline timestamptz not null,
  draw_at timestamptz,
  status public.pool_status not null default 'draft',
  public_slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid references public.profiles(id),
  name text not null,
  phone text,
  telegram_username text,
  shares integer not null default 1 check (shares > 0),
  status public.participant_status not null default 'invited',
  payment_status public.payment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  status public.payment_status not null default 'pending',
  receipt_path text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  payment_id uuid references public.payments(id),
  type text not null,
  amount_cents bigint not null,
  shares integer not null default 0,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  lottery text not null,
  contest_number integer,
  numbers jsonb not null,
  special_value jsonb,
  receipt_path text,
  created_at timestamptz not null default now()
);

create table public.lottery_results (
  id uuid primary key default gen_random_uuid(),
  lottery text not null,
  contest_number integer not null,
  draw_index integer not null default 1,
  numbers jsonb not null,
  special_value jsonb,
  source text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique(lottery, contest_number, draw_index)
);

create table public.game_checks (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  result_id uuid not null references public.lottery_results(id) on delete cascade,
  hits integer not null default 0,
  matched_numbers jsonb not null default '[]'::jsonb,
  status text not null,
  prize_label text,
  checked_at timestamptz not null default now(),
  unique(game_id, result_id)
);

create table public.reminder_preferences (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete cascade,
  channel text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references public.pools(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null,
  entity_type text,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.pools enable row level security;
alter table public.participants enable row level security;
alter table public.payments enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.games enable row level security;
alter table public.lottery_results enable row level security;
alter table public.game_checks enable row level security;
alter table public.reminder_preferences enable row level security;
alter table public.audit_events enable row level security;

create policy "profile self read" on public.profiles for select using (auth.uid() = id);
create policy "profile self update" on public.profiles for update using (auth.uid() = id);

create policy "owner manages pools" on public.pools for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "members read pools" on public.pools for select using (
  auth.uid() = owner_id or exists (select 1 from public.participants p where p.pool_id = pools.id and p.user_id = auth.uid() and p.status <> 'cancelled')
);

create policy "owner manages participants" on public.participants for all using (
  exists (select 1 from public.pools b where b.id = participants.pool_id and b.owner_id = auth.uid())
) with check (
  exists (select 1 from public.pools b where b.id = participants.pool_id and b.owner_id = auth.uid())
);
create policy "member reads participants" on public.participants for select using (
  exists (select 1 from public.pools b where b.id = participants.pool_id and (b.owner_id = auth.uid() or exists (select 1 from public.participants me where me.pool_id = b.id and me.user_id = auth.uid() and me.status <> 'cancelled')))
);

create policy "owner manages payments" on public.payments for all using (
  exists (select 1 from public.pools b where b.id = payments.pool_id and b.owner_id = auth.uid())
) with check (
  exists (select 1 from public.pools b where b.id = payments.pool_id and b.owner_id = auth.uid())
);

create policy "members read wallet" on public.wallet_transactions for select using (
  exists (select 1 from public.pools b where b.id = wallet_transactions.pool_id and (b.owner_id = auth.uid() or exists (select 1 from public.participants me where me.pool_id = b.id and me.user_id = auth.uid() and me.status <> 'cancelled')))
);
create policy "owner manages wallet" on public.wallet_transactions for all using (
  exists (select 1 from public.pools b where b.id = wallet_transactions.pool_id and b.owner_id = auth.uid())
) with check (
  exists (select 1 from public.pools b where b.id = wallet_transactions.pool_id and b.owner_id = auth.uid())
);

create policy "pool members read games" on public.games for select using (
  exists (select 1 from public.pools b where b.id = games.pool_id and (b.owner_id = auth.uid() or exists (select 1 from public.participants me where me.pool_id = b.id and me.user_id = auth.uid() and me.status <> 'cancelled')))
);
create policy "owner manages games" on public.games for all using (
  exists (select 1 from public.pools b where b.id = games.pool_id and b.owner_id = auth.uid())
) with check (
  exists (select 1 from public.pools b where b.id = games.pool_id and b.owner_id = auth.uid())
);

create policy "authenticated reads results" on public.lottery_results for select to authenticated using (true);
create policy "authenticated reads checks" on public.game_checks for select to authenticated using (true);

-- Próxima migração: políticas privadas de comprovantes, RPC/trigger transacional da carteira,
-- ingestão de resultados por service role, políticas de lembretes/auditoria e views financeiras seguras.
