-- Selfie de cadastro e consentimento LGPD.
alter table public.participants
  add column if not exists selfie_path text,
  add column if not exists selfie_consent_at timestamptz,
  add column if not exists selfie_consent_version integer not null default 1;

-- Bucket privado para selfies. Nunca tornar público.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('participant-selfies','participant-selfies',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public=false,
  file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

-- O upload e a leitura serão feitos somente pelo servidor autenticado/service role.
-- Nenhuma política pública/anon é criada para o bucket.
