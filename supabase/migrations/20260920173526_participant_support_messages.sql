create table if not exists public.participant_support_messages (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  category text not null check (category in ('bug','suggestion','help')),
  message text not null check (char_length(message) between 5 and 1500),
  attachment_path text,
  attachment_mime text,
  status text not null default 'unread' check (status in ('unread','read','closed')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists participant_support_messages_owner_idx
  on public.participant_support_messages(pool_id,status,created_at desc);
create index if not exists participant_support_messages_participant_idx
  on public.participant_support_messages(participant_id);

alter table public.participant_support_messages enable row level security;

create policy "owner reads support messages"
on public.participant_support_messages for select
to authenticated
using (exists (
  select 1 from public.pools p
  where p.id = participant_support_messages.pool_id
    and p.owner_id = (select auth.uid())
));

create policy "owner updates support messages"
on public.participant_support_messages for update
to authenticated
using (exists (
  select 1 from public.pools p
  where p.id = participant_support_messages.pool_id
    and p.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.pools p
  where p.id = participant_support_messages.pool_id
    and p.owner_id = (select auth.uid())
));

revoke all on table public.participant_support_messages from anon;
grant select,update on table public.participant_support_messages to authenticated;
grant all on table public.participant_support_messages to service_role;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
