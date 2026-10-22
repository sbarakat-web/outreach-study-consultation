-- Call emails v2: candidate language, advisor profile (name + photo), confirm-by deadline,
-- 24h "please confirm" reminder.
--   consultations.language         en | fr | es | ar — the language the candidate uses in the app
--   consultations.call_suggested_by staff email that sent the suggestion (the advisor in emails)
--   consultations.call_confirm_by   soft deadline shown in the email
--   consultations.suggest_reminder_at  24h reminder sent (claimed by send-reminders)
--   staff_profiles                 display name + photo shown to candidates

alter table public.consultations
  add column language text check (language in ('en', 'fr', 'es', 'ar')),
  add column call_suggested_by text,
  add column call_confirm_by timestamptz,
  add column suggest_reminder_at timestamptz;

create table public.staff_profiles (
  email text primary key check (email = lower(email)),
  display_name text,
  photo_url text,
  updated_at timestamptz not null default now()
);
alter table public.staff_profiles enable row level security;

create policy "staff_profiles: staff read" on public.staff_profiles
  for select to authenticated using (public.is_admin() or public.is_session_presenter());
create policy "staff_profiles: own insert" on public.staff_profiles
  for insert to authenticated with check (email = public.my_email() and (public.is_admin() or public.is_session_presenter()));
create policy "staff_profiles: own update" on public.staff_profiles
  for update to authenticated using (email = public.my_email()) with check (email = public.my_email());

-- Public bucket for advisor photos (shown in emails). Files live at {email}/{file}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-photos', 'staff-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "staff-photos: own upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'staff-photos' and (storage.foldername(name))[1] = public.my_email() and (public.is_admin() or public.is_session_presenter()));
create policy "staff-photos: own read" on storage.objects
  for select to authenticated
  using (bucket_id = 'staff-photos' and (storage.foldername(name))[1] = public.my_email());
create policy "staff-photos: own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'staff-photos' and (storage.foldername(name))[1] = public.my_email());
create policy "staff-photos: own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'staff-photos' and (storage.foldername(name))[1] = public.my_email());

-- Candidates save their language from Settings (emails follow it).
create or replace function public.set_my_language(p_lang text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_lang not in ('en', 'fr', 'es', 'ar') then
    raise exception 'INVALID_INPUT';
  end if;
  update public.consultations c
    set language = p_lang
    where c.user_id = auth.uid() or c.email = public.my_email();
end $$;
revoke all on function public.set_my_language from public, anon;
grant execute on function public.set_my_language to authenticated;
