-- Immutable roster; names only are exposed by the authenticated server route.
alter table public.payments add column if not exists provider_paid_at timestamptz;
create table public.pool_closed_rosters (
 pool_id uuid primary key references public.pools(id),
 title text not null, lottery text not null, contest_number integer,
 payment_deadline timestamptz not null, closed_at timestamptz not null default now()
);
create table public.pool_closed_roster_entries (
 pool_id uuid not null references public.pool_closed_rosters(pool_id),
 participant_id uuid not null, name text not null, shares integer not null,
 recorded_at timestamptz not null default now(), late_bank_confirmation boolean not null default false,
 primary key(pool_id,participant_id)
);
alter table public.pool_closed_rosters enable row level security;
alter table public.pool_closed_roster_entries enable row level security;
revoke all on public.pool_closed_rosters,public.pool_closed_roster_entries from anon,authenticated;
grant select,insert on public.pool_closed_rosters,public.pool_closed_roster_entries to service_role;

create function public.reject_closed_roster_change() returns trigger language plpgsql set search_path=public as $$
begin raise exception 'A lista de participantes confirmados é permanente e não pode ser alterada.'; end $$;
create trigger immutable_roster before update or delete on public.pool_closed_rosters for each row execute function public.reject_closed_roster_change();
create trigger immutable_roster_entries before update or delete on public.pool_closed_roster_entries for each row execute function public.reject_closed_roster_change();

