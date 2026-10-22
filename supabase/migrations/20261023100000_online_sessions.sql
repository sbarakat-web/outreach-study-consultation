-- Online Study Session (/onlinesessions): presenter role, session outcomes, queue log.
-- Additive only. Pipeline mapping:
--   Booked (step 2)     call_status = 'confirmed', no final outcome, not declined
--   Interviewed (3)     session_outcome = 'interviewed', status → documents_requested
--   No attendance (7)   session_outcome = 'no_attendance', call reset so the candidate can rebook
--   Not interested (8)  session_outcome = 'no_longer_interested', status → lost

alter table public.consultations
  add column session_outcome text check (session_outcome in ('interviewed', 'no_attendance', 'no_longer_interested')),
  add column session_outcome_at timestamptz,
  add column meeting_url text,
  add column is_starred boolean not null default false;

-- Session presenters: run sessions and record outcomes, nothing else.
create table public.session_presenters (
  email text primary key check (email = lower(email)),
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.session_presenters enable row level security;
create policy "session_presenters: admins manage" on public.session_presenters
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.is_session_presenter()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.session_presenters p where p.email = public.my_email())
$$;

create or replace function public.is_booked_for_session(c public.consultations)
returns boolean
language sql immutable set search_path = ''
as $$
  select c.call_status = 'confirmed' and c.call_declined_at is null
    and coalesce(c.session_outcome, '') not in ('interviewed', 'no_longer_interested')
$$;

-- Presenters may read booked and interviewed candidates only (no write access).
create policy "consultations: presenter reads booked or interviewed" on public.consultations
  for select to authenticated
  using (public.is_session_presenter() and (public.is_booked_for_session(consultations) or session_outcome = 'interviewed'));

-- Shared log, e.g. "hidden from presenter queue".
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations (id) on delete cascade,
  action text not null,
  actor uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index activity_log_consultation_idx on public.activity_log (consultation_id);
alter table public.activity_log enable row level security;
create policy "activity_log: staff read" on public.activity_log
  for select to authenticated using (public.is_admin() or public.is_session_presenter());
create policy "activity_log: staff add" on public.activity_log
  for insert to authenticated with check ((public.is_admin() or public.is_session_presenter()) and actor = auth.uid());

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
        status = 'documents_requested',
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
        -- No attendance: reset the call so the candidate can pick a new time.
        call_status = case when _outcome = 'no_attendance' then 'none' else c.call_status end,
        requested_call_times = case when _outcome = 'no_attendance' then '{}'::timestamptz[] else c.requested_call_times end,
        preferred_call_at = null,
        status = case when _outcome = 'no_longer_interested' then 'lost' else c.status end,
        call_declined_at = case when _outcome = 'no_longer_interested' then now() else c.call_declined_at end,
        admin_notes = concat_ws(E'\n', nullif(c.admin_notes, ''),
          '[Online Session - ' || v_label || '] ' || coalesce(nullif(trim(_comment), ''), 'No additional comment provided.'))
    where c.id = _application_id and public.is_booked_for_session(c);
  if not found then
    raise exception 'Candidate not found or not in the Booked Appointment stage';
  end if;
end $$;

revoke all on function public.mark_candidate_interviewed from public, anon;
revoke all on function public.mark_candidate_session_outcome from public, anon;
grant execute on function public.mark_candidate_interviewed to authenticated;
grant execute on function public.mark_candidate_session_outcome to authenticated;
