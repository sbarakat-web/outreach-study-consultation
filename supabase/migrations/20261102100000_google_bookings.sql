-- Calls booked on the Google appointment page are synced into the app (sync-google-bookings, every 5 minutes).
alter table public.consultations add column if not exists booked_via text
  check (booked_via in ('google', 'admin', 'dashboard', 'confirm-link'));

-- One row per Google booking event: links it to the lead and remembers its time (to detect moves/cancellations).
create table if not exists public.google_bookings (
  event_id text primary key,
  consultation_id uuid references public.consultations(id) on delete set null,
  booker_email text,
  start_at timestamptz,
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  updated_at timestamptz not null default now()
);
alter table public.google_bookings enable row level security;
create policy "google bookings: admins read" on public.google_bookings for select to authenticated using (public.is_admin());

-- Sync checkpoint (service role only).
create table if not exists public.google_sync (
  id int primary key default 1 check (id = 1),
  last_sync_at timestamptz
);
alter table public.google_sync enable row level security;

select cron.schedule(
  'sync-google-bookings',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://qkcdjqrtwzqflrrxdgqw.supabase.co/functions/v1/sync-google-bookings',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
alter table public.google_sync add column if not exists debug jsonb;
