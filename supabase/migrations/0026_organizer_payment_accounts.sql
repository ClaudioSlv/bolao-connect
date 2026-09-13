-- Conta recebedora individual de cada organizador.
create table if not exists public.organizer_payment_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'pagbank' check (provider in ('pagbank')),
  connection_status text not null default 'not_connected'
    check (connection_status in ('not_connected','pending','connected','expired','error')),
  merchant_id text,
  scopes text[] not null default '{}'::text[],
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  manual_pix_key text,
  manual_pix_key_type text check (manual_pix_key_type is null or manual_pix_key_type in ('cpf','cnpj','email','phone','random')),
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, provider)
);

create table if not exists public.pagbank_connect_states (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  state_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists organizer_payment_accounts_owner_idx
  on public.organizer_payment_accounts(owner_id);
create index if not exists pagbank_connect_states_expiry_idx
  on public.pagbank_connect_states(expires_at);

alter table public.organizer_payment_accounts enable row level security;
alter table public.pagbank_connect_states enable row level security;

create policy "organizer reads own payment account"
on public.organizer_payment_accounts for select to authenticated
using (owner_id = auth.uid());

create policy "organizer creates own payment account"
on public.organizer_payment_accounts for insert to authenticated
with check (owner_id = auth.uid());

create policy "organizer updates own payment account"
on public.organizer_payment_accounts for update to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select(id,owner_id,provider,connection_status,merchant_id,scopes,token_expires_at,manual_pix_key,manual_pix_key_type,connected_at,created_at,updated_at)
  on public.organizer_payment_accounts to authenticated;
grant insert(owner_id,provider,manual_pix_key,manual_pix_key_type,updated_at)
  on public.organizer_payment_accounts to authenticated;
grant update(manual_pix_key,manual_pix_key_type,updated_at)
  on public.organizer_payment_accounts to authenticated;
grant all on public.organizer_payment_accounts,public.pagbank_connect_states to service_role;
