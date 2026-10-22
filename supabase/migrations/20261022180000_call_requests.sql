-- Calls are requested, not booked: the candidate picks a preferred time, an admin
-- reviews the profile and confirms the call manually (Google booking page).

alter table public.consultations
  add column preferred_call_at timestamptz,
  add column call_status text not null default 'none' check (call_status in ('none', 'requested', 'confirmed'));

create or replace function public.request_call(p_consultation_id uuid, p_at timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.owns_consultation(p_consultation_id) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_at < now() + interval '12 hours' or p_at > now() + interval '90 days' then
    raise exception 'INVALID_TIME';
  end if;

  update public.consultations
    set preferred_call_at = p_at, call_status = 'requested'
    where id = p_consultation_id and call_status <> 'confirmed';
  if not found then
    raise exception 'ALREADY_CONFIRMED';
  end if;
end $$;

revoke all on function public.request_call from public, anon;
grant execute on function public.request_call to authenticated;
