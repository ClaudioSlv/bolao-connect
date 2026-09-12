-- Horários oficiais e especiais divulgados pela CAIXA.
-- A rotina de sincronização poderá atualizar esta tabela sem alterar o bolão.
create table if not exists public.lottery_broadcasts (
  id uuid primary key default gen_random_uuid(),
  lottery text not null,
  contest_number integer not null check (contest_number > 0),
  scheduled_at timestamptz not null,
  watch_url text not null default 'https://www.youtube.com/@caixa/live',
  source_url text,
  source text not null default 'caixa_official',
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(lottery, contest_number)
);

create index if not exists lottery_broadcasts_schedule_idx
  on public.lottery_broadcasts(scheduled_at);

alter table public.lottery_broadcasts enable row level security;
revoke all on public.lottery_broadcasts from anon, authenticated;
