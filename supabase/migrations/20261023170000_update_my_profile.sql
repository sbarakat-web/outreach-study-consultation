-- Candidates edit their own contact details from Settings → My account.
create or replace function public.update_my_profile(p_full_name text, p_whatsapp text, p_country text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_ALLOWED';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'INVALID_INPUT';
  end if;
  update public.consultations c
    set full_name = trim(p_full_name),
        whatsapp = nullif(trim(p_whatsapp), ''),
        country = nullif(trim(p_country), '')
    where c.user_id = auth.uid() or c.email = public.my_email();
end $$;
revoke all on function public.update_my_profile from public, anon;
grant execute on function public.update_my_profile to authenticated;
