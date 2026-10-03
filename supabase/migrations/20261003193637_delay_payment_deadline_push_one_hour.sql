create or replace function public.queue_payment_deadline_pushes()
returns void language sql security invoker set search_path=public as $$
  insert into public.payment_deadline_push_outbox(participant_id,deadline,pool_id)
  select p.id,coalesce(p.payment_deadline_override,pool.payment_deadline),pool.id
  from public.participants p
  join public.pools pool on pool.id=p.pool_id
  cross join public.payment_deadline_push_config config
  where p.status in ('confirmed','expired') and p.payment_status<>'confirmed'
    and coalesce(p.is_test,false)=false
    and pool.status not in ('drawn','archived')
    and coalesce(p.payment_deadline_override,pool.payment_deadline) >= config.started_at
    and coalesce(p.payment_deadline_override,pool.payment_deadline) <= now() - interval '1 hour'
  on conflict do nothing;
$$;
revoke all on function public.queue_payment_deadline_pushes() from public,anon,authenticated;
grant execute on function public.queue_payment_deadline_pushes() to service_role;