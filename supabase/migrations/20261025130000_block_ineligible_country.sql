-- Enforce the public eligibility rule at the database boundary so direct RPC
-- calls cannot bypass the application form.
create or replace function public.book_consultation(
  p_full_name text,
  p_email text,
  p_whatsapp text,
  p_country text,
  p_age int,
  p_study_path text,
  p_english_level text,
  p_desired_course text,
  p_start_date text,
  p_budget text,
  p_visa_support text,
  p_preferred_contact_time text,
  p_message text,
  p_slot_id uuid,
  p_tracking jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_slot public.slots%rowtype;
begin
  if coalesce(trim(p_full_name), '') = '' or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_INPUT: name and a valid email are required';
  end if;

  if lower(coalesce(trim(p_country), '')) in ('pakistan', 'pk') then
    raise exception 'INELIGIBLE_COUNTRY: applications from Pakistan are not currently eligible';
  end if;

  if p_slot_id is not null then
    select * into v_slot from public.slots where id = p_slot_id for update;
    if not found or v_slot.consultation_id is not null or v_slot.starts_at <= now() then
      raise exception 'SLOT_TAKEN';
    end if;
  end if;

  insert into public.consultations (
    user_id, full_name, email, whatsapp, country, age, study_path, english_level,
    desired_course, start_date, budget, visa_support, preferred_contact_time,
    message, status, tracking
  ) values (
    auth.uid(), trim(p_full_name), lower(trim(p_email)), nullif(trim(p_whatsapp), ''),
    nullif(trim(p_country), ''), p_age, p_study_path, p_english_level,
    nullif(trim(p_desired_course), ''), p_start_date, p_budget, p_visa_support,
    p_preferred_contact_time, nullif(trim(p_message), ''),
    case when p_slot_id is null then 'new' else 'consultation_booked' end,
    coalesce(p_tracking, '{}'::jsonb)
  )
  returning id into v_id;

  if p_slot_id is not null then
    update public.slots set consultation_id = v_id where id = p_slot_id;
  end if;

  return v_id;
end $$;

revoke all on function public.book_consultation from public;
grant execute on function public.book_consultation to anon, authenticated;
