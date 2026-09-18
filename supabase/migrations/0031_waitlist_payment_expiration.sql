-- Expiração automática de reservas e promoção segura da lista de espera.
alter table public.participants
  add column if not exists payment_deadline_override timestamptz;

alter table public.pools
  add column if not exists waitlist_payment_deadline timestamptz;

alter table public.participants
  drop constraint if exists participants_status_waitlist_check;

alter table public.participants
  add constraint participants_status_waitlist_check
  check (status in ('confirmed','waitlisted','cancelled','expired'));

create index if not exists participants_payment_deadline_override_idx
  on public.participants(pool_id,payment_deadline_override)
  where status='confirmed' and payment_status<>'confirmed';

create or replace function public.promote_next_waitlisted(p_pool_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_used integer;
  v_available integer;
  v_id uuid;
begin
  select total_shares into v_total from public.pools where id=p_pool_id for update;
  if v_total is null then return null; end if;

  select coalesce(sum(shares),0)::integer into v_used
  from public.participants
  where pool_id=p_pool_id and status='confirmed' and coalesce(is_test,false)=false;

  v_available := greatest(0,v_total-v_used);
  if v_available <= 0 then return null; end if;

  select id into v_id
  from public.participants
  where pool_id=p_pool_id
    and status='waitlisted'
    and coalesce(is_test,false)=false
    and shares <= v_available
  order by waitlist_position asc nulls last, created_at asc
  limit 1
  for update skip locked;

  if v_id is not null then
    update public.participants p
      set status='confirmed',
          waitlist_position=null,
          payment_status='pending',
          payment_deadline_override=(select waitlist_payment_deadline from public.pools where id=p_pool_id)
    where p.id=v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.process_payment_deadlines(p_pool_id uuid, p_now timestamptz default now())
returns table(expired_ids uuid[], promoted_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool public.pools%rowtype;
  v_expired uuid[] := '{}';
  v_promoted uuid[] := '{}';
  v_id uuid;
begin
  select * into v_pool from public.pools where id=p_pool_id for update;
  if not found then
    return query select v_expired,v_promoted;
    return;
  end if;

  -- Prazo normal: reserva não paga perde a vaga.
  if v_pool.payment_deadline is not null and p_now > v_pool.payment_deadline then
    with changed as (
      update public.participants
      set status='expired', waitlist_position=null
      where pool_id=p_pool_id
        and status='confirmed'
        and payment_status<>'confirmed'
        and coalesce(is_test,false)=false
        and payment_deadline_override is null
      returning id
    )
    select coalesce(array_agg(id),'{}'::uuid[]) into v_expired from changed;
  end if;

  -- Prazo especial do promovido: após esse limite ele também perde a vaga.
  if v_pool.waitlist_payment_deadline is not null and p_now > v_pool.waitlist_payment_deadline then
    with changed as (
      update public.participants
      set status='expired', waitlist_position=null
      where pool_id=p_pool_id
        and status='confirmed'
        and payment_status<>'confirmed'
        and coalesce(is_test,false)=false
        and payment_deadline_override is not null
        and p_now > payment_deadline_override
      returning id
    )
    select v_expired || coalesce(array_agg(id),'{}'::uuid[]) into v_expired from changed;
  end if;

  -- Só promove enquanto ainda existe prazo especial para o novo participante pagar.
  if v_pool.waitlist_payment_deadline is not null and p_now <= v_pool.waitlist_payment_deadline then
    loop
      v_id := public.promote_next_waitlisted(p_pool_id);
      exit when v_id is null;
      v_promoted := array_append(v_promoted,v_id);
    end loop;
  end if;

  return query select v_expired,v_promoted;
end;
$$;