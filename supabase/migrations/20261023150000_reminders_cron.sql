-- Run the reminders function every 15 minutes (it is idempotent and needs no secret).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-reminders',
  '*/15 * * * *',
  $$ select net.http_post(
       url := 'https://qkcdjqrtwzqflrrxdgqw.supabase.co/functions/v1/send-reminders',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
