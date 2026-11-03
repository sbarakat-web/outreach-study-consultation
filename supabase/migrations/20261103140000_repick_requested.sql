-- The team asked the candidate to pick another time (their time wasn't available): shown under "Waiting for candidate"
-- until they pick a new time (call_status becomes 'requested' again).
alter table public.consultations add column if not exists repick_requested_at timestamptz;
