alter table public.participants
  add column if not exists email text;

alter table public.participants
  drop constraint if exists participants_email_format_check;

alter table public.participants
  add constraint participants_email_format_check
  check (
    email is null or
    (char_length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  );
