create table public.marketing_contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique check (email = lower(email)),
  status text not null default 'draft' check (status in ('draft', 'sent', 'opened', 'clicked', 'account_created', 'failed')),
  tracking_token uuid not null default gen_random_uuid() unique,
  send_count int not null default 0,
  open_count int not null default 0,
  click_count int not null default 0,
  follow_up_count int not null default 0,
  last_sent_at timestamptz,
  last_opened_at timestamptz,
  last_clicked_at timestamptz,
  last_follow_up_at timestamptz,
  next_follow_up_at timestamptz,
  account_created_at timestamptz,
  provider_email_id text,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketing_email_templates (
  id text primary key default 'account-invite' check (id = 'account-invite'),
  subject text not null,
  body text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.marketing_email_templates (id, subject, body)
values (
  'account-invite',
  '{name}, create your free Outreach Study account',
  'Your personal account keeps your Malta study consultation, documents and next steps together in one secure place.'
)
on conflict (id) do nothing;

alter table public.marketing_contacts enable row level security;
alter table public.marketing_email_templates enable row level security;

create policy "marketing contacts: admins manage" on public.marketing_contacts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "marketing templates: admins manage" on public.marketing_email_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create trigger marketing_contacts_touch before update on public.marketing_contacts
for each row execute function public.touch_updated_at();

create or replace function public.mark_marketing_account_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null then
    update public.marketing_contacts
    set status = 'account_created',
        account_created_at = coalesce(account_created_at, now()),
        next_follow_up_at = null
    where email = lower(new.email) and status <> 'account_created';
  end if;
  return new;
end $$;

drop trigger if exists marketing_account_created on auth.users;
create trigger marketing_account_created
after insert or update of email_confirmed_at on auth.users
for each row execute function public.mark_marketing_account_created();

create index marketing_contacts_created_at_idx on public.marketing_contacts(created_at desc);
create index marketing_contacts_status_idx on public.marketing_contacts(status);
create index marketing_contacts_follow_up_idx on public.marketing_contacts(next_follow_up_at)
  where next_follow_up_at is not null;

-- Process due follow-ups hourly. The function is idempotent and claims every row
-- before sending, so overlapping cron calls cannot send duplicates.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'process-marketing-followups',
  '5 * * * *',
  $$ select net.http_post(
       url := 'https://qkcdjqrtwzqflrrxdgqw.supabase.co/functions/v1/process-marketing-followups',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
