alter table public.pools
  add column if not exists test_access_token uuid not null default gen_random_uuid();

create unique index if not exists pools_test_access_token_uidx
  on public.pools(test_access_token);
