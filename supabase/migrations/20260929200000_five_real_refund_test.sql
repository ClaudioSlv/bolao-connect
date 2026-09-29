-- Exceção restrita ao bolão isolado de validação de R$ 5.
create or replace function public.guard_partial_payment_choice()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_status public.payment_status; v_test boolean; v_slug text;
begin
  select p.payment_status,p.is_test,pool.public_slug into v_status,v_test,v_slug
  from public.participants p join public.pools pool on pool.id=p.pool_id
  where p.id=new.participant_id for update of p;
  if v_status='confirmed' and not (v_test and v_slug='teste-estorno-5-reais-20260929' and new.choice='refund') then
    raise exception 'A cota já está quitada. Estorno e crédito indisponíveis.';
  end if;
  return new;
end; $$;

create or replace function public.prepare_efi_partial_refund()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_count integer; v_total bigint; v_eligible boolean; v_test boolean;
begin
  if new.choice <> 'refund' then return new; end if;
  select p.is_test and pool.public_slug='teste-estorno-5-reais-20260929'
    into v_test from public.participants p join public.pools pool on pool.id=p.pool_id
    where p.id=new.participant_id;
  select count(*),coalesce(sum(amount_cents+coalesce(credit_used_cents,0)),0),
    coalesce(bool_and(provider='efi' and payment_method='pix'
      and provider_transaction_nsu ~ '^E[A-Za-z0-9]{31}$'
      and provider_reference is not null and amount_cents>0
      and coalesce(credit_used_cents,0)=0
      and (coalesce(is_test,false)=false or v_test)),false)
  into v_count,v_total,v_eligible from public.payments
  where participant_id=new.participant_id and status in ('partial','confirmed');
  if v_count=0 or v_total<>new.paid_cents or not v_eligible then return new; end if;
  insert into public.efi_refund_items(payment_id,participant_id,e2e_id,txid,refund_id,original_cents,refund_cents)
  select id,new.participant_id,provider_transaction_nsu,provider_reference,
    replace(id::text,'-',''),amount_cents,
    (new.amount_cents*running_cents/new.paid_cents)
      -(new.amount_cents*(running_cents-amount_cents)/new.paid_cents)
  from (
    select id,amount_cents,provider_transaction_nsu,provider_reference,
      sum(amount_cents) over(order by confirmed_at,id) as running_cents
    from public.payments where participant_id=new.participant_id
      and status in ('partial','confirmed')
  ) installments
  where (new.amount_cents*running_cents/new.paid_cents)
      -(new.amount_cents*(running_cents-amount_cents)/new.paid_cents)>0;
  update public.partial_payment_resolution_choices set status='processing',updated_at=now()
    where participant_id=new.participant_id;
  return new;
end; $$;
