-- Attendance confirmation: after "We're waiting for you" the candidate confirms they'll attend (email link, or the team
-- marks a WhatsApp YES). Unconfirmed bookings are cancelled automatically after attendance_deadline (sync-google-bookings).
alter table public.consultations
  add column if not exists attendance_confirmed_at timestamptz,
  add column if not exists attendance_deadline timestamptz,
  -- Why the lead is no longer interested (chosen by the team; never shown to the candidate).
  add column if not exists not_interested_reason text,
  add column if not exists not_interested_at timestamptz;
