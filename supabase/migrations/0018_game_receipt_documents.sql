create table if not exists public.game_receipt_documents (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  title text not null,
  contest_number integer,
  status text not null default 'published' check (status in ('draft','published','archived')),
  published_by uuid not null references public.profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.game_receipt_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.game_receipt_documents(id) on delete cascade,
  storage_path text not null unique,
  page_order integer not null check (page_order >= 0),
  mime_type text not null,
  original_name text,
  file_size bigint not null check (file_size > 0),
  created_at timestamptz not null default now(),
  unique(document_id,page_order)
);

create index if not exists game_receipt_documents_pool_idx on public.game_receipt_documents(pool_id,created_at desc);
create index if not exists game_receipt_pages_document_idx on public.game_receipt_pages(document_id,page_order);
alter table public.game_receipt_documents enable row level security;
alter table public.game_receipt_pages enable row level security;

create policy "owner manages receipt documents" on public.game_receipt_documents for all
using (exists(select 1 from public.pools p where p.id=pool_id and p.owner_id=auth.uid()))
with check (exists(select 1 from public.pools p where p.id=pool_id and p.owner_id=auth.uid()));
create policy "owner reads receipt pages" on public.game_receipt_pages for select
using (exists(select 1 from public.game_receipt_documents d join public.pools p on p.id=d.pool_id where d.id=document_id and p.owner_id=auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('game-receipts','game-receipts',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

-- O participante recebe URLs curtas e assinadas somente após a validação do seu token.
