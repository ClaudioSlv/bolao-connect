create table if not exists public.game_receipts (
 id uuid primary key default gen_random_uuid(), pool_id uuid not null references public.pools(id) on delete cascade,
 title text not null, contest_number integer, storage_path text not null unique, mime_type text not null,
 original_name text, file_size bigint not null check(file_size>0), status text not null default 'published' check(status in('draft','published','archived')),
 published_by uuid not null references public.profiles(id), published_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create index if not exists game_receipts_pool_idx on public.game_receipts(pool_id,published_at desc);
alter table public.game_receipts enable row level security;
create policy "owner manages game receipts" on public.game_receipts for all
using(exists(select 1 from public.pools p where p.id=pool_id and p.owner_id=auth.uid()))
with check(exists(select 1 from public.pools p where p.id=pool_id and p.owner_id=auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('game-receipts','game-receipts',false,15728640,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=15728640,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
-- Uma foto por comprovante; acesso do participante somente por URL assinada após validar o token.
