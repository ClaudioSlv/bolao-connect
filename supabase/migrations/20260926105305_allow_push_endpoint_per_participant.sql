alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_endpoint_key;

create unique index if not exists push_subscriptions_endpoint_participant_uidx
  on public.push_subscriptions(endpoint, participant_id);
