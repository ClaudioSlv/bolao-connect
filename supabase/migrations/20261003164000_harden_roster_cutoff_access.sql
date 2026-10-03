create or replace function public.lock_participant_after_deadline() returns trigger language plpgsql security definer set search_path=public as $$
declare v_pool public.pools%rowtype; v_deadline timestamptz; v_final timestamptz; v_paid bigint;
begin
 select * into v_pool from public.pools where id=case when tg_op='INSERT' then new.pool_id else old.pool_id end for update;
 v_final:=greatest(v_pool.payment_deadline,v_pool.waitlist_payment_deadline);
 if tg_op<>'DELETE' and new.payment_deadline_override is not null and (v_final is null or new.payment_deadline_override>v_final) then raise exception 'O prazo individual não pode ultrapassar o encerramento final do bolão.'; end if;
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
       and provider_paid_at<=v_deadline and created_at>v_deadline and status='confirmed')
      and not (select coalesce(sum(coalesce(amount_cents,0)+coalesce(credit_used_cents,0)),0)>=old.shares*v_pool.share_price_cents from public.payments where participant_id=old.id and created_at<=v_deadline and status in ('partial','confirmed')) then
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

create or replace function public.promote_next_waitlisted(p_pool_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_pool public.pools%rowtype; v_used integer; v_available integer; v_id uuid; v_offer_deadline timestamptz;
begin
 select * into v_pool from public.pools where id=p_pool_id for update;
 if not found or v_pool.status in ('drawn','archived') then return null; end if;
 if auth.role() in ('anon','authenticated') and (auth.uid() is null or auth.uid()<>v_pool.owner_id) then raise exception 'Somente o organizador pode promover a lista de espera.'; end if;
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

revoke all on function public.process_payment_deadlines(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.process_payment_deadlines(uuid,timestamptz) to service_role;
revoke all on function public.promote_next_waitlisted(uuid) from public,anon;
grant execute on function public.promote_next_waitlisted(uuid) to authenticated,service_role;
