-- Crédito persistente por organizador + telefone, reutilizável entre bolões.
create table if not exists public.participant_credit_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  phone text not null,
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, phone)
);

create table if not exists public.participant_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.participant_credit_accounts(id) on delete cascade,
  pool_id uuid references public.pools(id) on delete set null,
  participant_id uuid references public.participants(id) on delete set null,
  amount_cents bigint not null,
  kind text not null check (kind in ('credit','adjustment','use')),
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists participant_credit_accounts_owner_phone_idx on public.participant_credit_accounts(owner_id,phone);
create index if not exists participant_credit_ledger_account_idx on public.participant_credit_ledger(account_id,created_at desc);

alter table public.participant_credit_accounts enable row level security;
alter table public.participant_credit_ledger enable row level security;

create policy "owner manages credit accounts" on public.participant_credit_accounts
for all using (owner_id=auth.uid()) with check (owner_id=auth.uid());

create policy "owner reads credit ledger" on public.participant_credit_ledger
for select using (exists(select 1 from public.participant_credit_accounts a where a.id=account_id and a.owner_id=auth.uid()));

create policy "owner inserts credit ledger" on public.participant_credit_ledger
for insert with check (exists(select 1 from public.participant_credit_accounts a where a.id=account_id and a.owner_id=auth.uid()));
