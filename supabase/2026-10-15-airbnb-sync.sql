-- 2026-10-15 Airbnb calendars sync every 15 minutes — one paste. Safe to run twice.
--
-- Supabase's own scheduler (pg_cron) calls the site's sync link, so new
-- Airbnb checkouts reach the admin calendar and the office inbox without
-- anyone opening the admin. Replace <TOKEN> with the value Naunas sends
-- privately (it only allows triggering a sync). Re-running replaces the job.
--
-- To stop it:  select cron.unschedule('saafi-airbnb-sync');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'saafi-airbnb-sync';

select cron.schedule(
  'saafi-airbnb-sync',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://saaficleaningservice.com/api/airbnb/sync',
    headers := jsonb_build_object('Authorization', 'Bearer <TOKEN>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
