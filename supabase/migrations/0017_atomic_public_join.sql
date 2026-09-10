-- Reserva pública atômica: serializa inscrições por bolão e impede ultrapassar a capacidade.
create or replace function public.join_pool_atomic(
  p_pool_id uuid,
  p_name text,
  p_phone text,
  p_shares integer
)
returns table(participant_id uuid, access_token uuid, participant_status text, waitlist_position bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool public.pools%rowtype;
  v_used integer;
  v_remaining integer;
  v_status text;
  v_waitlist bigint;
  v_participant public.participants%rowtype;
begin
  if p_shares < 1 or p_shares > 3 then raise exception 'Escolha entre 1 e 3 cotas.'; end if;
  select * into v_pool from public.pools where id=p_pool_id for update;
  if not found then raise exception 'Bolão não encontrado.'; end if;
  if v_pool.status <> 'open' then raise exception 'Este bolão não está aberto para novas participações.'; end if;
  if v_pool.payment_deadline <= now() then raise exception 'O prazo para participar deste bolão terminou.'; end if;
  if exists(select 1 from public.participants where pool_id=p_pool_id and status<>'cancelled' and regexp_replace(coalesce(phone,''),'\D','','g')=regexp_replace(coalesce(p_phone,''),'\D','','g')) then
    raise exception 'Este WhatsApp já está cadastrado neste bolão. Peça ao organizador o seu link individual.';
  end if;
  select coalesce(sum(shares),0)::integer into v_used from public.participants where pool_id=p_pool_id and status='confirmed';
  v_remaining:=greatest(0,v_pool.total_shares-v_used);
  if v_remaining < p_shares then
    v_status:='waitlisted';
    select coalesce(max(waitlist_position),0)+1 into v_waitlist from public.participants where pool_id=p_pool_id and status='waitlisted';
  else
    v_status:='confirmed'; v_waitlist:=null;
  end if;
  insert into public.participants(pool_id,name,phone,shares,status,payment_status,waitlist_position)
  values(p_pool_id,p_name,p_phone,p_shares,v_status::participant_status,'pending',v_waitlist)
  returning * into v_participant;
  return query select v_participant.id,v_participant.access_token,v_status,v_waitlist;
end;
$$;
revoke all on function public.join_pool_atomic(uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.join_pool_atomic(uuid,text,text,integer) to service_role;
