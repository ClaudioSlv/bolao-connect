-- Run the personal prize checker every five minutes using Supabase Cron.
-- Before enabling this migration, store the same CRON_SECRET used by Vercel
-- in Supabase Vault with the name "bolao_cron_secret".

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'check-personal-game-prizes'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end;
$$;

select cron.schedule(
  'check-personal-game-prizes',
  '*/5 * * * *',
  $$
    select net.http_get(
      url := 'https://bolao-connect.vercel.app/api/cron/personal-game-prizes',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || coalesce(
          (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'bolao_cron_secret'
            limit 1
          ),
          ''
        )
      ),
      timeout_milliseconds := 25000
    );
  $$
);
