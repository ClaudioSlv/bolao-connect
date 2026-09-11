-- Participante de teste: cobrança real de R$ 1,00 sem ocupar cota do bolão.
alter table public.participants
  add column if not exists is_test boolean not null default false,
  add column if not exists test_amount_cents bigint;

alter table public.payments
  add column if not exists is_test boolean not null default false;

alter table public.payment_checkout_sessions
  add column if not exists is_test boolean not null default false;

do $$ begin
  alter table public.participants add constraint participants_test_amount_check
  check ((not is_test and test_amount_cents is null) or (is_test and test_amount_cents between 100 and 1000));
exception when duplicate_object then null; end $$;

alter table public.participants drop constraint if exists participants_shares_check;
alter table public.participants add constraint participants_shares_check
  check ((not is_test and shares > 0) or (is_test and shares = 0));

create index if not exists participants_pool_test_idx
  on public.participants(pool_id,is_test,created_at desc);
