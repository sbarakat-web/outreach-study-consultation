-- Email marketing builder: block templates, image library, footer settings,
-- campaigns with audiences / scheduling / A-B subjects, per-recipient sends, preferences.

-- Templates: many, made of blocks (see supabase/functions/_shared/marketing-render.ts).
alter table public.marketing_email_templates drop constraint marketing_email_templates_id_check;
alter table public.marketing_email_templates alter column id set default gen_random_uuid()::text;
alter table public.marketing_email_templates
  add column name text,
  add column preheader text,
  add column blocks jsonb not null default '[]'::jsonb,
  add column topic text not null default 'news' check (topic in ('news', 'deadlines')),
  add column is_system boolean not null default false,
  add column created_at timestamptz not null default now();

update public.marketing_email_templates set
  name = 'Account invite',
  is_system = true,
  preheader = 'Create your Outreach Study account and continue your Malta journey.',
  blocks = jsonb_build_array(
    jsonb_build_object('id', 'h1', 'type', 'heading', 'text', 'Welcome, {name}'),
    jsonb_build_object('id', 'i1', 'type', 'image', 'url', coalesce(image_url, 'https://consultation.outreachstudy.eu/onlinesessions/online-session-hero-v2.webp'), 'alt', 'Students in Malta', 'href', ''),
    jsonb_build_object('id', 't1', 'type', 'text', 'text', body),
    jsonb_build_object('id', 'b1', 'type', 'button', 'label', 'Create my free account', 'href', '{signup_link}'),
    jsonb_build_object('id', 't2', 'type', 'text', 'text', 'It takes about two minutes. If you need help, reply to this email and our team will guide you.')
  )
where id = 'account-invite';

insert into public.marketing_email_templates (id, name, subject, body, preheader, topic, blocks) values
('intake-deadline', 'Intake deadline', '{name}, applications for the next intake close soon', '', 'Secure your place before the deadline.', 'deadlines',
  '[{"id":"h1","type":"heading","text":"The next intake is filling up"},
    {"id":"t1","type":"text","text":"Hi {name}, places for {course|your programme} are limited. Book your free call now so we can check your documents before the deadline."},
    {"id":"b1","type":"button","label":"Open my dashboard","href":"{dashboard_link}"},
    {"id":"q1","type":"quote","text":"Outreach helped me with every step, from the call to my visa.","author":"Student from Morocco"}]'),
('scholarship-news', 'Scholarship news', 'New scholarships for studying in Malta', '', 'Funding opportunities for your Malta studies.', 'news',
  '[{"id":"h1","type":"heading","text":"New scholarships are open"},
    {"id":"t1","type":"text","text":"Hi {name}, several schools have opened scholarships for international students. Ask {advisor|your advisor} which ones fit your profile."},
    {"id":"p1","type":"programme","image":"https://consultation.outreachstudy.eu/onlinesessions/online-session-hero-v2.webp","alt":"Campus in Malta","name":"Bachelor in Business","price":"From €4,500 / year","href":"{dashboard_link}","label":"Apply"},
    {"id":"b1","type":"button","label":"Book a free call","href":"{dashboard_link}"}]'),
('documents-reminder', 'Documents reminder', '{name}, a few documents are still missing', '', 'Upload your documents to keep your application moving.', 'deadlines',
  '[{"id":"h1","type":"heading","text":"Your documents are almost complete"},
    {"id":"t1","type":"text","text":"Hi {name}, to move your application for {course|your programme} forward, please upload the remaining documents in your dashboard."},
    {"id":"b1","type":"button","label":"Upload my documents","href":"{dashboard_link}"}]'),
('we-miss-you', 'We miss you', '{name}, is Malta still on your mind?', '', 'Your free call is one click away.', 'news',
  '[{"id":"h1","type":"heading","text":"We miss you, {name}"},
    {"id":"t1","type":"text","text":"Your Malta study plans are still saved. Pick a time for a free 20-minute call and we will guide you from there."},
    {"id":"b1","type":"button","label":"Pick a time","href":"{dashboard_link}"}]')
on conflict (id) do nothing;

-- Reusable image library (files live in the public marketing-assets bucket).
create table public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  alt text not null default '',
  name text,
  width int,
  height int,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index marketing_assets_created_by_idx on public.marketing_assets(created_by);

-- Footer settings (one row).
create table public.marketing_settings (
  id int primary key default 1 check (id = 1),
  address text not null default '',
  instagram_url text not null default '',
  facebook_url text not null default '',
  tiktok_url text not null default '',
  whatsapp text not null default '35699728213',
  why_text text not null default 'You are receiving this email because you applied or asked about studying in Malta with Outreach.',
  updated_at timestamptz not null default now()
);
insert into public.marketing_settings (id) values (1) on conflict do nothing;

-- Email preferences per address (manage-preferences page and unsubscribe).
create table public.marketing_preferences (
  email text primary key check (email = lower(email)),
  token uuid not null unique default gen_random_uuid(),
  news boolean not null default true,
  deadlines boolean not null default true,
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Campaigns and their sends.
create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_id text references public.marketing_email_templates(id) on delete set null,
  subject_a text not null,
  subject_b text,
  topic text not null default 'news' check (topic in ('news', 'deadlines')),
  segment jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  local_morning boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  recipients int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index marketing_campaigns_template_idx on public.marketing_campaigns(template_id);
create index marketing_campaigns_created_by_idx on public.marketing_campaigns(created_by);

create table public.marketing_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  consultation_id uuid references public.consultations(id) on delete set null,
  email text not null,
  variant text not null default 'a' check (variant in ('a', 'b')),
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped', 'cancelled')),
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  opened_at timestamptz,
  open_count int not null default 0,
  clicked_at timestamptz,
  click_count int not null default 0,
  unsubscribed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (campaign_id, email)
);
create index marketing_sends_due_idx on public.marketing_sends(send_after) where status = 'pending';
create index marketing_sends_consultation_idx on public.marketing_sends(consultation_id);

alter table public.marketing_assets enable row level security;
alter table public.marketing_settings enable row level security;
alter table public.marketing_preferences enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_sends enable row level security;

create policy "marketing assets: admins manage" on public.marketing_assets for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "marketing settings: admins manage" on public.marketing_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "marketing preferences: admins read" on public.marketing_preferences for select to authenticated using (public.is_admin());
create policy "marketing campaigns: admins manage" on public.marketing_campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "marketing sends: admins read" on public.marketing_sends for select to authenticated using (public.is_admin());
