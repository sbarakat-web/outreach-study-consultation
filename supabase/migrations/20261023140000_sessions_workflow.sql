-- Calendar ↔ online-session workflow: advisers, Google Calendar, reminders, document
-- deadlines, feedback, tasks and session stats. Additive only.

alter table public.consultations
  add column assigned_to text,                     -- adviser email (admin or session presenter)
  add column google_event_id text,
  add column documents_due_at timestamptz,
  add column reminder_24h_at timestamptz,
  add column reminder_1h_at timestamptz,
  add column docs_reminder_at timestamptz,
  add column docs_reminder_final_at timestamptz,
  add column session_by text,                      -- who recorded the session outcome
  add column session_rating int check (session_rating between 1 and 5),
  add column session_feedback text,
  add column session_feedback_at timestamptz;

-- Staff directory (admins + presenters) for adviser pickers.
create or replace function public.staff_list()
returns table (email text, role text)
language sql stable security definer set search_path = ''
as $$
  select a.email, 'admin' from public.admins a where public.is_admin() or public.is_session_presenter()
  union
  select p.email, 'session_presenter' from public.session_presenters p
    where (public.is_admin() or public.is_session_presenter()) and p.email not in (select email from public.admins)
$$;
revoke all on function public.staff_list from public, anon;
grant execute on function public.staff_list to authenticated;

-- Presenters may read documents of candidates they can see (pre-call brief).
create policy "documents: presenter read booked or interviewed" on public.documents
  for select to authenticated
  using (public.is_session_presenter() and exists (select 1 from public.consultations c where c.id = consultation_id));

-- Next-step tasks shown in the lead and on the Calendar.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations (id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  done_at timestamptz,
  created_by text default public.my_email(),
  created_at timestamptz not null default now()
);
create index tasks_due_idx on public.tasks (due_at);
alter table public.tasks enable row level security;
create policy "tasks: staff read" on public.tasks for select to authenticated using (public.is_admin() or public.is_session_presenter());
create policy "tasks: staff add" on public.tasks for insert to authenticated with check (public.is_admin() or public.is_session_presenter());
create policy "tasks: staff update" on public.tasks for update to authenticated
  using (public.is_admin() or public.is_session_presenter()) with check (public.is_admin() or public.is_session_presenter());
create policy "tasks: admins delete" on public.tasks for delete to authenticated using (public.is_admin());

-- Google Calendar connections (refresh tokens): service role only, no client access.
create table public.google_connections (
  email text primary key,
  refresh_token text not null,
  calendar_id text not null default 'primary',
  is_default boolean not null default false,
  connected_at timestamptz not null default now()
);
alter table public.google_connections enable row level security;

create table public.oauth_states (
  state text primary key,
  email text not null,
  created_at timestamptz not null default now()
);
alter table public.oauth_states enable row level security;

create or replace function public.google_connected()
returns table (email text, is_default boolean)
language sql stable security definer set search_path = ''
as $$
  select g.email, g.is_default from public.google_connections g where public.is_admin() or public.is_session_presenter()
$$;
revoke all on function public.google_connected from public, anon;
grant execute on function public.google_connected to authenticated;

-- Student feedback after an interviewed session.
create or replace function public.submit_session_feedback(p_consultation_id uuid, p_rating int, p_comment text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.owns_consultation(p_consultation_id) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_rating not between 1 and 5 then
    raise exception 'INVALID_RATING';
  end if;
  update public.consultations
    set session_rating = p_rating, session_feedback = nullif(trim(p_comment), ''), session_feedback_at = now()
    where id = p_consultation_id and session_outcome = 'interviewed';
end $$;
revoke all on function public.submit_session_feedback from public, anon;
grant execute on function public.submit_session_feedback to authenticated;

-- Outcomes now also record the adviser and (for interviewed) a 7-day document deadline.
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
        status = 'documents_requested',
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
        status = case when _outcome = 'no_longer_interested' then 'lost' else c.status end,
        call_declined_at = case when _outcome = 'no_longer_interested' then now() else c.call_declined_at end,
        admin_notes = concat_ws(E'\n', nullif(c.admin_notes, ''),
          '[Online Session - ' || v_label || '] ' || coalesce(nullif(trim(_comment), ''), 'No additional comment provided.'))
    where c.id = _application_id and public.is_booked_for_session(c);
  if not found then
    raise exception 'Candidate not found or not in the Booked Appointment stage';
  end if;
end $$;

-- Busy times for candidates' calendar: start/end only, no details.
create or replace function public.booked_call_times()
returns table (starts_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select c.preferred_call_at from public.consultations c
  where c.call_status = 'confirmed' and c.preferred_call_at > now() and public.is_booked_for_session(c)
$$;
grant execute on function public.booked_call_times to anon, authenticated;
