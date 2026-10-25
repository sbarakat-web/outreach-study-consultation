-- Bulk account invitations (CSV): queued rows are sent one by one, spaced by the chosen interval.
alter table public.marketing_contacts
  add column if not exists scheduled_at timestamptz,
  add column if not exists batch_id uuid,
  add column if not exists send_interval_minutes int check (send_interval_minutes between 1 and 1440);

alter table public.marketing_contacts drop constraint marketing_contacts_status_check;
alter table public.marketing_contacts add constraint marketing_contacts_status_check
  check (status in ('draft', 'queued', 'sending', 'sent', 'opened', 'clicked', 'account_created', 'unsubscribed', 'failed', 'cancelled'));

create index if not exists marketing_contacts_queue_idx on public.marketing_contacts(scheduled_at)
  where status = 'queued';

-- Every minute (was hourly): the queue needs minute precision. The function claims every row
-- before sending, so overlapping runs never double-send.
select cron.schedule(
  'process-marketing-followups',
  '* * * * *',
  $$ select net.http_post(
       url := 'https://qkcdjqrtwzqflrrxdgqw.supabase.co/functions/v1/process-marketing-followups',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
