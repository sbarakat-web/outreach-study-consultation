-- Every booking now starts as "Awaiting confirmation" (call_status = 'requested' with preferred_call_at):
-- the team adds it to Google Calendar by hand, pastes the Meet link and confirms in admin.
alter table public.consultations
  add column if not exists call_requested_at timestamptz,
  add column if not exists request_reminder_at timestamptz;

-- Times taken by confirmed calls and by requests awaiting confirmation, so nobody else can pick them.
create or replace function public.booked_call_times()
returns table (starts_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select c.preferred_call_at from public.consultations c
  where c.preferred_call_at > now() and c.call_declined_at is null
    and (c.call_status = 'requested' or public.is_booked_for_session(c))
$$;
grant execute on function public.booked_call_times to anon, authenticated;
