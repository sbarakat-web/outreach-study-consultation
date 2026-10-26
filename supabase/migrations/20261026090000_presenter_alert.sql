-- Presenter email 10 minutes before each confirmed call (one-click sign-in to /onlinesessions).
alter table public.consultations add column if not exists presenter_alert_at timestamptz;

-- A moved call gets a fresh presenter email.
create or replace function public.reset_presenter_alert()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.preferred_call_at is distinct from old.preferred_call_at then
    new.presenter_alert_at := null;
  end if;
  return new;
end $$;

create trigger consultations_reset_presenter_alert
  before update of preferred_call_at on public.consultations
  for each row execute function public.reset_presenter_alert();

-- Every minute (was every 15): the presenter email must arrive 10 minutes before the call.
-- Every reminder is claimed with a timestamp first, so extra runs never send twice.
select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$ select net.http_post(
       url := 'https://qkcdjqrtwzqflrrxdgqw.supabase.co/functions/v1/send-reminders',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
