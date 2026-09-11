alter table public.payments add column if not exists credit_used_cents bigint not null default 0 check(credit_used_cents>=0);
alter table public.payments add column if not exists gross_amount_cents bigint check(gross_amount_cents>=0);
alter table public.participant_credit_ledger drop constraint if exists participant_credit_ledger_kind_check;
alter table public.participant_credit_ledger add constraint participant_credit_ledger_kind_check check(kind in('credit','prize','manual','adjustment','use'));
alter table public.wallet_transactions drop constraint if exists wallet_transactions_type_check;
-- Tipos antigos continuam válidos; credit_used registra abatimento sem fingir que entrou dinheiro.
create index if not exists participant_credit_ledger_pool_idx on public.participant_credit_ledger(pool_id,created_at desc);
