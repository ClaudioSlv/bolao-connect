create table if not exists public.participant_payment_plans (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique references public.participants(id) on delete cascade,
  pool_id uuid not null references public.pools(id) on delete cascade,
  installment_count integer not null check (installment_count between 2 and 8),
  total_amount_cents bigint not null check (total_amount_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists participant_payment_plans_pool_idx
  on public.participant_payment_plans(pool_id, created_at desc);

alter table public.participant_payment_plans enable row level security;
revoke all on public.participant_payment_plans from anon, authenticated;
grant all on public.participant_payment_plans to service_role;

drop policy if exists "owner reads participant payment plans" on public.participant_payment_plans;
create policy "owner reads participant payment plans"
on public.participant_payment_plans for select to authenticated
using (exists(
  select 1 from public.pools b
  where b.id=participant_payment_plans.pool_id and b.owner_id=auth.uid()
));

create or replace function public.settle_participation_credit_amount(
  p_participant_id uuid,
  p_target_cents bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant public.participants%rowtype;
  v_pool public.pools%rowtype;
  v_account public.participant_credit_accounts%rowtype;
  v_total bigint;
  v_paid_before bigint;
  v_target bigint;
  v_paid_after bigint;
  v_payment_id uuid;
  v_reference text;
  v_fully_paid boolean;
begin
  select * into v_participant from public.participants where id=p_participant_id for update;
  if not found or v_participant.status <> 'confirmed' then
    raise exception 'Participação indisponível para pagamento.';
  end if;
  if coalesce(v_participant.is_test,false) then
    raise exception 'Crédito real não pode ser usado em participante de teste.';
  end if;
  if p_target_cents is null or p_target_cents <= 0 then
    raise exception 'Valor inválido para pagamento.';
  end if;

  select * into v_pool from public.pools where id=v_participant.pool_id;
  if not found then raise exception 'Bolão não encontrado.'; end if;
  v_total := v_participant.shares::bigint * v_pool.share_price_cents;

  select coalesce(sum(amount_cents + credit_used_cents),0)::bigint into v_paid_before
  from public.payments
  where participant_id=v_participant.id and status in ('partial','confirmed') and coalesce(is_test,false)=false;

  if v_paid_before >= v_total or v_participant.payment_status='confirmed' then
    update public.participants set payment_status='confirmed' where id=v_participant.id;
    return jsonb_build_object('paid',true,'already_paid',true,'remaining_cents',0);
  end if;

  v_target := least(p_target_cents, v_total-v_paid_before);
  select * into v_account from public.participant_credit_accounts
  where owner_id=v_pool.owner_id
    and phone=regexp_replace(coalesce(v_participant.phone,''),'\D','','g')
  for update;
  if not found or v_account.balance_cents < v_target then
    raise exception 'O crédito disponível não cobre o valor selecionado.';
  end if;

  v_reference := 'credit-' || v_participant.id::text || '-' || gen_random_uuid()::text;
  insert into public.payments(
    pool_id,participant_id,amount_cents,gross_amount_cents,credit_used_cents,
    status,payment_method,confirmed_at,provider,provider_reference,is_test
  ) values(
    v_participant.pool_id,v_participant.id,0,v_target,v_target,
    'confirmed','other',now(),'credit',v_reference,false
  ) returning id into v_payment_id;

  update public.participant_credit_accounts
  set balance_cents=balance_cents-v_target,updated_at=now()
  where id=v_account.id;

  insert into public.participant_credit_ledger(
    account_id,pool_id,participant_id,amount_cents,kind,description,created_by
  ) values(
    v_account.id,v_participant.pool_id,v_participant.id,-v_target,'use',
    'Crédito usado no pagamento da cota',v_pool.owner_id
  );

  insert into public.wallet_transactions(
    pool_id,payment_id,type,amount_cents,shares,description,created_by
  ) values(
    v_participant.pool_id,v_payment_id,'credit_used',v_target,0,
    'Crédito usado no pagamento da cota',v_pool.owner_id
  );

  v_paid_after := v_paid_before+v_target;
  v_fully_paid := v_paid_after >= v_total;
  update public.participants
  set payment_status=case when v_fully_paid then 'confirmed'::public.payment_status else 'partial'::public.payment_status end
  where id=v_participant.id;

  return jsonb_build_object(
    'paid',v_fully_paid,
    'partial',not v_fully_paid,
    'credit_used_cents',v_target,
    'paid_total_cents',v_paid_after,
    'remaining_cents',greatest(0,v_total-v_paid_after),
    'remaining_credit_cents',v_account.balance_cents-v_target,
    'payment_id',v_payment_id
  );
end;
$$;

revoke all on function public.settle_participation_credit_amount(uuid,bigint) from public,anon,authenticated;
grant execute on function public.settle_participation_credit_amount(uuid,bigint) to service_role;
