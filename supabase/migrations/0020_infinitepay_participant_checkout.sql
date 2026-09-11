-- Cobranças individuais InfinitePay vinculadas ao participante.
create table if not exists public.payment_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  provider text not null default 'infinitepay' check (provider in ('infinitepay')),
  order_nsu text not null unique,
  checkout_url text,
  gross_amount_cents bigint not null check (gross_amount_cents >= 0),
  credit_used_cents bigint not null default 0 check (credit_used_cents >= 0),
  expected_amount_cents bigint not null check (expected_amount_cents > 0),
  paid_amount_cents bigint,
  transaction_nsu text unique,
  invoice_slug text,
  status text not null default 'creating' check (status in ('creating','pending','processing','paid','failed','review_required','cancelled')),
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_checkout_one_open_per_participant_idx
  on public.payment_checkout_sessions(participant_id)
  where status in ('creating','pending','processing','review_required');
create index if not exists payment_checkout_pool_status_idx
  on public.payment_checkout_sessions(pool_id,status,created_at desc);

alter table public.payment_checkout_sessions enable row level security;
revoke all on public.payment_checkout_sessions from anon, authenticated;
grant all on public.payment_checkout_sessions to service_role;

drop policy if exists "owner reads checkout sessions" on public.payment_checkout_sessions;
create policy "owner reads checkout sessions" on public.payment_checkout_sessions
for select to authenticated using (
  exists(select 1 from public.pools b where b.id=payment_checkout_sessions.pool_id and b.owner_id=auth.uid())
);

alter table public.payments add column if not exists provider text;
alter table public.payments add column if not exists provider_reference text;
alter table public.payments add column if not exists provider_transaction_nsu text;
create unique index if not exists payments_provider_reference_uidx
  on public.payments(provider,provider_reference)
  where provider is not null and provider_reference is not null;
