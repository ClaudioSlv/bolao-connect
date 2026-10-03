-- Preserve the reconciliation label even if the bank confirms before the first
-- minute-based closure task runs. Never replace existing roster entries.
create or replace function public.close_pool_roster(p_pool_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_pool public.pools%rowtype; v_deadline timestamptz;
begin
 select * into v_pool from public.pools where id=p_pool_id for update;
 if not found then return; end if;
 v_deadline:=greatest(v_pool.payment_deadline,v_pool.waitlist_payment_deadline);
 if v_deadline is null or now()<=v_deadline then return; end if;
 insert into public.pool_closed_rosters(pool_id,title,lottery,contest_number,payment_deadline)
 values(v_pool.id,v_pool.title,v_pool.lottery,v_pool.contest_number,v_deadline) on conflict do nothing;
 insert into public.pool_closed_roster_entries(pool_id,participant_id,name,shares,recorded_at,late_bank_confirmation)
 select p_pool_id,p.id,p.name,p.shares,coalesce(late.bank_confirmed_at,now()),late.bank_confirmed_at is not null
 from public.participants p left join lateral (
  select max(pay.created_at) as bank_confirmed_at from public.payments pay
  where pay.participant_id=p.id and pay.provider='efi' and pay.status='confirmed'
   and pay.provider_paid_at<=coalesce(p.payment_deadline_override,v_pool.payment_deadline)
   and pay.created_at>coalesce(p.payment_deadline_override,v_pool.payment_deadline)
 ) late on true
 where p.pool_id=p_pool_id and p.status='confirmed' and p.payment_status='confirmed' and not p.is_test
 on conflict do nothing;
end $$;
revoke all on function public.close_pool_roster(uuid) from public,anon,authenticated;
grant execute on function public.close_pool_roster(uuid) to service_role;
