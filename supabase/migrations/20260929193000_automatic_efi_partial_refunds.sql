-- Cada Pix original recebe uma única devolução com ID estável para retries seguros.
create table public.efi_refund_items (
  payment_id uuid primary key references public.payments(id),
  participant_id uuid not null references public.participants(id),
  e2e_id text not null,
  txid text not null,
  refund_id text not null unique,
  original_cents bigint not null check (original_cents > 0),
  refund_cents bigint not null check (refund_cents > 0 and refund_cents <= original_cents),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  provider_status text,
  attempted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index efi_refund_items_work_idx on public.efi_refund_items(status,attempted_at);
alter table public.efi_refund_items enable row level security;
revoke all on public.efi_refund_items from anon,authenticated;
grant all on public.efi_refund_items to service_role;

create or replace function public.prepare_efi_partial_refund()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count integer; v_total bigint; v_eligible boolean;
begin
  if new.choice <> 'refund' then return new; end if;
  select count(*),coalesce(sum(amount_cents+coalesce(credit_used_cents,0)),0),
    coalesce(bool_and(provider='efi' and payment_method='pix'
      and provider_transaction_nsu ~ '^E[A-Za-z0-9]{31}$'
      and provider_reference is not null and amount_cents>0
      and coalesce(credit_used_cents,0)=0 and coalesce(is_test,false)=false),false)
  into v_count,v_total,v_eligible from public.payments
  where participant_id=new.participant_id and status in ('partial','confirmed');
  if v_count=0 or v_total<>new.paid_cents or not v_eligible then
    return new; -- O caso não elegível permanece para tratamento financeiro separado.
  end if;

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
create trigger prepare_efi_partial_refund_after_choice
after insert on public.partial_payment_resolution_choices
for each row execute function public.prepare_efi_partial_refund();

-- Uma devolução já iniciada impede que a cota seja marcada manualmente como paga.
create or replace function public.close_partial_payment_choice_on_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_choice_status text;
begin
  if old.payment_status is distinct from 'confirmed' and new.payment_status = 'confirmed' then
    if exists(select 1 from public.efi_refund_items where participant_id=new.id) then
      raise exception 'Existe devolução Pix automática iniciada para esta cota.';
    end if;
    select status into v_choice_status from public.partial_payment_resolution_choices
      where participant_id = new.id for update;
    if v_choice_status in ('processing','completed') then
      raise exception 'Já existe estorno ou crédito em execução/concluído para esta cota.';
    end if;
    if v_choice_status in ('pending_review','failed') then
      update public.partial_payment_resolution_choices
      set status = 'cancelled_paid', updated_at = now()
      where participant_id = new.id;
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.prepare_efi_partial_refund() from public,anon,authenticated;
