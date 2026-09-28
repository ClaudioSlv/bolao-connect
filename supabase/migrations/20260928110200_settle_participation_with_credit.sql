create or replace function public.settle_participation_with_credit(p_participant_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_participant public.participants%rowtype;
  v_pool public.pools%rowtype;
  v_account public.participant_credit_accounts%rowtype;
  v_gross bigint;
  v_payment_id uuid;
begin
  select * into v_participant from public.participants where id=p_participant_id for update;
  if not found or v_participant.status <> 'confirmed' then raise exception 'Participação indisponível para pagamento.'; end if;
  if v_participant.payment_status='confirmed' then return jsonb_build_object('paid',true,'already_paid',true); end if;
  if coalesce(v_participant.is_test,false) then raise exception 'Crédito real não pode ser usado em participante de teste.'; end if;
  select * into v_pool from public.pools where id=v_participant.pool_id;
  if not found then raise exception 'Bolão não encontrado.'; end if;
  v_gross:=v_participant.shares::bigint*v_pool.share_price_cents;
  select * into v_account from public.participant_credit_accounts
    where owner_id=v_pool.owner_id and phone=regexp_replace(coalesce(v_participant.phone,''),'\D','','g') for update;
  if not found or v_account.balance_cents<v_gross then raise exception 'O crédito disponível não cobre toda a cota.'; end if;
  insert into public.payments(pool_id,participant_id,amount_cents,gross_amount_cents,credit_used_cents,status,payment_method,confirmed_at,provider,provider_reference,is_test)
    values(v_participant.pool_id,v_participant.id,0,v_gross,v_gross,'confirmed','other',now(),'credit','credit-'||v_participant.id::text,false)
    on conflict(provider,provider_reference) where provider is not null and provider_reference is not null do nothing returning id into v_payment_id;
  if v_payment_id is null then
    select id into v_payment_id from public.payments where provider='credit' and provider_reference='credit-'||v_participant.id::text;
  else
    update public.participant_credit_accounts set balance_cents=balance_cents-v_gross,updated_at=now() where id=v_account.id;
    insert into public.participant_credit_ledger(account_id,pool_id,participant_id,amount_cents,kind,description,created_by)
      values(v_account.id,v_participant.pool_id,v_participant.id,-v_gross,'use','Cota quitada integralmente com crédito',v_pool.owner_id);
    insert into public.wallet_transactions(pool_id,payment_id,type,amount_cents,shares,description,created_by)
      values(v_participant.pool_id,v_payment_id,'credit_used',v_gross,v_participant.shares,'Cota quitada integralmente com crédito',v_pool.owner_id);
  end if;
  update public.participants set payment_status='confirmed' where id=v_participant.id;
  return jsonb_build_object('paid',true,'credit_used_cents',v_gross,'remaining_credit_cents',v_account.balance_cents-v_gross,'payment_id',v_payment_id);
end; $$;
revoke all on function public.settle_participation_with_credit(uuid) from public,anon,authenticated;
grant execute on function public.settle_participation_with_credit(uuid) to service_role;
