-- Bolão Connect: plano do bolão e fluxo de autoentrada pública.
-- Cada novo participante que entra pelo link público ocupa 1 cota/vaga.

alter table public.pools add column if not exists planned_games integer;
alter table public.pools add column if not exists numbers_per_game integer;

do $$ begin
  alter table public.pools add constraint pools_planned_games_check
    check (planned_games is null or planned_games > 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.pools add constraint pools_numbers_per_game_check
    check (numbers_per_game is null or numbers_per_game > 0);
exception when duplicate_object then null; end $$;

create index if not exists participants_pool_active_idx
  on public.participants(pool_id, status);
