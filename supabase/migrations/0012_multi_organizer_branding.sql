-- Base multi-organizador do Bolão Amigos BTP.
-- Não adiciona cobrança. Prepara identidade por organizador e domínio próprio futuro.

alter table public.profiles add column if not exists account_type text not null default 'organizer';
alter table public.profiles add column if not exists brand_name text;
alter table public.profiles add column if not exists organizer_slug text;
alter table public.profiles add column if not exists logo_url text;
alter table public.profiles add column if not exists custom_domain text;
alter table public.profiles add column if not exists domain_status text not null default 'unconfigured';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.profiles add constraint profiles_account_type_check
    check (account_type in ('organizer','admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_domain_status_check
    check (domain_status in ('unconfigured','pending','verified','disabled'));
exception when duplicate_object then null; end $$;

create unique index if not exists profiles_organizer_slug_unique
  on public.profiles (lower(organizer_slug))
  where organizer_slug is not null;

create unique index if not exists profiles_custom_domain_unique
  on public.profiles (lower(custom_domain))
  where custom_domain is not null;

-- Cria automaticamente o perfil básico quando uma nova conta de organizador nasce no Auth.
create or replace function public.handle_new_organizer_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_brand text;
begin
  v_name := left(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''),'@',1), 'Organizador'),120);
  v_brand := left(coalesce(nullif(new.raw_user_meta_data->>'brand_name',''), v_name),120);

  insert into public.profiles (id,display_name,account_type,brand_name,organizer_slug)
  values (new.id,v_name,'organizer',v_brand,'org-' || substr(new.id::text,1,8))
  on conflict (id) do update set
    display_name = excluded.display_name,
    brand_name = coalesce(public.profiles.brand_name, excluded.brand_name),
    account_type = 'organizer',
    organizer_slug = coalesce(public.profiles.organizer_slug, excluded.organizer_slug),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_organizer_profile on auth.users;
create trigger on_auth_user_created_organizer_profile
after insert on auth.users
for each row execute function public.handle_new_organizer_profile();

-- Preenche identidade mínima para perfis já existentes sem alterar quem já definiu a própria marca.
update public.profiles
set brand_name = coalesce(brand_name, display_name),
    organizer_slug = coalesce(organizer_slug, 'org-' || substr(id::text,1,8)),
    updated_at = now()
where brand_name is null or organizer_slug is null;
