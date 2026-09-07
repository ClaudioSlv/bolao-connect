-- Bolão Connect: pagamento do participante, comprovantes privados e lembretes
-- Esta migration substitui a versão anterior de 0003 antes de sua aplicação em produção.

alter table public.participants add column if not exists access_token uuid not null default gen_random_uuid();
create unique index if not exists participants_access_token_uidx on public.participants(access_token);

alter table public.payments add column if not exists payment_method text;
alter table public.payments add column if not exists submitted_at timestamptz;
do $$ begin
  alter table public.payments add constraint payments_method_check check (payment_method is null or payment_method in ('pix','cash','other'));
exception when duplicate_object then null; end $$;

alter table public.reminder_preferences add column if not exists interval_days integer not null default 10 check (interval_days between 1 and 60);
alter table public.reminder_preferences add column if not exists last_sent_at timestamptz;

create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  receipt_path text not null,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index if not exists payment_submissions_one_pending_uidx on public.payment_submissions(participant_id) where status='pending';

alter table public.payment_submissions enable row level security;
drop policy if exists "owner manages payment submissions" on public.payment_submissions;
drop policy if exists "member reads own payment submissions" on public.payment_submissions;
drop policy if exists "member submits own receipt" on public.payment_submissions;
create policy "owner manages payment submissions" on public.payment_submissions for all to authenticated
using (exists(select 1 from public.pools b where b.id=payment_submissions.pool_id and b.owner_id=auth.uid()))
with check (exists(select 1 from public.pools b where b.id=payment_submissions.pool_id and b.owner_id=auth.uid()));
create policy "member reads own payment submissions" on public.payment_submissions for select to authenticated
using (exists(select 1 from public.participants p where p.id=payment_submissions.participant_id and p.user_id=auth.uid()));
grant select,insert,update,delete on table public.payment_submissions to authenticated;
revoke all on table public.payment_submissions from anon;

-- Bucket privado. Upload e leitura públicos NÃO recebem política direta no Storage.
-- O app deve validar o access_token no servidor e usar SUPABASE_SECRET_KEY para upload
-- e URL assinada para o organizador, impedindo acesso entre participantes.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('payment-receipts','payment-receipts',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "authenticated uploads receipts" on storage.objects;
drop policy if exists "authenticated reads own pool receipts" on storage.objects;
