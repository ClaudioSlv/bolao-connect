-- Resultados manuais publicados pelo organizador.
-- Ficam separados dos resultados oficiais para não alterar o widget da CAIXA.

create table if not exists public.manual_lottery_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  lottery text not null,
  contest_number integer not null check (contest_number > 0),
  numbers jsonb not null check (jsonb_typeof(numbers) = 'array'),
  second_draw_numbers jsonb not null default '[]'::jsonb check (jsonb_typeof(second_draw_numbers) = 'array'),
  trevos jsonb not null default '[]'::jsonb check (jsonb_typeof(trevos) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, lottery, contest_number)
);

create index if not exists manual_lottery_results_lookup_idx
  on public.manual_lottery_results(owner_id, lottery, contest_number);

alter table public.manual_lottery_results enable row level security;

revoke all on public.manual_lottery_results from anon;

drop policy if exists "owner manages manual lottery results" on public.manual_lottery_results;
create policy "owner manages manual lottery results"
on public.manual_lottery_results
for all
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

comment on table public.manual_lottery_results is
  'Resultados informados manualmente pelo organizador, separados dos resultados oficiais da CAIXA.';
