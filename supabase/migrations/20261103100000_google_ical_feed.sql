-- Secret iCal address of the booking calendar ("Integrate calendar" in Google Calendar settings): lets the sync read
-- Google bookings without Workspace sharing. Service role only (google_sync has RLS and no policies).
alter table public.google_sync add column if not exists ical_url text;
insert into public.google_sync (id) values (1) on conflict (id) do nothing;
