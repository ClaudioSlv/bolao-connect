create table if not exists public.organizer_lottery_prices (
  owner_id uuid not null references auth.users(id) on delete cascade,
  lottery text not null check (lottery in ('mega-sena','lotofacil','quina','dupla-sena','lotomania','timemania','dia-de-sorte','super-sete','mais-milionaria')),
  base_price_cents integer not null check (base_price_cents > 0 and base_price_cents <= 1000000),
  updated_at timestamptz not null default now(),
  primary key (owner_id, lottery)
);

alter table public.organizer_lottery_prices enable row level security;

grant select, insert, update on table public.organizer_lottery_prices to authenticated;
grant all on table public.organizer_lottery_prices to service_role;

create policy "organizer_lottery_prices_select_own"
on public.organizer_lottery_prices for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "organizer_lottery_prices_insert_own"
on public.organizer_lottery_prices for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "organizer_lottery_prices_update_own"
on public.organizer_lottery_prices for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
