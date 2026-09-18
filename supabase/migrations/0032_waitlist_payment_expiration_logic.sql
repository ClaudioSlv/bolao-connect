-- Processa reservas vencidas e promove a fila em ordem.
create or replace function public.promote_next_waitlisted(p_pool_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_total integer; v_used integer; v_available integer; v_id uuid; v_normal_deadline timestamptz; v_waitlist_deadline timestamptz;
begin
 select total_shares,payment_deadline,waitlist_payment_deadline into v_total,v_normal_deadline,v_waitlist_deadline from public.pools where id=p_pool_id for update;
 if v_total is null then return null; end if;
 select coalesce(sum(shares),0)::integer into v_used from public.participants where pool_id=p_pool_id and status='confirmed' and coalesce(is_test,false)=false;
 v_available:=greatest(0,v_total-v_used); if v_available<=0 then return null; end if;
 select id into v_id from public.participants where pool_id=p_pool_id and status='waitlisted' and coalesce(is_test,false)=false and shares<=v_available order by waitlist_position asc nulls last,created_at asc limit 1 for update skip locked;
 if v_id is not null then update public.participants p set status='confirmed',waitlist_position=null,payment_status='pending',payment_deadline_override=case when v_normal_deadline is not null and now()>v_normal_deadline then v_waitlist_deadline else null end where p.id=v_id; end if;
 return v_id;
end; $$;

create or replace function public.process_payment_deadlines(p_pool_id uuid,p_now timestamptz default now())
returns table(expired_ids uuid[],promoted_ids uuid[]) language plpgsql security definer set search_path=public as $$
declare v_pool public.pools%rowtype; v_expired uuid[]:='{}'; v_promoted uuid[]:='{}'; v_id uuid;
begin
 select * into v_pool from public.pools where id=p_pool_id for update;
 if not found then return query select v_expired,v_promoted; return; end if;
 if v_pool.payment_deadline is not null and p_now>v_pool.payment_deadline then
  with changed as (update public.participants set status='expired',waitlist_position=null where pool_id=p_pool_id and status='confirmed' and payment_status<>'confirmed' and coalesce(is_test,false)=false and payment_deadline_override is null returning id)
  select coalesce(array_agg(id),'{}'::uuid[]) into v_expired from changed;
 end if;
 if v_pool.waitlist_payment_deadline is not null and p_now>v_pool.waitlist_payment_deadline then
  with changed as (update public.participants set status='expired',waitlist_position=null where pool_id=p_pool_id and status='confirmed' and payment_status<>'confirmed' and coalesce(is_test,false)=false and payment_deadline_override is not null and p_now>payment_deadline_override returning id)
  select v_expired||coalesce(array_agg(id),'{}'::uuid[]) into v_expired from changed;
 end if;
 if v_pool.waitlist_payment_deadline is not null and p_now<=v_pool.waitlist_payment_deadline then
  loop v_id:=public.promote_next_waitlisted(p_pool_id); exit when v_id is null; v_promoted:=array_append(v_promoted,v_id); end loop;
 end if;
 return query select v_expired,v_promoted;
end; $$;
