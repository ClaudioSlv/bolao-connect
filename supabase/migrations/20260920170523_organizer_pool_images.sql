-- Imagens públicas de identidade do organizador e capa individual dos bolões.
alter table public.profiles add column if not exists logo_path text;
alter table public.pools add column if not exists cover_image_url text;
alter table public.pools add column if not exists cover_image_path text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'organizer-assets',
  'organizer-assets',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update set
  public=true,
  file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];
