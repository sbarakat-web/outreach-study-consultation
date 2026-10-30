-- "Thank you, our door is open" email when a lead becomes No longer interested (sent by send-reminders).
alter table public.consultations add column if not exists not_interested_email_at timestamptz;

-- Leads already marked No longer interested don't get it retroactively.
update public.consultations set not_interested_email_at = now()
where status = 'not_interested' and not_interested_email_at is null;

create or replace function public.not_interested_email_state()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Leads created with this status already got their status email.
    if new.status = 'not_interested' then
      new.not_interested_email_at := coalesce(new.not_interested_email_at, now());
    end if;
  elsif old.status = 'not_interested' and new.status <> 'not_interested' then
    -- Re-activated: a later "no longer interested" sends the email again.
    new.not_interested_email_at := null;
  end if;
  return new;
end $$;

create trigger consultations_not_interested_email_state
  before insert or update of status on public.consultations
  for each row execute function public.not_interested_email_state();
