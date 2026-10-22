-- This function is trigger-only and must not be callable through the API.
revoke all on function public.mark_marketing_account_created() from public, anon, authenticated;

-- Cover the two foreign keys added by the email marketing schema.
create index marketing_contacts_created_by_idx on public.marketing_contacts(created_by);
create index marketing_email_templates_updated_by_idx on public.marketing_email_templates(updated_by);
