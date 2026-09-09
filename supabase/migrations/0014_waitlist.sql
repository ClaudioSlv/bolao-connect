-- Lista de espera automática por bolão.
-- Execute esta migration no Supabase antes de liberar o link público.

alter table public.participants
  add column if not exists waitlist_position bigint;

-- confirmed = ocupa vaga; waitlisted = aguarda vaga; cancelled = saiu.
do $$ begin
  alter table public.participants add constraint participants_status_waitlist_check
    check (status in ('confirmed','waitlisted','cancelled'));
exception when duplicate_object then null; end $$;

create index if not exists participants_waitlist_idx
  on public.participants(pool_id, waitlist_position)
  where status = 'waitlisted';

create sequence if not exists public.participant_waitlist_position_seq;

create or replace function public.promote_next_waitlisted(p_pool_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_used integer;
  v_id uuid;
begin
  select total_shares into v_total from public.pools where id=p_pool_id for update;
  if v_total is null then return null; end if;

  select coalesce(sum(shares),0)::integer into v_used
  from public.participants
  where pool_id=p_pool_id and status='confirmed';

  if v_used >= v_total then return null; end if;

  select id into v_id
  from public.participants
  where pool_id=p_pool_id and status='waitlisted'
  order by waitlist_position asc nulls last, created_at asc
  limit 1
  for update skip locked;

  if v_id is not null then
    update public.participants
      set status='confirmed', waitlist_position=null, payment_status='pending'
    where id=v_id;
  end if;
  return v_id;
end;
$$;
