-- Booked call ended with no outcome recorded: when the presenters were emailed (once per call time).
alter table public.consultations add column if not exists overdue_alert_at timestamptz;

-- A new call time starts a new cycle.
create or replace function public.reset_overdue_alert() returns trigger language plpgsql set search_path = public as $$
begin
  if new.preferred_call_at is distinct from old.preferred_call_at then
    new.overdue_alert_at := null;
  end if;
  return new;
end $$;

drop trigger if exists reset_overdue_alert on public.consultations;
create trigger reset_overdue_alert before update of preferred_call_at on public.consultations
  for each row execute function public.reset_overdue_alert();
