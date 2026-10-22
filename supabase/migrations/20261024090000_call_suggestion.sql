-- Admin suggests a call time; the candidate confirms it with one click (email, WhatsApp or dashboard).
--   suggested_call_at   time proposed by the admin, waiting for the candidate
--   call_suggested_at   when the suggestion was sent
--   call_confirm_token  secret for the public /confirm-call link (no sign-in needed)
-- The confirm-call edge function (service role) reads the token and confirms the call.

alter table public.consultations
  add column suggested_call_at timestamptz,
  add column call_suggested_at timestamptz,
  add column call_confirm_token uuid;

create unique index consultations_call_confirm_token_key on public.consultations (call_confirm_token);

-- A new request from the candidate replaces any pending suggestion.
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
    set requested_call_times = p_times, call_status = 'requested', suggested_call_at = null, call_suggested_at = null
    where id = p_consultation_id and call_status <> 'confirmed' and call_declined_at is null;
  if not found then
    raise exception 'ALREADY_CONFIRMED';
  end if;
end $$;
