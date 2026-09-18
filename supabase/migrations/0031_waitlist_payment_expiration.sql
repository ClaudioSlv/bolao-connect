-- Base para expiração automática de reservas e prazo especial da lista de espera.
alter type public.participant_status add value if not exists 'expired';

alter table public.participants
  add column if not exists payment_deadline_override timestamptz;

alter table public.pools
  add column if not exists waitlist_payment_deadline timestamptz;

create index if not exists participants_payment_deadline_override_idx
  on public.participants(pool_id,payment_deadline_override)
  where status='confirmed' and payment_status<>'confirmed';
