-- Footer contact details: company name, website, email, phone and more social links.
alter table public.marketing_settings
  add column if not exists company_name text not null default 'Outreach — Study in Malta',
  add column if not exists website_url text not null default 'https://outreachstudy.eu',
  add column if not exists contact_email text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists linkedin_url text not null default '',
  add column if not exists youtube_url text not null default '';
