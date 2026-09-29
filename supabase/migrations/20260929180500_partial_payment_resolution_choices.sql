-- Registra a opção sem executar estorno ou crédito antes da conferência financeira.
create table if not exists public.partial_payment_resolution_choices (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  pool_id uuid not null references public.pools(id) on delete cascade,
  choice text not null check (choice in ('refund','credit')),
  paid_cents bigint not null check (paid_cents > 0),
  retention_cents bigint not null check (retention_cents >= 0),
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'pending_review' check (status in ('pending_review','processing','completed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists partial_payment_resolution_pool_status_idx
  on public.partial_payment_resolution_choices(pool_id,status,created_at);
alter table public.partial_payment_resolution_choices enable row level security;
revoke all on public.partial_payment_resolution_choices from anon, authenticated;
grant all on public.partial_payment_resolution_choices to service_role;
