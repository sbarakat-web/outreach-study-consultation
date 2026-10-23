-- Restrict this staff account to the online-session presenter workflow.
insert into public.session_presenters (email)
values ('sofyanebarakat@gmail.com')
on conflict (email) do nothing;
