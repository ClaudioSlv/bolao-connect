create or replace function public.personal_games_have_stable_references(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    jsonb_typeof(value) = 'array'
    and jsonb_array_length(value) between 1 and 5000
    and not exists (
      select 1
      from jsonb_array_elements(value) as game(item)
      where jsonb_typeof(game.item) <> 'object'
        or not (game.item ? 'numbers')
        or not (game.item ? 'referenceNumber')
        or jsonb_typeof(game.item -> 'referenceNumber') <> 'number'
        or (game.item ->> 'referenceNumber')::integer not between 1 and 5000
    )
    and (
      select count(*) = count(distinct (game.item ->> 'referenceNumber')::integer)
      from jsonb_array_elements(value) as game(item)
    );
$$;

comment on column public.personal_saved_games.games is 'Immutable game array. referenceNumber is stable within the saved contest set (1..5000).';
