-- Bolão Connect: fluxo de pagamento do participante e lembretes
alter table public.payments add column if not exists payment_method text;
alter table public.payments add column if not exists submitted_at timestamptz;

alter table public.reminder_preferences add column if not exists interval_days integer not null default 10 check (interval_days between 1 and 60);
alter table public.reminder_preferences add column if not exists last_sent_at timestamptz;

create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  receipt_path text,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique(pool_id, participant_id, status)
);

alter table public.payment_submissions enable row level security;
create policy "owner manages payment submissions" on public.payment_submissions for all to authenticated
using (exists(select 1 from public.pools b where b.id=payment_submissions.pool_id and b.owner_id=auth.uid()))
with check (exists(select 1 from public.pools b where b.id=payment_submissions.pool_id and b.owner_id=auth.uid()));
create policy "member reads own payment submissions" on public.payment_submissions for select to authenticated
using (exists(select 1 from public.participants p where p.id=payment_submissions.participant_id and p.user_id=auth.uid()));
create policy "member submits own receipt" on public.payment_submissions for insert to authenticated
with check (status='pending' and exists(select 1 from public.participants p where p.id=payment_submissions.participant_id and p.pool_id=payment_submissions.pool_id and p.user_id=auth.uid() and p.status<>'cancelled'));

grant select,insert,update,delete on table public.payment_submissions to authenticated;
revoke all on table public.payment_submissions from anon;

-- Comprovantes privados. O upload/leitura deve ser feito por usuário autenticado e as políticas do bucket.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('payment-receipts','payment-receipts',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

create policy "authenticated uploads receipts" on storage.objects for insert to authenticated
with check (bucket_id='payment-receipts');
create policy "authenticated reads own pool receipts" on storage.objects for select to authenticated
using (bucket_id='payment-receipts');
