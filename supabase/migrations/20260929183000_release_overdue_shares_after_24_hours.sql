-- Uma vaga é liberada 24 horas após o prazo, independentemente da escolha financeira.
-- O registro de pagamentos continua intacto até a devolução ou crédito ser concluído.
create table if not exists public.waitlist_promotion_outbox (
  pool_id uuid not null references public.pools(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  primary key(pool_id,participant_id)
);
alter table public.waitlist_promotion_outbox enable row level security;
revoke all on public.waitlist_promotion_outbox from anon,authenticated;
grant all on public.waitlist_promotion_outbox to service_role;

create or replace function public.promote_next_waitlisted(p_pool_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_pool public.pools%rowtype; v_used integer; v_available integer; v_id uuid; v_offer_deadline timestamptz;
begin
 select * into v_pool from public.pools where id=p_pool_id for update;
 if not found or v_pool.status in ('drawn','archived') then return null; end if;
 if v_pool.waitlist_payment_deadline is not null and now()>v_pool.waitlist_payment_deadline then return null; end if;
 if v_pool.waitlist_payment_deadline is null and v_pool.payment_deadline is not null
     and now()>v_pool.payment_deadline+interval '48 hours' then return null; end if;
 select coalesce(sum(shares),0)::integer into v_used from public.participants
   where pool_id=p_pool_id and status='confirmed' and coalesce(is_test,false)=false;
 v_available:=greatest(0,v_pool.total_shares-v_used);
 if v_available<=0 then return null; end if;
 select id into v_id from public.participants
   where pool_id=p_pool_id and status='waitlisted' and coalesce(is_test,false)=false and shares<=v_available
   order by waitlist_position asc nulls last,created_at asc limit 1 for update skip locked;
 if v_id is null then return null; end if;
 v_offer_deadline:=case when v_pool.payment_deadline is not null and now()>v_pool.payment_deadline
   then coalesce(v_pool.waitlist_payment_deadline,now()+interval '24 hours') else null end;
 update public.participants set status='confirmed',waitlist_position=null,payment_status='pending',
   payment_deadline_override=v_offer_deadline where id=v_id;
 insert into public.waitlist_promotion_outbox(pool_id,participant_id) values(p_pool_id,v_id)
   on conflict(pool_id,participant_id) do update set created_at=now(),dispatched_at=null;
 return v_id;
end; $$;

create or replace function public.process_payment_deadlines(p_pool_id uuid,p_now timestamptz default now())
returns table(expired_ids uuid[],promoted_ids uuid[]) language plpgsql security definer set search_path=public as $$
declare v_pool public.pools%rowtype; v_expired uuid[]:='{}'; v_promoted uuid[]:='{}'; v_id uuid;
begin
 select * into v_pool from public.pools where id=p_pool_id for update;
 if not found then return query select v_expired,v_promoted; return; end if;
 if v_pool.payment_deadline is not null and p_now>v_pool.payment_deadline+interval '24 hours' then
  with changed as (
   update public.participants p set status='expired',waitlist_position=null
   where p.pool_id=p_pool_id and p.status='confirmed' and p.payment_status<>'confirmed'
     and coalesce(p.is_test,false)=false and p.payment_deadline_override is null
     and not exists (select 1 from public.payment_checkout_sessions c where c.participant_id=p.id
       and (c.status in ('processing','review_required') or
         (c.status in ('creating','pending') and c.qr_code_expires_at>p_now-interval '1 hour')))
   returning p.id
  ) select coalesce(array_agg(id),'{}'::uuid[]) into v_expired from changed;
 end if;
 if p_now>v_pool.payment_deadline+interval '24 hours' then
  with changed as (
   update public.participants p set status='expired',waitlist_position=null
   where p.pool_id=p_pool_id and p.status='confirmed' and p.payment_status<>'confirmed'
     and coalesce(p.is_test,false)=false and p.payment_deadline_override is not null
     and p_now>p.payment_deadline_override+interval '24 hours'
     and not exists (select 1 from public.payment_checkout_sessions c where c.participant_id=p.id
       and (c.status in ('processing','review_required') or
         (c.status in ('creating','pending') and c.qr_code_expires_at>p_now-interval '1 hour')))
   returning p.id
  ) select v_expired||coalesce(array_agg(id),'{}'::uuid[]) into v_expired from changed;
 end if;
 if v_pool.payment_deadline is not null and p_now>v_pool.payment_deadline+interval '24 hours'
   and (v_pool.waitlist_payment_deadline is null or p_now<=v_pool.waitlist_payment_deadline) then
  loop v_id:=public.promote_next_waitlisted(p_pool_id); exit when v_id is null; v_promoted:=array_append(v_promoted,v_id); end loop;
 end if;
 return query select v_expired,v_promoted;
end; $$;

-- Supabase Cron processa a fila a cada cinco minutos, sem depender do cron diário da Vercel.
select cron.schedule('release-overdue-pool-shares','*/5 * * * *',
  $$select public.process_payment_deadlines(id,now()) from public.pools
    where payment_deadline is not null and payment_deadline<now()-interval '24 hours'
      and status not in ('drawn','archived')$$);
