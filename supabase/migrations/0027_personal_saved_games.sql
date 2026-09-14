-- Personal games linked to a participant for automatic prize checking.
-- Games are removed ten days after their official result becomes available.

create table if not exists public.personal_saved_games (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  pool_id uuid not null references public.pools(id) on delete cascade,
  lottery text not null,
  contest_number integer not null check (contest_number > 0),
  games jsonb not null check (jsonb_typeof(games) = 'array'),
  created_at timestamptz not null default now(),
  checked_at timestamptz,
  notified_at timestamptz,
  expires_at timestamptz,
  prize_summary jsonb
);

create index if not exists personal_saved_games_pending_idx
  on public.personal_saved_games(lottery, contest_number, checked_at);

create index if not exists personal_saved_games_expiry_idx
  on public.personal_saved_games(expires_at)
  where expires_at is not null;

alter table public.personal_saved_games enable row level security;
revoke all on public.personal_saved_games from anon, authenticated;

comment on table public.personal_saved_games is
  'Participant personal games checked automatically and deleted ten days after the draw.';
