-- Second online-session presenter (access to /onlinesessions only).
insert into public.session_presenters (email)
values ('ncalleja@outreachrecruitment.net')
on conflict (email) do nothing;
