-- Candidates request up to 3 preferred call times; an admin reviews the profile,
-- then confirms one time (or sends the booking link / proposes others / declines).
--   requested_call_times  candidate's choices, in order of preference
--   preferred_call_at     the confirmed call time (set by an admin)
--   call_reviewed_at      profile reviewed by an admin
--   call_declined_at      not a fit / later (overrides the other states)
-- Additive only: request_call(uuid, timestamptz) is superseded by request_call_times.

alter table public.consultations
  add column requested_call_times timestamptz[] not null default '{}',
  add column review_checklist jsonb not null default '{}'::jsonb,
  add column call_reviewed_at timestamptz,
  add column call_declined_at timestamptz,
  add column call_alert_at timestamptz;

revoke execute on function public.request_call(uuid, timestamptz) from authenticated;

create or replace function public.request_call_times(p_consultation_id uuid, p_times timestamptz[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  t timestamptz;
begin
  if auth.uid() is null or not public.owns_consultation(p_consultation_id) then
    raise exception 'NOT_ALLOWED';
  end if;
  if coalesce(array_length(p_times, 1), 0) not between 1 and 3 then
    raise exception 'INVALID_TIME';
  end if;
  foreach t in array p_times loop
    if t < now() + interval '12 hours' or t > now() + interval '90 days' then
      raise exception 'INVALID_TIME';
    end if;
  end loop;

  update public.consultations
    set requested_call_times = p_times, call_status = 'requested'
    where id = p_consultation_id and call_status <> 'confirmed' and call_declined_at is null;
  if not found then
    raise exception 'ALREADY_CONFIRMED';
  end if;
end $$;

revoke all on function public.request_call_times from public, anon;
grant execute on function public.request_call_times to authenticated;
