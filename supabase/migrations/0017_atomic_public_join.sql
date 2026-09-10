-- Reserva pública atômica com preenchimento parcial das últimas cotas.
-- Limite: cada participante pode adquirir no máximo 2 cotas no mesmo cadastro/WhatsApp.
create or replace function public.join_pool_atomic(
  p_pool_id uuid,
  p_name text,
  p_phone text,
  p_shares integer,
  p_accept_waitlist boolean default false
)
returns table(participant_id uuid, access_token uuid, confirmed_shares integer, waitlisted_shares integer, waitlist_position bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool public.pools%rowtype;
  v_used integer;
  v_remaining integer;
  v_confirm integer;
  v_wait integer;
  v_waitlist bigint;
  v_participant public.participants%rowtype;
begin
  if p_shares < 1 or p_shares > 2 then raise exception 'Cada participante pode adquirir no máximo 2 cotas.'; end if;
  select * into v_pool from public.pools where id=p_pool_id for update;
  if not found then raise exception 'Bolão não encontrado.'; end if;
  if v_pool.status <> 'open' then raise exception 'Este bolão não está aberto para novas participações.'; end if;
  if v_pool.payment_deadline <= now() then raise exception 'O prazo para participar deste bolão terminou.'; end if;
  if exists(select 1 from public.participants where pool_id=p_pool_id and status<>'cancelled' and regexp_replace(coalesce(phone,''),'\D','','g')=regexp_replace(coalesce(p_phone,''),'\D','','g')) then
    raise exception 'Este WhatsApp já está cadastrado neste bolão. Cada participante pode ter no máximo 2 cotas no mesmo cadastro.';
  end if;
  select coalesce(sum(shares),0)::integer into v_used from public.participants where pool_id=p_pool_id and status='confirmed';
  v_remaining:=greatest(0,v_pool.total_shares-v_used);
  v_confirm:=least(p_shares,v_remaining);
  v_wait:=p_shares-v_confirm;
  if v_confirm=0 and not p_accept_waitlist then raise exception 'WAITLIST_CONFIRM_REQUIRED:%', p_shares; end if;
  if v_confirm>0 and v_wait>0 and not p_accept_waitlist then raise exception 'PARTIAL_WAITLIST_CONFIRM_REQUIRED:%:%', v_confirm, v_wait; end if;
  if v_confirm>0 then
    insert into public.participants(pool_id,name,phone,shares,status,payment_status,waitlist_position)
    values(p_pool_id,p_name,p_phone,v_confirm,'confirmed'::participant_status,'pending',null)
    returning * into v_participant;
  end if;
  if v_wait>0 and p_accept_waitlist then
    select coalesce(max(waitlist_position),0)+1 into v_waitlist from public.participants where pool_id=p_pool_id and status='waitlisted';
    if v_confirm=0 then
      insert into public.participants(pool_id,name,phone,shares,status,payment_status,waitlist_position)
      values(p_pool_id,p_name,p_phone,v_wait,'waitlisted'::participant_status,'pending',v_waitlist)
      returning * into v_participant;
    else
      insert into public.participants(pool_id,name,phone,shares,status,payment_status,waitlist_position,notes)
      values(p_pool_id,p_name,p_phone,v_wait,'waitlisted'::participant_status,'pending',v_waitlist,'Cota adicional na lista de espera. Participante já possui cota confirmada.');
    end if;
  end if;
  return query select v_participant.id,v_participant.access_token,v_confirm,(case when p_accept_waitlist then v_wait else 0 end),v_waitlist;
end;
$$;
revoke all on function public.join_pool_atomic(uuid,text,text,integer,boolean) from public, anon, authenticated;
grant execute on function public.join_pool_atomic(uuid,text,text,integer,boolean) to service_role;
