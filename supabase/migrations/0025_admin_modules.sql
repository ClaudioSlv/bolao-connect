-- Módulos administrativos: correções financeiras, prêmios, erros e documentos legais.
create table if not exists public.payment_adjustments (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  kind text not null check (kind in ('amount_correction','reversal')),
  previous_amount_cents bigint not null check (previous_amount_cents>=0),
  new_amount_cents bigint not null check (new_amount_cents>=0),
  reason text not null check (char_length(reason) between 3 and 300),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.prize_events (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  gross_amount_cents bigint not null check (gross_amount_cents>0),
  description text,
  status text not null default 'draft' check (status in ('draft','distributed','cancelled')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  distributed_at timestamptz
);

create table if not exists public.prize_allocations (
  id uuid primary key default gen_random_uuid(),
  prize_event_id uuid not null references public.prize_events(id) on delete cascade,
  pool_id uuid not null references public.pools(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  shares integer not null check (shares>0),
  amount_cents bigint not null check (amount_cents>=0),
  destination text not null default 'pending' check (destination in ('pending','pix','credit')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(prize_event_id,participant_id)
);

create table if not exists public.app_error_logs (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references public.pools(id) on delete cascade,
  source text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('privacy','terms','lgpd')),
  title text not null,
  content text not null,
  version integer not null default 1,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(owner_id,kind)
);

create index if not exists payment_adjustments_pool_idx on public.payment_adjustments(pool_id,created_at desc);
create index if not exists prize_events_pool_idx on public.prize_events(pool_id,created_at desc);
create index if not exists prize_allocations_participant_idx on public.prize_allocations(participant_id,created_at desc);
create index if not exists app_error_logs_pool_idx on public.app_error_logs(pool_id,created_at desc);

alter table public.payment_adjustments enable row level security;
alter table public.prize_events enable row level security;
alter table public.prize_allocations enable row level security;
alter table public.app_error_logs enable row level security;
alter table public.legal_documents enable row level security;

create policy "owner manages payment adjustments" on public.payment_adjustments for all to authenticated using (exists(select 1 from public.pools p where p.id=pool_id and p.owner_id=auth.uid())) with check (exists(select 1 from public.pools p where p.id=pool_id and p.owner_id=auth.uid()));
create policy "owner manages prize events" on public.prize_events for all to authenticated using (exists(select 1 from public.pools p where p.id=pool_id and p.owner_id=auth.uid())) with check (exists(select 1 from public.pools p where p.id=pool_id and p.owner_id=auth.uid()));
create policy "owner manages prize allocations" on public.prize_allocations for all to authenticated using (exists(select 1 from public.pools p where p.id=pool_id and p.owner_id=auth.uid())) with check (exists(select 1 from public.pools p where p.id=pool_id and p.owner_id=auth.uid()));
create policy "owner reads own errors" on public.app_error_logs for select to authenticated using (pool_id is null or exists(select 1 from public.pools p where p.id=pool_id and p.owner_id=auth.uid()));
create policy "owner manages legal documents" on public.legal_documents for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());

grant select,insert,update,delete on public.payment_adjustments,public.prize_events,public.prize_allocations,public.legal_documents to authenticated;
grant select,update on public.app_error_logs to authenticated;
grant all on public.payment_adjustments,public.prize_events,public.prize_allocations,public.app_error_logs,public.legal_documents to service_role;
