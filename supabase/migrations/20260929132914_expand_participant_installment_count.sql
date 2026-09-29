alter table public.participant_payment_plans
  drop constraint if exists participant_payment_plans_installment_count_check;

alter table public.participant_payment_plans
  add constraint participant_payment_plans_installment_count_check
  check (installment_count >= 2);
