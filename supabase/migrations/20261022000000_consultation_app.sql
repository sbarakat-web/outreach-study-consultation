-- Consultation app: candidates book consultations, admins manage them.
-- Admin rights come from the `admins` allowlist (by email); a user is only
-- treated as that email once Supabase has confirmed it.

-- ---------------------------------------------------------------- helpers

create or replace function public.my_email()
returns text
language sql stable security definer set search_path = ''
as $$
  select lower(u.email)
  from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null
$$;

create table public.admins (
  email text primary key check (email = lower(email)),
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.email = public.my_email())
$$;

-- ---------------------------------------------------------------- tables

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null,
  email text not null check (email = lower(email)),
  whatsapp text,
  country text,
  age int check (age is null or age between 12 and 99),
  study_path text,
  english_level text,
  desired_course text,
  start_date text,
  budget text,
  visa_support text,
  preferred_contact_time text,
  message text,
  status text not null default 'new' check (status in (
    'new', 'contacted', 'qualified', 'consultation_booked', 'documents_requested',
    'application_submitted', 'offer_received', 'payment', 'visa_process', 'enrolled', 'lost'
  )),
  admin_notes text,
  tracking jsonb not null default '{}'::jsonb,
  confirmation_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index consultations_user_id_idx on public.consultations (user_id);
create index consultations_email_idx on public.consultations (email);
create index consultations_created_at_idx on public.consultations (created_at desc);

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null unique,
  duration_minutes int not null default 30 check (duration_minutes between 5 and 240),
  consultation_id uuid unique references public.consultations (id) on delete set null,
  created_at timestamptz not null default now()
);

create index slots_starts_at_idx on public.slots (starts_at);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  file_path text not null unique,
  file_name text not null,
  created_at timestamptz not null default now()
);

create index documents_consultation_id_idx on public.documents (consultation_id);

create or replace function public.owns_consultation(cid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.consultations c
    where c.id = cid and (c.user_id = auth.uid() or c.email = public.my_email())
  )
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger consultations_touch before update on public.consultations
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- RLS

alter table public.admins enable row level security;
alter table public.consultations enable row level security;
alter table public.slots enable row level security;
alter table public.documents enable row level security;

create policy "admins: admins read" on public.admins
  for select to authenticated using (public.is_admin());
create policy "admins: admins add" on public.admins
  for insert to authenticated with check (public.is_admin());
create policy "admins: admins remove others" on public.admins
  for delete to authenticated using (public.is_admin() and email <> public.my_email());

-- Candidates read their own requests; only admins change or delete them.
-- New requests are created through book_consultation().
create policy "consultations: owner or admin read" on public.consultations
  for select to authenticated
  using (user_id = auth.uid() or email = public.my_email() or public.is_admin());
create policy "consultations: admin update" on public.consultations
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "consultations: admin delete" on public.consultations
  for delete to authenticated using (public.is_admin());

-- Anyone can see open future slots; owners see their booked slot; admins see all.
create policy "slots: open, own or admin read" on public.slots
  for select to anon, authenticated
  using (
    (consultation_id is null and starts_at > now())
    or (consultation_id is not null and public.owns_consultation(consultation_id))
    or public.is_admin()
  );
create policy "slots: admin insert" on public.slots
  for insert to authenticated with check (public.is_admin());
create policy "slots: admin update" on public.slots
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "slots: admin delete" on public.slots
  for delete to authenticated using (public.is_admin());

create policy "documents: owner or admin read" on public.documents
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "documents: owner add" on public.documents
  for insert to authenticated
  with check (user_id = auth.uid() and public.owns_consultation(consultation_id));
create policy "documents: owner or admin delete" on public.documents
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- booking

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

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 10485760)
on conflict (id) do nothing;

-- Files live at {user_id}/{consultation_id}/{file}
create policy "documents bucket: owner upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents bucket: owner or admin read" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "documents bucket: owner or admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