create function public.close_pool_roster(p_pool_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_pool public.pools%rowtype; v_deadline timestamptz;
begin
 select * into v_pool from public.pools where id=p_pool_id for update;
 if not found then return; end if;
 v_deadline:=greatest(v_pool.payment_deadline,v_pool.waitlist_payment_deadline);
 if v_deadline is null or now()<=v_deadline then return; end if;
 insert into public.pool_closed_rosters(pool_id,title,lottery,contest_number,payment_deadline)
 values(v_pool.id,v_pool.title,v_pool.lottery,v_pool.contest_number,v_deadline) on conflict do nothing;
 insert into public.pool_closed_roster_entries(pool_id,participant_id,name,shares)
 select p_pool_id,p.id,p.name,p.shares from public.participants p
 where p.pool_id=p_pool_id and p.status='confirmed' and p.payment_status='confirmed' and not p.is_test
 on conflict do nothing;
end $$;
revoke all on function public.close_pool_roster(uuid) from public,anon,authenticated;
grant execute on function public.close_pool_roster(uuid) to service_role;

create function public.lock_pool_after_deadline() returns trigger language plpgsql set search_path=public as $$
begin
 if old.payment_deadline is not null and now()>old.payment_deadline then
  if tg_op='DELETE' then raise exception 'O bolão encerrado e sua lista de participantes não podem ser excluídos.'; end if;
  if (new.owner_id,new.title,new.lottery,new.contest_number,new.payment_deadline,new.waitlist_payment_deadline,new.share_price_cents,new.total_shares,new.payment_opens_at)
   is distinct from (old.owner_id,old.title,old.lottery,old.contest_number,old.payment_deadline,old.waitlist_payment_deadline,old.share_price_cents,old.total_shares,old.payment_opens_at)
  then raise exception 'Prazo encerrado: não é possível alterar prazos, cotas ou identificação deste bolão.'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger lock_pool_membership before update or delete on public.pools for each row execute function public.lock_pool_after_deadline();

create function public.lock_payment_after_deadline() returns trigger language plpgsql security definer set search_path=public as $$
declare v_p public.participants%rowtype; v_pool public.pools%rowtype; v_deadline timestamptz; v_id uuid;
begin
 v_id:=case when tg_op='INSERT' then new.participant_id else old.participant_id end;
 select * into v_p from public.participants where id=v_id;
 select * into v_pool from public.pools where id=v_p.pool_id for update;
 v_deadline:=coalesce(v_p.payment_deadline_override,v_pool.payment_deadline);
 if tg_op<>'DELETE' and (new.pool_id<>v_p.pool_id or (tg_op='UPDATE' and new.participant_id<>old.participant_id)) then raise exception 'Não é possível transferir pagamentos entre participantes ou bolões.'; end if;
 if tg_op<>'DELETE' and new.provider_paid_at is not null and coalesce(auth.role(),'')<>'service_role' then
  raise exception 'O horário do Pix só pode ser registrado pela conciliação bancária.';
 end if;
 if v_deadline is not null and now()>v_deadline and not coalesce(v_p.is_test,false) then
  if tg_op='INSERT' and auth.role()='service_role' and new.provider='efi'
   and new.provider_paid_at is not null and new.provider_paid_at<=v_deadline
   and new.provider_paid_at<=now() and new.provider_transaction_nsu is not null
   and exists(select 1 from public.payment_checkout_sessions c where c.participant_id=v_p.id
      and c.pool_id=v_p.pool_id and c.provider='efi' and c.provider_order_id=new.provider_reference
      and c.created_at<=new.provider_paid_at and c.transaction_nsu=new.provider_transaction_nsu
      and c.expected_amount_cents=new.amount_cents and c.status='processing') then return new; end if;
  -- Refund accounting remains possible through the server, without changing participation.
  if tg_op='UPDATE' and auth.role()='service_role' and new.status='cancelled'
   and (to_jsonb(new)-'status')=(to_jsonb(old)-'status') then return new; end if;
  raise exception 'Prazo encerrado: não é possível confirmar ou alterar pagamentos manualmente.';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger lock_payment_deadline before insert or update or delete on public.payments for each row execute function public.lock_payment_after_deadline();

create function public.lock_participant_after_deadline() returns trigger language plpgsql security definer set search_path=public as $$
declare v_pool public.pools%rowtype; v_deadline timestamptz; v_final timestamptz; v_paid bigint;
begin
 select * into v_pool from public.pools where id=case when tg_op='INSERT' then new.pool_id else old.pool_id end for update;
 v_final:=greatest(v_pool.payment_deadline,v_pool.waitlist_payment_deadline);
 if tg_op='INSERT' then
  if now()>v_final and not new.is_test then raise exception 'Prazo encerrado: não é possível incluir participantes.'; end if;
  if new.payment_status='confirmed' and now()>v_pool.payment_deadline and not new.is_test then raise exception 'Prazo encerrado: não é possível incluir participante pago.'; end if;
  return new;
 end if;
 if old.is_test then if tg_op='DELETE' then return old; end if; return new; end if;
 v_deadline:=coalesce(old.payment_deadline_override,case when old.status='waitlisted' then v_final else v_pool.payment_deadline end);
 if v_deadline is not null and now()>v_deadline then
  if tg_op='DELETE' then raise exception 'Prazo encerrado: o cadastro deve ser preservado.'; end if;
  if (to_jsonb(new)-array['status','payment_status','waitlist_position']) is distinct from
     (to_jsonb(old)-array['status','payment_status','waitlist_position']) then
   raise exception 'Prazo encerrado: o cartão do participante está bloqueado.';
  end if;
  if new.payment_status is distinct from old.payment_status or new.status is distinct from old.status or new.waitlist_position is distinct from old.waitlist_position then
   -- Only the server can reconcile a verified, on-time Pix. No organizer override.
   if auth.role()='service_role' and new.payment_status='confirmed' and new.status='confirmed' then
    select coalesce(sum(coalesce(amount_cents,0)+coalesce(credit_used_cents,0)),0) into v_paid from public.payments
      where participant_id=old.id and status in ('partial','confirmed');
    if v_paid<old.shares*v_pool.share_price_cents or not exists(
      select 1 from public.payments where participant_id=old.id and provider='efi'
       and provider_paid_at<=v_deadline and created_at>v_deadline and status='confirmed') then
     raise exception 'Confirmação após o prazo exige Pix bancário realizado dentro do prazo e cota quitada.';
    end if;
   elsif auth.role()='service_role' and old.payment_status<>'confirmed' and new.payment_status='partial'
     and new.status=old.status and exists(select 1 from public.payments where participant_id=old.id
       and provider='efi' and provider_paid_at<=v_deadline and created_at>v_deadline and status='confirmed') then null;
   elsif coalesce(auth.role(),'') in ('service_role','') and old.payment_status<>'confirmed' and new.payment_status<>'confirmed' 
      and new.status in ('expired','cancelled') then null;
   else raise exception 'Prazo encerrado: não é possível alterar a participação ou marcar como pago.'; end if;
  end if;
 end if;
 if new.payment_deadline_override is distinct from old.payment_deadline_override and now()>v_pool.payment_deadline then
  if not(old.status='waitlisted' and new.status='confirmed' and now()<=v_final
    and new.payment_deadline_override=v_pool.waitlist_payment_deadline and new.payment_status<>'confirmed') then
   raise exception 'Não é possível estender o prazo de pagamento após o encerramento.';
  end if;
 end if;
 return new;
end $$;
create trigger lock_participant_deadline before insert or update or delete on public.participants for each row execute function public.lock_participant_after_deadline();

create function public.append_verified_roster_confirmation() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.payment_status='confirmed' and new.status='confirmed' and not new.is_test
  and old.payment_status is distinct from new.payment_status
  and exists(select 1 from public.pool_closed_rosters where pool_id=new.pool_id) then
  insert into public.pool_closed_roster_entries(pool_id,participant_id,name,shares,late_bank_confirmation)
   values(new.pool_id,new.id,new.name,new.shares,true) on conflict do nothing;
 end if;
 return new;
end $$;
create trigger record_verified_roster_confirmation after update on public.participants for each row execute function public.append_verified_roster_confirmation();

-- Functions used only by triggers must not be exposed as RPCs.
revoke all on function public.reject_closed_roster_change(),public.lock_pool_after_deadline(),public.lock_payment_after_deadline(),public.lock_participant_after_deadline(),public.append_verified_roster_confirmation() from public,anon,authenticated;

-- Minute resolution for automatic closure; row locks serialize bank reconciliation.
select cron.schedule('close-paid-pool-rosters','* * * * *',
 $$select public.close_pool_roster(id) from public.pools where payment_deadline is not null and now()>greatest(payment_deadline,waitlist_payment_deadline) and status<>'archived' and not exists(select 1 from public.pool_closed_rosters r where r.pool_id=pools.id)$$);

-- A waitlist without an explicit later deadline cannot silently reopen payments.
create or replace function public.promote_next_waitlisted(p_pool_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_pool public.pools%rowtype; v_used integer; v_available integer; v_id uuid; v_offer_deadline timestamptz;
begin
 select * into v_pool from public.pools where id=p_pool_id for update;
 if not found or v_pool.status in ('drawn','archived') then return null; end if;
 if now()>greatest(v_pool.payment_deadline,v_pool.waitlist_payment_deadline) then return null; end if;
 select coalesce(sum(shares),0)::integer into v_used from public.participants
   where pool_id=p_pool_id and status='confirmed' and coalesce(is_test,false)=false;
 v_available:=greatest(0,v_pool.total_shares-v_used);
 if v_available<=0 then return null; end if;
 select id into v_id from public.participants
   where pool_id=p_pool_id and status='waitlisted' and coalesce(is_test,false)=false and shares<=v_available
   order by waitlist_position asc nulls last,created_at asc limit 1 for update skip locked;
 if v_id is null then return null; end if;
 v_offer_deadline:=case when now()>v_pool.payment_deadline then v_pool.waitlist_payment_deadline else null end;
 update public.participants set status='confirmed',waitlist_position=null,payment_status='pending',
   payment_deadline_override=v_offer_deadline where id=v_id;
 insert into public.waitlist_promotion_outbox(pool_id,participant_id) values(p_pool_id,v_id)
   on conflict(pool_id,participant_id) do update set created_at=now(),dispatched_at=null;
 return v_id;
end; $$;
