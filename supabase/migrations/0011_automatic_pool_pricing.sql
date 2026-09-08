-- Bolão Connect: cálculo automático do custo dos jogos e valor da cota.

alter table public.pools add column if not exists total_cost_cents bigint;
alter table public.pools add column if not exists game_plan jsonb;

do $$ begin
  alter table public.pools add constraint pools_total_cost_cents_check
    check (total_cost_cents is null or total_cost_cents > 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.pools add constraint pools_game_plan_array_check
    check (game_plan is null or jsonb_typeof(game_plan) = 'array');
exception when duplicate_object then null; end $$;

update public.pools
set total_cost_cents = share_price_cents * total_shares
where total_cost_cents is null;
