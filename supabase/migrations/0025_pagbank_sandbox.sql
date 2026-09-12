-- Sessões isoladas para validar o fluxo Pix PagBank sem afetar a InfinitePay.
create table if not exists public.pagbank_sandbox_sessions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  reference_id text not null unique,
  provider_order_id text not null unique,
  qr_code_id text,
  qr_code_text text not null,
  qr_code_url text,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending','paid','expired','failed')),
  charge_id text unique,
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pagbank_sandbox_participant_idx
  on public.pagbank_sandbox_sessions(participant_id,status,created_at desc);

alter table public.pagbank_sandbox_sessions enable row level security;
revoke all on public.pagbank_sandbox_sessions from anon, authenticated;
grant all on public.pagbank_sandbox_sessions to service_role;

drop policy if exists "owner reads PagBank sandbox sessions" on public.pagbank_sandbox_sessions;
create policy "owner reads PagBank sandbox sessions"
on public.pagbank_sandbox_sessions for select to authenticated using (
  exists (
    select 1 from public.pools b
    where b.id=pagbank_sandbox_sessions.pool_id and b.owner_id=auth.uid()
  )
);

