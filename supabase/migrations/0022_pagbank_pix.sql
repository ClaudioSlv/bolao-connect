-- Pix PagBank: permite armazenar uma cobrança individual e seu QR Code.
alter table public.payment_checkout_sessions drop constraint if exists payment_checkout_sessions_provider_check;
alter table public.payment_checkout_sessions
  add constraint payment_checkout_sessions_provider_check
  check (provider in ('infinitepay','pagbank'));

alter table public.payment_checkout_sessions
  add column if not exists provider_order_id text,
  add column if not exists qr_code_text text,
  add column if not exists qr_code_expires_at timestamptz;

create unique index if not exists payment_checkout_provider_order_uidx
  on public.payment_checkout_sessions(provider,provider_order_id)
  where provider_order_id is not null;
