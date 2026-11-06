-- Keep the most recent cancelled appointment visible to staff while the candidate chooses a new time.
-- Once they request another time, call_status changes from none and the lead automatically leaves this view.
alter table public.consultations
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_call_at timestamptz,
  add column if not exists cancelled_by text;

comment on column public.consultations.cancelled_at is 'When staff most recently cancelled the active appointment.';
comment on column public.consultations.cancelled_call_at is 'The appointment time that was cancelled.';
comment on column public.consultations.cancelled_by is 'Email of the staff member who cancelled the appointment.';
