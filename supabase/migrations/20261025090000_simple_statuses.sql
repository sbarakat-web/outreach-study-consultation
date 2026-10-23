-- Five statuses only, following the call and the online session:
--   new → consultation_booked → interviewed | no_show | not_interested
alter table public.consultations drop constraint consultations_status_check;

update public.consultations set status = case
  when session_outcome = 'interviewed' then 'interviewed'
  when session_outcome = 'no_attendance' and call_status <> 'confirmed' then 'no_show'
  when session_outcome = 'no_longer_interested' or status = 'lost' then 'not_interested'
  when call_status = 'confirmed' then 'consultation_booked'
  when status in ('documents_requested', 'application_submitted', 'offer_received', 'payment', 'visa_process', 'enrolled') then 'interviewed'
  else 'new'
end;

alter table public.consultations add constraint consultations_status_check
  check (status in ('new', 'consultation_booked', 'interviewed', 'no_show', 'not_interested'));

create or replace function public.mark_candidate_interviewed(_application_id uuid, _comment text, _programme text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_session_presenter()) then
    raise exception 'NOT_ALLOWED';
  end if;
  update public.consultations c
    set session_outcome = 'interviewed',
        session_outcome_at = now(),
        session_by = public.my_email(),
        status = 'interviewed',
        documents_due_at = now() + interval '7 days',
        preferred_call_at = null,
        desired_course = coalesce(nullif(trim(_programme), ''), c.desired_course),
        admin_notes = concat_ws(E'\n', nullif(c.admin_notes, ''),
          '[Online Session - Interviewed] ' || coalesce(nullif(trim(_comment), ''), 'No additional comment provided.'))
    where c.id = _application_id and public.is_booked_for_session(c);
  if not found then
    raise exception 'Candidate not found or not in the Booked Appointment stage';
  end if;
end $$;

create or replace function public.mark_candidate_session_outcome(_application_id uuid, _outcome text, _comment text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_label text;
begin
  if not (public.is_admin() or public.is_session_presenter()) then
    raise exception 'NOT_ALLOWED';
  end if;
  if _outcome not in ('no_attendance', 'no_longer_interested') then
    raise exception 'INVALID_OUTCOME';
  end if;
  v_label := case _outcome when 'no_attendance' then 'No Attendance' else 'No Longer Interested' end;

  update public.consultations c
    set session_outcome = _outcome,
        session_outcome_at = now(),
        session_by = public.my_email(),
        call_status = case when _outcome = 'no_attendance' then 'none' else c.call_status end,
        requested_call_times = case when _outcome = 'no_attendance' then '{}'::timestamptz[] else c.requested_call_times end,
        preferred_call_at = null,
        reminder_24h_at = null,
        reminder_1h_at = null,
        status = case when _outcome = 'no_longer_interested' then 'not_interested' else 'no_show' end,
        call_declined_at = case when _outcome = 'no_longer_interested' then now() else c.call_declined_at end,
        admin_notes = concat_ws(E'\n', nullif(c.admin_notes, ''),
          '[Online Session - ' || v_label || '] ' || coalesce(nullif(trim(_comment), ''), 'No additional comment provided.'))
    where c.id = _application_id and public.is_booked_for_session(c);
  if not found then
    raise exception 'Candidate not found or not in the Booked Appointment stage';
  end if;
end $$;

-- Any confirmed call (admin or candidate) moves the lead to "Consultation booked".
create or replace function public.status_on_call_confirmed()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.call_status = 'confirmed' and (old.call_status is distinct from 'confirmed') and new.status in ('new', 'no_show', 'not_interested') then
    new.status := 'consultation_booked';
  end if;
  return new;
end $$;

create trigger consultations_status_on_call_confirmed
  before update of call_status on public.consultations
  for each row execute function public.status_on_call_confirmed();
