-- Our Week: run the reminder function every minute.
-- Run this AFTER supabase/setup.sql and after deploying the send-reminders function (see README).
-- Paste into Supabase > SQL Editor > New query, then press Run. Safe to run more than once.
-- If your project URL ever changes, update it below (it's the supabaseUrl in public/config.js).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Same name each time, so rerunning replaces the job instead of adding a second one.
select cron.schedule(
  'our-week-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://ktrsnsnbbffzgpskhtwg.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select secret from public.reminder_secret where id = 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Quick check: should show the job, scheduled every minute.
select jobname, schedule, active from cron.job where jobname = 'our-week-reminders';

-- To stop reminders entirely:  select cron.unschedule('our-week-reminders');
-- To see recent runs:          select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
-- To see the function's replies: select status_code, content from net._http_response order by created desc limit 10;
