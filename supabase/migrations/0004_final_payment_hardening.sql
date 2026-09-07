-- Final payment safety hardening.
-- Prevent two concurrent confirmations from creating duplicate confirmed payments
-- for the same participant. Safe to run more than once.

create unique index if not exists payments_one_confirmed_per_participant_idx
  on public.payments(participant_id)
  where status = 'confirmed';

create index if not exists payment_submissions_pool_status_idx
  on public.payment_submissions(pool_id, status, created_at desc);

create index if not exists payments_pool_status_idx
  on public.payments(pool_id, status, created_at desc);
