alter table public.marketing_email_templates
  add column image_url text;

update public.marketing_email_templates
set image_url = 'https://consultation.outreachstudy.eu/onlinesessions/online-session-hero-v2.webp'
where id = 'account-invite' and image_url is null;

alter table public.marketing_contacts
  add column unsubscribed_at timestamptz;

alter table public.marketing_contacts drop constraint marketing_contacts_status_check;
alter table public.marketing_contacts add constraint marketing_contacts_status_check
  check (status in ('draft', 'sent', 'opened', 'clicked', 'account_created', 'unsubscribed', 'failed'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing-assets', 'marketing-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "marketing assets: admins upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'marketing-assets' and public.is_admin());

create policy "marketing assets: admins update" on storage.objects
  for update to authenticated
  using (bucket_id = 'marketing-assets' and public.is_admin())
  with check (bucket_id = 'marketing-assets' and public.is_admin());

create policy "marketing assets: admins delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'marketing-assets' and public.is_admin());
