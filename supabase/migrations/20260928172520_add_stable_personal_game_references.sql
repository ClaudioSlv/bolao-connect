-- Give every game an immutable reference inside its contest set. Existing
-- arrays keep their original order and numbers; only referenceNumber is added.
update public.personal_saved_games saved
set games = (
  select jsonb_agg(
    game.value || jsonb_build_object('referenceNumber', game.ordinality)
    order by game.ordinality
  )
  from jsonb_array_elements(saved.games) with ordinality as game(value, ordinality)
)
where exists (
  select 1
  from jsonb_array_elements(saved.games) as game(value)
  where not (game.value ? 'referenceNumber')
);

create or replace function public.personal_games_have_stable_references(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    jsonb_typeof(value) = 'array'
    and jsonb_array_length(value) between 1 and 1000
    and not exists (
      select 1
      from jsonb_array_elements(value) as game(item)
      where jsonb_typeof(game.item) <> 'object'
        or not (game.item ? 'numbers')
        or not (game.item ? 'referenceNumber')
        or jsonb_typeof(game.item -> 'referenceNumber') <> 'number'
        or (game.item ->> 'referenceNumber')::integer not between 1 and 1000
    )
    and (
      select count(*) = count(distinct (game.item ->> 'referenceNumber')::integer)
      from jsonb_array_elements(value) as game(item)
    );
$$;

alter table public.personal_saved_games
  add constraint personal_saved_games_stable_references_check
  check (public.personal_games_have_stable_references(games));

create or replace function public.protect_personal_saved_game_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.participant_id is distinct from old.participant_id
    or new.pool_id is distinct from old.pool_id
    or new.lottery is distinct from old.lottery
    or new.contest_number is distinct from old.contest_number
    or new.games is distinct from old.games then
    raise exception 'Os jogos, suas referências e o concurso não podem ser alterados depois de salvos.';
  end if;
  return new;
end;
$$;

create trigger protect_personal_saved_game_identity_trigger
before update on public.personal_saved_games
for each row execute function public.protect_personal_saved_game_identity();

comment on column public.personal_saved_games.games is
  'Immutable game array. referenceNumber is stable within the saved contest set (1..1000).';
