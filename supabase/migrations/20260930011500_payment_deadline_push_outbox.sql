-- Um aviso por participante e prazo, gerado assim que o prazo passa.
create table public.payment_deadline_push_outbox (
  participant_id uuid not null references public.participants(id) on delete cascade,
  deadline timestamptz not null,
  pool_id uuid not null references public.pools(id) on delete cascade,
  dispatched_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (participant_id, deadline)
);
create index payment_deadline_push_pending_idx
  on public.payment_deadline_push_outbox(created_at) where dispatched_at is null;
alter table public.payment_deadline_push_outbox enable row level security;
revoke all on public.payment_deadline_push_outbox from anon,authenticated;
grant all on public.payment_deadline_push_outbox to service_role;

-- Evita aplicar novos avisos a prazos que já tinham terminado antes da implantação.
create table public.payment_deadline_push_config (
  singleton boolean primary key default true check (singleton),
  started_at timestamptz not null default now()
);
insert into public.payment_deadline_push_config(singleton) values(true);
alter table public.payment_deadline_push_config enable row level security;
revoke all on public.payment_deadline_push_config from anon,authenticated;
grant select on public.payment_deadline_push_config to service_role;

create function public.queue_payment_deadline_pushes()
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
    and coalesce(p.payment_deadline_override,pool.payment_deadline) < now()
  on conflict do nothing;
$$;
revoke all on function public.queue_payment_deadline_pushes() from public,anon,authenticated;
grant execute on function public.queue_payment_deadline_pushes() to service_role;

-- A rotina do banco já libera vagas a cada 5 minutos. A chamada HTTP envia
-- os avisos de prazo e as notificações da lista de espera no mesmo intervalo.
select cron.schedule('dispatch-pool-deadline-pushes','2-59/5 * * * *',
  $$select net.http_get(
    url := 'https://bolao-connect.vercel.app/api/cron/payment-deadlines',
    headers := jsonb_build_object('Authorization','Bearer ' || coalesce(
      (select decrypted_secret from vault.decrypted_secrets where name='bolao_cron_secret' limit 1),'')),
    timeout_milliseconds := 25000
  )$$);
