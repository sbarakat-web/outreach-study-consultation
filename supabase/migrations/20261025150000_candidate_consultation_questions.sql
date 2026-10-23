-- Candidates prepare questions in their dashboard; session presenters see them
-- with the booked candidate's profile. Keep this separate from staff notes.
alter table public.consultations
  add column candidate_questions text check (char_length(candidate_questions) <= 1500),
  add column candidate_questions_updated_at timestamptz;

create or replace function public.save_candidate_questions(p_consultation_id uuid, p_questions text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.owns_consultation(p_consultation_id) then
    raise exception 'NOT_ALLOWED';
  end if;

  if char_length(coalesce(p_questions, '')) > 1500 then
    raise exception 'QUESTIONS_TOO_LONG';
  end if;

  update public.consultations
    set candidate_questions = nullif(trim(p_questions), ''),
        candidate_questions_updated_at = now()
    where id = p_consultation_id;
end $$;

revoke all on function public.save_candidate_questions from public, anon;
grant execute on function public.save_candidate_questions to authenticated;
