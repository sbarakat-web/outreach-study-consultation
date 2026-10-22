-- Candidates pick (or change) their consultation time from the dashboard.

create or replace function public.choose_slot(p_consultation_id uuid, p_slot_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_slot public.slots%rowtype;
begin
  if auth.uid() is null or not public.owns_consultation(p_consultation_id) then
    raise exception 'NOT_ALLOWED';
  end if;

  select * into v_slot from public.slots where id = p_slot_id for update;
  if not found or v_slot.consultation_id is not null or v_slot.starts_at <= now() then
    raise exception 'SLOT_TAKEN';
  end if;

  update public.slots set consultation_id = null where consultation_id = p_consultation_id;
  update public.slots set consultation_id = p_consultation_id where id = p_slot_id;
  update public.consultations
    set status = 'consultation_booked'
    where id = p_consultation_id and status in ('new', 'contacted', 'qualified');
end $$;

revoke all on function public.choose_slot from public, anon;
grant execute on function public.choose_slot to authenticated;
