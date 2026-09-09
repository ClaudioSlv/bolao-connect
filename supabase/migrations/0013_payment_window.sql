alter table public.pools
  add column if not exists payment_opens_at timestamptz;

-- Bolões antigos continuam utilizáveis. Nos novos, a abertura é obrigatória pelo app.
create index if not exists pools_payment_opens_at_idx on public.pools(payment_opens_at);
